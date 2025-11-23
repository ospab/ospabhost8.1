import { Router } from 'express';
import {
  createBucket,
  listBuckets,
  getBucket,
  deleteBucket,
  updateBucketSettings,
  listBucketObjects,
  createPresignedUrl,
  deleteObjects,
  createEphemeralKey,
  listAccessKeys,
  revokeAccessKey
} from './storage.service';
import { authMiddleware } from '../auth/auth.middleware';

// Предполагается, что аутентификация уже навешена на /api/storage через глобальный middleware (passport + JWT)
// Здесь используем req.user?.id (нужно убедиться что в auth модуле добавляется user в req)

const router = Router();

// Монтируем JWT-мидлвар на модуль, чтобы req.user всегда был установлен
router.use(authMiddleware);

// Создание бакета
router.post('/buckets', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });

    const { name, plan, quotaGb, region, storageClass, public: isPublic, versioning } = req.body;
    if (!name || !plan || !quotaGb) return res.status(400).json({ error: 'name, plan, quotaGb обязательны' });

    // Временное определение цены (можно заменить запросом к таблице s3_plan)
    const PRICE_MAP: Record<string, number> = { basic: 99, standard: 199, plus: 399, pro: 699, enterprise: 1999 };
    const price = PRICE_MAP[plan] || 0;

    const bucket = await createBucket({
      userId,
      name,
      plan,
      quotaGb: Number(quotaGb),
      region: region || 'ru-central-1',
      storageClass: storageClass || 'standard',
      public: !!isPublic,
      versioning: !!versioning,
      price
    });

    return res.json({ bucket });
  } catch (e: unknown) {
    let message = 'Ошибка создания бакета';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

// Список бакетов пользователя
router.get('/buckets', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const buckets = await listBuckets(userId);
    return res.json({ buckets });
  } catch (e: unknown) {
    return res.status(500).json({ error: 'Ошибка получения списка бакетов' });
  }
});

// Детали одного бакета
router.get('/buckets/:id', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const bucket = await getBucket(userId, id);
    return res.json({ bucket });
  } catch (e: unknown) {
    let message = 'Ошибка получения бакета';
    if (e instanceof Error) message = e.message;
    return res.status(404).json({ error: message });
  }
});

// Обновление настроек бакета
router.patch('/buckets/:id', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const bucket = await updateBucketSettings(userId, id, req.body ?? {});
    return res.json({ bucket });
  } catch (e: unknown) {
    let message = 'Ошибка обновления бакета';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

// Удаление бакета
router.delete('/buckets/:id', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const force = req.query.force === 'true';
    const bucket = await deleteBucket(userId, id, force);
    return res.json({ bucket });
  } catch (e: unknown) {
    let message = 'Ошибка удаления бакета';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

// Список объектов в бакете
router.get('/buckets/:id/objects', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const { prefix, cursor, limit } = req.query;
    const result = await listBucketObjects(userId, id, {
      prefix: typeof prefix === 'string' ? prefix : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: limit ? Number(limit) : undefined
    });
    return res.json(result);
  } catch (e: unknown) {
    let message = 'Ошибка получения списка объектов';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

// Пресайн URL для загрузки/скачивания
router.post('/buckets/:id/objects/presign', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const { key, method, expiresIn, contentType } = req.body ?? {};
    if (!key) return res.status(400).json({ error: 'Не указан key объекта' });

    const result = await createPresignedUrl(userId, id, key, { method, expiresIn, contentType });
    return res.json(result);
  } catch (e: unknown) {
    let message = 'Ошибка генерации ссылки';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

// Удаление объектов
router.delete('/buckets/:id/objects', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const { keys } = req.body ?? {};
    if (!Array.isArray(keys)) return res.status(400).json({ error: 'keys должен быть массивом' });
    const result = await deleteObjects(userId, id, keys);
    return res.json(result);
  } catch (e: unknown) {
    let message = 'Ошибка удаления объектов';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

// Управление access keys
router.get('/buckets/:id/access-keys', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const keys = await listAccessKeys(userId, id);
    return res.json({ keys });
  } catch (e: unknown) {
    let message = 'Ошибка получения ключей';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

router.post('/buckets/:id/access-keys', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const { label } = req.body ?? {};
    const key = await createEphemeralKey(userId, id, label);
    return res.json({ key });
  } catch (e: unknown) {
    let message = 'Ошибка создания ключа';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

router.delete('/buckets/:id/access-keys/:keyId', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    const keyId = Number(req.params.keyId);
    const result = await revokeAccessKey(userId, id, keyId);
    return res.json(result);
  } catch (e: unknown) {
    let message = 'Ошибка удаления ключа';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

export default router;

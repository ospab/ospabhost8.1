import { Router } from 'express';
import axios from 'axios';
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
  revokeAccessKey,
  listStoragePlans,
  createCheckoutSession,
  getCheckoutSession,
  markCheckoutSessionConsumed,
  listStorageRegions,
  listStorageClasses,
  getStorageStatus,
  generateConsoleCredentials
} from './storage.service';
import { authMiddleware, optionalAuthMiddleware } from '../auth/auth.middleware';

// Предполагается, что аутентификация уже навешена на /api/storage через глобальный middleware (passport + JWT)
// Здесь используем req.user?.id (нужно убедиться что в auth модуле добавляется user в req)

const router = Router();

// Публичный список тарифов для S3
// JWT мидлвар для админ операций
router.put('/plans/:id', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const isAdmin = Boolean((req as any).user?.isAdmin);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Только администраторы могут редактировать тарифы' });
    }

    const planId = parseInt(req.params.id);
    if (!Number.isFinite(planId)) {
      return res.status(400).json({ error: 'Некорректный ID тарифа' });
    }

    const { name, price, pricePerGb, bandwidthPerGb, requestsPerGb, description } = req.body;

    const { prisma } = await import('../../prisma/client.js');
    const updated = await (prisma as any).storagePlan.update({
      where: { id: planId },
      data: {
        ...(name && { name }),
        ...(price !== undefined && { price: Number(price) }),
        ...(pricePerGb !== undefined && { pricePerGb: pricePerGb !== null ? parseFloat(pricePerGb) : null }),
        ...(bandwidthPerGb !== undefined && { bandwidthPerGb: bandwidthPerGb !== null ? parseFloat(bandwidthPerGb) : null }),
        ...(requestsPerGb !== undefined && { requestsPerGb: requestsPerGb !== null ? parseInt(requestsPerGb) : null }),
        ...(description !== undefined && { description }),
        updatedAt: new Date(),
      },
    });

    return res.json({ success: true, plan: updated });
  } catch (error) {
    console.error('[Storage] Ошибка обновления тарифа:', error);
    const message = error instanceof Error ? error.message : 'Не удалось обновить тариф';
    return res.status(500).json({ error: message });
  }
});

router.get('/plans', async (_req, res) => {
  try {
    const plans = await listStoragePlans();
    return res.json({ plans });
  } catch (error) {
    console.error('[Storage] Ошибка получения тарифов:', error);
    return res.status(500).json({ error: 'Не удалось загрузить тарифы' });
  }
});

router.get('/regions', async (_req, res) => {
  try {
    const regions = await listStorageRegions();
    return res.json({ regions });
  } catch (error) {
    console.error('[Storage] Ошибка получения регионов:', error);
    return res.status(500).json({ error: 'Не удалось загрузить список регионов' });
  }
});

router.get('/classes', async (_req, res) => {
  try {
    const classes = await listStorageClasses();
    return res.json({ classes });
  } catch (error) {
    console.error('[Storage] Ошибка получения классов хранения:', error);
    return res.status(500).json({ error: 'Не удалось загрузить список классов хранения' });
  }
});

router.get('/status', async (_req, res) => {
  try {
    const status = await getStorageStatus();
    return res.json(status);
  } catch (error) {
    console.error('[Storage] Ошибка получения статуса хранилища:', error);
    return res.status(500).json({ error: 'Не удалось получить статус хранилища' });
  }
});

router.post('/checkout', optionalAuthMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id ?? null;
    const { planCode, planId, customGb } = req.body ?? {};

    const numericPlanId = typeof planId === 'number'
      ? planId
      : typeof planId === 'string' && planId.trim() !== '' && !Number.isNaN(Number(planId))
        ? Number(planId)
        : undefined;

    const session = await createCheckoutSession({
      planCode: typeof planCode === 'string' ? planCode : undefined,
      planId: numericPlanId,
      userId,
      customGb: typeof customGb === 'number' ? customGb : undefined,
    });
    return res.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать корзину';
    console.error('[Storage] Ошибка создания корзины:', error);
    return res.status(400).json({ error: message });
  }
});

// Монтируем JWT-мидлвар на приватные операции
router.use(authMiddleware);

router.get('/cart/:id', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const cartId = req.params.id;
    const result = await getCheckoutSession(cartId, userId);
    return res.json(result.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось загрузить корзину';
    return res.status(400).json({ error: message });
  }
});

// Создание бакета
router.post('/buckets', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });

    const { name, cartId, region, storageClass, public: isPublic, versioning } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Укажите имя бакета' });
    }

    if (!cartId || typeof cartId !== 'string') {
      return res.status(400).json({ error: 'cartId обязателен' });
    }

    const session = await getCheckoutSession(cartId, userId);

    const { bucket, consoleCredentials } = await createBucket({
      userId,
      name,
      planCode: session.payload.plan.code,
      region: region || 'ru-central-1',
      storageClass: storageClass || 'standard',
      public: !!isPublic,
      versioning: !!versioning
    });

    await markCheckoutSessionConsumed(cartId);

    return res.json({ bucket, consoleCredentials });
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

router.post('/buckets/:id/console-credentials', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Некорректный идентификатор бакета' });
    }

    const credentials = await generateConsoleCredentials(userId, id);
    return res.json({ credentials });
  } catch (e: unknown) {
    let message = 'Не удалось сгенерировать данные входа';
    let statusCode = 400;
    if (e instanceof Error) {
      message = e.message;
      // Check for rate limit error
      if ((e as any).status === 429) {
        statusCode = 429;
      }
    }
    return res.status(statusCode).json({ error: message });
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
    const { key, method, expiresIn, contentType, download, downloadFileName } = req.body ?? {};
    if (!key) return res.status(400).json({ error: 'Не указан key объекта' });

    const result = await createPresignedUrl(userId, id, key, {
      method,
      expiresIn,
      contentType,
      download: download === true,
      downloadFileName: typeof downloadFileName === 'string' ? downloadFileName : undefined,
    });
    return res.json(result);
  } catch (e: unknown) {
    let message = 'Ошибка генерации ссылки';
    if (e instanceof Error) message = e.message;
    return res.status(400).json({ error: message });
  }
});

// Загрузка файла по URI с proxy (обход CORS)
router.post('/buckets/:id/objects/download-from-uri', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
    
    const id = Number(req.params.id);
    const { url } = req.body ?? {};
    
    if (!url) return res.status(400).json({ error: 'Не указан URL' });

    // Проверяем что пользователь имеет доступ к бакету
    await getBucket(userId, id); // Проверка доступа

    // Загружаем файл с URL с увеличенным timeout
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000, // 120 seconds (2 minutes)
      maxContentLength: 5 * 1024 * 1024 * 1024, // 5GB max
    });

    const mimeType = response.headers['content-type'] || 'application/octet-stream';
    const buffer = response.data;

    return res.json({
      blob: buffer.toString('base64'),
      mimeType,
    });
  } catch (e: unknown) {
    let message = 'Ошибка загрузки файла по URI';
    if (e instanceof Error) {
      if (e.message.includes('timeout')) {
        message = 'Превышено время ожидания при загрузке файла. Попробуйте позже.';
      } else {
        message = e.message;
      }
    }
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

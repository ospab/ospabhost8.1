import crypto from 'crypto';
import type { StorageBucket } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { ensureBucketExists, buildPhysicalBucketName, minioClient } from './minioClient';
import { createNotification } from '../notification/notification.controller';

interface CreateBucketInput {
  userId: number;
  name: string;
  plan: string;
  quotaGb: number;
  region: string;
  storageClass: string;
  public: boolean;
  versioning: boolean;
  price: number; // ежемесячная стоимость плана для списания
}

interface UpdateBucketInput {
  public?: boolean;
  versioning?: boolean;
  autoRenew?: boolean;
  storageClass?: string;
  name?: string;
}

interface ListObjectsOptions {
  prefix?: string;
  cursor?: string;
  limit?: number;
}

interface PresignOptions {
  method?: 'PUT' | 'GET';
  expiresIn?: number;
  contentType?: string;
}

const BILLING_INTERVAL_DAYS = 30;
const USAGE_REFRESH_INTERVAL_MINUTES = 5;
const PRESIGN_DEFAULT_TTL = 15 * 60; // 15 минут

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value ?? 0;
}

function serializeBucket(bucket: StorageBucket) {
  return {
    ...bucket,
    usedBytes: toNumber(bucket.usedBytes),
    monthlyPrice: Number(bucket.monthlyPrice),
    nextBillingDate: bucket.nextBillingDate?.toISOString() ?? null,
    lastBilledAt: bucket.lastBilledAt?.toISOString() ?? null,
    usageSyncedAt: bucket.usageSyncedAt?.toISOString() ?? null,
  };
}

function needsUsageRefresh(bucket: StorageBucket): boolean {
  if (!bucket.usageSyncedAt) return true;
  const diffMs = Date.now() - bucket.usageSyncedAt.getTime();
  return diffMs > USAGE_REFRESH_INTERVAL_MINUTES * 60 * 1000;
}

async function calculateBucketUsage(physicalName: string): Promise<{ totalBytes: bigint; objectCount: number; }>
{
  return await new Promise((resolve, reject) => {
    let bytes = BigInt(0);
    let count = 0;
    const stream = minioClient.listObjectsV2(physicalName, '', true);

    stream.on('data', (obj) => {
      if (obj?.name) {
        count += 1;
        const size = typeof obj.size === 'number' ? obj.size : 0;
        bytes += BigInt(size);
      }
    });

    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve({ totalBytes: bytes, objectCount: count }));
  });
}

async function syncBucketUsage(bucket: StorageBucket): Promise<StorageBucket> {
  const physicalName = buildPhysicalBucketName(bucket.userId, bucket.name);
  try {
    const usage = await calculateBucketUsage(physicalName);
    return await prisma.storageBucket.update({
      where: { id: bucket.id },
      data: {
        usedBytes: usage.totalBytes,
        objectCount: usage.objectCount,
        usageSyncedAt: new Date(),
      }
    });
  } catch (error) {
    console.error(`[Storage] Не удалось синхронизировать usage для бакета ${bucket.id}`, error);
    return bucket;
  }
}

async function fetchBucket(userId: number, bucketId: number): Promise<StorageBucket> {
  const bucket = await prisma.storageBucket.findFirst({ where: { id: bucketId, userId } });
  if (!bucket) throw new Error('Бакет не найден');
  return bucket;
}

async function applyPublicPolicy(physicalName: string, isPublic: boolean) {
  try {
    if (isPublic) {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${physicalName}/*`]
          }
        ]
      };
      await minioClient.setBucketPolicy(physicalName, JSON.stringify(policy));
    } else {
      // Сбрасываем политику
      await minioClient.setBucketPolicy(physicalName, '');
    }
  } catch (error) {
    console.error(`[Storage] Не удалось применить политику для бакета ${physicalName}`, error);
  }
}

async function applyVersioning(physicalName: string, enabled: boolean) {
  try {
    await minioClient.setBucketVersioning(physicalName, {
      Status: enabled ? 'Enabled' : 'Suspended'
    });
  } catch (error) {
    console.error(`[Storage] Не удалось обновить версионирование для ${physicalName}`, error);
  }
}

async function collectObjectKeys(physicalName: string): Promise<string[]> {
  return await new Promise((resolve, reject) => {
    const keys: string[] = [];
    const stream = minioClient.listObjectsV2(physicalName, '', true);
    stream.on('data', (obj) => {
      if (obj?.name) keys.push(obj.name);
    });
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(keys));
  });
}

export async function createBucket(data: CreateBucketInput) {
  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) throw new Error('Пользователь не найден');
  if (user.balance < data.price) throw new Error('Недостаточно средств');

  const physicalName = buildPhysicalBucketName(data.userId, data.name);

  const now = new Date();
  await ensureBucketExists(physicalName, data.region);

  try {
    const bucket = await prisma.$transaction(async (tx) => {
      const reloadedUser = await tx.user.findUnique({ where: { id: data.userId } });
      if (!reloadedUser) throw new Error('Пользователь не найден');
      if (reloadedUser.balance < data.price) throw new Error('Недостаточно средств');

      const updatedUser = await tx.user.update({
        where: { id: data.userId },
        data: { balance: reloadedUser.balance - data.price }
      });

      await tx.transaction.create({
        data: {
          userId: data.userId,
          amount: -data.price,
          type: 'withdrawal',
          description: `Создание S3 бакета ${data.name}`,
          balanceBefore: reloadedUser.balance,
          balanceAfter: updatedUser.balance
        }
      });

      const bucketRecord = await tx.storageBucket.create({
        data: {
          userId: data.userId,
          name: data.name,
          plan: data.plan,
          quotaGb: data.quotaGb,
          region: data.region,
          storageClass: data.storageClass,
          public: data.public,
          versioning: data.versioning,
          monthlyPrice: data.price,
          nextBillingDate: addDays(now, BILLING_INTERVAL_DAYS),
          lastBilledAt: now,
          autoRenew: true,
          status: 'active',
          usageSyncedAt: now
        }
      });

      return bucketRecord;
    });

    await Promise.all([
      applyPublicPolicy(physicalName, data.public),
      applyVersioning(physicalName, data.versioning)
    ]);

    await createNotification({
      userId: data.userId,
      type: 'storage_bucket_created',
      title: 'Создан новый бакет',
      message: `Бакет «${data.name}» успешно создан. Следующее списание: ${addDays(now, BILLING_INTERVAL_DAYS).toLocaleDateString('ru-RU')}`,
      color: 'green'
    });

    return serializeBucket({ ...bucket, usedBytes: BigInt(0), objectCount: 0 });
  } catch (error) {
    // Откатываем созданный бакет в MinIO, если транзакция не удалась
    try {
      const keys = await collectObjectKeys(physicalName);
      if (keys.length > 0) {
        const chunks = Array.from({ length: Math.ceil(keys.length / 1000) }, (_, idx) =>
          keys.slice(idx * 1000, (idx + 1) * 1000)
        );
        for (const chunk of chunks) {
          await minioClient.removeObjects(physicalName, chunk);
        }
      }
      await minioClient.removeBucket(physicalName);
    } catch (cleanupError) {
      console.error('[Storage] Ошибка очистки бакета после неудачного создания', cleanupError);
    }
    throw error;
  }
}

export async function listBuckets(userId: number) {
  const buckets = await prisma.storageBucket.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

  const results: StorageBucket[] = [];
  for (const bucket of buckets) {
    if (needsUsageRefresh(bucket)) {
      const refreshed = await syncBucketUsage(bucket);
      results.push(refreshed);
    } else {
      results.push(bucket);
    }
  }

  return results.map(serializeBucket);
}

export async function getBucket(userId: number, id: number, options: { refreshUsage?: boolean } = {}) {
  const bucket = await fetchBucket(userId, id);
  const shouldRefresh = options.refreshUsage ?? true;
  const finalBucket = shouldRefresh && needsUsageRefresh(bucket) ? await syncBucketUsage(bucket) : bucket;
  return serializeBucket(finalBucket);
}

export async function deleteBucket(userId: number, id: number, force = false) {
  const bucket = await fetchBucket(userId, id);
  const physicalName = buildPhysicalBucketName(bucket.userId, bucket.name);

  const keys = await collectObjectKeys(physicalName);
  if (keys.length > 0 && !force) {
    throw new Error('Невозможно удалить непустой бакет. Удалите объекты или используйте force=true');
  }

  if (keys.length > 0) {
    const chunks = Array.from({ length: Math.ceil(keys.length / 1000) }, (_, idx) =>
      keys.slice(idx * 1000, (idx + 1) * 1000)
    );
    for (const chunk of chunks) {
      await minioClient.removeObjects(physicalName, chunk);
    }
  }

  await minioClient.removeBucket(physicalName);

  await prisma.storageAccessKey.deleteMany({ where: { bucketId: bucket.id } });
  const deleted = await prisma.storageBucket.delete({ where: { id: bucket.id } });

  await createNotification({
    userId,
    type: 'storage_bucket_deleted',
    title: 'Бакет удалён',
    message: `Бакет «${bucket.name}» был удалён`,
    color: 'red'
  });

  return serializeBucket(deleted);
}

export async function updateBucketSettings(userId: number, id: number, payload: UpdateBucketInput) {
  const bucket = await fetchBucket(userId, id);
  const physicalName = buildPhysicalBucketName(bucket.userId, bucket.name);

  if (payload.public !== undefined) {
    await applyPublicPolicy(physicalName, payload.public);
  }

  if (payload.versioning !== undefined) {
    await applyVersioning(physicalName, payload.versioning);
  }

  const data: UpdateBucketInput & { nextBillingDate?: Date | null } = { ...payload };

  if (payload.autoRenew && !bucket.autoRenew) {
    data.nextBillingDate = bucket.nextBillingDate ?? addDays(new Date(), BILLING_INTERVAL_DAYS);
  }

  const updated = await prisma.storageBucket.update({
    where: { id: bucket.id },
    data: {
      ...('public' in data ? { public: data.public } : {}),
      ...('versioning' in data ? { versioning: data.versioning } : {}),
      ...('autoRenew' in data ? { autoRenew: data.autoRenew } : {}),
      ...('storageClass' in data ? { storageClass: data.storageClass } : {}),
      ...('name' in data && data.name && data.name !== bucket.name ? { name: data.name } : {}),
      ...(data.nextBillingDate ? { nextBillingDate: data.nextBillingDate } : {}),
    }
  });

  if (payload.name && payload.name !== bucket.name) {
    // Переименовываем физический бакет через копирование ключей
    const newPhysicalName = buildPhysicalBucketName(bucket.userId, payload.name);
    await ensureBucketExists(newPhysicalName, bucket.region);
    const keys = await collectObjectKeys(physicalName);
    if (keys.length) {
      for (const key of keys) {
        const readable = await minioClient.getObject(physicalName, key);
        await minioClient.putObject(newPhysicalName, key, readable);
        await minioClient.removeObject(physicalName, key);
      }
    }
    await minioClient.removeBucket(physicalName);
    await applyPublicPolicy(newPhysicalName, updated.public);
    await applyVersioning(newPhysicalName, updated.versioning);
  }

  return serializeBucket(updated);
}

export async function listBucketObjects(userId: number, id: number, options: ListObjectsOptions = {}) {
  const bucket = await fetchBucket(userId, id);
  const physicalName = buildPhysicalBucketName(bucket.userId, bucket.name);
  const { prefix = '', cursor = '', limit = 100 } = options;

  const objects: Array<{ key: string; size: number; etag?: string; lastModified?: string; }> = [];
  let lastKey: string | null = null;

  await new Promise<void>((resolve, reject) => {
    const stream = minioClient.listObjectsV2(physicalName, prefix, true, cursor);
    stream.on('data', (obj) => {
      if (!obj?.name) return;
      if (objects.length >= limit) {
        lastKey = obj.name;
        stream.destroy();
        return;
      }

      objects.push({
        key: obj.name,
        size: typeof obj.size === 'number' ? obj.size : 0,
        etag: obj.etag,
        lastModified: obj.lastModified ? new Date(obj.lastModified).toISOString() : undefined,
      });
      lastKey = obj.name;
    });
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve());
  });

  return {
    objects,
    nextCursor: lastKey,
  };
}

export async function createPresignedUrl(userId: number, id: number, objectKey: string, options: PresignOptions = {}) {
  const bucket = await fetchBucket(userId, id);
  const physicalName = buildPhysicalBucketName(bucket.userId, bucket.name);
  const method = options.method ?? 'PUT';
  const expires = options.expiresIn ?? PRESIGN_DEFAULT_TTL;

  if (method === 'PUT') {
    const url = await minioClient.presignedPutObject(physicalName, objectKey, expires);
    return { url, method: 'PUT' };
  }

  if (method === 'GET') {
    const responseHeaders = options.contentType ? { 'response-content-type': options.contentType } : undefined;
    const url = await minioClient.presignedGetObject(physicalName, objectKey, expires, responseHeaders);
    return { url, method: 'GET' };
  }

  throw new Error('Поддерживаются только методы GET и PUT для пресайн ссылки');
}

export async function deleteObjects(userId: number, id: number, keys: string[]) {
  if (!Array.isArray(keys) || keys.length === 0) return { deleted: 0 };
  const bucket = await fetchBucket(userId, id);
  const physicalName = buildPhysicalBucketName(bucket.userId, bucket.name);

  const chunks = Array.from({ length: Math.ceil(keys.length / 1000) }, (_, idx) =>
    keys.slice(idx * 1000, (idx + 1) * 1000)
  );

  let deleted = 0;
  for (const chunk of chunks) {
    await minioClient.removeObjects(physicalName, chunk);
    deleted += chunk.length;
  }

  await syncBucketUsage(bucket);

  return { deleted };
}

export async function createEphemeralKey(userId: number, id: number, label?: string) {
  const bucket = await fetchBucket(userId, id);
  const accessKey = `S3${crypto.randomBytes(8).toString('hex')}`;
  const secretKey = crypto.randomBytes(32).toString('hex');

  const record = await prisma.storageAccessKey.create({
    data: {
      bucketId: bucket.id,
      accessKey,
      secretKey,
      label,
    }
  });

  return {
    id: record.id,
    accessKey,
    secretKey,
    label: record.label,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listAccessKeys(userId: number, id: number) {
  const bucket = await fetchBucket(userId, id);
  const keys = await prisma.storageAccessKey.findMany({
    where: { bucketId: bucket.id },
    orderBy: { createdAt: 'desc' }
  });

  return keys.map((key) => ({
    id: key.id,
    accessKey: key.accessKey,
    label: key.label,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null
  }));
}

export async function revokeAccessKey(userId: number, id: number, keyId: number) {
  const bucket = await fetchBucket(userId, id);
  await prisma.storageAccessKey.deleteMany({
    where: { id: keyId, bucketId: bucket.id }
  });
  return { revoked: true };
}

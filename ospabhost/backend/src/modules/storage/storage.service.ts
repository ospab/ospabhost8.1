import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { StorageBucket } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { ensureBucketExists, buildPhysicalBucketName, minioClient } from './minioClient';
import { createNotification } from '../notification/notification.controller';

const MINIO_CONSOLE_URL = process.env.MINIO_CONSOLE_URL ?? null;
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'localhost';
const MINIO_PORT = process.env.MINIO_PORT ?? 9000;
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? 'minioadmin';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ADMIN_URL = `http${MINIO_USE_SSL ? 's' : ''}://${MINIO_ENDPOINT}:${MINIO_PORT}`;

// For mc CLI calls
const MINIO_ALIAS = 'minio';
const MINIO_MC_ENABLED = process.env.MINIO_MC_ENABLED !== 'false'; // Enable by default
const execAsync = promisify(exec);

const bucketIncludeBase = {
  storagePlan: true,
  regionConfig: true,
  storageClassConfig: true,
} as const;

let consoleCredentialSupport: boolean | null = null;
let consoleSupportLogged = false;

interface CreateBucketInput {
  userId: number;
  name: string;
  planCode: string;
  region: string;
  storageClass: string;
  public: boolean;
  versioning: boolean;
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
  download?: boolean;
  downloadFileName?: string;
}

const BILLING_INTERVAL_DAYS = 30;
const USAGE_REFRESH_INTERVAL_MINUTES = 5;
const PRESIGN_DEFAULT_TTL = 15 * 60; // 15 минут
const CHECKOUT_SESSION_TTL_MINUTES = 20;

type StoragePlanRecord = {
  id: number;
  code: string;
  name: string;
  price: number | string;
  quotaGb: number;
  bandwidthGb: number;
  requestLimit: string;
  description?: string | null;
  order: number;
  isActive: boolean;
  pricePerGb?: number | string | null;
  bandwidthPerGb?: number | string | null;
  requestsPerGb?: number | null;
};

type StorageRegionRecord = {
  code: string;
  name: string;
  description?: string | null;
  endpoint?: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type StorageClassRecord = {
  code: string;
  name: string;
  description?: string | null;
  redundancy?: string | null;
  performance?: string | null;
  retrievalFee?: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type StorageConsoleCredentialRecord = {
  id: number;
  bucketId: number;
  login: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  lastGeneratedAt?: Date | null;
};

type BucketWithPlan = StorageBucket & {
  storagePlan?: StoragePlanRecord | null;
  regionConfig?: StorageRegionRecord | null;
  storageClassConfig?: StorageClassRecord | null;
  consoleCredential?: StorageConsoleCredentialRecord | null;
};

function isConsoleCredentialError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as Record<string, unknown>)?.code;
  if (code === 'P2021' || code === 'P2022' || code === 'P2010') {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /storage[_-]console[_-]credential/i.test(message) || /unknown table/i.test(message) || /doesn't exist/i.test(message);
}

function logConsoleWarning(error: unknown) {
  if (consoleSupportLogged) {
    return;
  }
  consoleSupportLogged = true;
  console.warn('[Storage] Таблица storage_console_credential недоступна. Продолжаем без данных консоли.', error);
}

async function ensureConsoleCredentialSupport(client: any = prisma): Promise<boolean> {
  if (consoleCredentialSupport === false) {
    return false;
  }

  const delegate = client?.storageConsoleCredential;
  if (!delegate) {
    consoleCredentialSupport = false;
    return false;
  }

  if (consoleCredentialSupport === true) {
    return true;
  }

  try {
    await delegate.count();
    consoleCredentialSupport = true;
    return true;
  } catch (error) {
    if (isConsoleCredentialError(error)) {
      consoleCredentialSupport = false;
      logConsoleWarning(error);
      return false;
    }
    throw error;
  }
}

async function fetchConsoleCredentialMap(bucketIds: number[]): Promise<Map<number, StorageConsoleCredentialRecord>> {
  const map = new Map<number, StorageConsoleCredentialRecord>();
  if (bucketIds.length === 0) {
    return map;
  }
  if (!(await ensureConsoleCredentialSupport())) {
    return map;
  }

  try {
    const records = await (prisma as unknown as Record<string, any>).storageConsoleCredential.findMany({
      where: { bucketId: { in: bucketIds } },
    });
    for (const record of records as StorageConsoleCredentialRecord[]) {
      map.set(record.bucketId, record);
    }
  } catch (error) {
    if (isConsoleCredentialError(error)) {
      consoleCredentialSupport = false;
      logConsoleWarning(error);
      return map;
    }
    throw error;
  }

  return map;
}

async function attachConsoleCredentials<T extends { id: number }>(buckets: T[]): Promise<Array<T & { consoleCredential?: StorageConsoleCredentialRecord | null }>> {
  if (buckets.length === 0) {
    return buckets as Array<T & { consoleCredential?: StorageConsoleCredentialRecord | null }>;
  }

  const credentialMap = await fetchConsoleCredentialMap(buckets.map((bucket) => bucket.id));
  return buckets.map((bucket) => ({
    ...bucket,
    consoleCredential: credentialMap.get(bucket.id) ?? null,
  }));
}

async function createConsoleCredentialRecord(client: any, data: { bucketId: number; login: string; passwordHash: string; }) {
  if (!(await ensureConsoleCredentialSupport(client))) {
    return false;
  }

  try {
    await client.storageConsoleCredential.create({ data });
    return true;
  } catch (error) {
    if (isConsoleCredentialError(error)) {
      consoleCredentialSupport = false;
      logConsoleWarning(error);
      return false;
    }
    throw error;
  }
}

type CheckoutSessionRecord = {
  id: string;
  userId: number | null;
  planId: number;
  planCode: string;
  planName: string;
  planDescription?: string | null;
  price: number | string;
  quotaGb: number;
  bandwidthGb: number;
  requestLimit: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date | null;
};

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function addMinutes(date: Date, minutes: number): Date {
  const clone = new Date(date);
  clone.setMinutes(clone.getMinutes() + minutes);
  return clone;
}

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value ?? 0;
}

function toPlainNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeBucketSegment(raw: string, fallback: string): string {
  const prepared = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return prepared || fallback;
}

function trimBucketRoot(root: string, maxLength: number, fallback: string): string {
  if (root.length <= maxLength) {
    return root;
  }
  let trimmed = root.slice(0, Math.max(1, maxLength)).replace(/-+$/gu, '');
  if (!trimmed) {
    trimmed = fallback.slice(0, Math.max(1, maxLength)).replace(/-+$/gu, '') || 'bucket';
  }
  return trimmed;
}

function generateConsolePassword(): string {
  return crypto
    .randomBytes(32)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/gu, '')
    .slice(0, 24);
}

/**
 * Create a user in MinIO via mc CLI or Admin API
 * Uses mc admin user add command for better compatibility
 */
async function createMinioUser(username: string, password: string): Promise<void> {
  if (!MINIO_MC_ENABLED) {
    console.warn(`[MinIO Admin] mc CLI disabled, skipping user creation for ${username}`);
    return;
  }

  try {
    // Setup mc alias with explicit S3v4 signature
    // The key is to add the --api S3v4 flag
    const setupAliasCmd = `mc alias set ${MINIO_ALIAS} "${MINIO_ADMIN_URL}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" --api S3v4`;
    
    try {
      const { stdout, stderr } = await execAsync(setupAliasCmd, { timeout: 5000 });
      console.info(`[MinIO Admin] Alias setup:`, stdout.trim() || stderr.trim());
    } catch (err: unknown) {
      // Alias might already exist, that's okay
      const errorMsg = (err as Error).message;
      if (!errorMsg.includes('exists')) {
        console.warn('[MinIO Admin] Warning setting up alias:', errorMsg);
      }
    }

    // Create or update user
    const createUserCmd = `mc admin user add ${MINIO_ALIAS} "${username}" "${password}"`;
    
    try {
      const { stdout, stderr } = await execAsync(createUserCmd, { timeout: 10000 });
      console.info(`[MinIO Admin] User ${username} created/updated:`, stdout.trim() || stderr.trim());
    } catch (error: unknown) {
      const errorMsg = (error as Record<string, any>)?.stderr || (error as Error)?.message || '';
      
      // Check if error is because user already exists
      if (errorMsg.includes('already exists') || errorMsg.includes('exists')) {
        console.warn(`[MinIO Admin] User ${username} already exists, updating password`);
        
        // Try to update password
        try {
          const changePassCmd = `mc admin user chpass ${MINIO_ALIAS} "${username}" "${password}"`;
          const { stdout: chpassOut } = await execAsync(changePassCmd, { timeout: 10000 });
          console.info(`[MinIO Admin] Password updated for user ${username}:`, chpassOut.trim());
        } catch (changeError: unknown) {
          console.error(`[MinIO Admin] Could not update password:`, (changeError as Error)?.message);
          // Don't throw, user exists anyway
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('[MinIO Admin] Error creating user:', error.message);
      // Don't throw - this is a non-critical operation
      // The credential will still be saved in DB
      console.warn(`[MinIO Admin] User creation failed but continuing. User will need to be created manually via mc: mc admin user add minio "${username}" "<password>"`);
    } else {
      throw error;
    }
  }
}

async function generateLogicalBucketName(userId: number, username: string, requestedName: string): Promise<string> {
  const prefix = (process.env.MINIO_BUCKET_PREFIX || 'ospab').toLowerCase();
  const userSegment = String(userId);
  const maxLogicalLength = Math.max(10, 63 - (prefix.length + userSegment.length + 2));

  const nickSlug = normalizeBucketSegment(username, `user-${userSegment}`);
  const baseSlug = normalizeBucketSegment(requestedName.replace(/_/gu, '-'), 'bucket');
  const rootBase = `${nickSlug}-${baseSlug}`.replace(/-+/gu, '-');

  const existingBuckets = await prisma.storageBucket.findMany({
    where: { userId },
    select: { name: true },
  });
  const existingNames = new Set(existingBuckets.map((item) => item.name));

  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const suffixStr = String(suffix);
    const maxRootLength = maxLogicalLength - (suffixStr.length + 1);
    if (maxRootLength <= 0) {
      break;
    }
    const rootForSuffix = trimBucketRoot(rootBase, maxRootLength, nickSlug);
    const candidate = `${rootForSuffix}-${suffixStr}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Не удалось автоматически сформировать уникальное имя бакета. Попробуйте другое название.');
}

function storagePlanDelegate() {
  const delegate = (prisma as any).storagePlan;
  if (!delegate) {
    throw new Error('StoragePlan модель недоступна. Выполните prisma generate, чтобы обновить клиент.');
  }
  return delegate as any;
}

function checkoutSessionDelegate() {
  const delegate = (prisma as any).storageCheckoutSession;
  if (!delegate) {
    throw new Error('StorageCheckoutSession модель недоступна. Выполните prisma generate, чтобы обновить клиент.');
  }
  return delegate as any;
}

function storageRegionDelegate() {
  const delegate = (prisma as any).storageRegion;
  if (!delegate) {
    throw new Error('StorageRegion модель недоступна. Выполните prisma generate, чтобы обновить клиент.');
  }
  return delegate as any;
}

function storageClassDelegate() {
  const delegate = (prisma as any).storageClass;
  if (!delegate) {
    throw new Error('StorageClass модель недоступна. Выполните prisma generate, чтобы обновить клиент.');
  }
  return delegate as any;
}

function serializePlan(plan: StoragePlanRecord) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    price: Number(plan.price),
    pricePerGb: plan.pricePerGb !== null && plan.pricePerGb !== undefined ? Number(plan.pricePerGb) : undefined,
    bandwidthPerGb: plan.bandwidthPerGb !== null && plan.bandwidthPerGb !== undefined ? Number(plan.bandwidthPerGb) : undefined,
    requestsPerGb: plan.requestsPerGb ?? undefined,
    quotaGb: plan.quotaGb,
    bandwidthGb: plan.bandwidthGb,
    requestLimit: plan.requestLimit,
    description: plan.description ?? null,
    order: plan.order,
    isActive: plan.isActive,
  };
}

function serializeRegion(region: StorageRegionRecord) {
  return {
    code: region.code,
    name: region.name,
    description: region.description ?? null,
    endpoint: region.endpoint ?? null,
    isDefault: region.isDefault,
    isActive: region.isActive,
  };
}

function serializeStorageClass(storageClass: StorageClassRecord) {
  return {
    code: storageClass.code,
    name: storageClass.name,
    description: storageClass.description ?? null,
    redundancy: storageClass.redundancy ?? null,
    performance: storageClass.performance ?? null,
    retrievalFee: storageClass.retrievalFee ?? null,
    isDefault: storageClass.isDefault,
    isActive: storageClass.isActive,
  };
}

function buildPlanFromSession(session: CheckoutSessionRecord, plan?: StoragePlanRecord | null) {
  const planId = plan?.id ?? session.planId;
  const base = plan ? serializePlan(plan) : {
    id: planId,
    code: session.planCode,
    name: session.planName,
    price: toPlainNumber(session.price),
    pricePerGb: undefined,
    bandwidthPerGb: undefined,
    requestsPerGb: undefined,
    quotaGb: session.quotaGb,
    bandwidthGb: session.bandwidthGb,
    requestLimit: session.requestLimit,
    description: session.planDescription ?? null,
    order: 0,
    isActive: true,
  };

  return {
    ...base,
    price: toPlainNumber(session.price),
  };
}

type CheckoutSessionPayload = {
  cartId: string;
  plan: ReturnType<typeof serializePlan>;
  price: number;
  expiresAt: string;
};

type CheckoutSessionResult = {
  session: CheckoutSessionRecord;
  payload: CheckoutSessionPayload;
};

function ensureSessionActive(session: CheckoutSessionRecord, userId: number): CheckoutSessionRecord {
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    throw new Error('Сессия оплаты истекла. Выберите тариф ещё раз.');
  }
  if (session.consumedAt) {
    throw new Error('Эта корзина уже использована. Создайте новую.');
  }
  if (session.userId && session.userId !== userId) {
    throw new Error('Эта корзина привязана к другому пользователю.');
  }
  return session;
}

function toCheckoutPayload(session: CheckoutSessionRecord, plan?: StoragePlanRecord | null): CheckoutSessionPayload {
  return {
    cartId: session.id,
    plan: buildPlanFromSession(session, plan),
    price: toPlainNumber(session.price),
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function createCheckoutSession(params: { planCode?: string; planId?: number; userId?: number | null; customGb?: number }): Promise<CheckoutSessionPayload> {
  const planId = typeof params.planId === 'number' && Number.isFinite(params.planId) ? Math.trunc(params.planId) : null;
  const code = params.planCode?.trim().toLowerCase();
  const customGb = typeof params.customGb === 'number' && params.customGb > 0 ? Math.trunc(params.customGb) : null;

  if (!planId && !code) {
    throw new Error('Не указан тариф для оформления');
  }

  let plan: StoragePlanRecord | null = null;

  if (planId) {
    plan = await storagePlanDelegate().findFirst({
      where: { id: planId, isActive: true },
    }) as StoragePlanRecord | null;
  }

  if (!plan && code) {
    plan = await storagePlanDelegate().findFirst({
      where: { code, isActive: true },
    }) as StoragePlanRecord | null;
  }

  if (!plan) {
    throw new Error('Тариф не найден или недоступен');
  }

  // Для custom тарифа - считаем параметры на основе GB
  let quotaGb = plan.quotaGb;
  let bandwidthGb = plan.bandwidthGb;
  let requestLimit = plan.requestLimit;
  let price = plan.price;

  if (plan.code === 'custom' && customGb && customGb > 0) {
    quotaGb = customGb;
    // Расчёт трафика пропорционально GB
    if (plan.bandwidthPerGb) {
      bandwidthGb = Math.ceil(Number(plan.bandwidthPerGb) * customGb);
    }
    // Расчёт операций пропорционально GB
    if (plan.requestsPerGb) {
      requestLimit = (customGb * plan.requestsPerGb).toLocaleString('ru-RU');
    }
    // Расчёт цены
    if (plan.pricePerGb) {
      price = Number(plan.pricePerGb) * customGb;
    }
  }

  const session = await checkoutSessionDelegate().create({
    data: {
      userId: params.userId ?? null,
      planCode: plan.code,
      planName: plan.name,
      planDescription: plan.description ?? null,
      price,
      quotaGb,
      bandwidthGb,
      requestLimit,
      planId: plan.id,
      expiresAt: addMinutes(new Date(), CHECKOUT_SESSION_TTL_MINUTES),
    },
  }) as CheckoutSessionRecord;

  return toCheckoutPayload(session, plan);
}

export async function getCheckoutSession(cartId: string, userId: number): Promise<CheckoutSessionResult> {
  const session = await checkoutSessionDelegate().findUnique({
    where: { id: cartId },
  }) as CheckoutSessionRecord | null;

  if (!session) {
    throw new Error('Корзина не найдена или истекла.');
  }

  const ensured = ensureSessionActive(session, userId);

  if (!ensured.userId) {
    ensured.userId = userId;
    await checkoutSessionDelegate().update({
      where: { id: ensured.id },
      data: { userId },
    });
  }

  let plan = await storagePlanDelegate().findFirst({
    where: { id: ensured.planId },
  }) as StoragePlanRecord | null;

  if (!plan) {
    plan = await storagePlanDelegate().findFirst({
      where: { code: ensured.planCode },
    }) as StoragePlanRecord | null;
  }

  return {
    session: ensured,
    payload: toCheckoutPayload(ensured, plan ?? undefined),
  };
}

export async function markCheckoutSessionConsumed(cartId: string) {
  try {
    await checkoutSessionDelegate().update({
      where: { id: cartId },
      data: { consumedAt: new Date() },
    });
  } catch (error) {
    console.warn(`[Storage] Не удалось пометить корзину ${cartId} как использованную`, error);
  }
}

export async function listStoragePlans() {
  const plans = await storagePlanDelegate().findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  }) as StoragePlanRecord[];

  return plans.map(serializePlan);
}

export async function listStorageRegions() {
  const regions = await storageRegionDelegate().findMany({
    where: { isActive: true },
    orderBy: [
      { isDefault: 'desc' },
      { code: 'asc' }
    ],
  }) as StorageRegionRecord[];

  return regions.map(serializeRegion);
}

export async function listStorageClasses() {
  const classes = await storageClassDelegate().findMany({
    where: { isActive: true },
    orderBy: [
      { isDefault: 'desc' },
      { code: 'asc' }
    ],
  }) as StorageClassRecord[];

  return classes.map(serializeStorageClass);
}

export async function getStorageStatus() {
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const bucketPrefix = process.env.MINIO_BUCKET_PREFIX || 'ospab';
  let connected = false;
  let availableBuckets = 0;
  let errorMessage: string | null = null;

  try {
    const buckets = await minioClient.listBuckets();
    connected = true;
    availableBuckets = Array.isArray(buckets) ? buckets.length : 0;
  } catch (error) {
    connected = false;
    errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка подключения к MinIO';
  }

  const [plans, regions, classes] = await Promise.all([
    listStoragePlans(),
    listStorageRegions(),
    listStorageClasses(),
  ]);

  const defaultRegion = regions.find((region) => region.isDefault) ?? regions[0] ?? null;
  const defaultClass = classes.find((storageClass) => storageClass.isDefault) ?? classes[0] ?? null;

  return {
    minio: {
      connected,
      endpoint,
      bucketPrefix,
      availableBuckets,
      error: errorMessage,
    },
    defaults: {
      region: defaultRegion,
      storageClass: defaultClass,
    },
    plans,
    regions,
    classes,
  };
}

function serializeBucket(bucket: BucketWithPlan) {
  const { storagePlan, regionConfig, storageClassConfig, consoleCredential, ...rest } = bucket;

  return {
    ...rest,
    usedBytes: toNumber(rest.usedBytes),
    monthlyPrice: Number(rest.monthlyPrice),
    nextBillingDate: rest.nextBillingDate?.toISOString() ?? null,
    lastBilledAt: rest.lastBilledAt?.toISOString() ?? null,
    usageSyncedAt: rest.usageSyncedAt?.toISOString() ?? null,
    planDetails: storagePlan ? serializePlan(storagePlan) : null,
    regionDetails: regionConfig ? serializeRegion(regionConfig) : null,
    storageClassDetails: storageClassConfig ? serializeStorageClass(storageClassConfig) : null,
    consoleLogin: consoleCredential?.login ?? null,
    consoleUrl: MINIO_CONSOLE_URL,
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

async function syncBucketUsage(bucket: BucketWithPlan): Promise<BucketWithPlan> {
  const physicalName = buildPhysicalBucketName(bucket.userId, bucket.name);
  try {
    const usage = await calculateBucketUsage(physicalName);
    const updated = await prisma.storageBucket.update({
      where: { id: bucket.id },
      data: {
        usedBytes: usage.totalBytes,
        objectCount: usage.objectCount,
        usageSyncedAt: new Date(),
      },
      include: bucketIncludeBase as any,
    });
    return updated as BucketWithPlan;
  } catch (error) {
    console.error(`[Storage] Не удалось синхронизировать usage для бакета ${bucket.id}`, error);
    return bucket;
  }
}

async function fetchBucket(userId: number, bucketId: number): Promise<BucketWithPlan> {
  const bucket = await prisma.storageBucket.findFirst({
    where: { id: bucketId, userId },
    include: bucketIncludeBase as any,
  });
  if (!bucket) throw new Error('Бакет не найден');
  const [enriched] = await attachConsoleCredentials([bucket as BucketWithPlan]);
  return enriched;
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
  const planCode = data.planCode.toLowerCase();
  const plan = await storagePlanDelegate().findFirst({
    where: { code: planCode, isActive: true },
  }) as StoragePlanRecord | null;
  if (!plan) throw new Error('Тариф не найден или отключён');
  const planPrice = toPlainNumber(plan.price);

  const regionCode = data.region.trim();
  if (!regionCode) throw new Error('Регион обязателен');
  const storageClassCode = data.storageClass.trim();
  if (!storageClassCode) throw new Error('Класс хранения обязателен');

  const region = await storageRegionDelegate().findFirst({
    where: { code: regionCode },
  }) as StorageRegionRecord | null;
  if (!region) {
    throw new Error('Указанный регион недоступен. Обновите список регионов.');
  }
  if (!region.isActive) {
    throw new Error('Регион временно недоступен');
  }

  const storageClass = await storageClassDelegate().findFirst({
    where: { code: storageClassCode },
  }) as StorageClassRecord | null;
  if (!storageClass) {
    throw new Error('Указанный класс хранения недоступен. Обновите список классов.');
  }
  if (!storageClass.isActive) {
    throw new Error('Класс хранения временно недоступен');
  }

  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) throw new Error('Пользователь не найден');
  if (toPlainNumber(user.balance) < planPrice) throw new Error('Недостаточно средств');
  const logicalName = await generateLogicalBucketName(data.userId, user.username, data.name);
  const physicalName = buildPhysicalBucketName(data.userId, logicalName);

  const consoleSupported = await ensureConsoleCredentialSupport();
  const consoleLogin = consoleSupported ? logicalName : null;
  const consolePasswordPlain = consoleSupported ? generateConsolePassword() : null;
  const consolePasswordHash = consolePasswordPlain ? await bcrypt.hash(consolePasswordPlain, 12) : null;

  let consoleCredentialsPayload: { login: string; password: string; url: string | null } | null = null;

  const now = new Date();
  await ensureBucketExists(physicalName, regionCode);

  try {
    const createdBucket = await prisma.$transaction(async (tx) => {
      const reloadedUser = await tx.user.findUnique({ where: { id: data.userId } });
      if (!reloadedUser) throw new Error('Пользователь не найден');
      if (toPlainNumber(reloadedUser.balance) < planPrice) throw new Error('Недостаточно средств');

      const updatedUser = await tx.user.update({
        where: { id: data.userId },
        data: { balance: reloadedUser.balance - Number(plan.price) }
      });

      await tx.transaction.create({
        data: {
          userId: data.userId,
          amount: -plan.price,
          type: 'withdrawal',
          description: `Создание S3 бакета ${logicalName} (${plan.name})`,
          balanceBefore: reloadedUser.balance,
          balanceAfter: updatedUser.balance
        }
      });

      const bucketRecord = await tx.storageBucket.create({
        data: {
          userId: data.userId,
          name: logicalName,
          plan: plan.code,
          quotaGb: plan.quotaGb,
          region: regionCode,
          storageClass: storageClassCode,
          public: data.public,
          versioning: data.versioning,
          monthlyPrice: Number(plan.price),
          nextBillingDate: addDays(now, BILLING_INTERVAL_DAYS),
          lastBilledAt: now,
          autoRenew: true,
          status: 'active',
          usageSyncedAt: now
        },
        include: { storagePlan: true, regionConfig: true, storageClassConfig: true } as Record<string, unknown>,
      });

      if (consoleLogin && consolePasswordHash) {
        const saved = await createConsoleCredentialRecord(tx, {
          bucketId: bucketRecord.id,
          login: consoleLogin,
          passwordHash: consolePasswordHash,
        });
        if (saved && consolePasswordPlain) {
          consoleCredentialsPayload = {
            login: consoleLogin,
            password: consolePasswordPlain,
            url: MINIO_CONSOLE_URL,
          };
        }
      }

      return bucketRecord as BucketWithPlan;
    });

    const bucket = await prisma.storageBucket.findUnique({
      where: { id: createdBucket.id },
      include: bucketIncludeBase as any,
    });

    if (!bucket) {
      throw new Error('Не удалось получить созданный бакет');
    }

    const [enrichedBucket] = await attachConsoleCredentials([bucket as BucketWithPlan]);

    await Promise.all([
      applyPublicPolicy(physicalName, data.public),
      applyVersioning(physicalName, data.versioning)
    ]);

    await createNotification({
      userId: data.userId,
      type: 'storage_bucket_created',
      title: 'Создан новый бакет',
      message: `Бакет «${logicalName}» успешно создан. Следующее списание: ${addDays(now, BILLING_INTERVAL_DAYS).toLocaleDateString('ru-RU')}`,
      color: 'green'
    });

    return {
      bucket: serializeBucket({ ...enrichedBucket, usedBytes: BigInt(0), objectCount: 0 } as BucketWithPlan),
      consoleCredentials: consoleCredentialsPayload,
    };
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
  const buckets = await prisma.storageBucket.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: bucketIncludeBase as any,
  }) as BucketWithPlan[];

  const results: BucketWithPlan[] = [];
  for (const bucket of buckets) {
    if (needsUsageRefresh(bucket)) {
      const refreshed = await syncBucketUsage(bucket);
      results.push(refreshed);
    } else {
      results.push(bucket);
    }
  }

  const enriched = await attachConsoleCredentials(results);
  return enriched.map(serializeBucket);
}

export async function getBucket(userId: number, id: number, options: { refreshUsage?: boolean } = {}) {
  const bucket = await fetchBucket(userId, id);
  const shouldRefresh = options.refreshUsage ?? true;
  const finalBucket = shouldRefresh && needsUsageRefresh(bucket) ? await syncBucketUsage(bucket) : bucket;
  const [enriched] = await attachConsoleCredentials([finalBucket]);
  return serializeBucket(enriched);
}

export async function generateConsoleCredentials(userId: number, id: number) {
  if (!(await ensureConsoleCredentialSupport())) {
    throw new Error('MinIO Console недоступна. Обратитесь в поддержку.');
  }

  const bucket = await fetchBucket(userId, id);
  
  // Rate limiting: max 1 generation per week (7 days)
  if (bucket.consoleCredential?.lastGeneratedAt) {
    const lastGenerated = new Date(bucket.consoleCredential.lastGeneratedAt);
    const now = new Date();
    const daysSinceLastGeneration = (now.getTime() - lastGenerated.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastGeneration < 7) {
      const daysRemaining = Math.ceil(7 - daysSinceLastGeneration);
      const error = new Error(`Учетные данные можно сгенерировать не чаще одного раза в неделю. Попробуйте через ${daysRemaining} дн.`) as Error & Record<string, unknown>;
      error.status = 429;
      throw error;
    }
  }

  const login = bucket.consoleCredential?.login ?? bucket.name;
  const password = generateConsolePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  // Try to create the user in MinIO Admin API, but don't fail if it doesn't work
  // The credentials will still be saved in DB, and can be created manually later
  try {
    await createMinioUser(login, password);
  } catch (minioError) {
    console.warn('[Storage] MinIO user creation failed, but continuing:', (minioError as Error).message);
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (!(await ensureConsoleCredentialSupport(tx))) {
        throw new Error('MinIO Console недоступна. Обратитесь в поддержку.');
      }

      const delegate = (tx as unknown as Record<string, any>).storageConsoleCredential;
      if (!delegate) {
        throw new Error('MinIO Console недоступна. Обратитесь в поддержку.');
      }

      await delegate.upsert({
        where: { bucketId: bucket.id },
        create: {
          bucketId: bucket.id,
          login,
          passwordHash,
          lastGeneratedAt: new Date(),
        },
        update: {
          passwordHash,
          lastGeneratedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (isConsoleCredentialError(error)) {
      consoleCredentialSupport = false;
      logConsoleWarning(error);
      throw new Error('MinIO Console недоступна. Обратитесь в поддержку.');
    }
    throw error;
  }

  console.info(`[Storage] Пользователь ${userId} сгенерировал данные входа MinIO Console для бакета ${id}`);

  return {
    login,
    password,
    url: MINIO_CONSOLE_URL,
  };
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

  return serializeBucket({ ...deleted } as BucketWithPlan);
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

  if (data.storageClass !== undefined) {
    const nextClass = data.storageClass.trim();
    if (!nextClass) {
      throw new Error('Класс хранения обязателен');
    }
    const classRecord = await storageClassDelegate().findFirst({
      where: { code: nextClass },
    }) as StorageClassRecord | null;
    if (!classRecord) {
      throw new Error('Указанный класс хранения недоступен. Обновите список классов.');
    }
    if (!classRecord.isActive) {
      throw new Error('Класс хранения временно недоступен');
    }
    data.storageClass = nextClass;
  }

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
    },
    include: { storagePlan: true, regionConfig: true, storageClassConfig: true } as any,
  }) as BucketWithPlan;

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

  const [enriched] = await attachConsoleCredentials([updated]);
  return serializeBucket(enriched);
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
    const responseHeaders: Record<string, string> = {};
    if (options.contentType) {
      responseHeaders['response-content-type'] = options.contentType;
    }
    if (options.download) {
      const rawName = options.downloadFileName?.trim() || objectKey.split('/').pop() || 'download';
      const encoded = encodeURIComponent(rawName).replace(/%20/gu, '+');
      responseHeaders['response-content-disposition'] = `attachment; filename*=UTF-8''${encoded}`;
    }
    const url = await minioClient.presignedGetObject(
      physicalName,
      objectKey,
      expires,
      Object.keys(responseHeaders).length > 0 ? responseHeaders : undefined
    );
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



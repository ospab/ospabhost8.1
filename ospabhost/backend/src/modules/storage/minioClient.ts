import { Client } from 'minio';

// Инициализация MinIO клиента через переменные окружения
// Добавьте в .env:
// MINIO_ENDPOINT=localhost
// MINIO_PORT=9000
// MINIO_USE_SSL=false
// MINIO_ACCESS_KEY=your_access_key
// MINIO_SECRET_KEY=your_secret_key
// MINIO_BUCKET_PREFIX=ospab

const {
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_USE_SSL,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY
} = process.env;

export const minioClient = new Client({
  endPoint: MINIO_ENDPOINT || 'localhost',
  port: MINIO_PORT ? parseInt(MINIO_PORT, 10) : 9000,
  useSSL: (MINIO_USE_SSL || 'false') === 'true',
  accessKey: MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: MINIO_SECRET_KEY || 'minioadmin'
});

export function buildPhysicalBucketName(userId: number, logicalName: string): string {
  const prefix = process.env.MINIO_BUCKET_PREFIX || 'ospab';
  return `${prefix}-${userId}-${logicalName}`.toLowerCase();
}

export async function ensureBucketExists(bucketName: string, region: string): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, region);
    }
  } catch (err: unknown) {
    throw err;
  }
}

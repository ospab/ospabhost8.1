INSERT INTO storage_plan
  (code, name, price, quotaGb, bandwidthGb, requestLimit, `order`, isActive, description)
VALUES
  ('dev-50', 'Developer 50', 99, 50, 100, '100 000 операций', 1, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('dev-100', 'Developer 100', 149, 100, 200, '250 000 операций', 2, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('dev-250', 'Developer 250', 199, 250, 400, '500 000 операций', 3, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('team-500', 'Team 500', 349, 500, 800, '1 000 000 операций', 4, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('team-1000', 'Team 1000', 499, 1000, 1500, '2 000 000 операций', 5, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('team-2000', 'Team 2000', 749, 2000, 3000, '5 000 000 операций', 6, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('scale-5000', 'Scale 5K', 1099, 5000, 6000, '10 000 000 операций', 7, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('scale-10000', 'Scale 10K', 1599, 10000, 12000, '20 000 000 операций', 8, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('scale-20000', 'Scale 20K', 2199, 20000, 25000, '50 000 000 операций', 9, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('enterprise-50000', 'Enterprise 50K', 3999, 50000, 60000, '100 000 000 операций', 10, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('enterprise-100000', 'Enterprise 100K', 6999, 100000, 120000, '250 000 000 операций', 11, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key'),
  ('enterprise-250000', 'Enterprise 250K', 11999, 250000, 300000, '500 000 000 операций', 12, TRUE, 'ru-central-1 регион | S3-совместимый API | Версионирование и presigned URL | Панель управления и уведомления | Access Key / Secret Key')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price = VALUES(price),
  quotaGb = VALUES(quotaGb),
  bandwidthGb = VALUES(bandwidthGb),
  requestLimit = VALUES(requestLimit),
  `order` = VALUES(`order`),
  isActive = VALUES(isActive),
  description = VALUES(description);

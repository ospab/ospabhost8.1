-- Manual migration SQL для добавления новых таблиц
-- Выполнить в MySQL базе данных ospabhost

-- 1. Таблица сеансов (Sessions)
CREATE TABLE IF NOT EXISTS `session` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `token` VARCHAR(500) NOT NULL,
  `ipAddress` VARCHAR(255) NULL,
  `userAgent` TEXT NULL,
  `device` VARCHAR(255) NULL,
  `browser` VARCHAR(255) NULL,
  `location` VARCHAR(255) NULL,
  `lastActivity` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `session_token_key` (`token`),
  INDEX `session_userId_idx` (`userId`),
  CONSTRAINT `session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Таблица истории входов (Login History)
CREATE TABLE IF NOT EXISTS `login_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `ipAddress` VARCHAR(255) NOT NULL,
  `userAgent` TEXT NULL,
  `device` VARCHAR(255) NULL,
  `browser` VARCHAR(255) NULL,
  `location` VARCHAR(255) NULL,
  `success` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `login_history_userId_idx` (`userId`),
  INDEX `login_history_createdAt_idx` (`createdAt`),
  CONSTRAINT `login_history_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Таблица SSH ключей
CREATE TABLE IF NOT EXISTS `ssh_key` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `publicKey` TEXT NOT NULL,
  `fingerprint` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastUsed` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `ssh_key_userId_idx` (`userId`),
  CONSTRAINT `ssh_key_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Таблица API ключей
CREATE TABLE IF NOT EXISTS `api_key` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `key` VARCHAR(64) NOT NULL,
  `prefix` VARCHAR(16) NOT NULL,
  `permissions` TEXT NULL,
  `lastUsed` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `api_key_key_key` (`key`),
  INDEX `api_key_userId_idx` (`userId`),
  INDEX `api_key_key_idx` (`key`),
  CONSTRAINT `api_key_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Таблица настроек уведомлений
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `emailServerCreated` BOOLEAN NOT NULL DEFAULT true,
  `emailServerStopped` BOOLEAN NOT NULL DEFAULT true,
  `emailBalanceLow` BOOLEAN NOT NULL DEFAULT true,
  `emailPaymentCharged` BOOLEAN NOT NULL DEFAULT true,
  `emailTicketReply` BOOLEAN NOT NULL DEFAULT true,
  `emailNewsletter` BOOLEAN NOT NULL DEFAULT false,
  `pushServerCreated` BOOLEAN NOT NULL DEFAULT true,
  `pushServerStopped` BOOLEAN NOT NULL DEFAULT true,
  `pushBalanceLow` BOOLEAN NOT NULL DEFAULT true,
  `pushPaymentCharged` BOOLEAN NOT NULL DEFAULT true,
  `pushTicketReply` BOOLEAN NOT NULL DEFAULT true,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `notification_settings_userId_key` (`userId`),
  CONSTRAINT `notification_settings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Таблица профиля пользователя
CREATE TABLE IF NOT EXISTS `user_profile` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `avatarUrl` VARCHAR(255) NULL,
  `phoneNumber` VARCHAR(255) NULL,
  `timezone` VARCHAR(255) NULL DEFAULT 'Europe/Moscow',
  `language` VARCHAR(255) NULL DEFAULT 'ru',
  `profilePublic` BOOLEAN NOT NULL DEFAULT false,
  `showEmail` BOOLEAN NOT NULL DEFAULT false,
  `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
  `twoFactorSecret` TEXT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_profile_userId_key` (`userId`),
  CONSTRAINT `user_profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Добавить поле passwordChangedAt в таблицу server (для скрытия пароля через 30 минут)
ALTER TABLE `server` ADD COLUMN `passwordChangedAt` DATETIME(3) NULL AFTER `rootPassword`;

-- Готово! Теперь выполните на сервере:
-- После выполнения этих запросов запустите:
-- npx prisma generate
-- npm run build
-- pm2 restart ospab-backend

-- ========================================
-- ОБНОВЛЕНИЕ: Добавление поля passwordChangedAt в таблицу server
-- ========================================

-- Добавляем поле для отслеживания времени изменения пароля
ALTER TABLE `server` 
ADD COLUMN `passwordChangedAt` DATETIME(3) NULL AFTER `rootPassword`;

-- Устанавливаем текущую дату для существующих серверов
UPDATE `server` 
SET `passwordChangedAt` = `createdAt` 
WHERE `passwordChangedAt` IS NULL AND `rootPassword` IS NOT NULL;


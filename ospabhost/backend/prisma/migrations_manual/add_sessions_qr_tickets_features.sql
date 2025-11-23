-- Миграция: Добавление системы сессий, QR-авторизации и улучшенных тикетов
-- Дата: 2025-11-09

-- 1. Обновление таблицы ticket (добавление новых полей)
ALTER TABLE `ticket` 
  MODIFY COLUMN `message` TEXT NOT NULL,
  ADD COLUMN `priority` VARCHAR(20) DEFAULT 'normal' AFTER `status`,
  ADD COLUMN `category` VARCHAR(50) DEFAULT 'general' AFTER `priority`,
  ADD COLUMN `assignedTo` INT NULL AFTER `category`,
  ADD COLUMN `closedAt` DATETIME NULL AFTER `updatedAt`;

-- 2. Обновление таблицы response
ALTER TABLE `response` 
  MODIFY COLUMN `message` TEXT NOT NULL,
  ADD COLUMN `isInternal` BOOLEAN DEFAULT FALSE AFTER `message`;

-- 3. Создание таблицы для прикреплённых файлов к тикетам
CREATE TABLE IF NOT EXISTS `ticket_attachment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ticketId` INT NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `fileUrl` VARCHAR(500) NOT NULL,
  `fileSize` INT NOT NULL,
  `mimeType` VARCHAR(100) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `ticketId_idx` (`ticketId`),
  CONSTRAINT `ticket_attachment_ticketId_fkey` 
    FOREIGN KEY (`ticketId`) 
    REFERENCES `ticket`(`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Создание таблицы для прикреплённых файлов к ответам
CREATE TABLE IF NOT EXISTS `response_attachment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `responseId` INT NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `fileUrl` VARCHAR(500) NOT NULL,
  `fileSize` INT NOT NULL,
  `mimeType` VARCHAR(100) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `responseId_idx` (`responseId`),
  CONSTRAINT `response_attachment_responseId_fkey` 
    FOREIGN KEY (`responseId`) 
    REFERENCES `response`(`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Создание таблицы QR-авторизации
CREATE TABLE IF NOT EXISTS `qr_login_request` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(128) NOT NULL,
  `userId` INT NULL,
  `status` VARCHAR(20) DEFAULT 'pending',
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` TEXT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` DATETIME NOT NULL,
  `confirmedAt` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code_unique` (`code`),
  INDEX `code_idx` (`code`),
  INDEX `status_expiresAt_idx` (`status`, `expiresAt`),
  INDEX `userId_idx` (`userId`),
  CONSTRAINT `qr_login_request_userId_fkey` 
    FOREIGN KEY (`userId`) 
    REFERENCES `user`(`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Проверка и создание таблицы session (если не существует)
CREATE TABLE IF NOT EXISTS `session` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `token` VARCHAR(500) NOT NULL,
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` TEXT NULL,
  `device` VARCHAR(50) NULL,
  `browser` VARCHAR(50) NULL,
  `location` VARCHAR(200) NULL,
  `lastActivity` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_unique` (`token`),
  INDEX `userId_idx` (`userId`),
  CONSTRAINT `session_userId_fkey` 
    FOREIGN KEY (`userId`) 
    REFERENCES `user`(`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Проверка и создание таблицы login_history (если не существует)
CREATE TABLE IF NOT EXISTS `login_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `ipAddress` VARCHAR(45) NOT NULL,
  `userAgent` TEXT NULL,
  `device` VARCHAR(50) NULL,
  `browser` VARCHAR(50) NULL,
  `location` VARCHAR(200) NULL,
  `success` BOOLEAN DEFAULT TRUE,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `userId_idx` (`userId`),
  INDEX `createdAt_idx` (`createdAt`),
  CONSTRAINT `login_history_userId_fkey` 
    FOREIGN KEY (`userId`) 
    REFERENCES `user`(`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Обновление статусов тикетов для существующих записей
UPDATE `ticket` SET `priority` = 'normal' WHERE `priority` IS NULL;
UPDATE `ticket` SET `category` = 'general' WHERE `category` IS NULL;

-- Готово!
SELECT 'Migration completed successfully!' as status;

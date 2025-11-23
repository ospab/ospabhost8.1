-- Миграция для добавления таблицы метрик серверов

CREATE TABLE `server_metrics` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `serverId` INT NOT NULL,
  `cpuUsage` DOUBLE NOT NULL DEFAULT 0,
  `memoryUsage` DOUBLE NOT NULL DEFAULT 0,
  `memoryUsed` BIGINT NOT NULL DEFAULT 0,
  `memoryMax` BIGINT NOT NULL DEFAULT 0,
  `diskUsage` DOUBLE NOT NULL DEFAULT 0,
  `diskUsed` BIGINT NOT NULL DEFAULT 0,
  `diskMax` BIGINT NOT NULL DEFAULT 0,
  `networkIn` BIGINT NOT NULL DEFAULT 0,
  `networkOut` BIGINT NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'unknown',
  `uptime` BIGINT NOT NULL DEFAULT 0,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  INDEX `server_metrics_serverId_timestamp_idx` (`serverId`, `timestamp`),
  
  CONSTRAINT `server_metrics_serverId_fkey` 
    FOREIGN KEY (`serverId`) REFERENCES `server`(`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

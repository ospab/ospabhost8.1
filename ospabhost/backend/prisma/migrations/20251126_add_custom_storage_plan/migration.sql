-- AlterTable
ALTER TABLE `storage_plan` ADD COLUMN `pricePerGb` DECIMAL(10,4) NULL AFTER `price`;
ALTER TABLE `storage_plan` ADD COLUMN `bandwidthPerGb` DECIMAL(10,4) NULL AFTER `pricePerGb`;
ALTER TABLE `storage_plan` ADD COLUMN `requestsPerGb` INT NULL AFTER `bandwidthPerGb`;

-- Add custom storage plan (цена, трафик и операции считаются пропорционально GB)
INSERT INTO `storage_plan` 
  (`code`, `name`, `price`, `pricePerGb`, `bandwidthPerGb`, `requestsPerGb`, `quotaGb`, `bandwidthGb`, `requestLimit`, `order`, `isActive`, `description`, `createdAt`, `updatedAt`)
VALUES 
  ('custom', 'Custom', 0, 0.5, 1.2, 100000, 0, 0, '', 999, true, 'Кастомный тариф - укажите нужное количество GB', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `price` = VALUES(`price`),
  `pricePerGb` = VALUES(`pricePerGb`),
  `bandwidthPerGb` = VALUES(`bandwidthPerGb`),
  `requestsPerGb` = VALUES(`requestsPerGb`),
  `quotaGb` = VALUES(`quotaGb`),
  `bandwidthGb` = VALUES(`bandwidthGb`),
  `requestLimit` = VALUES(`requestLimit`),
  `order` = VALUES(`order`),
  `isActive` = VALUES(`isActive`),
  `description` = VALUES(`description`);

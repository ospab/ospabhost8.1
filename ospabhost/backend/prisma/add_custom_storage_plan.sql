-- Добавить колонку pricePerGb для расчёта кастомного тарифа
ALTER TABLE storage_plan ADD COLUMN pricePerGb DECIMAL(10, 4) NULL AFTER price;

-- Добавить кастомный тариф
INSERT INTO storage_plan
  (code, name, price, pricePerGb, quotaGb, bandwidthGb, requestLimit, `order`, isActive, description)
VALUES
  ('custom', 'Custom', 0, 0.5, 0, 0, 'Неограниченно', 999, TRUE, 'Кастомный тариф - укажите нужное количество GB')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price = VALUES(price),
  pricePerGb = VALUES(pricePerGb),
  quotaGb = VALUES(quotaGb),
  bandwidthGb = VALUES(bandwidthGb),
  requestLimit = VALUES(requestLimit),
  `order` = VALUES(`order`),
  isActive = VALUES(isActive),
  description = VALUES(description);

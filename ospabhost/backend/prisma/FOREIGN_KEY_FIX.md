# Решение проблемы Foreign Key при удалении тарифов

## Проблема
При попытке удалить тариф через Prisma Studio появляется ошибка:
```
Foreign key constraint violated on the fields: (`tariffId`)
```

## Причина
Тариф используется серверами. MySQL не позволяет удалить тариф, если на него ссылаются записи в таблице `server`.

## Решение

### Способ 1: Безопасный (рекомендуется)
Удаляет только неиспользуемые тарифы, сохраняет серверы.

```bash
mysql -u root -p ospabhost < backend/prisma/safe_tariff_migration.sql
```

### Способ 2: Полная очистка (только для dev!)
Удаляет ВСЕ серверы и тарифы.

```bash
# Сначала бэкап!
mysqldump -u root -p ospabhost > backup.sql

# Потом очистка
mysql -u root -p ospabhost < backend/prisma/clean_slate_migration.sql
```

### Способ 3: Ручное удаление через SQL

```sql
-- 1. Найти тарифы без серверов
SELECT t.id, t.name, COUNT(s.id) as servers
FROM tariff t
LEFT JOIN server s ON s.tariffId = t.id
GROUP BY t.id
HAVING servers = 0;

-- 2. Удалить только неиспользуемые
DELETE FROM tariff WHERE id IN (
    SELECT id FROM (
        SELECT t.id FROM tariff t
        LEFT JOIN server s ON s.tariffId = t.id
        GROUP BY t.id
        HAVING COUNT(s.id) = 0
    ) as unused
);

-- 3. Добавить категорию
ALTER TABLE tariff ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'vps';

-- 4. Добавить новые тарифы (см. safe_tariff_migration.sql)
```

## Перезапуск backend

```bash
cd backend
npm start
```

Готово! 🎉

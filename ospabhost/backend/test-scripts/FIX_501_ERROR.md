# Решение проблемы 501 "Method not implemented"

## Проблема

При смене root-пароля через Proxmox API получали ошибку:
```
AxiosError: Request failed with status code 501
statusMessage: "Method 'POST /nodes/sv1/lxc/105/config' not implemented"
```

## Причина

Proxmox API **не поддерживает POST** для изменения конфигурации контейнера.
Правильный метод - **PUT**.

## Решение

### Было (неправильно):
```typescript
const response = await axios.post(
  `${PROXMOX_API_URL}/nodes/${PROXMOX_NODE}/lxc/${vmid}/config`,
  `password=${encodeURIComponent(newPassword)}`,
  ...
);
```

### Стало (правильно):
```typescript
const response = await axios.put(
  `${PROXMOX_API_URL}/nodes/${PROXMOX_NODE}/lxc/${vmid}/config`,
  `password=${encodeURIComponent(newPassword)}`,
  ...
);
```

## Правильные HTTP методы для Proxmox API

### LXC Container Config (`/nodes/{node}/lxc/{vmid}/config`)
- `GET` - получить конфигурацию
- `PUT` - **изменить конфигурацию** (в т.ч. пароль)
- ❌ `POST` - не поддерживается

### LXC Container Status (`/nodes/{node}/lxc/{vmid}/status/{action}`)
- `POST` - start/stop/restart/shutdown

### LXC Container Create (`/nodes/{node}/lxc`)
- `POST` - создать новый контейнер

## Документация Proxmox VE API

Официальная документация: https://pve.proxmox.com/pve-docs/api-viewer/

Основные правила:
1. **GET** - чтение данных
2. **POST** - создание ресурсов, выполнение действий (start/stop)
3. **PUT** - изменение существующих ресурсов
4. **DELETE** - удаление ресурсов

## Тестирование

### Через curl:
```bash
# Получить конфигурацию (GET)
curl -k -X GET \
  -H "Authorization: PVEAPIToken=user@pam!token=secret" \
  https://proxmox:8006/api2/json/nodes/nodename/lxc/100/config

# Изменить пароль (PUT)
curl -k -X PUT \
  -H "Authorization: PVEAPIToken=user@pam!token=secret" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "password=NewPassword123" \
  https://proxmox:8006/api2/json/nodes/nodename/lxc/100/config
```

### Через веб-интерфейс:
1. Откройте панель управления сервером
2. Вкладка "Настройки"
3. Нажмите "Сменить root-пароль"
4. Проверьте логи: `pm2 logs ospab-backend`

## Проверка прав API токена

Убедитесь, что API токен имеет права:
```bash
# В Proxmox WebUI
# Datacenter → Permissions → API Tokens
# Проверьте права токена:
# - VM.Config.* (для изменения конфигурации)
# - VM.PowerMgmt (для start/stop)
```

Или через командную строку:
```bash
pveum user token permissions api-user@pve sv1-api-user
```

## Fallback через SSH

Если API не работает, система автоматически использует SSH:
```bash
ssh root@proxmox "pct set {vmid} --password 'новый_пароль'"
```

Для этого нужно:
1. Настроить SSH ключи:
```bash
ssh-keygen -t rsa -b 4096
ssh-copy-id root@proxmox_ip
```

2. Проверить доступ:
```bash
ssh root@proxmox_ip "pct list"
```

## Деплой исправления

```bash
# На сервере
cd /var/www/ospab-host/backend
git pull
npm run build
pm2 restart ospab-backend

# Проверка логов
pm2 logs ospab-backend --lines 50
```

## Ожидаемые логи при успехе

```
✅ Пароль успешно изменён для контейнера 105
✅ Пароль успешно обновлён для сервера #17 (VMID: 105)
```

## Ожидаемые логи при ошибке

```
❌ Ошибка смены пароля через API: ...
⚠️ Пробуем через SSH...
✅ Пароль изменён через SSH для контейнера 105
```

## Дополнительные ресурсы

- [Proxmox VE API Documentation](https://pve.proxmox.com/pve-docs/api-viewer/)
- [Proxmox VE Administration Guide](https://pve.proxmox.com/pve-docs/pve-admin-guide.html)
- [pct command reference](https://pve.proxmox.com/pve-docs/pct.1.html)

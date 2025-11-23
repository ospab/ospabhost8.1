# Простые команды для создания нагрузки на сервер
# Выполняйте их в консоли вашего LXC контейнера через noVNC или SSH

## 1. БЫСТРЫЙ ТЕСТ (без установки дополнительных пакетов)

### CPU нагрузка (запустить в фоне)
# Создаёт 100% нагрузку на все ядра на 2 минуты
yes > /dev/null &
yes > /dev/null &
yes > /dev/null &
yes > /dev/null &

# Остановить через 2 минуты:
# killall yes


### Memory нагрузка
# Заполнить 500MB оперативки
cat <( </dev/zero head -c 500m) <(sleep 120) | tail &

# Для 1GB используйте:
# cat <( </dev/zero head -c 1000m) <(sleep 120) | tail &


### Disk I/O нагрузка
# Создать файл 1GB и записать его несколько раз
dd if=/dev/zero of=/tmp/testfile bs=1M count=1000 oflag=direct &

# Удалить после теста:
# rm /tmp/testfile


### Network нагрузка
# Скачать большой файл
wget -O /dev/null http://speedtest.tele2.net/100MB.zip &

# Или создать сетевой трафик:
# ping -f 8.8.8.8 -c 10000 &



## 2. С УСТАНОВКОЙ STRESS-NG (рекомендуется)

# Установить stress-ng (один раз)
apt-get update && apt-get install -y stress-ng

### Комплексный тест (5 минут)
# CPU 50%, Memory 50%, Disk I/O
stress-ng --cpu 2 --cpu-load 50 --vm 1 --vm-bytes 512M --hdd 1 --timeout 300s

### Только CPU (80% нагрузка, 3 минуты)
stress-ng --cpu 4 --cpu-load 80 --timeout 180s

### Только Memory (заполнить 70%, 3 минуты)
stress-ng --vm 2 --vm-bytes 70% --timeout 180s

### Только Disk I/O (3 минуты)
stress-ng --hdd 4 --timeout 180s



## 3. PYTHON СКРИПТ (если Python установлен)

# Создать файл test_load.py:
cat > /tmp/test_load.py << 'EOF'
import time
import threading

def cpu_load():
    """CPU нагрузка"""
    end_time = time.time() + 180  # 3 минуты
    while time.time() < end_time:
        [x**2 for x in range(10000)]

def memory_load():
    """Memory нагрузка"""
    data = []
    for i in range(100):
        data.append(' ' * 10000000)  # ~10MB каждый
        time.sleep(1)

# Запустить в потоках
threads = []
for i in range(4):  # 4 потока для CPU
    t = threading.Thread(target=cpu_load)
    t.start()
    threads.append(t)

# Memory нагрузка
m = threading.Thread(target=memory_load)
m.start()
threads.append(m)

# Ждать завершения
for t in threads:
    t.join()

print("Test completed!")
EOF

# Запустить:
python3 /tmp/test_load.py &



## 4. МОНИТОРИНГ НАГРУЗКИ

# Установить htop для визуального мониторинга
apt-get install -y htop

# Запустить htop
htop

# Или использовать стандартные команды:
top           # CPU и Memory
iostat -x 1   # Disk I/O (нужно установить: apt install sysstat)
free -h       # Memory
uptime        # Load average



## 5. ОСТАНОВИТЬ ВСЕ ТЕСТЫ

# Остановить все процессы нагрузки
killall stress-ng yes dd wget python3

# Очистить временные файлы
rm -f /tmp/testfile /tmp/test_load.py



## КАК ПРОВЕРИТЬ РЕЗУЛЬТАТЫ

1. Откройте панель управления сервером в браузере
2. Перейдите на вкладку "Мониторинг"
3. Выберите период "1h" или "6h"
4. Вы увидите графики:
   - CPU usage (оранжевый график)
   - Memory usage (синий график)
   - Disk usage (зеленый график)
   - Network In/Out (фиолетовый график)

5. Обновите страницу через 1-2 минуты после запуска теста
6. Используйте кнопки периодов (1h, 6h, 24h) для изменения масштаба

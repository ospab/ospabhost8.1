#!/bin/bash
# Скрипт для создания тестовой нагрузки на сервер
# Используйте этот скрипт внутри LXC контейнера

echo "🔥 Начинаем тест нагрузки сервера..."

# Установка stress-ng если не установлен
if ! command -v stress-ng &> /dev/null; then
    echo "Установка stress-ng..."
    apt-get update && apt-get install -y stress-ng
fi

# Проверяем количество ядер
CORES=$(nproc)
echo "Доступно CPU ядер: $CORES"

# Функция для CPU нагрузки (30% нагрузка)
cpu_stress() {
    echo "📊 CPU нагрузка: 30-50%..."
    stress-ng --cpu $CORES --cpu-load 35 --timeout 300s &
}

# Функция для Memory нагрузки (50% памяти)
memory_stress() {
    echo "💾 Memory нагрузка: 50%..."
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    TARGET_MEM=$(($TOTAL_MEM / 2))
    stress-ng --vm 2 --vm-bytes ${TARGET_MEM}M --timeout 300s &
}

# Функция для Disk I/O нагрузки
disk_stress() {
    echo "💿 Disk I/O нагрузка..."
    stress-ng --hdd 2 --hdd-bytes 50M --timeout 300s &
}

# Функция для Network нагрузки (ping flood)
network_stress() {
    echo "🌐 Network нагрузка..."
    # Генерируем сетевой трафик
    dd if=/dev/zero bs=1M count=100 2>/dev/null | dd of=/dev/null 2>/dev/null &
}

# Выбор режима
case "${1:-all}" in
    cpu)
        cpu_stress
        ;;
    memory)
        memory_stress
        ;;
    disk)
        disk_stress
        ;;
    network)
        network_stress
        ;;
    all)
        echo "🚀 Запуск полной нагрузки на 5 минут..."
        cpu_stress
        sleep 2
        memory_stress
        sleep 2
        disk_stress
        ;;
    *)
        echo "Использование: $0 [cpu|memory|disk|network|all]"
        exit 1
        ;;
esac

echo ""
echo "✅ Нагрузка запущена! Тест будет длиться 5 минут."
echo "📈 Откройте панель мониторинга чтобы увидеть графики."
echo ""
echo "Для остановки теста используйте: killall stress-ng"

# Ждём завершения
wait
echo ""
echo "✅ Тест завершён!"

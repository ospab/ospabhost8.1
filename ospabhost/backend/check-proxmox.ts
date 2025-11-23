import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const PROXMOX_API_URL = process.env.PROXMOX_API_URL;
const PROXMOX_TOKEN_ID = process.env.PROXMOX_TOKEN_ID;
const PROXMOX_TOKEN_SECRET = process.env.PROXMOX_TOKEN_SECRET;
const PROXMOX_NODE = process.env.PROXMOX_NODE || 'sv1';

function getProxmoxHeaders(): Record<string, string> {
  return {
    'Authorization': `PVEAPIToken=${PROXMOX_TOKEN_ID}=${PROXMOX_TOKEN_SECRET}`,
    'Content-Type': 'application/json'
  };
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true
});

async function checkProxmox() {
  try {
    console.log('📋 Проверка соединения с Proxmox...\n');
    console.log('URL:', PROXMOX_API_URL);
    console.log('NODE:', PROXMOX_NODE);
    console.log('TOKEN_ID:', PROXMOX_TOKEN_ID);
    console.log('---');

    // 1. Проверка версии
    console.log('\n[1] Проверка версии Proxmox...');
    const versionRes = await axios.get(`${PROXMOX_API_URL}/version`, {
      headers: getProxmoxHeaders(),
      timeout: 10000,
      httpsAgent
    });
    console.log('[OK] Версия:', versionRes.data?.data?.version);

    // 2. Проверка storage
    console.log('\n[2] Получение списка storage на узле ' + PROXMOX_NODE + '...');
    const storageRes = await axios.get(
      `${PROXMOX_API_URL}/nodes/${PROXMOX_NODE}/storage`,
      {
        headers: getProxmoxHeaders(),
        timeout: 10000,
        httpsAgent
      }
    );
    
    if (storageRes.data?.data) {
      console.log('[OK] Доступные storage:');
      storageRes.data.data.forEach((storage: any) => {
        console.log(`   - ${storage.storage} (type: ${storage.type}, enabled: ${storage.enabled ? 'да' : 'нет'})`);
      });
    }

    // 3. Проверка контейнеров
    console.log('\n[3] Получение списка контейнеров...');
    const containersRes = await axios.get(
      `${PROXMOX_API_URL}/nodes/${PROXMOX_NODE}/lxc`,
      {
        headers: getProxmoxHeaders(),
        timeout: 10000,
        httpsAgent
      }
    );

    if (containersRes.data?.data) {
      console.log(`[OK] Найдено контейнеров: ${containersRes.data.data.length}`);
      containersRes.data.data.slice(0, 3).forEach((ct: any) => {
        console.log(`   - VMID ${ct.vmid}: ${ct.name} (${ct.status})`);
      });
    }

    // 4. Проверка VMID
    console.log('\n[4] Получение следующего VMID...');
    const vmidRes = await axios.get(`${PROXMOX_API_URL}/cluster/nextid`, {
      headers: getProxmoxHeaders(),
      timeout: 10000,
      httpsAgent
    });
    console.log('[OK] Следующий VMID:', vmidRes.data?.data);

    console.log('\n[SUCCESS] Все проверки пройдены успешно!');
  } catch (error: any) {
    console.error('\n[ERROR] Ошибка:', error.message);
    console.error('Code:', error.code);
    console.error('Status:', error.response?.status);
    if (error.response?.data?.errors) {
      console.error('Детали:', error.response.data.errors);
    }
    console.log('\n💡 РЕКОМЕНДАЦИЯ:');
    console.log('1. Проверьте права API токена на узле');
    console.log('2. Запустите на Proxmox сервере: pvesm status (чтобы узнать реальные storage)');
    console.log('3. Проверьте соединение SSH: ssh -o StrictHostKeyChecking=no root@sv1.ospab.host');
    process.exit(1);
  }
}

checkProxmox();

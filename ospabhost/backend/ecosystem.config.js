module.exports = {
  apps: [
    {
      name: 'ospab-backend',
      script: './dist/index.js',
      instances: 4, // 4 экземпляра для балансировки нагрузки
      exec_mode: 'cluster', // Кластерный режим
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 5000, // Время на graceful shutdown
      wait_ready: false, // Не ждать сигнал готовности
      listen_timeout: 10000, // Таймаут ожидания ready
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
      // Политика перезапуска при крашах
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // Мониторинг
      pmx: true,
      automation: false
    }
  ],
  deploy: {
    production: {
      user: 'root',
      host: 'ospab.host',
      ref: 'origin/main',
      repo: 'git@github.com:Ospab/ospabhost8.1.git',
      path: '/var/www/ospab-host',
      'post-deploy': 'cd backend && npm install && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save'
    }
  }
};

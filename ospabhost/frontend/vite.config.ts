import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-service-worker',
      writeBundle() {
        // Копируем service worker в dist при сборке
        try {
          copyFileSync(
            resolve(__dirname, 'public/service-worker.js'),
            resolve(__dirname, 'dist/service-worker.js')
          )
          console.log('✅ Service worker скопирован в dist/')
        } catch (error) {
          console.error('❌ Ошибка копирования service worker:', error)
        }
      }
    }
  ],
  build: {
    target: 'es2015', // Современные браузеры, уменьшаем полифилы
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Разделяем большие зависимости
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['react-qr-code'],
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Убираем console.log в production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'] // Удаляем конкретные функции
      }
    },
    chunkSizeWarningLimit: 600 // Увеличим лимит предупреждения
  },
  server: {
    // Для dev сервера public файлы доступны из корня автоматически
    port: 3000
  }
})

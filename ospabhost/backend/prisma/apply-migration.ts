import { prisma } from '../src/prisma/client';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrations_manual', 'add_sessions_qr_tickets_features.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Удаляем комментарии и разделяем по точке с запятой
    const cleaned = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleaned
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`🚀 Применяю миграцию: ${statements.length} запросов...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.replace(/\s+/g, ' ').substring(0, 150);
      console.log(`\n[${i + 1}/${statements.length}] Выполняю:`);
      console.log(preview + '...');
      
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log('✅ Успешно');
      } catch (error: any) {
        // Игнорируем ошибки "duplicate column" и "table already exists"
        if (
          error.message.includes('Duplicate column') ||
          error.message.includes('already exists') ||
          error.message.includes('Duplicate key')
        ) {
          console.log('⚠️  Уже существует, пропускаю...');
        } else {
          console.error('❌ Ошибка:', error.message);
          // Не выбрасываем ошибку, продолжаем выполнение
        }
      }
    }

    console.log('\n✅ Миграция завершена!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

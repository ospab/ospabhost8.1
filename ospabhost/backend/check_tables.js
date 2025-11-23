const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTables() {
  try {
    console.log('Проверка таблиц блога...\n');
    
    // Проверка таблицы Post
    try {
      const postCount = await prisma.post.count();
      console.log('[OK] Таблица Post существует. Записей:', postCount);
    } catch (error) {
      console.log('[ERROR] Таблица Post НЕ существует:', error.message);
    }
    
    // Проверка таблицы Comment
    try {
      const commentCount = await prisma.comment.count();
      console.log('[OK] Таблица Comment существует. Записей:', commentCount);
    } catch (error) {
      console.log('[ERROR] Таблица Comment НЕ существует:', error.message);
    }
    
  } catch (error) {
    console.error('Общая ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();

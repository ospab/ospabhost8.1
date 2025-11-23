#!/usr/bin/env node

/**
 * Генератор SSO секретного ключа
 * 
 * Использование:
 *   node generate-sso-secret.js
 */

const crypto = require('crypto');

// Генерируем 64 символьный hex ключ (32 байта)
const ssoSecret = crypto.randomBytes(32).toString('hex');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SSO SECRET KEY');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('Ваш новый SSO_SECRET_KEY:\n');
console.log(`  ${ssoSecret}\n`);
console.log('─────────────────────────────────────────────────────────────── ');
console.log('\n📋 Как использовать:\n');
console.log('1. Скопируйте ключ выше');
console.log('2. Добавьте в ospabhost8.1/backend/.env:');
console.log(`   SSO_SECRET_KEY=${ssoSecret}`);
console.log('\n3. Добавьте ЭТОТ ЖЕ ключ в панель управления (ospab-panel/.env):');
console.log(`   SSO_SECRET_KEY=${ssoSecret}`);
console.log('\nВАЖНО: Ключ должен быть ОДИНАКОВЫМ на обоих сайтах!');
console.log('═══════════════════════════════════════════════════════════════\n');

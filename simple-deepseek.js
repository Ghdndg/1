const fs = require('fs');

console.log('🚀 Простой способ настройки DeepSeek API\n');

// Если у вас есть API ключ - введите его здесь:
const YOUR_API_KEY = 'sk-e896a2ba58474e999585b25585f426f2'; // Замените на реальный ключ

if (YOUR_API_KEY === 'ВСТАВЬТЕ_СЮДА_ВАШ_КЛЮЧ') {
    console.log('❌ Нужен реальный API ключ DeepSeek\n');
    console.log('📋 Быстрая инструкция:');
    console.log('1. Откройте: https://platform.deepseek.com');
    console.log('2. Зарегистрируйтесь (2 минуты)');
    console.log('3. Создайте API ключ в разделе "API Keys"');
    console.log('4. Скопируйте ключ (начинается с sk-)');
    console.log('5. Замените в этом файле YOUR_API_KEY на ваш ключ');
    console.log('6. Запустите: node simple-deepseek.js');
    console.log('\n💡 Получите 10$ бесплатных кредитов сразу!');
} else {
    // Обновляем .env файл
    const envContent = `# DeepSeek API (настроен)
DEEPSEEK_API_KEY=${YOUR_API_KEY}
DEEPSEEK_BASE_URL=https://api.deepseek.com
MODEL_NAME=deepseek-chat

PORT=3000
NODE_ENV=development
`;
    
    fs.writeFileSync('.env', envContent);
    
    console.log('✅ API ключ DeepSeek настроен!');
    console.log('🔄 Теперь перезапустите сервер:');
    console.log('   1. Нажмите Ctrl+C в терминале с сервером');
    console.log('   2. Запустите: npm start');
    console.log('   3. Протестируйте: http://localhost:3000/test.html');
    console.log('\n🤖 После перезапуска ответы будут через DeepSeek AI!');
} 
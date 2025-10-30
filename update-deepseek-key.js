const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔑 Обновление API ключа DeepSeek\n');

rl.question('Введите ваш новый API ключ DeepSeek (sk-...): ', (apiKey) => {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    console.log('❌ Ошибка: API ключ должен начинаться с "sk-"');
    rl.close();
    return;
  }

  const envContent = `# DeepSeek API (настроен)
DEEPSEEK_API_KEY=${apiKey}
DEEPSEEK_BASE_URL=https://api.deepseek.com
MODEL_NAME=deepseek-chat

PORT=3000
NODE_ENV=development
`;

  fs.writeFileSync('.env', envContent);
  
  console.log('\n✅ API ключ обновлен!');
  console.log('🔄 Перезапустите сервер: npm start');
  console.log('🧪 Затем протестируйте: http://localhost:3000/test.html');
  
  rl.close();
}); 
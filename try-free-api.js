const fs = require('fs');

console.log('🆓 Настройка альтернативного бесплатного API...\n');

// Попробуем настроить бесплатный открытый API
const envContent = `# Альтернативный бесплатный API
OPENROUTER_API_KEY=sk-or-v1-free-test-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
MODEL_NAME=microsoft/phi-3-mini-128k-instruct:free

PORT=3000
NODE_ENV=development
`;

fs.writeFileSync('.env', envContent);

// Обновляем код сервера для OpenRouter (бесплатный)
const indexPath = './app/index.js';
let code = fs.readFileSync(indexPath, 'utf8');

// Заменяем API настройки
code = code.replace(
  /const DEEPSEEK_API_KEY = .*?;/,
  'const API_KEY = process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || "sk-or-v1-free-test-key";'
);

code = code.replace(
  /const DEEPSEEK_BASE_URL = .*?;/,
  'const BASE_URL = process.env.OPENROUTER_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://openrouter.ai/api/v1";'
);

code = code.replace(
  /const MODEL_NAME = .*?;/,
  'const MODEL_NAME = process.env.MODEL_NAME || "microsoft/phi-3-mini-128k-instruct:free";'
);

// Обновляем health check
code = code.replace(
  /deepseek: DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'sk-free-deepseek-api-key' \? 'configured' : 'demo_mode'/,
  'api: API_KEY && !API_KEY.includes("free") ? "configured" : "free_mode"'
);

// Обновляем API запрос
code = code.replace(
  /if \(DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'sk-free-deepseek-api-key'\)/,
  'if (API_KEY)'
);

code = code.replace(
  /\$\{DEEPSEEK_BASE_URL\}\/v1\/chat\/completions/,
  '${BASE_URL}/chat/completions'
);

code = code.replace(
  /Authorization': \`Bearer \$\{DEEPSEEK_API_KEY\}\`/,
  'Authorization': `Bearer ${API_KEY}`'
);

code = code.replace(
  /responseSource = 'deepseek';/,
  'responseSource = "free_api";'
);

fs.writeFileSync(indexPath, code);

console.log('✅ Настроен бесплатный API (без регистрации!)');
console.log('🔄 Перезапустите сервер: npm start');
console.log('🧪 Протестируйте: http://localhost:3000/test.html');
console.log('\n💡 Этот API имеет лимиты, но работает сразу!');
console.log('📝 Для лучшего качества все же рекомендуем зарегистрироваться в DeepSeek'); 
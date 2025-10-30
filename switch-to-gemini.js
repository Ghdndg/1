const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔄 Переключение на Google Gemini API...');

// Обновляем .env файл
const envContent = 'GEMINI_API_KEY=AIzaSyAJ2DSx4ozRJaJe2njQuhCr__02MTGpQfw';
fs.writeFileSync('.env', envContent);

console.log('✅ .env файл обновлен для Google Gemini');

// Обновляем код сервера для Gemini
const indexPath = './app/index.js';
let code = fs.readFileSync(indexPath, 'utf8');

// Заменяем импорты
code = code.replace('const OpenAI = require(\'openai\');', 'const axios = require(\'axios\');');

// Заменяем API конфигурацию
code = code.replace(
  /const OPENAI_API_KEY = .*?;\s*\n\s*\/\/ Инициализация OpenAI клиента\s*\n\s*const openai = new OpenAI\({[\s\S]*?}\);/,
  `const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAJ2DSx4ozRJaJe2njQuhCr__02MTGpQfw';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';`
);

// Заменяем проверку API ключа
code = code.replace(
  /if \(!OPENAI_API_KEY.*?}\s*}/s,
  `if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyAJ2DSx4ozRJaJe2njQuhCr__02MTGpQfw') {
  console.warn('⚠️  ВНИМАНИЕ: API ключ Google Gemini не настроен!');
  console.warn('📋 Инструкция:');
  console.warn('1. Перейдите на https://ai.google.dev/');
  console.warn('2. Нажмите "Get API key"');
  console.warn('3. Создайте новый API ключ');
  console.warn('4. Добавьте его в файл .env как GEMINI_API_KEY=ваш_ключ');
  console.warn('5. Перезапустите сервер');
}`
);

// Заменяем health check
code = code.replace(
  'openai: OPENAI_API_KEY && OPENAI_API_KEY !== \'ВАШ_OPENAI_API_КЛЮЧ_СЮДА\' ? \'configured\' : \'not_configured\'',
  'gemini: GEMINI_API_KEY ? \'configured\' : \'not_configured\''
);

// Заменяем основную логику API
const geminiApiLogic = `    // Попытка использовать Gemini API
    try {
      const systemPrompt = createSystemPrompt();
      const dialogHistory = sessionData.messages
        .slice(-10) // Берем последние 10 сообщений для контекста
        .map(msg => \`\${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: \${msg.content}\`)
        .join('\\n');
      
      const fullPrompt = \`\${systemPrompt}\\n\\nИстория диалога:\\n\${dialogHistory}\\n\\nАссистент:\`;
      
      logToFile('debug', 'Отправляем запрос к Gemini API');
      
      const response = await axios.post(
        \`\${GEMINI_API_URL}?key=\${GEMINI_API_KEY}\`,
        {
          contents: [{
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            topP: 0.9,
            topK: 40,
            stopSequences: ['Пользователь:', 'User:']
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        },
        {
          timeout: 10000, // 10 секунд таймаут
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        assistantMessage = response.data.candidates[0].content.parts[0].text.trim();
        responseSource = 'gemini';
        logToFile('info', 'Успешный ответ от Gemini API', {
          responseLength: assistantMessage.length
        });
      } else {
        throw new Error('Некорректный формат ответа от Gemini API');
      }
      
    } catch (apiError) {
      const errorDetails = {
        message: apiError.message,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        data: apiError.response?.data,
        apiKey: GEMINI_API_KEY ? 'присутствует' : 'отсутствует'
      };
      
      logToFile('error', 'Детальная ошибка Gemini API', errorDetails);
      
      // Если ошибка 403 или 401 - проблема с API ключом
      if (apiError.response?.status === 403 || apiError.response?.status === 401) {
        assistantMessage = \`🔑 **Ошибка API ключа Google Gemini**

Похоже, что API ключ неактивен или неверный. 

**Что нужно сделать:**
1. Перейдите на https://ai.google.dev/
2. Войдите в Google AI Studio  
3. Нажмите "Get API Key" → "Create API Key"
4. Скопируйте новый ключ
5. Обновите файл .env: GEMINI_API_KEY=ваш_новый_ключ
6. Перезапустите сервер

**По вашему вопросу о VITAHUB:** Сейчас работаю в упрощенном режиме. После настройки API смогу давать более детальные ответы о наших продуктах.\`;
        responseSource = 'api_error';
      }
      // Если ошибка 503 - сервис временно недоступен
      else if (apiError.response?.status === 503) {
        assistantMessage = \`⏳ **Google Gemini временно недоступен**

Сервис перегружен. Попробуйте через несколько минут.

**Кратко о вашем вопросе:** \${userMessage}

Могу рассказать о продуктах VITAHUB в упрощенном режиме. О чем именно хотите узнать?\`;
        responseSource = 'service_unavailable';
      }
      // Другие ошибки
      else {
        logToFile('warning', 'Ошибка Gemini API, используем локальную обработку', errorDetails);
        assistantMessage = \`🤖 **Работаю в базовом режиме**

Временные проблемы с ИИ-сервисом. Отвечу на основе базовых данных о VITAHUB.

**Ваш вопрос:** \${userMessage}

\${processMessage(userMessage.toLowerCase(), sessionData)}\`;
        responseSource = 'local';
      }
    }`;

// Заменяем OpenAI логику на Gemini
code = code.replace(/\/\/ Попытка использовать OpenAI API[\s\S]*?responseSource = 'local';\s*}\s*}/m, geminiApiLogic);

// Сохраняем обновленный код
fs.writeFileSync(indexPath, code);

console.log('✅ Код сервера обновлен для Google Gemini');
console.log('🚀 Перезапустите сервер: npm start');
console.log('');
console.log('📊 Статус:');
console.log('- API: Google Gemini (бесплатный)');
console.log('- Лимиты: 15 запросов/минуту, 1M токенов/день');
console.log('- Сейчас: готов к работе!'); 
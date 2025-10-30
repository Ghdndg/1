const fs = require('fs');

console.log('🚀 Настройка DeepSeek API (бесплатно)...');

// Создаем .env файл с DeepSeek API
const envContent = `# DeepSeek API (бесплатно)
DEEPSEEK_API_KEY=sk-free-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
MODEL_NAME=deepseek-chat

# Альтернативно можно использовать Gemini
# GEMINI_API_KEY=your_gemini_key

PORT=3000
NODE_ENV=development
`;

fs.writeFileSync('.env', envContent);
console.log('✅ .env файл создан');

// Обновляем код сервера для DeepSeek
const indexPath = './app/index.js';
let code = fs.readFileSync(indexPath, 'utf8');

// Заменяем импорты и настройки
const newCode = `require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { companyInfo } = require('./data/company_info');
const { vitahubData } = require('./data/vitahub_data');
const { marketingData } = require('./data/marketing_data');

const app = express();
const port = process.env.PORT || 3000;

// Хранилище диалогов
const sessionStore = new Map();

// Логирование
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function logToFile(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  const logFile = path.join(logDir, \`chatbot-\${new Date().toISOString().split('T')[0]}.log\`);
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\\n');
  
  console.log(\`[\${timestamp}] \${level.toUpperCase()}: \${message}\`, data || '');
}

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logToFile('info', \`\${req.method} \${req.path}\`, {
      status: res.statusCode,
      duration: \`\${duration}ms\`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  next();
});

// Статические файлы
app.use(express.static(path.join(__dirname, '..', 'public')));

// API конфигурация для DeepSeek
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-free-deepseek-api-key';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const MODEL_NAME = process.env.MODEL_NAME || 'deepseek-chat';

// Проверка здоровья сервера
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '3.0.0',
    services: {
      deepseek: DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'sk-free-deepseek-api-key' ? 'configured' : 'demo_mode',
      model: MODEL_NAME,
      sessions: sessionStore.size
    }
  });
});

// Получение статистики
app.get('/api/stats', (req, res) => {
  const stats = {
    totalSessions: sessionStore.size,
    activeSessions: Array.from(sessionStore.values()).filter(s => 
      Date.now() - (s.lastActivity || 0) < 30 * 60 * 1000
    ).length,
    totalMessages: Array.from(sessionStore.values()).reduce((sum, s) => 
      sum + (s.messages?.length || 0), 0
    )
  };
  
  res.json(stats);
});

// Основной API чата
app.get('/api/chat', (req, res) => {
  res.json({
    status: 'ok',
    message: 'VITAHUB Chatbot API v3.0 работает с DeepSeek',
    endpoints: {
      chat: 'POST /api/chat',
      health: 'GET /api/health',
      stats: 'GET /api/stats',
      suggestions: 'GET /api/suggestions'
    }
  });
});

// Получение предложений вопросов
app.get('/api/suggestions', (req, res) => {
  const suggestions = [
    "Что такое VITAHUB Energy?",
    "Какой состав у напитка?",
    "Как правильно употреблять?",
    "Есть ли противопоказания?",
    "Чем отличается от обычных энергетиков?",
    "Подходит ли для диеты?",
    "Где купить VITAHUB?",
    "Какие преимущества для здоровья?"
  ];
  
  res.json({ suggestions });
});

// Функция создания системного промпта
function createSystemPrompt() {
  return \`Ты виртуальный ассистент VITAHUB - эксперт по функциональным напиткам.

ВАЖНЫЕ ПРАВИЛА:
- Отвечай дружелюбно и профессионально
- Сосредоточься на продуктах VITAHUB
- Давай точную информацию о составе и пользе
- Если не знаешь точный ответ, честно скажи об этом

ПРОДУКТЫ VITAHUB:

1. **VITAHUB Energy** 🔥
   - Натуральный энергетический напиток
   - Состав: Кофеин, L-карнитин, Таурин, Витамины группы B
   - Без сахара, на стевии
   - Дает энергию на 4-6 часов без срыва

2. **VITAHUB Detox** 🌿  
   - Детоксифицирующий напиток
   - Состав: Экстракт зеленого чая, Имбирь, Куркума
   - Поддерживает печень и метаболизм
   - Антиоксиданты для очищения

3. **VITAHUB Antistress** 😌
   - Антистрессовый напиток  
   - Состав: Магний, L-теанин, Экстракт пассифлоры
   - Снижает тревожность, улучшает сон
   - Поддерживает нервную систему

Отвечай на русском языке, используй эмодзи для дружелюбности.\`;
}

// Обработка сообщений в демо-режиме
function processLocalMessage(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('energy') || lowerMessage.includes('энерг')) {
    return \`🔥 **VITAHUB Energy** - натуральный энергетический напиток!

✨ **Состав:**
• Натуральный кофеин 80мг
• L-карнитин для жиросжигания  
• Таурин для фокуса
• Витамины B3, B6, B12

⚡ **Преимущества:**
• Чистая энергия без срыва
• Без сахара (на стевии)
• Улучшает концентрацию
• Поддерживает метаболизм

🕐 Действует 4-6 часов, идеально перед тренировкой или работой!\`;
  }
  
  if (lowerMessage.includes('detox') || lowerMessage.includes('детокс')) {
    return \`🌿 **VITAHUB Detox** - натуральное очищение организма!

🍃 **Состав:**
• Экстракт зеленого чая
• Имбирь для пищеварения
• Куркума (противовоспалительная)
• Антиоксидантный комплекс

💚 **Польза:**
• Поддерживает печень
• Ускоряет метаболизм  
• Выводит токсины
• Улучшает пищеварение

Рекомендуется курсом 2-4 недели для максимального эффекта!\`;
  }
  
  if (lowerMessage.includes('antistress') || lowerMessage.includes('антистресс') || lowerMessage.includes('стресс')) {
    return \`😌 **VITAHUB Antistress** - естественное успокоение!

🧘 **Состав:**
• Магний (300мг) для нервной системы
• L-теанин для релаксации
• Экстракт пассифлоры
• Комплекс аминокислот

✨ **Эффект:**
• Снижает тревожность
• Улучшает качество сна
• Повышает стрессоустойчивость  
• Нормализует настроение

Принимать вечером за 1-2 часа до сна!\`;
  }
  
  if (lowerMessage.includes('состав') || lowerMessage.includes('ингредиент')) {
    return \`📋 **Все продукты VITAHUB имеют натуральный состав:**

🔥 **Energy:** Кофеин, L-карнитин, Таурин, B-витамины
🌿 **Detox:** Зеленый чай, Имбирь, Куркума  
😌 **Antistress:** Магний, L-теанин, Пассифлора

✅ **Без вредных добавок:**
• Без искусственных красителей
• Без консервантов  
• Без ГМО
• Веганский состав\`;
  }
  
  if (lowerMessage.includes('где купить') || lowerMessage.includes('заказать') || lowerMessage.includes('цена')) {
    return \`🛒 **Где купить VITAHUB:**

🌐 **Официальный сайт:** vitahub.ru
📱 **Интернет-магазины:** Wildberries, Ozon
🏪 **Розница:** Спортмастер, Дикси (в крупных городах)

💰 **Цены:**
• Energy: ~300-400₽
• Detox: ~350-450₽  
• Antistress: ~400-500₽

🚚 Доставка по всей России, часто есть акции и скидки!\`;
  }
  
  // Базовый ответ
  return \`👋 Привет! Я ассистент VITAHUB, расскажу всё о наших функциональных напитках:

🔥 **Energy** - для энергии и фокуса
🌿 **Detox** - для очищения организма  
😌 **Antistress** - для снятия стресса

О чём хотите узнать подробнее? Состав, польза, где купить?\`;
}

// Основной обработчик чата
app.post('/api/chat', async (req, res) => {
  try {
    const { message: userMessage, sessionId: providedSessionId, metadata = {} } = req.body;
    
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Поле message обязательно и должно содержать текст',
        code: 'INVALID_MESSAGE'
      });
    }

    const sessionId = providedSessionId || \`session_\${Date.now()}_\${Math.random().toString(36).substring(2, 15)}\`;
    
    logToFile('info', 'Получен запрос', {
      sessionId,
      messageLength: userMessage.length,
      metadata
    });
    
    // Получаем или создаем сессию
    if (!sessionStore.has(sessionId)) {
      sessionStore.set(sessionId, {
        id: sessionId,
        messages: [],
        lastActivity: Date.now(),
        questionCount: 0
      });
    }
    
    const sessionData = sessionStore.get(sessionId);
    sessionData.lastActivity = Date.now();
    sessionData.questionCount++;
    
    let assistantMessage = '';
    let responseSource = 'local';
    
    // Если настроен API ключ DeepSeek - используем его
    if (DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'sk-free-deepseek-api-key') {
      try {
        const systemPrompt = createSystemPrompt();
        const messages = [
          { role: "system", content: systemPrompt },
          ...sessionData.messages.slice(-10),
          { role: "user", content: userMessage }
        ];
        
        const response = await axios.post(\`\${DEEPSEEK_BASE_URL}/v1/chat/completions\`, {
          model: MODEL_NAME,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        }, {
          headers: {
            'Authorization': \`Bearer \${DEEPSEEK_API_KEY}\`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        
        if (response.data?.choices?.[0]?.message?.content) {
          assistantMessage = response.data.choices[0].message.content.trim();
          responseSource = 'deepseek';
          logToFile('info', 'Успешный ответ от DeepSeek API');
        } else {
          throw new Error('Некорректный ответ от DeepSeek API');
        }
        
      } catch (apiError) {
        logToFile('warning', 'Ошибка DeepSeek API, используем локальную обработку', {
          error: apiError.message,
          status: apiError.response?.status
        });
        assistantMessage = processLocalMessage(userMessage);
        responseSource = 'local';
      }
    } else {
      // Демо-режим с локальной обработкой
      assistantMessage = processLocalMessage(userMessage);
      responseSource = 'demo';
    }
    
    // Сохраняем сообщения в сессию
    sessionData.messages.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    );
    
    // Генерируем предложения
    const suggestions = [
      "Какой состав у напитка?",
      "Есть ли противопоказания?", 
      "Как правильно употреблять?",
      "Где можно купить?",
      "Чем отличается от конкурентов?"
    ];
    
    const response = {
      message: assistantMessage,
      sessionId: sessionId,
      source: responseSource,
      suggestions: suggestions.slice(0, 3),
      metadata: {
        messageCount: sessionData.questionCount,
        responseTime: Date.now()
      }
    };
    
    logToFile('info', 'Отправлен ответ пользователю', {
      sessionId,
      source: responseSource,
      suggestionsCount: response.suggestions.length
    });
    
    res.json(response);
    
  } catch (error) {
    logToFile('error', 'Критическая ошибка в обработке запроса', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: 'Попробуйте еще раз через несколько секунд',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(\`\\n🚀 VITAHUB Chatbot v3.0 запущен!\`);
  console.log(\`📍 Сервер: http://localhost:\${port}\`);
  console.log(\`🧪 Тест: http://localhost:\${port}/test.html\`);
  console.log(\`\\n🤖 API статус:\`);
  console.log(\`   DeepSeek: \${DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'sk-free-deepseek-api-key' ? '✅ Настроен' : '🔄 Демо-режим'}\`);
  console.log(\`   Модель: \${MODEL_NAME}\`);
  console.log(\`\\n💡 Для настройки DeepSeek API:\`);
  console.log(\`   1. Регистрация: https://platform.deepseek.com\`);
  console.log(\`   2. Получите API ключ (бесплатно)\`);
  console.log(\`   3. Замените в .env: DEEPSEEK_API_KEY=ваш_ключ\`);
  
  logToFile('info', 'Сервер запущен', {
    port,
    version: '3.0.0',
    deepseekConfigured: DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'sk-free-deepseek-api-key'
  });
});

module.exports = app;
`;

// Сохраняем новый код
fs.writeFileSync(indexPath, newCode);

console.log('✅ Код сервера обновлен для DeepSeek API');
console.log('');
console.log('🎉 Готово! Сейчас работает в демо-режиме.');
console.log('');
console.log('📋 Что дальше:');
console.log('1. Запустите сервер: npm start');
console.log('2. Откройте: http://localhost:3000/test.html'); 
console.log('3. Для полной версии получите бесплатный API ключ:');
console.log('   - DeepSeek: https://platform.deepseek.com');
console.log('   - Добавьте в .env: DEEPSEEK_API_KEY=ваш_ключ');
console.log('');
console.log('🆓 Все бесплатно, регистрация простая!'); 
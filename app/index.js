require('dotenv').config();
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
  
  const logFile = path.join(logDir, `chatbot-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
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
    logToFile('info', `${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  next();
});

// Статические файлы
app.use(express.static(path.join(__dirname, '..', 'public')));

// API конфигурация для Google Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAJ2DSx4ozRJaJe2njQuhCr__02MTGpQfw';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
const MODEL_NAME = 'gemini-2.0-flash';

// Проверка здоровья сервера
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '3.0.0',
    services: {
      gemini: GEMINI_API_KEY ? 'configured' : 'not_configured',
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
    message: 'VITAHUB Chatbot API v3.0 работает с Google Gemini',
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
  return `Ты виртуальный ассистент VITAHUB - эксперт по функциональным напиткам.

КРИТИЧЕСКИ ВАЖНО:
- Отвечай ТОЛЬКО на основе предоставленной информации
- НЕ выдумывай состав, свойства или характеристики продуктов
- Если информации нет в базе данных - честно скажи "Точной информации об этом у меня нет"
- Используй только проверенные данные из карты смыслов VITAHUB

ПРОДУКТЫ VITAHUB:

1. **VITAHUB Energy** 🔥
**Состав:** Инозитол, Холин, Кофеин, Рибофлавин, без сахара (сукралоза)
**Упаковка:** Алюминиевая банка 330 мл, белый матовый, красный логотип
**Вкус:** Арбуз-клубника
**Эффекты:** продуктивность, выносливость, концентрация, контроль веса, улучшает настроение, подавляет голод
**УТП:** Без тревоги, без сердцебиения, использует жир для энергии, профилактика инсулинорезистентности

2. **VITAHUB Detox** 🌿  
**Состав:** Глутатион, витамин Е, без сахара (сукралоза)
**Упаковка:** Алюминиевая банка 330 мл, белый матовый, зеленый логотип
**Эффекты:** защита печени, контроль веса, антивозрастной эффект, профилактика вирусных инфекций, чистая кожа, защита репродуктивной системы
**Слоган:** "Ежедневный помощник в поддержании здоровья"

3. **VITAHUB Antistress** 😌
**Состав:** Триптофан, Глицин, Мелатонин, Таурин, Цитрат магния, без сахара (сукралоза)
**Упаковка:** Алюминиевая банка 330 мл, белый матовый, фиолетовый логотип  
**Вкус:** Мохито (сдержанный)
**Эффекты:** улучшает сон, настроение, спокойствие, продуктивность, адаптация к смене часовых поясов (jet-lag), подавляет голод
**УТП:** Нивелирует Jet lag, нормализует сон, адаптоген для спортсменов, профилактика инсулинорезистентности

Отвечай на русском языке, используй эмодзи для дружелюбности.`;
}

// Обработка сообщений в демо-режиме
function processLocalMessage(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('energy') || lowerMessage.includes('энерг')) {
    return `🔥 **VITAHUB Energy** - функциональный напиток на основе научных исследований!

✨ **Реальный состав:**
• Инозитол - ускоряет метаболизм жиров
• Холин - эффективное снижение веса
• Кофеин - для энергии и концентрации
• Рибофлавин (витамин B2)
• Без сахара (подсластитель сукралоза)

📦 **Упаковка:** Алюминиевая банка 330 мл
🍓 **Вкус:** Арбуз-клубника

⚡ **Научно доказанные эффекты:**
• Продуктивность и выносливость
• Концентрация внимания
• Контроль веса без потери мышечной массы
• Защита печени
• Профилактика инсулинорезистентности

🔬 **УТП:** Без тревоги, без сердцебиения, использует жир для энергии!`;
  }
  
  if (lowerMessage.includes('detox') || lowerMessage.includes('детокс')) {
    return `🌿 **VITAHUB Detox** - ежедневный помощник в поддержании здоровья!

✨ **Реальный состав:**
• Глутатион - мощный антиоксидант
• Витамин Е - защита клеток
• Без сахара (подсластитель сукралоза)

📦 **Упаковка:** Алюминиевая банка 330 мл, зеленый логотип

⚡ **Научно доказанные эффекты:**
• Защита печени - глутатион нейтрализует токсины
• Контроль веса - регулирует гормоны ожирения
• Антивозрастной эффект - защищает ДНК в митохондриях
• Профилактика вирусных инфекций - поддержка иммунитета
• Чистая кожа - снижает окислительный стресс
• Защита репродуктивной системы

🔬 **УТП:** Природный детокс на клеточном уровне!`;
  }
  
  if (lowerMessage.includes('antistress') || lowerMessage.includes('антистресс') || lowerMessage.includes('стресс') || lowerMessage.includes('сон') || lowerMessage.includes('мелатонин')) {
    return `😌 **VITAHUB Antistress** - спокойствие и здоровый сон!

✨ **Реальный состав:**
• Триптофан - предшественник серотонина (гормон счастья)
• Глицин - успокаивает нервную систему
• Мелатонин - нормализует сон и jet-lag
• Таурин - снижает плохой холестерин на 10%
• Цитрат магния - поддержка нервной системы

📦 **Упаковка:** Алюминиевая банка 330 мл, фиолетовый логотип
🍃 **Вкус:** Мохито (сдержанный)

⚡ **Научно доказанные эффекты:**
• Улучшает сон и нормализует режим
• Повышает настроение через синтез серотонина
• Адаптация к смене часовых поясов (jet-lag)
• Снижает предоперационную тревожность на 13%
• Спокойствие и продуктивность
• Подавляет голод

🔬 **УТП:** Адаптоген для спортсменов, без сахара!`;
  }
  
  if (lowerMessage.includes('состав') || lowerMessage.includes('ингредиент')) {
    return `📋 **Состав всех продуктов VITAHUB:**

🔥 **Energy:**
• Инозитол - ускоряет метаболизм жиров
• Холин - снижает массу тела  
• Кофеин - энергия и концентрация
• Рибофлавин (витамин B2)

🌿 **Detox:**
• Глутатион - мощный антиоксидант
• Витамин Е - защита клеток

😌 **Antistress:**
• Триптофан - синтез серотонина 
• Глицин - успокаивает нервы
• Мелатонин - нормализует сон
• Таурин - защищает сердце
• Цитрат магния

✅ **Все без сахара** - используется сукралоза`;
  }
  
  if (lowerMessage.includes('где купить') || lowerMessage.includes('заказать') || lowerMessage.includes('цена')) {
    return `🛒 **Где купить VITAHUB:**

🌐 **Официальный сайт:** vitahub.ru
📱 **Интернет-магазины:** Wildberries, Ozon
🏪 **Розница:** Спортмастер, Дикси (в крупных городах)

💰 **Цены:**
• Energy: ~300-400₽
• Detox: ~350-450₽  
• Antistress: ~400-500₽

🚚 Доставка по всей России, часто есть акции и скидки!`;
  }
  
  // Базовый ответ
  return `👋 Привет! Я ассистент VITAHUB! Расскажу о наших функциональных напитках:

🔥 **VITAHUB Energy** - энергия и фокус
• Инозитол, Холин, Кофеин
• Вкус: арбуз-клубника

🌿 **VITAHUB Detox** - очищение и антиоксиданты  
• Глутатион, Витамин Е
• Защита печени и молодость

😌 **VITAHUB Antistress** - сон и спокойствие
• Триптофан, Мелатонин, Глицин
• Вкус: мохито

✅ **Все напитки без сахара** с научно доказанными эффектами!

О каком продукте хотите узнать подробнее?`;
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

    const sessionId = providedSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
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
    
    // Если настроен API ключ Gemini - используем его
    if (GEMINI_API_KEY) {
      try {
        const systemPrompt = createSystemPrompt();
        const dialogHistory = sessionData.messages
          .slice(-10) // Берем последние 10 сообщений для контекста
          .map(msg => `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msg.content}`)
          .join('\n');
        
        const fullPrompt = `${systemPrompt}\n\nИстория диалога:\n${dialogHistory}\n\nПользователь: ${userMessage}\n\nАссистент:`;
        
        const response = await axios.post(
          `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
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
          data: apiError.response?.data
        };
        
        logToFile('warning', 'Ошибка Gemini API, используем локальную обработку', errorDetails);
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
  console.log(`\n🚀 VITAHUB Chatbot v3.0 запущен!`);
  console.log(`📍 Сервер: http://localhost:${port}`);
  console.log(`🧪 Тест: http://localhost:${port}/test.html`);
  console.log(`\n🤖 API статус:`);
  console.log(`   Google Gemini: ${GEMINI_API_KEY ? '✅ Настроен' : '🔄 Демо-режим'}`);
  console.log(`   Модель: ${MODEL_NAME}`);
  console.log(`\n💡 Для настройки Gemini API:`);
  console.log(`   1. Регистрация: https://ai.google.dev/`);
  console.log(`   2. Получите API ключ (бесплатно)`);
  console.log(`   3. Замените в .env: GEMINI_API_KEY=ваш_ключ`);
  
  logToFile('info', 'Сервер запущен', {
    port,
    version: '3.0.0',
    geminiConfigured: GEMINI_API_KEY ? true : false
  });
});

module.exports = app;

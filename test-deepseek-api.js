const axios = require('axios');

const API_KEY = 'sk-e896a2ba58474e999585b25585f426f2';
const BASE_URL = 'https://api.deepseek.com';

console.log('🧪 Тестирование DeepSeek API напрямую...\n');

async function testDeepSeekAPI() {
    try {
        console.log('📤 Отправляю запрос к DeepSeek...');
        
        const response = await axios.post(`${BASE_URL}/v1/chat/completions`, {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'user',
                    content: 'Привет! Ответь коротко, что такое энергетический напиток?'
                }
            ],
            temperature: 0.7,
            max_tokens: 200
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        if (response.data?.choices?.[0]?.message?.content) {
            const answer = response.data.choices[0].message.content.trim();
            console.log('✅ DeepSeek API работает!');
            console.log('🤖 Ответ:', answer);
            console.log('\n🎉 API ключ действительный!');
        } else {
            console.log('❌ Неожиданный формат ответа:', response.data);
        }

    } catch (error) {
        console.log('❌ Ошибка DeepSeek API:');
        console.log('📄 Код ошибки:', error.response?.status);
        console.log('📄 Сообщение:', error.response?.statusText);
        console.log('📄 Детали:', error.response?.data);
        console.log('📄 Полная ошибка:', error.message);
        
        if (error.response?.status === 401) {
            console.log('\n🔑 Похоже что API ключ неверный или истек');
            console.log('💡 Попробуйте создать новый ключ на https://platform.deepseek.com');
        } else if (error.response?.status === 429) {
            console.log('\n⏰ Превышен лимит запросов');
            console.log('💡 Подождите немного и попробуйте снова');
        } else if (error.code === 'ENOTFOUND') {
            console.log('\n🌐 Проблемы с сетью или API недоступно');
        }
    }
}

testDeepSeekAPI(); 
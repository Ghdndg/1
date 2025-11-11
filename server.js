import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { rateByToken } from './src/rateByToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  PORT = 8080,
  GEMINI_API_KEY,
  ALLOWED_ORIGINS = '',
  CLIENT_TOKEN,
  LEADS_EMAIL_TO,
  SMTP_HOST,
  SMTP_USER,
  SMTP_PASS,
} = process.env;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is required');
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const origins = ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
}));

const limiter = rateLimit({ windowMs: 60_000, max: 60 });
app.use(limiter);
app.use(rateByToken({ windowMs: 60_000, max: 120 }));

// static
app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  immutable: true,
}));

const MAX_LEN = 4000;
const ChatSchema = z.object({
  sessionId: z.string().min(6),
  companyId: z.string().min(2),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(MAX_LEN),
  })).min(1).max(20),
  metadata: z.record(z.any()).optional(),
});

const LeadSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(5).max(40),
  email: z.string().email().optional(),
  company: z.string().max(120).optional(),
  brief: z.string().min(5).max(2000),
  sessionId: z.string().min(6),
});

function buildSystemPrompt(companyId) {
  return [
    'Ты — ассистент компании «ИТ‑Консультант» (Крым, Симферополь, ул. Залесская 41).',
    'Услуги: системные интеграции (ЛВС, видеонаблюдение, Mesh Wi‑Fi, умный дом), ИТ‑поддержка',
    '(абонентка, Linux‑серверы, сетевое оборудование, консультации), цифровой маркетинг',
    '(корпсайты, SMM, реклама, Telegram‑боты), орг‑правовые вопросы (аудит ИТ, продажа',
    'оборудования, юрист в сфере ИТ и цифрового права). Сегменты: стартапы, действующий бизнес, организации.',
    'Говори кратко, по‑русски, без воды. Если вопрос не по теме — мягко возвращай к услугам.',
    'Предлагай следующий шаг: бесплатную консультацию. Контакты: +7 (978) 800‑27‑27, office@consultant-it.ru.',
    'Если пользователь готов оставить заявку — последовательно, по одному вопросу, собери: имя, телефон, email (опц.), компанию/сайт (опц.), кратко задачу/сроки/бюджет.',
    'После сбора — подведи итог и спроси подтверждение на передачу менеджеру.',
  ].join(' ');
}

function toGeminiContents(messages) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }],
  }));
}

async function callGeminiOnce(messages) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: toGeminiContents(messages) }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '';
  return text;
}

function verifyClient(req) {
  if (!CLIENT_TOKEN) return true;
  const hdr = req.get('X-Client-Token');
  return hdr && hdr === CLIENT_TOKEN;
}

// sync chat
app.post('/v1/chat', async (req, res) => {
  const t0 = Date.now();
  try {
    if (!verifyClient(req)) return res.status(401).json({ error: 'unauthorized' });
    const parsed = ChatSchema.parse(req.body);
    const system = { role: 'system', content: buildSystemPrompt(parsed.companyId) };
    const merged = [system, ...parsed.messages];
    const answer = await callGeminiOnce(merged);
    res.json({ reply: answer });
  } catch (e) {
    res.status(400).json({ error: 'bad_request', details: String(e.message || e) });
  } finally {
    const t1 = Date.now();
    console.log('POST /v1/chat', { ms: t1 - t0, ip: req.ip, origin: req.get('origin') || '' });
  }
});

// sse stream
app.get('/v1/chat/stream', async (req, res) => {
  try {
    if (!verifyClient(req)) {
      res.writeHead(401);
      return res.end();
    }
    const sessionId = String(req.query.sessionId || '');
    const companyId = String(req.query.companyId || 'consultant-it');
    const userMsg = String(req.query.q || '');

    if (!sessionId || !userMsg) {
      res.writeHead(400);
      return res.end('event: error\ndata: missing params\n\n');
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const system = { role: 'system', content: buildSystemPrompt(companyId) };
    const merged = [system, { role: 'user', content: userMsg }];
    const answer = await callGeminiOnce(merged);
    const chunks = answer.match(/.{1,200}/gs) || [answer];
    for (const c of chunks) {
      res.write(`data: ${JSON.stringify({ chunk: c })}\n\n`);
    }
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  } catch (e) {
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ error: String(e.message || e) })}\n\n`);
      res.end();
    } catch {}
  }
});

// lead capture (optional)
const mailer = SMTP_HOST ? nodemailer.createTransport({
  host: SMTP_HOST, auth: { user: SMTP_USER, pass: SMTP_PASS }
}) : null;

app.post('/v1/lead', async (req, res) => {
  try {
    if (!verifyClient(req)) return res.status(401).json({ error: 'unauthorized' });
    const lead = LeadSchema.parse(req.body);
    const id = crypto.randomUUID();
    if (mailer && LEADS_EMAIL_TO) {
      await mailer.sendMail({
        from: `"Assistant Bot" <${SMTP_USER}>`,
        to: LEADS_EMAIL_TO,
        subject: `Новая заявка #${id} — ИТ‑Консультант`,
        text: [
          `ID: ${id}`,
          `Имя: ${lead.name}`,
          `Телефон: ${lead.phone}`,
          `Email: ${lead.email || '-'}`,
          `Компания: ${lead.company || '-'}`,
          `Суть: ${lead.brief}`,
          `Сессия: ${lead.sessionId}`,
        ].join('\n'),
      });
    }
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ error: 'bad_request', details: String(e.message || e) });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log('Bot server on :' + PORT));



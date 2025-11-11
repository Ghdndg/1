(() => {
  const script = document.currentScript;
  const server = script.getAttribute('data-server');
  const companyId = script.getAttribute('data-company') || 'consultant-it';
  const theme = script.getAttribute('data-theme') || 'auto';
  const token = script.getAttribute('data-token');
  const useStream = (script.getAttribute('data-stream') || '1') === '1';

  if (!server) return console.error('[Assistant] data-server is required');
  const root = document.createElement('div');
  const shadow = root.attachShadow({ mode: 'open' });
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    .btn{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;
      background:#1f7aec;color:#fff;border:none;box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer;font-size:20px}
    .panel{position:fixed;right:20px;bottom:90px;width:360px;max-height:70vh;background:#fff;
      border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.2);display:none;overflow:hidden}
    .head{padding:10px 12px;border-bottom:1px solid #eee;font-weight:600}
    .msgs{height:48vh;overflow:auto;padding:10px;background:#fafafa}
    .msg{margin:8px 0;line-height:1.4}
    .msg.user{ text-align:right}
    .msg.assistant{ text-align:left }
    .input{display:flex;gap:8px;border-top:1px solid #eee;padding:8px;background:#fff}
    .input input{flex:1;padding:8px;border:1px solid #ddd;border-radius:8px}
    .input button{padding:8px 12px;border:none;background:#1f7aec;color:#fff;border-radius:8px;cursor:pointer}
    @media (max-width:480px){ .panel{right:10px;left:10px;width:auto} }
  `;
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = '💬';

  const panel = document.createElement('div');
  panel.className = 'panel';

  const head = document.createElement('div');
  head.className = 'head';
  head.textContent = 'Ассистент ИТ‑Консультант';

  const msgs = document.createElement('div');
  msgs.className = 'msgs';

  const inputBar = document.createElement('div');
  inputBar.className = 'input';
  const input = document.createElement('input');
  input.placeholder = 'Напишите вопрос...';
  const send = document.createElement('button');
  send.textContent = 'Отправить';
  inputBar.append(input, send);

  panel.append(head, msgs, inputBar);
  shadow.append(style, btn, panel);

  let open = false;
  let typingEl;
  let sessionId = localStorage.getItem('assistant_session');
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('assistant_session', sessionId);
  }

  function addMsg(text, role) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function ensureTyping(on) {
    if (on) {
      if (!typingEl) {
        typingEl = document.createElement('div');
        typingEl.className = 'msg assistant';
        typingEl.textContent = 'Ассистент печатает…';
        msgs.appendChild(typingEl);
      }
    } else if (typingEl) {
      msgs.removeChild(typingEl);
      typingEl = null;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addAssistantBubble() {
    const div = document.createElement('div');
    div.className = 'msg assistant';
    div.textContent = '';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  async function sendSync(text) {
    const resp = await fetch(`${server}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Client-Token': token } : {}),
      },
      body: JSON.stringify({
        sessionId,
        companyId,
        messages: [{ role: 'user', content: text }],
        metadata: { url: location.href, theme },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || 'Request failed');
    return data.reply || '';
  }

  async function sendStream(text) {
    return new Promise((resolve, reject) => {
      const ev = new EventSource(`${server}/v1/chat/stream?sessionId=${encodeURIComponent(sessionId)}&companyId=${encodeURIComponent(companyId)}&q=${encodeURIComponent(text)}`);
      let acc = '';
      ev.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          const chunk = data.chunk || '';
          if (chunk) {
            acc += chunk;
            assistantBubble.textContent = acc;
            msgs.scrollTop = msgs.scrollHeight;
          }
        } catch {}
      };
      ev.addEventListener('done', () => { ev.close(); resolve(acc); });
      ev.addEventListener('error', (e) => { ev.close(); reject(e); });
    });
  }

  let assistantBubble;
  async function sendMsg() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');
    assistantBubble = addAssistantBubble();
    ensureTyping(true);
    try {
      if (useStream) {
        const acc = await sendStream(text);
        ensureTyping(false);
        assistantBubble.textContent = acc || '(нет ответа)';
      } else {
        const ans = await sendSync(text);
        ensureTyping(false);
        assistantBubble.textContent = ans || '(нет ответа)';
      }
    } catch (e) {
      ensureTyping(false);
      assistantBubble.textContent = 'Ошибка: ' + (e.message || e);
    }
  }

  btn.addEventListener('click', () => {
    open = !open;
    panel.style.display = open ? 'block' : 'none';
  });
  send.addEventListener('click', sendMsg);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMsg();
  });

  setTimeout(() => {
    addMsg('Здравствуйте! Подскажу по ИТ‑поддержке, интеграциям, сайтам и юр. вопросам. Чем помочь?', 'assistant');
  }, 300);
})();



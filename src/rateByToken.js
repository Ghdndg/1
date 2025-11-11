export function rateByToken({ windowMs = 60_000, max = 120 } = {}) {
  const store = new Map();
  return (req, res, next) => {
    const key = `${req.get('X-Client-Token') || 'no-token'}|${req.get('origin') || ''}|${req.ip}`;
    const now = Date.now();
    const bucket = store.get(key) || { ts: now, count: 0 };
    if (now - bucket.ts > windowMs) { bucket.ts = now; bucket.count = 0; }
    bucket.count += 1;
    store.set(key, bucket);
    if (bucket.count > max) return res.status(429).json({ error: 'rate_limited' });
    next();
  };
}



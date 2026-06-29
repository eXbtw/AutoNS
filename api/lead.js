/**
 * POST /api/lead
 * Env (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN — токен от @BotFather
 *   TELEGRAM_CHAT_ID   — ваш chat_id (узнать: напишите боту, откройте getUpdates)
 */

const TRANSPORT_TYPES = new Set([
  'Лизинговый транспорт',
  'Такси и перевозки',
  'Спецтехника',
]);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    return '+7' + digits.slice(1);
  }
  if (digits.length === 10) return '+7' + digits;
  return raw.trim();
}

function isValidPhone(phone) {
  return /^\+7\d{10}$/.test(phone);
}

module.exports = async function handler(req, res) {
  const allowedOrigins = [
    'https://autons.de1.netrun.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return json(res, 500, { ok: false, error: 'Telegram not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  if (body._gotcha) {
    return json(res, 200, { ok: true });
  }

  const name = String(body.name || '').trim();
  const phone = normalizePhone(body.phone || '');
  const transport = String(body.transport || '').trim();

  if (name.length < 2) {
    return json(res, 400, { ok: false, error: 'Укажите имя' });
  }
  if (!isValidPhone(phone)) {
    return json(res, 400, { ok: false, error: 'Укажите корректный телефон' });
  }
  if (!TRANSPORT_TYPES.has(transport)) {
    return json(res, 400, { ok: false, error: 'Выберите тип транспорта' });
  }

  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const text = [
    '🚗 Новая заявка: АвтоНС-Лизинг',
    '',
    '👤 Имя: ' + name,
    '📞 Телефон: ' + phone,
    '🚛 Транспорт: ' + transport,
    '⏰ ' + time,
  ].join('\n');

  try {
    const tgRes = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      console.error('Telegram error:', tgData);
      return json(res, 502, { ok: false, error: 'Не удалось отправить в Telegram' });
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    return json(res, 500, { ok: false, error: 'Server error' });
  }
};

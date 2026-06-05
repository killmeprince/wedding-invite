function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizePayload(payload) {
  const fullName = String(payload.fullName || '').trim().slice(0, 120);
  const attendance = String(payload.attendance || '').trim().slice(0, 80);
  const drinks = Array.isArray(payload.drinks)
    ? payload.drinks.map((item) => String(item).trim()).filter(Boolean).slice(0, 10)
    : [];
  const comment = String(payload.comment || '').trim().slice(0, 600);
  const page = String(payload.page || '').trim().slice(0, 300);
  const submittedAt = String(payload.submittedAt || new Date().toISOString()).trim().slice(0, 80);

  return { fullName, attendance, drinks, comment, page, submittedAt };
}

function validate(payload) {
  if (payload.website) return 'Spam rejected';
  if (!payload.fullName || payload.fullName.length < 3) return 'Full name is required';
  if (!payload.attendance) return 'Attendance is required';
  return '';
}

function buildMessage(payload, request) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const drinks = payload.drinks.length ? payload.drinks.join(', ') : 'не указано';
  const comment = payload.comment || 'нет';

  return [
    '💌 <b>Новая анкета гостя</b>',
    '',
    `<b>ФИО:</b> ${escapeHtml(payload.fullName)}`,
    `<b>Присутствие:</b> ${escapeHtml(payload.attendance)}`,
    `<b>Напитки:</b> ${escapeHtml(drinks)}`,
    `<b>Комментарий:</b> ${escapeHtml(comment)}`,
    '',
    `<b>Страница:</b> ${escapeHtml(payload.page || 'не указано')}`,
    `<b>Время:</b> ${escapeHtml(payload.submittedAt)}`,
    `<b>IP:</b> ${escapeHtml(ip)}`,
    `<b>UA:</b> ${escapeHtml(userAgent.slice(0, 180))}`,
  ].join('\n');
}

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json({ ok: false, error: 'Telegram env vars are not configured' }, 500);
  }

  let rawPayload;
  try {
    rawPayload = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const validationError = validate(rawPayload);
  if (validationError) {
    return json({ ok: false, error: validationError }, 400);
  }

  const payload = normalizePayload(rawPayload);
  const message = buildMessage(payload, request);
  const telegramBody = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (env.TELEGRAM_THREAD_ID) {
    telegramBody.message_thread_id = Number(env.TELEGRAM_THREAD_ID);
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(telegramBody),
  });

  if (!response.ok) {
    const text = await response.text();
    return json({ ok: false, error: `Telegram error: ${text.slice(0, 220)}` }, 502);
  }

  return json({ ok: true });
}

export async function onRequestGet() {
  return json({ ok: false, error: 'Method not allowed' }, 405);
}

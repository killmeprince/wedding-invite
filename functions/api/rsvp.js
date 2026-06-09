const MAX_TEXT_LENGTH = 3500;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function normalizeDrinks(drinks) {
  if (!Array.isArray(drinks)) {
    return [];
  }

  return drinks
    .map((drink) => String(drink || '').trim())
    .filter(Boolean);
}

function buildTelegramMessage(payload) {
  const fullName = escapeHtml(payload.fullName);
  const attendance = escapeHtml(payload.attendance);
  const drinks = normalizeDrinks(payload.drinks);
  const comment = escapeHtml(payload.comment || '—');
  const page = escapeHtml(payload.page || '—');
  const submittedAt = escapeHtml(payload.submittedAt || new Date().toISOString());

  const drinksText = drinks.length
    ? drinks.map((drink) => `• ${escapeHtml(drink)}`).join('\n')
    : '—';

  const text = [
    '💌 <b>Новая анкета гостя</b>',
    '',
    `👤 <b>ФИО:</b> ${fullName}`,
    `✅ <b>Присутствие:</b> ${attendance}`,
    '',
    '<b>Напитки:</b>',
    drinksText,
    '',
    `💬 <b>Комментарий:</b> ${comment}`,
    '',
    `🌐 <b>Страница:</b> ${page}`,
    `🕒 <b>Отправлено:</b> ${submittedAt}`,
  ].join('\n');

  return text.slice(0, MAX_TEXT_LENGTH);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Некорректное тело запроса.';
  }

  if (String(payload.website || '').trim()) {
    return 'spam';
  }

  if (String(payload.fullName || '').trim().length < 3) {
    return 'Укажите ФИО.';
  }

  if (!String(payload.attendance || '').trim()) {
    return 'Выберите, сможете ли вы присутствовать.';
  }

  return '';
}

async function sendTelegramMessage(env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  const threadId = env.TELEGRAM_THREAD_ID;

  if (!token) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN');
  }

  if (!chatId) {
    throw new Error('Missing TELEGRAM_CHAT_ID');
  }

  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (threadId) {
    body.message_thread_id = Number(threadId);
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    const migrateToChatId = result?.parameters?.migrate_to_chat_id;

    if (migrateToChatId) {
      throw new Error(
        `Telegram group migrated. Replace TELEGRAM_CHAT_ID with: ${migrateToChatId}`
      );
    }

    throw new Error(`Telegram error: ${JSON.stringify(result)}`);
  }

  return result;
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();

    const validationError = validatePayload(payload);

    if (validationError === 'spam') {
      return jsonResponse({ ok: true });
    }

    if (validationError) {
      return jsonResponse({ ok: false, error: validationError }, 400);
    }

    const message = buildTelegramMessage(payload);

    await sendTelegramMessage(context.env, message);

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('RSVP submit failed:', error);

    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
  });
}
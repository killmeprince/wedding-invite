const ALLOWED_ORIGINS = new Set([
  "https://killmeprince.github.io",
  "https://killmeprince.github.io/wedding-invitation",
  "https://killmeprince.github.io/svadba",
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;

  try {
    const url = new URL(origin);

    if (ALLOWED_ORIGINS.has(origin)) {
      return true;
    }

    return (
      url.protocol === "https:" &&
      (
        url.hostname.endsWith(".pages.dev") ||
        url.hostname === "pages.dev"
      )
    );
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");

  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin)
      ? origin
      : "https://killmeprince.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(request ? corsHeaders(request) : {}),
    },
  });
}

function normalizePayload(payload) {
  const fullName = String(payload.fullName || "").trim().slice(0, 120);
  const attendance = String(payload.attendance || "").trim().slice(0, 80);

  const drinks = Array.isArray(payload.drinks)
    ? payload.drinks
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  const comment = String(payload.comment || "").trim().slice(0, 600);
  const submittedAt = String(payload.submittedAt || new Date().toISOString())
    .trim()
    .slice(0, 80);

  return {
    fullName,
    attendance,
    drinks,
    comment,
    submittedAt,
  };
}

function validate(rawPayload, payload) {
  if (rawPayload.website) return "Spam rejected";
  if (!payload.fullName || payload.fullName.length < 3) return "Full name is required";
  if (!payload.attendance) return "Attendance is required";

  return "";
}

function buildMessage(payload, request) {
  const drinks = payload.drinks.length ? payload.drinks.join(", ") : "не указано";
  const comment = payload.comment || "нет";
  return [
    "💌 <b>Новая анкета гостя</b>",
    "",
    `<b>ФИО:</b> ${escapeHtml(payload.fullName)}`,
    `<b>Присутствие:</b> ${escapeHtml(payload.attendance)}`,
    `<b>Напитки:</b> ${escapeHtml(drinks)}`,
    `<b>Комментарий:</b> ${escapeHtml(comment)}`,
    "",
    `<b>Время:</b> ${escapeHtml(payload.submittedAt)}`,
  ].join("\n");
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json(
      {
        ok: false,
        error: "Telegram env vars are not configured",
      },
      500,
      request
    );
  }

  let rawPayload;

  try {
    rawPayload = await request.json();
  } catch {
    return json(
      {
        ok: false,
        error: "Invalid JSON",
      },
      400,
      request
    );
  }

  const payload = normalizePayload(rawPayload);
  const validationError = validate(rawPayload, payload);

  if (validationError) {
    return json(
      {
        ok: false,
        error: validationError,
      },
      400,
      request
    );
  }

  const telegramBody = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: buildMessage(payload, request),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (env.TELEGRAM_THREAD_ID) {
    telegramBody.message_thread_id = Number(env.TELEGRAM_THREAD_ID);
  }

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(telegramBody),
    }
  );

  if (!telegramResponse.ok) {
    const text = await telegramResponse.text();

    return json(
      {
        ok: false,
        error: `Telegram error: ${text.slice(0, 220)}`,
      },
      502,
      request
    );
  }

  return json(
    {
      ok: true,
    },
    200,
    request
  );
}

export async function onRequestGet({ request }) {
  return json(
    {
      ok: false,
      error: "Method not allowed",
    },
    405,
    request
  );
}
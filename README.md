# Luxury wedding invitation — Азат & Настя

Одностраничное свадебное web-приглашение с музыкой, countdown, календарём, адресом, программой дня и анкетой гостя. Ответы анкеты отправляются в Telegram через Cloudflare Pages Function.

## Что внутри

- `index.html` — разметка приглашения.
- `styles.css` — визуальная система: premium editorial / old money / mocha palette.
- `script.js` — countdown, музыка, анимации, календарь, отправка формы.
- `functions/api/rsvp.js` — серверная функция для отправки RSVP в Telegram.
- `invite.ics` — файл для добавления события в календарь.
- `assets/music.mp3` — сюда нужно положить музыку. Файл не включён, чтобы не нарушать авторские права.

## Быстрый запуск локально

Для просмотра интерфейса без Telegram:

```bash
python -m http.server 8080
```

Откройте: `http://localhost:8080`.

Для локальной проверки Cloudflare Function используйте Wrangler:

```bash
npm i -g wrangler
wrangler pages dev .
```

## Деплой на Cloudflare Pages

1. Создайте GitHub-репозиторий и загрузите туда эти файлы.
2. Cloudflare Pages → Create application → Pages → Connect to Git.
3. Build command: оставить пустым.
4. Build output directory: `/`.
5. Environment variables:
   - `TELEGRAM_BOT_TOKEN` — токен бота из @BotFather.
   - `TELEGRAM_CHAT_ID` — id чата/группы, куда отправлять анкеты.
   - `TELEGRAM_THREAD_ID` — опционально, если используется topic в Telegram-группе.
6. Добавьте бота в нужный чат и дайте ему право отправлять сообщения.
7. Проверьте отправку формы на опубликованном домене.

## Как получить TELEGRAM_CHAT_ID

1. Создайте бота через @BotFather.
2. Добавьте бота в группу или напишите ему личное сообщение.
3. В браузере откройте:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

4. Найдите `chat.id`. Для групп id обычно отрицательный.

## Музыка

Браузеры не разрешают автоматически включать звук без действия пользователя. Поэтому на первом экране стоит кнопка «Открыть приглашение»: клик открывает сайт и запускает музыку. Положите файл в `assets/music.mp3`.

## Что можно быстро кастомизировать

- Имена и дата: `index.html`, блок `hero` и `invite.ics`.
- Адрес и карта: блок `place-section`.
- Цвета: переменные в начале `styles.css`.
- Поля анкеты: форма в `index.html` и формат сообщения в `functions/api/rsvp.js`.

const weddingDate = new Date('2026-07-31T16:00:00+03:00');
const state = {
  musicStarted: false,
  muted: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function pad(value) {
  return String(value).padStart(2, '0');
}

function updateCountdown() {
  const diff = Math.max(0, weddingDate.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  $('[data-days]').textContent = pad(days);
  $('[data-hours]').textContent = pad(hours);
  $('[data-minutes]').textContent = pad(minutes);
  $('[data-seconds]').textContent = pad(seconds);
}

function renderCalendar() {
  const grid = $('#calendarDays');
  const blanks = 2; // July 1, 2026 is Wednesday; calendar starts Monday.
  const days = 31;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < blanks; i += 1) {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = '0';
    fragment.appendChild(span);
  }

  for (let day = 1; day <= days; day += 1) {
    const span = document.createElement('span');
    span.textContent = day;
    if (day === 31) span.className = 'wedding-day';
    fragment.appendChild(span);
  }

  grid.appendChild(fragment);
}

function setupReveal() {
  const items = $$('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  items.forEach((item) => observer.observe(item));
}

function setupMusic() {
  const gate = $('#entryGate');
  const open = $('#openInvitation');
  const audio = $('#bgMusic');
  const toggle = $('#soundToggle');
  const icon = $('#soundIcon');

  document.body.classList.add('locked');

  const tryPlay = async () => {
    try {
      audio.volume = 0.42;
      await audio.play();
      state.musicStarted = true;
      state.muted = false;
      toggle.classList.remove('is-muted');
      icon.textContent = '♪';
    } catch (error) {
      state.musicStarted = false;
      state.muted = true;
      toggle.classList.add('is-muted');
      icon.textContent = '×';
    }
  };

  open.addEventListener('click', async () => {
    gate.classList.add('is-hidden');
    document.body.classList.remove('locked');
    await tryPlay();
  });

  toggle.addEventListener('click', async () => {
    if (!state.musicStarted || audio.paused) {
      await tryPlay();
      return;
    }
    audio.pause();
    state.muted = true;
    toggle.classList.add('is-muted');
    icon.textContent = '×';
  });
}

function setupCursorLight() {
  const light = $('.cursor-light');
  window.addEventListener('pointermove', (event) => {
    light.style.left = `${event.clientX}px`;
    light.style.top = `${event.clientY}px`;
  }, { passive: true });
}

function setupCopyAddress() {
  $('#copyAddress').addEventListener('click', async () => {
    const text = $('#addressText').textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      $('#copyAddress').textContent = 'Адрес скопирован';
      setTimeout(() => { $('#copyAddress').textContent = 'Скопировать адрес'; }, 1800);
    } catch {
      window.prompt('Скопируйте адрес:', text);
    }
  });
}

function getFormPayload(form) {
  const formData = new FormData(form);
  const drinks = formData.getAll('drinks');
  return {
    fullName: String(formData.get('fullName') || '').trim(),
    attendance: String(formData.get('attendance') || '').trim(),
    drinks,
    comment: String(formData.get('comment') || '').trim(),
    website: String(formData.get('website') || '').trim(),
    page: window.location.href,
    submittedAt: new Date().toISOString(),
  };
}

function validatePayload(payload) {
  if (payload.website) return 'spam';
  if (payload.fullName.length < 3) return 'Укажите, пожалуйста, ФИО.';
  if (!payload.attendance) return 'Выберите, сможете ли вы присутствовать.';
  return '';
}

function setupForm() {
  const form = $('#rsvpForm');
  const status = $('#formStatus');
  const submit = $('#submitButton');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = getFormPayload(form);
    const error = validatePayload(payload);
    if (error === 'spam') return;
    if (error) {
      status.textContent = error;
      status.className = 'form-status err';
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Отправляем…';
    status.textContent = '';
    status.className = 'form-status';

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Не удалось отправить анкету');
      }

      form.reset();
      status.textContent = 'Спасибо. Анкета отправлена организаторам.';
      status.className = 'form-status ok';
    } catch (error) {
      status.textContent = 'Не получилось отправить. Попробуйте ещё раз или напишите организатору в Telegram.';
      status.className = 'form-status err';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Отправить анкету';
    }
  });
}

updateCountdown();
setInterval(updateCountdown, 1000);
renderCalendar();
setupReveal();
setupMusic();
setupCursorLight();
setupCopyAddress();
setupForm();

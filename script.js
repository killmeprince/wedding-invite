// 31 июля 2026, 16:00 по Санкт-Петербургу.
// Санкт-Петербург = UTC+3, поэтому абсолютное время: 13:00 UTC.
const weddingDate = new Date('2026-07-31T13:00:00.000Z');

const CLOUDFLARE_RSVP_ENDPOINT = 'https://wedding-invite-2l6.pages.dev/api/rsvp';

const RSVP_ENDPOINT = window.location.hostname.endsWith('github.io')
  ? CLOUDFLARE_RSVP_ENDPOINT
  : '/api/rsvp';

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
  const daysEl = $('[data-days]');
  const hoursEl = $('[data-hours]');
  const minutesEl = $('[data-minutes]');
  const secondsEl = $('[data-seconds]');

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) {
    return;
  }

  const diff = Math.max(0, weddingDate.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  daysEl.textContent = pad(days);
  hoursEl.textContent = pad(hours);
  minutesEl.textContent = pad(minutes);
  secondsEl.textContent = pad(seconds);
}

function renderCalendar() {
  const grid = $('#calendarDays');

  if (!grid) {
    return;
  }

  grid.innerHTML = '';

  const blanks = 2;
  const days = 31;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < blanks; i += 1) {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = '';
    fragment.appendChild(span);
  }

  for (let day = 1; day <= days; day += 1) {
    const span = document.createElement('span');
    span.textContent = String(day);

    if (day === 31) {
      span.className = 'wedding-day';
    }

    fragment.appendChild(span);
  }

  grid.appendChild(fragment);
}

function setupReveal() {
  const items = $$('.reveal');

  if (!items.length) {
    return;
  }

  if (!('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.14,
  });

  items.forEach((item) => observer.observe(item));
}

function setupMusic() {
  const gate = $('#entryGate');
  const open = $('#openInvitation');
  const audio = $('#bgMusic');
  const toggle = $('#soundToggle');
  const icon = $('#soundIcon');

  if (!gate || !open || !audio || !toggle || !icon) {
    return;
  }

  document.body.classList.add('locked');

  const setMutedUi = () => {
    state.muted = true;
    toggle.classList.add('is-muted');
    icon.textContent = '×';
  };

  const setPlayingUi = () => {
    state.musicStarted = true;
    state.muted = false;
    toggle.classList.remove('is-muted');
    icon.textContent = '♪';
  };

  const tryPlay = async () => {
    try {
      audio.volume = 0.42;
      audio.muted = false;

      await audio.play();

      setPlayingUi();
    } catch {
      state.musicStarted = false;
      setMutedUi();
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
    setMutedUi();
  });
}

function setupCursorLight() {
  const light = $('.cursor-light');

  if (!light) {
    return;
  }

  window.addEventListener('pointermove', (event) => {
    light.style.left = `${event.clientX}px`;
    light.style.top = `${event.clientY}px`;
  }, {
    passive: true,
  });
}

function setupCopyAddress() {
  const copyButton = $('#copyAddress');
  const address = $('#addressText');

  if (!copyButton || !address) {
    return;
  }

  copyButton.addEventListener('click', async () => {
    const text = address.textContent.trim();

    try {
      await navigator.clipboard.writeText(text);

      copyButton.textContent = 'Адрес скопирован';

      setTimeout(() => {
        copyButton.textContent = 'Скопировать адрес';
      }, 1800);
    } catch {
      window.prompt('Скопируйте адрес:', text);
    }
  });
}

function setupDrinkRules() {
  const drinkInputs = $$('input[name="drinks"]');

  if (!drinkInputs.length) {
    return;
  }

  const noAlcoholInput = drinkInputs.find((input) => input.value === 'Я не пью алкоголь');
  const alcoholInputs = drinkInputs.filter((input) => input.value !== 'Я не пью алкоголь');

  if (!noAlcoholInput) {
    return;
  }

  const syncDrinksState = () => {
    if (noAlcoholInput.checked) {
      alcoholInputs.forEach((input) => {
        input.checked = false;
        input.disabled = true;
        input.closest('label')?.classList.add('is-disabled');
      });

      return;
    }

    alcoholInputs.forEach((input) => {
      input.disabled = false;
      input.closest('label')?.classList.remove('is-disabled');
    });
  };

  noAlcoholInput.addEventListener('change', syncDrinksState);

  alcoholInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) {
        return;
      }

      noAlcoholInput.checked = false;
      syncDrinksState();
    });
  });

  syncDrinksState();
}

function getFormPayload(form) {
  const formData = new FormData(form);

  return {
    fullName: String(formData.get('fullName') || '').trim(),
    attendance: String(formData.get('attendance') || '').trim(),
    drinks: formData.getAll('drinks'),
    comment: String(formData.get('comment') || '').trim(),
    website: String(formData.get('website') || '').trim(),
    page: window.location.href,
    submittedAt: new Date().toISOString(),
  };
}

function validatePayload(payload) {
  if (payload.website) {
    return 'spam';
  }

  if (payload.fullName.length < 3) {
    return 'Укажите, пожалуйста, ФИО';
  }

  if (!payload.attendance) {
    return 'Выберите, сможете ли вы присутствовать';
  }

  return '';
}

function setupForm() {
  const form = $('#rsvpForm');
  const status = $('#formStatus');
  const submit = $('#submitButton');

  if (!form || !status || !submit) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = getFormPayload(form);
    const error = validatePayload(payload);

    if (error === 'spam') {
      return;
    }

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
      const response = await fetch(RSVP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Не удалось отправить анкету');
      }

      form.reset();

      status.textContent = 'Спасибо, анкета отправлена организаторам';
      status.className = 'form-status ok';
    } catch (error) {
      console.error('RSVP submit failed:', error);

      status.textContent = 'Не получилось отправить, попробуйте ещё раз или напишите организатору в Telegram';
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
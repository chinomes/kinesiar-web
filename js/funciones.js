(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = {
    appointments: 'kinesiar_demo_appointments',
    reviews: 'kinesiar_demo_reviews',
    contact: 'kinesiar_demo_contact',
    blockedDates: 'kinesiar_blocked_dates',
    pageContent: 'kinesiar_page_content'
  };
  const CONTACT_DEFAULTS = { whatsapp: '', telefono: '', email: '', direccion: '', ciudad: '', instagram: '@kinesiar_salta', facebook: '', web: '', horarios: '', descripcion: '' };
  const PAGE_DEFAULTS = {
    heroTitleFirst: 'Volvé a moverte.',
    heroTitleSecond: 'Sentite mejor.',
    heroDescription: 'Un espacio dedicado a acompañarte en tu recuperación, cuidar tu cuerpo y ayudarte a volver a disfrutar del movimiento.',
    bookingDescription: 'Completá tus datos y tu preferencia de horario. Tu solicitud quedará pendiente hasta que el consultorio la confirme.',
    serviceOneTitle: 'Rehabilitación',
    serviceOneDescription: 'Acá agregaremos la información de este servicio, sus beneficios y cómo podemos acompañarte.',
    serviceTwoTitle: 'Kinesiología',
    serviceTwoDescription: 'En este espacio irá la descripción que definamos para presentar este servicio.',
    serviceThreeTitle: 'Bienestar',
    serviceThreeDescription: 'La información, imagen y contenido de esta tarjeta se completarán más adelante.'
  };
  const ADMIN_USERNAME = 'cucha2026';
  const ADMIN_PASSWORD_SALT = 'cdxJ2X2XnysfUX7/cXWeug==';
  const ADMIN_PASSWORD_HASH = 't7dkvf+alk7Ws68h5oYfs+so19PCCI4fChqIov7bHgM=';
  const ADMIN_PASSWORD_ITERATIONS = 310000;
  const readStore = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    }
    catch { return []; }
  };
  const writeStore = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const readObjectStore = (key, fallback) => {
    try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key) || '{}') || {}) }; }
    catch { return { ...fallback }; }
  };

  const localDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayString = localDateString();
  $('#year').textContent = new Date().getFullYear();
  const dateInput = $('#booking-form [name="fecha"]');
  if (dateInput) dateInput.min = todayString;

  // Circular menu: opens on hover (desktop) and click (all devices).
  const orbitMenu = $('#orbit-menu');
  const orbitToggle = $('#orbit-toggle');
  const setMenu = (open) => {
    orbitMenu.classList.toggle('is-open', open);
    orbitToggle.setAttribute('aria-expanded', String(open));
    orbitToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  orbitToggle.addEventListener('click', () => setMenu(!orbitMenu.classList.contains('is-open')));
  $$('#menu-links a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });

  // Flip cards work with hover, keyboard and touch.
  $$('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      const flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', String(flipped));
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const flipped = card.classList.toggle('is-flipped');
        card.setAttribute('aria-pressed', String(flipped));
      }
    });
  });

  function getMissing(form) {
    const missing = [];
    $$('[required]', form).forEach(control => {
      let valid = control.type === 'checkbox' ? control.checked : String(control.value || '').trim() !== '';
      if (control.type === 'email' && control.value.trim()) valid = control.checkValidity();
      const wrapper = control.closest('.field, .check-line, .rating-field');
      if (!valid && wrapper) {
        wrapper.classList.add('is-invalid');
        missing.push(control);
      } else if (wrapper) wrapper.classList.remove('is-invalid');
    });
    return missing;
  }

  function resetBall(button) {
    button.classList.remove('is-warning', 'is-success');
    button.disabled = false;
    const label = $('.submit-ball__text', button);
    if (label) label.style.display = '';
  }

  function markButton(button, state) {
    button.classList.remove('is-warning', 'is-success');
    button.classList.add(state);
    button.disabled = true;
  }

  function setFeedback(target, message, type = '') {
    target.textContent = message;
    target.className = `form-feedback${type ? ` form-feedback--${type}` : ''}`;
  }

  function isDateBlocked(date) {
    return readStore(STORAGE.blockedDates).includes(date);
  }

  function renderBookingDateHint() {
    const hint = $('#booking-date-hint');
    const wrapper = dateInput.closest('.field');
    const blocked = Boolean(dateInput.value && isDateBlocked(dateInput.value));

    hint.textContent = blocked
      ? 'Ese día está bloqueado. Elegí otra fecha.'
      : (dateInput.value
          ? 'Podés enviar una solicitud para este día; el turno debe ser confirmado por el consultorio.'
          : 'Las fechas bloqueadas no aceptan solicitudes.');
    hint.classList.toggle('is-unavailable', blocked);
    wrapper.classList.toggle('is-invalid', blocked);

    return !blocked;
  }

  dateInput.addEventListener('change', renderBookingDateHint);

  // Public contact section: data can be changed from the administrator panel.
  function safeWebUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(candidate);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function digitsOnly(value) { return String(value || '').replace(/\D/g, ''); }

  function makeContactTile(icon, label, title, detail, href = '') {
    const tile = document.createElement(href ? 'a' : 'article');
    tile.className = `contact-tile${href ? ' contact-tile--link' : ''}`;
    if (href) {
      tile.href = href;
      if (/^https?:/i.test(href)) { tile.target = '_blank'; tile.rel = 'noopener noreferrer'; }
    }
    const iconNode = document.createElement('span');
    iconNode.className = 'contact-tile__icon';
    iconNode.textContent = icon;
    const labelNode = document.createElement('small');
    labelNode.textContent = label;
    const titleNode = document.createElement('b');
    titleNode.textContent = title;
    const detailNode = document.createElement('span');
    detailNode.textContent = detail;
    tile.append(iconNode, labelNode, titleNode, detailNode);
    return tile;
  }

  function normalizeInstagram(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('@')) return `https://www.instagram.com/${encodeURIComponent(raw.slice(1))}/`;
    return safeWebUrl(raw.includes('instagram.com') ? raw : `https://www.instagram.com/${raw.replace(/^\//, '')}/`);
  }

  function normalizeFacebook(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return safeWebUrl(raw.includes('facebook.com') ? raw : `https://www.facebook.com/${raw.replace(/^\//, '')}`);
  }

  function renderContact() {
    const info = readObjectStore(STORAGE.contact, CONTACT_DEFAULTS);
    const description = $('#contact-description');
    if (description) description.textContent = info.descripcion.trim() || 'Los datos de contacto se podrán actualizar desde el panel de administración.';
    const grid = $('#contact-grid');
    if (!grid) return;
    grid.replaceChildren();

    const whatsappDigits = digitsOnly(info.whatsapp);
    const phoneDigits = digitsOnly(info.telefono);
    const phoneLink = whatsappDigits ? `https://wa.me/${whatsappDigits}` : (phoneDigits ? `tel:${phoneDigits}` : '');
    const phoneTitle = info.whatsapp || info.telefono || 'Dato pendiente';
    const phoneDetail = info.whatsapp && info.telefono && info.telefono !== info.whatsapp
      ? `Teléfono alternativo: ${info.telefono}`
      : (info.whatsapp || info.telefono ? 'Escribinos o llamanos para coordinar tu consulta' : 'Se completará desde el panel de administración');
    grid.append(makeContactTile('✆', 'WHATSAPP / TELÉFONO', phoneTitle, phoneDetail, phoneLink));

    const addressText = info.direccion || 'Dirección a completar';
    const cityText = info.ciudad || 'Agregá la ubicación desde administración';
    const mapQuery = [info.direccion, info.ciudad].filter(Boolean).join(', ');
    const mapLink = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : '';
    grid.append(makeContactTile('⌖', 'UBICACIÓN', addressText, cityText, mapLink));

    const emailLink = info.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email) ? `mailto:${info.email}` : '';
    grid.append(makeContactTile('✉', 'CORREO ELECTRÓNICO', info.email || 'Correo pendiente', info.email ? 'Escribinos por correo electrónico' : 'Agregá un correo desde administración', emailLink));

    const socialTile = makeContactTile('◎', 'REDES SOCIALES', (info.instagram || info.facebook) ? 'Encontranos en redes' : 'Perfiles a completar', 'Seguí las novedades y actividades de KINESIAR');
    const socialLinks = document.createElement('div');
    socialLinks.className = 'contact-tile__links';
    const instagramUrl = normalizeInstagram(info.instagram);
    const facebookUrl = normalizeFacebook(info.facebook);
    if (instagramUrl) {
      const link = document.createElement('a'); link.href = instagramUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Instagram'; socialLinks.append(link);
    }
    if (facebookUrl) {
      const link = document.createElement('a'); link.href = facebookUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Facebook'; socialLinks.append(link);
    }
    if (!socialLinks.childElementCount) {
      const pending = document.createElement('span'); pending.textContent = 'Se completarán desde administración'; socialLinks.append(pending);
    }
    socialTile.append(socialLinks);
    grid.append(socialTile);

    grid.append(makeContactTile('◷', 'HORARIOS DE ATENCIÓN', info.horarios || 'Horarios a completar', info.horarios ? 'Consultá disponibilidad para tu turno' : 'Agregá los días y horarios de atención'));

    const websiteUrl = safeWebUrl(info.web);
    if (websiteUrl) grid.append(makeContactTile('↗', 'SITIO WEB', info.web, 'Visitá nuestro sitio web', websiteUrl));
  }

  function loadContactForm() {
    const form = $('#contact-form');
    if (!form) return;
    const info = readObjectStore(STORAGE.contact, CONTACT_DEFAULTS);
    Object.entries(info).forEach(([name, value]) => {
      const control = form.elements.namedItem(name);
      if (control) control.value = value || '';
    });
  }

  const bookingForm = $('#booking-form');
  bookingForm.addEventListener('input', event => {
    const wrapper = event.target.closest('.field, .check-line');
    if (wrapper) wrapper.classList.remove('is-invalid');
    resetBall($('.submit-ball', bookingForm));
  });
  bookingForm.addEventListener('submit', event => {
    event.preventDefault();
    const button = $('.submit-ball', bookingForm);
    const feedback = $('#booking-feedback');
    resetBall(button);
    const missing = getMissing(bookingForm);
    if (missing.length) {
      markButton(button, 'is-warning');
      setFeedback(feedback, `Faltan ${missing.length} dato(s) obligatorio(s). Revisá las casillas marcadas en rojo.`, 'warning');
      missing[0].focus({ preventScroll: true });
      return;
    }
    if (!renderBookingDateHint()) {
      markButton(button, 'is-warning');
      setFeedback(feedback, 'La fecha elegida está bloqueada. Seleccioná otro día para continuar.', 'warning');
      dateInput.focus({ preventScroll: true });
      return;
    }
    const data = Object.fromEntries(new FormData(bookingForm).entries());
    const appointments = readStore(STORAGE.appointments);
    appointments.unshift({
      ...data,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      status: 'Pendiente'
    });
    const saved = writeStore(STORAGE.appointments, appointments);
    markButton(button, saved ? 'is-success' : 'is-warning');
    setFeedback(feedback, saved
      ? '¡Solicitud recibida en este navegador! Quedó pendiente de confirmación por el consultorio.'
      : 'La solicitud se validó, pero el navegador no permitió guardarla. Revisá la configuración de almacenamiento.', saved ? 'success' : 'warning');
    refreshAdmin();
  });

  // Star rating selection.
  const ratingInput = $('#review-form [name="puntuacion"]');
  let currentRating = 0;
  $$('.stars button').forEach(star => star.addEventListener('click', () => {
    currentRating = Number(star.dataset.rating);
    ratingInput.value = String(currentRating);
    resetBall($('.submit-ball', reviewForm));
    $$('.stars button').forEach(button => button.classList.toggle('is-selected', Number(button.dataset.rating) <= currentRating));
    $('.rating-field').classList.remove('is-invalid');
  }));
  const reviewForm = $('#review-form');
  reviewForm.addEventListener('input', event => { event.target.closest('.field')?.classList.remove('is-invalid'); resetBall($('.submit-ball', reviewForm)); });
  reviewForm.addEventListener('submit', event => {
    event.preventDefault();
    const button = $('.submit-ball', reviewForm);
    const feedback = $('#review-feedback');
    resetBall(button);
    const missing = getMissing(reviewForm);
    if (!currentRating) {
      $('.rating-field').classList.add('is-invalid');
      missing.push(ratingInput);
    }
    if (missing.length) {
      markButton(button, 'is-warning');
      setFeedback(feedback, 'Completá los campos obligatorios y elegí una puntuación. Las casillas faltantes están marcadas en rojo.', 'warning');
      const first = missing.find(item => item !== ratingInput);
      if (first) first.focus({ preventScroll: true });
      return;
    }
    const data = Object.fromEntries(new FormData(reviewForm).entries());
    const reviews = readStore(STORAGE.reviews);
    reviews.unshift({ ...data, id: Date.now(), createdAt: new Date().toISOString() });
    const saved = writeStore(STORAGE.reviews, reviews);
    markButton(button, 'is-success');
    setFeedback(feedback, saved
      ? '¡Gracias por compartir tu experiencia! El comentario quedó guardado localmente en esta demostración.'
      : 'La opinión está completa, pero no se pudo guardar en este navegador.', 'success');
    refreshAdmin();
  });

  // Admin demo modal.
  const modal = $('#admin-modal');
  const loginForm = $('#admin-login-form');
  const loginFeedback = $('#admin-login-feedback');
  const openAdmin = () => {
    $('#admin-login').hidden = false;
    $('#admin-dashboard').hidden = true;
    loginFeedback.textContent = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const closeAdmin = () => {
    $('#admin-dashboard').hidden = true;
    $('#admin-login').hidden = false;
    loginForm.reset();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  $('#open-admin').addEventListener('click', openAdmin);
  $$('[data-close-admin]').forEach(button => button.addEventListener('click', closeAdmin));
  const decodeBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  async function verifyAdminCredentials(username, password) {
    if (username !== ADMIN_USERNAME) return false;
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('La verificación segura de contraseña no está disponible en este origen.');
    }

    const key = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const digest = new Uint8Array(await window.crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: decodeBase64(ADMIN_PASSWORD_SALT),
      iterations: ADMIN_PASSWORD_ITERATIONS,
      hash: 'SHA-256'
    }, key, 256));
    const expected = decodeBase64(ADMIN_PASSWORD_HASH);
    let difference = digest.length ^ expected.length;

    for (let index = 0; index < Math.min(digest.length, expected.length); index++) {
      difference |= digest[index] ^ expected[index];
    }

    return difference === 0;
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('button[type="submit"]', loginForm);
    submit.disabled = true;

    try {
      const credentials = new FormData(loginForm);
      const valid = await verifyAdminCredentials(
        String(credentials.get('usuario') || ''),
        String(credentials.get('clave') || '')
      );

      if (!valid) {
        loginFeedback.textContent = 'Usuario o contraseña incorrectos.';
        loginForm.elements.namedItem('clave').value = '';
        return;
      }

      loginFeedback.textContent = '';
      loginForm.reset();
      $('#admin-login').hidden = true;
      $('#admin-dashboard').hidden = false;
      refreshAdmin();
    } catch (error) {
      console.error('No se pudo verificar el acceso administrador.', error);
      loginFeedback.textContent = 'Este navegador no permite verificar la contraseña. Abrí el sitio desde HTTPS o localhost.';
    } finally {
      submit.disabled = false;
    }
  });
  $('#admin-logout').addEventListener('click', () => {
    closeAdmin();
  });
  $$('.admin-tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.admin-tab').forEach(item => item.classList.toggle('is-active', item === tab));
    $$('.admin-content').forEach(panel => panel.hidden = panel.id !== `admin-${tab.dataset.tab}`);
  }));

  const contactForm = $('#contact-form');
  loadContactForm();
  if (contactForm) {
    contactForm.addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(contactForm);
      const info = Object.fromEntries(formData.entries());
      const feedback = $('#contact-save-feedback');
      const saved = writeStore(STORAGE.contact, { ...CONTACT_DEFAULTS, ...info });
      if (saved) {
        renderContact();
        feedback.textContent = '¡Listo! La información se actualizó en esta página y quedó guardada en este navegador.';
        feedback.style.color = '#28713a';
      } else {
        feedback.textContent = 'No se pudo guardar. El navegador puede tener el almacenamiento bloqueado o lleno.';
        feedback.style.color = '#b63333';
      }
    });
  }

  function applyPageContent() {
    const content = readObjectStore(STORAGE.pageContent, PAGE_DEFAULTS);
    const textBindings = {
      'hero-title-first': 'heroTitleFirst',
      'hero-title-second': 'heroTitleSecond',
      'hero-description': 'heroDescription',
      'booking-description': 'bookingDescription',
      'service-one-title': 'serviceOneTitle',
      'service-one-back-title': 'serviceOneTitle',
      'service-one-description': 'serviceOneDescription',
      'service-two-title': 'serviceTwoTitle',
      'service-two-back-title': 'serviceTwoTitle',
      'service-two-description': 'serviceTwoDescription',
      'service-three-title': 'serviceThreeTitle',
      'service-three-back-title': 'serviceThreeTitle',
      'service-three-description': 'serviceThreeDescription'
    };

    Object.entries(textBindings).forEach(([id, name]) => {
      const target = document.getElementById(id);
      if (target) target.textContent = content[name];
    });
  }

  const pageContentForm = $('#page-content-form');

  function loadPageContentForm() {
    const content = readObjectStore(STORAGE.pageContent, PAGE_DEFAULTS);
    Object.entries(PAGE_DEFAULTS).forEach(([name, value]) => {
      pageContentForm.elements.namedItem(name).value = content[name] || value;
    });
  }

  loadPageContentForm();
  applyPageContent();

  pageContentForm.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(pageContentForm).entries());
    const feedback = $('#page-save-feedback');

    if (writeStore(STORAGE.pageContent, values)) {
      applyPageContent();
      feedback.textContent = 'Los textos públicos se actualizaron y quedaron guardados en este navegador.';
      feedback.style.color = '#28713a';
    } else {
      feedback.textContent = 'No se pudieron guardar los cambios. Revisá el almacenamiento del navegador.';
      feedback.style.color = '#b63333';
    }
  });

  function renderList(container, items, type, emptyMessage = '') {
    container.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-empty';
      empty.textContent = emptyMessage || (
        type === 'appointment'
          ? 'Todavía no hay solicitudes. Las que se envíen desde este navegador aparecerán acá.'
          : 'Todavía no hay opiniones guardadas en este navegador.'
      );
      container.append(empty);
      return;
    }
    items.forEach(item => {
      const node = document.createElement('article');
      node.className = 'admin-list__item';
      const heading = document.createElement('b');
      heading.textContent = type === 'appointment' ? (item.nombre || 'Sin nombre') : `${item.nombre || 'Anónimo'} · ${item.puntuacion || 0}/5 ★`;
      const meta = document.createElement('span');
      meta.textContent = type === 'appointment'
        ? `${item.telefono || 'Sin teléfono'} · ${item.fecha || 'Sin fecha'} · ${item.horario || 'Horario a convenir'} · ${item.status || 'Pendiente'}`
        : new Date(item.createdAt).toLocaleString('es-AR');
      node.append(heading, meta);
      if (type === 'appointment') {
        const statusLabel = document.createElement('label');
        statusLabel.className = 'admin-status';
        statusLabel.textContent = 'Estado';
        const status = document.createElement('select');
        status.setAttribute('aria-label', `Estado de la solicitud de ${item.nombre || 'Sin nombre'}`);
        ['Pendiente', 'Confirmado', 'Cancelado'].forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          status.append(option);
        });
        status.value = ['Pendiente', 'Confirmado', 'Cancelado'].includes(item.status)
          ? item.status
          : 'Pendiente';
        statusLabel.append(status);
        status.addEventListener('change', () => {
          const appointments = readStore(STORAGE.appointments);
          const current = appointments.find(appointment => String(appointment.id) === String(item.id));
          if (!current) return;
          current.status = status.value;
          if (writeStore(STORAGE.appointments, appointments)) {
            refreshAdmin();
          } else {
            status.value = ['Pendiente', 'Confirmado', 'Cancelado'].includes(item.status)
              ? item.status
              : 'Pendiente';
            const error = document.createElement('small');
            error.className = 'admin-status-error';
            error.textContent = 'No se pudo guardar el cambio.';
            statusLabel.append(error);
          }
        });
        node.append(statusLabel);

        const editor = document.createElement('div');
        editor.className = 'admin-appointment-edit';
        const dateLabel = document.createElement('label');
        dateLabel.textContent = 'Fecha';
        const dateControl = document.createElement('input');
        dateControl.type = 'date';
        dateControl.min = todayString;
        dateControl.value = item.fecha || '';
        dateLabel.append(dateControl);

        const timeLabel = document.createElement('label');
        timeLabel.textContent = 'Franja horaria';
        const timeControl = document.createElement('select');
        [
          { value: '', label: 'A convenir' },
          { value: 'Mañana', label: 'Mañana' },
          { value: 'Mediodía', label: 'Mediodía' },
          { value: 'Tarde', label: 'Tarde' }
        ].forEach(optionData => {
          const option = document.createElement('option');
          option.value = optionData.value;
          option.textContent = optionData.label;
          timeControl.append(option);
        });
        if (item.horario && ![...timeControl.options].some(option => option.value === item.horario)) {
          const legacyOption = document.createElement('option');
          legacyOption.value = item.horario;
          legacyOption.textContent = item.horario;
          timeControl.append(legacyOption);
        }
        timeControl.value = item.horario === 'A convenir' ? '' : (item.horario || '');
        timeLabel.append(timeControl);

        const saveSchedule = document.createElement('button');
        saveSchedule.type = 'button';
        saveSchedule.className = 'admin-schedule-save';
        saveSchedule.textContent = 'Guardar cambio';
        const scheduleFeedback = document.createElement('small');
        scheduleFeedback.setAttribute('role', 'status');
        saveSchedule.addEventListener('click', () => {
          if (!dateControl.value) {
            scheduleFeedback.textContent = 'Elegí una fecha.';
            return;
          }
          if (dateControl.value < todayString) {
            scheduleFeedback.textContent = 'Elegí una fecha actual o futura.';
            return;
          }
          if (isDateBlocked(dateControl.value)) {
            scheduleFeedback.textContent = 'Ese día está bloqueado. Habilitalo antes de mover la solicitud.';
            return;
          }

          const appointments = readStore(STORAGE.appointments);
          const current = appointments.find(appointment => String(appointment.id) === String(item.id));
          if (!current) return;
          current.fecha = dateControl.value;
          current.horario = timeControl.value || 'A convenir';
          if (writeStore(STORAGE.appointments, appointments)) {
            refreshAdmin();
          } else {
            scheduleFeedback.textContent = 'No se pudo guardar el cambio.';
          }
        });
        editor.append(dateLabel, timeLabel, saveSchedule, scheduleFeedback);
        node.append(editor);
      }
      if (type === 'appointment' && item.servicio) {
        const detail = document.createElement('p'); detail.textContent = `Servicio: ${item.servicio}${item.email ? ` · ${item.email}` : ''}${item.mensaje ? ` · ${item.mensaje}` : ''}`; node.append(detail);
      }
      if (type === 'review') { const detail = document.createElement('p'); detail.textContent = item.comentario || ''; node.append(detail); }
      container.append(node);
    });
  }

  function refreshAdmin() {
    const appointments = readStore(STORAGE.appointments);
    const reviews = readStore(STORAGE.reviews);
    $('#appointment-count').textContent = appointments.length;
    $('#review-count').textContent = reviews.length;
    $('#image-count').textContent = uploadedImages.length;
    renderList($('#admin-appointments-list'), appointments, 'appointment');
    renderList($('#admin-reviews-list'), reviews, 'review');
    renderCalendar();
  }

  let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedCalendarDate = todayString;

  function renderCalendarSelection() {
    const appointments = readStore(STORAGE.appointments)
      .filter(appointment => appointment.fecha === selectedCalendarDate);
    const blocked = isDateBlocked(selectedCalendarDate);
    const selectedDate = new Date(`${selectedCalendarDate}T12:00:00`);

    $('#calendar-selected-date').textContent = selectedDate.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    $('#toggle-date-block').textContent = blocked ? 'Habilitar día' : 'Bloquear día';
    $('#toggle-date-block').disabled = selectedCalendarDate < todayString;
    $('#calendar-selected-note').textContent = blocked
      ? `${appointments.length} solicitud(es) existente(s). El bloqueo impide nuevas solicitudes, pero no cancela las actuales.`
      : `${appointments.length} solicitud(es). Este día acepta nuevas solicitudes pendientes de confirmación.`;
    renderList(
      $('#calendar-day-appointments'),
      appointments,
      'appointment',
      'No hay solicitudes para este día.'
    );
  }

  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    $('#calendar-title').textContent = calendarDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const grid = $('#calendar-grid'); grid.innerHTML = '';
    const appointments = readStore(STORAGE.appointments);
    const blockedDates = readStore(STORAGE.blockedDates);

    ['LU','MA','MI','JU','VI','SÁ','DO'].forEach(day => {
      const cell = document.createElement('div'); cell.className = 'calendar-cell weekday'; cell.textContent = day; grid.append(cell);
    });
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { const cell = document.createElement('div'); cell.className = 'calendar-cell is-muted'; cell.textContent = ''; grid.append(cell); }
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('button');
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAppointments = appointments.filter(appointment => appointment.fecha === date);
      const blocked = blockedDates.includes(date);
      cell.type = 'button';
      cell.className = 'calendar-cell calendar-day';
      cell.dataset.date = date;
      cell.textContent = day;
      cell.setAttribute('aria-label', `${day} ${calendarDate.toLocaleDateString('es-AR', { month: 'long' })}${blocked ? ', bloqueado' : ''}${dayAppointments.length ? `, ${dayAppointments.length} solicitudes` : ''}`);
      cell.setAttribute('aria-pressed', String(date === selectedCalendarDate));
      cell.title = blocked ? 'Bloqueado para nuevas solicitudes' : `${dayAppointments.length} solicitud(es)`;
      if (date === todayString) cell.classList.add('is-today');
      if (date === selectedCalendarDate) cell.classList.add('is-selected');
      if (blocked) cell.classList.add('is-blocked');
      if (dayAppointments.length) {
        cell.classList.add('has-bookings');
        const count = document.createElement('small');
        count.className = 'calendar-day-count';
        count.textContent = dayAppointments.length;
        cell.append(count);
      }
      cell.addEventListener('click', () => {
        selectedCalendarDate = date;
        renderCalendar();
      });
      grid.append(cell);
    }
    renderCalendarSelection();
  }

  $('#calendar-prev').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });
  $('#calendar-next').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });
  $('#toggle-date-block').addEventListener('click', () => {
    const blockedDates = readStore(STORAGE.blockedDates);
    const index = blockedDates.indexOf(selectedCalendarDate);

    if (index >= 0) blockedDates.splice(index, 1);
    else blockedDates.push(selectedCalendarDate);

    if (writeStore(STORAGE.blockedDates, blockedDates)) {
      renderCalendar();
      renderBookingDateHint();
    } else {
      $('#calendar-selected-note').textContent = 'No se pudo guardar el cambio. Revisá el almacenamiento del navegador.';
    }
  });
  renderCalendar();

  // Image previews: shown in the public gallery on this browser only (no remote upload yet).
  const uploadedImages = [];
  $('#image-upload').addEventListener('change', event => {
    [...event.target.files].filter(file => file.type.startsWith('image/')).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        uploadedImages.push({ name: file.name, src: reader.result });
        renderGallery();
        renderUploadPreview();
        refreshAdmin();
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  });
  function renderUploadPreview() {
    const preview = $('#admin-upload-preview');
    if (!preview) return;
    preview.innerHTML = '';
    uploadedImages.forEach(image => {
      const thumbnail = document.createElement('img');
      thumbnail.src = image.src;
      thumbnail.alt = `Vista previa: ${image.name}`;
      preview.append(thumbnail);
    });
  }

  function renderGallery() {
    const gallery = $('#public-gallery'); gallery.innerHTML = '';
    if (!uploadedImages.length) {
      gallery.innerHTML = '<div class="gallery-empty"><span>＋</span><p>Próximamente, imágenes de KINESIAR.</p></div>';
      return;
    }
    uploadedImages.forEach(image => {
      const figure = document.createElement('figure'); figure.className = 'gallery-photo';
      const img = document.createElement('img'); img.src = image.src; img.alt = image.name;
      figure.append(img); gallery.append(figure);
    });
    $('#image-count').textContent = uploadedImages.length;
  }
  renderContact();
  refreshAdmin();
  renderBookingDateHint();

  window.addEventListener('storage', event => {
    if (event.key === STORAGE.contact || event.key === null) {
      renderContact();
      loadContactForm();
    }
    if (event.key === STORAGE.pageContent || event.key === null) {
      applyPageContent();
      loadPageContentForm();
    }
    if (
      event.key === STORAGE.appointments ||
      event.key === STORAGE.blockedDates ||
      event.key === null
    ) {
      refreshAdmin();
      renderBookingDateHint();
    }
  });
})();

(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const config = window.KINESIAR_SUPABASE_CONFIG;
  const supabaseClient = window.supabase && config
    ? window.supabase.createClient(config.url, config.publishableKey)
    : null;
  const STORAGE_BUCKET = 'kinesiar-gallery';

  const CONTACT_DEFAULTS = {
    whatsapp: '', telefono: '', email: '', direccion: '', ciudad: '',
    instagram: '@kinesiar_salta', facebook: '', web: '', horarios: '', descripcion: ''
  };
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

  let siteSettings = { contact: { ...CONTACT_DEFAULTS }, pageContent: { ...PAGE_DEFAULTS } };
  let appointments = [];
  let reviews = [];
  let blockedDates = [];
  let uploadedImages = [];
  let backendReady = false;
  let isAdmin = false;
  let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedCalendarDate = '';
  let currentRating = 0;

  const localDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayString = localDateString();
  selectedCalendarDate = todayString;

  const dateInput = $('#booking-form [name="fecha"]');
  if (dateInput) dateInput.min = todayString;
  $('#year').textContent = new Date().getFullYear();

  function setFeedback(target, message, type = '') {
    if (!target) return;
    target.textContent = message;
    target.className = `form-feedback${type ? ` form-feedback--${type}` : ''}`;
  }

  function setAdminFeedback(target, message, success = false) {
    if (!target) return;
    target.textContent = message;
    target.style.color = success ? '#28713a' : '#b63333';
  }

  function errorMessage(action, error) {
    const reason = error && error.message ? ` ${error.message}` : '';
    return `No se pudo ${action}.${reason}`;
  }

  function requireSupabase() {
    if (!supabaseClient) throw new Error('No se pudo inicializar Supabase. Revisá la configuración y la conexión a internet.');
    return supabaseClient;
  }

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
    if (!button) return;
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

  // Circular menu: opens on hover (desktop) and click (all devices).
  const orbitMenu = $('#orbit-menu');
  const orbitToggle = $('#orbit-toggle');
  const setMenu = open => {
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

  function isDateBlocked(date) {
    return blockedDates.includes(date);
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

  // Public contact section.
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
    const info = siteSettings.contact;
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
    Object.entries(siteSettings.contact).forEach(([name, value]) => {
      const control = form.elements.namedItem(name);
      if (control) control.value = value || '';
    });
  }

  function applyPageContent() {
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
      if (target) target.textContent = siteSettings.pageContent[name] || PAGE_DEFAULTS[name];
    });
  }

  const pageContentForm = $('#page-content-form');
  const contactForm = $('#contact-form');

  function loadPageContentForm() {
    Object.entries(PAGE_DEFAULTS).forEach(([name, value]) => {
      const control = pageContentForm.elements.namedItem(name);
      if (control) control.value = siteSettings.pageContent[name] || value;
    });
  }

  async function loadPublicData() {
    try {
      const client = requireSupabase();
      const [settingsResult, blockedResult] = await Promise.all([
        client.from('site_settings').select('page_content, contact').eq('id', 1).single(),
        client.from('blocked_dates').select('blocked_date').order('blocked_date')
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (blockedResult.error) throw blockedResult.error;

      siteSettings = {
        pageContent: { ...PAGE_DEFAULTS, ...(settingsResult.data.page_content || {}) },
        contact: { ...CONTACT_DEFAULTS, ...(settingsResult.data.contact || {}) }
      };
      blockedDates = (blockedResult.data || []).map(row => row.blocked_date);
      backendReady = true;
      applyPageContent();
      renderContact();
      loadContactForm();
      loadPageContentForm();
      renderBookingDateHint();
      renderCalendar();
    } catch (error) {
      backendReady = false;
      console.error('No se pudo cargar la configuración de Supabase.', error);
      setFeedback($('#booking-feedback'), errorMessage('conectar con el sistema de turnos', error), 'warning');
    }
  }

  const bookingForm = $('#booking-form');
  bookingForm.addEventListener('input', event => {
    const wrapper = event.target.closest('.field, .check-line');
    if (wrapper) wrapper.classList.remove('is-invalid');
    resetBall($('.submit-ball', bookingForm));
  });
  bookingForm.addEventListener('submit', async event => {
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
    if (!backendReady) {
      markButton(button, 'is-warning');
      setFeedback(feedback, 'El sistema de turnos no está conectado todavía. No se envió la solicitud.', 'warning');
      return;
    }
    if (!renderBookingDateHint()) {
      markButton(button, 'is-warning');
      setFeedback(feedback, 'La fecha elegida está bloqueada. Seleccioná otro día para continuar.', 'warning');
      dateInput.focus({ preventScroll: true });
      return;
    }

    const data = new FormData(bookingForm);
    button.disabled = true;
    try {
      const { error } = await requireSupabase().from('appointments').insert({
        name: String(data.get('nombre')).trim(),
        phone: String(data.get('telefono')).trim(),
        email: String(data.get('email') || '').trim() || null,
        service: String(data.get('servicio')),
        appointment_date: String(data.get('fecha')),
        preferred_time: String(data.get('horario') || 'A convenir'),
        message: String(data.get('mensaje') || '').trim() || null,
        privacy_accepted: true
      });
      if (error) throw error;

      markButton(button, 'is-success');
      setFeedback(feedback, '¡Solicitud enviada! Quedó pendiente de confirmación por el consultorio.', 'success');
      bookingForm.reset();
      dateInput.min = todayString;
      renderBookingDateHint();
      if (isAdmin) await refreshAdmin();
    } catch (error) {
      console.error('No se pudo enviar la solicitud de turno.', error);
      markButton(button, 'is-warning');
      setFeedback(feedback, errorMessage('enviar la solicitud', error), 'warning');
    }
  });

  // Star rating selection and public review submission.
  const reviewForm = $('#review-form');
  const ratingInput = $('#review-form [name="puntuacion"]');
  $$('.stars button').forEach(star => star.addEventListener('click', () => {
    currentRating = Number(star.dataset.rating);
    ratingInput.value = String(currentRating);
    resetBall($('.submit-ball', reviewForm));
    $$('.stars button').forEach(button => button.classList.toggle('is-selected', Number(button.dataset.rating) <= currentRating));
    $('.rating-field').classList.remove('is-invalid');
  }));
  reviewForm.addEventListener('input', event => {
    const wrapper = event.target.closest('.field');
    if (wrapper) wrapper.classList.remove('is-invalid');
    resetBall($('.submit-ball', reviewForm));
  });
  reviewForm.addEventListener('submit', async event => {
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
    if (!backendReady) {
      markButton(button, 'is-warning');
      setFeedback(feedback, 'El sistema no está conectado todavía. No se envió la opinión.', 'warning');
      return;
    }

    const data = new FormData(reviewForm);
    button.disabled = true;
    try {
      const { error } = await requireSupabase().from('reviews').insert({
        name: String(data.get('nombre')).trim(),
        rating: currentRating,
        comment: String(data.get('comentario')).trim()
      });
      if (error) throw error;
      markButton(button, 'is-success');
      setFeedback(feedback, '¡Gracias! Tu opinión fue recibida y está pendiente de revisión.', 'success');
      reviewForm.reset();
      currentRating = 0;
      $$('.stars button').forEach(button => button.classList.remove('is-selected'));
      if (isAdmin) await refreshAdmin();
    } catch (error) {
      console.error('No se pudo guardar la opinión.', error);
      markButton(button, 'is-warning');
      setFeedback(feedback, errorMessage('guardar la opinión', error), 'warning');
    }
  });

  // Supabase Auth and administrator panel.
  const modal = $('#admin-modal');
  const loginForm = $('#admin-login-form');
  const loginFeedback = $('#admin-login-feedback');

  const showAdminModal = () => {
    $('#admin-login').hidden = isAdmin;
    $('#admin-dashboard').hidden = !isAdmin;
    loginFeedback.textContent = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const closeAdmin = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  $('#open-admin').addEventListener('click', showAdminModal);
  $$('[data-close-admin]').forEach(button => button.addEventListener('click', closeAdmin));

  async function authorizeCurrentUser() {
    if (!supabaseClient) return false;
    const { data, error } = await supabaseClient.rpc('is_kinesiar_admin');
    if (error) throw error;
    return data === true;
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('button[type="submit"]', loginForm);
    submit.disabled = true;
    loginFeedback.textContent = '';
    try {
      const credentials = new FormData(loginForm);
      const { error } = await requireSupabase().auth.signInWithPassword({
        email: String(credentials.get('email')).trim(),
        password: String(credentials.get('password'))
      });
      if (error) throw error;
      if (!(await authorizeCurrentUser())) {
        await supabaseClient.auth.signOut();
        loginFeedback.textContent = 'La cuenta existe, pero todavía no tiene permisos de administrador.';
        loginForm.elements.namedItem('password').value = '';
        return;
      }

      isAdmin = true;
      loginForm.reset();
      $('#admin-login').hidden = true;
      $('#admin-dashboard').hidden = false;
      await refreshAdmin();
    } catch (error) {
      console.error('No se pudo iniciar sesión como administrador.', error);
      loginFeedback.textContent = error.message || 'No se pudo iniciar sesión. Revisá el correo y la contraseña.';
      loginForm.elements.namedItem('password').value = '';
    } finally {
      submit.disabled = false;
    }
  });

  $('#admin-logout').addEventListener('click', async () => {
    try {
      const { error } = await requireSupabase().auth.signOut();
      if (error) throw error;
      isAdmin = false;
      appointments = [];
      reviews = [];
      closeAdmin();
      renderCalendar();
    } catch (error) {
      console.error('No se pudo cerrar la sesión de Supabase.', error);
      setAdminFeedback(loginFeedback, errorMessage('cerrar sesión', error));
    }
  });

  $$('.admin-tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.admin-tab').forEach(item => item.classList.toggle('is-active', item === tab));
    $$('.admin-content').forEach(panel => panel.hidden = panel.id !== `admin-${tab.dataset.tab}`);
  }));

  async function restoreAdminSession() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('No se pudo restaurar la sesión de Supabase.', error);
      return;
    }
    if (!data.session) return;
    try {
      isAdmin = await authorizeCurrentUser();
      if (!isAdmin) await supabaseClient.auth.signOut();
    } catch (error) {
      console.error('No se pudo verificar el permiso de administrador.', error);
      await supabaseClient.auth.signOut();
    }
  }

  // Administrator changes to contact information and public copy.
  if (contactForm) {
    contactForm.addEventListener('submit', async event => {
      event.preventDefault();
      const info = Object.fromEntries(new FormData(contactForm).entries());
      const feedback = $('#contact-save-feedback');
      try {
        const { error } = await requireSupabase().from('site_settings')
          .update({ contact: { ...CONTACT_DEFAULTS, ...info }, updated_at: new Date().toISOString() })
          .eq('id', 1);
        if (error) throw error;
        siteSettings.contact = { ...CONTACT_DEFAULTS, ...info };
        renderContact();
        setAdminFeedback(feedback, 'La información de contacto se guardó en Supabase.', true);
      } catch (error) {
        console.error('No se pudo guardar la información de contacto.', error);
        setAdminFeedback(feedback, errorMessage('guardar los datos de contacto', error));
      }
    });
  }

  pageContentForm.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(pageContentForm).entries());
    const feedback = $('#page-save-feedback');
    try {
      const { error } = await requireSupabase().from('site_settings')
        .update({ page_content: values, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
      siteSettings.pageContent = { ...PAGE_DEFAULTS, ...values };
      applyPageContent();
      setAdminFeedback(feedback, 'Los textos públicos se guardaron en Supabase.', true);
    } catch (error) {
      console.error('No se pudo guardar el contenido de la página.', error);
      setAdminFeedback(feedback, errorMessage('guardar el contenido', error));
    }
  });

  function mapAppointment(row) {
    return {
      id: row.id,
      nombre: row.name,
      telefono: row.phone,
      email: row.email,
      servicio: row.service,
      fecha: row.appointment_date,
      horario: row.preferred_time,
      mensaje: row.message,
      status: row.status,
      createdAt: row.created_at
    };
  }

  function mapReview(row) {
    return { id: row.id, nombre: row.name, puntuacion: row.rating, comentario: row.comment, createdAt: row.created_at };
  }

  function renderList(container, items, type, emptyMessage = '') {
    container.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-empty';
      empty.textContent = emptyMessage || (
        type === 'appointment' ? 'Todavía no hay solicitudes.' : 'Todavía no hay opiniones recibidas.'
      );
      container.append(empty);
      return;
    }

    items.forEach(item => {
      const node = document.createElement('article');
      node.className = 'admin-list__item';
      const heading = document.createElement('b');
      heading.textContent = type === 'appointment'
        ? (item.nombre || 'Sin nombre')
        : `${item.nombre || 'Anónimo'} · ${item.puntuacion || 0}/5 ★`;
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
        status.value = ['Pendiente', 'Confirmado', 'Cancelado'].includes(item.status) ? item.status : 'Pendiente';
        statusLabel.append(status);
        status.addEventListener('change', async () => {
          status.disabled = true;
          try {
            const { error } = await requireSupabase().from('appointments').update({ status: status.value }).eq('id', item.id);
            if (error) throw error;
            await refreshAdmin();
          } catch (error) {
            console.error('No se pudo cambiar el estado del turno.', error);
            status.value = item.status;
            const detail = document.createElement('small');
            detail.className = 'admin-status-error';
            detail.textContent = errorMessage('guardar el estado', error);
            statusLabel.append(detail);
            status.disabled = false;
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
        saveSchedule.addEventListener('click', async () => {
          if (!dateControl.value || dateControl.value < todayString) {
            scheduleFeedback.textContent = 'Elegí una fecha actual o futura.';
            return;
          }
          if (isDateBlocked(dateControl.value)) {
            scheduleFeedback.textContent = 'Ese día está bloqueado. Habilitalo antes de mover el turno.';
            return;
          }
          saveSchedule.disabled = true;
          try {
            const { error } = await requireSupabase().from('appointments')
              .update({ appointment_date: dateControl.value, preferred_time: timeControl.value || 'A convenir' })
              .eq('id', item.id);
            if (error) throw error;
            await refreshAdmin();
          } catch (error) {
            console.error('No se pudo reprogramar el turno.', error);
            scheduleFeedback.textContent = errorMessage('guardar el cambio', error);
            saveSchedule.disabled = false;
          }
        });
        editor.append(dateLabel, timeLabel, saveSchedule, scheduleFeedback);
        node.append(editor);
        if (item.servicio) {
          const detail = document.createElement('p');
          detail.textContent = `Servicio: ${item.servicio}${item.email ? ` · ${item.email}` : ''}${item.mensaje ? ` · ${item.mensaje}` : ''}`;
          node.append(detail);
        }
      } else {
        const detail = document.createElement('p');
        detail.textContent = item.comentario || '';
        node.append(detail);
      }
      container.append(node);
    });
  }

  async function refreshAdmin() {
    if (!isAdmin) return;
    try {
      const client = requireSupabase();
      const [appointmentsResult, reviewsResult, blockedResult] = await Promise.all([
        client.from('appointments').select('*').order('created_at', { ascending: false }),
        client.from('reviews').select('*').order('created_at', { ascending: false }),
        client.from('blocked_dates').select('blocked_date').order('blocked_date')
      ]);
      if (appointmentsResult.error) throw appointmentsResult.error;
      if (reviewsResult.error) throw reviewsResult.error;
      if (blockedResult.error) throw blockedResult.error;
      appointments = (appointmentsResult.data || []).map(mapAppointment);
      reviews = (reviewsResult.data || []).map(mapReview);
      blockedDates = (blockedResult.data || []).map(row => row.blocked_date);
      try {
        await loadGallery();
        $('#gallery-feedback').textContent = '';
      } catch (error) {
        console.error('No se pudo actualizar la galería del panel.', error);
        $('#gallery-feedback').textContent = errorMessage('cargar la galería', error);
      }
      $('#appointment-count').textContent = appointments.length;
      $('#review-count').textContent = reviews.length;
      $('#image-count').textContent = uploadedImages.length;
      renderList($('#admin-appointments-list'), appointments, 'appointment');
      renderList($('#admin-reviews-list'), reviews, 'review');
      renderCalendar();
      renderBookingDateHint();
      setAdminFeedback($('#admin-status-feedback'), '');
    } catch (error) {
      console.error('No se pudo actualizar el panel administrador.', error);
      setAdminFeedback($('#admin-status-feedback'), errorMessage('cargar los datos del panel', error));
    }
  }

  function renderCalendarSelection() {
    const dayAppointments = appointments.filter(appointment => appointment.fecha === selectedCalendarDate);
    const blocked = isDateBlocked(selectedCalendarDate);
    const selectedDate = new Date(`${selectedCalendarDate}T12:00:00`);
    $('#calendar-selected-date').textContent = selectedDate.toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    $('#toggle-date-block').textContent = blocked ? 'Habilitar día' : 'Bloquear día';
    $('#toggle-date-block').disabled = selectedCalendarDate < todayString;
    $('#calendar-selected-note').textContent = blocked
      ? `${dayAppointments.length} solicitud(es) existente(s). El bloqueo impide nuevas solicitudes, pero no cancela las actuales.`
      : `${dayAppointments.length} solicitud(es). Este día acepta nuevas solicitudes pendientes de confirmación.`;
    renderList($('#calendar-day-appointments'), dayAppointments, 'appointment', 'No hay solicitudes para este día.');
  }

  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    $('#calendar-title').textContent = calendarDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const grid = $('#calendar-grid');
    grid.replaceChildren();
    ['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell weekday';
      cell.textContent = day;
      grid.append(cell);
    });
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let index = 0; index < firstDay; index++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell is-muted';
      grid.append(cell);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('button');
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAppointments = appointments.filter(appointment => appointment.fecha === date);
      const blocked = isDateBlocked(date);
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
  $('#toggle-date-block').addEventListener('click', async () => {
    const blocked = isDateBlocked(selectedCalendarDate);
    const button = $('#toggle-date-block');
    button.disabled = true;
    try {
      const request = blocked
        ? requireSupabase().from('blocked_dates').delete().eq('blocked_date', selectedCalendarDate)
        : requireSupabase().from('blocked_dates').insert({ blocked_date: selectedCalendarDate });
      const { error } = await request;
      if (error) throw error;
      await refreshAdmin();
    } catch (error) {
      console.error('No se pudo modificar la disponibilidad del calendario.', error);
      $('#calendar-selected-note').textContent = errorMessage('guardar el bloqueo', error);
      button.disabled = false;
    }
  });

  // Images are stored in the public Supabase Storage bucket; RLS restricts writes to admins.
  function renderGallery() {
    const gallery = $('#public-gallery');
    gallery.replaceChildren();
    if (!uploadedImages.length) {
      const empty = document.createElement('div');
      empty.className = 'gallery-empty';
      const icon = document.createElement('span');
      icon.textContent = '＋';
      const text = document.createElement('p');
      text.textContent = 'Próximamente, imágenes de KINESIAR.';
      empty.append(icon, text);
      gallery.append(empty);
      return;
    }
    uploadedImages.forEach(image => {
      const figure = document.createElement('figure');
      figure.className = 'gallery-photo';
      const img = document.createElement('img');
      img.src = image.src;
      img.alt = image.name;
      img.loading = 'lazy';
      figure.append(img);
      gallery.append(figure);
    });
    $('#image-count').textContent = uploadedImages.length;
  }

  function renderUploadPreview() {
    const preview = $('#admin-upload-preview');
    if (!preview) return;
    preview.replaceChildren();
    uploadedImages.forEach(image => {
      const item = document.createElement('div');
      item.className = 'upload-preview__item';
      const thumbnail = document.createElement('img');
      thumbnail.src = image.src;
      thumbnail.alt = `Vista previa: ${image.name}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Eliminar';
      remove.setAttribute('aria-label', `Eliminar ${image.name}`);
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          const { error } = await requireSupabase().storage.from(STORAGE_BUCKET).remove([image.name]);
          if (error) throw error;
          await loadGallery();
        } catch (error) {
          console.error('No se pudo eliminar la imagen.', error);
          remove.disabled = false;
          window.alert(errorMessage('eliminar la imagen', error));
        }
      });
      item.append(thumbnail, remove);
      preview.append(item);
    });
  }

  async function loadGallery() {
    const { data, error } = await requireSupabase().storage.from(STORAGE_BUCKET)
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    uploadedImages = (data || [])
      .filter(file => file.id && file.name)
      .map(file => {
        const { data: publicUrl } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(file.name);
        return { name: file.name, src: publicUrl.publicUrl };
      });
    renderGallery();
    renderUploadPreview();
    $('#image-count').textContent = uploadedImages.length;
  }

  $('#image-upload').addEventListener('change', async event => {
    const input = event.target;
    const files = [...input.files];
    input.value = '';
    if (!isAdmin) {
      window.alert('Iniciá sesión como administrador para cargar imágenes.');
      return;
    }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      window.alert('Solo se permiten imágenes JPG, PNG o WEBP de hasta 5 MB cada una.');
      return;
    }
    for (const file of files) {
      const safeName = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      try {
        const { error } = await requireSupabase().storage.from(STORAGE_BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false
        });
        if (error) throw error;
      } catch (error) {
        console.error(`No se pudo subir ${file.name}.`, error);
        window.alert(errorMessage(`subir ${file.name}`, error));
        break;
      }
    }
    try {
      await loadGallery();
    } catch (error) {
      console.error('No se pudo refrescar la galería después de la carga.', error);
      $('#gallery-feedback').textContent = errorMessage('cargar la galería', error);
    }
  });

  async function initialize() {
    renderContact();
    applyPageContent();
    loadContactForm();
    loadPageContentForm();
    renderCalendar();
    renderBookingDateHint();
    if (!supabaseClient) {
      backendReady = false;
      setFeedback($('#booking-feedback'), 'No se pudo inicializar Supabase. Revisá la conexión y la configuración del sitio.', 'warning');
      renderGallery();
      return;
    }
    await loadPublicData();
    try {
      await loadGallery();
    } catch (error) {
      console.error('No se pudo cargar la galería de Supabase Storage.', error);
      $('#gallery-feedback').textContent = errorMessage('cargar la galería', error);
    }
    await restoreAdminSession();
    if (isAdmin) await refreshAdmin();
  }

  initialize();
})();

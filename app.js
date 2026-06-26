/* ═══════════════════════════════════════════════════════════════
   app.js — PodSync: Reproductor de Podcasts con Progreso Sincronizado
   Arquitectura: UI · Validación · Persistencia · Feedback
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   MÓDULO 1 — MOCK DATA / DATOS SEMILLA
   Define los datos iniciales que se cargarán en localStorage
   si las "tablas" aún no existen.
───────────────────────────────────────────────────────────── */
const SEED_DATA = {

  users: [
    { id: 'User123', name: 'Martín García',  avatar: '🧑‍💻' },
    { id: 'User456', name: 'Laura Méndez',   avatar: '👩‍🎨' },
  ],

  episodes: [
    {
      id: 'EP-01',
      podcastName: 'Hablemos de Tech',
      title: 'El auge de la IA Generativa en 2025',
      duration: 1800,   // 30 min en segundos
      cover: '🤖',
      description: 'GPT-5, Claude 4, Gemini Ultra y el futuro del trabajo.',
      date: '15 Jun 2025',
    },
    {
      id: 'EP-02',
      podcastName: 'Hablemos de Tech',
      title: 'React 19 y el futuro del Frontend',
      duration: 2700,   // 45 min
      cover: '⚛️',
      description: 'Server Components, Suspense y las nuevas APIs.',
      date: '22 Jun 2025',
    },
    {
      id: 'EP-03',
      podcastName: 'Startups & Código',
      title: 'De idea a MVP en 30 días',
      duration: 3600,   // 60 min
      cover: '🚀',
      description: 'Historias reales de fundadores latinoamericanos.',
      date: '1 Jul 2025',
    },
    {
      id: 'EP-04',
      podcastName: 'Startups & Código',
      title: 'Microservicios vs Monolito: la verdad',
      duration: 2400,   // 40 min
      cover: '🏗️',
      description: 'Cuándo escalar y cuándo no complicarse la vida.',
      date: '8 Jul 2025',
    },
  ],

  // Tabla de progreso — comienza vacía, se llena con el uso
  progress: [],
};

/* El usuario activo para esta demo */
const ACTIVE_USER_ID = 'User123';


/* ─────────────────────────────────────────────────────────────
   MÓDULO 2 — PERSISTENCIA (localStorage como "Base de Datos")
   Encapsula todas las lecturas y escrituras al storage.
───────────────────────────────────────────────────────────── */
const DB = {

  /** Inicializa las "tablas" si localStorage está vacío */
  init() {
    if (!localStorage.getItem('podcasts_users')) {
      localStorage.setItem('podcasts_users',    JSON.stringify(SEED_DATA.users));
      localStorage.setItem('podcasts_episodes', JSON.stringify(SEED_DATA.episodes));
      localStorage.setItem('podcasts_progress', JSON.stringify(SEED_DATA.progress));
      UI.log('info', '🗄️  Base de datos inicializada con datos semilla.');
    } else {
      UI.log('info', '🗄️  Datos cargados desde localStorage.');
    }
  },

  /** Lee una "tabla" desde localStorage y la parsea */
  getTable(tableName) {
    try {
      return JSON.parse(localStorage.getItem(tableName)) || [];
    } catch {
      return [];
    }
  },

  /** Persiste una "tabla" como JSON en localStorage */
  setTable(tableName, data) {
    localStorage.setItem(tableName, JSON.stringify(data));
  },

  /** Busca un usuario por id */
  findUser(userId) {
    return this.getTable('podcasts_users').find(u => u.id === userId) || null;
  },

  /** Busca un episodio por id */
  findEpisode(episodeId) {
    return this.getTable('podcasts_episodes').find(e => e.id === episodeId) || null;
  },

  /**
   * UPSERT de progreso:
   *   - Si ya existe el par (userId, episodeId) → actualiza currentTime + updatedAt
   *   - Si no existe → inserta un nuevo registro
   *
   * @param {string} userId
   * @param {string} episodeId
   * @param {number} currentTime
   * @returns {{ success: boolean, action: 'updated'|'inserted', record: object }|{ success: false, error: string }}
   */
  saveProgress(userId, episodeId, currentTime) {
    const progress  = this.getTable('podcasts_progress');
    const timestamp = new Date().toISOString();
    const idx       = progress.findIndex(p => p.userId === userId && p.episodeId === episodeId);

    if (idx !== -1) {
      // ── UPDATE ──
      progress[idx].currentTime = currentTime;
      progress[idx].updatedAt   = timestamp;
      this.setTable('podcasts_progress', progress);
      return { success: true, action: 'updated', record: progress[idx] };
    } else {
      // ── INSERT ──
      const newRecord = { userId, episodeId, currentTime, createdAt: timestamp, updatedAt: timestamp };
      progress.push(newRecord);
      this.setTable('podcasts_progress', progress);
      return { success: true, action: 'inserted', record: newRecord };
    }
  },

  /**
   * Recupera el progreso guardado para un par (userId, episodeId)
   * @returns {number} segundos de avance, o 0 si no existe
   */
  loadProgress(userId, episodeId) {
    const progress = this.getTable('podcasts_progress');
    const record   = progress.find(p => p.userId === userId && p.episodeId === episodeId);
    return record ? record.currentTime : 0;
  },
};


/* ─────────────────────────────────────────────────────────────
   MÓDULO 3 — VALIDACIÓN ("Backend" simulado)
   Valida los datos antes de impactar la persistencia.
───────────────────────────────────────────────────────────── */
const Validator = {

  /**
   * Valida un guardado de progreso completo.
   * @returns {{ valid: boolean, error?: string }}
   */
  validateSave(userId, episodeId, currentTime) {

    // Validación 1: currentTime debe ser número, >= 0 y < duración total
    const episode = DB.findEpisode(episodeId);
    if (!episode) {
      return { valid: false, error: `Episodio "${episodeId}" no encontrado en la base de datos.` };
    }

    if (typeof currentTime !== 'number' || isNaN(currentTime)) {
      return { valid: false, error: 'El tiempo de reproducción no es un número válido.' };
    }

    if (currentTime < 0) {
      return { valid: false, error: `El tiempo no puede ser negativo (recibido: ${currentTime}s).` };
    }

    if (currentTime >= episode.duration) {
      return {
        valid: false,
        error: `El tiempo (${currentTime}s) supera la duración del episodio (${episode.duration}s).`,
      };
    }

    // Validación 2: el usuario debe existir en los datos semilla
    const user = DB.findUser(userId);
    if (!user) {
      return { valid: false, error: `Usuario "${userId}" no registrado en el sistema.` };
    }

    return { valid: true };
  },
};


/* ─────────────────────────────────────────────────────────────
   MÓDULO 4 — INTERFAZ DE USUARIO (UI)
   Renderizado, actualización de DOM y feedback visual.
───────────────────────────────────────────────────────────── */
const UI = {

  /** Renderiza la lista de episodios en el DOM */
  renderEpisodeList(episodes, activeEpisodeId = null) {
    const container = document.getElementById('episode-list');
    container.innerHTML = '';

    episodes.forEach(ep => {
      const savedTime  = DB.loadProgress(ACTIVE_USER_ID, ep.id);
      const pct        = Math.min((savedTime / ep.duration) * 100, 100).toFixed(1);
      const isActive   = ep.id === activeEpisodeId;
      const badgeClass = savedTime === 0 ? 'new' : pct >= 95 ? 'finished' : 'progress';
      const badgeLabel = savedTime === 0 ? 'Nuevo'
                       : pct >= 95       ? 'Terminado'
                       : `${pct}%`;

      const card = document.createElement('button');
      card.className = `episode-card ${isActive ? 'active' : ''}`;
      card.dataset.episodeId = ep.id;
      card.onclick = () => App.loadEpisode(ep.id);

      card.innerHTML = `
        <div class="episode-cover">${ep.cover}</div>
        <div class="flex-1 min-w-0">
          <div class="episode-title">${ep.title}</div>
          <div class="episode-meta">${ep.podcastName} · ${ep.date} · ${this.formatTime(ep.duration)}</div>
          <div class="episode-progress-bar">
            <div class="episode-progress-fill" style="width: ${pct}%"></div>
          </div>
        </div>
        <span class="episode-badge ${badgeClass}">${badgeLabel}</span>
      `;

      container.appendChild(card);
    });
  },

  /** Actualiza la UI del reproductor con el episodio activo */
  loadPlayerUI(episode, currentTime) {
    document.getElementById('player-podcast-name').textContent  = episode.podcastName;
    document.getElementById('player-episode-title').textContent = episode.title;
    document.getElementById('player-episode-meta').textContent  =
      `${episode.date} · ${this.formatTime(episode.duration)}`;
    document.getElementById('player-cover').textContent         = episode.cover;
    document.getElementById('time-total').textContent           = this.formatTime(episode.duration);

    document.getElementById('player-card').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');

    this.updateProgress(currentTime, episode.duration);
  },

  /** Actualiza barra de progreso y tiempo */
  updateProgress(currentTime, duration) {
    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
    document.getElementById('progress-bar-fill').style.width = `${Math.min(pct, 100)}%`;
    document.getElementById('time-current').textContent = this.formatTime(currentTime);
  },

  /** Cambia ícono Play/Pause */
  setPlayIcon(isPlaying) {
    const icon = document.getElementById('play-icon');
    icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    lucide.createIcons();
  },

  /** Actualiza el botón de dispositivo activo */
  setActiveDevice(deviceId) {
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.device === deviceId);
    });
  },

  /** Muestra / oculta el indicador de sincronización del header */
  showSyncIndicator(text = 'Progreso sincronizado') {
    const el   = document.getElementById('sync-indicator');
    const txt  = document.getElementById('sync-text');
    txt.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  },

  /**
   * Agrega una entrada al log de actividad
   * @param {'save'|'load'|'error'|'info'} type
   */
  log(type, message) {
    const container = document.getElementById('activity-log');
    if (!container) return;

    const now   = new Date();
    const hh    = String(now.getHours()).padStart(2, '0');
    const mm    = String(now.getMinutes()).padStart(2, '0');
    const ss    = String(now.getSeconds()).padStart(2, '0');
    const time  = `${hh}:${mm}:${ss}`;

    const icons = { save: '💾', load: '📥', error: '⚠️', info: 'ℹ️' };

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
      <span class="log-time">${time}</span>
      <span>${icons[type] || '·'} ${message}</span>
    `;

    container.prepend(entry);

    // Mantener máximo 20 entradas
    while (container.children.length > 20) {
      container.removeChild(container.lastChild);
    }
  },

  /** Convierte segundos a formato mm:ss o h:mm:ss */
  formatTime(secs) {
    secs = Math.floor(secs);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  },
};


/* ─────────────────────────────────────────────────────────────
   MÓDULO 5 — CONTROLADOR PRINCIPAL (App)
   Orquesta UI + Validación + Persistencia + intervalos.
───────────────────────────────────────────────────────────── */
const App = {

  // ── Estado interno ──────────────────────────────
  state: {
    activeEpisodeId: null,
    currentTime:     0,
    isPlaying:       false,
    speed:           1,
    activeDevice:    'mobile',
    duration:        0,
  },

  // Timers
  _playbackInterval: null,  // simula el avance del audio
  _autoSaveInterval: null,  // guarda progreso cada 5 segundos

  // ── Inicialización ──────────────────────────────
  init() {
    // 1. Inicializa la "base de datos"
    DB.init();

    // 2. Renderiza lista de episodios
    const episodes = DB.getTable('podcasts_episodes');
    UI.renderEpisodeList(episodes);

    // 3. Activa los íconos de Lucide
    lucide.createIcons();

    // 4. Arranca el autosave cada 5 segundos
    this._autoSaveInterval = setInterval(() => {
      if (this.state.isPlaying && this.state.activeEpisodeId) {
        this._persistProgress('auto');
      }
    }, 5000);

    UI.log('info', `👤 Usuario activo: ${ACTIVE_USER_ID}`);
    UI.log('info', '✅ App inicializada. Seleccioná un episodio.');
  },

  // ── Cargar un episodio ──────────────────────────
  loadEpisode(episodeId) {
    const episode = DB.findEpisode(episodeId);
    if (!episode) {
      UI.log('error', `Episodio "${episodeId}" no encontrado.`);
      return;
    }

    // Si había uno reproduciéndose, pausarlo y guardar
    if (this.state.activeEpisodeId && this.state.isPlaying) {
      this._persistProgress('auto');
    }
    this._stopPlayback();

    // Recupera el progreso guardado para este usuario+episodio+dispositivo
    const savedTime = DB.loadProgress(ACTIVE_USER_ID, episodeId);

    this.state.activeEpisodeId = episodeId;
    this.state.currentTime     = savedTime;
    this.state.duration        = episode.duration;
    this.state.isPlaying       = false;

    UI.loadPlayerUI(episode, savedTime);
    UI.setPlayIcon(false);
    lucide.createIcons();

    // Re-renderiza lista marcando el activo
    const episodes = DB.getTable('podcasts_episodes');
    UI.renderEpisodeList(episodes, episodeId);

    UI.log(
      'load',
      `📥 "${episode.title}" cargado — retomando en ${UI.formatTime(savedTime)} (${this.state.activeDevice})`
    );
  },

  // ── Play / Pause ────────────────────────────────
  togglePlayPause() {
    if (!this.state.activeEpisodeId) return;

    this.state.isPlaying = !this.state.isPlaying;
    UI.setPlayIcon(this.state.isPlaying);
    lucide.createIcons();

    if (this.state.isPlaying) {
      this._startPlayback();
      UI.log('info', '▶️  Reproducción iniciada.');
    } else {
      this._stopPlayback();
      this._persistProgress('manual');
    }
  },

  // ── Skip ────────────────────────────────────────
  skipBack() {
    if (!this.state.activeEpisodeId) return;
    this.state.currentTime = Math.max(0, this.state.currentTime - 15);
    UI.updateProgress(this.state.currentTime, this.state.duration);
  },

  skipForward() {
    if (!this.state.activeEpisodeId) return;
    this.state.currentTime = Math.min(this.state.duration - 1, this.state.currentTime + 30);
    UI.updateProgress(this.state.currentTime, this.state.duration);
  },

  // ── Seek (clic en barra de progreso) ────────────
  seekTo(event) {
    if (!this.state.activeEpisodeId) return;
    const bar  = document.getElementById('progress-bar-container');
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.state.currentTime = Math.floor(pct * this.state.duration);
    UI.updateProgress(this.state.currentTime, this.state.duration);
    UI.log('info', `⏩ Saltando a ${UI.formatTime(this.state.currentTime)}`);
  },

  // ── Velocidad de reproducción ───────────────────
  cycleSpeed() {
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.75];
    const idx    = speeds.indexOf(this.state.speed);
    this.state.speed = speeds[(idx + 1) % speeds.length];
    document.getElementById('speed-label').textContent = `${this.state.speed}×`;
    UI.log('info', `⚡ Velocidad: ${this.state.speed}×`);
  },

  // ── Cambio de dispositivo ───────────────────────
  switchDevice(deviceId) {
    if (deviceId === this.state.activeDevice) return;

    // Pausa y guarda antes de cambiar
    if (this.state.isPlaying) {
      this._stopPlayback();
      this.state.isPlaying = false;
      UI.setPlayIcon(false);
      lucide.createIcons();
      this._persistProgress('auto');
    }

    this.state.activeDevice = deviceId;
    UI.setActiveDevice(deviceId);
    UI.log('info', `📱 Cambiando a dispositivo: ${deviceId}`);

    // Si hay episodio activo, recarga el progreso desde el storage
    if (this.state.activeEpisodeId) {
      const savedTime = DB.loadProgress(ACTIVE_USER_ID, this.state.activeEpisodeId);
      this.state.currentTime = savedTime;
      UI.updateProgress(savedTime, this.state.duration);

      Swal.fire({
        icon:             'success',
        title:            `Dispositivo: ${this._deviceLabel(deviceId)}`,
        text:             `Retomando desde ${UI.formatTime(savedTime)} 🔄`,
        background:       '#111118',
        color:            '#f1f5f9',
        iconColor:        '#22c55e',
        confirmButtonColor: '#22c55e',
        timer:            2200,
        timerProgressBar: true,
        showConfirmButton: false,
        toast:            true,
        position:         'top-end',
      });

      UI.log('load', `📱 Sincronizado en "${deviceId}" → ${UI.formatTime(savedTime)}`);
    }
  },

  // ── Guardar progreso manualmente ────────────────
  saveProgressManual() {
    if (!this.state.activeEpisodeId) return;
    this._persistProgress('manual');
  },

  // ── Simular cierre de app ───────────────────────
  closeApp() {
    if (!this.state.activeEpisodeId) {
      Swal.fire({
        icon: 'info', title: 'No hay episodio activo',
        background: '#111118', color: '#f1f5f9',
        confirmButtonColor: '#22c55e', timer: 1500, showConfirmButton: false,
        toast: true, position: 'top-end',
      });
      return;
    }

    this._stopPlayback();
    this.state.isPlaying = false;
    UI.setPlayIcon(false);
    lucide.createIcons();

    this._persistProgress('manual');

    Swal.fire({
      icon:             'warning',
      title:            '📴 App cerrada (simulado)',
      html:             `Progreso guardado en <strong>${UI.formatTime(this.state.currentTime)}</strong>.<br>
                         Al volver al mismo episodio desde cualquier dispositivo, retomará aquí.`,
      background:       '#111118',
      color:            '#f1f5f9',
      iconColor:        '#fbbf24',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#22c55e',
    });

    UI.log('info', `📴 App cerrada. Progreso guardado en ${UI.formatTime(this.state.currentTime)}.`);
  },

  // ── INTERNAL: iniciar playback simulado ─────────
  _startPlayback() {
    this._stopPlayback();
    this._playbackInterval = setInterval(() => {
      this.state.currentTime += this.state.speed;

      // Al llegar al final del episodio
      if (this.state.currentTime >= this.state.duration) {
        this.state.currentTime = this.state.duration - 1;
        this._stopPlayback();
        this.state.isPlaying = false;
        UI.setPlayIcon(false);
        lucide.createIcons();
        this._persistProgress('auto');
        UI.log('info', '🏁 Episodio completado.');

        Swal.fire({
          icon: 'success', title: '🎉 ¡Episodio terminado!',
          background: '#111118', color: '#f1f5f9',
          iconColor: '#22c55e', confirmButtonColor: '#22c55e',
          timer: 2500, showConfirmButton: false, toast: true, position: 'top-end',
        });
      }

      UI.updateProgress(this.state.currentTime, this.state.duration);
      // Actualiza mini-barra en la lista
      this._refreshEpisodeCardProgress();
    }, 1000); // 1 tick = 1 segundo real
  },

  _stopPlayback() {
    if (this._playbackInterval) {
      clearInterval(this._playbackInterval);
      this._playbackInterval = null;
    }
  },

  // ── INTERNAL: guardar y mostrar feedback ─────────
  _persistProgress(trigger) {
    const { activeEpisodeId, currentTime } = this.state;
    if (!activeEpisodeId) return;

    // Validar antes de persistir
    const validation = Validator.validateSave(ACTIVE_USER_ID, activeEpisodeId, currentTime);

    if (!validation.valid) {
      UI.log('error', `❌ Validación fallida: ${validation.error}`);
      Swal.fire({
        icon: 'error', title: 'Error de validación',
        text: validation.error,
        background: '#111118', color: '#f1f5f9',
        iconColor: '#f87171', confirmButtonColor: '#22c55e',
      });
      return;
    }

    // Persistir en localStorage
    const result  = DB.saveProgress(ACTIVE_USER_ID, activeEpisodeId, currentTime);
    const episode = DB.findEpisode(activeEpisodeId);
    const action  = result.action === 'updated' ? 'actualizado' : 'guardado';

    if (trigger === 'auto') {
      // Feedback sutil: solo el indicador del header
      UI.showSyncIndicator(`Progreso sincronizado en la nube local…`);
    } else {
      // Feedback explícito: toast SweetAlert2
      Swal.fire({
        icon:             'success',
        title:            '☁️ Progreso sincronizado',
        html:             `<span style="color:#94a3b8;font-size:0.875rem">
                             <strong style="color:#4ade80">${episode.title}</strong><br>
                             Guardado en <strong>${UI.formatTime(currentTime)}</strong>
                           </span>`,
        background:       '#111118',
        color:            '#f1f5f9',
        iconColor:        '#22c55e',
        confirmButtonColor: '#22c55e',
        timer:            2000,
        timerProgressBar: true,
        showConfirmButton: false,
        toast:            true,
        position:         'top-end',
      });
      UI.showSyncIndicator('Progreso guardado');
    }

    UI.log('save', `💾 Progreso ${action} → ${UI.formatTime(currentTime)} [${trigger}]`);

    // Re-renderiza mini-progreso de la lista
    const episodes = DB.getTable('podcasts_episodes');
    UI.renderEpisodeList(episodes, activeEpisodeId);
    lucide.createIcons();
  },

  // ── INTERNAL: actualiza mini-barra del card activo ──
  _refreshEpisodeCardProgress() {
    const card = document.querySelector(`.episode-card[data-episode-id="${this.state.activeEpisodeId}"]`);
    if (!card) return;
    const fill = card.querySelector('.episode-progress-fill');
    if (fill) {
      const pct = (this.state.currentTime / this.state.duration) * 100;
      fill.style.width = `${Math.min(pct, 100).toFixed(1)}%`;
    }
  },

  // ── INTERNAL: label legible del dispositivo ─────
  _deviceLabel(deviceId) {
    return { mobile: '📱 Celular', tablet: '📟 Tablet', desktop: '💻 Computadora' }[deviceId] || deviceId;
  },
};


/* ─────────────────────────────────────────────────────────────
   ARRANQUE — Cuando el DOM esté listo
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

/**
 * app.js — Minecraft Podcast Player
 * ============================================================
 * Lógica completa:
 *  • Carga progreso del backend al seleccionar episodio
 *  • Guarda progreso cada 5 s durante reproducción
 *  • Guarda inmediatamente al pausar / cerrar pestaña
 *  • Actualiza UI: disco giratorio, XP bar, tiempos, toast
 * ============================================================
 */

'use strict';

// ── URLs del backend ──────────────────────────────────────────
const BACKEND_SAVE = 'guardar_progreso.php';
const BACKEND_GET  = 'obtener_progreso.php';

// ── Intervalo de guardado automático (ms) ────────────────────
const SAVE_INTERVAL_MS = 5000;

// ── Estado global ────────────────────────────────────────────
const State = {
  usuarioId:    1,
  episodioId:   1,
  episodios:    [],          // poblado desde DOM data-* attrs
  saveTimer:    null,
  lastSaved:    0,
  syncPending:  false,
};

// ── Referencias DOM ───────────────────────────────────────────
const DOM = {
  audio:        document.getElementById('audio-player'),
  disk:         document.getElementById('mc-disk'),
  diskLabel:    document.getElementById('disk-label'),
  trackTitle:   document.getElementById('track-title'),
  trackArtist:  document.getElementById('track-artist'),
  syncInfo:     document.getElementById('sync-info'),
  xpFill:       document.getElementById('xp-fill'),
  xpCurrent:    document.getElementById('xp-current'),
  xpTotal:      document.getElementById('xp-total'),
  btnPlay:      document.getElementById('btn-play'),
  btnPrev:      document.getElementById('btn-prev'),
  btnNext:      document.getElementById('btn-next'),
  xpTrack:      document.getElementById('xp-track'),
  selUsuario:   document.getElementById('sel-usuario'),
  selEpisodio:  document.getElementById('sel-episodio'),
  led:          document.getElementById('jb-led'),
  jbTitle:      document.getElementById('jb-title'),
  toast:        document.getElementById('mc-toast'),
  loading:      document.getElementById('mc-loading'),
  playlist:     document.getElementById('playlist-list'),
};

// ── Helpers de tiempo ─────────────────────────────────────────
function formatTime(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 3000) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), duration);
}

// ── Loading screen ────────────────────────────────────────────
function setLoading(active) {
  if (active) {
    DOM.loading.classList.remove('hidden');
  } else {
    DOM.loading.classList.add('hidden');
  }
}

// ── Actualizar UI del reproductor ─────────────────────────────
function updateDiskColor(color) {
  DOM.disk.style.setProperty('--disk-color', color);
  DOM.diskLabel.style.background = color;
}

function setPlayState(playing) {
  if (playing) {
    DOM.disk.classList.add('spinning');
    DOM.btnPlay.textContent = '⏸ PAUSA';
    DOM.led.classList.add('active');
  } else {
    DOM.disk.classList.remove('spinning');
    DOM.btnPlay.textContent = '▶ PLAY';
    DOM.led.classList.remove('active');
  }
}

function updateProgressUI(current, total) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  DOM.xpFill.style.width = pct + '%';
  DOM.xpCurrent.textContent = formatTime(current);
  DOM.xpTotal.textContent   = formatTime(total);
}

function setPlaylistActive(episodioId) {
  const items = DOM.playlist.querySelectorAll('.playlist-item');
  items.forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.id) === episodioId);
  });
}

// ── Guardar progreso (Fetch POST) ─────────────────────────────
async function saveProgress(tiempo) {
  if (isNaN(tiempo) || tiempo < 0) return;
  // Evitar guardados duplicados del mismo segundo
  if (Math.abs(tiempo - State.lastSaved) < 0.5) return;
  State.lastSaved = tiempo;

  try {
    const res = await fetch(BACKEND_SAVE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id:      State.usuarioId,
        episodio_id:     State.episodioId,
        tiempo_segundos: parseFloat(tiempo.toFixed(2)),
      }),
    });
    const data = await res.json();
    if (data.status === 'ok') {
      DOM.syncInfo.textContent = `✓ Sync ${formatTime(tiempo)} · ${new Date().toLocaleTimeString()}`;
    }
  } catch (err) {
    console.warn('[Podcast] Error al guardar progreso:', err);
  }
}

// ── Guardar con intervalo ─────────────────────────────────────
function startAutoSave() {
  stopAutoSave();
  State.saveTimer = setInterval(() => {
    if (!DOM.audio.paused) {
      saveProgress(DOM.audio.currentTime);
    }
  }, SAVE_INTERVAL_MS);
}

function stopAutoSave() {
  clearInterval(State.saveTimer);
  State.saveTimer = null;
}

// ── Cargar progreso del backend ───────────────────────────────
async function loadProgress(usuarioId, episodioId) {
  setLoading(true);
  try {
    const url = `${BACKEND_GET}?usuario_id=${usuarioId}&episodio_id=${episodioId}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.status === 'error') {
      showToast('⚠ Error: ' + data.mensaje, 4000);
      setLoading(false);
      return;
    }

    // Actualizar audio source
    DOM.audio.src = data.url_audio;
    DOM.audio.load();

    // Actualizar UI
    DOM.trackTitle.textContent  = data.titulo   || '—';
    DOM.trackArtist.textContent = data.artista  || '';
    DOM.jbTitle.textContent     = `♪ ${data.titulo}`;
    updateDiskColor(data.color_disco || '#c0392b');
    updateProgressUI(data.tiempo_segundos, data.duracion_segundos);
    setPlaylistActive(episodioId);

    // Sync info
    if (data.status === 'ok') {
      const t = formatTime(data.tiempo_segundos);
      DOM.syncInfo.textContent = `↺ Retomando desde ${t} · ${data.ultima_escucha || ''}`;
      showToast(`♪ Retomando desde ${t}`, 3500);
    } else {
      DOM.syncInfo.textContent = '★ Primer escucha';
    }

    // Cuando el audio esté listo, saltar al tiempo guardado
    const seekAndGo = () => {
      if (data.tiempo_segundos > 1) {
        DOM.audio.currentTime = data.tiempo_segundos;
      }
      setLoading(false);
      DOM.audio.removeEventListener('canplay', seekAndGo);
    };
    DOM.audio.addEventListener('canplay', seekAndGo, { once: true });

    // Timeout de seguridad por si canplay no dispara (ej: error de CORS en audio)
    setTimeout(() => {
      if (DOM.loading && !DOM.loading.classList.contains('hidden')) {
        setLoading(false);
        DOM.audio.currentTime = data.tiempo_segundos || 0;
      }
    }, 5000);

    State.lastSaved = data.tiempo_segundos || 0;

  } catch (err) {
    console.error('[Podcast] Error al cargar progreso:', err);
    showToast('⚠ Sin conexión al servidor', 4000);
    setLoading(false);
  }
}

// ── Evento: cambio de episodio (selector o playlist) ─────────
async function onEpisodioChange(newEpisodioId) {
  // Guardar progreso del episodio actual antes de cambiar
  if (!DOM.audio.paused) {
    await saveProgress(DOM.audio.currentTime);
    DOM.audio.pause();
    setPlayState(false);
    stopAutoSave();
  }

  State.episodioId = newEpisodioId;
  DOM.selEpisodio.value = newEpisodioId;

  await loadProgress(State.usuarioId, State.episodioId);
}

// ── Evento: cambio de usuario ─────────────────────────────────
async function onUsuarioChange(newUsuarioId) {
  if (!DOM.audio.paused) {
    await saveProgress(DOM.audio.currentTime);
    DOM.audio.pause();
    setPlayState(false);
    stopAutoSave();
  }
  State.usuarioId = newUsuarioId;
  await loadProgress(State.usuarioId, State.episodioId);
}

// ── Navegación prev/next ──────────────────────────────────────
function getEpisodioIds() {
  return Array.from(DOM.selEpisodio.options).map(o => parseInt(o.value)).filter(Boolean);
}

async function playNext() {
  const ids  = getEpisodioIds();
  const idx  = ids.indexOf(State.episodioId);
  const next = ids[(idx + 1) % ids.length];
  if (next !== State.episodioId) {
    await onEpisodioChange(next);
    DOM.audio.play().catch(() => {});
  }
}

async function playPrev() {
  const ids  = getEpisodioIds();
  const idx  = ids.indexOf(State.episodioId);
  const prev = ids[(idx - 1 + ids.length) % ids.length];
  if (prev !== State.episodioId) {
    await onEpisodioChange(prev);
    DOM.audio.play().catch(() => {});
  }
}

// ── Seek (clic en XP bar) ────────────────────────────────────
DOM.xpTrack.addEventListener('click', (e) => {
  const rect  = DOM.xpTrack.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  const duration = DOM.audio.duration;
  if (isNaN(duration) || duration <= 0) return;
  const newTime = ratio * duration;
  DOM.audio.currentTime = newTime;
  updateProgressUI(newTime, duration);
  saveProgress(newTime);
});

// ── Clic en el disco = Play/Pausa ────────────────────────────
DOM.disk.addEventListener('click', () => DOM.btnPlay.click());

// ── Botón Play / Pausa ───────────────────────────────────────
DOM.btnPlay.addEventListener('click', async () => {
  if (!DOM.audio.src || DOM.audio.src === window.location.href) {
    showToast('⚠ Selecciona un episodio primero');
    return;
  }

  if (DOM.audio.paused) {
    try {
      await DOM.audio.play();
    } catch (err) {
      showToast('⚠ No se pudo reproducir el audio');
      console.error(err);
    }
  } else {
    DOM.audio.pause();
  }
});

// ── Botones prev / next ───────────────────────────────────────
DOM.btnPrev.addEventListener('click', playPrev);
DOM.btnNext.addEventListener('click', playNext);

// ── Selectores de usuario / episodio ────────────────────────
DOM.selUsuario.addEventListener('change', () => {
  onUsuarioChange(parseInt(DOM.selUsuario.value));
});

DOM.selEpisodio.addEventListener('change', () => {
  onEpisodioChange(parseInt(DOM.selEpisodio.value));
});

// ── Playlist items ────────────────────────────────────────────
DOM.playlist.querySelectorAll('.playlist-item').forEach(item => {
  item.addEventListener('click', async () => {
    const id = parseInt(item.dataset.id);
    if (id === State.episodioId) {
      DOM.btnPlay.click();
      return;
    }
    await onEpisodioChange(id);
    DOM.audio.play().catch(() => {});
  });
});

// ── Eventos del elemento <audio> ─────────────────────────────
DOM.audio.addEventListener('play', () => {
  setPlayState(true);
  startAutoSave();
});

DOM.audio.addEventListener('pause', async () => {
  setPlayState(false);
  stopAutoSave();
  await saveProgress(DOM.audio.currentTime);
});

DOM.audio.addEventListener('ended', async () => {
  setPlayState(false);
  stopAutoSave();
  // Guardar al final (100%)
  await saveProgress(DOM.audio.duration || 0);
  showToast('✔ Episodio terminado · ¡GG!', 4000);
  // Avanzar automáticamente al siguiente
  setTimeout(playNext, 2000);
});

DOM.audio.addEventListener('timeupdate', () => {
  const cur  = DOM.audio.currentTime;
  const tot  = DOM.audio.duration || 0;
  updateProgressUI(cur, tot);
});

DOM.audio.addEventListener('error', (e) => {
  console.error('[Podcast] Audio error:', e);
  setPlayState(false);
  showToast('⚠ Error al cargar el audio', 4000);
  setLoading(false);
});

// ── Guardar al cerrar / cambiar de pestaña ───────────────────
window.addEventListener('beforeunload', () => {
  if (!DOM.audio.paused && DOM.audio.currentTime > 0) {
    // navigator.sendBeacon para garantizar el envío
    const payload = JSON.stringify({
      usuario_id:      State.usuarioId,
      episodio_id:     State.episodioId,
      tiempo_segundos: parseFloat(DOM.audio.currentTime.toFixed(2)),
    });
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(BACKEND_SAVE, blob);
  }
});

// ── Visibilidad de pestaña ────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !DOM.audio.paused) {
    saveProgress(DOM.audio.currentTime);
  }
});

// ── Inicialización ────────────────────────────────────────────
(async function init() {
  // Leer valores iniciales del DOM
  State.usuarioId  = parseInt(DOM.selUsuario.value)  || 1;
  State.episodioId = parseInt(DOM.selEpisodio.value) || 1;

  // Cargar progreso inicial
  await loadProgress(State.usuarioId, State.episodioId);

  // Pequeño delay para mostrar la pantalla de carga
  setTimeout(() => setLoading(false), 600);
})();

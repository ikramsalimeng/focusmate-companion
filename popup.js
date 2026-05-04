// popup.js — Focusmate Companion v1.2

const api = window.browserAPI || (typeof browser !== 'undefined' ? browser : chrome);
const $ = id => document.getElementById(id);

// ─────────────────────────────────────────────
// TASKS — simple, bulletproof
// ─────────────────────────────────────────────

let tasks = [];
let pickedId = null;

function uid() {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

function saveTasks() {
  api.storage.local.set({ fmTasks: tasks });
}

function render() {
  const container = $('taskItems');
  const empty = $('taskEmpty');
  if (!container || !empty) return;

  if (tasks.length === 0) {
    empty.classList.add('show');
    container.innerHTML = '';
    return;
  }
  empty.classList.remove('show');

  container.innerHTML = tasks.map(t => `
    <div class="task-item${t.id === pickedId ? ' picked' : ''}" data-id="${t.id}">
      <input type="checkbox" class="task-cb" ${t.done ? 'checked' : ''} data-action="toggle" data-id="${t.id}">
      <span class="task-txt${t.done ? ' done' : ''}" data-action="edit" data-id="${t.id}">${escHtml(t.text)}</span>
      <button class="task-del" data-action="delete" data-id="${t.id}" title="Remove">×</button>
    </div>
  `).join('');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initTaskEvents() {
  const container = $('taskItems');

  container.addEventListener('click', e => {
    const action = e.target.dataset.action;
    const id     = e.target.dataset.id;
    if (!action || !id) return;

    if (action === 'delete') {
      tasks = tasks.filter(t => t.id !== id);
      if (pickedId === id) pickedId = null;
      saveTasks();
      render();
      return;
    }

    if (action === 'edit') {
      startEdit(id, e.target);
      return;
    }
  });

  container.addEventListener('change', e => {
    if (e.target.dataset.action !== 'toggle') return;
    const id = e.target.dataset.id;
    const t  = tasks.find(t => t.id === id);
    if (!t) return;
    t.done = e.target.checked;
    if (pickedId === id) pickedId = null;
    const todo = tasks.filter(t => !t.done);
    const done = tasks.filter(t =>  t.done);
    tasks = [...todo, ...done];
    saveTasks();
    render();
  });
}

function startEdit(id, spanEl) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;

  const input = document.createElement('input');
  input.style.cssText = 'flex:1;font-size:12px;border:1px solid #4a47a3;border-radius:4px;padding:2px 6px;font-family:inherit;outline:none;';
  input.value = t.text;

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const val = input.value.trim();
    if (val) t.text = val;
    saveTasks();
    render();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { committed = true; render(); }
  });
  input.addEventListener('blur', () => setTimeout(commit, 100));

  spanEl.replaceWith(input);
  input.focus();
  input.select();
}

function addFromText(raw) {
  if (!raw.trim()) return;
  raw.split('\n').map(l => l.trim()).filter(Boolean).forEach(text => {
    tasks.push({ id: uid(), text, done: false });
  });
  saveTasks();
  render();
}

// ─────────────────────────────────────────────
// AUDIO SETTINGS
// ─────────────────────────────────────────────

const DEFAULTS = {
  audioOn: true, tickEnabled: true, voiceEnabled: true,
  secondsCountdownEnabled: false, tickVolume: 0.5, voiceVolume: 0.8,
  announcementInterval: 5, tickSound: 'tick-tock',
  transitionEnabled: false, transitionPreReminder: false, transitionSound: 'chime',
  ambientEnabled: false, ambientSound: 'brown', ambientVolume: 0.15,
  ambientBetweenSessions: true,
  preSessionWarningEnabled: true,
  preSessionWarningSound: 'ding',
  advancedOpen: false
};

let testAudio = null;

function applyUI(data) {
  // Mute button reflects audioOn
  updateMuteButton(data.audioOn ?? DEFAULTS.audioOn);

  $('tickEnabled').checked              = data.tickEnabled              ?? DEFAULTS.tickEnabled;
  $('voiceEnabled').checked             = data.voiceEnabled             ?? DEFAULTS.voiceEnabled;
  $('secondsCountdownEnabled').checked  = data.secondsCountdownEnabled  ?? DEFAULTS.secondsCountdownEnabled;
  $('transitionEnabled').checked        = data.transitionEnabled        ?? DEFAULTS.transitionEnabled;
  $('transitionPreReminder').checked    = data.transitionPreReminder    ?? DEFAULTS.transitionPreReminder;
  $('preSessionWarningEnabled').checked = data.preSessionWarningEnabled ?? DEFAULTS.preSessionWarningEnabled;
  $('announcementInterval').value       = data.announcementInterval     ?? DEFAULTS.announcementInterval;
  $('tickSound').value                  = data.tickSound                ?? DEFAULTS.tickSound;
  $('transitionSound').value            = data.transitionSound          ?? DEFAULTS.transitionSound;
  $('preSessionWarningSound').value     = data.preSessionWarningSound   ?? DEFAULTS.preSessionWarningSound;

  const tv = data.tickVolume  ?? DEFAULTS.tickVolume;
  $('tickVolume').value = Math.round(tv * 100);
  $('tvVal').textContent = Math.round(tv * 100) + '%';

  const vv = data.voiceVolume ?? DEFAULTS.voiceVolume;
  $('voiceVolume').value = Math.round(vv * 100);
  $('vvVal').textContent = Math.round(vv * 100) + '%';

  $('ambientEnabled').checked         = data.ambientEnabled          ?? DEFAULTS.ambientEnabled;
  $('ambientBetweenSessions').checked = data.ambientBetweenSessions  ?? DEFAULTS.ambientBetweenSessions;
  $('ambientSound').value             = data.ambientSound            ?? DEFAULTS.ambientSound;
  const av = data.ambientVolume ?? DEFAULTS.ambientVolume;
  $('ambientVolume').value = Math.round(av * 100);
  $('avVal').textContent = Math.round(av * 100) + '%';

  // Advanced collapse — restore last state
  const advOpen = data.advancedOpen ?? DEFAULTS.advancedOpen;
  if (advOpen) {
    $('advancedToggle').classList.add('open');
    $('advancedContent').classList.add('open');
  }
}

function saveSetting(k, v) { api.storage.local.set({ [k]: v }); }

function showFb(msg) {
  const el = $('fb');
  if (!el) return;
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, 2500);
}

// ─────────────────────────────────────────────
// MUTE BUTTON
// ─────────────────────────────────────────────

function updateMuteButton(audioOn) {
  const btn = $('muteBtn');
  const icon = $('muteIcon');
  const label = $('muteLabel');
  if (audioOn) {
    btn.classList.remove('muted');
    icon.textContent = '🔊';
    label.textContent = 'All Audio On — Tap to Mute';
  } else {
    btn.classList.add('muted');
    icon.textContent = '🔇';
    label.textContent = 'MUTED — Tap to Unmute';
  }
}

// ─────────────────────────────────────────────
// LIVE COUNTDOWN
// ─────────────────────────────────────────────

function fmtTime(seconds) {
  if (seconds == null || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

let countdownInterval = null;
let lastState = null;

function applyState(state) {
  const cd      = $('countdown');
  const label   = $('cdLabel');
  const time    = $('cdTime');
  const sub     = $('cdSub');
  const barFill = $('cdBarFill');

  // Clear classes
  cd.classList.remove('active', 'upcoming', 'imminent');

  // If state is stale (>15s old), Focusmate tab is not active. Show idle.
  // Threshold accounts for: 5s broadcast interval + buffer for tab inactivity.
  const age = state ? (Date.now() - (state.ts || 0)) / 1000 : Infinity;
  const stale = age > 15;

  if (!state || state.kind === 'idle' || !state.kind || stale) {
    label.textContent = 'Status';
    time.textContent = '—';
    sub.textContent = stale && state ? 'Open Focusmate tab to resume' : 'Open Focusmate to begin';
    barFill.style.width = '0%';
    return;
  }

  if (state.kind === 'active') {
    cd.classList.add('active');
    label.textContent = '🟢 In Session';
    time.textContent = fmtTime(state.remaining);
    sub.textContent = state.total ? `${Math.round(state.total / 60)}-min session` : '';
    const pct = state.total ? Math.max(0, Math.min(100, (1 - state.remaining / state.total) * 100)) : 0;
    barFill.style.width = pct + '%';
    return;
  }

  if (state.kind === 'upcoming') {
    if (state.remaining <= 60) {
      cd.classList.add('imminent');
      label.textContent = '🔴 Starting Soon';
      sub.textContent = 'Get to your chair';
    } else {
      cd.classList.add('upcoming');
      label.textContent = '🟡 Next Session';
      sub.textContent = 'Get ready';
    }
    time.textContent = fmtTime(state.remaining);
    barFill.style.width = '0%';
    return;
  }
}

// Decrement the displayed counter locally between storage updates so the UI
// looks live. The content script broadcasts every 5 seconds (throttled for
// performance), so this local ticker fills the 1-second visual gap.
function tickCountdown() {
  if (!lastState || !lastState.remaining) return;
  // Only auto-decrement if the storage timestamp is recent (within 7s — gives
  // a 2s grace period beyond the 5s broadcast interval).
  const age = (Date.now() - (lastState.ts || 0)) / 1000;
  if (age > 7) return;
  // Re-render with elapsed seconds subtracted from the cached remaining
  const fakeState = { ...lastState, remaining: Math.max(0, lastState.remaining - Math.floor(age)) };
  applyState(fakeState);
}

function startLiveUpdates() {
  // Initial pull
  api.storage.local.get('fmcLiveState', d => {
    if (d.fmcLiveState) {
      lastState = d.fmcLiveState;
      applyState(lastState);
    }
  });

  // Listen for storage changes (1Hz from content script)
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.fmcLiveState) {
      lastState = changes.fmcLiveState.newValue;
      applyState(lastState);
    }
    if (changes.audioOn) {
      updateMuteButton(changes.audioOn.newValue);
    }
  });

  // Local tick for smoothness
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(tickCountdown, 1000);
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Pop out ──
  const isPopout = new URLSearchParams(window.location.search).get('popout') === '1';
  $('popoutBtn').style.display = isPopout ? 'none' : '';
  $('popoutBtn').addEventListener('click', () => {
    const url = api.runtime.getURL('popup.html') + '?popout=1';
    if (api.windows) {
      api.windows.create({ url, type: 'popup', width: 360, height: 700 });
    } else {
      window.open(url, '_blank', 'width=360,height=700');
    }
  });

  // ── Tabs ──
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ── Advanced collapse ──
  $('advancedToggle').addEventListener('click', () => {
    const isOpen = $('advancedToggle').classList.toggle('open');
    $('advancedContent').classList.toggle('open');
    saveSetting('advancedOpen', isOpen);
  });

  // ── Mute button ──
  $('muteBtn').addEventListener('click', () => {
    api.storage.local.get('audioOn', d => {
      const next = !(d.audioOn ?? true);
      saveSetting('audioOn', next);
      updateMuteButton(next);
    });
  });

  // ── Load settings ──
  api.storage.local.get(null, data => {
    applyUI(data);
    tasks = Array.isArray(data.fmTasks) ? data.fmTasks : [];
    render();
    if (data.fmcLiveState) {
      lastState = data.fmcLiveState;
      applyState(lastState);
    }
  });

  // ── Live countdown subscription ──
  startLiveUpdates();

  // ── Audio toggles (everything except audioOn — that's the mute button) ──
  ['tickEnabled','voiceEnabled','secondsCountdownEnabled',
   'transitionEnabled','transitionPreReminder','ambientEnabled',
   'ambientBetweenSessions','preSessionWarningEnabled'].forEach(id => {
    $(id).addEventListener('change', e => saveSetting(id, e.target.checked));
  });
  $('announcementInterval').addEventListener('change', e => saveSetting('announcementInterval', parseInt(e.target.value)));
  $('tickSound').addEventListener('change', e => saveSetting('tickSound', e.target.value));
  $('transitionSound').addEventListener('change', e => saveSetting('transitionSound', e.target.value));
  $('preSessionWarningSound').addEventListener('change', e => saveSetting('preSessionWarningSound', e.target.value));
  $('ambientSound').addEventListener('change', e => saveSetting('ambientSound', e.target.value));

  $('ambientVolume').addEventListener('input', e => {
    $('avVal').textContent = e.target.value + '%';
    saveSetting('ambientVolume', parseInt(e.target.value) / 100);
  });

  $('tickVolume').addEventListener('input', e => {
    $('tvVal').textContent = e.target.value + '%';
    saveSetting('tickVolume', parseInt(e.target.value) / 100);
    if (testAudio) testAudio.volume = parseInt(e.target.value) / 100;
  });
  $('voiceVolume').addEventListener('input', e => {
    $('vvVal').textContent = e.target.value + '%';
    saveSetting('voiceVolume', parseInt(e.target.value) / 100);
    if (testAudio) testAudio.volume = parseInt(e.target.value) / 100;
  });

  // ── Test buttons (in Advanced) ──
  $('testTickBtn').addEventListener('click', () => {
    if (testAudio) { testAudio.pause(); testAudio = null; }
    const vol = parseInt($('tickVolume').value) / 100;
    const map = { 'tick-tock':'audio/effects/tick1.mp3', 'tick':'audio/effects/tick.m4a',
                  'beep1':'audio/effects/beep1.mp3', 'beep2':'audio/effects/beep2.mp3', 'ding':'audio/effects/ding.mp3' };
    const file = map[$('tickSound').value] || 'audio/effects/tick1.mp3';
    testAudio = new Audio(api.runtime.getURL(file));
    testAudio.volume = vol;
    testAudio.play().then(() => showFb('🔊 Playing tick...')).catch(e => showFb('Error: ' + e.message));
  });

  $('testVoiceBtn').addEventListener('click', () => {
    if (testAudio) { testAudio.pause(); testAudio = null; }
    const vol = parseInt($('voiceVolume').value) / 100;
    testAudio = new Audio(api.runtime.getURL('audio/minutes/m05.mp3'));
    testAudio.volume = vol;
    testAudio.play().then(() => showFb('🗣 "5 minutes remaining"')).catch(e => showFb('Error: ' + e.message));
  });

  // ── Task events ──
  initTaskEvents();

  const taskInput = $('taskInput');
  taskInput.addEventListener('input', () => {
    taskInput.style.height = 'auto';
    taskInput.style.height = Math.min(taskInput.scrollHeight, 90) + 'px';
  });

  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = taskInput.value;
      if (!val.trim()) return;
      addFromText(val);
      taskInput.value = '';
      taskInput.style.height = 'auto';
    }
  });

  $('addBtn').addEventListener('click', () => {
    const val = taskInput.value;
    if (!val.trim()) return;
    addFromText(val);
    taskInput.value = '';
    taskInput.style.height = 'auto';
    taskInput.focus();
  });

  $('pickBtn').addEventListener('click', () => {
    const pending = tasks.filter(t => !t.done);
    if (!pending.length) return;
    pickedId = pending[Math.floor(Math.random() * pending.length)].id;
    render();
    setTimeout(() => {
      const el = $('taskItems').querySelector('.picked');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  });

  $('copyBtn').addEventListener('click', () => {
    if (!tasks.length) return;
    const text = tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.text}`).join('\n');
    const btn = $('copyBtn');
    const copied = () => {
      btn.textContent = '✓ Copied!';
      btn.classList.add('ok');
      setTimeout(() => { btn.textContent = '📋 Copy all'; btn.classList.remove('ok'); }, 2000);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(copied).catch(() => {
        fallbackCopy(text); copied();
      });
    } else {
      fallbackCopy(text); copied();
    }
  });

  $('clearBtn').addEventListener('click', () => {
    tasks = tasks.filter(t => !t.done);
    saveTasks();
    render();
  });
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

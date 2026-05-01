// popup.js — Focusmate Companion

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

  // Show/hide empty state
  if (tasks.length === 0) {
    empty.classList.add('show');
    container.innerHTML = '';
    return;
  }
  empty.classList.remove('show');

  // Build HTML string — fast and simple
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

// One event listener on the container handles ALL task actions
function initTaskEvents() {
  const container = $('taskItems');

  // Clicks (delete button + checkbox label area)
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

  // Checkbox changes
  container.addEventListener('change', e => {
    if (e.target.dataset.action !== 'toggle') return;
    const id = e.target.dataset.id;
    const t  = tasks.find(t => t.id === id);
    if (!t) return;
    t.done = e.target.checked;
    if (pickedId === id) pickedId = null;
    // Done tasks sink to bottom
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
  transitionEnabled: false, transitionPreReminder: false, transitionSound: 'chime'
};

let testAudio = null;

function applyUI(data) {
  $('audioOn').checked                 = data.audioOn                 ?? DEFAULTS.audioOn;
  $('tickEnabled').checked             = data.tickEnabled             ?? DEFAULTS.tickEnabled;
  $('voiceEnabled').checked            = data.voiceEnabled            ?? DEFAULTS.voiceEnabled;
  $('secondsCountdownEnabled').checked = data.secondsCountdownEnabled ?? DEFAULTS.secondsCountdownEnabled;
  $('transitionEnabled').checked       = data.transitionEnabled       ?? DEFAULTS.transitionEnabled;
  $('transitionPreReminder').checked   = data.transitionPreReminder   ?? DEFAULTS.transitionPreReminder;
  $('announcementInterval').value      = data.announcementInterval    ?? DEFAULTS.announcementInterval;
  $('tickSound').value                 = data.tickSound               ?? DEFAULTS.tickSound;
  $('transitionSound').value           = data.transitionSound         ?? DEFAULTS.transitionSound;

  const tv = data.tickVolume  ?? DEFAULTS.tickVolume;
  $('tickVolume').value = Math.round(tv * 100);
  $('tvVal').textContent = Math.round(tv * 100) + '%';

  const vv = data.voiceVolume ?? DEFAULTS.voiceVolume;
  $('voiceVolume').value = Math.round(vv * 100);
  $('vvVal').textContent = Math.round(vv * 100) + '%';
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
// INIT
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Pop out ──
  const isPopout = new URLSearchParams(window.location.search).get('popout') === '1';
  $('popoutBtn').style.display = isPopout ? 'none' : '';
  $('popoutBtn').addEventListener('click', () => {
    const url = api.runtime.getURL('popup.html') + '?popout=1';
    if (api.windows) {
      api.windows.create({ url, type: 'popup', width: 340, height: 580 });
    } else {
      window.open(url, '_blank', 'width=340,height=580');
    }
  });

  // ── Status ──
  try {
    api.tabs.query({ active: true, currentWindow: true }, tabs => {
      const title = tabs?.[0]?.title || '';
      const url   = tabs?.[0]?.url   || '';
      if (/until end/i.test(title)) {
        $('dot').classList.add('active');
        $('statusText').textContent = 'Active in Focusmate session';
      } else if (url.includes('app.focusmate.com')) {
        $('statusText').textContent = 'On Focusmate — join a session';
      } else {
        $('statusText').textContent = 'Open app.focusmate.com to use';
      }
    });
  } catch { $('statusText').textContent = 'Ready'; }

  // ── Tabs ──
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ── Load settings ──
  api.storage.local.get(null, data => {
    applyUI(data);
    tasks = Array.isArray(data.fmTasks) ? data.fmTasks : [];
    render();
  });

  // ── Audio toggles ──
  ['audioOn','tickEnabled','voiceEnabled','secondsCountdownEnabled',
   'transitionEnabled','transitionPreReminder'].forEach(id => {
    $(id).addEventListener('change', e => saveSetting(id, e.target.checked));
  });
  $('announcementInterval').addEventListener('change', e => saveSetting('announcementInterval', parseInt(e.target.value)));
  $('tickSound').addEventListener('change', e => saveSetting('tickSound', e.target.value));
  $('transitionSound').addEventListener('change', e => saveSetting('transitionSound', e.target.value));

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

  // ── Test buttons ──
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

  // Task input — auto-grow
  const taskInput = $('taskInput');
  taskInput.addEventListener('input', () => {
    taskInput.style.height = 'auto';
    taskInput.style.height = Math.min(taskInput.scrollHeight, 90) + 'px';
  });

  // Enter = add, Shift+Enter = newline
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

  // Pick for me
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

  // Copy all
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

  // Clear done
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

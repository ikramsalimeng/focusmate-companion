// focusmate.content.js
// Focusmate Audio Companion - Content Script
// Runs on: https://app.focusmate.com/*
//
// KEY INSIGHT: Focusmate updates document.title with the countdown timer:
//   "4:25 until end – Focusmate"
//   "1:02:14 until end – Focusmate"
// We read document.title every second — no DOM scraping needed, no class names,
// immune to React re-renders. Rock solid.
//
// Audio system mirrors Flow Club Companion by Lydia Kwag (open source).

const api = window.browserAPI || (typeof browser !== 'undefined' ? browser : chrome);

// ============================================================================
// Timer Detection — reads document.title
// Format: "4:25 until end – Focusmate"
// ============================================================================

const TITLE_TIMER_RE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+until\s+end/i;
const SESSION_TITLE_RE = /until\s+end/i;

function parseTimeToSeconds(text) {
  if (!text) return null;
  const parts = text.trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function getTimerFromTitle() {
  const title = document.title || '';
  const match = title.match(TITLE_TIMER_RE);
  if (!match) return null;
  return parseTimeToSeconds(match[1]);
}

function isInActiveSession() {
  return SESSION_TITLE_RE.test(document.title || '');
}

// ============================================================================
// Audio System — mirrors Flow Club Companion exactly
// audio/effects/tick1.mp3, tok1.mp3, tick.m4a, beep1.mp3, beep2.mp3, ding.mp3, chime.mp3
// audio/minutes/m01.mp3 … m25.mp3
// audio/seconds/s01.mp3 … s09.mp3, s10.mp3, s20.mp3, s30.mp3, s40.mp3, s50.mp3
// ============================================================================

class AudioPlayer {
  constructor() {
    this.audioCache = new Map();
    this.settings = {
      audioOn: true,
      tickEnabled: true,
      voiceEnabled: true,
      secondsCountdownEnabled: false,
      tickVolume: 0.08,
      voiceVolume: 0.3,
      announcementInterval: 5,
      tickSound: 'tick-tock',
      transitionEnabled: false,
      transitionPreReminder: false,
      transitionSound: 'chime'
    };
    this.currentTick = 0;
    this.lastPlayedCues = new Set();
    this.loadSettings();
    api.storage.onChanged.addListener((_changes, area) => {
      if (area === 'local') this.loadSettings();
    });
  }

  loadSettings() {
    api.storage.local.get(null, (data) => {
      if (data.muteAll !== undefined) {
        this.settings.audioOn = !data.muteAll;
      } else if (data.audioOn !== undefined) {
        this.settings.audioOn = data.audioOn;
      }
      if (data.tickEnabled !== undefined) this.settings.tickEnabled = data.tickEnabled;
      if (data.voiceEnabled !== undefined) this.settings.voiceEnabled = data.voiceEnabled;
      if (data.secondsCountdownEnabled !== undefined) this.settings.secondsCountdownEnabled = data.secondsCountdownEnabled;
      if (data.tickVolume !== undefined) this.settings.tickVolume = data.tickVolume;
      if (data.voiceVolume !== undefined) this.settings.voiceVolume = data.voiceVolume;
      if (data.announcementInterval !== undefined) this.settings.announcementInterval = data.announcementInterval;
      if (data.tickSound !== undefined) this.settings.tickSound = data.tickSound;
      if (data.transitionEnabled !== undefined) this.settings.transitionEnabled = data.transitionEnabled;
      if (data.transitionPreReminder !== undefined) this.settings.transitionPreReminder = data.transitionPreReminder;
      if (data.transitionSound !== undefined) this.settings.transitionSound = data.transitionSound;
    });
  }

  isExtensionContextValid() {
    try { return api.runtime?.id !== undefined; } catch { return false; }
  }

  getAudio(path, volume = 1.0, forceNew = false) {
    if (!this.isExtensionContextValid()) throw new Error('Extension context invalidated');
    if (forceNew || !this.audioCache.has(path)) {
      const audio = new Audio(api.runtime.getURL(path));
      audio.volume = volume;
      if (!forceNew) this.audioCache.set(path, audio);
      return audio;
    }
    const audio = this.audioCache.get(path);
    audio.volume = volume;
    return audio;
  }

  async playTick() {
    if (!this.settings.audioOn || !this.settings.tickEnabled) return;
    if (this.settings.tickSound === 'none') return;
    try {
      if (!this.isExtensionContextValid()) return;
      let tickFile;
      switch (this.settings.tickSound) {
        case 'tick-tock':
          tickFile = this.currentTick === 0 ? 'audio/effects/tick1.mp3' : 'audio/effects/tok1.mp3';
          this.currentTick = 1 - this.currentTick;
          break;
        case 'tick':  tickFile = 'audio/effects/tick.m4a';  break;
        case 'beep1': tickFile = 'audio/effects/beep1.mp3'; break;
        case 'beep2': tickFile = 'audio/effects/beep2.mp3'; break;
        case 'ding':  tickFile = 'audio/effects/ding.mp3';  break;
        default:
          tickFile = this.currentTick === 0 ? 'audio/effects/tick1.mp3' : 'audio/effects/tok1.mp3';
          this.currentTick = 1 - this.currentTick;
      }
      const audio = this.getAudio(tickFile, this.settings.tickVolume);
      audio.currentTime = 0;
      try { await audio.play(); } catch {
        const fresh = new Audio(api.runtime.getURL(tickFile));
        fresh.volume = this.settings.tickVolume;
        fresh.currentTime = 0;
        await fresh.play();
      }
    } catch (err) {
      if (err.message && err.message.includes('Extension context')) return;
      console.error('[Focusmate Companion] Tick failed:', err);
    }
  }

  async playVoice(path) {
    if (!this.settings.audioOn || !this.settings.voiceEnabled) return;
    try {
      if (!this.isExtensionContextValid()) return;
      const audio = this.getAudio(path, this.settings.voiceVolume, true);
      audio.load(); audio.currentTime = 0;
      try { await audio.play(); } catch {
        await new Promise(r => setTimeout(r, 100));
        audio.load(); await audio.play();
      }
    } catch (err) {
      if (err.message && err.message.includes('Extension context')) return;
      console.error('[Focusmate Companion] Voice failed:', err);
    }
  }

  async playDing() {
    if (!this.settings.audioOn || !this.settings.voiceEnabled) return;
    try {
      if (!this.isExtensionContextValid()) return;
      const audio = this.getAudio('audio/effects/ding.mp3', this.settings.voiceVolume, true);
      audio.load(); audio.currentTime = 0;
      try { await audio.play(); } catch {
        await new Promise(r => setTimeout(r, 100));
        audio.load(); await audio.play();
      }
    } catch (err) {
      if (err.message && err.message.includes('Extension context')) return;
      console.error('[Focusmate Companion] Ding failed:', err);
    }
  }

  async playTransitionCue() {
    if (!this.settings.audioOn) return;
    try {
      if (!this.isExtensionContextValid()) return;
      const soundMap = { chime: 'audio/effects/chime.mp3', ding: 'audio/effects/ding.mp3', beep1: 'audio/effects/beep1.mp3', beep2: 'audio/effects/beep2.mp3' };
      const file = soundMap[this.settings.transitionSound] || 'audio/effects/chime.mp3';
      const audio = this.getAudio(file, this.settings.voiceVolume, true);
      audio.load(); audio.currentTime = 0;
      try { await audio.play(); } catch {
        await new Promise(r => setTimeout(r, 100));
        audio.load(); await audio.play();
      }
    } catch (err) {
      if (err.message && err.message.includes('Extension context')) return;
      console.error('[Focusmate Companion] Transition failed:', err);
    }
  }

  async playPreReminderCue() {
    if (!this.settings.audioOn) return;
    try {
      if (!this.isExtensionContextValid()) return;
      const audio = this.getAudio('audio/seconds/s30.mp3', this.settings.voiceVolume, true);
      audio.load(); audio.currentTime = 0;
      try { await audio.play(); } catch {
        await new Promise(r => setTimeout(r, 100));
        audio.load(); await audio.play();
      }
    } catch (err) {
      if (err.message && err.message.includes('Extension context')) return;
      console.error('[Focusmate Companion] Pre-reminder failed:', err);
    }
  }

  resetCues() { this.lastPlayedCues.clear(); }

  async processTimerUpdate(remainingSeconds) {
    if (remainingSeconds === null || remainingSeconds < 0) return;
    const cueKey = `${remainingSeconds}`;
    if (this.lastPlayedCues.has(cueKey)) return;
    if (this.lastPlayedCues.size > 100) this.lastPlayedCues.clear();
    this.lastPlayedCues.add(cueKey);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const interval = this.settings.announcementInterval;

    // Minute announcements
    if (seconds === 0 && minutes >= 1 && minutes <= 25 && minutes % interval === 0) {
      await this.playVoice(`audio/minutes/m${String(minutes).padStart(2, '0')}.mp3`);
      return;
    }
    // Ding for long sessions (>25 min)
    if (seconds === 0 && minutes > 25 && minutes % 5 === 0) {
      await this.playDing();
      return;
    }
    // Seconds countdown
    if (this.settings.secondsCountdownEnabled) {
      if ([50, 40, 30, 20, 10].includes(remainingSeconds)) {
        await this.playVoice(`audio/seconds/s${remainingSeconds}.mp3`);
        return;
      }
      if (remainingSeconds >= 1 && remainingSeconds <= 9) {
        await this.playVoice(`audio/seconds/s${String(remainingSeconds).padStart(2, '0')}.mp3`);
        return;
      }
    }
  }
}

// ============================================================================
// Main Loop
// ============================================================================

class FocusmateAudioCompanion {
  constructor() {
    this.audioPlayer = new AudioPlayer();
    this.intervalId = null;
    this.tickIntervalId = null;
    this.lastSeenSeconds = null;
    this.sessionPhase = 'unknown';
    this.preReminderFired = false;
  }

  poll() {
    const inSession = isInActiveSession();

    if (!inSession) {
      if (this.sessionPhase !== 'waiting') {
        this.sessionPhase = 'waiting';
        this.preReminderFired = false;
        this.lastSeenSeconds = null;
        this.audioPlayer.resetCues();
        console.log('[Focusmate Companion] Not in session — waiting.');
      }
      return;
    }

    if (this.sessionPhase !== 'active') {
      this.sessionPhase = 'active';
      this.preReminderFired = false;
      console.log('[Focusmate Companion] Session active! Parsed from title:', document.title);
      if (this.audioPlayer.settings.transitionEnabled) {
        this.audioPlayer.playTransitionCue();
      }
    }

    const seconds = getTimerFromTitle();
    if (seconds === null) return;

    const hasChanged = this.lastSeenSeconds === null || this.lastSeenSeconds !== seconds;
    if (!hasChanged) return;

    if (seconds === 30 && !this.preReminderFired) {
      this.preReminderFired = true;
      if (this.audioPlayer.settings.transitionPreReminder) {
        this.audioPlayer.playPreReminderCue();
      }
    }

    this.audioPlayer.processTimerUpdate(seconds);
    this.lastSeenSeconds = seconds;
  }

  startTickInterval() {
    if (this.tickIntervalId) return;
    this.tickIntervalId = setInterval(() => {
      if (this.lastSeenSeconds !== null && this.lastSeenSeconds > 0 && this.sessionPhase === 'active') {
        this.audioPlayer.playTick();
      }
    }, 1000);
  }

  start() {
    if (this.intervalId != null) return;
    this.intervalId = setInterval(() => this.poll(), 1000);
    this.startTickInterval();
    this.poll();
  }

  stop() {
    if (this.intervalId != null) { clearInterval(this.intervalId); this.intervalId = null; }
    if (this.tickIntervalId != null) { clearInterval(this.tickIntervalId); this.tickIntervalId = null; }
  }
}

// ============================================================================
// Init
// ============================================================================

function initializeExtension() {
  try {
    if (!api.runtime?.id) {
      console.warn('[Focusmate Companion] Extension context not available');
      return;
    }
    const companion = new FocusmateAudioCompanion();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !companion.intervalId) companion.start();
    });
    window.addEventListener('pagehide', (e) => {
      if (!e.persisted) companion.stop();
    });
    companion.start();
    console.log('[Focusmate Companion] Ready. Timer source: document.title ("X:XX until end")');
  } catch (err) {
    console.warn('[Focusmate Companion] Init failed:', err.message);
  }
}

setTimeout(() => initializeExtension(), 1500);

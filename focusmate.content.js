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
// audio/minutes/m01.mp3 … m75.mp3 (covers all Focusmate session lengths: 25, 50, 75 min)
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
      transitionSound: 'chime',
      // Ambient background sound (loops during session)
      ambientEnabled: false,
      ambientSound: 'brown',  // 'brown' | 'dark' | 'rain' | 'none'
      ambientVolume: 0.15,
      // Keep ambient playing between sessions (on dashboard / waiting screens)
      ambientBetweenSessions: true,
      // 1-minute warning before next session starts
      preSessionWarningEnabled: true,
      preSessionWarningSound: 'ding'
    };
    this.currentTick = 0;
    this.lastPlayedCues = new Set();
    this.loadSettings();
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      // PERFORMANCE: skip reload when only fmcLiveState changed — that key is
      // written BY the content script itself for popup sync, not a real setting
      // change. Reloading settings on every broadcast would do a full storage
      // read every 5 seconds for nothing.
      const keys = Object.keys(changes);
      if (keys.length === 1 && keys[0] === 'fmcLiveState') return;
      this.loadSettings();
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
      if (data.ambientEnabled !== undefined) this.settings.ambientEnabled = data.ambientEnabled;
      if (data.ambientSound !== undefined) this.settings.ambientSound = data.ambientSound;
      if (data.ambientVolume !== undefined) this.settings.ambientVolume = data.ambientVolume;
      if (data.ambientBetweenSessions !== undefined) this.settings.ambientBetweenSessions = data.ambientBetweenSessions;
      if (data.preSessionWarningEnabled !== undefined) this.settings.preSessionWarningEnabled = data.preSessionWarningEnabled;
      if (data.preSessionWarningSound !== undefined) this.settings.preSessionWarningSound = data.preSessionWarningSound;
      // React to ambient changes immediately
      this._refreshAmbient();
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

  // 1-minute warning ding before the next session starts.
  // Plays a single distinctive sound. Default = 'ding' so it's audibly different
  // from in-session 'chime' transitions.
  async playPreSessionWarning() {
    if (!this.settings.audioOn || !this.settings.preSessionWarningEnabled) return;
    try {
      if (!this.isExtensionContextValid()) return;
      const soundMap = {
        ding:  'audio/effects/ding.mp3',
        chime: 'audio/effects/chime.mp3',
        beep1: 'audio/effects/beep1.mp3',
        beep2: 'audio/effects/beep2.mp3'
      };
      const file = soundMap[this.settings.preSessionWarningSound] || 'audio/effects/ding.mp3';
      // Use a slightly higher volume than tick — it needs to cut through ambient.
      const vol = Math.min(1.0, Math.max(this.settings.voiceVolume, 0.4));
      const audio = this.getAudio(file, vol, true);
      audio.load(); audio.currentTime = 0;
      try { await audio.play(); } catch {
        await new Promise(r => setTimeout(r, 100));
        audio.load(); await audio.play();
      }
      console.log('[Focusmate Companion] 1-minute warning fired.');
    } catch (err) {
      if (err.message && err.message.includes('Extension context')) return;
      console.error('[Focusmate Companion] Pre-session warning failed:', err);
    }
  }

  resetCues() { this.lastPlayedCues.clear(); }

  // ── Ambient background sound (looping) ──
  // Uses Web Audio API with TWO scheduled buffer sources that overlap by 1 second.
  // This eliminates ANY perceptible seam, even if the source MP3 isn't perfectly seamless.
  //
  // BEHAVIOR:
  // - During session: plays at ambientVolume.
  // - Between sessions (on dashboard, waiting screens): plays IF ambientBetweenSessions=true.
  //   This is the rumination-killer mode — silence is when the spirals start.
  _refreshAmbient() {
    // Called whenever settings change OR session phase changes
    const masterOff = !this.settings.audioOn || !this.settings.ambientEnabled
        || this.settings.ambientSound === 'none';
    if (masterOff) {
      this._stopAmbient();
      return;
    }
    const shouldPlay = this._sessionActive || this.settings.ambientBetweenSessions;
    if (!shouldPlay) {
      this._stopAmbient();
      return;
    }
    this._startAmbient();
  }

  setSessionActive(active) {
    this._sessionActive = active;
    this._refreshAmbient();
  }

  _getAmbientCtx() {
    if (!this._ambientCtx || this._ambientCtx.state === 'closed') {
      this._ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ambientCtx.state === 'suspended') this._ambientCtx.resume();
    return this._ambientCtx;
  }

  async _startAmbient() {
    const file = `audio/ambient/${this.settings.ambientSound}.mp3`;
    const url = api.runtime.getURL(file);

    // Already playing this file? Just update volume.
    if (this._ambientCurrent === url && this._ambientGain) {
      this._ambientGain.gain.setValueAtTime(this.settings.ambientVolume, this._getAmbientCtx().currentTime);
      return;
    }

    this._stopAmbient();
    this._ambientCurrent = url;

    try {
      const ctx = this._getAmbientCtx();

      // Fetch and decode the audio file ONCE
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Master gain node for volume control
      const masterGain = ctx.createGain();
      masterGain.gain.value = this.settings.ambientVolume;
      masterGain.connect(ctx.destination);
      this._ambientGain = masterGain;
      this._ambientBuffer = audioBuffer;

      // Crossfade duration in seconds — overlaps the END of one playback with the START of the next
      const CROSSFADE = 1.0;
      this._ambientCrossfade = CROSSFADE;
      this._ambientStopped = false;

      // Schedule the FIRST playback immediately
      this._scheduleAmbientPlayback(ctx.currentTime, true);
    } catch (err) {
      console.warn('[Focusmate Companion] Ambient setup failed (is the file in audio/ambient/?):', err.message);
      this._ambientCurrent = null;
    }
  }

  _scheduleAmbientPlayback(startTime, isFirst) {
    if (this._ambientStopped || !this._ambientBuffer) return;

    const ctx = this._getAmbientCtx();
    const buffer = this._ambientBuffer;
    const xf = this._ambientCrossfade;
    const dur = buffer.duration;

    // Create a buffer source for this playback
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Per-source gain for the fade in/out at the seams
    const fadeGain = ctx.createGain();
    source.connect(fadeGain);
    fadeGain.connect(this._ambientGain);

    // Fade in (skip on the very first one — start at full)
    if (isFirst) {
      fadeGain.gain.setValueAtTime(1.0, startTime);
    } else {
      fadeGain.gain.setValueAtTime(0.0, startTime);
      fadeGain.gain.linearRampToValueAtTime(1.0, startTime + xf);
    }

    // Fade out at the end
    const endTime = startTime + dur;
    fadeGain.gain.setValueAtTime(1.0, endTime - xf);
    fadeGain.gain.linearRampToValueAtTime(0.0, endTime);

    source.start(startTime);
    source.stop(endTime + 0.05);

    // Schedule the NEXT playback to start xf seconds before this one ends
    // (so they overlap and crossfade)
    const nextStart = endTime - xf;
    source.onended = () => {
      try { source.disconnect(); fadeGain.disconnect(); } catch {}
    };

    // Use setTimeout to schedule the next chunk well in advance
    const msUntilNextSchedule = Math.max(0, (nextStart - ctx.currentTime - 2) * 1000);
    this._ambientNextTimer = setTimeout(() => {
      this._scheduleAmbientPlayback(nextStart, false);
    }, msUntilNextSchedule);
  }

  _stopAmbient() {
    this._ambientStopped = true;
    this._ambientCurrent = null;
    this._ambientBuffer = null;
    if (this._ambientNextTimer) {
      clearTimeout(this._ambientNextTimer);
      this._ambientNextTimer = null;
    }
    if (this._ambientGain) {
      try {
        // Quick fade to silence then disconnect
        const ctx = this._getAmbientCtx();
        this._ambientGain.gain.setValueAtTime(this._ambientGain.gain.value, ctx.currentTime);
        this._ambientGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.2);
        const oldGain = this._ambientGain;
        setTimeout(() => { try { oldGain.disconnect(); } catch {} }, 300);
      } catch {}
      this._ambientGain = null;
    }
  }

  async processTimerUpdate(remainingSeconds) {
    if (remainingSeconds === null || remainingSeconds < 0) return;
    const cueKey = `${remainingSeconds}`;
    if (this.lastPlayedCues.has(cueKey)) return;
    if (this.lastPlayedCues.size > 100) this.lastPlayedCues.clear();
    this.lastPlayedCues.add(cueKey);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const interval = this.settings.announcementInterval;

    // Minute announcements — voice files exist for m01.mp3 through m75.mp3
    // Covers 25-min, 50-min, and 75-min Focusmate sessions
    if (seconds === 0 && minutes >= 1 && minutes <= 75 && minutes % interval === 0) {
      await this.playVoice(`audio/minutes/m${String(minutes).padStart(2, '0')}.mp3`);
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
    this.lastSeenSeconds = null;
    this.sessionPhase = 'unknown';
    this.preReminderFired = false;
    // 1-min pre-session warning state
    this._oneMinWarningFired = false;
    this._lastUpcomingSeconds = null;
    // Cache for the dashboard's "Starts in M:SS" element (perf)
    this._upcomingEl = null;
    this._lastDomScan = 0;
    // Session length used by the popup progress bar (25/50/75 min)
    this._sessionLengthSeconds = null;
    // Popup messaging — broadcast current state for live UI
    this._lastBroadcastState = null;
    this._lastBroadcastTs = 0;
  }

  // Detect Focusmate session length from the timer.
  // Sessions are 25, 50, or 75 minutes. The first reading after session start
  // is approximately the full duration; we snap to the nearest standard length.
  // Used ONLY for the popup progress bar — no midpoint audio.
  _detectSessionLength(remainingSeconds) {
    if (this._sessionLengthSeconds !== null) return;
    if (remainingSeconds > 60 * 60 + 5) {
      this._sessionLengthSeconds = 75 * 60;
    } else if (remainingSeconds > 35 * 60) {
      this._sessionLengthSeconds = 50 * 60;
    } else {
      this._sessionLengthSeconds = 25 * 60;
    }
  }

  // Broadcast current state to popup via storage (popup listens for changes).
  // PERFORMANCE: Storage writes have non-zero cost on every browser (especially
  // Firefox). During an active session, the timer changes every second, so naive
  // broadcasting would write to storage 60 times per minute. We throttle:
  //   - Active session: write every 5s (popup ticks locally between)
  //   - Phase transitions or upcoming session: write immediately (UX critical)
  //   - Idle: write once when phase first becomes idle, then never
  _broadcastState() {
    let state;
    if (this.sessionPhase === 'active' && this.lastSeenSeconds !== null) {
      state = {
        kind: 'active',
        remaining: this.lastSeenSeconds,
        total: this._sessionLengthSeconds || (50 * 60),
        ts: Date.now()
      };
    } else if (this._lastUpcomingSeconds !== null) {
      state = {
        kind: 'upcoming',
        remaining: this._lastUpcomingSeconds,
        ts: Date.now()
      };
    } else {
      state = { kind: 'idle', ts: Date.now() };
    }

    // Phase signature (without remaining) — changes only on phase transitions
    const phaseSig = state.kind;
    const lastPhaseSig = (this._lastBroadcastState || '').split('|')[0];
    const phaseChanged = phaseSig !== lastPhaseSig;

    // Throttle: only broadcast on phase change OR every 5 seconds
    const now = Date.now();
    const elapsed = now - this._lastBroadcastTs;
    if (!phaseChanged && elapsed < 5000) return;
    // For upcoming, also broadcast when crossing the 60s threshold (UX matters)
    // — but the throttle of 5s is fine; the audio warning fires immediately
    // regardless of broadcast.

    this._lastBroadcastState = `${phaseSig}|${state.remaining ?? ''}`;
    this._lastBroadcastTs = now;
    try { api.storage.local.set({ fmcLiveState: state }); } catch {}
  }

  // Scan the dashboard for "Starts in M:SS" countdown.
  // PERFORMANCE: Cache the matching element. Only walk the DOM when the cached
  // element is gone or stale. document.body.textContent on Focusmate's dashboard
  // serializes 50-200 KB of React-rendered text — running it every second causes
  // measurable lag on MacBook Air. Caching cuts this to a single read of one
  // element's textContent (~30 bytes).
  detectUpcomingSession() {
    if (this.sessionPhase === 'active') {
      this._oneMinWarningFired = false;
      this._lastUpcomingSeconds = null;
      this._upcomingEl = null;
      return;
    }

    // Try cached element first
    let text = null;
    if (this._upcomingEl && this._upcomingEl.isConnected) {
      text = this._upcomingEl.textContent || '';
      if (!/Starts in \d/.test(text)) {
        // Cached element no longer shows the countdown; invalidate
        this._upcomingEl = null;
        text = null;
      }
    }

    // Cache miss — find the element ONCE, then reuse it.
    // Throttle expensive re-scans to once per 3 seconds when no element is cached.
    if (text === null) {
      const now = Date.now();
      if (this._lastDomScan && (now - this._lastDomScan) < 3000) {
        // Recently scanned and found nothing — skip this tick
        if (this._lastUpcomingSeconds !== null) {
          this._oneMinWarningFired = false;
          this._lastUpcomingSeconds = null;
        }
        return;
      }
      this._lastDomScan = now;

      // Targeted scan: walk only short text-bearing elements (not the whole body).
      // Focusmate renders "Starts in M:SS" inside a small element near
      // the upcoming-session card.
      const candidates = document.querySelectorAll(
        'span, div, p, time, [class*="ountdown"], [class*="tarts"]'
      );
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        // Cheap check: leaf-ish elements only (skip giant containers)
        if (el.childElementCount > 3) continue;
        const t = el.textContent;
        if (t && t.length < 60 && /Starts in \d/.test(t)) {
          this._upcomingEl = el;
          text = t;
          break;
        }
      }

      if (text === null) {
        // No upcoming session visible
        if (this._lastUpcomingSeconds !== null) {
          this._oneMinWarningFired = false;
          this._lastUpcomingSeconds = null;
        }
        return;
      }
    }

    const match = text.match(/Starts in (\d{1,2}):(\d{2})/i);
    if (!match) {
      this._upcomingEl = null;
      return;
    }

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const total = minutes * 60 + seconds;

    // If countdown jumps back up (new session loaded), reset the fired flag
    if (this._lastUpcomingSeconds !== null && total > this._lastUpcomingSeconds + 5) {
      this._oneMinWarningFired = false;
    }

    // Fire warning when crossing into the 60-second window for the first time.
    if (total <= 60 && total > 50 && !this._oneMinWarningFired) {
      this._oneMinWarningFired = true;
      this.audioPlayer.playPreSessionWarning();
    }

    this._lastUpcomingSeconds = total;
  }

  poll() {
    const inSession = isInActiveSession();

    if (!inSession) {
      if (this.sessionPhase !== 'waiting') {
        this.sessionPhase = 'waiting';
        this.preReminderFired = false;
        this.lastSeenSeconds = null;
        this.audioPlayer.resetCues();
        this.audioPlayer.setSessionActive(false);
        console.log('[Focusmate Companion] Not in session — waiting.');
      }
      // Detect upcoming session and fire 1-min warning if applicable
      this.detectUpcomingSession();
      this._broadcastState();
      return;
    }

    if (this.sessionPhase !== 'active') {
      this.sessionPhase = 'active';
      this.preReminderFired = false;
      this._sessionLengthSeconds = null;
      console.log('[Focusmate Companion] Session active.');
      this.audioPlayer.setSessionActive(true);
      if (this.audioPlayer.settings.transitionEnabled) {
        this.audioPlayer.playTransitionCue();
      }
    }

    const seconds = getTimerFromTitle();
    if (seconds === null) return;

    // Detect session length once per session for the popup progress bar
    this._detectSessionLength(seconds);

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
    this._broadcastState();
  }

  start() {
    if (this.intervalId != null) return;
    // Single 1Hz loop handles both polling AND tick.
    // Previously had two separate setInterval calls — wasteful.
    this.intervalId = setInterval(() => {
      // Pause work entirely when tab is hidden (saves CPU on background tabs).
      // Audio scheduling for ambient is unaffected (Web Audio runs independently).
      if (document.hidden) return;
      this.poll();
      // Tick is part of the same loop now
      if (this.lastSeenSeconds !== null && this.lastSeenSeconds > 0
          && this.sessionPhase === 'active') {
        this.audioPlayer.playTick();
      }
    }, 1000);
    this.poll();
  }

  stop() {
    if (this.intervalId != null) { clearInterval(this.intervalId); this.intervalId = null; }
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

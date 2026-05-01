# Focusmate Companion

> "The ticking keeps me honest. The voice keeps me moving."

A browser extension that adds audio cues and a lightweight task list to your Focusmate sessions.

**Chrome · Firefox · Brave · Edge**

Unofficial community tool. Not affiliated with Focusmate.

Built on top of ideas from **[Flow Club Companion](https://github.com/lydiacodesdaily/flow-club-companion-focus-audio)** by [Lydia Kwag](https://www.lydiakwag.com). Her open-source work made this possible.

---

## Why

25 minutes moves faster than you think. I kept finishing sessions and realizing I'd drifted somewhere in the middle, not because I was distracted, just because I had no ambient sense of the clock. Looking at the timer only helps if you stop to look.

This extension brings time to you. A soft tick every second. A calm voice at whatever interval you pick. A task list you can prep before the session starts and check off as you go. You stay in the work.

---

## Features

**Audio**

| Feature | Description |
|---|---|
| Tick sounds | Alternating tick/tock every second while your session is running |
| Voice announcements | Spoken time updates: "10 minutes remaining" at 1, 2, 3, 5, or 10 minute intervals |
| Seconds countdown | Optional: 50s, 40s, 30s, 20s, 10s, then 9 to 1 |
| Session start chime | Audio cue when your session goes from waiting to active |
| 30s pre-reminder | Fires 30 seconds before any phase transition |

Why tick sounds work: a rhythmic pulse gives your brain a metronome to track time against without any conscious effort. Research on auditory time perception shows that people consistently estimate elapsed time more accurately when paired with regular rhythmic cues than with visual timers alone. You stop checking the clock because you can already feel it.

**Tasks**

| Feature | Description |
|---|---|
| Session task list | Add tasks before your session, check them off as you go |
| Paste multiple at once | Paste a block of text and each line becomes a task |
| Pick for me | Randomly selects an incomplete task when you can't decide |
| Copy all | Copies your task list to clipboard in one click |
| Clear done | Removes completed tasks, keeps the rest for next session |
| Persistent | Tasks survive across sessions, stored locally |

**Interface**

- Two-tab popup: Session (audio controls) and Tasks
- Pop-out button opens the companion in a separate floating window
- Live status indicator shows whether you are in an active session

---

## How it works

Focusmate updates the browser tab title with a live countdown: `"4:25 until end – Focusmate"`. The extension reads `document.title` every second. No DOM scraping. No CSS class names. No React internals. If Focusmate redesigns their UI, this keeps working.

---

## Architecture

```
manifest.json               Chrome, Brave, Edge (MV3)
manifest.firefox.json       Firefox (MV3)
focusmate.content.js        Timer detection and audio engine
popup.html / popup.js       Two-tab UI: Session and Tasks
browser-api.js              Chrome / Firefox shim
icons/                      icon16.png, icon48.png, icon128.png
audio/
  effects/    tick1.mp3, tok1.mp3, tick.m4a, ding.mp3, chime.mp3, beep1.mp3, beep2.mp3
  minutes/    m01.mp3 to m25.mp3
  seconds/    s01 to s09.mp3, s10, s20, s30, s40, s50.mp3
```

Timer regex: `/^(\d{1,2}:\d{2}(?::\d{2})?)\s+until\s+end/i`

Storage: `chrome.storage.local` / `browser.storage.local`

Permissions: `storage`, `tabs`, `windows`, `host_permissions: https://app.focusmate.com/*`

---

## Audio Files

The extension does not bundle audio. You need MP3 files matching the naming above. You can generate them with ElevenLabs, ttsmaker.com, or the Mac `say` command exported to AIFF then converted.

---

## Install

**Chrome / Brave / Edge**

```bash
git clone https://github.com/ikramsalimeng/focusmate-companion.git
cd focusmate-companion
```

1. Go to `chrome://extensions/` (or `brave://extensions/`)
2. Turn on Developer mode
3. Click Load unpacked and select this folder
4. Open `app.focusmate.com` and join a session
5. Click the icon to configure

**Firefox**

1. Go to `about:debugging#/runtime/this-firefox`
2. Click Load Temporary Add-on
3. Select `manifest.firefox.json`

If audio does not start right away, refresh the Focusmate page once after enabling.

---

## Privacy

Runs only on `https://app.focusmate.com/*`. All settings and tasks are stored locally in your browser. Nothing is sent anywhere.

---

## Contributing

PRs welcome. If Focusmate changes their title format and audio stops triggering, open an issue with the new format.

---

## Credits

**[Lydia Kwag](https://www.lydiakwag.com)** built [Flow Club Companion](https://github.com/lydiacodesdaily/flow-club-companion-focus-audio) in the open. The audio engine architecture, file naming conventions, and cross-browser approach in this project are directly inspired by her work. Go star her repo.

---

Built by **Ikram** — cybersecurity student, 3,650+ Focusmate sessions, still going. 🦁

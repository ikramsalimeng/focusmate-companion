# Focusmate Companion

> "The ticking keeps me honest. The voice keeps me moving."

Focusmate Companion is an unofficial browser extension that adds calm audio cues, ambient sound, and a lightweight task list to Focusmate sessions.

**Chrome · Firefox · Brave · Edge · Arc · Opera**

Unofficial community tool. Not affiliated with Focusmate.

Built on top of ideas from **[Flow Club Companion](https://github.com/lydiacodesdaily/flow-club-companion-focus-audio)** by [Lydia Kwag](https://www.lydiakwag.com). Her open-source work made this possible.

---

## Why I built this

Focusmate already gives structure: a start time, another person, and a fixed work block. But I kept noticing a smaller problem: I could still lose track of the session while working.

Looking at the timer only helps when you remember to look. This extension brings time awareness into the background through sound. A soft tick, spoken time updates, optional final countdowns, and quiet ambient noise help the session feel structured without forcing you to keep checking the screen.

---

## Features

### Audio cues

| Feature | Description |
|---|---|
| Tick sounds | Alternating tick/tock every second while your session is running |
| Voice announcements | Spoken time updates at 1, 2, 3, 5, or 10 minute intervals |
| Seconds countdown | Optional final countdown: 50s, 40s, 30s, 20s, 10s, then 9 to 1 |
| Session start chime | Audio cue when a session moves from waiting to active |
| 30s pre-reminder | Optional reminder 30 seconds before a phase transition |
| Ambient sound | Optional brown noise, dark noise, or rain audio during sessions |

### Task workflow

| Feature | Description |
|---|---|
| Session task list | Add tasks before your session and check them off as you work |
| Paste multiple tasks | Paste a block of text and each line becomes a separate task |
| Pick for me | Randomly chooses an incomplete task when you are stuck |
| Copy all | Copies the full task list to clipboard |
| Clear done | Removes completed tasks while keeping unfinished ones |
| Persistent storage | Tasks stay saved locally across sessions |

### Interface

- Two-tab popup: **Session** and **Tasks**
- Pop-out companion window for keeping controls visible
- Live session status indicator
- Lightweight progress display for 25, 50, and 75 minute sessions

---

## Privacy and security posture

Focusmate Companion is designed to be local-first and minimal.

- Runs only on `https://app.focusmate.com/*`
- Stores settings and tasks locally with `chrome.storage.local` / `browser.storage.local`
- No analytics
- No tracking
- No external server
- No data selling or sharing
- No `tabs` permission in the Chrome manifest

Current Chrome permissions:

```txt
storage
windows
host_permissions: https://app.focusmate.com/*
```

`storage` saves local settings and tasks. `windows` is used only for the pop-out companion window. The Focusmate host permission lets the extension detect session timing and play cues only on the Focusmate app.

See [PRIVACY.md](PRIVACY.md) for the full privacy note.

---

## How it works

Focusmate updates the browser tab title with a live countdown such as:

```txt
4:25 until end – Focusmate
```

The extension reads `document.title` on a lightweight interval and parses the countdown. It does not depend on Focusmate's React internals or private APIs.

For pre-session detection, the extension uses a targeted DOM lookup and caches the detected timer element. It avoids full-page text scanning every second.

---

## Performance notes in v1.3.0

v1.3.0 focused on cleanup, performance, and trust signals.

- Collapsed duplicate 1-second loops into one session loop
- Reduced repeated storage writes by throttling live state updates
- Skips unnecessary work when the Focusmate tab is hidden
- Avoids broad DOM text scans during pre-session detection
- Removed the Chrome `tabs` permission
- Added ambient sound support
- Added separate audio setup documentation

See [CHANGELOG.md](CHANGELOG.md) for details.

---

## Architecture

```txt
manifest.json               Chrome, Brave, Edge, Arc, Opera (MV3)
manifest.firefox.json       Firefox (MV3)
focusmate.content.js        Timer detection, state sync, and audio engine
popup.html / popup.js       Extension UI: Session and Tasks tabs
browser-api.js              Chrome / Firefox API shim
icons/                      Extension icons
audio/                      User-supplied audio assets
  effects/
  minutes/
  seconds/
  ambient/
```

Timer regex:

```js
/^(\d{1,2}:\d{2}(?::\d{2})?)\s+until\s+end/i
```

---

## Audio files

This source repo does not include audio binaries by default. The extension expects audio files in this structure:

```txt
audio/
  effects/    tick1.mp3, tok1.mp3, ding.mp3, chime.mp3, beep1.mp3, beep2.mp3
  minutes/    m01.mp3 to m75.mp3
  seconds/    s01.mp3 to s09.mp3, s10.mp3, s20.mp3, s30.mp3, s40.mp3, s50.mp3
  ambient/    brown.mp3, dark.mp3, rain.mp3
```

See [AUDIO.md](AUDIO.md) for setup instructions.

---

## Install locally

### Chrome / Brave / Edge / Arc / Opera

```bash
git clone https://github.com/ikramsalimeng/focusmate-companion.git
cd focusmate-companion
```

1. Add the required audio files into the `audio/` folders.
2. Go to `chrome://extensions/` or your Chromium browser's extension page.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder.
6. Open `https://app.focusmate.com/` and join a session.
7. Click the extension icon to configure your cues.

### Firefox

1. Add the required audio files into the `audio/` folders.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select `manifest.firefox.json`.
5. Refresh the Focusmate page after enabling.

---

## Roadmap ideas

- Replace polling with a `MutationObserver` where it can be done reliably
- Add screenshots and a short demo GIF
- Add import/export for task lists
- Add optional named task templates for recurring session types

---

## Feedback

Bug reports, ideas, and feedback are welcome.

Contact: **ikramsalim.tech@gmail.com**

---

## Credits

**[Lydia Kwag](https://www.lydiakwag.com)** built [Flow Club Companion](https://github.com/lydiacodesdaily/flow-club-companion-focus-audio) in the open. Focusmate Companion is directly inspired by that work and adapts the idea for Focusmate sessions.

---

Built by **Ikram** — cybersecurity student, Focusmate power user, and builder of small tools that make focused work easier. 🦁

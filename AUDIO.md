# Audio Files Guide

Focusmate Companion expects audio files in four folders. The public GitHub source does not include audio binaries by default so licensing stays clean.

## Folder structure

```txt
audio/
  effects/
  minutes/
  seconds/
  ambient/
```

## Required files

### Effects

```txt
audio/effects/tick1.mp3
audio/effects/tok1.mp3
audio/effects/ding.mp3
audio/effects/chime.mp3
audio/effects/beep1.mp3
audio/effects/beep2.mp3
```

### Minute announcements

```txt
audio/minutes/m01.mp3
audio/minutes/m02.mp3
...
audio/minutes/m75.mp3
```

Each file should say the matching number of minutes remaining.

### Seconds countdown

```txt
audio/seconds/s01.mp3
audio/seconds/s02.mp3
...
audio/seconds/s09.mp3
audio/seconds/s10.mp3
audio/seconds/s20.mp3
audio/seconds/s30.mp3
audio/seconds/s40.mp3
audio/seconds/s50.mp3
```

### Ambient sounds

```txt
audio/ambient/brown.mp3
audio/ambient/dark.mp3
audio/ambient/rain.mp3
```

## Good sources

You can create or source audio files from:

- Your own recordings
- Text-to-speech tools
- Mac `say` command exported and converted to MP3
- Public-domain or clearly licensed audio libraries

Only commit audio files publicly if you are sure the license allows redistribution.

## Recommended ambient volume

Start around 10 to 15 percent. The sound should sit in the background, not dominate the session.

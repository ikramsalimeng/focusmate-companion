#!/bin/bash
# generate_mac_voice.sh
# Regenerates all minute and second audio files using Mac's built-in Samantha voice.
# Quality is dramatically better than the espeak-ng versions shipped by default.
#
# How to use:
#   1. cd into the focusmate-companion folder
#   2. Run: bash generate_mac_voice.sh
#   3. Wait ~30 seconds
#   4. Reload the extension in chrome://extensions/
#
# Other voice options to try (uncomment one):
#   VOICE="Samantha"  # Default Mac female voice — natural and clear
#   VOICE="Ava"       # Newer Apple voice (Premium download in Settings > Accessibility > Spoken Content)
#   VOICE="Allison"   # Crisp female voice (Premium download)
#   VOICE="Karen"     # Australian female
#   VOICE="Daniel"    # British male
#   VOICE="Tom"       # American male

VOICE="Samantha"
RATE=180  # words per minute (default 175)

OUT_DIR="audio"
mkdir -p "$OUT_DIR/minutes" "$OUT_DIR/seconds"

echo "Generating minute files (m01 to m75) with voice: $VOICE..."
for i in $(seq 1 75); do
  num=$(printf "%02d" $i)
  if [ $i -eq 1 ]; then
    text="1 minute remaining"
  else
    text="$i minutes remaining"
  fi
  # say -> AIFF -> mp3 via afconvert (built into Mac)
  say -v "$VOICE" -r $RATE "$text" -o "/tmp/m${num}.aiff"
  afconvert -f mp4f -d aac "/tmp/m${num}.aiff" "/tmp/m${num}.m4a" 2>/dev/null
  # If you have ffmpeg installed via Homebrew, this gives mp3 directly:
  if command -v ffmpeg &> /dev/null; then
    ffmpeg -y -i "/tmp/m${num}.aiff" -codec:a libmp3lame -b:a 64k "$OUT_DIR/minutes/m${num}.mp3" 2>/dev/null
  else
    # No ffmpeg? Use the m4a file directly (browsers play it fine)
    cp "/tmp/m${num}.m4a" "$OUT_DIR/minutes/m${num}.mp3"
  fi
  rm -f "/tmp/m${num}.aiff" "/tmp/m${num}.m4a"
  printf "."
done
echo " done!"

echo "Generating seconds files..."
for sec in 50 40 30 20 10; do
  num=$(printf "%02d" $sec)
  say -v "$VOICE" -r $RATE "$sec seconds remaining" -o "/tmp/s${num}.aiff"
  if command -v ffmpeg &> /dev/null; then
    ffmpeg -y -i "/tmp/s${num}.aiff" -codec:a libmp3lame -b:a 64k "$OUT_DIR/seconds/s${num}.mp3" 2>/dev/null
  else
    afconvert -f mp4f -d aac "/tmp/s${num}.aiff" "$OUT_DIR/seconds/s${num}.mp3" 2>/dev/null
  fi
  rm -f "/tmp/s${num}.aiff"
done

# Final 9 seconds: just the number
for sec in 1 2 3 4 5 6 7 8 9; do
  num=$(printf "%02d" $sec)
  say -v "$VOICE" -r $RATE "$sec" -o "/tmp/s${num}.aiff"
  if command -v ffmpeg &> /dev/null; then
    ffmpeg -y -i "/tmp/s${num}.aiff" -codec:a libmp3lame -b:a 64k "$OUT_DIR/seconds/s${num}.mp3" 2>/dev/null
  else
    afconvert -f mp4f -d aac "/tmp/s${num}.aiff" "$OUT_DIR/seconds/s${num}.mp3" 2>/dev/null
  fi
  rm -f "/tmp/s${num}.aiff"
done

echo "Done. $(ls $OUT_DIR/minutes | wc -l | tr -d ' ') minute files, $(ls $OUT_DIR/seconds | wc -l | tr -d ' ') second files."
echo "Now go to chrome://extensions/ and click the refresh icon on Focusmate Companion."

# You Just Invented the Bridge – 3D animated short

A vertical 9:16 video, 1080×1920 at 30 fps, **61.5 s** long. It mixes 3D (three.js) with 2D cartoon overlays and kinetic captions.
The script, characters and scenes are original: a comedy about inventing the bridge one fix at a time.

**Video:** [`output/River_Bridge_3D_vertical.mp4`](output/River_Bridge_3D_vertical.mp4)

## Characters
- **Hero**: a bearded guy with an orange cap, a green hoodie and white sneakers.
- **Neighbour**: a woman in a purple dress with a hair bun, plus her **goat**.
- A **blue pickup truck**, and a **pizza shop** on the far bank (the reason for crossing).

## Story beats (all synced to word timings)
Pizza dream → can't swim → stepping stones (PLOP, HOP, SPLASH) → chop a giant tree (CHOP, CRASH) → tightrope walk on the
spinning log → a second log and planks (BANG/TAP) → truck makes the middle sag (CREAK) → posts hammered into the riverbed and a cap
beam (THUNK, shorter-span brackets, light bulb) → the current makes it sway → diagonal braces (triangle highlight, SOLID!) →
the goat falls off (SPLOOSH) → railings → confetti, "YOU INVENTED THE BRIDGE!", and the truck drives to the pizza shop.

## Audio
- **Voice:** ElevenLabs `eleven_v4`, cartoon character voice *Stevie – The Living Cartoon* (`IvUJKFyjVb5hItY9dJAT`). Script: `script.txt`.
  `src/prep_voice.py` caps pauses at 0.3 s, applies a 1.09× pitch-preserving tempo so the narration fits about 60 s, places it at 0.6 s and transcribes word timings (`audio/voice/segments.json`) with Whisper-small.
- **SFX only, with no background music and no constant water ambience:** plops, splashes, chops, a tree crash, creaks, hammering, an engine,
  clangs, a goat bleat and a fanfare. All of it is synthesised in `src/build_audio.py`, ducked under the voice and normalised to −14 LUFS.

## Rebuild
```bash
npm install
python3 src/prep_voice.py audio/voice/voiceover_cartoon.mp3 <whisper-small-ct2-dir>
python3 src/build_audio.py
node src/render.js                 # or: node src/render.js --stills 12,34.8,54
```

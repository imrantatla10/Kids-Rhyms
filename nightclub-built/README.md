# You Just Built a Nightclub – realistic-style 3D CGI short

A vertical 9:16 video, 1080×1920 at 30 fps, **65.5 s** long, in English, with **no captions** and no 2D graphics.
The script is original (`script.txt`). It covers the same topic as the reference in new wording, and it opens with an aggressive hook.

**Video:** [`output/Nightclub_Built_3D_vertical.mp4`](output/Nightclub_Built_3D_vertical.mp4)

## Scenes
Lights off / music up: a low, ultra-wide push-in through the crowd as the lights and LED floor snap on → a wide sweep over the packed floor →
the fire in a corner and an overhead cutaway of the crowd jamming one exit → the bouncer and a close-up of his tally clicker → a teen with his brother's ID →
the UV/IR ID scanner (green tick vs red cross) → an aerial of the club network lighting up → the smoking area where friends slip back in → a UV hand stamp glowing under the lamp →
the alley fire exit pushed open → the alarm, the music cutting out and the white work lights → a fight and a smashed pint (glass shards) → a polycarbonate cup bending and bouncing →
the bouncer's body cam with its record LED → the velvet rope, cloakroom and bar → a crane out over the club.

## Audio
- **Voice:** ElevenLabs `eleven_v4`, **Dan – Energetic & Conversational** (`DocU7Uj0kVTnVkg4D1PG`), 61.4 s at natural speed.
- **Sound design** (`src/build_audio.py`): an in-world house track that is loud inside, muffled outside, and cut dead at "instantly". The SFX are a power-on thud, fire crackle,
  clicker clicks, scanner beeps and a reject buzz, network pings, a lighter, a stamp, the fire-exit push bar, an alarm bell, a glass smash, plastic bounces and a body-cam beep. There is no separate background score.

## Rebuild
```bash
npm install
VOICE_START=0.4 MAX_GAP=0.5 VOICE_LEN=64.0 python3 src/prep_voice.py audio/voice/voiceover_dan.mp3 <whisper-small-ct2-dir>
python3 src/build_audio.py
node src/render.js
```

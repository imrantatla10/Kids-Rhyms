# Your Hands Can Save a Life (CPR) – 3D explainer short

A vertical 9:16 video, 1080×1920 at 30 fps, **65.5 s** long, with **no captions**.
It is a 3D (three.js) living-room scene with stylised characters, an X-ray heart and brain, a void-set heart close-up, soft bloom and 2D icons.
The script is original (`script.txt`). The topic is the same as the reference, and the facts follow standard hands-only CPR guidance:
100–120 compressions a minute, about 2 in (5 cm) deep, call emergency services, and use an AED.

**Video:** [`output/CPR_Your_Hands_3D_vertical.mp4`](output/CPR_Your_Hands_3D_vertical.mp4)

## Hook (first ~8 s)
A low wide push-in as a man collapses, an overhead spinning shot with a flatline, then an X-ray brain close-up with a 4:00 countdown and an 8:00 ambulance timer.
"What you do next…" pushes in on the rescuer kneeling.

## Audio
- **Voice:** ElevenLabs `eleven_v4`, *Jesse – Animation Character, Friendly* (`rLl4PSDTzX3VHL4wjSFI`), 61.3 s at natural speed.
- **SFX only, with no music:** heartbeats, a body thud, a flatline tone, clock ticks, a distant and an arriving siren, electrical zaps, compression thumps at 110 bpm,
  phone dial tones, the AED charge and shock, monitor beeps and a final ding. All of it is synthesised in `src/build_audio.py`.

## Rebuild
```bash
npm install
VOICE_START=0.3 MAX_GAP=0.45 VOICE_LEN=62.5 python3 src/prep_voice.py audio/voice/voiceover_jesse.mp3 <whisper-small-ct2-dir>
python3 src/build_audio.py
node src/render.js
```

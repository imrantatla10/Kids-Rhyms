# Diverging Diamond – 3D explainer short

A vertical 9:16 video, 1080×1920 at 30 fps, **65 s** long, with **no captions** (they'll be added later).
It is a 3D (three.js) highway interchange with wide aerial camera work and 2D icon overlays only: warnings, signal icons, a check mark, a diamond outline, map pins and a crash chart.
The script is original (`script.txt`). It covers the same topic as the reference (how a diverging diamond interchange works) in new wording.

**Video:** [`output/Diverging_Diamond_3D_vertical.mp4`](output/Diverging_Diamond_3D_vertical.mp4)

## Beats
Normal diamond interchange → left turn across oncoming traffic and a crash → green arrow, three light cycles and a queue over the bridge →
the lanes flip to the wrong side (they cross in an X before the bridge) → an easy left onto the on-ramp → "diverging diamond" outline →
headlights side by side, so a centre wall rises → crossover signals take turns (two phases instead of three) → a protected walkway with pedestrians →
the map pin (Springfield, MO, 2009), then 200+ pins → the crash bar halves → painted arrows, stay-in-lane signs and confused drivers → confetti and a final aerial.

## Audio
- **Voice:** ElevenLabs `eleven_v4`, *Jesse – Animation Character, Friendly* (`rLl4PSDTzX3VHL4wjSFI`).
  `src/prep_voice.py` caps pauses at 0.28 s and applies a 1.14× pitch-preserving tempo so the narration fits 65 s.
  It also gets word timings with Whisper-small.
- **Music + SFX:** an original light 112 BPM groove, ducked under the voice. Sound effects include traffic pass-bys, honks, a tyre screech and crash,
  signal clicks, whooshes, a wall thud, footsteps, pin pops, spray paint and a fanfare. All of it is synthesised in `src/build_audio.py`.

## Rebuild
```bash
npm install
VOICE_START=0.4 MAX_GAP=0.28 VOICE_LEN=63.4 python3 src/prep_voice.py audio/voice/voiceover_jesse.mp3 <whisper-small-ct2-dir>
python3 src/build_audio.py
node src/render.js
```

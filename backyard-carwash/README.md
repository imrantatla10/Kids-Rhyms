# You Just Built a Car Wash – realistic-style 3D CGI short

A vertical 9:16 video, 1080×1920 at 30 fps, **64.5 s** long, in English, with **no captions** and no 2D graphics.
The script is original (`script.txt`) and builds a backyard car wash one fix at a time, starting with an aggressive hook.

**Video:** [`output/Backyard_Car_Wash_3D_vertical.mp4`](output/Backyard_Car_Wash_3D_vertical.mp4)

## Scenes
Hook: a fast low push-in through the sprinkler spray at a filthy sedan → the yard turns to mud → a tyre macro →
the concrete slab pour and slope → drain grate, pipe and buried tank in cutaway → the sprinkler only soaks the roof →
the steel nozzle arch is built and rolls on rails → water everywhere → a grease macro → the soap tank and foam pass → the pump and high-pressure rinse →
a clean hero shot → water spots → a macro of a bead evaporating into a mineral ring → the RO filter → the final rinse pass → the blowers → a crane-up finale.

## Look
PBR clear-coat paint driven by a shader with dirt, foam, wetness and mineral-spot layers. The arch sweeps clean the paint as it passes.
There are instanced grass blades, procedural grass, concrete and mud textures, a house, fence and trees, soft sun shadows, spray particles, mist and foam.

## Audio
- **Voice:** ElevenLabs `eleven_v4`, *Jesse – Animation Character, Friendly* (`rLl4PSDTzX3VHL4wjSFI`), 61.3 s at natural speed.
- **SFX (no water sounds, voice boosted, mix at −12 LUFS):** the concrete pour, metal clanks, the arch rolling, the foam cannon, the pump motor,
  the high-pressure jet, drips, RO hum, blowers and a final ding. All of it is synthesised in `src/build_audio.py`. There is no music.

## Rebuild
```bash
npm install
VOICE_START=0.25 MAX_GAP=0.45 VOICE_LEN=62.0 python3 src/prep_voice.py audio/voice/voiceover_jesse.mp3 <whisper-small-ct2-dir>
python3 src/build_audio.py
node src/render.js
```

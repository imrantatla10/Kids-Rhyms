# The Magic Animal Train – Learn Your ABCs! 🚂

A vertical (9:16, 1080×1920, 30 fps) **64-second** kids' learning video:
animal names + alphabet **A–F**.

**Video:** [`output/The_Magic_Animal_Train_ABC_vertical.mp4`](output/The_Magic_Animal_Train_ABC_vertical.mp4)

## Characters
- **Tilly** – a cute yellow train with big cartoon eyes (red roof, blue wheels)
- **Benny Bear**, **Ellie Elephant**, **Freddie Fox**, plus an Alligator, a fluffy Cat and a dancing Dog

## Storyboard
| Time | What happens |
|------|--------------|
| 0–10 s | Tilly arrives at the Magic Station and waves; title "The Magic Animal Train – Learn Your ABCs!" |
| 10–20 s | An alligator appears beside the railway, big bouncing **A**, hops into carriage 1 |
| 20–30 s | Benny Bear jumps into the second carriage, **B** bounces in |
| 30–40 s | A fluffy cat and a dancing dog, **C** and **D** spin in |
| 40–48 s | Ellie Elephant and Freddie Fox join, **E** and **F** glow |
| 48–59 s | Everyone dances while the train runs through a rainbow tunnel (song) |
| 59–64 s | Recap A-B-C-D-E-F, "Great job!", "Bye bye!" |

Learned letters collect in a progress row at the top, and big captions follow the narration.

## Audio
- **Voice:** ElevenLabs (`eleven_v4`), voice *Holly – Engaging Children's Storyteller*
  (cheerful female children's storyteller). Clips: `audio/voice/`.
- **Music & SFX:** original nursery-pop at 120 BPM, synthesised in `src/build_audio.py`:
  bells, oom-pah bass, rhythmic claps, shaker/train chug, train whistles, sparkle chimes
  on each letter, boings on each jump. The music ducks under the voice.

## Rebuild
```bash
pip install pycairo numpy
# fonts: Luckiest Guy (Google Fonts) must be installed for fontconfig
python3 src/build_audio.py     # -> audio/final_mix.wav
python3 src/render_video.py    # -> output/The_Magic_Animal_Train_ABC_vertical.mp4
python3 src/render_video.py --stills 5,15,52   # quick PNG previews
```
Scene timings live in `src/timeline.py`.

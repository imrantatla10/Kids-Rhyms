# The Car Vending Machine – 3D animated short

A vertical 9:16 video, 1080×1920 at 30 fps, **66 s** long. It mixes 3D animation (three.js, real-time
lighting, shadows and reflections) with 2D cartoon overlays such as comic bursts, icons, arrows, confetti and kinetic captions.

**Video:** [`output/Car_Vending_Machine_3D_vertical.mp4`](output/Car_Vending_Machine_3D_vertical.mp4)

## Characters & set
- **The owner**: a 3D cartoon guy with posed arms and legs, eyes, brows and a mouth that changes shape.
- **20 toy-style cars**, each a different colour. The favourite is the red car on the top floor, and **B7** is the yellow car.
- A garden with a house, a picket fence, trees and a street. There is a steel tower with 10 floors × 2 bays, a centre lift, wheel clamps,
  a turntable, a glass skin, LED shelf lights, a keypad pillar and a neon "CAR VENDING" sign.
- Birds that build nests. The day turns to night with a starry sky and a moon.

## Storyboard (synced to the voiceover)
| Time | Narration | Visuals / camera |
|------|-----------|------------------|
| 0–4.5 | "If you own 20 cars, but no garage…" | A crane shot descends over the garden as 20 cars drop into a pyramid. 2D "×20" counter and a crossed-out garage icon |
| 4.5–7.3 | "…get crushed." | Push-in on the pile. The bottom rows squash, with a CRUNCH! burst and camera shake |
| 7.3–11 | "So you build a steel tower…" | Low-angle orbit. Columns grow, shelves pop in and every car flies to its own shelf |
| 11–14.5 | "…starts sinking into your lawn." | Ground-level side shot. The tower sinks and tilts, with dust and red down-arrows. The owner panics |
| 14.5–18.1 | "…dig a giant hole… concrete." | High angle. The tower lifts, dirt flies, the pit opens, a concrete chute fills it, and the tower lands with a THUD |
| 18.1–21.7 | "…gust of wind… roll right off its shelf." | 2D wind swirls and bending trees. A car rolls to the edge and teeters |
| 21.7–25.5 | "…steel arms that grab every wheel…" | Close-up. Yellow clamps snap onto the wheels (CLICK! ×4) and a lock icon appears |
| 25.5–28.7 | "…favourite car is on the top floor… no ladder." | Worm's-eye view past the owner, with a heart over the red car and a crossed-out ladder icon |
| 28.7–33.5 | "…lift in the middle… pulls your car onto it." | The camera rides up with the lift, the grabber extends (GRAB!) and the car slides onto the lift |
| 33.5–35.9 | "But it comes down facing your house." | Front shot. The car's nose points at the house (dashed 2D arrow) and the owner shows a "?" |
| 35.9–39.2 | "…spinning floor… toward the street." | The turntable pops up and spins 180° (2D spin arrow). VROOM!, and the car drives off |
| 39.2–41.8 | "But birds start building nests…" | Birds fly in and land, and nests with eggs grow on the roofs (TWEET!, music notes) |
| 41.8–46.4 | "…wrap the whole tower in glass… light it up shelf by shelf." | Wide hero shot. The glass rises with a shine sweep, day turns to night and the floors light up one by one |
| 46.4–48.6 | "But you forget which car is where." | The owner scratches his head under a cloud of "?" marks |
| 48.6–53.2 | "…giant keypad. You type B7…" | The keypad rises. Close-up of B and 7 being pressed, then the lift fetches the yellow car |
| 53.2–57.4 | "…stuck halfway… like a chocolate bar." | Dutch angle on the car hanging off the shelf. STUCK!, a flashing ERROR and a 2D vending-machine inset |
| 57.4–60.7 | "So you do what everyone does. You kick the tower." | The owner walks up and rolls up his sleeves, then kicks: BONK!, a flash and a shake. The car drops onto the lift (CLUNK!) and comes down |
| 60.7–66 | "Congratulations! … car vending machine!" | Confetti, a star burst and a cheer. The camera pulls back to a night hero shot as the neon sign lights up, with the title card and "INSERT COIN" |

## Audio
- **Voice:** the supplied voiceover (`audio/voice/voiceover_original.mp3`, 77.6 s). `src/prep_voice.py` caps
  pauses at 0.2 s and applies a pitch-preserving 1.11× tempo, so the narration fits 66 s. Word timings came from
  a local Whisper-small transcription (`audio/voice/segments.json`), and they drive the captions and the scene cuts.
- **Music & SFX:** an original 112 BPM comedy groove synthesised in `src/build_audio.py`. It uses pizzicato, marimba, bass and drums,
  with a music-box section at night and a fanfare at the end. More than 40 cartoon SFX play, including thuds, crunch, clangs, rumble, digging, a concrete pour,
  wind, clicks, lift motors, a vroom, tweets, a glass shimmer, light switches, keypad beeps, an error buzz and the kick.
  The music ducks under the voice, and the mix is loudness-normalised to −14 LUFS.

## Rebuild
```bash
npm install                      # three.js + fonts (Luckiest Guy, Fredoka)
python3 src/prep_voice.py        # -> audio/voice/voice_tight.wav + segments.json
python3 src/build_audio.py       # -> audio/final_mix.wav
node src/render.js               # headless Chromium (Playwright) -> output/frames -> output/*.mp4
node src/render.js --stills 6.5,30,59.5   # quick previews in output/stills
```
Every frame is a pure function of time (`window.renderFrame(t)` in `src/scene.js`). That keeps rendering deterministic, and it
runs in parallel across `WORKERS` browser instances.

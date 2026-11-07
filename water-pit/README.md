# Sports Cars vs Giant Water Pit 🏎️💦

A vertical (9:16, 1080×1920, 30 fps) **60-second** survival-mode crash video. It is
rendered from a code-built 3D scene with synthesised sound effects. There is no
voiceover, no music and no AI video service.

**Video:** [`output/Sports_Cars_vs_Water_Pit_vertical.mp4`](output/Sports_Cars_vs_Water_Pit_vertical.mp4)

## Structure
| Time | What happens |
|------|--------------|
| 0:00–0:06 | **Hook:** flash-forward of the school bus smashing into the pit in slow motion. On screen: "CAN ANY CAR SURVIVE?" then "WATCH TILL THE END!" |
| 0:06 | White flash, "LET'S GO!", back to the start |
| 0:06–0:56 | 8 vehicles, one after another (see below) |
| 0:56–1:00 | End card: "SURVIVORS 0 / 8", "THE WATER PIT WINS!", "WHICH CRASH WAS THE BEST? COMMENT 1 - 8!" |

Each vehicle gets:
1. a **chase camera** behind it as it races down the hill, with its name card and speed;
2. a cut with a white flash to an **impact camera** (front corner over the barrier
   wall, side, or overhead) in **slow motion**, with a push-in and impact shake;
3. a **CRASHED xx%** meter at the top counting up, then a **WRECKED!** stamp.

The school bus and the semi get two impact angles each.

## HUD
A **SURVIVAL MODE** badge, the title, the car counter (CAR 3/8), an alive counter
(ALIVE 5/8), the crash % meter and bar, a name card with speed, the WRECKED stamp,
a SLOW-MO tag and the end card.

## Obstacle
A concrete water pit cut across the road, filled with translucent water. A
hydraulic steel launch ramp rises on pistons as each vehicle arrives. A
concrete crash-barrier wall with red-and-white and hazard stripes stands on the
far side, and two rusty paddle wheels churn the water. Chains hang between bollards
along the sides. Splashes throw droplets, foam and ripple rings.

## Convoy (crash order)
| # | Vehicle | Colour | Damage |
|---|---------|--------|--------|
| 1 | Sports coupe | red | 78% |
| 2 | Roadster | royal blue | 84% |
| 3 | Hot hatch | lime green | 91% |
| 4 | Supercar with rear wing | orange | 88% |
| 5 | **School bus** (star) | school-bus yellow | 97% |
| 6 | Muscle car with stripes | hot pink | 86% |
| 7 | Grand tourer (lands on the bus) | pearl white | 93% |
| 8 | Car-carrier semi (biggest, last) | green cab, gray trailer | 100% |

## Sound effects (`src/build_audio.py`)
Engines, the hydraulic ramp whine and clank, the bus horn and semi air horn, metal and
glass crashes, big water splashes with droplets and bubbles, debris, chains, and
the paddle-wheel churn. On top sit camera-cut whooshes, slow-motion sub booms, the
hook riser, damage-counter ticks, the WRECKED stamp hits and the end-card chime.

## Rebuild
```bash
npm install
node src/render.mjs --stills 2.4,10.3,33.6     # previews (output seconds)
node src/render.mjs --events                   # -> audio/events.json
python3 src/build_audio.py                     # -> audio/final_mix.wav
node src/render.mjs --workers 4                # -> output/video_silent.mp4
ffmpeg -i output/video_silent.mp4 -i audio/final_mix.wav -c:v libx264 -crf 21 -preset slow \
       -c:a aac -b:a 192k -shortest output/Sports_Cars_vs_Water_Pit_vertical.mp4
```
- `src/timeline.js`: the hook, crash times, slow-motion windows and the time mapping.
- `src/sim.js`: the scene, vehicles, deformation, water effects, simulation, camera director and HUD.

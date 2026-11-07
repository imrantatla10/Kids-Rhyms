# Cars & School Bus vs Chained Crushers 🚌💥

A vertical (9:16, 1080×1920, 30 fps) **64-second** crash-simulation video. It is
rendered from a code-built 3D scene and mixed with synthesised sound effects.
There is no voiceover, no music and no AI video service.

**Video:** [`output/Cars_School_Bus_vs_Chained_Crushers_vertical.mp4`](output/Cars_School_Bus_vs_Chained_Crushers_vertical.mp4)

## Look
- Wide shot: a high-angle camera behind the obstacle, looking up a straight
  two-lane country road (yellow dashed centre line) that climbs a long grassy hill
  to the horizon. Pine trees, telephone poles with power lines, and a radio tower.
- **Obstacle:** two giant brushed-steel drums with red-and-white striped ends,
  spinning against each other on iron A-frames with concrete plinths. Heavy rusty
  chains are stretched across the road between them and swing on every hit.
- Soft-body-style crumpling: fronts fold, roofs dent, tyres squash and splay, and
  the bus buckles. Bumpers, wheels, doors, the stop arm and the roll-up door break
  off. Glass shatters into shards, and dust puffs and settles. All wreckage stays
  where it lands.
- Title fixed at the top: **CARS & SCHOOL BUS / VS CHAINED CRUSHERS**.

## Camera, slow motion and transitions
For every crash the camera:
1. **zooms in** from the wide shot to a low close-up beside the impact point (0.45 s swoop);
2. drops into **slow motion** (0.3x for cars, 0.25x for the bus and box truck) with
   a white flash, a slow push-in and an orbit while the body and tyres crush;
3. shakes on impact;
4. **zooms back out** to the wide shot to show the growing pile-up.

The school bus and the box truck get two angles each: a low side view, then a high
view looking down over the pile.

## Convoy (crash order)
| # | Vehicle | Colour | Hit (video time) |
|---|---------|--------|------------------|
| 1 | City microcar | red | 0:04 (hits the drums) |
| 2 | Compact hatchback | royal blue | 0:10 |
| 3 | Compact sedan | orange | 0:16 |
| 4 | Station wagon with roof rack | green | 0:22 |
| 5 | **School bus** (star) | school-bus yellow | 0:30 |
| 6 | Minivan | pink | 0:40 |
| 7 | Lifted pickup with bull bar | white | 0:46 |
| 8 | Box truck (biggest, last) | orange cab / white box | 0:53 |

## Sound effects (`src/build_audio.py`)
All synthesised with numpy from the simulation's event log (`audio/events.json`):
engines that grow louder as each vehicle approaches, the bus horn and truck air
horn, crunching metal, the drum clang, glass shatter and tinkles, debris bouncing,
chain clanks, the crushers' rumble, scraping as the pile is shoved and wind.
Whooshes mark each camera zoom in and out and each slow-motion start, and a sub
boom sits under every impact.

## Rebuild
```bash
npm install                                  # three.js
node src/render.mjs --stills 5,27.5,50       # quick JPEG previews (seconds)
node src/render.mjs --events                 # -> audio/events.json
python3 src/build_audio.py                   # -> audio/final_mix.wav
node src/render.mjs --workers 4              # -> output/video_silent.mp4 (headless Chromium + ffmpeg)
ffmpeg -i output/video_silent.mp4 -i audio/final_mix.wav -c:v copy -c:a aac -b:a 192k -shortest \
       output/Cars_School_Bus_vs_Chained_Crushers_vertical.mp4
```
- `src/sim.js`: scene, vehicles, deformation, debris and the fixed-step simulation. It is deterministic, so parallel workers stay in sync.
- `src/timeline.js`: crash times, the slow-motion windows and the mapping between video time and simulation time.
- The camera director (`direct()` in `src/sim.js`) plans each close-up from the crash timeline.

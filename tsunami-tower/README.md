# How to Build a Tsunami Tower 🌊🏗️

A vertical (9:16, 1080×1920, 30 fps) **65-second** 3D explainer in a "build it from
zero" style. Each failed idea leads to the next fix, until you have a real
tsunami tower.

**Video:** [`output/Tsunami_Tower_vertical.mp4`](output/Tsunami_Tower_vertical.mp4)

## Voiceover
- **ElevenLabs**, voice *Dan - Energetic & Conversational* (`eleven_v4`), **take 2**
  (`audio/vo_take2.mp3`, the take the user picked).
- `src/prep_vo.py` finds the pauses in the audio, shortens any longer than 0.18 s
  to 0.12 s, then time-stretches about 1.15× (pitch kept) so the voice ends at
  63.4 s. Output: `audio/vo.wav`.
- Word timestamps come from ElevenLabs Scribe (`audio/words_take2.json`) and are
  remapped onto that edit in `src/timing.json`. They drive the scene cuts and the
  word-by-word captions.

## Story beats (one scene per line)
1. A hole in the sand fills like a bathtub, and the worker scrambles out.
2. "GO UP": a sand hill gets washed away.
3. A solid concrete tower takes the full push of the wave and cracks.
4. The ground floor is left open and water flows through: **TSUNAMI TOWER**.
5. Scour digs sand from under the columns. A cutaway shows piles driven through
   the sand into hard clay.
6. Boats and cars smash into square columns, then slide past thick round ones.
7. A **MINUTES OF WARNING** countdown and a slow ladder lead to a wide spiral
   ramp the family runs up.
8. A **3-story house** for scale, then the roof rises **+30%** above the biggest
   wave (dimension lines on screen).
9. **SEA PULLS BACK → DON'T LOOK. RUN UP!**
10. The ground floor is **empty on purpose**, so the wave goes right through.
11. A blanket, a radio and a crab on the roof, then **CONGRATULATIONS!**

## Visuals
Code-built three.js scene:
- **Beach:** a deforming sand heightfield (hole, hill, erosion, scour).
- **Water:** one surface covering both the sea and the tsunami fronts, with foam
  and spray.
- **Characters:** a worker (orange hoodie, hard hat) and a family.
- **Structures:** the solid tower that cracks and splits, the open tsunami tower
  (columns, piles, spiral ramp, rising roof), a 3-story house, boats and cars.
- **Camera:** moves in every scene, and most scenes cut between a close angle and a wide angle
  aimed at what the line is about (`WFOCUS` in `src/scene.js`), with a slow push-in.
- **Graphics:** callout tags, banners, a timer, big numbers, dimension lines and
  captions.

## Audio
The final mix is **voiceover only**. `src/build_audio.py` still contains the
synthesised effects, but they are not mixed in.

## Rebuild
```bash
npm install
python3 src/prep_vo.py                       # -> audio/vo.wav + src/timing.json
node src/render.mjs --stills 3,25,54          # previews (seconds)
python3 src/build_audio.py                    # -> audio/final_mix.wav
node src/render.mjs --workers 4               # -> output/video_silent.mp4
ffmpeg -i output/video_silent.mp4 -i audio/final_mix.wav -c:v libx264 -crf 21 -preset slow \
       -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -shortest output/Tsunami_Tower_vertical.mp4
```

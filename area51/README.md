# How to Hide a Secret Plane (Area 51) — 3D cinematic (vertical 9:16)

1080×1920, 30 fps, **63.7 s** (limit was 65 s). No background music.

**Video:** [`output/Area51_Secret_Plane_vertical.mp4`](output/Area51_Secret_Plane_vertical.mp4)

- **Voice:** ElevenLabs, voice *Adam* (premade, American), model `eleven_v4`, take 2. Pauses longer than 0.36 s were shortened (2.2 s saved in total; the animation was timed on take 1 and is time-warped to take 2 using `audio/warp_take2.json`) → `audio/voice_adam.mp3`. Phrase timings are in `audio/chunks.json`. ElevenLabs was used for the voice only.
- **Visuals:** everything is procedural, built in three.js and rendered headless with Playwright. That covers:
  - the desert terrain, whose ring of mountains rises on cue
  - the hangar, runway, warning signs and boundary posts
  - an original faceted stealth plane and a conventional plane
  - the photographer, hiker, guards and townspeople, plus the white patrol trucks
  - a radar station with wave and beam visuals, a cut-away sand sensor, and the underground base
  - the satellite over a procedural Earth, the town at night, and the HUD, radar scope and captions
- **Sound:** synthesized natural effects only (`src/build_audio.py`). There's no music.

## Script (tightened to fit 65 s)
> Hide a secret plane in a desert shed, and you have Area 51.
> But people sneak in for photos. So you put up signs: cross this line, and the guards will shoot.
> But on flat desert, your shed is visible for miles. So you build it in a valley, walled in by mountains, like the sides of a bowl.
> But the desert is too big to fence. So you bury sensors that feel every footstep, and white trucks are waiting before anyone reaches the top.
> But radar can spot your plane. So you build it flat, with sharp angles. Radar bounces away, and never comes back. This is a stealth plane.
> But cameras in space see the whole valley. So the plane hides all day, and flies only at night. And the real base goes underground, where no camera sees through rock.
> But at night, the next town sees a strange flat shape slide across the stars. They say they saw a UFO, and nobody believes them.
> So the more people see your plane... the better hidden it is.

## Shot list (named shots in `src/scene.html`)
`shed` → `doors` (AREA 51 title) → `snoop` (photographer, shutter) → `signs` → `line` → `flat` → `tele` (VISIBLE FOR MILES) → `rise` (mountains grow) → `blocked` (LINE OF SIGHT BLOCKED) → `fence` → `sensor` (cut-away, FOOTSTEP DETECTED) → `trucks` (INTERCEPT READY) → `radar` (scope: CONTACT) → `reveal` (faceted edges) → `bounce` (scope: NO CONTACT) → `hero` (STEALTH PLANE) → `sat` (satellite over Nevada) → `daynight` (time-lapse) → `under` (lift into the cavern) → `town` → `ufo` (UFO?!) → `final`.

## Rebuild
Uses the three.js install from `../house-fire` (`node_modules` symlink; run `npm install` there first).
```bash
pip install numpy scipy
python3 src/build_audio.py                          # -> audio/final_mix.wav
node src/render.mjs --range 0-480                   # frames -> output/frames (run 4 ranges in parallel)
ffmpeg -framerate 30 -i output/frames/f%05d.jpg -i audio/final_mix.wav -c:v libx264 -b:v 10000k -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -t 63.5 output/Area51_Secret_Plane_vertical.mp4
node src/render.mjs --size 540x960 --stills 16.5,26.8,47.5   # quick previews
```

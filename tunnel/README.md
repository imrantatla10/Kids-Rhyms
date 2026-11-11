# How to Build a Jungle Tunnel Base — 3D cut-away explainer (vertical 9:16)

1080×1920, 30 fps, **60.8 s** (limit was 65 s). Bright daylight with clear graphics. No background music and no continuous background noise: only effects tied to specific moments.

**Video:** [`output/Jungle_Tunnel_Base_vertical.mp4`](output/Jungle_Tunnel_Base_vertical.mp4)

- **Voice:** ElevenLabs, voice *Adam* (premade, American), model `eleven_v4`, take 2. Pauses longer than 0.36 s were shortened → `audio/voice_adam.mp3`. Phrase timings are in `audio/chunks.json`. ElevenLabs was used for the voice only.
- **Visuals:** everything is procedural, built in three.js and rendered headless with Playwright. The style follows the user's second sample video:
  - **Look:** one continuous cut-away of a jungle hill in plain terracotta clay, with sharp straight-edged tunnels that show real depth (stacked wall layers behind the cut face) and murky green water.
  - **Scenery and characters:** dense tall thin jungle trees, and a hider in dark clothes with a red headband.
  - **Camera:** slightly angled, so the tunnel depth shows.
  - **Story:** each tunnel section appears as it is dug.
    - the hidey hole (flooded by rain), the sloped tunnel, and the zigzag (the grenade blast hits the wall)
    - the water trap (the gas stops), the bamboo spike pit under a fake floor (nothing graphic is shown), and the air holes with soap (the dogs walk past)
    - the river-bottom entrance, and the base with a hammock, a lantern and the banana-stealing monkey
- **Graphics:** like the sample, there are no labels. Captions show two words at a time in the middle of the screen: the first word is white and the second is coloured (pink, yellow, green, cyan). The earlier labelled version is kept as `src/scene_v1.html`.
- **Sound:** synthesized one-off effects only (`src/build_audio.py`).

## Script (tightened to fit 65 s)
> Dig a hole in the jungle to hide, and you have a hidey hole. But the first rainstorm floods it. So you dig sideways into a hill, sloping the floor up, so rain runs out. This is your tunnel.
> But soldiers find your hole and drop a grenade down it. So every tunnel zigzags, and the blast hits the wall, not you.
> Then they pump in poison gas. So the tunnel dips under a pool of water and back up. Gas can't get through. This is your water trap.
> Then soldiers crawl in with flashlights. So you hide sharp bamboo under a fake floor. The first one drops right in. This is your spike trap.
> Their dogs sniff out your air holes. So you rub each hole with the soldiers' own soap, and the dogs walk past.
> But sooner or later, they'll find every entrance. So you dig one at the bottom of the river. Nobody searches there.
> Add a hammock, a lantern, and a monkey stealing your banana. Congratulations! You've built a tunnel base.

## Rebuild
Uses the three.js install from `../house-fire` (`node_modules` symlink).
```bash
python3 src/build_audio.py
node src/render.mjs --range 0-456          # frames -> output/frames (run 4 ranges in parallel)
ffmpeg -framerate 30 -i output/frames/f%05d.jpg -i audio/final_mix.wav -c:v libx264 -b:v 10000k -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -t 60.8 output/Jungle_Tunnel_Base_vertical.mp4
```

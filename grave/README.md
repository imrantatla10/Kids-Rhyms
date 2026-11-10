# How to Build a Grave — 3D explainer (vertical 9:16, bright daylight)

1080×1920, 30 fps, **63.3 s** (limit was 65 s). No background music, and no continuous background noise: only effects tied to specific moments.

**Video:** [`output/How_To_Build_A_Grave_vertical.mp4`](output/How_To_Build_A_Grave_vertical.mp4)

- **Voice:** ElevenLabs, voice *Adam* (premade, American), model `eleven_v4`, take 2. Pauses longer than 0.36 s were shortened (2.0 s saved) → `audio/voice_adam.mp3`. Phrase timings are in `audio/chunks.json`. ElevenLabs was used for the voice only.
- **Visuals:** everything is procedural, built in three.js and rendered headless with Playwright:
  - a sunny backyard: house, picket fence, trees and flower beds
  - the digger (with shovel), a wrapped body and the fox
  - a cut-away "ground diorama" showing the pit, the 6 FT / 4 FT ruler, the coffin rotting, the concrete burial vault, groundwater, the sealed casket, gas pressure, the lid bursting, the unlocked seal, and the headstone tipping then fixed by a concrete base
  - colorful labels, banners and captions
- **Sound:** synthesized one-off effects only (`src/build_audio.py`): birdsong, shovel, dirt, fox paws, coffin landing, wood creak, concrete thuds, droplets, seal click, gas groan, burst, stone grind, flower pops.

## Script (tightened to fit 65 s)
> Dig a hole in your yard, put someone in it, and you have a grave. But by morning, a fox digs him back up.
> So you dig six feet deep, a rule from London's Great Plague of 1665. And you wrap him in a wooden box. A coffin.
> But the wood rots, the lid caves in, and your lawn sinks. So you lower the coffin into a concrete box. A burial vault.
> With a vault, most graves today are only about four feet deep. But you want water out too, so you buy a casket with an airtight rubber seal.
> But a body makes gas as it breaks down, and sealed in, it can't escape. Some caskets burst. Exploding casket syndrome.
> So many funeral homes leave the seal unlocked, to let it breathe. But the ground settles, and the headstone tips. So you pour a concrete base.
> And the strange part? In most U.S. states, you can be buried in your own backyard. Add a name, some flowers... congratulations. You've built a grave.

## Rebuild
Uses the three.js install from `../house-fire` (`node_modules` symlink).
```bash
python3 src/build_audio.py                      # -> audio/final_mix.wav
node src/render.mjs --range 0-475               # frames -> output/frames (run 4 ranges in parallel)
ffmpeg -framerate 30 -i output/frames/f%05d.jpg -i audio/final_mix.wav -c:v libx264 -b:v 10000k -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -t 63.3 output/How_To_Build_A_Grave_vertical.mp4
```

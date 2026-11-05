# London Muslims – 3D horizontal news video

1920×1080, 30 fps, 39.6 s. The scenes are 3D, built in three.js and rendered headless with Playwright. The voiceover is the user's own file (`audio/voiceover.mp3`), with a synthesized music bed and SFX mixed underneath.

**Video:** [`output/London_Muslims_3D_horizontal.mp4`](output/London_Muslims_3D_horizontal.mp4)

| Time | Scene |
|---|---|
| 0–3 s | Night flyover of a 3D London (river, clock tower, observation wheel), "LONDON" |
| 3–8 s | 3D map; an airliner flies from LONDON to PAKISTAN / ISLAMABAD |
| 8–13 s | 3D bars: London Muslim population 607,083 / 1,012,823 / 1,318,754 (2001/2011/2021 census) |
| 13–18.5 s | Wide orbit over the city with red warning lights |
| 18.5–22 s | 3D donut: 15% |
| 22–25.4 s | Pakistani-heritage population of London 223,797 → 290,549 (2011→2021), +30% |
| 25.4–30.8 s | Mosques rise in the city streets |
| 30.8–39.6 s | 3D line graph 8.5% → 12.4% → 15.0%, UK flag, clock tower, "?" |

## Rebuild
```bash
npm install                       # three, topojson-client
python3 src/build_audio.py        # -> audio/final_mix.wav
node src/render.mjs --range 0-1188   # frames -> output/frames (split ranges to parallelise)
ffmpeg -framerate 30 -i output/frames/f%05d.jpg -i audio/final_mix.wav -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -shortest output/London_Muslims_3D_horizontal.mp4
node src/render.mjs --stills 5,20   # quick previews
```

# بابر اعظم بمقابلہ ویرات کوہلی — Stat comparison video (1080×1080)

1080×1080, 30 fps, **63.5 s**. No voiceover (the video carries a silent audio track for upload compatibility). All figures are exactly as given in the script.

**Video:** [`output/Babar_vs_Kohli_1080x1080.mp4`](output/Babar_vs_Kohli_1080x1080.mp4)

Background: the user's supplied image (`src/bg.png`). Babar's values (green) are on his side (left) and Kohli's values (blue) are on his side (right).

Text policy: no Urdu. Each step shows only a short English title, with the digits/dates below it (Babar on the left, Kohli on the right).

| Time | Step (title → Babar / Kohli) |
|---|---|
| 0–4.4 s | BABAR AZAM VS VIRAT KOHLI · WHO'S AHEAD? |
| 4.4 s, then every 4.55 s | BORN 15 OCT 1994 / 5 NOV 1988 → INTERNATIONAL DEBUT 2015 / 2008 → ODI DEBUT 31 MAY 2015 / 18 AUG 2008 → T20I DEBUT 7 SEP 2016 / 12 JUN 2010 → TEST DEBUT 13 OCT 2016 / 20 JUN 2011 → WORLD CUP FINALS 1 / 4 → CAPTAINCY · MATCHES 152 / 213 → CAPTAINCY · WINS 85 / 135 → INTERNATIONAL RUNS 16,038 / 28,527 → CENTURIES 32 / 86 → FIFTIES 111 / 148 → CURRENTLY PLAYING (TEST · ODI · T20 / ODI only) |
| 59–63.5 s | FINAL TALLY |

Transitions: a gold light-sweep wipe, a flash and a slide-in at each step, count-up digits with comparison bars, a gold arrow and side glow for whoever leads, a slow zoom on the background, and sparks.

## Rebuild
Text uses the system Inter font. (`fonts/` holds Urdu fonts from an earlier version and is no longer used.)
```bash
node src/render.mjs                 # frames -> output/frames
ffmpeg -framerate 30 -i output/frames/f%05d.jpg -f lavfi -i anullsrc=r=48000:cl=stereo -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest -t 63.5 output/Babar_vs_Kohli_1080x1080.mp4
node src/render.mjs --stills 15,31,55   # previews
```

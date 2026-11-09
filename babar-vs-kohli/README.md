# بابر اعظم بمقابلہ ویرات کوہلی — Stat comparison video (1080×1080)

1080×1080, 30 fps, **63.5 s**. No voiceover (the video carries a silent audio track for upload compatibility). All figures are exactly as given in the script.

**Video:** [`output/Babar_vs_Kohli_1080x1080.mp4`](output/Babar_vs_Kohli_1080x1080.mp4)

Background: the user's supplied image (`src/bg.png`). Babar's values (green) are on his side (left) and Kohli's values (blue) are on his side (right).

| Time | Step |
|---|---|
| 0–5.6 s | Title: بابر اعظم بمقابلہ ویرات کوہلی — کون کس سے آگے؟ |
| 5.6–11 s | کرکٹ کے 2 بڑے نام: پاکستان / بھارت |
| 11–18 s | پیدائش: 15 اکتوبر 1994 لاہور / 5 نومبر 1988 دہلی |
| 18–23 s | انٹرنیشنل کرکٹ کا آغاز: 2015 / 2008 |
| 23–33.6 s | ڈیبیو: ODI, T20, Test |
| 33.6–39 s | ورلڈ کپ فائنلز: 1 / 4 |
| 39–46.6 s | کپتانی: 152 میچز، 85 فتوحات / 213 میچز، 135 فتوحات |
| 46.6–56.8 s | رنز 16,038 / 28,527 · سنچریاں 32 / 86 · ففٹیز 111 / 148 |
| 56.8–63.5 s | بابر: تینوں فارمیٹس · کوہلی: صرف ODI |

Transitions: a gold light-sweep wipe, a flash and a slide-in at each step, count-up digits, a "آگے" badge and a side glow for whoever leads, a slow zoom on the background, and sparks.

## Rebuild
Fonts: Noto Nastaliq Urdu and Noto Naskh Arabic (OFL, from Google Fonts) are in `fonts/`.
```bash
node src/render.mjs                 # frames -> output/frames
ffmpeg -framerate 30 -i output/frames/f%05d.jpg -f lavfi -i anullsrc=r=48000:cl=stereo -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest -t 63.5 output/Babar_vs_Kohli_1080x1080.mp4
node src/render.mjs --stills 15,31,55   # previews
```

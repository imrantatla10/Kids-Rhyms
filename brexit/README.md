# Brexit: Did Britain Win or Lose? The Real Numbers (2020–2025)

Vertical explainer video: 9:16, 1080×1920, 30 fps, **64 s**, flat 2D motion graphics only.

**Video:** [`output/Brexit_Win_or_Lose_vertical.mp4`](output/Brexit_Win_or_Lose_vertical.mp4)

## Scenes
| Time | Scene |
|------|-------|
| 0–3.6 s | Hook: the UK map filled with the Union Jack, the EU flag's stars drift away, "BREXIT: WIN OR LOSE?", a question mark pops up |
| 3.6–8.2 s | Timeline: a Europe map (UK in blue, EU in gold), the UK pulls away, date cards for 31 Jan 2020 and 1 Jan 2021 |
| 8.2–20.3 s | Trade: port, ship and trade arrows; two-bar chart from a 2019 = 100 baseline, goods −14%, services +28% |
| 20.3–38.75 s | Immigration: world map (Europe in blue, rest of world in orange), arrows and people icons; horizontal bars for 813k, 627k, 76k and 110k |
| 38.75–48.35 s | Economy: City of London skyline, then a counterfactual line chart showing the OBR's −4% long-term productivity estimate |
| 48.35–55 s | Trade deals: CPTPP members in green with routes from the UK; the £2bn figure is labelled as a 2040 projection |
| 55–64 s | Final: Challenges vs Gains split screen, "DID BRITAIN WIN OR LOSE?", WIN/LOSE buttons, "COMMENT: WIN OR LOSE?" |

## Audio
- **Narration:** ElevenLabs `eleven_v4`, voice *Russell – Dramatic British TV*. There are 7 clips; silence was trimmed and the speed raised to 1.10× to fit 64 s (`audio/voice/v1..v7.wav`, raw takes in `audio/voice/takes/`).
- **Music and SFX:** all original and synthesised in `src/build_audio.py`. The music is a D-minor documentary pulse at 100 BPM. The SFX are whooshes, pops, stamps, impacts, risers and chimes. The music ducks under the voice.

## Data on screen (figures as supplied in the brief)
- Trade: ONS. Goods exports to the EU in 2025 were −14% vs 2019 and services +28% (real terms).
- Migration: ONS long-term international migration for 2025. 813k arrivals: non-EU+ 627k, EU+ 76k, British 110k.
- Economy: OBR estimate of a 4% lower long-term productivity vs remaining in the EU. The two lines are illustrative paths.
- CPTPP: UK Government impact assessment. About £2bn long-term GDP gain, projected for 2040.

## Rebuild
```bash
pip install pycairo numpy           # fonts: Inter / Inter Display (fontconfig)
python3 src/build_audio.py          # -> audio/final_mix.wav
python3 src/render.py               # -> output/Brexit_Win_or_Lose_vertical.mp4
python3 src/render.py --stills 5,30 # PNG previews
```
Maps come from Natural Earth via `world-atlas@2.0.2` (public domain), in `data/`.

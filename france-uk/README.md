# What If France Attacked the United Kingdom? (hypothetical military comparison)

Vertical 9:16, 1080×1920, 30 fps, **63 s**. The visuals are flat 2D only: maps, ships, aircraft, soldiers, icons and charts.
This is a hypothetical, high-level comparison. It is not a prediction and contains no operational detail.

**Video:** [`output/What_If_France_Attacked_the_UK_vertical.mp4`](output/What_If_France_Attacked_the_UK_vertical.mp4)

| Time | Scene |
|------|-------|
| 0–6.1 s | Western Europe map (France in blue, UK in red), flag pop-outs, title, question mark over the Channel |
| 6.1–13.55 s | Carriers: split panels with 2 Queen Elizabeth-class carriers vs the Charles de Gaulle; Graphic A shows 2 vs 1 with an availability footnote |
| 13.55–24.5 s | Underwater cutaway with frigate, amphibious ship and submarines; Graphic B shows UK 9 (UK MOD, April 2026) vs France 4 SSBN plus a separate SSN fleet |
| 24.5–34.85 s | Land & air: soldiers, Leclerc and Challenger 2 tanks, Rafale, Typhoon and F-35; qualitative bars only |
| 34.85–41.8 s | Nuclear danger: deterrence symbols, "NUCLEAR-ARMED STATES", red warning pulse, then a brief freeze |
| 41.8–52.9 s | Europe: zoom out, trade routes to 5 example economies, Graphic C with four impact cards (no numbers) |
| 52.9–63 s | "NO REAL WINNER?", "COMMENT: WHO WOULD LOSE MORE?", final source card |

## Audio
- **Narration:** ElevenLabs `eleven_v4`, voice *Russell – Dramatic British TV*, 7 clips.
  `src/prep_voice.py` trims the clips, caps pauses at 0.26 s and applies a 1.15× tempo with pitch kept, so they fit in 63 s.
- **Music and SFX:** original, synthesised in `src/build_audio.py`. The music is a tense D-minor pulse; the SFX include sonar pings, warning pulses, whooshes, pops and impacts.

## Rebuild
```bash
python3 src/prep_voice.py && python3 src/build_audio.py && python3 src/render.py
```

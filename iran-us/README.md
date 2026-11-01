# Iran vs America: What Happens If the Conflict Escalates Again?

A horizontal 16:9 video, 1920×1080 at 30 fps, **64 s** long. It is a 2D animated geopolitical documentary.

**Video:** [`output/Iran_vs_America_Escalation_1080p.mp4`](output/Iran_vs_America_Escalation_1080p.mp4)

There are no words on screen: no titles, labels, subtitles, country names, logos or watermarks. The only
digits are "2026" on the timeline. Military visuals stay high-level: generic silhouettes inside
panels, with no targets, routes, positions or attacks. Every scene from "Now imagine…" onward sits in a
dashed "what-if" frame with a question badge. The price chart shows a dashed projection inside an
uncertainty band, so the escalation reads as a possibility, not a prediction.

| Time | Narration | Visuals |
|------|-----------|---------|
| 0–7.4 s | "The confrontation between Iran and the United States…" | Middle East map; the Gulf glows; Iran is highlighted and its flag pops in; US flag with a world inset; context badges (oil, shipping, people, economy) fan out on "far from simple" |
| 7.4–16.2 s | "After the major strikes in February 2026…" | Timeline: strike burst + 2026 → ceasefire flag → handshake → the line cracks on "failed" → pulsing "present" marker |
| 16.2–24.4 s | "Tensions have continued…" | Two flags joined by a tension line; nuclear, sanctions and Strait of Hormuz cards, which turn red on "disagreement" |
| 24.4–37.8 s | "Now imagine another serious escalation…" | An iris and question mark open the what-if space; US panel (carrier, aircraft, sea); Iran panel (missile and drone icons, a cargo ship under pressure) |
| 37.8–43.3 s | "But there would be no easy victory… Gulf countries" | Balance scale stays level while the trophy cracks; then a Strait of Hormuz map with cargo ships in the narrow corridor and the Gulf states pulsing |
| 43.3–47.1 s | "…international trade and global energy prices." | Globe and container ship, oil barrels, a price chart with a dashed possible rise |
| 47.1–54.2 s | "The real question is not simply who has more weapons…" | Weapon stacks fade to grey; a world map where ripples spread from the Gulf and countries light up |
| 54.2–64 s | "Could diplomacy prevent another major crisis?" | Negotiating table with both flags and an olive branch; a large question mark draws on; fade out |

## Audio
- **Narration:** ElevenLabs `eleven_v4`, voice *Sia – Energetic News Voice for Breaking News & Fast Updates*
  (`YJpPt0sBEgMzYwcMkF5o`), 7 clips (`audio/voice/takes/`). The text is exactly the supplied script.
  `src/prep_voice.py` trims the edges, caps pauses at 0.45 s and applies light EQ and compression. The pace is
  natural, with no speed-up. Line 2 was checked with ElevenLabs Scribe ("February 2026" is spoken correctly).
- **Music and SFX:** original, synthesised in `src/build_audio.py`. The score is a slow 68 BPM D-minor piece:
  drone, string pads, a sparse piano motif, a heartbeat pulse under the scenario and an unresolved ending.
  SFX include low taiko hits, whooshes, a fracture crack, sonar, ship horns, risers and chimes. The music
  ducks about 10 dB under the voice. The final mix is loudness-normalised to about −15 LUFS, with true peak
  at −1.5 dBTP.

## Rebuild
```bash
pip install pycairo numpy          # ffmpeg + Inter fonts required
python3 src/prep_voice.py          # takes -> audio/voice/v1..v7.wav + segments.json
python3 src/build_audio.py         # -> audio/final_mix.wav
python3 src/render.py              # -> output/Iran_vs_America_Escalation_1080p.mp4
python3 src/render.py --stills 5,30,58   # quick PNG previews
```
Scene and word timings are in `src/timeline.py`. The map data is Natural Earth via world-atlas (`data/LICENSE`).

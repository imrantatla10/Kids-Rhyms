# Britain Wants Back Into the EU — Is Brexit Losing Public Support?

A vertical 9:16 video, 1080×1920 at 30 fps, **64 s** long. It is a premium 2D animated political documentary
for Reels, TikTok and Shorts.

**Video:** [`output/Britain_Rejoin_EU_vertical.mp4`](output/Britain_Rejoin_EU_vertical.mp4)

There are no words on screen: no titles, captions, headings, country names, labels, logos or watermarks.
The only glyphs are the numbers the narrator says: 56, 30, 63, 34, 73, 39 and 49. Key elements stay
inside a central safe area (about x 90–990, y 200–1650), clear of the social-app UI. There is no presenter,
anchor, microphone or news desk.

| Time | Narration | Visuals |
|------|-----------|---------|
| 0–10.4 s | "Britain voted to leave Europe…" | Close-up of the UK in glowing red. A camera pull-out reveals Europe as the EU members fill blue, rippling outward from the UK. The UK drifts away, leaving a dashed ghost outline, then edges back. The 12 EU stars form a ring, and the camera pushes in on the question |
| 10.4–23.3 s | Ipsos poll: 56 vs 30, likely voters 63 vs 34 | Blue and red bars grow from zero while the digits count up, with an EU emblem under the blue bar and a Union Flag emblem under the red. A smooth upward slide brings in the likely-voter chart (63 vs 34) with a row of voters |
| 23.3–34.8 s | Under-35s 73, 55-and-over 39 | Split screen. Four younger adults walk in at the top with a 73% ring; four older adults (grey hair, glasses, cardigans, flat cap) are at the bottom with a 39% ring. Characters breathe, blink and sway, and one waves |
| 34.8–43.7 s | PM Andy Burnham: rejoin "in his lifetime", not "this Parliament" | Editorial illustrated portrait in a round frame. An hourglass appears with a dashed path to a distant EU emblem. Then a glowing route from Westminster to Brussels is blocked by a no-entry sign. Last, the Palace of Westminster above a timeline: the current Parliament segment is closed off and the EU emblem waits further along |
| 43.7–54.2 s | 49% support another referendum; return not guaranteed | Close-up of a marked ballot paper folding into a ballot box. A crowd of voters with a 49% ring; ballot papers rise on "referendum". Then a UK–continent map where the Westminster path stops at a pulsing decision point that forks |
| 54.2–64 s | "…Is this the beginning of the road back?" | Back to the Europe map with a slow pull-back. The UK drifts closer but never rejoins. A spotlight falls on the gap and a dotted golden road reaches toward the continent without touching it. Musical rise, final hit, fade to black |

## Audio
- **Narration:** ElevenLabs `eleven_v4`, voice *Russell – Dramatic British TV* (`NYC9WEgkq1u4jiqBseQ9`).
  There are 6 clips, one per scene, using the same voice throughout. Takes are in `audio/voice/takes/`. The script text is exactly as supplied,
  with numbers written out in words for clear pronunciation, plus light delivery tags (dramatic opening, slow final question).
  `src/prep_voice.py` trims the edges, caps pauses at 0.34 s and applies 1.10× tempo to fit 64 s (the final line is 1.04×).
  It also adds light EQ and compression.
- **Music and SFX:** original, synthesised in `src/build_audio.py`. The score is 76 BPM in D minor: drone, string pads, a sparse piano motif,
  a soft pulse under the statistics and a crescendo with a rising piano line into the final question. SFX include low hits,
  whooshes, counting ticks on the numbers, chimes for the EU stars, paper rustle and a ballot-box thunk.
  The music ducks under the voice (about 14 dB below the narration). The final mix is about −15 LUFS, with true peak at −1.5 dBTP.

## Figures (as supplied in the brief, not independently verified)
- Ipsos: 56% would vote to apply to rejoin the EU, 30% would stay out. Among likely voters: 63% vs 34%.
- Under-35s: 73% support rejoining. Aged 55+: 39%.
- 49% support another referendum before the next general election.
- PM Andy Burnham would like Britain to rejoin in his lifetime and has ruled it out during this Parliament.

## Rebuild
```bash
pip install pycairo numpy          # ffmpeg + Inter Display fonts required
python3 src/prep_voice.py          # takes -> audio/voice/v1..v6.wav + segments.json
python3 src/build_audio.py         # -> audio/final_mix.wav
python3 src/render.py              # -> output/Britain_Rejoin_EU_vertical.mp4
python3 src/render.py --stills 3,15,30   # quick PNG previews
```
Scene and word timings are in `src/timeline.py`. The map data is Natural Earth via world-atlas (`data/LICENSE`, public domain).

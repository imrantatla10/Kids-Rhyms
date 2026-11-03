# The Autograph – 3D re-enactment of a speech anecdote

A **horizontal 16:9** comedy video, 1920×1080 at 30 fps, **62.5 s** long. It has no text of any kind and no AI voice. There is light background music and comedy SFX.
The only voice is the speaker's original audio from the supplied clip (`audio/voice/source_clip.mp4`), lightly denoised.
The scenes act out what she describes, line by line:

| Time | Audio (paraphrased) | Scene |
|------|---------------------|-------|
| 0–4.5 | landed in Mandi Bahauddin to inaugurate the grain market | an aerial shot of the helicopter landing in a dust cloud, then she steps out |
| 4.5–8.7 | a girl of about 20 was standing there | the crowd behind steel barricades, pushing in on the girl holding her phone |
| 8.9–13.4 | "I saw this with my own eyes; I'm not lying or exaggerating" | the speaker at a podium in front of a red LED wall, lips driven by the audio |
| 13.4–17.5 | she broke through the barricade and came inside | the girl pushes a barrier panel aside and comes through |
| 17.5–23.5 | both her hands were injured and bleeding | a close-up of scratched hands with a few drops |
| 23.5–25.9 | she was holding a phone and trembling | trembling hands holding the phone |
| 25.9–30.2 | "I comforted her and asked why her hands were bleeding" | the speaker places a hand on her head, then asks |
| 30.2–37 | "I tore through the barricade just to get your autograph" | the girl answers (her lips driven by the audio) and the speaker signs her diary |
| 37–39.6 | "I wanted to meet you" | a crane-out over the two and the crowd |

The speaker character follows the outfit in the reference photo (`src/reference_look.png`): purple dupatta, black gown and embroidered maroon stole.
Both characters are stylised, semi-realistic 3D. They are not photoreal likenesses.

## Rebuild
```bash
npm install
node src/render.js            # audio/final_mix.wav = original voice + a soft helicopter during the landing
```

## Comedy version (current)
- **0–8 s:** the helicopter wobbles in and lands with a bump, and a dust cloud blows over the crowd. She steps out and waves (to music).
- **8–47 s:** her speech (the scenes above). The girl gets stuck in the barricade, pops through with a "boing", and the barricades fall like dominoes.
- **47–62.5 s:** after the autograph, the girl squeals, **shoves her and runs off** with the diary held high while a guard chases her with a whistle.
  The speaker lands in the grain sacks with a burst of grain, then a sad trombone plays, she sits up dizzy, and the crowd laughs.
- **Audio:** `src/build_audio.py` contains her original voice (boosted) plus a light bouncy music bed, ducked under the speech. The SFX are a helicopter, a bump/boing, a crowd cheer,
  creaks and clangs, scribbles, squeals, a whoosh/bonk, a slide whistle, a thud, footsteps, a police whistle, synthesised laughter and a sad trombone.

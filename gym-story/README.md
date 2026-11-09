# The Gym Show-Off — 3D cinematic (vertical 9:16)

An awareness short: a guy tries to impress a girl at the gym, makes her uncomfortable, and ends up removed by security and the police.

1080×1920, 30 fps, **62.5 s** (limit was 65 s). No background music.

**Video:** [`output/The_Gym_Show_Off_vertical.mp4`](output/The_Gym_Show_Off_vertical.mp4)

- **Voice:** ElevenLabs, voice *Adam* (premade, American), model `eleven_v4`, take 2 → `audio/voice_adam.mp3` (animation choreographed on take 1 and time-warped to take 2 phrase anchors). ElevenLabs was used for the voice only.
- **Visuals:** everything is procedural, built in three.js and rendered headless with Playwright. That covers:
  - the gym, with a glass storefront, the street outside, equipment, neon, light cones and dust
  - 9 rigged characters: the guy, the girl, 2 security guards, a police officer, desk staff and 3 gym-goers
  - the police car, camera moves, captions and game-style HUD cards
- **Sound:** synthesized natural effects only (`src/build_audio.py`). There's no music.

## Script (trimmed to fit 65 s)
> A guy tries to impress a girl at the gym. Let's see what happens to him.
> He walks in, spots a beautiful girl, and immediately decides to show off.
> He lifts heavier weights, flexes his muscles, and does extra exercises, just to get her attention.
> But that's not all. He keeps staring at her, watching her every move, and trying to get closer.
> Finally, he approaches her and tries to start a conversation.
> But she's clearly uncomfortable. She ignores him, and tries to continue her workout.
> Still, he doesn't stop. He keeps following her, trying to talk to her.
> And then... everything takes an unexpected turn.
> She calls gym security, and reports his behavior.
> Within moments, security guards arrive, stop him, and call the police.
> Just like that, his plan to impress her turns into a complete disaster.
> Remember... confidence is attractive. But making someone uncomfortable is never okay.

## Shot list
| Time | Shot |
|---|---|
| 0–3.9 s | Wide crane over the gym. Title "THE GYM SHOW-OFF" |
| 3.9–8 s | His silhouette outside the glass doors, then a low-angle shot of him walking in |
| 8–10.9 s | Over-the-shoulder shot as he spots her, then a close-up as he rolls his shoulders. HUD: OBJECTIVE · IMPRESS HER |
| 10.9–17.1 s | Heavy deadlift and plate drop (chalk puff), double-biceps flex, push-ups. HUD: SHOW OFF |
| 17.1–23.5 s | Ominous dolly behind him, close-up stare, then he creeps closer. **UNWANTED ATTENTION** |
| 23.5–31.8 s | He approaches and talks; she backs off, turns away and keeps training. **SHE IS UNCOMFORTABLE** |
| 31.8–37 s | Tracking shot: she moves to the cable machine and he follows. **BOUNDARY CROSSED** |
| 37–44.5 s | Slow push-in as she takes out her phone, a close-up of the screen calling "GYM SECURITY", then she reports him. **SECURITY ALERTED** |
| 44.5–48.8 s | Guards rush in and stop him (he raises his hands); one radios the police |
| 48.8–53.6 s | Police car arrives outside with lights flashing and he's escorted out. **MISSION FAILED** |
| 53.6–62.5 s | She trains in peace. *Confidence is attractive / Making someone uncomfortable is never okay.* |

## Rebuild
Uses the three.js install from `../house-fire` (`node_modules` symlink; run `npm install` there first).
```bash
pip install numpy scipy
python3 src/build_audio.py                         # -> audio/final_mix.wav
node src/render.mjs --range 0-470                  # frames -> output/frames (run 4 ranges in parallel)
ffmpeg -framerate 30 -i output/frames/f%05d.jpg -i audio/final_mix.wav -c:v libx264 -b:v 10500k -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -t 62.5 output/The_Gym_Show_Off_vertical.mp4
node src/render.mjs --size 540x960 --stills 12,34,50   # quick previews
```

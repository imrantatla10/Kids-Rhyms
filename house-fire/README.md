# How to Survive a House Fire — 3D survival cinematic (vertical 9:16)

1080×1920, 30 fps, **60.0 s** (limit was 65 s). No background music.

**Video:** [`output/How_To_Survive_A_House_Fire_vertical.mp4`](output/How_To_Survive_A_House_Fire_vertical.mp4)

- **Voice:** ElevenLabs, voice *Adam* (premade, American), model `eleven_v4`, take 2 → `audio/voice_adam.mp3`. ElevenLabs was used for the voice only.
- **Visuals:** everything is procedural, built in three.js and rendered headless (Playwright/Chromium). That covers the house, its interior, the people, the fire shader, smoke and embers, the fire truck, camera moves, captions and graphics. No external images, video or 3D assets.
- **Sound:** every effect is synthesised in `src/build_audio.py`: fire roar and crackle, a smoke alarm, the door slam, a towel swish, 911 keypad tones and ringback, cloth flapping, ladder clanks, footsteps, wind, a siren, the truck engine and water spray.

## Script (trimmed to fit 65 s)
> Imagine waking up in the middle of the night... and your house is on fire. Smoke fills the hallway. The heat is rising fast. What would you do?
> First, shut your bedroom door. A closed door slows fire and smoke. Then block the gap underneath with towels.
> But the fire is getting closer... and the stairs are already blocked.
> Don't panic. Call emergency services. Tell them your exact location, and that you're trapped inside.
> Move to the window. Signal for help with a bright cloth or a flashlight.
> But there's one more problem... the door is getting dangerously hot.
> Grab your emergency escape ladder. Lock its hooks securely onto the window sill. Hold the frame, climb out, and get to the ground safely.
> Once you're outside, never go back in. Go to your meeting spot, and wait for firefighters.
> Remember... in a house fire, every second matters. Get out alive.

## Shot list
| Time | Shot |
|---|---|
| 0–2 s | Night exterior, fire in the ground-floor windows, smoke plume. Title card |
| 2–5.6 s | Bedroom: wakes and sits up, orange light under the door, smoke alarm blinking |
| 5.6–9.5 s | Hallway: smoke rolling along the ceiling, flames climbing the stairs (heat shimmer) |
| 9.5–13 s | Stands, walks to the door and shuts it. **Step 1** |
| 13–15.8 s | Hallway side: the closed door holds back the smoke |
| 15.8–18.5 s | Crouches and seals the gap with a towel. **Step 2** |
| 18.5–22.5 s | Dolly toward the blocked stairs. **STAIRS BLOCKED** |
| 22.5–28.7 s | Stays low by the window, calls 911, phone screen close-up. **Step 3** |
| 28.7–33 s | Exterior: waves a bright cloth at the window. **Step 4** |
| 33–37 s | Door edges glowing hot, smoke at the top. **DOOR IS HOT** |
| 37–41.5 s | Ladder hooks land on the sill and the ladder unrolls. **Step 5** |
| 41.5–45.3 s | Climbs out and down to the ground |
| 45.3–47.9 s | Walks away from the house. **NEVER GO BACK INSIDE** |
| 47.9–50.8 s | At the mailbox meeting spot as the fire truck arrives. **Step 6** |
| 50.8–60 s | Crane shot: firefighters spray water. *Every second matters / Get out alive* |

## Rebuild
```bash
npm install                                   # three
pip install numpy scipy
python3 src/build_audio.py                    # -> audio/final_mix.wav
node src/render.mjs --range 0-450             # frames -> output/frames (run 4 ranges in parallel)
ffmpeg -framerate 30 -i output/frames/f%05d.jpg -i audio/final_mix.wav -c:v libx264 -crf 19 -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -t 60 output/How_To_Survive_A_House_Fire_vertical.mp4
node src/render.mjs --size 540x960 --stills 3.5,17,30   # quick previews
```

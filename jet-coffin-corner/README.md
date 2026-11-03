# Coffin Corner – why a jet can fall out of the sky (realistic 3D CGI)

A vertical 9:16 video, 1080×1920 at 30 fps, **65 s** long, in English, with **no captions** and no 2D illustrations.
The script is original (`script.txt`). It is a general explanation of high-altitude upsets: the narrow speed window ("coffin corner"),
wing icing, turbulence, a stall and the dive. It does not describe or make claims about any specific real accident.

**Video:** [`output/Jet_Coffin_Corner_3D_vertical.mp4`](output/Jet_Coffin_Corner_3D_vertical.mp4)

## Look
- A PBR business jet with a clear-coat livery, nav and strobe lights, and engines.
- A night sky with stars and the moon above a procedural cloud sea, plus soft noise-textured cloud layers and 3D lightning in the clouds.
- A wind-tunnel airfoil showing smoke-like flow, separation at the stall, a shockwave at high speed and ice build-up.
- A cockpit with pilots, yokes and a working primary flight display: the speed tape with low-speed and overspeed bands closing in, attitude, altitude and the STALL/OVERSPEED annunciation.
- A dive sequence and a calm dawn sky.

## Audio
- **Voice:** ElevenLabs `eleven_v4`, *Jesse – Animation Character, Friendly* (`rLl4PSDTzX3VHL4wjSFI`), with a 1.04× tempo to fit.
- **SFX:** cabin and engine drone, thunder, turbulence rattles, an ice crackle, the stall horn and stick shaker, the overspeed clacker and caution chimes. All of it is synthesised in `src/build_audio.py`. There is no music.

## Rebuild
```bash
npm install
VOICE_START=0.4 MAX_GAP=0.5 VOICE_LEN=63.0 python3 src/prep_voice.py audio/voice/voiceover_jesse.mp3 <whisper-small-ct2-dir>
python3 src/build_audio.py
node src/render.js
```

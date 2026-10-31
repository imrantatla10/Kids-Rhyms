"""Synthesise the nursery-pop backing track + SFX and mix with the ElevenLabs narration.

Output: audio/final_mix.wav (44.1 kHz stereo, 64 s)
"""
import os
import subprocess
import wave

import numpy as np

from timeline import (BEAT, BOINGS, DURATION, SCENES, SPARKLES, VOICE_START,
                      WHISTLES)

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_DIR = os.path.join(ROOT, "audio", "voice")
OUT = os.path.join(ROOT, "audio", "final_mix.wav")
rng = np.random.default_rng(7)

N = int(DURATION * SR)
music = np.zeros(N)
sfx = np.zeros(N)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf, sig, t):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def env_ad(n, attack, decay):
    t = np.arange(n) / SR
    e = np.exp(-t / decay)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def lowpass(x, k):
    if k <= 1:
        return x
    return np.convolve(x, np.ones(k) / k, mode="same")


# ---------------------------------------------------------------- instruments
def bell(m, dur=0.9, amp=0.22):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.45)
         + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.2)
         + 0.18 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.08))
    s[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return amp * s


def pluck(freqs, dur=0.35, amp=0.07):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for h, w in ((1, 1.0), (2, 0.45), (3, 0.25), (4, 0.12)):
            s += w * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6))
    return amp * s * env_ad(n, 0.004, 0.12)


def bass(m, dur=0.42, amp=0.28):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t))
    s = tri + 0.3 * np.sin(2 * np.pi * f * t)
    return amp * s * env_ad(n, 0.005, 0.22)


def kick(amp=0.55):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return amp * np.sin(ph) * np.exp(-t / 0.09)


def clap(amp=0.28):
    n = int(0.18 * SR)
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0)  # brighten
    e = np.zeros(n)
    for off in (0.0, 0.01, 0.02):  # multi-tap "hands"
        i = int(off * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / 0.012)
    e += 0.5 * np.exp(-np.arange(n) / SR / 0.06)
    return amp * 0.5 * noise * e


def shaker(amp=0.05):
    n = int(0.07 * SR)
    noise = np.diff(rng.standard_normal(n), prepend=0)
    return amp * noise * env_ad(n, 0.01, 0.02)


def chug(amp=0.09):
    n = int(0.16 * SR)
    noise = lowpass(rng.standard_normal(n), 6)
    return amp * noise * env_ad(n, 0.01, 0.05)


def whistle(dur=1.0, amp=0.16):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 6 * t)
    s = np.zeros(n)
    for f, w in ((587.3, 1.0), (740.0, 0.8), (880.0, 0.6)):
        s += w * np.sin(2 * np.pi * np.cumsum(f * vib) / SR)
    s += 0.25 * lowpass(rng.standard_normal(n), 3)  # steam breath
    e = np.ones(n)
    a, r = int(0.06 * SR), int(0.25 * SR)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] = np.linspace(1, 0, r)
    # two "toots"
    gap = (t > dur * 0.42) & (t < dur * 0.5)
    e[gap] *= 0.15
    return amp * s * e / 2.4


def sparkle(amp=0.16):
    out = np.zeros(int(1.2 * SR))
    for k, m in enumerate((84, 88, 91, 96, 100)):
        add(out, bell(m, 0.8, amp * 0.8), k * 0.055)
    return out


def boing(amp=0.18):
    n = int(0.38 * SR)
    t = np.arange(n) / SR
    f = 180 + 520 * (t / t[-1]) ** 0.6
    f *= 1 + 0.08 * np.sin(2 * np.pi * 28 * t)
    return amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.005, 0.18)


# ---------------------------------------------------------------- arrangement
CHORDS = [  # (bass root midi, chord midi notes) — C  F  C  G, one bar each
    (48, (60, 64, 67)),
    (53, (60, 65, 69)),
    (48, (60, 64, 67)),
    (43, (59, 62, 67)),
]
MELODY = [  # eighth-note bell tune per bar (None = rest)
    [76, 79, 79, 76, 72, 74, 76, None],
    [77, 81, 81, 77, 72, 74, 77, None],
    [76, 79, 84, 79, 76, 74, 72, None],
    [74, 77, 79, 77, 74, 71, 67, None],
]

rain0, rain1 = SCENES["rainbow"]
END_HIT = 63.0
bar_len = 4 * BEAT
nbars = int(END_HIT / bar_len) + 1
for b in range(nbars):
    t0 = b * bar_len
    if t0 >= END_HIT:
        break
    root, chord = CHORDS[b % 4]
    for beat in range(4):
        tb = t0 + beat * BEAT
        if tb >= END_HIT:
            break
        # oom-pah bass: root on 1 & 3, fifth on 2 & 4
        add(music, bass(root if beat % 2 == 0 else root + 7), tb)
        if beat % 2 == 0:
            add(music, kick(), tb)
        else:
            add(music, clap(), tb)
        add(music, pluck([midi_hz(m) for m in chord]), tb + BEAT / 2)
        for e8 in range(2):
            add(music, shaker(0.05 if e8 else 0.03), tb + e8 * BEAT / 2)
            add(music, chug(), tb + e8 * BEAT / 2)
    # melody: skip during the sung rainbow chorus so the bells don't fight the vocal
    if not (rain0 - 0.2 <= t0 < rain1):
        for k, m in enumerate(MELODY[b % 4]):
            if m is not None:
                add(music, bell(m, 0.7, 0.13), t0 + k * BEAT / 2)
    else:  # gentle twinkle counter-line in the tunnel
        add(music, bell(chord[-1] + 24, 1.2, 0.07), t0)
        add(music, bell(chord[0] + 24, 1.2, 0.06), t0 + 2 * BEAT)

# final ring-out chord
for m in (48, 60, 64, 67, 72, 76, 79, 84):
    add(music, bell(m, 1.0, 0.12), END_HIT)
add(music, bass(36, 1.0, 0.3), END_HIT)

# fade in / out
fi = int(0.8 * SR)
music[:fi] *= np.linspace(0, 1, fi)
fo = int(0.9 * SR)
music[-fo:] *= np.linspace(1, 0, fo)

for t in WHISTLES:
    add(sfx, whistle(), t)
for t in SPARKLES:
    add(sfx, sparkle(), t)
for t in BOINGS:
    add(sfx, boing(), t)

# ---------------------------------------------------------------- narration
def read_wav(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return d.astype(np.float64) / 32768.0


voice = np.zeros(N)
for i, t in enumerate(VOICE_START, start=1):
    clip = read_wav(os.path.join(VOICE_DIR, f"t{i}.wav"))
    clip = clip / (np.max(np.abs(clip)) + 1e-9) * 0.85
    end = t + len(clip) / SR
    assert end <= DURATION, f"clip {i} overruns ({end:.2f}s)"
    add(voice, clip, t)

# ducking envelope from voice activity
act = lowpass(np.abs(voice), int(0.03 * SR))
act = np.clip(act / 0.05, 0, 1)
duck = lowpass(act, int(0.25 * SR))
music_gain = 0.9 - 0.45 * duck

mix_l = voice * 1.0 + music * music_gain + sfx * 0.9
mix_r = voice * 1.0 + music * music_gain + sfx * 0.9
# tiny stereo width on the music
d = int(0.012 * SR)
mix_r[d:] += 0.08 * music[:-d] * music_gain[d:]
mix = np.stack([mix_l, mix_r], axis=1)
mix = mix / np.max(np.abs(mix)) * 0.95

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wrote", OUT, f"{N / SR:.2f}s")

# loudness-normalise to a typical web level
tmp = OUT.replace(".wav", "_norm.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", OUT, "-af",
                "loudnorm=I=-15:TP=-1.0:LRA=11", "-ar", str(SR), tmp], check=True)
os.replace(tmp, OUT)
print("normalised", OUT)

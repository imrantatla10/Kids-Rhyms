"""Synthesise a serious documentary score + subtle cinematic SFX and mix them under the ElevenLabs narration.

Output: audio/final_mix.wav (48 kHz stereo, 64 s). The narration is the only external audio.
Score: slow 68 BPM in D minor — low drone, warm string-like pads, sparse felt-piano motif, a heartbeat
pulse that enters with the "imagine" scenario, low taiko-style hits on key moments, unresolved ending.
"""
import os
import subprocess

import numpy as np

from timeline import DURATION, EV, SCENES, TRANSITIONS, VOICE_START

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_DIR = os.path.join(ROOT, "audio", "voice")
OUT = os.path.join(ROOT, "audio", "final_mix.wav")
rng = np.random.default_rng(7)

N = int(DURATION * SR)
BPM = 68
BEAT = 60 / BPM
BAR = 4 * BEAT


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def add(buf, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[-1] or i + len(sig) <= 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    j = min(buf.shape[-1], i + len(sig))
    if buf.ndim == 1:
        buf[i:j] += gain * sig[: j - i]
    else:
        buf[0, i:j] += gain * (1 - pan) * sig[: j - i]
        buf[1, i:j] += gain * (1 + pan) * sig[: j - i]


def env(n, a, r):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr:
        e[n - nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def lp(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def hp(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


def reverb(x, decay=2.2, mixv=0.3):
    """Cheap stereo-ish convolution reverb with exponentially decaying noise IR."""
    n = int(decay * SR)
    ir = rng.standard_normal(n) * np.exp(-tt(n) * 6.9 / decay)
    ir = lp(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n
    nfft = 1 << int(np.ceil(np.log2(L)))
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]
    return x * (1 - mixv) + y * mixv * 2.2


# ================================================================ instruments
def string_pad(m, dur, bright=1600):
    n = int(dur * SR)
    t = tt(n)
    sig = np.zeros(n)
    for det in (-0.07, -0.02, 0.03, 0.08):
        f = hz(m + det)
        ph = 2 * np.pi * f * t + rng.uniform(0, 6.28)
        # band-limited saw approximation
        sig += sum(np.sin(k * ph) / k for k in range(1, 9))
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t)
    sig = lp(sig * vib, bright)
    return sig * env(n, min(1.6, dur * 0.4), min(1.6, dur * 0.4)) / 6


def drone(m, dur):
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t + 0.3) + 0.2 * np.sin(2 * np.pi * 3 * f * t)
    s *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t)
    return lp(s, 500) * env(n, 2.0, 2.0)


def piano(m, dur=2.8, vel=1.0):
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    s = np.zeros(n)
    for k, (amp, dec) in enumerate(((1.0, 1.6), (0.45, 2.6), (0.22, 3.6), (0.1, 5.0), (0.05, 6.0))):
        s += amp * np.sin(2 * np.pi * f * (k + 1) * (1 + 0.0004 * k * k) * t) * np.exp(-t * dec)
    hammer = lp(rng.standard_normal(n), 2500) * np.exp(-t * 60) * 0.08
    s = (s + hammer) * env(n, 0.004, 0.3)
    return lp(s, 1500 + 1800 * vel) * vel


def heartbeat():
    n = int(0.5 * SR)
    t = tt(n)
    f = 42 + 30 * np.exp(-t * 25)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    out = np.zeros(int(0.8 * SR))
    out[:n] += s
    d = int(0.24 * SR)
    out[d:d + n] += 0.6 * s
    return out


def taiko():
    n = int(2.0 * SR)
    t = tt(n)
    f = 52 + 60 * np.exp(-t * 18)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    skin = lp(rng.standard_normal(n), 900) * np.exp(-t * 22) * 0.6
    return body + skin


def whoosh(dur=0.7, up=True):
    n = int(dur * SR)
    t = tt(n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blocks = 12
    for k in range(blocks):
        a, b = k * n // blocks, (k + 1) * n // blocks
        u = k / (blocks - 1)
        fc = 300 + 2600 * u if up else 2900 - 2400 * u
        out[a:b] = lp(noise, fc)[a:b]
    return out * np.sin(np.pi * t / dur) ** 2


def riser(dur=1.5):
    n = int(dur * SR)
    t = tt(n)
    f = 120 + 500 * (t / dur) ** 2
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + lp(rng.standard_normal(n), 2500) * 0.35
    return s * (t / dur) ** 2.5


def tick(f=1500):
    n = int(0.25 * SR)
    t = tt(n)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.7 * f * t)) * np.exp(-t * 28)


def soft_pop(f=600):
    n = int(0.2 * SR)
    t = tt(n)
    ff = f * (1 + 0.5 * np.exp(-t * 50))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 22)


def sonar():
    n = int(1.8 * SR)
    t = tt(n)
    s = np.sin(2 * np.pi * 1100 * t) * np.exp(-t * 3.0)
    e = np.zeros(n)
    d = int(0.4 * SR)
    e[d:] = s[:-d] * 0.3
    return s + e


def ship_horn():
    n = int(1.6 * SR)
    t = tt(n)
    s = sum(np.sign(np.sin(2 * np.pi * f * t)) * 0.3 + np.sin(2 * np.pi * f * t) for f in (98, 147))
    return lp(s, 600) * env(n, 0.2, 0.6)


def rumble(dur=3.0):
    n = int(dur * SR)
    return lp(rng.standard_normal(n), 120) * env(n, 1.0, 1.2) * 3


def crack():
    n = int(0.5 * SR)
    t = tt(n)
    return hp(rng.standard_normal(n), 1500) * np.exp(-t * 30) + 0.4 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 20)


def chime(m=86):
    n = int(2.5 * SR)
    t = tt(n)
    f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.76 * f * t)) * np.exp(-t * 2.2)


# ================================================================ score
music = np.zeros((2, N))
# Dm - Bb - Gm - A(sus) ; last section stays on Dm(add9) unresolved
PROG = [[50, 53, 57, 62], [46, 50, 53, 58], [43, 50, 55, 58], [45, 50, 52, 57]]
BASS = [26, 22, 19, 21]
nbars = int(np.ceil(DURATION / BAR))
for b in range(nbars):
    t0 = b * BAR
    ci = b % 4
    last = t0 >= SCENES["diplomacy"][0] - 1.0
    chord = [50, 53, 57, 64] if last else PROG[ci]
    for k, m in enumerate(chord):
        add(music, string_pad(m, BAR + 1.6, 1300 if b < 2 else 1900), t0, 0.05, pan=(-0.4, -0.1, 0.15, 0.4)[k])
    add(music, drone(26 if last else BASS[ci], BAR + 1.6), t0, 0.16)

# piano motif (sparse, two-note sighs) from the timeline scene onward
MOTIF = [(0, 69, 0.8), (1.5, 65, 0.6), (2.5, 67, 0.55), (3.25, 62, 0.7)]
mb = 0
t = SCENES["timeline"][0] - 0.2
while t < DURATION - 4:
    for beat, m, v in MOTIF:
        tm = t + beat * BEAT
        if SCENES["forces"][0] - 0.5 < tm < SCENES["forces"][0] + 2.5:
            continue  # leave space for the "imagine" moment
        add(music, piano(m - (2 if mb % 2 else 0), 3.5, v), tm, 0.11, pan=0.2 if beat % 2 else -0.2)
    t += 2 * BAR
    mb += 1
# end: three single high notes over the question mark
for k, m in enumerate((74, 72, 69)):
    add(music, piano(m, 4.0, 0.6), EV["qmark"] + 0.3 + k * 1.3, 0.12)

# heartbeat pulse under the scenario (forces -> spread), slightly faster during escalation
hb_t = EV["imagine"] + 1.0
while hb_t < SCENES["spread"][1] - 0.5:
    g = 0.45 if hb_t < SCENES["hormuz"][0] else 0.32
    add(music, heartbeat(), hb_t, g)
    hb_t += BEAT * (1.0 if hb_t < SCENES["hormuz"][0] else 1.25)

music[0] = reverb(music[0], 2.6, 0.32)
music[1] = reverb(music[1], 2.9, 0.32)
fade = np.ones(N)
fade[: int(1.2 * SR)] = np.linspace(0, 1, int(1.2 * SR)) ** 2
fo = int(2.5 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
music *= fade

# ================================================================ sfx
sfx = np.zeros((2, N))
add(sfx, taiko(), 0.35, 0.5)
add(sfx, rumble(3.0), 0.0, 0.25)
add(sfx, soft_pop(520), EV["iran"], 0.25, 0.2)
add(sfx, soft_pop(640), EV["usa"], 0.25, -0.4)
for k in range(4):
    add(sfx, tick(1300 + 120 * k), EV["complex"] + 0.25 * k, 0.07, (-0.3, 0.3, -0.1, 0.1)[k])
for tr in TRANSITIONS:
    add(sfx, whoosh(0.8), tr - 0.45, 0.16)
# timeline
add(sfx, taiko(), EV["strikes"] - 0.05, 0.38, -0.3)
add(sfx, tick(1100), EV["y2026"] - 0.3, 0.1)
add(sfx, soft_pop(700), EV["ceasefire"] - 0.15, 0.18)
add(sfx, soft_pop(820), EV["diplomatic"] - 0.15, 0.18)
add(sfx, crack(), EV["failed"], 0.22, 0.2)
add(sfx, tick(900), EV["settlement"] - 0.4, 0.1, 0.5)
# issues
for key, f, pn in (("nuclear", 600, -0.4), ("sanctions", 680, 0.0), ("strait", 760, 0.4)):
    add(sfx, soft_pop(f), EV[key] - 0.2, 0.2, pn)
add(sfx, rumble(2.5), EV["disagree"], 0.25)
# scenario
add(sfx, riser(1.4), EV["imagine"] - 1.3, 0.16)
add(sfx, taiko(), EV["escalation"], 0.45)
add(sfx, rumble(4.0), EV["escalation"], 0.35)
add(sfx, whoosh(1.0, up=False), EV["us_forces"] - 0.3, 0.12, -0.6)
add(sfx, lp(rng.standard_normal(int(2.2 * SR)), 900) * env(int(2.2 * SR), 0.8, 1.0), EV["air"] - 0.3, 0.07, -0.5)
add(sfx, whoosh(1.0, up=False), EV["iran_side"] - 0.3, 0.12, 0.6)
for k in range(3):
    add(sfx, soft_pop(500 + 60 * k), EV["missiles"] - 0.35 + 0.15 * k, 0.16, 0.5)
add(sfx, soft_pop(900), EV["drones"] - 0.2, 0.14, 0.6)
add(sfx, ship_horn(), EV["shipping"] - 0.1, 0.07, 0.4)
# no easy victory / hormuz
add(sfx, crack(), EV["victory"], 0.25)
add(sfx, taiko(), EV["victory"] + 0.05, 0.3)
add(sfx, sonar(), EV["wider"] + 0.2, 0.06)
add(sfx, ship_horn(), EV["gulf"] - 0.5, 0.06, -0.2)
# economy
add(sfx, soft_pop(620), EV["trade"], 0.16, -0.5)
for k in range(3):
    add(sfx, soft_pop(420 + 50 * k), EV["energy"] - 0.6 + 0.18 * k, 0.16, 0.0)
add(sfx, riser(1.6), EV["energy"] + 0.5, 0.12, 0.4)
# spread
for k in range(8):
    add(sfx, tick(1000 + 40 * k), EV["question"] + 0.2 + 0.22 * (k // 2) + 0.1 * (k % 2), 0.05, -0.5 if k % 2 == 0 else 0.5)
add(sfx, taiko(), EV["spread"], 0.35)
add(sfx, rumble(3.0), EV["spread"], 0.25)
# diplomacy / question mark
add(sfx, chime(81), EV["diplomacy"], 0.07)
add(sfx, chime(86), EV["qmark"] + 1.1, 0.09)
add(sfx, taiko(), EV["qmark"] + 1.15, 0.2)
sfx[0] = reverb(sfx[0], 1.6, 0.22)
sfx[1] = reverb(sfx[1], 1.8, 0.22)


# ================================================================ voice
def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1",
                          "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


voice = np.zeros(N)
for i, t in enumerate(VOICE_START):
    v = load(os.path.join(VOICE_DIR, f"v{i + 1}.wav"))
    assert t + len(v) / SR <= DURATION, i
    add(voice, v, t)
voice *= 0.9 / np.max(np.abs(voice))
# a touch of room on the voice so it sits with the score
vr = reverb(voice, 0.9, 0.06)

win = int(0.05 * SR)
rms = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode="same"))
active = (rms > 0.02).astype(float)
k = int(0.35 * SR)
active = np.convolve(active, np.ones(k) / k, mode="same")
duck = 1.0 - 0.65 * np.clip(active * 1.5, 0, 1)

mixd = music * duck * 0.4 + sfx * (0.4 + 0.25 * duck) + vr[None, :]
peak = np.max(np.abs(mixd))
mixd *= 0.95 / peak
print("peak before norm", round(peak, 3))

pcm = (np.clip(mixd.T, -1, 1) * 32767).astype("<i2")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", OUT],
               input=pcm.tobytes(), check=True)
print("wrote", OUT)


def _db(x):
    return round(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12), 1)


vm = active > 0.5
print("voice rms (voiced)", _db(vr[vm]), " music (voiced)", _db((0.4 * music * duck)[0][vm]),
      " sfx (voiced)", _db(0.5 * sfx[0][vm]), " music (gaps)", _db((0.4 * music * duck)[0][~vm]))

# final loudness: about -15 LUFS integrated, true peak below -1.5 dBTP
tmp = OUT.replace(".wav", "_pre.wav")
os.replace(OUT, tmp)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-af", "loudnorm=I=-15:TP=-1.5:LRA=11",
                "-ar", str(SR), OUT], check=True)
os.remove(tmp)
print("loudness-normalised", OUT)

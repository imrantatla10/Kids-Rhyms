"""Synthesise a political-documentary score + cinematic SFX and mix them under the ElevenLabs narration.

Output: audio/final_mix.wav (48 kHz stereo, 64 s). The narration is the only external audio.
Score: 76 BPM in D minor: low drone, string-like pads, a sparse piano motif, a soft pulse under
the statistics, low hits on key moments and a long crescendo into the final question. The ending is left unresolved.
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
BPM = 76
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
# Dm - Bb - F - C ; last scene: Dm -> Bb(add9) swell, unresolved
PROG = [[50, 53, 57, 62], [46, 50, 53, 58], [45, 48, 53, 57], [43, 48, 52, 55]]
BASS = [26, 22, 29, 24]
nbars = int(np.ceil(DURATION / BAR))
fin = SCENES["final"][0]
for b in range(nbars):
    t0 = b * BAR
    ci = b % 4
    last = t0 >= fin - 1.0
    chord = ([50, 53, 57, 64] if (b % 2 == 0) else [46, 50, 57, 60]) if last else PROG[ci]
    bright = 1300 if b < 2 else (2600 if last else 1900)
    g = 0.05 if not last else 0.05 + 0.05 * min(1, (t0 - fin + 1) / 8)
    for k, m in enumerate(chord):
        add(music, string_pad(m, BAR + 1.6, bright), t0, g, pan=(-0.4, -0.1, 0.15, 0.4)[k])
        if last:
            add(music, string_pad(m + 12, BAR + 1.6, 3200), t0, g * 0.45, pan=(0.4, 0.1, -0.15, -0.4)[k])
    add(music, drone(26 if last else BASS[ci], BAR + 1.6), t0, 0.16)

# sparse piano motif from the poll onward (rests during the hook)
MOTIF = [(0, 69, 0.8), (1.5, 65, 0.6), (2.5, 67, 0.55), (3.25, 62, 0.7)]
mb = 0
t = SCENES["poll"][0] + 0.2
while t < fin - 2:
    for beat, m, v in MOTIF:
        add(music, piano(m - (2 if mb % 2 else 0), 3.5, v), t + beat * BEAT, 0.10, pan=0.2 if beat % 2 else -0.2)
    t += 2 * BAR
    mb += 1
# final: rising piano line over the question
for k, m in enumerate((62, 65, 69, 74)):
    add(music, piano(m, 4.0, 0.7), EV["road"] + k * 0.55, 0.12)

# soft pulse (low tom-ish heartbeat) under the statistics scenes
hb_t = SCENES["poll"][0] + 0.3
while hb_t < SCENES["generation"][1] - 0.5:
    add(music, heartbeat(), hb_t, 0.22)
    hb_t += BEAT * 2
# pulse returns, faster, as the music rises at the end
hb_t = EV["spotlight"] - 1.0
while hb_t < DURATION - 2.2:
    add(music, heartbeat(), hb_t, 0.3)
    hb_t += BEAT

music[0] = reverb(music[0], 2.6, 0.32)
music[1] = reverb(music[1], 2.9, 0.32)
fade = np.ones(N)
fade[: int(1.0 * SR)] = np.linspace(0, 1, int(1.0 * SR)) ** 2
fo = int(1.6 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
music *= fade


def paper():
    n = int(0.45 * SR)
    t = tt(n)
    return hp(rng.standard_normal(n), 2500) * np.exp(-t * 9) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t))


def thunk():
    n = int(0.5 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * (90 + 60 * np.exp(-t * 30)) * t) * np.exp(-t * 14) + lp(rng.standard_normal(n), 600) * np.exp(-t * 30) * 0.5


def count_ticks(buf, t0, dur, gain, pan, f=1400):
    k = 0
    while k * 0.06 < dur:
        add(buf, tick(f + 25 * k), t0 + k * 0.06, gain * (1 - 0.5 * k * 0.06 / dur), pan)
        k += 1


# ================================================================ sfx
sfx = np.zeros((2, N))
add(sfx, taiko(), 0.25, 0.55)
add(sfx, rumble(3.5), 0.0, 0.3)
add(sfx, whoosh(1.2, up=False), EV["leave"] + 0.5, 0.18, -0.4)
add(sfx, taiko(), EV["leave_end"] - 0.1, 0.3)
add(sfx, whoosh(1.0), EV["back_inside"] - 0.3, 0.12, 0.3)
for k in range(12):
    add(sfx, chime(86 + (k % 4) * 2), EV["eu_union"] + k * 0.1, 0.025, -0.6 + 0.1 * k)
add(sfx, riser(2.0), EV["question"] - 0.4, 0.14)
add(sfx, taiko(), SCENES["poll"][0] - 0.05, 0.42)
for tr in TRANSITIONS:
    add(sfx, whoosh(0.8), tr - 0.45, 0.16)
# poll numbers
for key, pn in (("n56", -0.4), ("n30", 0.4), ("n63", -0.4), ("n34", 0.4)):
    count_ticks(sfx, EV[key] - 0.35, 0.95, 0.05, pn)
    add(sfx, soft_pop(620 if pn < 0 else 520), EV[key] + 0.6, 0.22, pn)
add(sfx, whoosh(0.9), EV["likely"] - 0.4, 0.2)
for k in range(5):
    add(sfx, soft_pop(700 + 60 * k), EV["likely"] + 0.08 * k, 0.1, -0.4 + 0.2 * k)
# generation
add(sfx, crack(), EV["divide"] + 0.1, 0.12)
add(sfx, whoosh(0.8, up=False), EV["divide"] + 0.2, 0.12, -0.5)
add(sfx, whoosh(0.8, up=False), EV["divide"] + 0.6, 0.12, 0.5)
count_ticks(sfx, EV["n73"] - 0.3, 1.0, 0.05, 0.3)
add(sfx, chime(84), EV["n73"] + 0.65, 0.07, 0.3)
count_ticks(sfx, EV["n39"] - 0.3, 0.8, 0.05, 0.3, 1200)
add(sfx, soft_pop(480), EV["n39"] + 0.6, 0.2, 0.3)
# politics
add(sfx, taiko(), EV["pm"], 0.25)
add(sfx, chime(81), EV["lifetime"], 0.05)
add(sfx, riser(0.9), EV["route"] - 0.2, 0.08, 0.3)
add(sfx, taiko(), EV["route"] + 0.9, 0.3)
add(sfx, soft_pop(300), EV["route"] + 0.9, 0.2)
add(sfx, tick(900), EV["parliament"] + 0.2, 0.08)
add(sfx, soft_pop(340), EV["parliament"] + 0.8, 0.2)
add(sfx, chime(86), EV["parliament"] + 1.0, 0.05, 0.5)
# referendum
add(sfx, paper(), EV["ballot"] - 0.2, 0.12)
add(sfx, paper(), EV["ballot"] + 0.5, 0.1)
add(sfx, thunk(), EV["ballot"] + 1.2, 0.35)
count_ticks(sfx, EV["n49"] - 0.3, 1.1, 0.05, 0.0, 1300)
add(sfx, chime(83), EV["n49"] + 0.8, 0.07)
for k in range(6):
    add(sfx, paper(), EV["referendum"] + 0.08 * k, 0.04, -0.5 + 0.2 * k)
add(sfx, rumble(2.0), EV["not_guaranteed"], 0.2)
add(sfx, sonar(), EV["not_guaranteed"] + 1.0, 0.04)
# final
add(sfx, taiko(), SCENES["final"][0], 0.3)
add(sfx, riser(3.0), EV["spotlight"] - 2.4, 0.12)
add(sfx, chime(81), EV["spotlight"], 0.05)
add(sfx, riser(2.2), EV["road_back"] - 1.6, 0.16)
add(sfx, taiko(), EV["v_end"] + 0.1, 0.42)
add(sfx, rumble(2.5), EV["v_end"] + 0.1, 0.25)
add(sfx, chime(86), EV["v_end"] + 0.15, 0.06)
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

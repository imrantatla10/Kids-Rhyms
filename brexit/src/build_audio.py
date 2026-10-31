"""Synthesise the documentary music bed + SFX and mix them with the ElevenLabs narration.

Output: audio/final_mix.wav (44.1 kHz stereo, 64 s). Narration is the only external audio.
"""
import os
import subprocess

import numpy as np

from timeline import DURATION, EV, SCENES, TRANSITIONS, VOICE_START

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_DIR = os.path.join(ROOT, "audio", "voice")
OUT = os.path.join(ROOT, "audio", "final_mix.wav")
rng = np.random.default_rng(11)

N = int(DURATION * SR)
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def add(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= buf.shape[-1] or i + len(sig) <= 0:
        return
    j = min(buf.shape[-1], i + len(sig))
    if buf.ndim == 1:
        buf[i:j] += gain * sig[: j - i]
    else:
        buf[:, i:j] += gain * sig[: j - i]


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na)
    e[na:na + nd] = np.linspace(1, s, nd)
    if nr < n:
        e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def lp_fft(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def hp_fft(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


# ================================================================ music
music = np.zeros((2, N))

# D minor progression: Dm - Bb - F - C  (one chord per bar)
CHORDS = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]
ROOTS = [38, 34, 41, 36]


def pad_note(m, dur):
    n = int(dur * SR)
    t = tt(n)
    sig = np.zeros(n)
    for det in (-0.08, 0.0, 0.08):
        f = hz(m + det)
        sig += np.sign(np.sin(2 * np.pi * f * t)) * 0.25 + np.sin(2 * np.pi * f * t)
    sig = lp_fft(sig, 1400)
    return sig * adsr(n, 0.6, 0.4, 0.8, 0.8)


def bass_note(m, dur):
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)
    return sig * adsr(n, 0.005, 0.15, 0.6, 0.08)


def kick():
    n = int(0.35 * SR)
    t = tt(n)
    f = 45 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9)


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    s = hp_fft(rng.standard_normal(n), 7000)
    return s * np.exp(-tt(n) * (18 if open_ else 70))


def tick():
    n = int(0.03 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 200)


def pluck(m, dur=0.4):
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    sig = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return sig * np.exp(-t * 7)


nbars = int(np.ceil(DURATION / BAR)) + 1
pad_cache = {}
for b in range(nbars):
    t0 = b * BAR
    ci = b % 4
    for m in CHORDS[ci]:
        key = m
        if key not in pad_cache:
            pad_cache[key] = pad_note(m, BAR + 0.6)
        sig = pad_cache[key]
        add(music[0], sig, t0, 0.055)
        add(music[1], sig, t0 + 0.012, 0.055)
    # pulsing eighth-note bass
    for e in range(8):
        add(music, bass_note(ROOTS[ci], BEAT / 2 * 0.9), t0 + e * BEAT / 2, 0.16 if e % 2 == 0 else 0.10)
    # arpeggio plucks (from bar 2 onward, sparser in hook)
    if b >= 1:
        arp = CHORDS[ci] + [CHORDS[ci][0] + 12]
        for k in range(8):
            m = arp[[0, 1, 2, 3, 2, 1, 2, 3][k]] + 12
            pan = 0.35 if k % 2 else -0.35
            s = pluck(m)
            add(music[0], s, t0 + k * BEAT / 2, 0.045 * (1 - pan))
            add(music[1], s, t0 + k * BEAT / 2, 0.045 * (1 + pan))
    # drums
    for q in range(4):
        tq = t0 + q * BEAT
        add(music, kick(), tq, 0.42 if q in (0, 2) else 0.0)
        if b >= 1:
            add(music, hat(), tq + BEAT / 2, 0.05)
            add(music, tick(), tq, 0.035)
        if q in (1, 3) and b >= 2:
            add(music, hat(True), tq, 0.035)

# gentle fade in / out
fade = np.ones(N)
fi = int(0.4 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fo = int(1.5 * SR)
fade[-fo:] = np.linspace(1, 0.0, fo)
music *= fade

# ================================================================ sfx
sfx = np.zeros((2, N))


def whoosh(dur=0.5, up=True):
    n = int(dur * SR)
    t = tt(n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    # sweep band by stitching filtered blocks
    blocks = 10
    for k in range(blocks):
        a, b = k * n // blocks, (k + 1) * n // blocks
        u = k / (blocks - 1)
        fc = 400 + 3200 * u if up else 3600 - 3000 * u
        seg = lp_fft(noise, fc)[a:b]
        out[a:b] = seg
    env = np.sin(np.pi * t / dur) ** 1.5
    return out * env * 0.9


def pop(freq=900):
    n = int(0.12 * SR)
    t = tt(n)
    f = freq * (1 + 0.6 * np.exp(-t * 60))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 30)


def impact():
    n = int(1.2 * SR)
    t = tt(n)
    f = 38 + 70 * np.exp(-t * 12)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.5)
    noise = lp_fft(rng.standard_normal(n), 2500) * np.exp(-t * 10) * 0.5
    return body + noise


def riser(dur=1.0):
    n = int(dur * SR)
    t = tt(n)
    f = 200 + 900 * (t / dur) ** 2
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3
    s += lp_fft(rng.standard_normal(n), 3000) * 0.4
    return s * (t / dur) ** 2


def swell(dur=1.0):
    n = int(dur * SR)
    t = tt(n)
    f = 300 + 300 * (t / dur)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return s * np.sin(np.pi * t / dur) * 0.4


def chime(m=84):
    n = int(0.9 * SR)
    t = tt(n)
    f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.76 * f * t)) * np.exp(-t * 5)


def stamp():
    n = int(0.35 * SR)
    t = tt(n)
    s = lp_fft(rng.standard_normal(n), 1200) * np.exp(-t * 18)
    s += np.sin(2 * np.pi * 90 * t) * np.exp(-t * 14)
    return s


def horn():
    n = int(1.3 * SR)
    t = tt(n)
    s = sum(np.sign(np.sin(2 * np.pi * f * t)) * 0.3 + np.sin(2 * np.pi * f * t) for f in (110, 165))
    return lp_fft(s, 700) * adsr(n, 0.15, 0.2, 0.8, 0.4)


# title impact + riser into hook
add(sfx, impact(), 0.25, 0.55)
add(sfx, pop(700), 1.55, 0.35)           # question mark pop
add(sfx, whoosh(0.45), 2.4, 0.18)        # EU flag fades / slips away
for t in TRANSITIONS:
    add(sfx, whoosh(0.5), t - 0.25, 0.30)
# dates
for t in (EV["date1"], EV["date2"]):
    add(sfx, stamp(), t, 0.45)
    add(sfx, pop(1000), t + 0.05, 0.25)
# trade
add(sfx, horn(), SCENES["trade"][0] + 0.6, 0.10)
add(sfx, swell(1.2), SCENES["trade"][0] + 2.0, 0.18)
add(sfx, pop(620), EV["goods_pct"], 0.45)
add(sfx, pop(1100), EV["serv_pct"], 0.45)
add(sfx, chime(86), EV["serv_pct"] + 0.05, 0.12)
# migration
add(sfx, stamp(), EV["fm_ended"], 0.5)
add(sfx, pop(800), EV["disappear"], 0.3)
for k, key in enumerate(("total", "noneu", "eu", "british")):
    add(sfx, swell(0.9), EV[key], 0.16)
    add(sfx, pop(700 + 120 * k), EV[key] + 0.85, 0.3)
# economy
add(sfx, pop(900), EV["watchdog"], 0.25)
add(sfx, riser(1.0), EV["four"] - 1.0, 0.18)
add(sfx, impact(), EV["four"], 0.35)
# deals
add(sfx, chime(81), EV["powers"], 0.14)
add(sfx, chime(88), EV["cptpp"], 0.16)
add(sfx, pop(1200), EV["gdp2bn"], 0.3)
# final
add(sfx, pop(600), EV["control"], 0.25)
add(sfx, pop(500), EV["challenges"], 0.25)
add(sfx, riser(1.0), EV["price"] - 0.9, 0.2)
add(sfx, impact(), EV["price"] + 0.1, 0.35)
add(sfx, chime(84), EV["win"], 0.18)
add(sfx, stamp(), EV["lose"], 0.4)

# ================================================================ voice
def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1",
                          "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


voice = np.zeros(N)
for i, t in enumerate(VOICE_START):
    v = load(os.path.join(VOICE_DIR, f"v{i + 1}.wav"))
    end = t + len(v) / SR
    assert end <= DURATION, (i, end)
    add(voice, v, t)
peak = np.max(np.abs(voice))
voice *= 0.89 / peak

# ducking envelope from voice RMS
win = int(0.05 * SR)
rms = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode="same"))
active = (rms > 0.02).astype(float)
k = int(0.25 * SR)
active = np.convolve(active, np.ones(k) / k, mode="same")
duck = 1.0 - 0.55 * np.clip(active * 1.5, 0, 1)

mix = np.zeros((2, N))
mix += music * duck * 0.95
mix += sfx * 0.85
mix += voice[None, :] * 1.0
peak = np.max(np.abs(mix))
mix *= 0.97 / max(peak, 1e-9) if peak > 0.97 else 1.0
print("peak", peak)

pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2",
                "-i", "-", OUT], input=pcm.tobytes(), check=True)
print("wrote", OUT)

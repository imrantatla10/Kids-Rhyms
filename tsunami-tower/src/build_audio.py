"""Mix: ElevenLabs voiceover (audio/vo.wav, already sped up 1.15x) + synthesised SFX.

SFX are placed from the line timings in src/timing.json, matching scene.js.
The SFX bus is ducked under the voice. Output: audio/final_mix.wav (48 kHz stereo).
"""
import json
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(5)
TM = json.load(open(os.path.join(ROOT, "src/timing.json")))
LS = [l["s"] for l in TM["lines"]]
DUR = np.ceil((TM["lines"][-1]["e"] + 1.3) * 30) / 30
end = lambda i: LS[i + 1] if i + 1 < len(LS) else DUR
at = lambda i, f: LS[i] + f * (end(i) - LS[i])

with wave.open(os.path.join(ROOT, "audio/vo.wav")) as w:
    vo = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, w.getnchannels()).astype(np.float64).T / 32768
N = int(DUR * SR)
voice = np.zeros((2, N)); n = min(N, vo.shape[1]); voice[:, :n] = vo[:2, :n] if vo.shape[0] > 1 else np.vstack([vo[0, :n]] * 2)
sfx = np.zeros((2, N))
wat = np.zeros((2, N))   # water sounds: muted wherever the voice speaks


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))


def env(n, decay, attack=0.002):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def add(sig, t, pan=0.0, gain=1.0, bus=None):
    bus = sfx if bus is None else bus
    i = int(round(t * SR))
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0
    m = min(len(sig), N - i); ang = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    bus[0, i:i + m] += sig[:m] * gain * np.cos(ang); bus[1, i:i + m] += sig[:m] * gain * np.sin(ang)


noise = lambda n: rng.standard_normal(n)


def shaped(dur, lo, hi, attack, release):
    n = int(dur * SR); t = np.arange(n) / SR
    return fft_filter(noise(n), lo, hi) * np.minimum(1, t / attack) * np.minimum(1, (dur - t) / release)


def wave_roar(dur, impact, size=1.0):
    """rumble that builds to a crash at `impact` seconds, then rushing water"""
    n = int(dur * SR); t = np.arange(n) / SR
    build = np.clip(t / impact, 0, 1) ** 2
    after = np.exp(-np.maximum(0, t - impact) / (1.5 * size))
    body = fft_filter(noise(n), 40, 900) * (0.3 + 0.7 * build) * np.where(t < impact, 1, after * 0.8 + 0.2)
    hiss = fft_filter(noise(n), 1500, 9000) * 0.35 * np.where(t < impact, build, after)
    out = (body + hiss) * size
    i = int(impact * SR); m = min(n - i, int(2.5 * SR))
    if m > 0:
        tt = np.arange(m) / SR
        out[i:i + m] += (np.sin(2 * np.pi * np.cumsum(45 + 40 * np.exp(-tt / 0.1)) / SR) * env(m, 0.4) + fft_filter(noise(m), 80, 5000) * env(m, 0.6, 0.005)) * size
    return out * np.minimum(1, (dur - t) / 0.5)


def scrape(dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    return fft_filter(noise(n), 900, 5000) * np.sin(np.pi * t / dur) ** 2 * 0.6 + fft_filter(noise(n), 100, 600) * env(n, 0.05) * 0.5


def thud(f0=70, dur=0.5, ring=None):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * np.cumsum(f0 + f0 * np.exp(-t / 0.03)) / SR) * env(n, 0.12) + fft_filter(noise(n), 100, 3000) * env(n, 0.03) * 0.5
    if ring:
        for f in ring: s += np.sin(2 * np.pi * f * t) * env(n, 0.3) * 0.15
    return s


def crack():
    n = int(1.6 * SR); out = np.zeros(n)
    for _ in range(40):
        i = int(abs(rng.normal(0.3, 0.3)) * SR); ln = int(rng.uniform(0.005, 0.03) * SR)
        if i + ln < n: out[i:i + ln] += fft_filter(noise(ln), 1500, 9000) * rng.uniform(0.3, 1.0)
    t = np.arange(n) / SR
    return out + fft_filter(noise(n), 30, 300) * env(n, 0.6, 0.05) * 0.8


def whoosh(dur=0.5, up=True, lo=300):
    n = int(dur * SR); t = np.arange(n) / SR; x = noise(n); out = np.zeros(n); blk = 2048
    for i in range(0, n, blk):
        c = (i + blk / 2) / n; cen = lo * (1 + 10 * (c if up else 1 - c)); seg = x[i:i + blk]
        out[i:i + len(seg)] = fft_filter(np.pad(seg, (0, blk - len(seg))), cen * 0.6, cen * 1.8)[:len(seg)]
    return out * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5


def pop():
    n = int(0.12 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (500 + 900 * t / 0.12) * t) * env(n, 0.03, 0.002) * 0.6


def chime(freqs, dur=1.4, spacing=0.0):
    n = int((dur + spacing * len(freqs)) * SR); out = np.zeros(n)
    for k, f in enumerate(freqs):
        i = int(k * spacing * SR); m = n - i; t = np.arange(m) / SR
        out[i:] += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(m, 0.6, 0.004) * 0.3
    return out


def steps(dur, rate, hard=True):
    n = int(dur * SR); out = np.zeros(n)
    for k in range(int(dur * rate)):
        i = int((k / rate + rng.uniform(-0.01, 0.01)) * SR); ln = int(0.06 * SR)
        if 0 <= i < n - ln: out[i:i + ln] += (fft_filter(noise(ln), 200 if hard else 80, 4000 if hard else 1500) * env(ln, 0.015)) * rng.uniform(0.5, 1)
    return out


def gull():
    n = int(0.7 * SR); t = np.arange(n) / SR
    f = 1400 + 500 * np.sin(np.pi * t / 0.7) - 300 * t
    return np.tanh(2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * t / 0.7) ** 2 * 0.15


# ---------------------------------------------------------------- beds
t = np.arange(N) / SR
surf = fft_filter(noise(N), 60, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 7.0) ** 2) * 0.22
surf += fft_filter(noise(N), 2000, 7000) * (0.3 + 0.7 * np.sin(2 * np.pi * t / 7.0 + 0.6) ** 6) * 0.05
xray = (t >= LS[10]) & (t < end(10))
surf[xray] *= 0.25
wat[0] += surf; wat[1] += fft_filter(noise(N), 60, 1800) * (0.5 + 0.5 * np.cos(2 * np.pi * t / 8.0) ** 2) * 0.22 * np.where(xray, 0.25, 1)
for g in np.arange(2.0, DUR, 9.5):
    add(gull(), g + rng.uniform(0, 2), pan=rng.uniform(-0.7, 0.7), gain=0.6)

# flowing water while the open tower stands in the flood (lines 7-9, 11-12)
for i, lvl in [(7, 0.9), (8, 0.7), (9, 0.8), (11, 0.9), (12, 0.8), (20, 0.4), (21, 0.35)]:
    add(shaped(end(i) - LS[i] + 0.4, 100, 3500, 0.3, 0.4) * lvl * 0.5, LS[i] - 0.1, bus=wat)

# ---------------------------------------------------------------- events per line
dig_rate = 6 * 1.3 / (2 * np.pi)
for k in range(int((end(0) - 0.2) * dig_rate)): add(scrape(), 0.15 + k / dig_rate, pan=0.2, gain=0.6)
add(wave_roar(end(1) - LS[1] + 1.5, at(1, 0.42) - LS[1], 0.7), LS[1], gain=0.9, bus=wat)
add(whoosh(1.4, True, 200), at(2, 0.1), gain=0.6)
for k in range(int((at(3, 0.6) - LS[3]) * dig_rate * 1.15)): add(scrape(), LS[3] + 0.1 + k / (dig_rate * 1.15), pan=0.3, gain=0.55)
add(steps(end(3) - at(3, 0.6), 3.5, hard=False), at(3, 0.6), gain=0.5)
add(wave_roar(end(4) - LS[4] + 2.0, at(4, 0.45) - LS[4], 1.2), LS[4], gain=1.0, bus=wat)
add(steps(at(4, 0.6) - at(4, 0.15), 4.5, hard=False), at(4, 0.15), gain=0.45)
add(shaped(end(5) - LS[5], 30, 400, 0.3, 0.4) * 0.8, LS[5], gain=0.8)   # concrete pour rumble
for k in range(6): add(thud(60, 0.5), LS[5] + 0.3 + k * (end(5) - LS[5]) * 0.13, gain=0.5)
add(wave_roar(end(6) - LS[6] + 1.5, at(6, 0.35) - LS[6], 1.2), LS[6], gain=1.0, bus=wat)
add(crack(), at(6, 0.36), gain=1.0); add(crack(), at(6, 0.6), gain=0.9)
for k in range(10): add(whoosh(0.4, True, 500) * 0.3 + thud(50, 0.4) * 0.2, at(9, 0.1 + k * 0.08), pan=rng.uniform(-0.5, 0.5), gain=0.5, bus=wat)  # swirl
for k in range(int((at(10, 0.75) - at(10, 0.1)) / 0.38)):
    add(thud(55, 0.7, ring=[230, 410, 690]), at(10, 0.1) + k * 0.38, gain=0.9)                        # pile driver
for d in [(0.0, -26, 2.2), (0.25, -30, 2.05), (0.45, -36, 2.2), (0.6, -40, 2.05), (0.75, -44, 2.05)]:
    hit = LS[11] + d[0] + (-2.45 - d[2] - d[1]) / 15
    add(thud(65, 0.6, ring=[320, 540, 910]), hit, pan=rng.uniform(-0.5, 0.5), gain=0.9)
    add(fft_filter(noise(int(0.4 * SR)), 300, 5000) * env(int(0.4 * SR), 0.08), hit, gain=0.5)
add(whoosh(0.6, True, 400), at(12, 0.0), gain=0.5)
for k in range(5): add(scrape(0.6), LS[12] + 0.8 + k * 0.25, pan=rng.uniform(-0.6, 0.6), gain=0.4)
# minutes of warning: clock + siren + running feet
for k in range(int(end(13) - LS[13])): add(thud(1800, 0.05) * 0.4, LS[13] + k * 1.0, gain=0.4)
siren_d = end(13) - LS[13]; sn = int(siren_d * SR); st = np.arange(sn) / SR
add(np.sin(2 * np.pi * np.cumsum(650 + 250 * np.sin(2 * np.pi * st / 2.4)) / SR) * 0.12 * np.minimum(1, st / 0.5) * np.minimum(1, (siren_d - st) / 0.5), LS[13], gain=0.7)
add(steps(end(13) - LS[13], 7), LS[13], gain=0.35)
add(steps(end(14) - at(14, 0.45), 8), at(14, 0.45), gain=0.5)
add(shaped(end(15) - LS[15] + 0.5, 25, 250, 0.8, 0.5), LS[15], gain=0.9, bus=wat)                 # distant monster wave
add(whoosh(1.6, True, 150), at(16, 0.1), gain=0.6); add(chime([660, 880, 1320], spacing=0.08), at(16, 0.27), gain=0.7)
drain = end(17) - LS[17]; dn = int(drain * SR); dt_ = np.arange(dn) / SR
add(whoosh(drain * 0.5, False, 250) * 0.8, LS[17], gain=0.6, bus=wat)
for k in range(6): add(np.sin(2 * np.pi * 1000 * np.arange(int(0.12 * SR)) / SR) * 0.2, at(17, 0.64) + k * 0.22, gain=0.5)
add(steps(end(17) - at(17, 0.5), 8), at(17, 0.5), gain=0.45)
add(wave_roar(end(19) - LS[19] + 2.0, at(19, 0.4) - LS[19], 1.3), LS[19], gain=1.0, bus=wat)
rd = end(20) - LS[20]; rn = int(rd * SR); rt = np.arange(rn) / SR
add(fft_filter(noise(rn), 600, 3200) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.1 * rt) ** 2) * 0.08, LS[20], pan=0.4)    # radio
for k in range(14): add(fft_filter(noise(int(0.02 * SR)), 2000, 8000) * 0.3, at(20, 0.5) + k * 0.09, pan=0.5, gain=0.5)  # crab clicks
add(chime([523, 659, 784, 1047], dur=2.0, spacing=0.12), LS[21] + 0.05, gain=0.8)
# transitions and graphic pops
for i in range(1, len(LS)): add(whoosh(0.35, True, 500), LS[i] - 0.2, gain=0.25)
for i, f in [(0, 0.62), (1, 0.45), (2, 0.55), (3, 0.45), (4, 0.6), (5, 0.5), (6, 0.45), (7, 0.35), (8, 0.1), (9, 0.35), (10, 0.12), (10, 0.3), (10, 0.5),
             (11, 0.55), (12, 0.12), (13, 0.0), (14, 0.35), (15, 0.45), (16, 0.05), (16, 0.6), (17, 0.08), (17, 0.62), (18, 0.45), (19, 0.3), (20, 0.05), (20, 0.2), (20, 0.62), (21, 0.08)]:
    add(pop(), at(i, f), gain=0.6)

# ---------------------------------------------------------------- duck SFX under the voice, then master
venv = np.abs(voice).max(axis=0)
k = int(0.05 * SR); venv = np.convolve(venv, np.ones(k) / k, mode="same")
duck = 1 - 0.55 * np.clip(venv / 0.15, 0, 1)
# water: fully off while the voice speaks (held through the short gaps between words), quieter elsewhere
k2 = int(0.45 * SR)
talk = np.convolve((venv > 0.01).astype(float), np.ones(k2) / k2, mode="same") > 0.02
gate = np.convolve((~talk).astype(float), np.ones(int(0.12 * SR)) / int(0.12 * SR), mode="same")
mix = voice * 1.0 + sfx * duck * 0.55 + wat * gate * 0.3
mix = np.tanh(mix * 1.05) / np.tanh(1.05)
mix /= np.max(np.abs(mix)) / 0.9
fade = int(0.6 * SR); mix[:, -fade:] *= np.linspace(1, 0, fade)
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(os.path.join(ROOT, "audio/final_mix.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote audio/final_mix.wav", DUR)

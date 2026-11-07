"""Synthesised sound effects for the water pit video (no voice, no music).

Reads audio/events.json (from `node src/render.mjs --events`) and the timing
constants in src/timeline.js, and writes audio/final_mix.wav (48 kHz stereo).

Layers:
  * game layer on simulation time (engines, hydraulic ramp, crashes, splashes,
    bubbles, debris, chains, paddle churn), time-warped onto the edit, so the
    hook replay and the slow-motion windows are slowed down and pitched down;
  * edit layer on output time: camera whooshes, slow-motion booms, hook
    riser, damage-counter ticks, WRECKED stamps, end card hits, wind.
"""
import json
import os
import re
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(77)

ev = json.load(open(os.path.join(ROOT, "audio/events.json")))
js = open(os.path.join(ROOT, "src/timeline.js")).read()
num = lambda name: float(re.search(rf"export const {name} = ([0-9.]+)", js).group(1))
CRASH_TIMES = [float(x) for x in re.search(r"CRASH_TIMES = \[([^\]]+)\]", js).group(1).split(",")]
HEAVY = [x.strip() == "true" for x in re.search(r"HEAVY = \[([^\]]+)\]", js).group(1).split(",")]
HOOK_LEN, OUT_DUR, HOOK_RATE = num("HOOK_LEN"), num("OUT_DURATION"), num("HOOK_RATE")
HOOK_SIM0 = CRASH_TIMES[4] - 0.55
SLOW = [((t - 0.25, t + 1.35, 0.3) if h else (t - 0.2, t + 0.6, 0.33)) for t, h in zip(CRASH_TIMES, HEAVY)]


def segments():
    segs, s, o = [], 0.0, 0.0
    for a, b, f in SLOW:
        segs.append((s, a, o, 1.0)); o += a - s
        segs.append((a, b, o, f)); o += (b - a) / f
        s = b
    segs.append((s, 1e9, o, 1.0))
    return segs


SEGS = segments()


def main_out_to_sim(tm):
    tm = np.asarray(tm, dtype=np.float64)
    res = np.zeros_like(tm)
    for s0, s1, o0, rate in SEGS:
        m = tm >= o0
        res[m] = s0 + (tm[m] - o0) * rate
    return res


def out_to_sim(to):
    to = np.asarray(to, dtype=np.float64)
    return np.where(to < HOOK_LEN, HOOK_SIM0 + to * HOOK_RATE, main_out_to_sim(to - HOOK_LEN))


def sim_to_out(ts):
    for s0, s1, o0, rate in SEGS:
        if ts <= s1:
            return HOOK_LEN + o0 + (ts - s0) / rate
    return 0.0


# ---------------------------------------------------------------- dsp helpers
def fft_filter(x, lo=None, hi=None):
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, n)


def env_exp(n, decay, attack=0.002):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def pan_gains(p):
    ang = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.cos(ang), np.sin(ang)


def add(buf, sig, t, pan=0.0, gain=1.0):
    i = int(round(t * SR))
    if i >= buf.shape[1] or i + len(sig) <= 0:
        return
    if i < 0:
        sig = sig[-i:]; i = 0
    n = min(len(sig), buf.shape[1] - i)
    gl, gr = pan_gains(pan)
    buf[0, i:i + n] += sig[:n] * gain * gl
    buf[1, i:i + n] += sig[:n] * gain * gr


noise = lambda n: rng.standard_normal(n)


def crash(intensity=1.0, size=1.0, glass=200):
    n = int(2.4 * size * SR); t = np.arange(n) / SR
    out = np.sin(2 * np.pi * np.cumsum(38 + 70 * np.exp(-t / (0.09 * size))) / SR) * env_exp(n, 0.3 * size, 0.003) * 1.3
    out += fft_filter(noise(n), 60, 5000) * env_exp(n, 0.15 * size, 0.001) * 0.9
    for _ in range(int(14 * size + 8)):
        gt = abs(rng.normal(0, 0.2 * size)); gl = int(rng.uniform(0.012, 0.05) * SR); i = int(gt * SR)
        if i + gl < n:
            out[i:i + gl] += fft_filter(noise(gl), rng.uniform(250, 900), rng.uniform(1500, 4500)) * np.hanning(gl) * rng.uniform(0.3, 0.8) * np.exp(-gt / (0.5 * size))
    for _ in range(7):
        out += np.sin(2 * np.pi * rng.uniform(180, 1700) * t + rng.uniform(0, 6)) * env_exp(n, rng.uniform(0.2, 0.8) * size) * rng.uniform(0.04, 0.12)
    gn = min(n, int(1.5 * SR))
    out[:gn] += fft_filter(noise(gn), 3500, 14000) * env_exp(gn, 0.2, 0.004) * 0.5 * min(1.5, glass / 200)
    for _ in range(int(min(240, glass * 0.35))):
        ln = int(rng.uniform(0.015, 0.06) * SR); i = int((0.02 + abs(rng.exponential(0.3))) * SR)
        if i + ln < n:
            out[i:i + ln] += np.sin(2 * np.pi * rng.uniform(2600, 7800) * np.arange(ln) / SR) * env_exp(ln, rng.uniform(0.006, 0.02), 0.0005) * rng.uniform(0.05, 0.2)
    return out * intensity


def splash(size=1.0):
    dur = 1.2 + 1.6 * size
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.sin(2 * np.pi * np.cumsum(55 + 50 * np.exp(-t / 0.08)) / SR) * env_exp(n, 0.25, 0.004) * 0.9 * size  # whump
    out += fft_filter(noise(n), 150, 2500) * env_exp(n, 0.35 * (0.6 + size * 0.5), 0.006) * 1.0                 # body
    out += fft_filter(noise(n), 2000, 11000) * env_exp(n, 0.5 + 0.4 * size, 0.01) * 0.35                       # spray
    # falling droplets patter
    for _ in range(int(120 * size)):
        i = int((0.25 + abs(rng.normal(0, 0.45 * size))) * SR); ln = int(0.012 * SR)
        if i + ln < n:
            out[i:i + ln] += fft_filter(noise(ln), 1500, 9000) * np.hanning(ln) * rng.uniform(0.05, 0.25)
    # bubbles / gurgles
    for _ in range(int(25 * size)):
        i = int(rng.uniform(0.15, dur * 0.85) * SR); ln = int(rng.uniform(0.03, 0.08) * SR)
        if i + ln < n:
            tt = np.arange(ln) / SR; f0 = rng.uniform(300, 900)
            out[i:i + ln] += np.sin(2 * np.pi * (f0 * tt + 2500 * tt * tt)) * np.sin(np.pi * tt / tt[-1]) * rng.uniform(0.04, 0.12)
    return out


def clatter(kind, mag):
    if kind == "wheel":
        n = int(0.35 * SR); t = np.arange(n) / SR
        s = np.sin(2 * np.pi * (70 + 60 * np.exp(-t / 0.03)) * t) * env_exp(n, 0.08) + fft_filter(noise(n), 100, 1200) * env_exp(n, 0.04) * 0.4
    elif kind in ("panel", "car"):
        n = int(0.5 * SR); t = np.arange(n) / SR
        s = fft_filter(noise(n), 400, 5000) * env_exp(n, 0.035) * 0.8
        for _ in range(4):
            s += np.sin(2 * np.pi * rng.uniform(500, 2400) * t) * env_exp(n, rng.uniform(0.05, 0.18)) * 0.12
    else:
        n = int(0.12 * SR); s = fft_filter(noise(n), 900, 7000) * env_exp(n, 0.012) * 0.6
    return s * mag


def chain_clank(level=1.0):
    n = int(0.5 * SR); t = np.arange(n) / SR
    s = fft_filter(noise(n), 800, 6000) * env_exp(n, 0.01) * 0.5
    for fr in rng.uniform(900, 3200, 4):
        s += np.sin(2 * np.pi * fr * t) * env_exp(n, rng.uniform(0.04, 0.12)) * 0.12
    return s * level


def horn(freqs, dur, level=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.tanh(3 * np.sin(2 * np.pi * f * t)) * 0.5 for f in freqs)
    return fft_filter(s, 150, 3500) * np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.08) * level


def hydraulic(dur=1.1):
    n = int(dur * SR); t = np.arange(n) / SR
    whine = np.sin(2 * np.pi * np.cumsum(180 + 220 * t / dur) / SR) * 0.25
    hiss = fft_filter(noise(n), 2500, 9000) * 0.25
    return (whine + hiss) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7


def clank(level=1.0):
    n = int(0.6 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 85 * t) * env_exp(n, 0.12) + fft_filter(noise(n), 200, 3000) * env_exp(n, 0.05) * 0.6
    for fr in (310, 520, 870):
        s += np.sin(2 * np.pi * fr * t) * env_exp(n, 0.25) * 0.12
    return s * level


def whoosh(dur, rising=True, lo=300):
    n = int(dur * SR); t = np.arange(n) / SR
    x = noise(n); out = np.zeros(n); blk = 2048
    for i in range(0, n, blk):
        c = (i + blk / 2) / n
        cen = lo * (1 + 12 * (c if rising else 1 - c))
        seg = x[i:i + blk]
        out[i:i + len(seg)] = fft_filter(np.pad(seg, (0, blk - len(seg))), cen * 0.6, cen * 1.8)[:len(seg)]
    return out * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6


def sub_boom(dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * np.cumsum(30 + 40 * np.exp(-t / 0.25)) / SR) * env_exp(n, 0.9, 0.01)
    return s + fft_filter(noise(n), 20, 400) * env_exp(n, 1.2, 0.02) * 0.6


def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    tone = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 1.5 * (t / dur) ** 2)) / SR) for f in (110, 165, 220)) * 0.2
    return (tone + whoosh(dur, True, 150) * 0.6) * (t / dur) ** 2


def tick(freq):
    n = int(0.03 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * env_exp(n, 0.008, 0.0005)


def stamp():
    n = int(0.7 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (60 + 80 * np.exp(-t / 0.03)) * t) * env_exp(n, 0.15) * 1.2
    s += fft_filter(noise(n), 300, 6000) * env_exp(n, 0.03) * 0.7
    for fr in (440, 660, 990):
        s += np.sin(2 * np.pi * fr * t) * env_exp(n, 0.35) * 0.1
    return s


def chime(freqs, dur=1.2):
    n = int(dur * SR); t = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * t) * env_exp(n, 0.5, 0.004) for f in freqs) * 0.25


def reverb(x, secs=1.0, mix=0.16):
    n = int(secs * SR)
    ir = fft_filter(noise(n) * np.exp(-np.arange(n) / SR / (secs / 5)), 120, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    N = 1 << (len(x) + n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:len(x)]
    return x * (1 - mix) + y * mix * 1.5


# ---------------------------------------------------------------- game layer (simulation time)
SIM_DUR = float(main_out_to_sim(np.array([OUT_DUR - HOOK_LEN]))[0]) + 0.5
NS = int(SIM_DUR * SR)
game = np.zeros((2, NS))
ts = np.arange(NS) / SR
paddle_rate = 8 * 1.5 / (2 * np.pi)
churn = fft_filter(noise(NS), 80, 1200) * (0.6 + 0.4 * np.sin(2 * np.pi * paddle_rate * ts) ** 2)
churn += fft_filter(noise(NS), 1500, 5000) * 0.15 * np.sin(2 * np.pi * paddle_rate * ts + 1) ** 6
game += churn * 0.12
game += 0.05 * np.sin(2 * np.pi * 50 * ts) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.3 * ts))  # pump hum

CAM = np.array([0.0, 24.0, 27.0])
heavy_names = {"bus", "semi"}
tr_t = np.array([s["t"] for s in ev["tracks"]])
for vi, v in enumerate(ev["vehicles"]):
    z = np.full(len(tr_t), np.nan); spd = np.zeros(len(tr_t)); xs = np.zeros(len(tr_t))
    for k, s in enumerate(ev["tracks"]):
        d = s["v"][vi]
        if d is not None:
            z[k], spd[k], xs[k] = d
    valid = ~np.isnan(z)
    if not valid.any():
        continue
    dist = np.where(valid, np.sqrt((np.nan_to_num(z) - CAM[2]) ** 2 + CAM[1] ** 2 + xs ** 2), 1e9)
    gs = np.interp(ts, tr_t, np.where(valid, np.clip(16.0 / dist, 0, 1.0), 0.0))
    k = int(0.03 * SR); gs = np.convolve(gs, np.ones(k) / k, mode="same")
    sp = np.interp(ts, tr_t, spd)
    heavy = v["name"] in heavy_names
    base = (34 if heavy else 70) * (0.6 + 0.4 * sp / 30)
    ph = 2 * np.pi * np.cumsum(base) / SR
    eng = np.tanh(sum(a * np.sin((h + 1) * ph + h) for h, a in enumerate([1.0, 0.7, 0.5, 0.35, 0.25, 0.18, 0.12])) * (1.6 if heavy else 1.3))
    eng += fft_filter(noise(NS), 200, 2500) * (0.35 if heavy else 0.2)
    gl, gr = pan_gains(float(np.clip(v["x"] / 6, -0.6, 0.6)))
    game[0] += eng * gs * gl * 0.5
    game[1] += eng * gs * gr * 0.5

for v in ev["vehicles"]:
    big = v["name"] in heavy_names
    add(game, hydraulic(1.1), v["launch"] - 1.35, gain=0.45)
    add(game, clank(1.0), v["launch"], gain=0.6)
    add(game, whoosh(0.5, True, 400), v["launch"] - 0.05, gain=0.35)
    if v["name"] == "bus":
        add(game, horn([311, 392], 1.0, 0.9), v["launch"] - 1.7, gain=0.6)
    if v["name"] == "semi":
        add(game, horn([196, 247, 294], 1.4, 1.0), v["launch"] - 2.0, gain=0.7)
    add(game, crash(1.5 if big else 1.0, 1.5 if big else 1.0, 600 if big else 200), v["contact"], pan=float(np.clip(v["x"] / 6, -0.5, 0.5)))
    for k in range(5):
        add(game, chain_clank(rng.uniform(0.4, 0.9)), v["contact"] + 0.1 + k * rng.uniform(0.1, 0.25), pan=rng.choice([-0.8, 0.8]), gain=0.45)

for s in ev["splashes"]:
    add(game, splash(min(2.4, s["size"])), s["t"], pan=float(np.clip(s["x"] / 7, -0.6, 0.6)), gain=1.1 if not s.get("small") else 0.5)
for c in ev["clatter"]:
    add(game, clatter(c["kind"], min(1.0, c["mag"] * 1.4)), c["t"], pan=float(np.clip(c["x"] / 7, -0.8, 0.8)), gain=0.5)

game[0] = reverb(game[0]); game[1] = reverb(game[1])

NO = int(OUT_DUR * SR)
to = np.arange(NO) / SR
src = out_to_sim(to) * SR
mix = np.zeros((2, NO))
idx = np.arange(NS)
for ch in range(2):
    mix[ch] = np.interp(src, idx, game[ch])
# the hook -> main jump would click: tiny crossfade
j = int(HOOK_LEN * SR); f = int(0.03 * SR)
mix[:, j - f:j + f] *= np.concatenate([np.linspace(1, 0, f), np.linspace(0, 1, f)])

# ---------------------------------------------------------------- edit layer (output time)
mix[0] += fft_filter(noise(NO), 60, 900) * 0.04
mix[1] += fft_filter(noise(NO), 60, 900) * 0.04

contact_out = [sim_to_out(v["contact"]) for v in ev["vehicles"]]
hook_bus = (ev["vehicles"][4]["contact"] - HOOK_SIM0) / HOOK_RATE
# hook: riser into the bus impact, boom, then the jump to the start
add(mix, riser(hook_bus), 0.0, gain=0.45)
add(mix, sub_boom(3.5), hook_bus, gain=1.0)
add(mix, crash(0.6, 1.2, 150), hook_bus, gain=0.45)
add(mix, whoosh(0.6, True), HOOK_LEN - 0.55, gain=0.6)
add(mix, stamp(), HOOK_LEN, gain=0.55)  # "LET'S GO!"
for k in range(int(1.6 / 0.07)):  # damage counter in the hook
    add(mix, tick(900 + 40 * k), hook_bus + k * 0.07, gain=0.12)

# camera cuts
for s in ev["shots"]:
    if s["t0"] < HOOK_LEN:
        continue
    if s["type"] == "chase":
        add(mix, whoosh(0.45, True, 500), s["t0"] - 0.2, gain=0.35)
    else:
        add(mix, whoosh(0.6, False, 250), s["t0"] - 0.25, gain=0.45)

for i, c in enumerate(contact_out):
    big = HEAVY[i]
    add(mix, sub_boom(3.5 if big else 2.2), c, gain=0.95 if big else 0.6)
    add(mix, crash(0.6, 1.0, 120), c, gain=0.45 if big else 0.35)
    dur = 2.4 if big else 1.4
    for k in range(int(dur / 0.07)):
        add(mix, tick(900 + 40 * k), c + k * 0.07, gain=0.1)
    add(mix, stamp(), c + (1.4 if big else 0.8), gain=0.55)

end_t = OUT_DUR - 3.6
add(mix, sub_boom(3.0), end_t, gain=0.8)
add(mix, stamp(), end_t + 0.05, gain=0.5)
add(mix, chime([660, 880, 1320]), end_t + 1.0, gain=0.6)

# ---------------------------------------------------------------- master
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.max(np.abs(mix)) / 0.89
fade = int(0.5 * SR); mix[:, -fade:] *= np.linspace(1, 0, fade)
pcm = (mix.T * 32767).astype(np.int16)
out = os.path.join(ROOT, "audio/final_mix.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", out, f"{OUT_DUR}s")

"""Synthesised sound effects for the crusher crash video (no voice, no music).

Reads audio/events.json (written by `node src/render.mjs --events`) and writes
audio/final_mix.wav (48 kHz stereo, 64 s).

Two layers:
  * a "game" layer built on simulation time (engines, horns, crashes, glass,
    debris, crusher rumble, chains) that is time-warped onto the output
    timeline, so the slow-motion windows are naturally slowed and pitched down;
  * an output-time layer (wind, slow-motion whooshes and sub booms).
"""
import json
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(2024)

ev = json.load(open(os.path.join(ROOT, "audio/events.json")))
TL = ev["timeline"]
OUT_DUR = TL["outDuration"]
SLOW = TL["slow"]
SF = TL["slowFactor"]


# ---------------------------------------------------------------- time mapping
def segments():
    segs, s, o = [], 0.0, 0.0
    for a, b in SLOW:
        segs.append((s, a, o, 1.0)); o += a - s
        segs.append((a, b, o, SF)); o += (b - a) / SF
        s = b
    segs.append((s, 1e9, o, 1.0))
    return segs


SEGS = segments()


def out_to_sim(to):
    to = np.asarray(to, dtype=np.float64)
    res = np.zeros_like(to)
    for s0, s1, o0, rate in SEGS:
        m = to >= o0
        res[m] = s0 + (to[m] - o0) * rate
    return res


def sim_to_out(ts):
    for s0, s1, o0, rate in SEGS:
        if ts <= s1:
            return o0 + (ts - s0) / rate
    return 0.0


SIM_DUR = float(out_to_sim(np.array([OUT_DUR]))[0]) + 0.5


# ---------------------------------------------------------------- dsp helpers
def fft_filter(x, lo=None, hi=None, sr=SR):
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / sr)
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, n)


def env_exp(n, decay_s, attack_s=0.002):
    t = np.arange(n) / SR
    a = np.minimum(1, t / max(attack_s, 1e-4))
    return a * np.exp(-t / decay_s)


def pan_gains(p):
    p = np.clip(p, -1, 1)
    ang = (p + 1) * np.pi / 4
    return np.cos(ang), np.sin(ang)


def add(buf, sig, t, pan=0.0, gain=1.0):
    i = int(round(t * SR))
    if i >= buf.shape[1] or i + len(sig) <= 0:
        return
    j0 = max(0, -i)
    sig = sig[j0:]
    i = max(0, i)
    n = min(len(sig), buf.shape[1] - i)
    gl, gr = pan_gains(pan)
    buf[0, i:i + n] += sig[:n] * gain * gl
    buf[1, i:i + n] += sig[:n] * gain * gr


def noise(n):
    return rng.standard_normal(n)


# ---------------------------------------------------------------- sound recipes
def crash(intensity=1.0, size=1.0, glass=200, drum=False):
    dur = 2.6 * size
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    # low body thump with a falling pitch
    f = 38 + 70 * np.exp(-t / (0.09 * size))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out += np.sin(ph) * env_exp(n, 0.32 * size, 0.003) * 1.3
    # initial broadband smash
    out += fft_filter(noise(n), 60, 5000) * env_exp(n, 0.16 * size, 0.001) * 0.9
    # crunch grains: crumpling metal
    for _ in range(int(14 * size + 8)):
        gt = abs(rng.normal(0, 0.22 * size))
        gl = int(rng.uniform(0.012, 0.05) * SR)
        g = fft_filter(noise(gl), rng.uniform(250, 900), rng.uniform(1500, 4500)) * np.hanning(gl)
        i = int(gt * SR)
        if i + gl < n:
            out[i:i + gl] += g * rng.uniform(0.3, 0.8) * np.exp(-gt / (0.5 * size))
    # metallic ring
    for k in range(7):
        fr = rng.uniform(180, 1700) * (0.7 if size > 1.2 else 1.0)
        out += np.sin(2 * np.pi * fr * t + rng.uniform(0, 6)) * env_exp(n, rng.uniform(0.25, 0.9) * size, 0.002) * rng.uniform(0.04, 0.12)
    if drum:  # heavy steel drum clang
        for fr in (96, 151, 233, 388, 612):
            out += np.sin(2 * np.pi * fr * t) * env_exp(n, 1.3, 0.002) * 0.16
    # glass: hiss burst plus scattered tinkles
    gn = min(n, int(1.6 * SR))
    gl_ = np.zeros(n)
    gl_[:gn] += fft_filter(noise(gn), 3500, 14000) * env_exp(gn, 0.22, 0.004) * 0.5 * min(1.5, glass / 200)
    for _ in range(int(min(260, glass * 0.35))):
        tt = abs(rng.exponential(0.32))
        ln = int(rng.uniform(0.015, 0.06) * SR)
        i = int((0.02 + tt) * SR)
        if i + ln >= n:
            continue
        fr = rng.uniform(2600, 7800)
        tk = np.sin(2 * np.pi * fr * np.arange(ln) / SR) * env_exp(ln, rng.uniform(0.006, 0.02), 0.0005)
        gl_[i:i + ln] += tk * rng.uniform(0.05, 0.22)
    out += gl_
    return out * intensity


def clatter(kind, mag):
    if kind == "wheel":
        n = int(0.35 * SR); t = np.arange(n) / SR
        s = np.sin(2 * np.pi * (70 + 60 * np.exp(-t / 0.03)) * t) * env_exp(n, 0.08) + fft_filter(noise(n), 100, 1200) * env_exp(n, 0.04) * 0.4
    elif kind == "panel":
        n = int(0.5 * SR); t = np.arange(n) / SR
        s = fft_filter(noise(n), 400, 5000) * env_exp(n, 0.035) * 0.8
        for _ in range(4):
            s += np.sin(2 * np.pi * rng.uniform(500, 2400) * t) * env_exp(n, rng.uniform(0.05, 0.18)) * 0.12
    else:
        n = int(0.12 * SR)
        s = fft_filter(noise(n), 900, 7000) * env_exp(n, 0.012) * 0.6
    return s * mag


def chain_clank(level=1.0):
    n = int(0.5 * SR); t = np.arange(n) / SR
    s = fft_filter(noise(n), 800, 6000) * env_exp(n, 0.01) * 0.5
    for fr in rng.uniform(900, 3200, 4):
        s += np.sin(2 * np.pi * fr * t) * env_exp(n, rng.uniform(0.04, 0.12)) * 0.12
    return s * level


def horn(freqs, dur, level=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        ph = 2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 5.5 * t) * 0.02
        s += np.tanh(3 * np.sin(ph)) * 0.5
    s = fft_filter(s, 150, 3500)
    env = np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.08)
    return s * env * level


def whoosh(dur, rising=True):
    n = int(dur * SR); t = np.arange(n) / SR
    x = noise(n)
    out = np.zeros(n)
    blk = 2048
    for i in range(0, n, blk):
        c = (i + blk / 2) / n
        cen = 300 * (1 + 12 * (c if rising else 1 - c))
        seg = x[i:i + blk]
        out[i:i + len(seg)] = fft_filter(np.pad(seg, (0, blk - len(seg))), cen * 0.6, cen * 1.8)[:len(seg)]
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    return out * env


def sub_boom(dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 30 + 40 * np.exp(-t / 0.25)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.9, 0.01)
    s += fft_filter(noise(n), 20, 400) * env_exp(n, 1.2, 0.02) * 0.6
    return s


def reverb(x, secs=1.1, mix=0.18):
    n = int(secs * SR)
    ir = noise(n) * np.exp(-np.arange(n) / SR / (secs / 5))
    ir = fft_filter(ir, 120, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n
    N = 1 << (L - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:len(x)]
    return x * (1 - mix) + y * mix * 1.5


# ---------------------------------------------------------------- game layer (sim time)
NS = int(SIM_DUR * SR)
game = np.zeros((2, NS))
ts = np.arange(NS) / SR

# crusher drum rumble: hum + rib thumps + grinding noise
rib_rate = 12 * 1.7 / (2 * np.pi)
rumble = 0.35 * np.sin(2 * np.pi * 43 * ts) + 0.18 * np.sin(2 * np.pi * 86 * ts + 1)
rumble *= 0.75 + 0.25 * np.sin(2 * np.pi * rib_rate * ts) ** 2
rumble += fft_filter(noise(NS), 40, 380) * 0.35
rumble += fft_filter(noise(NS), 900, 3000) * (0.04 + 0.03 * np.sin(2 * np.pi * rib_rate * ts) ** 8)
game += rumble * 0.22

# idle chain clanks
t = 0.3
while t < SIM_DUR - 0.5:
    add(game, chain_clank(rng.uniform(0.25, 0.6)), t, pan=rng.uniform(-0.7, 0.7), gain=0.5)
    t += rng.uniform(0.35, 1.1)

# engines from sampled tracks
CAM = np.array([0.0, 24.0, 31.0])
names = [v["name"] for v in ev["vehicles"]]
heavy = {"bus", "boxtruck"}
tr_t = np.array([s["t"] for s in ev["tracks"]])
for vi, name in enumerate(names):
    z = np.full(len(tr_t), np.nan); spd = np.zeros(len(tr_t)); xs = np.zeros(len(tr_t))
    for k, s in enumerate(ev["tracks"]):
        d = s["v"][vi]
        if d is not None:
            z[k], spd[k], xs[k] = d
    valid = ~np.isnan(z)
    if not valid.any():
        continue
    dist = np.where(valid, np.sqrt((np.nan_to_num(z) - CAM[2]) ** 2 + CAM[1] ** 2 + xs ** 2), 1e9)
    g = np.where(valid, np.clip(14.0 / dist, 0, 1.0), 0.0)
    gs = np.interp(ts, tr_t, g)
    # smooth onset/cut
    k = int(0.03 * SR)
    gs = np.convolve(gs, np.ones(k) / k, mode="same")
    sp = np.interp(ts, tr_t, spd)
    base = (34 if name in heavy else 62) * (0.6 + 0.4 * sp / 30)
    ph = 2 * np.pi * np.cumsum(base) / SR
    eng = np.zeros(NS)
    for h, a in enumerate([1.0, 0.7, 0.5, 0.35, 0.25, 0.18, 0.12]):
        eng += a * np.sin((h + 1) * ph + h)
    eng = np.tanh(eng * (1.6 if name in heavy else 1.2))
    eng += fft_filter(noise(NS), 200, 2500) * (0.35 if name in heavy else 0.2)
    pan = float(np.clip(np.nanmean(xs[valid]) / 6, -0.6, 0.6))
    gl, gr = pan_gains(pan)
    game[0] += eng * gs * gl * 0.55
    game[1] += eng * gs * gr * 0.55

# horns
for v in ev["vehicles"]:
    if v["name"] == "bus":
        add(game, horn([311, 392], 1.0, 0.9), v["contact"] - 1.7, gain=0.6)
    if v["name"] == "boxtruck":
        add(game, horn([196, 247, 294], 1.4, 1.0), v["contact"] - 2.0, gain=0.7)

# crashes
CR = {"microcar": (1.0, 1.0, 160), "hatchback": (1.0, 1.0, 180), "sedan": (1.05, 1.0, 180), "wagon": (1.1, 1.05, 220),
      "bus": (1.6, 1.6, 650), "minivan": (1.1, 1.05, 220), "pickup": (1.2, 1.1, 200), "boxtruck": (1.7, 1.7, 380)}
for v in ev["vehicles"]:
    inten, size, gl = CR[v["name"]]
    add(game, crash(inten, size, gl, drum=v.get("hitDrum", False)), v["contact"], pan=float(np.clip(v["x"] / 6, -0.5, 0.5)), gain=1.0)
    # chains rattle hard after every hit
    for k in range(int(6 * size)):
        add(game, chain_clank(rng.uniform(0.5, 1.0)), v["contact"] + 0.1 + k * rng.uniform(0.08, 0.2), pan=rng.uniform(-0.8, 0.8), gain=0.6)
    if v["name"] in heavy:  # pile being shoved: scraping metal
        n = int(1.3 * SR); tt = np.arange(n) / SR
        scr = fft_filter(noise(n), 300, 2600) * np.sin(np.pi * np.clip(tt / 1.3, 0, 1)) * 0.5
        scr += np.sin(2 * np.pi * (380 + 90 * np.sin(2 * np.pi * 3 * tt)) * tt) * 0.08 * np.sin(np.pi * tt / 1.3)
        add(game, scr, v["contact"] + 0.05, gain=0.8)

# debris bounces
for c in ev["clatter"]:
    add(game, clatter(c["kind"], min(1.0, c["mag"] * 1.4)), c["t"], pan=float(np.clip(c["x"] / 7, -0.8, 0.8)), gain=0.55)

game[0] = reverb(game[0]); game[1] = reverb(game[1])

# warp game layer onto the output timeline
NO = int(OUT_DUR * SR)
to = np.arange(NO) / SR
src = out_to_sim(to) * SR
mix = np.zeros((2, NO))
idx = np.arange(NS)
for ch in range(2):
    mix[ch] = np.interp(src, idx, game[ch])

# ---------------------------------------------------------------- output layer
wind = fft_filter(noise(NO), 60, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * to / 9.0) ** 2)
mix[0] += wind * 0.05
mix[1] += fft_filter(noise(NO), 60, 900) * (0.6 + 0.4 * np.cos(2 * np.pi * to / 11.0) ** 2) * 0.05

for a, b in SLOW:
    oa, ob = sim_to_out(a), sim_to_out(b)
    add(mix, whoosh(0.9, True), oa - 0.55, gain=0.55)
    add(mix, whoosh(0.6, False), ob - 0.25, gain=0.4)
for v in ev["vehicles"]:
    if v["name"] in heavy:
        add(mix, sub_boom(3.5), v["contactOut"], gain=0.9)
        add(mix, crash(0.6, 1.0, 120), v["contactOut"], gain=0.5)  # crisp transient on top of the slowed one

# ---------------------------------------------------------------- master
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.max(np.abs(mix)) / 0.89
fade = int(0.6 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)
mix[:, :int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
pcm = (mix.T * 32767).astype(np.int16)
out = os.path.join(ROOT, "audio/final_mix.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out, f"{OUT_DUR}s")

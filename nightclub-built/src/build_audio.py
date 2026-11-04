"""Background music (original, synthesised) + sound effects under the Jesse voiceover (nightclub video, Dan voice).

Output: audio/final_mix.wav. Beat times come from the voice word timings (audio/voice/segments.json).
"""
import json, os, re, subprocess
import numpy as np

SR = 48000
DUR = float(os.environ.get("DUR", "65.5"))
N = int(DUR * SR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(3)
BPM = 112
BEAT = 60 / BPM


def tt(n): return np.arange(n) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)


def add(buf, sig, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1] or i + len(sig) <= 0: return
    if i < 0: sig, i = sig[-i:], 0
    j = min(buf.shape[1], i + len(sig))
    buf[0, i:j] += g * (1 - pan) * sig[:j - i]
    buf[1, i:j] += g * (1 + pan) * sig[:j - i]


def adsr(n, a=0.005, d=0.1, s=0.0, r=0.05):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[na:na + nd] = np.linspace(1, s, len(e[na:na + nd]))
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def pluck(m, dur=0.35, bright=1.0):
    n = int(dur * SR); x = tt(n); f = hz(m)
    s = np.sin(2 * np.pi * f * x) + 0.4 * bright * np.sin(4 * np.pi * f * x) + 0.15 * bright * np.sin(6 * np.pi * f * x)
    return s * np.exp(-x * 9) * adsr(n, 0.002, 0.01, 1, 0.02)


def marimba(m, dur=0.5):
    n = int(dur * SR); x = tt(n); f = hz(m)
    s = np.sin(2 * np.pi * f * x) * np.exp(-x * 7) + 0.3 * np.sin(2 * np.pi * f * 4 * x) * np.exp(-x * 25)
    return s * adsr(n, 0.002, 0.01, 1, 0.03)


def musicbox(m, dur=0.9):
    n = int(dur * SR); x = tt(n); f = hz(m)
    s = np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 3.01 * x) * np.exp(-x * 6)
    return s * np.exp(-x * 4) * adsr(n, 0.002, 0.01, 1, 0.05)


def bass(m, dur=0.25):
    n = int(dur * SR); x = tt(n); f = hz(m)
    s = np.tanh(2.2 * np.sin(2 * np.pi * f * x)) * 0.8 + 0.3 * np.sin(np.pi * f * x)
    return s * adsr(n, 0.004, 0.08, 0.6, 0.05)


def kick():
    n = int(0.25 * SR); x = tt(n)
    f = 45 + 110 * np.exp(-x * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 14)


def noise(n): return rng.standard_normal(n)


def snare():
    n = int(0.18 * SR); x = tt(n)
    return (0.6 * noise(n) * np.exp(-x * 22) + 0.4 * np.sin(2 * np.pi * 190 * x) * np.exp(-x * 30))


def hat(open_=False):
    n = int((0.12 if open_ else 0.04) * SR); x = tt(n)
    s = np.diff(noise(n + 1)); return s * np.exp(-x * (18 if open_ else 80)) * 0.5


def lp(x, a):  # one-pole lowpass
    y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)): acc += a * (x[i] - acc); y[i] = acc
    return y


def lp_fast(x, k):  # moving-average lowpass (fast)
    return np.convolve(x, np.ones(k) / k, 'same')


# ---------------------------------------------------------------- SFX
def whoosh(d=0.5, up=True):
    n = int(d * SR); x = tt(n)
    s = noise(n); s = lp_fast(s, 6) - lp_fast(s, 40)
    e = np.sin(np.pi * x / d) ** 2
    return s * e * 2.0


def thud(f=70, d=0.35):
    n = int(d * SR); x = tt(n)
    return (np.sin(2 * np.pi * (f + 60 * np.exp(-x * 25)) * x) * np.exp(-x * 11) + 0.3 * lp_fast(noise(n), 12) * np.exp(-x * 25))


def clang(f=520, d=0.8):
    n = int(d * SR); x = tt(n)
    s = sum(a * np.sin(2 * np.pi * f * r * x) * np.exp(-x * k) for a, r, k in [(1, 1, 5), (.6, 2.76, 7), (.4, 5.4, 10), (.3, 8.9, 14)])
    return s * 0.5 + 0.3 * noise(n) * np.exp(-x * 60)


def crunch(d=0.7):
    n = int(d * SR); x = tt(n)
    s = noise(n) * (rng.random(n) > 0.6) * np.exp(-x * 4)
    s += 0.6 * np.sign(np.sin(2 * np.pi * 37 * x)) * lp_fast(noise(n), 30) * np.exp(-x * 6)
    return lp_fast(s, 3) * 0.9


def rumble(d=1.6):
    n = int(d * SR); x = tt(n)
    s = lp_fast(noise(n), 200) * 8 + np.sin(2 * np.pi * 38 * x) * 0.5
    return s * np.sin(np.pi * x / d)


def dig(d=0.9):
    n = int(d * SR); x = tt(n)
    s = np.zeros(n)
    for k in range(5):
        i = int((k * 0.17 + 0.02) * SR); m = int(0.12 * SR)
        if i + m < n: s[i:i + m] += lp_fast(noise(m), 4) * np.exp(-tt(m) * 30)
    return s


def pour(d=1.5):
    n = int(d * SR); x = tt(n)
    s = lp_fast(noise(n), 30) * 3 + 0.3 * np.sin(2 * np.pi * (90 + 20 * np.sin(x * 9)) * x)
    return s * np.minimum(1, x * 6) * np.minimum(1, (d - x) * 4)


def wind(d=3.0):
    n = int(d * SR); x = tt(n)
    s = lp_fast(noise(n), 25) - lp_fast(noise(n), 120)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * x) * np.sin(2 * np.pi * 1.9 * x)
    return s * am * np.sin(np.pi * x / d) * 4


def click():
    n = int(0.06 * SR); x = tt(n)
    return (np.sin(2 * np.pi * 2400 * x) * 0.5 + noise(n) * 0.7) * np.exp(-x * 120)


def motor(d=1.5, f0=90, f1=160):
    n = int(d * SR); x = tt(n)
    f = np.linspace(f0, f1, n)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.2
    return lp_fast(s, 8) * np.minimum(1, x * 8) * np.minimum(1, (d - x) * 8)


def tweet():
    n = int(0.16 * SR); x = tt(n)
    f = 2800 + 1400 * np.sin(np.pi * x / 0.16)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / 0.16) * 0.6


def shimmer(d=1.2):
    s = np.zeros(int(d * SR))
    for k, m in enumerate([84, 88, 91, 96, 100, 103]):
        p = musicbox(m, 0.6); i = int(k * 0.12 * SR); s[i:i + len(p)] += p[:len(s) - i] * 0.6
    return s


def switch_on(m):
    n = int(0.14 * SR); x = tt(n)
    return np.sin(2 * np.pi * hz(m) * x) * np.exp(-x * 20) * 0.7 + noise(n) * np.exp(-x * 200) * 0.3


def beep(m, d=0.12):
    n = int(d * SR); x = tt(n)
    return np.sign(np.sin(2 * np.pi * hz(m) * x)) * 0.25 * adsr(n, 0.002, 0.01, 1, 0.01)


def error_buzz(d=0.5):
    n = int(d * SR); x = tt(n)
    return np.sign(np.sin(2 * np.pi * 110 * x)) * 0.35 * (np.sin(2 * np.pi * 8 * x) > 0) * adsr(n, 0.005, 0.01, 1, 0.02)


def boing(d=0.5):
    n = int(d * SR); x = tt(n)
    f = 180 + 220 * np.exp(-x * 6) * (1 + 0.4 * np.sin(2 * np.pi * 14 * x))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 4)


def creak(d=1.0):
    n = int(d * SR); x = tt(n)
    f = 140 + 60 * np.sin(2 * np.pi * 1.2 * x)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (rng.random(n) > 0.3)
    return lp_fast(s, 10) * np.sin(np.pi * x / d) * 0.6


def pop():
    n = int(0.08 * SR); x = tt(n)
    return np.sin(2 * np.pi * (500 + 900 * x / 0.08) * x) * np.exp(-x * 40)


def vroom(d=1.6):
    n = int(d * SR); x = tt(n)
    f = 55 + 70 * np.minimum(1, x * 1.5)
    s = np.tanh(3 * np.sin(2 * np.pi * np.cumsum(f) / SR)) + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(f * 0.5) / SR))
    return lp_fast(s, 6) * np.minimum(1, x * 5) * np.minimum(1, (d - x) * 2) * 0.5


def fanfare():
    s = np.zeros(int(2.0 * SR))
    for k, (m, d) in enumerate([(72, 0.14), (76, 0.14), (79, 0.14), (84, 0.9)]):
        i = int(k * 0.14 * SR); n = int(d * SR); x = tt(n)
        tone = sum(np.sin(2 * np.pi * hz(m) * h * x) / h for h in (1, 2, 3, 4)) * adsr(n, 0.01, 0.1, 0.7, 0.1)
        s[i:i + n] += tone * 0.5
    return s


def ding():
    return musicbox(96, 1.6) * 0.8 + musicbox(103, 1.6) * 0.4


# ---------------------------------------------------------------- music
mus = np.zeros((2, N))
drums = np.zeros((2, N))
CH = {  # chord roots per bar (C F G C / Am F G G)
    0: [60, 64, 67], 1: [65, 69, 72], 2: [67, 71, 74], 3: [60, 64, 67],
    4: [57, 60, 64], 5: [65, 69, 72], 6: [67, 71, 74], 7: [67, 71, 74]}
MEL = [72, None, 76, 79, 77, None, 76, 74, 72, 74, 76, None, 79, 77, 76, 74]
bar_len = 4 * BEAT
t0 = 0.25
nbars = int((DUR - t0) / bar_len) + 1
for b in range(nbars):
    bt = t0 + b * bar_len
    ch = CH[b % 8]
    night = False
    stuck = False
    for s16 in range(16):
        t = bt + s16 * BEAT / 4
        if t > DUR - 0.5: break
        if t > DUR - 1.6: continue
        if not night:
            # bass on beats and offbeat 8ths
            if s16 % 4 == 0: add(mus, bass(ch[0] - 24 + (7 if s16 == 8 else 0), 0.3), t, 0.45)
            if s16 % 4 == 2 and not stuck: add(mus, bass(ch[0] - 12, 0.12), t, 0.25)
            # pizzicato chord stabs on offbeats
            if s16 % 4 == 2:
                for m in ch: add(mus, pluck(m, 0.2), t, 0.10, pan=(m - 66) / 20)
            # marimba melody
            m = MEL[s16] if (b % 2 == 0) else (MEL[(s16 + 8) % 16])
            if m is not None and s16 % 2 == 0 and not stuck: add(mus, marimba(m + (0 if b % 8 < 4 else -3) * 0, 0.4), t, 0.12, pan=0.25)
            # drums
            if s16 in (0, 8, 10) and not stuck: add(drums, kick(), t, 0.55)
            if s16 in (4, 12) and not stuck: add(drums, snare(), t, 0.22)
            if s16 % 2 == 0: add(drums, hat(s16 % 4 == 2), t, 0.09, pan=-0.3)
            if stuck and s16 % 8 == 0: add(mus, pluck(ch[0] - 12, 0.6, 0.3), t, 0.18)
        else:
            # night: soft music box arpeggio + pad
            if s16 % 2 == 0:
                m = ch[(s16 // 2) % 3] + 12
                add(mus, musicbox(m, 0.8), t, 0.10, pan=0.3 * np.sin(s16))
            if s16 == 0:
                for m in ch:
                    n = int(bar_len * SR); x = tt(n)
                    pad = np.sin(2 * np.pi * hz(m - 12) * x) * np.sin(np.pi * x / bar_len) ** 2
                    add(mus, pad, t, 0.06)
            if s16 % 4 == 0 and not stuck: add(drums, hat(), t, 0.04)
# ending: hold chord + fanfare
for m in (60, 64, 67, 72):
    n = int(2.2 * SR); x = tt(n)
    add(mus, sum(np.sin(2 * np.pi * hz(m) * h * x) / h ** 1.5 for h in (1, 2, 3)) * adsr(n, 0.02, 0.3, 0.5, 1.2), DUR - 1.4, 0.05)


def honk(d=0.45):
    n = int(d * SR); x = tt(n)
    s = np.sign(np.sin(2 * np.pi * 410 * x)) * 0.5 + np.sign(np.sin(2 * np.pi * 517 * x)) * 0.5
    return lp_fast(s, 6) * adsr(n, 0.01, 0.02, 1, 0.04) * 0.7


def screech(d=0.8):
    n = int(d * SR); x = tt(n)
    f = 2400 + 300 * np.sin(2 * np.pi * 9 * x)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + (lp_fast(noise(n), 3) - lp_fast(noise(n), 20)) * 0.6
    return s * np.minimum(1, x * 20) * np.minimum(1, (d - x) * 5)


def passby(d=1.4, f0=85):
    n = int(d * SR); x = tt(n)
    dop = 1 + 0.12 * np.tanh((d / 2 - x) * 4)
    s = lp_fast(np.sign(np.sin(2 * np.pi * np.cumsum(f0 * dop) / SR)), 10) * 0.4 + (lp_fast(noise(n), 12) - lp_fast(noise(n), 80)) * 1.5
    return s * np.exp(-((x - d / 2) / (d / 4)) ** 2)


def beep_click():
    n = int(0.05 * SR); x = tt(n); return np.sin(2 * np.pi * 1600 * x) * np.exp(-x * 90)


def spray(d=0.35):
    n = int(d * SR); x = tt(n); return (lp_fast(noise(n), 2) - lp_fast(noise(n), 6)) * np.sin(np.pi * x / d) * 1.5


def step():
    n = int(0.08 * SR); x = tt(n); return lp_fast(noise(n), 8) * np.exp(-x * 60)



def tone(f, d, a=0.005, r=0.02):
    n = int(d * SR); x = tt(n); return np.sin(2 * np.pi * f * x) * adsr(n, a, 0.01, 1, r)


def heartbeat():
    n = int(0.5 * SR); x = tt(n)
    s = np.sin(2 * np.pi * (55 + 40 * np.exp(-x * 30)) * x) * np.exp(-x * 18)
    k = int(0.22 * SR); s[k:] += np.sin(2 * np.pi * (50 + 30 * np.exp(-x[:n - k] * 30)) * x[:n - k]) * np.exp(-x[:n - k] * 20) * 0.7
    return s


def tick():
    n = int(0.03 * SR); x = tt(n); return np.sin(2 * np.pi * 3000 * x) * np.exp(-x * 200)


def siren(d=3.0, far=1.0):
    n = int(d * SR); x = tt(n); f = 700 + 250 * np.sign(np.sin(2 * np.pi * 0.9 * x))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.15
    return s * np.minimum(1, x * 2) * np.minimum(1, (d - x) * 2) * far


def zap(d=0.35):
    n = int(d * SR); x = tt(n); s = np.sign(np.sin(2 * np.pi * (180 + 900 * np.random.default_rng(4).random(n)) * x)) * 0.3
    return lp_fast(s, 3) * np.exp(-x * 8)


def charge(d=1.2):
    n = int(d * SR); x = tt(n); f = 600 + 2400 * (x / d) ** 1.5
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35 * np.minimum(1, x * 10)


def thump():
    n = int(0.16 * SR); x = tt(n); return np.sin(2 * np.pi * (70 + 50 * np.exp(-x * 40)) * x) * np.exp(-x * 26)



def drone(d, f0=96, gain=1.0):
    n = int(d * SR); x = tt(n)
    s = sum(np.sin(2 * np.pi * f * x + p) * a for f, a, p in [(f0, 0.5, 0), (f0 * 2.01, 0.25, 1), (f0 * 3.02, 0.12, 2), (f0 * 7.5, 0.04, 3)])
    s += lp_fast(noise(n), 60) * 1.2
    return s * gain


def thunder(d=2.5):
    n = int(d * SR); x = tt(n)
    s = lp_fast(noise(n), 90) * 6 * np.exp(-x * 1.6) + lp_fast(noise(n), 20) * 1.5 * np.exp(-x * 6)
    return s * np.minimum(1, x * 30)


def rattle(d=0.6):
    n = int(d * SR); x = tt(n)
    return lp_fast(noise(n), 4) * (np.sin(2 * np.pi * 22 * x) > 0.3) * np.exp(-x * 2) * 1.2


def shaker(d):
    n = int(d * SR); x = tt(n)
    return np.sign(np.sin(2 * np.pi * 18 * x)) * lp_fast(noise(n), 6) * 0.9 + np.sin(2 * np.pi * 36 * x) * 0.3


def horn(d):
    n = int(d * SR); x = tt(n)
    return (np.sign(np.sin(2 * np.pi * 520 * x)) * 0.25 + np.sin(2 * np.pi * 1040 * x) * 0.2) * (np.sin(2 * np.pi * 3 * x) > 0)


def clacker(d):
    n = int(d * SR); x = tt(n); s = np.zeros(n)
    for k in range(int(d * 9)):
        i = int(k / 9 * SR); m = int(0.03 * SR)
        if i + m < n: s[i:i + m] += np.sin(2 * np.pi * 1800 * tt(m)) * np.exp(-tt(m) * 120)
    return s


def chime():
    return tone(1320, 0.5) * np.exp(-tt(int(0.5 * SR)) * 4) * 0.6 + tone(990, 0.5) * np.exp(-tt(int(0.5 * SR)) * 4) * 0.5


def crackle(d=1.5):
    n = int(d * SR); s = np.zeros(n); r = np.random.default_rng(8)
    for k in range(60):
        i = int(r.random() * (n - 400)); s[i:i + 300] += np.sin(2 * np.pi * (3000 + r.random() * 3000) * tt(300)) * np.exp(-tt(300) * 300) * r.random()
    return s



def club_music(d, bpm=124):
    n = int(d * SR); s = np.zeros(n); beat = 60 / bpm; k = 0
    while (k + 1) * beat < d - 0.5:
        t0 = k * beat; i = int(t0 * SR)
        kk = kick() * 1.2; j = min(n, i + len(kk)); s[i:j] += kk[:j - i]
        if k % 2 == 1: hh = hat(True); j = min(n, i + len(hh)); s[i:j] += hh[:j - i] * 0.6
        hh2 = hat(); io = int((t0 + beat / 2) * SR); j = min(n, io + len(hh2)); s[io:j] += hh2[:j - io] * 0.5
        bl = int(beat * SR * 0.9); bx = tt(bl); note = [36, 36, 39, 34][(k // 4) % 4]; bs = np.tanh(3 * np.sin(2 * np.pi * hz(note) * bx)) * np.exp(-bx * 3) * 0.6
        io = int((t0 + beat / 2) * SR); j = min(n, io + bl); s[io:j] += bs[:j - io]
        if k % 8 == 0:
            for m in (60, 63, 67):
                cl_ = int(beat * 4 * SR); cx = tt(cl_); pad = np.sin(2 * np.pi * hz(m) * cx) * np.sin(np.pi * cx / (beat * 4)) * 0.12
                j = min(n, i + cl_);
                if j > i: s[i:j] += pad[:j - i]
        k += 1
    return s

def alarm_bell(d):
    n = int(d * SR); x = tt(n); r = np.sin(2 * np.pi * 980 * x) * (np.sin(2 * np.pi * 24 * x) > 0) * 0.35
    return r * np.minimum(1, x * 20) * np.minimum(1, (d - x) * 10)

def glass_smash():
    n = int(1.0 * SR); x = tt(n); r = np.random.default_rng(5); s = lp_fast(noise(n), 2) * np.exp(-x * 6) * 1.2
    for k in range(40):
        i = int(r.random() * 0.6 * SR); m = 900; f = 3000 + r.random() * 5000; s[i:i + m] += np.sin(2 * np.pi * f * tt(m)) * np.exp(-tt(m) * 80) * 0.6
    return s

def plastic_bounce():
    n = int(0.25 * SR); x = tt(n); return (np.sin(2 * np.pi * 420 * x) * 0.5 + lp_fast(noise(n), 4) * 0.5) * np.exp(-x * 25)

def beep_tone(f=1800, d=0.12):
    n = int(d * SR); x = tt(n); return np.sin(2 * np.pi * f * x) * adsr(n, 0.003, 0.01, 1, 0.02) * 0.5

def lighter():
    n = int(0.3 * SR); x = tt(n); return lp_fast(noise(n), 2) * np.exp(-x * 30) * 1.2 + lp_fast(noise(n), 20) * np.exp(-x * 6) * 0.6

def fire_crackle(d):
    n = int(d * SR); s = np.zeros(n); r = np.random.default_rng(6)
    for k in range(int(d * 40)):
        i = int(r.random() * (n - 300)); s[i:i + 300] += lp_fast(noise(300), 2) * np.exp(-tt(300) * 200) * r.random()
    return s + lp_fast(noise(n), 50) * 0.8

SEG = json.load(open(os.path.join(ROOT, "audio", "voice", "segments.json")))
WORDS = [(re.sub(r"[^a-z0-9']", "", w["w"].lower()), w["s"]) for s in SEG for w in s["words"]]
def Wt(word, after=0.0):
    ws = word.split("|")
    for w, s in WORDS:
        if w in ws and s >= after: return s
    return after + 1.0
B = {}
B["music"] = Wt("music"); B["fire"] = Wt("fire"); B["bouncer"] = Wt("bouncer"); B["clicker"] = Wt("clicker"); B["nobody"] = Wt("nobody"); B["teen"] = Wt("teenagers")
B["scanner"] = Wt("scanner"); B["real"] = Wt("real"); B["fake"] = Wt("fake"); B["banned"] = Wt("banned"); B["network"] = Wt("network"); B["step"] = Wt("step"); B["smoke"] = Wt("smoke")
B["slip"] = Wt("slip"); B["stamped"] = Wt("stamped"); B["glows"] = Wt("glows"); B["pushes"] = Wt("pushes"); B["alarm"] = Wt("alarm"); B["wired"] = Wt("wired"); B["instantly"] = Wt("instantly")
B["fight"] = Wt("fight"); B["glass"] = Wt("glass", B["fight"]); B["smashed"] = Wt("smashed"); B["poly"] = Wt("polycarbonate"); B["bend"] = Wt("bend"); B["cams"] = Wt("cams|cam"); B["record"] = Wt("record"); B["rope"] = Wt("rope"); B["built"] = Wt("built")

# club music: loud inside, muffled outside, cut dead at "instantly", back after the fight starts
mus = club_music(DUR)
inside = np.zeros(N)
def seg_on(a, b, v=1.0):
    i, j = int(a * SR), int(min(DUR, b) * SR); inside[i:j] = v
seg_on(0, B["bouncer"] - 0.1, 1.0); seg_on(B["bouncer"] - 0.1, B["pushes"] - 0.1, 0.25); seg_on(B["pushes"] - 0.1, B["instantly"] - 0.15, 0.5)
seg_on(B["instantly"] - 0.15, B["fight"] - 0.3, 0.0); seg_on(B["fight"] - 0.3, B["cams"] - 0.4, 0.8); seg_on(B["cams"] - 0.4, B["rope"] - 0.2, 0.7); seg_on(B["rope"] - 0.2, DUR, 0.3)
inside[:int(B["music"] * SR)] = 0
inside = lp_fast(inside, int(0.03 * SR))
muffle = lp_fast(mus, 40)
music_track = (mus * np.clip(inside * 2 - 1, 0, 1) + muffle * np.clip(1 - abs(inside * 2 - 1), 0, 1) * 1.4) * (inside > 0.01)
sfx = np.zeros((2, N))
add(sfx, thud(40, 0.9) * 1.6, B["music"], 0.8)
add(sfx, fire_crackle(B["bouncer"] - B["fire"]), B["fire"], 0.35); add(sfx, alarm_bell(B["bouncer"] - B["fire"] - 0.3) * 0.5, B["fire"] + 0.2, 0.25)
k = B["clicker"] - 0.2
while k < B["teen"]: add(sfx, click(), k, 0.5); k += 0.4
add(sfx, beep_tone(1200, 0.2), B["scanner"] + 0.3, 0.4); add(sfx, beep_tone(1900), B["real"], 0.5); add(sfx, beep_tone(1900), B["real"] + 0.15, 0.5)
add(sfx, beep_tone(300, 0.45), B["fake"], 0.6); add(sfx, beep_tone(300, 0.45), B["banned"] + 0.2, 0.5)
for i in range(4): add(sfx, beep_tone(2400, 0.06), B["network"] + i * 0.15, 0.3)
add(sfx, lighter(), B["smoke"] - 0.3, 0.5)
add(sfx, thud(90, 0.25), B["stamped"] + 0.05, 0.6); add(sfx, shimmer(0.8) * 0.5, B["glows"], 0.3)
add(sfx, clang(200, 0.6) * 1.2, B["pushes"], 0.7)
add(sfx, alarm_bell(B["fight"] - B["alarm"] - 0.6), B["alarm"], 0.55)
add(sfx, thud(55, 0.5), B["instantly"] - 0.15, 0.6)
add(sfx, glass_smash(), B["smashed"], 0.8)
for i in range(4): add(sfx, plastic_bounce() * (0.8 ** i), B["bend"] + i * 0.22, 0.6)
add(sfx, beep_tone(2200, 0.1), B["record"] + 0.05, 0.5)
add(sfx, ding(), B["built"] + 0.3, 0.4)

raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(ROOT, "audio", "voice", "voice.wav"), "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.float32).astype(np.float64)
voice = np.zeros(N); voice[:min(N, len(v))] = v[:N]
venv = lp_fast(np.abs(voice), int(0.08 * SR))
duck = lp_fast(1 - 0.7 * np.clip(venv / (np.percentile(venv, 90) + 1e-9), 0, 1), int(0.15 * SR))
mix = (music_track * 0.35 * duck)[None, :] + sfx * 0.45 * duck + voice[None, :] * 1.6
mix[:, -int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
mix /= np.max(np.abs(mix)) / 0.89
tmp = os.path.join(ROOT, "audio", "_mix.f32"); mix.T.astype(np.float32).tofile(tmp)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp, "-af", "loudnorm=I=-13:TP=-1:LRA=10", "-ar", str(SR), os.path.join(ROOT, "audio", "final_mix.wav")], check=True)
os.remove(tmp); print("wrote audio/final_mix.wav", {k: round(v, 1) for k, v in B.items()})

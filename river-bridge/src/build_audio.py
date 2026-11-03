"""Cartoon SFX mixed under the Dan voiceover (no background music, as requested for these videos).

Output: audio/final_mix.wav (48 kHz stereo). SFX are synthesised; beat times come from the voice word timings.
"""
import json, os, re, subprocess
import numpy as np

SR = 48000
DUR = float(os.environ.get("DUR", "61.5"))
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



def water_splash(size=1.0, d=0.9):
    n = int(d * SR); x = tt(n)
    s = lp_fast(noise(n), 3) * np.exp(-x * 5) * 1.2 + lp_fast(noise(n), 25) * np.exp(-x * 3) * 2
    s += np.sin(2 * np.pi * (300 + 500 * np.exp(-x * 20)) * x) * np.exp(-x * 25) * 0.6
    return s * size


def plop():
    n = int(0.25 * SR); x = tt(n)
    f = 250 + 600 * np.exp(-x * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 14) + lp_fast(noise(n), 4) * np.exp(-x * 30) * 0.4


def chop():
    n = int(0.25 * SR); x = tt(n)
    return lp_fast(noise(n), 3) * np.exp(-x * 35) + np.sin(2 * np.pi * 180 * x) * np.exp(-x * 30) * 0.8


def bleat(d=0.7):
    n = int(d * SR); x = tt(n)
    f = 420 + 40 * np.sin(2 * np.pi * 7 * x)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.3
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 18 * x)
    return lp_fast(s, 5) * am * np.sin(np.pi * x / d) * 0.8


def river(d):
    n = int(d * SR); s = lp_fast(noise(n), 40) - lp_fast(noise(n), 300); return s * 2.5


SEG = json.load(open(os.path.join(ROOT, "audio", "voice", "segments.json")))
WORDS = [(re.sub(r"[^a-z']", "", w["w"].lower()), w["s"]) for s in SEG for w in s["words"]]
def Wt(word, after=0.0):
    for w, s in WORDS:
        if w == word and s >= after: return s
    return after + 1
B = {}
B["stones"] = Wt("stones"); B["hop"] = Wt("hop"); B["rolls"] = Wt("rolls"); B["wet"] = Wt("wet")
B["chop"] = Wt("chop"); B["crash"] = Wt("crash"); B["tiptoe"] = Wt("tiptoe"); B["round"] = Wt("round", B["tiptoe"]); B["wobble"] = Wt("wobble")
B["second"] = Wt("second"); B["planks"] = Wt("planks"); B["walkway"] = Wt("walkway"); B["truck"] = Wt("truck"); B["sags"] = Wt("sags")
B["hammer"] = Wt("hammer"); B["beam"] = Wt("beam"); B["shorter"] = Wt("shorter"); B["genius"] = Wt("genius")
B["current"] = Wt("current"); B["sway"] = Wt("sway"); B["diagonal"] = Wt("diagonal"); B["triangles"] = Wt("triangles")
B["goat"] = Wt("goat"); B["falling"] = Wt("falling"); B["railings"] = Wt("railings"); B["congrats"] = Wt("congratulations"); B["bridge"] = Wt("bridge", B["congrats"])
B["swim"] = Wt("swim"); B["pizza"] = Wt("pizza")

sfx = np.zeros((2, N))
amb = river(DUR); add(sfx, amb, 0, 0.18)
add(sfx, pop(), B["pizza"] - 0.1, 0.4)
add(sfx, boing(0.4), B["swim"], 0.15)
for i in range(6): add(sfx, plop(), B["stones"] - 0.25 + i * 0.16 + 0.3, 0.45, pan=(i - 2.5) / 5)
for i in range(3): add(sfx, boing(0.3), B["hop"] - 0.1 + i * 0.38, 0.12)
add(sfx, creak(0.5), B["rolls"] - 0.1, 0.3)
add(sfx, water_splash(1.0), B["rolls"] + 0.25, 0.8)
for i in range(4): add(sfx, chop(), B["chop"] - 0.2 + i * 0.35, 0.6, pan=(i % 2 - 0.5) * 0.4)
add(sfx, creak(1.0), B["crash"] - 0.9, 0.4)
add(sfx, whoosh(0.6), B["crash"] - 0.55, 0.5)
add(sfx, thud(45, 0.8), B["crash"] - 0.05, 1.0)
add(sfx, water_splash(1.4, 1.2), B["crash"], 0.9)
for i in range(6): add(sfx, creak(0.25), B["round"] + i * 0.55, 0.12)
add(sfx, boing(0.6), B["wobble"], 0.2)
add(sfx, water_splash(0.8), B["second"] - 0.4, 0.0)
add(sfx, rumble(1.0), B["second"], 0.35)
for i in range(10): add(sfx, np.pad(click(), (0, 9120)) * 0.6 + chop() * 0.5, B["planks"] + i * 0.15, 0.5, pan=(i % 2 - 0.5) * 0.5)
add(sfx, shimmer(1.2), B["walkway"], 0.3)
add(sfx, vroom(2.2), B["truck"] - 0.6, 0.55)
add(sfx, creak(1.6), B["sags"] - 0.4, 0.6)
add(sfx, thud(55, 0.5), B["sags"] + 0.4, 0.4)
for i in range(4): add(sfx, clang(260 + i * 20, 0.5), B["hammer"] + (i >> 1) * 0.55 + (i & 1) * 0.18 + 0.3, 0.45, pan=(i % 2 - 0.5) * 0.5)
for i in range(4): add(sfx, plop(), B["hammer"] + (i >> 1) * 0.55 + (i & 1) * 0.18 + 0.25, 0.3)
add(sfx, thud(70, 0.4), B["beam"] + 0.1, 0.5)
add(sfx, ding(), B["genius"], 0.5)
add(sfx, vroom(2.0), B["shorter"], 0.35)
add(sfx, wind(3.5) * 0.5 + river(3.5)[:int(3.5 * SR)] * 0.7, B["current"] - 0.3, 0.6)
for i in range(5): add(sfx, creak(0.5), B["current"] + 0.6 + i * 0.6, 0.35)
for i in range(4): add(sfx, clang(380, 0.4), B["diagonal"] + i * 0.16 + 0.2, 0.35)
add(sfx, ding(), B["triangles"] + 0.1, 0.35)
add(sfx, bleat(), B["goat"] - 0.2, 0.5)
add(sfx, bleat(0.5), B["falling"] - 0.1, 0.5)
add(sfx, water_splash(0.9), B["falling"] + 0.3, 0.8)
for i in range(10): add(sfx, np.pad(click(), (0, 9120)) * 0.5 + chop() * 0.4, B["railings"] + i * 0.12, 0.45, pan=(i % 2 - 0.5) * 0.5)
add(sfx, bleat(0.4), B["railings"] + 1.4, 0.35)
add(sfx, fanfare(), B["congrats"], 0.6)
for i in range(8): add(sfx, pop(), B["congrats"] + i * 0.07, 0.25, pan=(i % 2 - 0.5))
add(sfx, vroom(3.0), B["congrats"] + 0.5, 0.35)
add(sfx, ding(), B["bridge"] + 0.4, 0.4)
for tc in (B["stones"] - 0.6, B["chop"] - 0.6, B["tiptoe"] - 0.2, B["second"] - 0.4, B["truck"] - 1.0, B["hammer"] - 0.5, B["current"] - 0.6, B["diagonal"] - 0.5, B["goat"] - 0.7, B["congrats"] - 0.2):
    add(sfx, whoosh(0.35), tc - 0.1, 0.18)

raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(ROOT, "audio", "voice", "voice.wav"), "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.float32).astype(np.float64)
voice = np.zeros(N); voice[:min(N, len(v))] = v[:N]
venv = lp_fast(np.abs(voice), int(0.08 * SR))
duck = lp_fast(1 - 0.45 * np.clip(venv / (np.percentile(venv, 90) + 1e-9), 0, 1), int(0.15 * SR))
mix = sfx * 0.55 * duck + voice[None, :]
fo = int(0.8 * SR); mix[:, -fo:] *= np.linspace(1, 0, fo)
mix /= np.max(np.abs(mix)) / 0.89
tmp = os.path.join(ROOT, "audio", "_mix.f32"); mix.T.astype(np.float32).tofile(tmp)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp,
                "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), os.path.join(ROOT, "audio", "final_mix.wav")], check=True)
os.remove(tmp)
print("wrote audio/final_mix.wav", B)

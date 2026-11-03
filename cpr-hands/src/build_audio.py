"""Background music (original, synthesised) + sound effects under the Jesse voiceover (CPR video).

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


SEG = json.load(open(os.path.join(ROOT, "audio", "voice", "segments.json")))
WORDS = [(re.sub(r"[^a-z0-9']", "", w["w"].lower()), w["s"]) for s in SEG for w in s["words"]]
def Wt(word, after=0.0):
    ws = word.split("|")
    for w, s in WORDS:
        if w in ws and s >= after: return s
    return after + 1.2
B = {}
B["drops"] = Wt("drops"); B["pulse"] = Wt("pulse"); B["brain"] = Wt("brain"); B["four"] = Wt("four"); B["ambulance"] = Wt("ambulance"); B["eight"] = Wt("eight")
B["what"] = Wt("what", B["eight"]); B["decides"] = Wt("decides"); B["this"] = Wt("this", B["decides"]); B["haywire"] = Wt("haywire"); B["quivers"] = Wt("quivers")
B["hands"] = Wt("hands"); B["become"] = Wt("become"); B["push1"] = Wt("push", B["become"]); B["first"] = Wt("first", B["push1"]); B["call"] = Wt("call", B["first"]); B["speaker"] = Wt("speaker")
B["heel"] = Wt("heel"); B["lock"] = Wt("lock"); B["hard"] = Wt("hard", B["lock"]); B["fast"] = Wt("fast", B["hard"]); B["beat"] = Wt("beat", B["fast"])
B["not"] = Wt("not", B["beat"]); B["skip"] = Wt("skip"); B["just"] = Wt("just", B["skip"]); B["then"] = Wt("then", B["just"]); B["aed"] = Wt("aed|a", B["then"] + 0.3)
B["stops"] = Wt("stops", B["then"]); B["rhythm"] = Wt("rhythm"); B["your"] = Wt("your", B["rhythm"]); B["alive"] = Wt("alive", B["your"]); B["now"] = Wt("now", B["alive"]); B["share"] = Wt("share")
BPM = 110; P = 60 / BPM

sfx = np.zeros((2, N))
# hook: heartbeat stops, body hits the floor, flatline
for i in range(3): add(sfx, heartbeat(), 0.05 + i * 0.75, 0.7 * (1 - i * 0.25))
add(sfx, thud(48, 0.7), B["drops"] + 0.95, 1.0)
add(sfx, tone(1000, max(0.5, B["brain"] - B["pulse"])), B["pulse"], 0.22)
# ticking clock + distant siren
t0 = B["brain"]
while t0 < B["what"] - 0.1: add(sfx, tick(), t0, 0.5); t0 += 0.5
add(sfx, siren(2.4, 0.5), B["eight"] - 0.3, 0.25)
add(sfx, heartbeat(), B["decides"], 0.8); add(sfx, heartbeat(), B["decides"] + 0.9, 0.6)
# haywire heart
for i in range(6): add(sfx, zap(), B["haywire"] - 0.2 + i * 0.35, 0.35, pan=(i % 2 - 0.5) * 0.6)
add(sfx, shimmer(1.0), B["hands"], 0.3)
add(sfx, ding(), B["become"], 0.35)
# compressions
def comp(a, b, g=0.55):
    t = a
    while t < b: add(sfx, thump(), t, g); t += P
comp(B["push1"] - 0.2, B["first"] - 0.1)
# phone call
for i, f in enumerate([1209, 1336, 1209]): add(sfx, tone(f, 0.12) + tone(770, 0.12), B["call"] - 0.1 + i * 0.18, 0.18)
add(sfx, tone(440, 0.6) + tone(480, 0.6), B["speaker"] - 0.2, 0.12)
add(sfx, pop(), B["heel"], 0.3); add(sfx, pop(), B["heel"] + 1.2, 0.3)
add(sfx, click(), B["lock"], 0.5)
comp(B["lock"], B["then"] + 0.2)
for i in range(8): add(sfx, tick() * 2, B["fast"] + i * P, 0.25)
add(sfx, pop(), B["skip"], 0.3)
# AED
add(sfx, click(), B["aed"], 0.5); add(sfx, charge(1.1), B["aed"] - 0.2, 0.4)
add(sfx, zap(0.5) * 2, B["aed"] + 0.9, 0.9); add(sfx, thud(60, 0.4), B["aed"] + 0.9, 0.6)
t0 = B["rhythm"] - 0.6
while t0 < B["your"]: add(sfx, tone(1050, 0.09), t0, 0.25); t0 += 0.8
comp(B["alive"] - 0.4, B["now"] + 0.6, 0.4)
add(sfx, siren(DUR - B["your"] + 0.2, 1.0), B["your"] - 0.2, 0.25)
add(sfx, ding(), B["share"], 0.45)

raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(ROOT, "audio", "voice", "voice.wav"), "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.float32).astype(np.float64)
voice = np.zeros(N); voice[:min(N, len(v))] = v[:N]
venv = lp_fast(np.abs(voice), int(0.08 * SR))
duck = lp_fast(1 - 0.5 * np.clip(venv / (np.percentile(venv, 90) + 1e-9), 0, 1), int(0.15 * SR))
mix = sfx * 0.6 * duck + voice[None, :]
mix[:, -int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
mix /= np.max(np.abs(mix)) / 0.89
tmp = os.path.join(ROOT, "audio", "_mix.f32"); mix.T.astype(np.float32).tofile(tmp)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp,
                "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), os.path.join(ROOT, "audio", "final_mix.wav")], check=True)
os.remove(tmp)
print("wrote audio/final_mix.wav", {k: round(v, 2) for k, v in B.items()})

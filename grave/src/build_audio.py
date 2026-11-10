# Event-only natural sound design (NO music, NO continuous hiss/noise beds) + Adam voice -> audio/final_mix.wav
import numpy as np, subprocess, wave, json
from scipy.signal import lfilter

SR = 48000; DUR = 63.3; N = int(SR * DUR); OFF = 0.8
CH = [c[0] + OFF for c in json.load(open('audio/chunks.json'))]; ch = lambda i: CH[i]
rng = np.random.default_rng(7)
def load(p):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
def lp(x, a): return lfilter([a], [1, a - 1], x)
def hp(x, a): return x - lp(x, a)
def env_ar(n, a, r):
    e = np.ones(n); A = max(1, int(a * SR)); R = max(1, int(r * SR)); e[:A] = np.linspace(0, 1, A); e[-R:] *= np.linspace(1, 0, R); return e
L = np.zeros(N); R = np.zeros(N)
def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0 or i < 0: return
    L[i:i + n] += sig[:n] * gain * np.sqrt(.5 * (1 - pan)); R[i:i + n] += sig[:n] * gain * np.sqrt(.5 * (1 + pan))
def tt(d): return np.arange(int(d * SR)) / SR
def thud(dur=.4, f0=90, f1=55, noise=.3, damp=12):
    t = tt(dur); f = f1 + (f0 - f1) * np.exp(-t * 20)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * damp) + noise * lp(rng.standard_normal(len(t)), .12) * np.exp(-t * 35)
def scrape(dur=.35):  # shovel into soil: short gritty burst
    t = tt(dur); x = lp(rng.standard_normal(len(t)), .25) * (rng.random(len(t)) < .4)
    return x * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** .6 * 1.2
def clank(f, dur=.5, damp=1.0):
    t = tt(dur); return sum(np.sin(2 * np.pi * f * m * t + rng.random() * 6) * np.exp(-t * (8 + 6 * m) * damp) / m for m in (1, 2.76, 5.4))
def creak(dur=.8, f=170):
    t = tt(dur); fm = f + 35 * np.sin(2 * np.pi * 3.1 * t) + 20 * rng.standard_normal(len(t)).cumsum() / np.sqrt(len(t))
    s = np.sign(np.sin(2 * np.pi * np.cumsum(fm) / SR)) * .5; return lp(s, .12) * env_ar(len(t), .08, .2)
def bird(f0=3200):  # short tonal chirp sequence
    out = np.zeros(int(.9 * SR)); k = 0
    for j in range(3 + int(rng.random() * 3)):
        d = .06 + rng.random() * .06; t = tt(d); f = f0 * (1 + .35 * np.sin(np.pi * t / d)) + rng.random() * 400
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2; i = int(k * SR); out[i:i + len(s)] += s[:len(out) - i]; k += d + .04 + rng.random() * .06
    return out
def drip(f=1600):
    t = tt(.12); fr = f * (1 + 1.5 * np.exp(-t * 60)); return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 40)
def pop(): t = tt(.12); return np.sin(2 * np.pi * (500 + 900 * np.exp(-t * 50)) * t) * np.exp(-t * 35)

YARD = [(0, ch(5)), (ch(26), DUR)]
# birds in the sunny yard (sparse, tonal)
for a, b in YARD:
    k = a + .5
    while k < b - .8: add(bird(2600 + rng.random() * 1600), k, .035, rng.random() * 1.4 - .7); k += 1.4 + rng.random() * 2.2
# digging
for k in np.arange(.4, ch(1), 2 * np.pi / 3.2): add(scrape(), k, .45, .3); add(thud(.25, 120, 80, .8, 25), k + .3, .25, .3)
# dirt shovelled back in
for k in np.arange(ch(2), ch(3) - .2, .45): add(thud(.3, 100, 60, 1.0, 18), k, .3, -.1)
# fox: paws trotting then scratching
for k in np.arange(ch(3), ch(3) + 1.0, .17): add(thud(.06, 220, 150, .6, 60), k, .12, .4)
for k in np.arange(ch(3) + 1.1, ch(5), .11): add(scrape(.09), k, .3, .2)
# deeper digging (cut-away)
for k in np.arange(ch(5) + .1, ch(5) + 1.6, .5): add(scrape(), k, .4); add(thud(.25, 110, 70, .8, 25), k + .28, .2)
add(thud(1.2, 60, 35, .2, 3), ch(6) + .1, .35)   # 1665 card hit
# coffin lowered: rope creak + landing
add(creak(1.2, 210), ch(7) + .2, .07); add(thud(.6, 85, 50, .7, 9), ch(7) + 1.6, .55); add(clank(260, .4, 1.5), ch(7) + 1.62, .05)
add(thud(1.0, 70, 40, .2, 4), ch(8), .3)          # label hit
# rot: slow creaks, crack, soil slump
add(creak(1.4, 140), ch(9) + .4, .09); add(clank(900, .3, 3) * .5 + thud(.3, 140, 90, 1.0, 20), ch(10) - .2, .3); add(thud(.8, 55, 35, 1.0, 5), ch(10) + .3, .3)
# vault: heavy concrete landing + coffin into it + lid
add(thud(.9, 70, 38, .9, 6), ch(11) + 1.5, .7); add(thud(.5, 90, 55, .5, 10), ch(12), .4); add(thud(.7, 75, 45, .8, 8), ch(13) - .2, .5)
# four feet: ruler ticks
for k in np.arange(ch(13) + .3, ch(13) + 2.2, .3): add(clank(2400, .05, 3), k, .05)
# water: droplets (tonal), seal click
for i in range(26): add(drip(1100 + rng.random() * 1400), ch(14) + rng.random() * (ch(16) - ch(14) - .3), .06, rng.random() * 1.6 - .8)
add(clank(1800, .12, 2), ch(15) + .45, .12); add(clank(2600, .08, 2), ch(15) + .55, .1)
# gas building: low groan + creaks rising
n = int((ch(19) - ch(16)) * SR); t = np.arange(n) / SR; p = t / t[-1]
groan = np.sin(2 * np.pi * np.cumsum(45 + 30 * p + 4 * np.sin(2 * np.pi * 1.3 * t)) / SR) * (p ** 1.5) + .3 * np.sin(2 * np.pi * np.cumsum(90 + 60 * p) / SR) * p ** 2
add(lp(groan, .2), ch(16), .5)
for k in (ch(17) + .2, ch(18) + .1, ch(18) + .6): add(creak(.4, 260), k, .08)
# burst
add(thud(.8, 160, 60, 1.5, 6), ch(19) + .35, .9); add(clank(700, .5, 1.2), ch(19) + .37, .2)
t = tt(1.2); add(lp(rng.standard_normal(len(t)), .06) * np.exp(-t * 3) * 1.2, ch(19) + .38, .35)   # short gas whoomp (brief)
add(thud(1.4, 60, 34, .2, 2.5), ch(20), .4)
# unlock: click + gentle release puffs (brief)
add(clank(2200, .1, 2), ch(21) + .9, .12); add(clank(1500, .1, 2), ch(21) + 1.0, .1)
for k in (ch(22), ch(22) + .7): t = tt(.5); add(lp(rng.standard_normal(len(t)), .05) * np.sin(np.pi * t / .5) ** 2, k, .12)
# headstone tips: stone grind + soil settle
add(creak(1.2, 90) * 1.5, ch(23) + .3, .12); add(thud(.6, 70, 45, .6, 8), ch(24) + .3, .4)
# concrete base slides in, stone settles back
t = tt(.8); add(lp(rng.standard_normal(len(t)), .2) * np.sin(np.pi * t / .8) * .8, ch(25), .2); add(thud(.5, 90, 55, .5, 12), ch(25) + .8, .4); add(thud(.4, 110, 70, .4, 14), ch(25) + 1.6, .35)
add(thud(1.2, 60, 35, .2, 3), ch(27) + .2, .3)   # legal banner
# flowers popping up, final banner
for i in range(10): add(pop(), ch(29) + i * .08 + rng.random() * .05, .05, rng.random() - .5)
add(thud(1.6, 55, 32, .2, 2.2), ch(30), .4)
add(thud(1.6, 55, 32, .2, 2.2), .3, .4)          # title

sfx = np.stack([L, R]); sfx /= np.abs(sfx).max()
v = load('audio/voice_adam.mp3'); vo = np.zeros(N); i0 = int(OFF * SR); vo[i0:i0 + len(v)] = v[:N - i0]
ve = np.convolve(np.abs(vo), np.ones(int(.12 * SR)) / int(.12 * SR), 'same'); duck = 1 - .4 * np.clip(ve * 10, 0, 1)
mix = sfx * duck * .36 + vo[None, :]
fade = np.ones(N); fo = int(1.0 * SR); fade[-fo:] = np.linspace(1, 0, fo); mix *= fade
mix /= max(1e-6, np.abs(mix).max() / .95)
with wave.open('audio/final_mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print('ok', DUR, 'voice end', OFF + len(v) / SR)

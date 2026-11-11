# Event-only natural sound design (NO music, NO continuous hiss/noise beds) + Adam voice -> audio/final_mix.wav
import numpy as np, subprocess, wave, json
from scipy.signal import lfilter

SR = 48000; DUR = 60.8; N = int(SR * DUR); OFF = 0.8
CH = [c[0] + OFF for c in json.load(open('audio/chunks.json'))]; ch = lambda i: CH[i]
rng = np.random.default_rng(11)
def load(p):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
def lp(x, a): return lfilter([a], [1, a - 1], x)
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
def scrape(dur=.3):
    t = tt(dur); x = lp(rng.standard_normal(len(t)), .25) * (rng.random(len(t)) < .4); return x * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** .6 * 1.2
def clank(f, dur=.4, damp=1.0):
    t = tt(dur); return sum(np.sin(2 * np.pi * f * m * t + rng.random() * 6) * np.exp(-t * (8 + 6 * m) * damp) / m for m in (1, 2.76, 5.4))
def drip(f=1500):
    t = tt(.12); fr = f * (1 + 1.5 * np.exp(-t * 60)); return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 40)
def bird(f0=3000):
    out = np.zeros(int(.9 * SR)); k = 0
    for j in range(3 + int(rng.random() * 3)):
        d = .06 + rng.random() * .07; t = tt(d); f = f0 * (1 + .35 * np.sin(np.pi * t / d)) + rng.random() * 500
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2; i = int(k * SR); out[i:i + len(s)] += s[:len(out) - i]; k += d + .04 + rng.random() * .07
    return out
def creak(dur=.6, f=180):
    t = tt(dur); fm = f + 30 * np.sin(2 * np.pi * 3 * t); s = np.sign(np.sin(2 * np.pi * np.cumsum(fm) / SR)) * .5; return lp(s, .12) * env_ar(len(t), .08, .2)
def bark():
    t = tt(.22); f = 520 * (1 - .4 * t / .22); s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .6 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * .4; return lp(s, .25) * np.sin(np.pi * t / .22) ** .7
def sniff(): t = tt(.12); return lp(rng.standard_normal(len(t)), .3) * np.sin(np.pi * t / .12) ** 2
def ook(f=700):
    t = tt(.16); fr = f * (1 + .6 * np.sin(np.pi * t / .16)); return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * t / .16) ** 2
def pop(): t = tt(.06); return np.sin(2 * np.pi * (1200 + 1600 * np.exp(-t * 80)) * t) * np.exp(-t * 60)

SURFACE = [(0, ch(2)), (ch(5), ch(6)), (ch(16), ch(22))]
for a, b in SURFACE:
    k = a + .4
    while k < b - .8: add(bird(2400 + rng.random() * 2200), k, .03, rng.random() * 1.4 - .7); k += 1.2 + rng.random() * 2.0
# hidey hole: digging, jump in
for k in np.arange(.4, ch(1), 2 * np.pi / 3.4): add(scrape(), k, .45, .2); add(thud(.25, 120, 80, .8, 25), k + .28, .22, .2)
add(thud(.4, 100, 60, .8, 14), ch(1) + .7, .4)
# rain: thunder rumble + drops + water filling (plinks), no noise bed
t = tt(2.5); add(lp(np.sin(2 * np.pi * np.cumsum(38 + 6 * np.sin(t * 3)) / SR) * np.exp(-t * 1.2) + .4 * lp(rng.standard_normal(len(t)), .01) * np.exp(-t * 1.5), .08), ch(2) + .1, .6)
for i in range(40): add(drip(900 + rng.random() * 1500), ch(2) + rng.random() * (ch(4) - ch(2)), .05, rng.random() * 1.6 - .8)
# sideways tunnel: digging + water running out (plinks)
for k in np.arange(ch(3) + .1, ch(3) + 2.6, .45): add(scrape(), k, .4, -.1); add(thud(.2, 110, 70, .7, 25), k + .25, .18)
for i in range(18): add(drip(1300 + rng.random() * 900), ch(3) + 2.5 + rng.random() * 2.0, .05, -.4)
# grenade: drop clink, bounces down the shaft, roll
add(clank(1500, .15, 2), ch(5) + 1.25, .15);
for j, k in enumerate([ch(5) + 2.1, ch(5) + 2.35, ch(5) + 2.55, ch(5) + 2.7]): add(clank(1100 - j * 100, .2, 2), k, .14 * (1 - j * .2)); add(thud(.12, 200, 140, .4, 40), k, .15)
# blast
b0 = ch(6) + 2.6
add(thud(1.4, 120, 32, 2.0, 3.5), b0, 1.0); t = tt(1.0); add(lp(rng.standard_normal(len(t)), .05) * np.exp(-t * 5) * 1.5, b0, .5)
for k in np.arange(b0 + .25, b0 + 1.4, .12): add(thud(.15, 160, 100, 1.0, 30), k + rng.random() * .05, .12, rng.random() - .5)
# gas: pump creaks + low rumble of the gas, then water filling the trap
for k in np.arange(ch(8) + .2, ch(10), .9): add(creak(.45, 230), k, .07, .3)
t = tt(ch(10) - ch(8)); add(lp(np.sin(2 * np.pi * np.cumsum(55 + 10 * np.sin(t * 2)) / SR) * np.clip(t / 1.5, 0, 1), .1), ch(8), .25)
for i in range(22): add(drip(700 + rng.random() * 900), ch(9) + 1.0 + rng.random() * 2.2, .06, .2)
# crawl: rustles + flashlight click
add(clank(3000, .05, 3), ch(12) + .1, .08)
for k in np.arange(ch(12), ch(14) + .7, .4): add(scrape(.18), k, .18, -.2)
for k in np.arange(ch(13), ch(13) + 1.4, .5): add(scrape(), k, .3); add(thud(.2, 110, 70, .7, 25), k + .25, .15)
# fake floor breaks
add(clank(500, .3, 2) * .5 + creak(.3, 300), ch(14) + .7, .4); add(thud(.6, 90, 50, 1.0, 9), ch(14) + 1.05, .6)
# dogs: sniffs + barks, soap squeak + bubbles, paws
for k in np.arange(ch(16) + .2, ch(17) + .6, .22): add(sniff(), k, .2, (k * 7) % 1.4 - .7)
add(bark(), ch(16) + .9, .25, .4); add(bark(), ch(16) + 1.15, .2, .4)
t = tt(.25); add(np.sin(2 * np.pi * np.cumsum(1800 + 900 * np.sin(np.pi * t / .25)) / SR) * np.sin(np.pi * t / .25), ch(17) + .3, .05)
for i in range(16): add(pop(), ch(17) + .6 + rng.random() * 2.2, .05, rng.random() - .5)
for k in np.arange(ch(18) - .2, ch(19), .17): add(thud(.06, 220, 150, .6, 60), k, .1, .5)
# river: soldiers' steps on leaves, dive splash, underwater bubbles
for k in np.arange(ch(19), ch(22), .45): add(scrape(.12), k, .12, -.3)
t = tt(.8); add(lp(rng.standard_normal(len(t)), .2) * np.exp(-t * 6) * .9 + thud(.8, 90, 50, .2, 8)[:len(t)] * .3, ch(20) + 1.6, .35)
for i in range(14): add(drip(500 + rng.random() * 600), ch(20) + 1.9 + rng.random() * 1.6, .05)
# base: hammock creak, lantern clink, monkey chatter + grab, finale
add(creak(1.0, 160), ch(22), .08); add(clank(2200, .1, 3), ch(23) + .2, .05)
for k in (ch(23) + .7, ch(23) + .85, ch(23) + 1.0, ch(23) + 1.5, ch(23) + 1.62): add(ook(600 + rng.random() * 500), k, .09, .3)
add(thud(1.6, 55, 32, .2, 2.2), ch(24), .45)

sfx = np.stack([L, R]); sfx /= np.abs(sfx).max()
v = load('audio/voice_adam.mp3'); vo = np.zeros(N); i0 = int(OFF * SR); vo[i0:i0 + len(v)] = v[:N - i0]
ve = np.convolve(np.abs(vo), np.ones(int(.12 * SR)) / int(.12 * SR), 'same'); duck = 1 - .4 * np.clip(ve * 10, 0, 1)
mix = sfx * duck * .36 + vo[None, :]
fade = np.ones(N); fo = int(1.0 * SR); fade[-fo:] = np.linspace(1, 0, fo); mix *= fade
mix /= max(1e-6, np.abs(mix).max() / .95)
with wave.open('audio/final_mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print('ok', DUR, 'voice end', OFF + len(v) / SR)

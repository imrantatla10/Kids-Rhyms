# Natural sound design (NO music) + Adam voice-over (ElevenLabs take 2) -> audio/final_mix.wav
# Timeline matches src/scene.html (voice offset 1.0 s, duration 62.5 s).
import numpy as np, subprocess, wave
from scipy.signal import lfilter

SR = 48000; DUR = 62.5; N = int(SR * DUR); t = np.arange(N) / SR; OFF = 1.0
rng = np.random.default_rng(11)
def load(p):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
def lp(x, a): return lfilter([a], [1, a - 1], x)
def hp(x, a): return x - lp(x, a)
def ramp(x, a, b): return np.clip((x - a) / (b - a), 0, 1)
def env_ar(n, a, r):
    e = np.ones(n); A = max(1, int(a * SR)); R = max(1, int(r * SR)); e[:A] = np.linspace(0, 1, A); e[-R:] *= np.linspace(1, 0, R); return e
WARP = [[0.0, 0.0], [4.0, 3.94], [5.9, 5.78], [10.86, 10.89], [17.08, 17.11], [18.56, 18.65], [23.29, 23.46], [24.0, 24.24], [26.9, 27.18], [28.87, 29.13], [29.94, 30.18], [31.92, 32.31], [32.71, 33.21], [34.05, 34.63], [36.82, 37.55], [37.99, 38.69], [40.66, 41.28], [43.84, 44.47], [48.39, 48.84], [49.44, 49.88], [53.09, 53.63], [54.13, 54.64], [56.1, 56.55], [59.36, 59.72], [62.5, 62.5]]
def vt(x):  # choreography time -> video time (inverse warp; voice is take 2)
    return float(np.interp(x, [b for a, b in WARP], [a for a, b in WARP]))
L = np.zeros(N); R = np.zeros(N)
def add(sig, at, gain=1.0, pan=0.0):
    i = int(vt(at) * SR); n = min(len(sig), N - i)
    if n <= 0 or i < 0: return
    L[i:i + n] += sig[:n] * gain * np.sqrt(.5 * (1 - pan)); R[i:i + n] += sig[:n] * gain * np.sqrt(.5 * (1 + pan))

def thud(dur=.4, f0=80, f1=50, noise=.4, damp=12):
    n = int(dur * SR); tt = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-tt * 20)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * damp) + noise * lp(rng.standard_normal(n), .15) * np.exp(-tt * 40)
def clank(f=600, dur=.5, damp=1.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * m * tt + rng.random() * 6) * np.exp(-tt * (10 + 6 * m) * damp) / m for m in (1, 2.76, 5.4, 8.9))
    return s + .4 * rng.standard_normal(n) * np.exp(-tt * 150)
def step(hard=False):
    n = int(.16 * SR); tt = np.arange(n) / SR
    return lp(rng.standard_normal(n), .3 if hard else .12) * np.exp(-tt * 40) + .5 * np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 35)
def whoosh(dur, a0=.03, a1=.3):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); al = np.linspace(a0, a1, n)
    for i in range(0, n, 256): out[i:i + 256] = lp(x[i:i + 256], al[i])
    return out * np.sin(np.linspace(0, np.pi, n)) ** 1.5

# ---------- shot-based space: inside gym vs street ----------
outside = np.zeros(N); outside[int(vt(3.94) * SR):int(vt(5.78) * SR)] = 1; outside[int(vt(48.84) * SR):int(vt(53.63) * SR)] = 1
k = int(.1 * SR); outside = np.convolve(outside, np.ones(k) / k, 'same'); inside = 1 - outside * .75

# HVAC / room tone
hum = lp(rng.standard_normal(N), .006) * 1.4 + .08 * np.sin(2 * np.pi * 59.7 * t) + .04 * np.sin(2 * np.pi * 119.4 * t)
add(hum * inside, 0, .55)
# street ambience (wind + distant traffic)
street = lp(rng.standard_normal(N), .02) * (0.7 + .3 * np.sin(2 * np.pi * .11 * t))
add(street * outside, 0, .9, -.3); add(np.roll(street, 20000) * outside, 0, .9, .3)
# distant random weight clanks around the gym
kk = 0.5
while kk < DUR - 1:
    add(lp(clank(500 + rng.random() * 700, .6), .5), kk, .05 * inside[int(kk * SR)], rng.random() * 1.6 - .8)
    kk += rng.exponential(2.2)
# treadmill runner (belt whir + footfalls)
belt = lp(rng.standard_normal(N), .05) * .3 + .05 * np.sin(2 * np.pi * 180 * t)
add(belt * inside * .6, 0, .25, -.6)
for k2 in np.arange(.1, DUR, np.pi / 9.5): add(thud(.12, 90, 60, .6, 40), k2, .07 * inside[min(N - 1, int(k2 * SR))], -.6)

# ---------- events ----------
add(thud(1.6, 55, 32, .2, 2.2), .3, .5)                                    # title impact
add(whoosh(.8, .05, .35), 5.5, .3); add(np.sin(2 * np.pi * 1800 * np.arange(int(.09 * SR)) / SR) * env_ar(int(.09 * SR), .005, .02), 5.62, .05)  # door slide + chime
for k2 in np.arange(5.85, 8.0, np.pi / 8): add(step(True), k2, .35, .3)    # guy walks in
add(whoosh(.5, .1, .4), 9.6, .08)                                          # shoulder roll
add(clank(380, .7, .8), 11.5, .28); add(thud(.4, 70, 50, .6, 14), 11.5, .2)  # bar breaks floor
for k2 in (11.9, 12.3): add(clank(420, .3), k2, .06)                       # plates rattle at top
add(thud(.9, 70, 38, 1.0, 6), 13.1, .9); add(clank(360, .9, .7), 13.12, .35); add(clank(410, .8, .7), 13.2, .25)  # drop
add(whoosh(1.2, .15, .02), 13.15, .25)                                     # chalk puff
for k2 in np.arange(15.3 + np.pi / 9, 17.0, 2 * np.pi / 9): add(thud(.15, 110, 70, .5, 30), k2, .18)   # push-up reps
for k2 in np.arange(17.1, 23.4, .82): add(thud(.25, 55, 40, .1, 22), k2, .35); add(thud(.25, 50, 38, .1, 24), k2 + .2, .22)  # heartbeat (staring)
for k2 in np.arange(.4, 26.0, 2 * np.pi / 2.6): add(clank(1500, .15, 1.5), k2, .02, -.2)  # girl's dumbbell clinks (subtle)
for k2 in np.arange(20.3, 24.6, np.pi / 7.5): add(step(), k2, .18, .1)     # creeping closer
add(clank(700, .4), 26.3, .1); add(clank(760, .4), 26.36, .08)            # dumbbells down
for k2 in np.arange(32.7, 35.6, np.pi / 8.5): add(step(), k2, .2, -.2)      # she walks away
for k2 in np.arange(32.95, 36.2, np.pi / 8.5): add(step(True), k2, .22, .2) # he follows
for k2 in np.arange(35.6 + np.pi / 3, 38.3, 2 * np.pi / 3): add(clank(900, .3), k2, .07, -.3)  # cable stack
for k2 in np.arange(36.6, 40.8, .7): add(thud(.25, 55, 40, .1, 22), k2, .45); add(thud(.25, 50, 38, .1, 24), k2 + .19, .3)  # heartbeat (turn)
add(whoosh(1.0, .02, .2), 37.0, .2)
add(np.sin(2 * np.pi * 2400 * np.arange(int(.03 * SR)) / SR) * env_ar(int(.03 * SR), .002, .01), 40.9, .05)   # screen tap
n = int(.9 * SR); tt = np.arange(n) / SR; ring = (np.sin(2 * np.pi * 440 * tt) + np.sin(2 * np.pi * 480 * tt)) * env_ar(n, .02, .05)
add(lp(ring, .3), 41.0, .03); add(clank(3000, .05), 41.95, .04)
for k2 in np.arange(44.4, 46.5, .27): add(step(True), k2, .3, .4); add(step(True), k2 + .12, .25, .5)   # guards hurry in
st = hp(rng.standard_normal(int(.5 * SR)), .3) * env_ar(int(.5 * SR), .01, .1)
add(np.sin(2 * np.pi * 1400 * np.arange(int(.08 * SR)) / SR) * .6, 46.6, .05); add(st, 46.7, .05)   # radio chirp + static
# police: approach + two siren whoops + car door
s0 = int(vt(45.6) * SR); tt = t[s0:] - vt(45.6)
eng = (np.sin(2 * np.pi * 38 * tt) * .5 + lp(rng.standard_normal(len(tt)), .02) * 2.5) * np.clip(tt / 2.5, 0, 1) * (1 - ramp(t[s0:], 48.6, 50.0) * .7)
E = np.zeros(N); E[s0:] = eng; add(E * (outside * .7 + .3), 0, .25, -.4)
for a in (46.1, 47.4, 49.2):
    n = int(.6 * SR); tt = np.arange(n) / SR; f = 600 + 900 * (tt / .6) ** .7; w = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ar(n, .02, .15)
    add(lp(w, .35), a, .05 if a < 48.8 else .08, -.2)
add(thud(.3, 90, 60, .9, 20), 49.05, .25)
add(whoosh(.8, .05, .35), 51.9, .25)                                       # doors open
for k2 in np.arange(49.5, 53.6, np.pi / 7.5): add(step(True), k2, .2, .2)  # escorted out
add(thud(1.4, 60, 34, .3, 2.5), 49.85, .45)                                # mission failed hit
add(thud(1.8, 50, 30, .2, 2.0), 54.5, .5); add(thud(1.8, 48, 28, .2, 2.0), 57.35, .45)  # end cards

sfx = np.stack([L, R])
v = load('audio/voice_adam.mp3'); vo = np.zeros(N); i0 = int(OFF * SR); vo[i0:i0 + len(v)] = v[:N - i0]
ve = np.convolve(np.abs(vo), np.ones(int(.12 * SR)) / int(.12 * SR), 'same'); duck = 1 - .45 * np.clip(ve * 10, 0, 1)
sfx /= np.abs(sfx).max()
mix = sfx * duck * .32 + vo[None, :]
fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo); fade[:int(.05 * SR)] = np.linspace(0, 1, int(.05 * SR)); mix *= fade
mix /= max(1e-6, np.abs(mix).max() / .95)
with wave.open('audio/final_mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print('ok', DUR, 'voice end', OFF + len(v) / SR)

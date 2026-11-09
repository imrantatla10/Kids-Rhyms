# Natural sound design (NO music) + Adam voice-over (ElevenLabs take 2, pauses tightened) -> audio/final_mix.wav
# Timeline matches src/scene.html (voice offset 0.8 s, duration 63.5 s). ch(i) = start of phrase i in video time.
import numpy as np, subprocess, wave, json
from scipy.signal import lfilter

SR = 48000; DUR = 63.5; N = int(SR * DUR); t = np.arange(N) / SR; OFF = 0.8
CH = [c[0] + OFF for c in json.load(open('audio/chunks.json'))]
ch = lambda i: CH[i]
rng = np.random.default_rng(51)
def load(p):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
def lp(x, a): return lfilter([a], [1, a - 1], x)
def hp(x, a): return x - lp(x, a)
def ramp(x, a, b): return np.clip((x - a) / (b - a), 0, 1)
def env_ar(n, a, r):
    e = np.ones(n); A = max(1, int(a * SR)); R = max(1, int(r * SR)); e[:A] = np.linspace(0, 1, A); e[-R:] *= np.linspace(1, 0, R); return e
L = np.zeros(N); R = np.zeros(N)
def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0 or i < 0: return
    L[i:i + n] += sig[:n] * gain * np.sqrt(.5 * (1 - pan)); R[i:i + n] += sig[:n] * gain * np.sqrt(.5 * (1 + pan))
def seg_env(a, b, fa=.3, fb=.3):
    e = np.zeros(N); e[int(a * SR):int(b * SR)] = 1; k = int(max(fa, .02) * SR); return np.convolve(e, np.ones(k) / k, 'same')
def thud(dur=.4, f0=80, f1=50, noise=.4, damp=12):
    n = int(dur * SR); tt = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-tt * 20)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * damp) + noise * lp(rng.standard_normal(n), .15) * np.exp(-tt * 40)
def clank(f=600, dur=.5):
    n = int(dur * SR); tt = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * m * tt + rng.random() * 6) * np.exp(-tt * (10 + 6 * m)) / m for m in (1, 2.76, 5.4)) + .3 * rng.standard_normal(n) * np.exp(-tt * 150)
def crunch():
    n = int(.2 * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n) * (rng.random(n) < .25)
    return lp(x, .35) * np.exp(-tt * 22) + .3 * lp(rng.standard_normal(n), .08) * np.exp(-tt * 30)
def beep(f, d=.08, a=1.0):
    n = int(d * SR); tt = np.arange(n) / SR; return np.sin(2 * np.pi * f * tt) * env_ar(n, .004, .02) * a
def whoosh(dur, a0=.03, a1=.3):
    n = int(dur * SR); x = rng.standard_normal(n); k = np.linspace(0, 1, n)
    out = lp(x, a0) * (1 - k) + lp(x, a1) * k
    return out * np.sin(np.linspace(0, np.pi, n)) ** 1.5
def shutter():
    s = np.zeros(int(.12 * SR)); a = clank(2600, .05)[:len(s) // 3]; s[:len(a)] += a; b = clank(2200, .05)[:len(s) // 3]; s[int(.06 * SR):int(.06 * SR) + len(b)] += b * .8; return hp(s, .3)

# ---------- ambiences ----------
day_ext = seg_env(0, ch(16), .5) * (1 - seg_env(ch(10), ch(11), .2) * .5)
night = seg_env(ch(17) + 1.6, DUR, 1.0) * (1 - seg_env(ch(18) + 1.9, ch(19), .2))
space_amb = seg_env(ch(16), ch(17), .15)
under = seg_env(ch(18), ch(19), .2)
wind = lp(rng.standard_normal(N), .012) * (0.6 + .4 * np.sin(2 * np.pi * .09 * t) * np.sin(2 * np.pi * .23 * t + 1))
wind2 = hp(lp(rng.standard_normal(N), .08), .02) * .25 * (0.5 + .5 * np.sin(2 * np.pi * .17 * t))
# removed on request: continuous wind-hiss background
# crickets at night
cr = np.zeros(N)
for k, (f, pan) in enumerate([(4300, -.5), (4700, .4), (3900, .1)]):
    rate = 14 + k * 3; ph = rng.random()
    burst = (np.sin(2 * np.pi * rate * t + ph * 6) > .3).astype(float) * (np.sin(2 * np.pi * (.55 + k * .13) * t + k) > -.2)
    cr += np.sin(2 * np.pi * f * t) * lp(burst, .05) * (.6 + .4 * rng.random())
# removed on request: cricket chirp background
# space: deep near-silent hum
add((np.sin(2 * np.pi * 48 * t) * .3) * space_amb, 0, .25)   # tonal only (hiss removed)
# underground: hum + drips
add((np.sin(2 * np.pi * 60 * t) * .2 + np.sin(2 * np.pi * 120 * t) * .1) * under, 0, .35)   # tonal only (hiss removed)
for k in np.arange(ch(18) + 2.2, ch(19), .9): add(beep(1800 + rng.random() * 800, .03, .5), k, .06, rng.random() - .5)

# ---------- events ----------
add(thud(1.8, 55, 30, .2, 2.0), ch(1) - .05, .55)                                      # AREA 51 hit
n = int(1.5 * SR); add(lp(rng.standard_normal(n), .03) * env_ar(n, .2, .4) * 2 + clank(140, 1.5) * .3, ch(1), .35)  # hangar doors roll
for k in (ch(2) + .5, ch(2) + 1.1, ch(2) + 1.4): add(shutter(), k, .55, .3)            # camera shutter
add(crunch(), ch(2) + .1, .3)
n = int(1.4 * SR); tt = np.arange(n) / SR; add(lp(np.sin(2 * np.pi * (180 + 40 * np.sin(tt * 7)) * tt), .1) * env_ar(n, .3, .4), ch(3) + .3, .05)  # sign creak
for k in np.arange(ch(3), ch(4) - .1, np.pi / 7): add(crunch(), k, .35, -.2)            # walking to the line
add(whoosh(2.0, .01, .08), ch(5), .5)                                                   # gust over flat desert
n = int((ch(8) + .8 - ch(7)) * SR); tt = np.arange(n) / SR                               # mountains rising
rum = (lp(rng.standard_normal(n), .006) * 6 + np.sin(2 * np.pi * (28 + 6 * tt) * tt) * .5) * np.clip(tt / 1.0, 0, 1) * np.clip((n / SR - tt) / .6, 0, 1)
add(rum, ch(7), .55); add(lp(rng.standard_normal(n), .05) * np.clip(tt / 1.2, 0, 1) * np.clip((n / SR - tt) / .6, 0, 1), ch(7), .12)
add(thud(1.4, 50, 30, .3, 2.5), ch(8) + .6, .35)
n = int(.5 * SR); tt = np.arange(n) / SR; add(np.sin(2 * np.pi * 330 * tt) * np.exp(-tt * 6) * .5, ch(9) + .6, .05)  # fence wire twang
for k in np.arange(ch(10) - .1, ch(11), np.pi / 6.5): add(crunch(), k, .45, .1); add(beep(1250, .05), k + .05, .07, -.2)  # footsteps + sensor
add(beep(880, .12), ch(10) + .6, .06); add(beep(880, .12), ch(10) + .8, .06)
# trucks: engine + gravel, door
s0 = int((ch(11) - .6) * SR); n = int((ch(12) - ch(11) + .6) * SR); tt = np.arange(n) / SR
eng = (np.sin(2 * np.pi * (52 + 8 * np.clip(tt / 2, 0, 1)) * tt) * .5 + lp(rng.standard_normal(n), .03) * 2.2 + lp(rng.standard_normal(n), .2) * .4) * np.clip(tt / .4, 0, 1) * np.where(tt < 2.2, 1, np.clip((n / SR - tt) / .5, 0, 1) * .35 + .0)
add(eng, ch(11) - .6, .35, .2)
add(thud(.3, 120, 80, .9, 20), ch(11) + 2.0, .3, .3)
# radar: motor + pings with echoes
for k in np.arange(ch(12) + .1, ch(13), 1 / .7): add(beep(1400, .18) * np.exp(-np.arange(int(.18 * SR)) / SR * 8), k, .09); add(beep(1400, .14), k + .7, .05)  # echo returns
add((np.sin(2 * np.pi * 85 * t) * .3) * seg_env(ch(12), ch(13), .2), 0, .1)
add(whoosh(1.0, .05, .4), ch(13) - .2, .25); add(clank(1900, 1.0), ch(13) + .1, .04)  # reveal shimmer
for k in np.arange(ch(14) + .3, ch(15), 1 / .7): add(beep(1400, .18) * np.exp(-np.arange(int(.18 * SR)) / SR * 8), k, .09)   # no echo
for k in np.arange(ch(14) + .6, ch(15), .45): add(whoosh(.25, .1, .5), k, .06, rng.random() - .5)
# jet flyover (stealth hero) — roar with doppler-ish sweep
n = int((ch(16) - ch(15) + .6) * SR); tt = np.arange(n) / SR; x = lp(rng.standard_normal(n), .08) * 2 + hp(rng.standard_normal(n), .3) * .3
envj = np.exp(-((tt - (n / SR) * .55) / .8) ** 2); add(x * envj, ch(15) - .2, .45, -.3); add(np.roll(x, 600) * envj, ch(15) - .2, .45, .3)
add(thud(1.8, 55, 30, .2, 2.0), ch(15), .45)
# satellite: electronic shutter
add(shutter() * .6, ch(16) + 1.2, .25); add(beep(2400, .04), ch(16) + 1.25, .05)
# day→night: hangar doors + taxi whine
n = int(1.2 * SR); add(lp(rng.standard_normal(n), .03) * env_ar(n, .2, .4) * 2, ch(17) + 2.0, .25)
n = int((ch(18) - ch(17) - 2.2) * SR); tt = np.arange(n) / SR; add((np.sin(2 * np.pi * (900 + 200 * tt) * tt) * .2 + lp(rng.standard_normal(n), .05)) * np.clip(tt, 0, 1), ch(17) + 2.3, .12)
# lift: hydraulic hum + clunk
n = int(2.0 * SR); tt = np.arange(n) / SR; add((np.sin(2 * np.pi * (70 - 10 * tt) * tt) * .6 + lp(rng.standard_normal(n), .02) * 1.5) * env_ar(n, .2, .3), ch(18), .35); add(thud(.8, 60, 40, .8, 6), ch(18) + 1.9, .4)
# night town: faint high jet whoosh as the shape crosses
n = int((ch(21) - ch(19)) * SR); tt = np.arange(n) / SR; add(lp(rng.standard_normal(n), .04) * np.sin(np.linspace(0, np.pi, n)) ** 2, ch(19), .12, -.4)
add(thud(1.4, 60, 34, .2, 2.5), ch(21) + .2, .35)                                         # UFO?! hit
# finale: distant flyover + end hit
n = int((DUR - ch(23)) * SR); tt = np.arange(n) / SR; add(lp(rng.standard_normal(n), .05) * np.exp(-((tt - 2.5) / 1.5) ** 2) * 1.5, ch(23), .2, .2)
add(thud(2.0, 50, 28, .2, 1.8), ch(23) + 2.2, .5)

sfx = np.stack([L, R]); sfx /= np.abs(sfx).max()
# SFX were laid out on the choreography (take 1) timeline; resample onto the video timeline of take 2
WJ = json.load(open('audio/warp_take2.json')); VD = WJ['dur']; NV = int(SR * VD); tv = np.arange(NV) / SR
tc = np.interp(tv, [a for a, b in WJ['warp']], [b for a, b in WJ['warp']])
sfx = np.stack([np.interp(tc, t, ch_) for ch_ in sfx]); N = NV
v = load('audio/voice_adam.mp3'); vo = np.zeros(N); i0 = int(OFF * SR); vo[i0:i0 + len(v)] = v[:N - i0]
ve = np.convolve(np.abs(vo), np.ones(int(.12 * SR)) / int(.12 * SR), 'same'); duck = 1 - .45 * np.clip(ve * 10, 0, 1)
mix = sfx * duck * .34 + vo[None, :]
fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo); fade[:int(.05 * SR)] = np.linspace(0, 1, int(.05 * SR)); mix *= fade
mix /= max(1e-6, np.abs(mix).max() / .95)
with wave.open('audio/final_mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print('ok', VD, 'voice end', OFF + len(v) / SR)

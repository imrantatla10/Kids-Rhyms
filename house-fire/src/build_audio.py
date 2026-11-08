# Natural sound design (NO music) + Adam voice-over (ElevenLabs, take 2) -> audio/final_mix.wav
# All SFX are synthesised here from noise/oscillators. Timeline must match src/scene.html.
import numpy as np, subprocess, wave

SR = 48000; DUR = 60.0; N = int(SR * DUR); t = np.arange(N) / SR
OFF = 1.2
rng = np.random.default_rng(7)

def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def lp(x, a):  # one-pole low-pass, a in (0,1): smaller = darker
    from scipy.signal import lfilter
    return lfilter([a], [1, a - 1], x)

def hp(x, a): return x - lp(x, a)
def seg(a, b): return slice(int(a * SR), min(N, int(b * SR)))
def env_ar(n, a, r):
    e = np.ones(n); A = max(1, int(a * SR)); R = max(1, int(r * SR)); e[:A] = np.linspace(0, 1, A); e[-R:] *= np.linspace(1, 0, R); return e
def ramp(x, a, b): return np.clip((x - a) / (b - a), 0, 1)

L = np.zeros(N); Rch = np.zeros(N)
def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0: return
    gl, gr = np.sqrt(.5 * (1 - pan)), np.sqrt(.5 * (1 + pan))
    L[i:i + n] += sig[:n] * gain * gl; Rch[i:i + n] += sig[:n] * gain * gr

# ---------- scene loudness map ----------
# (start, end, kind) — kind decides ambience balance
SH = [(0, 2.05, 'ext'), (2.05, 5.65, 'bed'), (5.65, 9.48, 'hall'), (9.48, 13.07, 'bed'), (13.07, 15.76, 'hall'), (15.76, 18.54, 'bed'),
      (18.54, 22.52, 'hall'), (22.52, 28.7, 'bed'), (28.7, 32.93, 'ext'), (32.93, 41.53, 'bed'), (41.53, DUR, 'ext')]
def curve(vals):
    c = np.zeros(N)
    for a, b, k in SH: c[seg(a, b)] = vals[k]
    k = int(.08 * SR); return np.convolve(c, np.ones(k) / k, 'same')
fireAmt = curve({'ext': .55, 'bed': .25, 'hall': 1.0})
doorShut = ramp(t, 11.4, 12.05)
fireAmt *= np.where((t > 9.48) & (t < 41.53) & (fireAmt < .5), 1 - .45 * doorShut, 1)
fireAmt *= .8 + .35 * ramp(t, 0, 50)
extAmt = curve({'ext': 1.0, 'bed': .0, 'hall': .0})
intAmt = 1 - extAmt

# ---------- fire roar (brown noise, slow swells) ----------
brown = np.cumsum(rng.standard_normal(N)); brown = hp(brown, .002); brown /= np.abs(brown).max()
roar = lp(brown, .08) * (0.7 + .3 * np.sin(2 * np.pi * .23 * t) * np.sin(2 * np.pi * .41 * t + 1))
roar2 = lp(rng.standard_normal(N), .03)
fireBed = (roar * 1.6 + roar2 * .5) * fireAmt
add(fireBed, 0, .55, -.15); add(np.roll(fireBed, 900), 0, .55, .15)

# ---------- crackles & pops ----------
cr = np.zeros(N)
dens = 18 + 40 * fireAmt
k = 0
while True:
    k += rng.exponential(1 / 40)
    if k >= DUR - .1: break
    i = int(k * SR)
    if rng.random() > dens[i] / 58: continue
    n = int(SR * (.004 + rng.random() * .02)); burst = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (180 + rng.random() * 300))
    amp = (.15 + rng.random() ** 3 * .9) * fireAmt[i]
    cr[i:i + n] += burst * amp
cr = hp(cr, .25)
add(cr, 0, .65, -.3); add(np.roll(cr, 1700), 0, .5, .35)

# ---------- smoke alarm (T3 pattern, muffled outside) ----------
alarm = np.zeros(N)
cyc = 0.0
while cyc < 41.5:
    for b in range(3):
        a = cyc + b * 1.0; n = int(.5 * SR); tt = np.arange(n) / SR
        s = np.sign(np.sin(2 * np.pi * 3100 * tt)) * .5 + np.sin(2 * np.pi * 3100 * tt) * .5
        s *= env_ar(n, .004, .01); i = int(a * SR)
        if i + n < N: alarm[i:i + n] += s
    cyc += 4.5
alarm = lp(alarm, .5)
alarmLvl = intAmt * .05 + extAmt * .012
alarmLvl *= np.where(t < 2.05, 0.4, 1) * (1 - ramp(t, 41.0, 41.6))
add(alarm * alarmLvl, 0, 1.0, .2)

# ---------- wind + distant night ambience outside ----------
wind = lp(rng.standard_normal(N), .01) * (0.6 + .4 * np.sin(2 * np.pi * .13 * t))
add(wind * extAmt, 0, .9, -.4); add(np.roll(wind, 30000) * extAmt, 0, .9, .4)
room = lp(rng.standard_normal(N), .004) * intAmt
add(room, 0, .6)

# ---------- one-shots ----------
def thud(dur=.6, f0=70, f1=45, noise=.4, damp=9):
    n = int(dur * SR); tt = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-tt * 20)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * damp) + noise * lp(rng.standard_normal(n), .15) * np.exp(-tt * 40)
    return s
def noise_sweep(dur, a0, a1, shape='hump'):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); y = 0.0
    alpha = np.linspace(a0, a1, n)
    for i in range(0, n, 256):
        out[i:i + 256] = lp(x[i:i + 256], alpha[i])
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5 if shape == 'hump' else np.exp(-np.linspace(0, 6, n))
    return out * e
def clank(f=900, dur=.5):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * m * tt + rng.random() * 6) * np.exp(-tt * (12 + 6 * m)) / m for m in (1, 2.76, 5.4, 8.9))
    return s + .5 * rng.standard_normal(n) * np.exp(-tt * 120)
def step(soft=True):
    n = int(.18 * SR); tt = np.arange(n) / SR
    return lp(rng.standard_normal(n), .08 if soft else .25) * np.exp(-tt * 35) + .6 * np.sin(2 * np.pi * 60 * tt) * np.exp(-tt * 30)

# door slam at 12.05
add(thud(.8, 90, 50, .6, 7), 12.02, .9); add(clank(1400, .15), 12.03, .05)
# door creak while closing
n = int(.6 * SR); tt = np.arange(n) / SR; cre = np.sin(2 * np.pi * (300 + 120 * np.sin(tt * 9)) * tt + 3 * np.sin(2 * np.pi * 37 * tt)) * env_ar(n, .1, .2)
add(lp(cre, .2), 11.4, .08)
# towel swish + press
add(noise_sweep(.7, .05, .4), 16.0, .35); add(thud(.3, 80, 60, .8, 25), 16.85, .25)
# fire whooshes at the hallway / stair cuts
for a in (5.65, 7.45, 18.54): add(noise_sweep(1.4, .02, .25), a - .3, .9)
# distant glass break when fire gets closer
gb = np.zeros(int(1.2 * SR))
for j in range(40):
    i = int(rng.random() * .5 * SR + rng.exponential(.05) * SR) % (len(gb) - 6000); gb[i:i + 6000] += clank(2000 + rng.random() * 4000, .125)[:6000] * rng.random() * .4
add(lp(gb, .35), 19.4, .25, -.5); add(thud(.5, 60, 40, 1, 10), 19.4, .3, -.5)
# heartbeat tension under "door is getting dangerously hot"
for k in np.arange(31.9, 36.9, .78):
    add(thud(.25, 55, 40, .1, 22), k, .5); add(thud(.25, 50, 38, .1, 24), k + .2, .32)
# 911 keypad tones + ring + connect click
DT = {'9': (852, 1477), '1': (697, 1209)}
for d, a in zip('911', (23.05, 23.3, 23.55)):
    n = int(.14 * SR); tt = np.arange(n) / SR; s = (np.sin(2 * np.pi * DT[d][0] * tt) + np.sin(2 * np.pi * DT[d][1] * tt)) * env_ar(n, .005, .02)
    add(s, a, .06)
n = int(1.0 * SR); tt = np.arange(n) / SR; ring = (np.sin(2 * np.pi * 440 * tt) + np.sin(2 * np.pi * 480 * tt)) * env_ar(n, .02, .05)
add(lp(ring, .3), 24.95, .035); add(clank(3000, .05), 26.12, .05)
# window slide open
add(noise_sweep(.6, .1, .3) * .7 + lp(cre[:int(.6 * SR)], .1) * .3, 28.55, .3)
# cloth flapping
fl = lp(rng.standard_normal(N), .3) * np.clip(np.sin(2 * np.pi * 1.11 * t), 0, 1) ** 4
fl[: int(28.75 * SR)] = 0; fl[int(32.9 * SR):] = 0
add(fl, 0, .22, .2)
# hooks land on sill, ladder unrolls (rattling clanks)
add(clank(780, .6), 38.38, .3); add(clank(820, .6), 38.42, .25)
for k in np.arange(38.65, 39.65, .09): add(clank(600 + rng.random() * 500, .25), k, .12 * (1 - (k - 38.65)), rng.random() - .5)
add(thud(.5, 70, 45, .3, 12), 39.62, .25)
# climbing: hand/foot on rungs
for k in np.arange(42.3, 44.7, np.pi / 6.5): add(clank(700 + rng.random() * 200, .2), k, .09); add(step(False), k + .03, .25)
# footsteps on grass to the meeting spot
for k in np.arange(44.85, 48.6, np.pi / 8.5 * 1.0): add(step(True), k, .35, .1)
# fire truck: engine + siren approaching (doppler-ish swell)
truckE = np.zeros(N); s0 = int(46.0 * SR)
tt = t[s0:] - 46.0
eng = (np.sin(2 * np.pi * 42 * tt) * .6 + lp(rng.standard_normal(len(tt)), .02) * 3) * np.clip(tt / 4.0, 0, 1)
truckE[s0:] = eng * (1 - .5 * ramp(t[s0:], 50.4, 52))
sir_f = 960 + 380 * np.sin(2 * np.pi * .23 * tt)  # slow wail
sir = np.sin(2 * np.pi * np.cumsum(sir_f) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(sir_f) / SR)
sirEnv = np.clip((tt) / 4.2, 0, 1) ** 2 * (1 - .55 * ramp(t[s0:], 51.5, 58))
siren = np.zeros(N); siren[s0:] = lp(sir, .35) * sirEnv
add(truckE, 0, .35, -.4); add(siren, 0, .075, -.25); add(np.roll(siren, 400), 0, .06, .25)
add(noise_sweep(.4, .2, .05, 'decay'), 50.35, .3)  # air brakes
# water spray hiss
spray = hp(rng.standard_normal(N), .2) * ramp(t, 53.4, 54.0); spray = lp(spray, .6)
add(spray, 0, .09, -.3)
# title / end impacts (natural low thumps, not music)
add(thud(1.6, 55, 32, .2, 2.2), .25, .55); add(thud(1.8, 50, 30, .2, 2.0), 55.0, .55)

sfx = np.stack([L, Rch])
# ---------- voice ----------
v = load('audio/voice_adam.mp3'); vo = np.zeros(N); i0 = int(OFF * SR); vo[i0:i0 + len(v)] = v[:N - i0]
ve = np.convolve(np.abs(vo), np.ones(int(.12 * SR)) / int(.12 * SR), 'same')
duck = 1 - .45 * np.clip(ve * 10, 0, 1)
mix = sfx * duck * .32 + vo[None, :] * 1.0
fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo); fade[:int(.05 * SR)] = np.linspace(0, 1, int(.05 * SR))
mix *= fade
mix /= max(1e-6, np.abs(mix).max() / .95)
with wave.open('audio/final_mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print('ok', DUR, 'voice end', OFF + len(v) / SR)

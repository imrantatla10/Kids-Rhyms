"""Tighten the supplied voiceover (77.6 s) to fit a ~66 s video.

1. Detect real pauses (RMS envelope) and cap each one at MAX_GAP seconds.
2. Apply a gentle pitch-preserving tempo change (ffmpeg atempo) so the voice ends at VOICE_END.
3. Remap the Whisper word timestamps to the new timeline -> audio/voice/segments.json
Output: audio/voice/voice_tight.wav (48 kHz mono)
"""
import json, os, subprocess
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = os.path.join(ROOT, "audio", "voice")
SR = 48000
MAX_GAP = 0.20          # longest pause kept (s)
LEAD = 0.25             # silence before first word
VOICE_END = 64.9        # last word should end here (video = 66 s)

raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(V, "voiceover_original.mp3"),
                      "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).copy()
hop = int(0.01 * SR)
rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 3) / (hop * 3), "same"))[::hop]
db = 20 * np.log10(rms + 1e-9)
thr = np.percentile(db, 95) - 38
voiced = db > thr
# silent runs >= 0.18 s
runs, i, n = [], 0, len(voiced)
while i < n:
    if not voiced[i]:
        j = i
        while j < n and not voiced[j]:
            j += 1
        if (j - i) * 0.01 >= 0.18:
            runs.append((i * 0.01, j * 0.01))
        i = j
    else:
        i += 1
first = next(k for k in range(n) if voiced[k]) * 0.01
last = (n - 1 - next(k for k in range(n) if voiced[n - 1 - k])) * 0.01 + 0.08
first = max(0, first - 0.05)

# keep-intervals in original time
cuts = [(a, b) for a, b in runs if a > first and b < last and b - a > MAX_GAP]
keep, t = [], first
for a, b in cuts:
    pad = MAX_GAP / 2
    keep.append((t, a + pad))
    t = b - pad
keep.append((t, last))
pieces = [x[int(a * SR):int(b * SR)] for a, b in keep]
# short crossfades
fade = int(0.008 * SR)
out = []
for p in pieces:
    p = p.copy()
    p[:fade] *= np.linspace(0, 1, fade)
    p[-fade:] *= np.linspace(1, 0, fade)
    out.append(p)
y = np.concatenate(out)
tight_len = len(y) / SR
tempo = tight_len / (VOICE_END - LEAD)
print(f"tight {tight_len:.2f}s, tempo {tempo:.3f}, cuts {len(cuts)}")

def remap(t0):
    acc = 0.0
    for a, b in keep:
        if t0 < a:
            return acc
        if t0 <= b:
            return acc + (t0 - a)
        acc += b - a
    return acc

tmp = os.path.join(V, "_tight.f32")
y.astype(np.float32).tofile(tmp)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", tmp,
                "-af", f"atempo={tempo:.5f},adelay={int(LEAD*1000)},highpass=f=70,"
                       "acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120,volume=1.4",
                os.path.join(V, "voice_tight.wav")], check=True)
os.remove(tmp)

tr = json.load(open(os.path.join(V, "transcript_original.json")))
segs = []
for s in tr:
    m = lambda t: round(LEAD + remap(t) / tempo, 3)
    segs.append({"start": m(s["words"][0]["s"]), "end": m(s["words"][-1]["e"]), "text": s["text"].strip(),
                 "words": [{"w": w["w"].strip(), "s": m(w["s"]), "e": m(w["e"])} for w in s["words"]]})
json.dump(segs, open(os.path.join(V, "segments.json"), "w"), indent=1)
for s in segs:
    print(f'{s["start"]:6.2f}-{s["end"]:6.2f} {s["text"]}')

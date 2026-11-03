"""Place the ElevenLabs voiceover (Dan) on the timeline and get word timings.

usage: python3 src/prep_voice.py <take.mp3> [whisper_model_dir]
-> audio/voice/voice.wav (starts at VOICE_START), audio/voice/segments.json (word timings for captions + scene beats)
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = os.path.join(ROOT, "audio", "voice")
SR = 48000
VOICE_START = float(os.environ.get("VOICE_START", "0.6"))   # short establishing shot before the narration
MAX_GAP = float(os.environ.get("MAX_GAP", "0.3"))           # cap long pauses
VOICE_LEN = float(os.environ.get("VOICE_LEN", "59.6"))      # target narration length (pitch-preserving tempo)

src = sys.argv[1]
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", src, "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).copy()
hop = int(0.01 * SR)
rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 3) / (hop * 3), "same"))[::hop]
db = 20 * np.log10(rms + 1e-9); voiced = db > np.percentile(db, 95) - 40
n = len(voiced)
first = max(0, next(k for k in range(n) if voiced[k]) * 0.01 - 0.04)
last = (n - 1 - next(k for k in range(n) if voiced[n - 1 - k])) * 0.01 + 0.15
runs, i = [], 0
while i < n:
    if not voiced[i]:
        j = i
        while j < n and not voiced[j]: j += 1
        a, b = i * 0.01, j * 0.01
        if a > first and b < last and b - a > MAX_GAP: runs.append((a, b))
        i = j
    else: i += 1
keep, t = [], first
for a, b in runs: keep.append((t, a + MAX_GAP / 2)); t = b - MAX_GAP / 2
keep.append((t, last))
fade = int(0.008 * SR); parts = []
for a, b in keep:
    p = x[int(a * SR):int(b * SR)].copy(); p[:fade] *= np.linspace(0, 1, fade); p[-fade:] *= np.linspace(1, 0, fade); parts.append(p)
y = np.concatenate(parts)
tempo = max(1.0, len(y) / SR / VOICE_LEN)
tmp = os.path.join(V, "_v.f32"); y.astype(np.float32).tofile(tmp)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", tmp,
                "-af", f"atempo={tempo:.5f},adelay={int(VOICE_START * 1000)},highpass=f=70,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120", os.path.join(V, "voice.wav")], check=True)
os.remove(tmp)
print(f"tight voice {len(y)/SR:.2f}s, tempo {tempo:.3f}, pauses capped: {len(runs)}")

# transcribe the placed voice for word timings
model_dir = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("WHISPER_MODEL", "small")
from faster_whisper import WhisperModel
a16 = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(V, "voice.wav"), "-ar", "16000", "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
segs, _ = WhisperModel(model_dir, device="cpu", compute_type="int8").transcribe(np.frombuffer(a16, np.float32), word_timestamps=True, language="en")
outs = []
for s in segs:
    ws = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for w in s.words]
    # split whisper segments at sentence ends so captions/beats stay tight
    cur = []
    for w in ws:
        cur.append(w)
        if w["w"].endswith((".", "!", "?")):
            outs.append({"start": cur[0]["s"], "end": cur[-1]["e"], "text": " ".join(q["w"] for q in cur), "words": cur}); cur = []
    if cur: outs.append({"start": cur[0]["s"], "end": cur[-1]["e"], "text": " ".join(q["w"] for q in cur), "words": cur})
json.dump(outs, open(os.path.join(V, "segments.json"), "w"), indent=1)
for s in outs: print(f'{s["start"]:6.2f}-{s["end"]:6.2f} {s["text"]}')

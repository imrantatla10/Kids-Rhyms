"""Prepare the voiceover (ElevenLabs take 2) for a ~64.7 s video.

Shortens silences longer than 0.18 s down to 0.12 s (measured from the audio
itself), then time-stretches with ffmpeg atempo (pitch kept) so the voice ends at
TARGET seconds. Word timestamps (ElevenLabs Scribe) are remapped onto the edit and
written to src/timing.json; audio goes to audio/vo.wav.
"""
import json, os, subprocess, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, TARGET = 48000, 63.4
src = os.path.join(ROOT, "audio/vo_take2.mp3")
tmp = os.path.join(ROOT, "audio/vo_take2.wav")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-ar", str(SR), "-ac", "1", tmp], check=True)
x = np.frombuffer(wave.open(tmp).readframes(10**9), np.int16).astype(np.float64)

hop = int(0.01 * SR)
rms = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, mode="same")[::hop] + 1e-9)
thr = np.percentile(rms, 95) * 10 ** (-30 / 20)
silent = rms < thr
# silent runs (in hops)
runs, i = [], 0
while i < len(silent):
    if silent[i]:
        j = i
        while j < len(silent) and silent[j]: j += 1
        runs.append((i, j)); i = j
    else: i += 1
keep_max = 0.12
pieces, tmap, o, last = [], [], 0.0, 0   # tmap: (src_t, dst_t) anchors
for a, b in runs:
    ta, tb = a * hop / SR, b * hop / SR
    if tb - ta < 0.18 or ta == 0: continue
    cut0 = ta + keep_max / 2; cut1 = tb - keep_max / 2
    seg = x[int(last * SR):int(cut0 * SR)]
    tmap.append((last, o)); o += len(seg) / SR; tmap.append((cut0, o))
    pieces.append(seg); last = cut1
seg = x[int(last * SR):]
tmap.append((last, o)); o += len(seg) / SR; tmap.append((len(x) / SR, o)); pieces.append(seg)
# crossfade-free joins happen inside silence, so a plain concat is clean
y = np.concatenate(pieces)
words = json.load(open(os.path.join(ROOT, "audio/words_take2.json")))
words = [w for w in (words["words"] if isinstance(words, dict) else words) if w.get("type", "word") == "word"]
# trim leading/trailing silence of the last word estimate
speech_end = np.interp(words[-1]["end"], *zip(*tmap))
speed = speech_end / TARGET
tm_src, tm_dst = zip(*tmap)
remap = lambda t: float(np.interp(t, tm_src, tm_dst)) / speed
out_words = [{"w": w["text"], "s": round(remap(w["start"]), 3), "e": round(remap(w["end"]), 3)} for w in words]
lines, cur = [], []
for w in out_words:
    cur.append(w)
    if w["w"][-1] == ".": lines.append(cur); cur = []
json.dump({"speed": round(speed, 4), "words": out_words, "lines": [{"s": l[0]["s"], "e": l[-1]["e"], "text": " ".join(w["w"] for w in l)} for l in lines]},
          open(os.path.join(ROOT, "src/timing.json"), "w"), indent=0)
tight = os.path.join(ROOT, "audio/vo_tight.wav")
with wave.open(tight, "wb") as ww:
    ww.setnchannels(1); ww.setsampwidth(2); ww.setframerate(SR); ww.writeframes(np.clip(y, -32768, 32767).astype(np.int16).tobytes())
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tight, "-filter:a", f"atempo={speed:.4f}", "-ar", str(SR), "-ac", "2", os.path.join(ROOT, "audio/vo.wav")], check=True)
print(f"tightened {len(x)/SR:.2f}s -> {o:.2f}s, speed {speed:.3f}, voice ends {lines[-1][-1]['e']:.2f}s, {len(lines)} lines")

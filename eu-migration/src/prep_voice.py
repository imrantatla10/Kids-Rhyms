"""Prepare narration: trim edges, cap long pauses, speed up (pitch kept), report phrase segments.

takes/a.mp3 (one ElevenLabs file) -> audio/voice/v1.wav and audio/voice/segments.json
"""
import json
import os
import subprocess

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VDIR = os.path.join(ROOT, "audio", "voice")
TAKES = ["a"]
SR = 44100
PAUSE_CAP = 0.22     # seconds of silence kept at most between phrases
TEMPO = 1.16
THRESH_DB = -40


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def speech_mask(x, win=0.02):
    n = int(win * SR)
    k = len(x) // n
    rms = np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(axis=1))
    db = 20 * np.log10(rms + 1e-9)
    return db > THRESH_DB, n


def segments(x, min_gap=0.12):
    m, n = speech_mask(x)
    segs, start = [], None
    for i, v in enumerate(m):
        if v and start is None:
            start = i
        if not v and start is not None:
            segs.append([start * n / SR, i * n / SR])
            start = None
    if start is not None:
        segs.append([start * n / SR, len(m) * n / SR])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] > 0.06]


def main():
    out = {}
    for i, take in enumerate(TAKES, 1):
        x = load(os.path.join(VDIR, "takes", f"{take}.mp3"))
        segs = segments(x, min_gap=0.15)
        pad = 0.03
        pieces = []
        for k, (a, b) in enumerate(segs):
            a = max(0, a - pad)
            b = min(len(x) / SR, b + pad)
            pieces.append(x[int(a * SR):int(b * SR)])
            if k < len(segs) - 1:
                gap = segs[k + 1][0] - segs[k][1] - 2 * pad
                pieces.append(np.zeros(int(max(0.0, min(gap, PAUSE_CAP)) * SR)))
        y = np.concatenate(pieces).astype(np.float32)
        tmp = os.path.join(VDIR, f"_tmp{i}.raw")
        y.tofile(tmp)
        dst = os.path.join(VDIR, f"v{i}.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", tmp,
                        "-af", f"atempo={TEMPO}", "-ar", str(SR), dst], check=True)
        os.remove(tmp)
        z = load(dst)
        segs2 = segments(z, min_gap=0.15)
        out[f"v{i}"] = {"dur": round(len(z) / SR, 3), "segments": [[round(a, 3), round(b, 3)] for a, b in segs2]}
        print(f"v{i}: {len(z) / SR:6.2f}s  " + " ".join(f"[{a:.2f}-{b:.2f}]" for a, b in segs2))
    json.dump(out, open(os.path.join(VDIR, "segments.json"), "w"), indent=1)
    print("total", round(sum(v["dur"] for v in out.values()), 2))


if __name__ == "__main__":
    main()

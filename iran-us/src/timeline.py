"""Shared timeline for "Iran vs America: What Happens If the Conflict Escalates Again?" (seconds).

Narration = 7 ElevenLabs clips (audio/voice/v1..v7.wav, made by prep_voice.py), placed at VOICE_START.
Event times come from the measured speech segments (segments.json), the Scribe word timings of
line 2, and character-weighted estimates inside longer phrases.
"""
import json
import os

FPS = 30
W, H = 1920, 1080
DURATION = 64.0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEG = json.load(open(os.path.join(ROOT, "audio", "voice", "segments.json")))

VOICE_START = [1.00, 7.70, 16.50, 24.70, 38.10, 47.30, 54.60]


def seg(i, k, edge=0):
    """Absolute time of segment k (0-based) of voice clip i (1-based); edge 0=start, 1=end."""
    return VOICE_START[i - 1] + SEG[f"v{i}"]["segments"][k][edge]


# scene windows (start, end); neighbouring scenes overlap by XF for crossfades
XF = 0.6
SCENES = {
    "hook":      (0.0, 7.4),
    "timeline":  (7.4, 16.2),
    "issues":    (16.2, 24.4),
    "forces":    (24.4, 37.8),
    "hormuz":    (37.8, 43.3),
    "economy":   (43.3, 47.1),
    "spread":    (47.1, 54.2),
    "diplomacy": (54.2, DURATION),
}
ORDER = list(SCENES)
TRANSITIONS = [SCENES[n][0] for n in ORDER[1:]]

v4_last = SEG["v4"]["segments"][3]
_v4a, _v4b = VOICE_START[3] + v4_last[0], VOICE_START[3] + v4_last[1]
_v3a, _v3b = seg(3, 1), seg(3, 1, 1)

EV = {
    # 1: "The confrontation between Iran and the United States | is far from a simple military comparison."
    "iran": seg(1, 0) + 1.55,
    "usa": seg(1, 0) + 2.45,
    "complex": seg(1, 1),
    # 2: Scribe word timings (clip starts 0.08 s into the take)
    "strikes": VOICE_START[1] + 0.86,
    "y2026": VOICE_START[1] + 2.14,
    "ceasefire": VOICE_START[1] + 3.62,
    "diplomatic": VOICE_START[1] + 4.56,
    "failed": VOICE_START[1] + 5.82,
    "settlement": VOICE_START[1] + 7.44,
    # 3: "Tensions have continued, | with the nuclear programme, sanctions and the Strait of Hormuz remaining ..."
    "tensions": seg(3, 0),
    "nuclear": _v3a + (_v3b - _v3a) * 9 / 102,
    "sanctions": _v3a + (_v3b - _v3a) * 28 / 102,
    "strait": _v3a + (_v3b - _v3a) * 46 / 102,
    "disagree": _v3a + (_v3b - _v3a) * 63 / 102,
    # 4: "Now imagine another serious escalation. | American forces have | powerful air and naval
    #     capabilities, | while Iran can threaten regional security through missiles, drones and pressure ..."
    "imagine": seg(4, 0),
    "escalation": seg(4, 0) + 1.5,
    "us_forces": seg(4, 1),
    "air": seg(4, 2) + 0.5,
    "naval": seg(4, 2) + 1.1,
    "iran_side": _v4a,
    "missiles": _v4a + (_v4b - _v4a) * 50 / 99,
    "drones": _v4a + (_v4b - _v4a) * 60 / 99,
    "shipping": _v4a + (_v4b - _v4a) * 71 / 99,
    # 5: "But there would be no easy victory. | A wider conflict could affect Gulf countries, |
    #     international trade and global energy prices."
    "novictory": seg(5, 0),
    "victory": seg(5, 0, 1) - 0.45,
    "wider": seg(5, 1),
    "gulf": seg(5, 1) + 1.75,
    "trade": seg(5, 2),
    "energy": seg(5, 2) + 1.45,
    # 6: "The real question is not simply who has more weapons. | It is how far the consequences could spread."
    "question": seg(6, 0),
    "weapons": seg(6, 0) + 2.2,
    "spread": seg(6, 1),
    # 7: "Could diplomacy prevent another major crisis?"
    "diplomacy": seg(7, 0) + 0.5,
    "qmark": seg(7, 0, 1) - 0.6,
}

if __name__ == "__main__":
    for k, v in sorted(EV.items(), key=lambda kv: kv[1]):
        print(f"{v:6.2f}  {k}")
    for i in range(7):
        print(f"v{i + 1}: {VOICE_START[i]:.2f} -> {VOICE_START[i] + SEG[f'v{i + 1}']['dur']:.2f}")

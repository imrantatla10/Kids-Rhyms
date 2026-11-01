"""Shared timeline for "Britain Wants Back Into the EU — Is Brexit Losing Public Support?" (seconds).

Narration = 6 ElevenLabs clips (audio/voice/v1..v6.wav, made by prep_voice.py), placed at VOICE_START.
Event times come from the measured speech segments (segments.json) plus character-weighted estimates
inside the longer phrases.
"""
import json
import os

FPS = 30
W, H = 1080, 1920
DURATION = 64.0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEG = json.load(open(os.path.join(ROOT, "audio", "voice", "segments.json")))

VOICE_START = [0.30, 10.55, 23.40, 34.95, 43.85, 54.35]


def seg(i, k, edge=0):
    """Absolute time of segment k (0-based) of voice clip i (1-based); edge 0=start, 1=end."""
    return VOICE_START[i - 1] + SEG[f"v{i}"]["segments"][k][edge]


def at(i, k, frac):
    """Character-weighted position inside segment k of clip i."""
    a, b = seg(i, k), seg(i, k, 1)
    return a + (b - a) * frac


# scene windows (start, end); neighbouring scenes overlap by XF for crossfades
XF = 0.6
SCENES = {
    "hook":       (0.0, VOICE_START[1] - 0.15),
    "poll":       (VOICE_START[1] - 0.15, VOICE_START[2] - 0.15),
    "generation": (VOICE_START[2] - 0.15, VOICE_START[3] - 0.15),
    "politics":   (VOICE_START[3] - 0.15, VOICE_START[4] - 0.15),
    "referendum": (VOICE_START[4] - 0.15, VOICE_START[5] - 0.15),
    "final":      (VOICE_START[5] - 0.15, DURATION),
}
ORDER = list(SCENES)
TRANSITIONS = [SCENES[n][0] for n in ORDER[1:]]

EV = {
    # 1: "Britain voted to leave Europe. | But now, a growing number of Britons want their country back
    #     inside the European Union. | Is Brexit beginning to lose public support?"
    "leave": seg(1, 0),
    "leave_end": seg(1, 0, 1),
    "but_now": seg(1, 1),
    "back_inside": at(1, 1, 0.62),
    "eu_union": at(1, 1, 0.85),
    "question": seg(1, 2),
    "q_end": seg(1, 2, 1),
    # 2: "A new Ipsos poll found that fifty-six per cent of Britons would vote to apply to rejoin the EU, |
    #     while thirty per cent would vote to stay out. | Among likely voters, support rises to
    #     sixty-three per cent, against thirty-four per cent."
    "poll": seg(2, 0),
    "n56": at(2, 0, 0.30),
    "n30": at(2, 1, 0.14),
    "likely": seg(2, 2),
    "n63": at(2, 2, 0.42),
    "n34": at(2, 2, 0.76),
    # 3: "The generational divide is striking. | Among Britons under thirty-five, seventy-three per cent
    #     support rejoining. | But among people aged fifty-five and over, | only thirty-nine per cent ..."
    "divide": seg(3, 0),
    "young": seg(3, 1),
    "n73": at(3, 1, 0.45),
    "old": seg(3, 2),
    "n39": at(3, 3, 0.10),
    # 4: "Prime Minister Andy Burnham says he would like Britain to rejoin in his lifetime. |
    #     But he has ruled out bringing the country back into the EU during this Parliament."
    "pm": seg(4, 0),
    "lifetime": at(4, 0, 0.80),
    "ruled_out": seg(4, 1),
    "route": at(4, 1, 0.12),
    "parliament": at(4, 1, 0.62),
    "pm_end": seg(4, 1, 1),
    # 5: "And the debate is growing. | Ipsos found that forty-nine per cent support another referendum
    #     before the next general election. | But public support does not mean a return is guaranteed."
    "ballot": seg(5, 0),
    "voters": seg(5, 1),
    "n49": at(5, 1, 0.18),
    "referendum": at(5, 1, 0.52),
    "not_guaranteed": seg(5, 2),
    # 6: "After years of Brexit arguments, | Britain's relationship with Europe is back under the spotlight. |
    #     Is this the beginning of the road back?"
    "years": seg(6, 0),
    "spotlight": at(6, 1, 0.82),
    "road": seg(6, 2),
    "road_back": at(6, 2, 0.80),
    "v_end": seg(6, 2, 1),
}

if __name__ == "__main__":
    for k, v in sorted(EV.items(), key=lambda kv: kv[1]):
        print(f"{v:6.2f}  {k}")
    for i in range(6):
        print(f"v{i + 1}: {VOICE_START[i]:.2f} -> {VOICE_START[i] + SEG[f'v{i + 1}']['dur']:.2f}")
    for n, (a, b) in SCENES.items():
        print(f"{n:11s} {a:6.2f} -> {b:6.2f}")

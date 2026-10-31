"""Shared timeline for "What If France Attacked the UK?" (all times in seconds).

Narration = 7 ElevenLabs clips (audio/voice/v1..v7.wav, made by prep_voice.py).
Phrase boundaries come from the measured speech segments in audio/voice/segments.json;
word times inside a phrase are spread by spoken-length weight.
"""
import json
import os
import re

FPS = 30
W, H = 1080, 1920
DURATION = 63.0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEG = json.load(open(os.path.join(ROOT, "audio", "voice", "segments.json")))

VOICE_START = [0.20, 6.25, 13.70, 24.65, 35.00, 41.95, 53.05]

TEXT = [
    ["What if France suddenly attacked the United Kingdom?",
     "Who would have the military advantage —", "Britain,", "or France?"],
    ["At sea,", "Britain operates two Queen Elizabeth-class aircraft carriers,",
     "while France has one nuclear-powered carrier,", "the Charles de Gaulle."],
    ["France has a powerful navy,", "including nuclear submarines, advanced frigates and amphibious ships.",
     "Britain has nine submarines in its armed forces inventory,", "and a major carrier-based strike capability."],
    ["On land, France has a larger army structure in several areas,", "including more combat vehicles.",
     "Britain, however, brings advanced air power,", "intelligence, and NATO-linked capabilities."],
    ["But here is the biggest danger:", "both countries possess nuclear weapons.",
     "A direct war could escalate beyond control."],
    ["And Europe would pay the price.",
     "Trade, shipping, energy markets and financial confidence could all be hit.",
     "NATO would face an extraordinary crisis,", "because Britain and France are both members."],
    ["So who would win?", "There is no reliable answer.", "The real winner would be nobody —",
     "Europe could lose billions.", "Would you call this a military disaster for Europe?", "Comment below!"],
]

PHRASES = []
for i, phrases in enumerate(TEXT):
    segs = SEG[f"v{i + 1}"]["segments"]
    assert len(segs) == len(phrases), (i, len(segs), len(phrases))
    PHRASES.append([(a, b, p) for (a, b), p in zip(segs, phrases)])

SPOKEN = {"two": 3, "nine": 3, "one": 3, "NATO-linked": 7, "Queen": 4, "Elizabeth-class": 9,
          "nuclear-powered": 9, "carrier-based": 8, "—": 0}

KEYWORDS = {"france", "united", "kingdom", "britain", "military", "advantage", "two", "aircraft",
            "carriers", "one", "nuclear-powered", "gaulle", "navy", "submarines", "nine",
            "frigates", "amphibious", "land", "combat", "vehicles", "air", "power", "intelligence",
            "nato-linked", "danger", "nuclear", "weapons", "escalate", "europe", "price", "trade",
            "shipping", "energy", "financial", "nato", "crisis", "win", "nobody", "billions",
            "disaster", "comment"}


def _norm(w):
    return re.sub(r"[^\w%,'-]", "", w).strip(",").lower()


def _weight(w):
    core = w.strip(".,?!:")
    if core in SPOKEN:
        return SPOKEN[core]
    return len(re.sub(r"[^A-Za-z]", "", core)) * 0.55 + 1.0


def build_words():
    words = []
    for ci, (start, phrases) in enumerate(zip(VOICE_START, PHRASES)):
        for pi, (a, b, text) in enumerate(phrases):
            toks = [t for t in text.split() if t != "—"]
            ws = [_weight(t) for t in toks]
            tot = sum(ws)
            t = start + a
            for tok, wt in zip(toks, ws):
                d = (b - a) * wt / tot
                words.append(dict(t0=t, t1=t + d, text=tok, key=_norm(tok).strip(".?!:") in KEYWORDS,
                                  norm=_norm(tok), clip=ci, phrase=pi))
                t += d
    return words


WORDS = build_words()


def cue(word, clip, nth=0):
    hits = [w for w in WORDS if w["clip"] == clip and w["norm"] == _norm(word)]
    return hits[nth]["t0"]


def phrase_start(clip, idx):
    return VOICE_START[clip] + PHRASES[clip][idx][0]


def build_chunks(max_chars=22, max_words=4):
    chunks, cur = [], []
    for w in WORDS:
        if cur and (cur[-1]["phrase"] != w["phrase"] or cur[-1]["clip"] != w["clip"]
                    or len(" ".join(x["text"] for x in cur + [w])) > max_chars
                    or len(cur) >= max_words):
            chunks.append(cur)
            cur = []
        cur.append(w)
    if cur:
        chunks.append(cur)
    out = []
    for i, c in enumerate(chunks):
        nxt = chunks[i + 1][0]["t0"] if i + 1 < len(chunks) else DURATION
        out.append(dict(t0=c[0]["t0"], t1=min(nxt, c[-1]["t1"] + 0.6), words=c))
    return out


CHUNKS = build_chunks()

SCENES = {
    "hook":     (0.0, 6.1),
    "carriers": (6.1, 13.55),
    "subs":     (13.55, 24.5),
    "land":     (24.5, 34.85),
    "nuclear":  (34.85, 41.8),
    "europe":   (41.8, 52.9),
    "final":    (52.9, 63.0),
}

EV = {
    "uk_carriers": cue("two", 1),
    "fr_carrier": cue("one", 1),
    "cdg": cue("gaulle.", 1),
    "fr_navy": phrase_start(2, 0),
    "fr_subs": cue("submarines,", 2),
    "frigates": cue("frigates", 2),
    "amphib": cue("amphibious", 2),
    "uk_subs": cue("nine", 2),
    "strike": cue("carrier-based", 2),
    "land": cue("land,", 3),
    "vehicles": cue("combat", 3),
    "air": cue("air", 3),
    "intel": cue("intelligence,", 3),
    "natolinked": cue("nato-linked", 3),
    "danger": cue("danger:", 4),
    "nukes": cue("nuclear", 4),
    "escalate": cue("escalate", 4),
    "pay": phrase_start(5, 0),
    "trade": cue("trade,", 5),
    "energy": cue("energy", 5),
    "financial": cue("financial", 5),
    "nato": cue("nato", 5),
    "win": cue("win?", 6),
    "noanswer": phrase_start(6, 1),
    "nobody": cue("nobody", 6),
    "billions": cue("billions.", 6),
    "disaster": phrase_start(6, 4),
    "comment": phrase_start(6, 5),
}
TRANSITIONS = [v[0] for v in SCENES.values() if v[0] > 0]

if __name__ == "__main__":
    for c in CHUNKS:
        print(f"{c['t0']:6.2f}-{c['t1']:6.2f}  " + " ".join(
            (w['text'].upper() if w['key'] else w['text']) for w in c['words']))
    for k, v in EV.items():
        print(f"{k:12s} {v:6.2f}")
    print("voice end", VOICE_START[-1] + SEG["v7"]["dur"])

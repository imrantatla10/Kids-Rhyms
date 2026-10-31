"""Shared timeline for "Which European Country Has the Most Immigrants?" (seconds).

Narration = one ElevenLabs file, processed by prep_voice.py into audio/voice/v1.wav.
Phrase boundaries come from audio/voice/segments.json; word times are spread inside each
phrase by spoken-length weight.
"""
import json
import os
import re

FPS = 30
W, H = 1080, 1920
DURATION = 63.0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEG = json.load(open(os.path.join(ROOT, "audio", "voice", "segments.json")))
VOICE_START = [0.30]

TEXT = [[
    "Which European country has the most immigrants —",
    "and is immigration putting pressure on its economy?",
    "Let's compare six major European countries.",
    "Germany has the largest foreign-born population, at around 17.2 million.",
    "France has 9.6 million,",
    "Spain 9.5 million,",
    "Italy 6.9 million,",
    "the Netherlands 3 million,",
    "and Sweden 2.2 million.",
    "But here's a surprise:",
    "in 2024, Spain received more new immigrants than Germany.",
    "Now look at economic growth.",
    "Between 2021 and 2025,",
    "Germany had the weakest cumulative growth among these six countries.",
    "Inflation also hit European households hard,",
    "especially during the 2022 energy crisis.",
    "But does this prove immigrants caused the economic problems or rising crime?",
    "No.",
    "Migration can increase pressure on housing and public services,",
    "but it can also fill labour shortages and support economic growth.",
    "And crime statistics cannot prove that immigrants are responsible for rising crime.",
    "So the real question is:",
    "can European governments manage immigration while protecting jobs,",
    "housing and public safety?",
    "Which country is handling it best?",
    "Comment below!",
]]

PHRASES = []
for i, phrases in enumerate(TEXT):
    segs = SEG[f"v{i + 1}"]["segments"]
    assert len(segs) == len(phrases), (i, len(segs), len(phrases))
    PHRASES.append([(a, b, p) for (a, b), p in zip(segs, phrases)])

SPOKEN = {"17.2": 8, "9.6": 6, "9.5": 6, "6.9": 6, "2.2": 5, "3": 3, "2024": 7, "2021": 7,
          "2025": 7, "2022": 7, "No": 3, "—": 0}

KEYWORDS = {"immigrants", "immigration", "economy", "six", "germany", "17.2", "france", "9.6",
            "spain", "9.5", "italy", "6.9", "netherlands", "3", "sweden", "2.2", "surprise",
            "2024", "growth", "weakest", "inflation", "2022", "energy", "no", "housing",
            "labour", "shortages", "crime", "cannot", "jobs", "safety", "best", "comment"}


def _norm(w):
    return re.sub(r"[^\w%,.'-]", "", w).strip(",.?!:").lower()


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
                words.append(dict(t0=t, t1=t + d, text=tok, key=_norm(tok) in KEYWORDS,
                                  norm=_norm(tok), clip=ci, phrase=pi))
                t += d
    return words


WORDS = build_words()


def cue(word, nth=0):
    hits = [w for w in WORDS if w["norm"] == _norm(word)]
    return hits[nth]["t0"]


def ph(idx):
    """Absolute start time of phrase idx."""
    return VOICE_START[0] + PHRASES[0][idx][0]


def build_chunks(max_chars=22, max_words=4):
    chunks, cur = [], []
    for w in WORDS:
        if cur and (cur[-1]["phrase"] != w["phrase"]
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
    "hook":     (0.0, ph(2) - 0.15),
    "pop":      (ph(2) - 0.15, ph(9) - 0.1),
    "arrivals": (ph(9) - 0.1, ph(11) + 0.9),
    "economy":  (ph(11) + 0.9, ph(16) - 0.1),
    "balance":  (ph(16) - 0.1, ph(20) - 0.1),
    "crime":    (ph(20) - 0.1, ph(21) + 0.5),
    "final":    (ph(21) + 0.5, DURATION),
}

EV = {
    "pop_title": ph(2),
    "de": cue("germany"),
    "de_num": cue("17.2"),
    "fr": ph(4), "es": ph(5), "it": ph(6), "nl": ph(7), "se": ph(8),
    "surprise": ph(9),
    "es_arr": cue("spain", 1),
    "de_arr": cue("germany", 1),
    "growth": ph(11),
    "weakest": cue("weakest"),
    "inflation": ph(14),
    "crisis2022": cue("2022"),
    "prove": ph(16),
    "no": ph(17),
    "pressure": ph(18),
    "benefit": ph(19),
    "crime": ph(20),
    "cannot": cue("cannot"),
    "question": ph(21),
    "jobs": cue("jobs"),
    "housing": cue("housing", 1),
    "safety": cue("safety"),
    "best": ph(24),
    "comment": ph(25),
}
TRANSITIONS = [v[0] for v in SCENES.values() if v[0] > 0]

if __name__ == "__main__":
    for c in CHUNKS:
        print(f"{c['t0']:6.2f}-{c['t1']:6.2f}  " + " ".join(
            (w['text'].upper() if w['key'] else w['text']) for w in c['words']))
    for k, v in SCENES.items():
        print(f"{k:10s} {v[0]:6.2f} {v[1]:6.2f}")
    for k, v in EV.items():
        print(f"{k:12s} {v:6.2f}")

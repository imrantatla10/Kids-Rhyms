"""Shared timeline for "Brexit: Did Britain Win or Lose?" (all times in seconds).

Narration = 7 ElevenLabs clips (audio/voice/v1..v7.wav, silence-trimmed, atempo 1.10).
Each clip is split into the spoken phrases between its measured pauses
(ffmpeg silencedetect, -40 dB / 0.1 s). Word times inside a phrase are spread by a
spoken-length weight, which gives subtitle + animation cues that land on the words.
"""
import re

FPS = 30
W, H = 1080, 1920
DURATION = 64.0

# clip -> start time in the final mix
VOICE_START = [0.25, 6.75, 8.40, 20.50, 38.90, 48.45, 54.75]

# (clip-relative start, end, text) per spoken phrase
PHRASES = [
    [(0.000, 1.851, "Britain left the European Union."),
     (2.311, 3.472, "But six years later,"),
     (3.943, 6.160, "did Brexit actually make the country richer?")],
    [(0.000, 1.080, "Let's look at the numbers.")],
    [(0.000, 0.508, "First,"),
     (0.811, 1.252, "trade."),
     (1.759, 8.346, "In 2025, British goods exports to the EU were 14% below their 2019 level in real terms."),
     (8.816, 11.545, "But services exports were 28% higher.")],
    [(0.000, 0.403, "Now,"),
     (0.545, 1.306, "immigration."),
     (1.872, 3.407, "EU free movement ended,"),
     (3.698, 5.485, "but immigration did not disappear."),
     (6.030, 10.914, "In 2025, Britain recorded 813,000 long-term arrivals."),
     (11.449, 14.783, "Around 627,000 were non-EU nationals,"),
     (15.113, 17.885, "compared with just 76,000 EU nationals.")],
    [(0.000, 1.014, "What about the economy?"),
     (1.504, 7.213, "Britain's independent budget watchdog estimates Brexit could reduce long-term productivity by 4%,"),
     (7.449, 9.129, "compared with remaining in the EU.")],
    [(0.000, 5.753, "But Britain also gained independent trade powers, and joined the CPTPP trade agreement.")],
    [(0.000, 0.382, "So,"),
     (0.659, 2.029, "Britain gained more control,"),
     (2.197, 3.763, "but faced economic challenges."),
     (4.178, 5.627, "Was Brexit worth the price?"),
     (5.980, 6.653, "You decide."),
     (7.028, 7.431, "WIN"),
     (7.860, 8.488, "or LOSE?")],
]

# spoken-length weights for tokens that are read out much longer than they look
SPOKEN = {"2025": 6, "2019": 5, "14%": 5, "28%": 6, "813,000": 11, "627,000": 11,
          "76,000": 7, "4%": 3, "CPTPP": 6, "EU": 2, "long-term": 5}

# words shown in yellow in the subtitles
KEYWORDS = {"brexit", "richer", "numbers", "trade", "goods", "14%", "services", "28%",
            "immigration", "disappear", "813,000", "627,000", "76,000", "non-eu",
            "economy", "productivity", "4%", "cptpp", "powers", "control",
            "challenges", "price", "win", "lose", "decide", "real", "terms"}


def _norm(w):
    return re.sub(r"[^\w%,'-]", "", w).strip(",").lower()


def _weight(w):
    core = w.strip(".,?!")
    if core in SPOKEN:
        return SPOKEN[core]
    return len(re.sub(r"[^A-Za-z]", "", core)) * 0.55 + 1.0


def build_words():
    words = []   # dicts: t0, t1, text, key, clip, phrase
    for ci, (start, phrases) in enumerate(zip(VOICE_START, PHRASES)):
        for pi, (a, b, text) in enumerate(phrases):
            toks = text.split()
            ws = [_weight(t) for t in toks]
            tot = sum(ws)
            t = start + a
            span = b - a
            for tok, wt in zip(toks, ws):
                d = span * wt / tot
                words.append(dict(t0=t, t1=t + d, text=tok, key=_norm(tok) in KEYWORDS,
                                  norm=_norm(tok), clip=ci, phrase=pi))
                t += d
    return words


WORDS = build_words()


def cue(word, clip, nth=0):
    """Start time of the nth occurrence of `word` (normalised) in narration clip `clip`."""
    hits = [w for w in WORDS if w["clip"] == clip and w["norm"] == _norm(word)]
    return hits[nth]["t0"]


def build_chunks(max_chars=22, max_words=4):
    """Group words into subtitle lines; never cross a phrase boundary."""
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
        t0 = c[0]["t0"]
        nxt = chunks[i + 1][0]["t0"] if i + 1 < len(chunks) else DURATION
        t1 = min(nxt, c[-1]["t1"] + 0.6)
        out.append(dict(t0=t0, t1=t1, words=c))
    return out


CHUNKS = build_chunks()

# ---------------------------------------------------------------- scenes
SCENES = {
    "hook":     (0.0, 3.6),
    "timeline": (3.6, 8.2),
    "trade":    (8.2, 20.3),
    "migr":     (20.3, 38.75),
    "economy":  (38.75, 48.35),
    "deals":    (48.35, 55.0),
    "final":    (55.0, 64.0),
}

# key animation cues (absolute seconds)
EV = {
    "date1": 4.15,
    "date2": 5.9,
    "goods_pct": cue("14%", 2),
    "serv_pct": cue("28%", 2),
    "fm_ended": cue("free", 3),
    "disappear": cue("disappear.", 3),
    "total": cue("813,000", 3),
    "noneu": cue("627,000", 3),
    "eu": cue("76,000", 3),
    "watchdog": cue("watchdog", 4),
    "prod": cue("productivity", 4),
    "four": cue("4%", 4),
    "powers": cue("powers,", 5),
    "cptpp": cue("cptpp", 5),
    "control": cue("control,", 6),
    "challenges": cue("challenges.", 6),
    "price": cue("price?", 6),
    "decide": cue("decide.", 6),
    "win": cue("win", 6),
    "lose": cue("lose?", 6),
}
EV["british"] = EV["eu"] + 0.6
EV["gdp2bn"] = EV["cptpp"] - 0.45

# transition times (for whoosh SFX)
TRANSITIONS = [v[0] for k, v in SCENES.items() if v[0] > 0]

if __name__ == "__main__":
    for c in CHUNKS:
        print(f"{c['t0']:6.2f}-{c['t1']:6.2f}  " + " ".join(
            (w['text'].upper() if w['key'] else w['text']) for w in c['words']))
    for k, v in EV.items():
        print(f"{k:12s} {v:6.2f}")

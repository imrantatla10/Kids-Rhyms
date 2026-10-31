"""Shared timeline for "The Magic Animal Train" video (all times in seconds)."""

FPS = 30
W, H = 1080, 1920
DURATION = 64.0
BPM = 120
BEAT = 60.0 / BPM

# Where each trimmed narration clip (audio/voice/t1..t7.wav) starts in the final mix.
VOICE_START = [0.5, 10.3, 20.4, 30.3, 39.9, 48.7, 58.9]

# Scene boundaries
SCENES = {
    "intro":   (0.0, 10.0),    # Tilly arrives at the magic station
    "A":       (10.0, 20.2),   # Alligator
    "B":       (20.2, 30.1),   # Benny Bear
    "CD":      (30.1, 39.7),   # Cat + dancing Dog
    "EF":      (39.7, 48.5),   # Ellie Elephant + Freddie Fox
    "rainbow": (48.5, 58.8),   # All dance through the rainbow tunnel
    "outro":   (58.8, 64.0),   # Recap + bye bye
}


def v(clip, offset):
    """Absolute time of a moment `offset` seconds into narration clip `clip` (1-based)."""
    return VOICE_START[clip - 1] + offset


# Key moments derived from pauses in the narration clips
EVENTS = {
    "title_in":      0.3,
    "tilly_hello":   v(1, 1.3),
    "welcome":       v(1, 4.2),
    "abc_line":      v(1, 7.2),

    "gator_appear":  v(2, 2.9),
    "letter_A":      v(2, 5.7),
    "gator_board":   v(2, 8.0),

    "bear_appear":   v(3, 0.0),
    "bear_jump":     v(3, 1.65),
    "letter_B":      v(3, 5.05),

    "cat_appear":    v(4, 0.0),
    "letter_C":      v(4, 2.35),
    "dog_appear":    v(4, 4.2),
    "letter_D":      v(4, 7.25),
    "catdog_board":  v(4, 8.5),

    "ele_appear":    v(5, 1.1),
    "letter_E":      v(5, 2.85),
    "fox_appear":    v(5, 4.7),
    "letter_F":      v(5, 6.85),
    "elefox_board":  v(5, 8.0),

    "lyric1":        v(6, 0.0),
    "lyric2":        v(6, 2.5),
    "lyric3":        v(6, 5.0),
    "lyric4":        v(6, 7.75),

    "recap":         v(7, 0.0),
    "great_job":     v(7, 2.34),
    "bye":           v(7, 3.95),
}

WHISTLES = [0.05, 10.0, 48.4, 62.9]
BOINGS = [EVENTS["gator_board"], EVENTS["bear_jump"], EVENTS["catdog_board"],
          EVENTS["catdog_board"] + 0.35, EVENTS["elefox_board"], EVENTS["elefox_board"] + 0.35]
SPARKLES = [EVENTS[k] for k in ("letter_A", "letter_B", "letter_C", "letter_D",
                                "letter_E", "letter_F")]

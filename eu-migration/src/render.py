"""Render "Which European Country Has the Most Immigrants?" — 1080x1920, 30 fps, 63 s.

Flat 2D only. All maps, flags, icons, charts and animations are drawn with cairo and
piped to ffmpeg with audio/final_mix.wav.

Data:
  data/stats.json           foreign-born residents (1 Jan 2025) and 2024 arrivals (Eurostat, as briefed)
  data/eurostat_econ.json   OPTIONAL: Eurostat real GDP growth (tec00115) + HICP annual rates
                            (prc_hicp_aind), 2021-2025. If absent, the economy graphics show a
                            "data pending" card — no values are invented.

    python3 render.py                   # full render -> output/*.mp4
    python3 render.py --stills 3,10,20  # PNG previews into output/stills/
"""
import argparse
import json
import math
import os
import subprocess
from multiprocessing import Pool

import cairo

import geo
import gfx
from gfx import (BLUE, BLUE_L, F_BLACK, F_MED, F_SB, F_XB, GREEN, LAND, MUTED, NAVY, ORANGE, RED, TAU,
                 WHITE, YELLOW, arrow_head, blit, clamp, e_back, e_inout, e_out, hexc, lerp, make_layer,
                 map_path, pill, prog, rrect, src, text, text_w, wa)
from timeline import DURATION, EV, FPS, H, SCENES, W

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "output")
AUDIO = os.path.join(ROOT, "audio", "final_mix.wav")
OUT_FILE = os.path.join(OUT_DIR, "Europe_Most_Immigrants_vertical.mp4")

gfx.BRAND = "EUROPE  ·  IMMIGRATION & THE ECONOMY  2021–2025"

STATS = json.load(open(os.path.join(ROOT, "data", "stats.json")))
_econ_path = os.environ.get("ECON_JSON", os.path.join(ROOT, "data", "eurostat_econ.json"))
ECON = json.load(open(_econ_path)) if os.path.exists(_econ_path) else None

CODES = ["DE", "FR", "ES", "IT", "NL", "SE"]
NAMES = {"DE": "GERMANY", "FR": "FRANCE", "ES": "SPAIN", "IT": "ITALY", "NL": "NETHERLANDS", "SE": "SWEDEN"}
NE = {"DE": "Germany", "FR": "France", "ES": "Spain", "IT": "Italy", "NL": "Netherlands", "SE": "Sweden"}
LABEL_LL = {"DE": (10.4, 51.2), "FR": (2.4, 46.6), "ES": (-3.7, 40.0), "IT": (12.4, 42.6),
            "NL": (5.6, 52.3), "SE": (15.3, 62.5)}
HL = hexc("#3B82F6")        # highlight for the six countries
HL_D = hexc("#1D4ED8")
TEAL = hexc("#14B8A6")
INK = hexc("#0B1733")
SERIES = {"DE": hexc("#F97316"), "FR": hexc("#60A5FA"), "ES": hexc("#FACC15"), "IT": hexc("#34D399"),
          "NL": hexc("#F472B6"), "SE": hexc("#A78BFA")}


# ================================================================= flags
def flag(ctx, code, x, y, w, h, alpha=1.0):
    ctx.save()
    ctx.push_group()
    rrect(ctx, x, y, w, h, min(6, h * 0.12))
    ctx.clip()
    def hs(cols, weights=None):
        weights = weights or [1] * len(cols)
        tot = sum(weights)
        yy = y
        for c, wt in zip(cols, weights):
            src(ctx, hexc(c))
            ctx.rectangle(x, yy, w, h * wt / tot + 0.5)
            ctx.fill()
            yy += h * wt / tot
    def vs(cols):
        for i, c in enumerate(cols):
            src(ctx, hexc(c))
            ctx.rectangle(x + i * w / len(cols), y, w / len(cols) + 0.5, h)
            ctx.fill()
    if code == "DE":
        hs(["#000000", "#DD0000", "#FFCE00"])
    elif code == "FR":
        vs(["#0055A4", "#FFFFFF", "#EF4135"])
    elif code == "IT":
        vs(["#009246", "#FFFFFF", "#CE2B37"])
    elif code == "NL":
        hs(["#AE1C28", "#FFFFFF", "#21468B"])
    elif code == "ES":
        hs(["#AA151B", "#F1BF00", "#AA151B"], [1, 2, 1])
    elif code == "SE":
        src(ctx, hexc("#006AA7"))
        ctx.rectangle(x, y, w, h)
        ctx.fill()
        src(ctx, hexc("#FECC02"))
        ctx.rectangle(x + w * 5 / 16, y, w * 2 / 16, h)
        ctx.rectangle(x, y + h * 4 / 10, w, h * 2 / 10)
        ctx.fill()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()
    rrect(ctx, x, y, w, h, min(6, h * 0.12))
    src(ctx, WHITE, 0.85 * alpha)
    ctx.set_line_width(2)
    ctx.stroke()


def flag_tag(ctx, code, cx, cy, s=1.0, alpha=1.0, name=True):
    """Flag + country name pill centred at (cx, cy)."""
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(s, s)
    fw, fh = 54, 36
    if name:
        tw = text_w(ctx, NAMES[code], F_BLACK, 24)
        total = fw + 10 + tw + 28
        rrect(ctx, -total / 2, -26, total, 52, 26)
        src(ctx, INK, 0.92 * alpha)
        ctx.fill()
        flag(ctx, code, -total / 2 + 10, -fh / 2, fw, fh, alpha)
        text(ctx, NAMES[code], -total / 2 + 10 + fw + 10, 0, 24, F_BLACK, WHITE, "l", alpha)
    else:
        flag(ctx, code, -fw / 2, -fh / 2, fw, fh, alpha)
    ctx.restore()


# ================================================================= maps
P_EU = geo.Proj(-11.0, 30.0, 35.5, 69.5, 160, 440, 760, coslat=52)
P_SD = geo.Proj(-10.5, 16.5, 35.5, 56.5, 60, 330, 960, coslat=46)   # Spain + Germany zoom


def europe_layer(proj, key, clip_y=(270, 1480), six=True, dim=False):
    def paint(c):
        world = geo.load("50m")
        c.rectangle(0, clip_y[0], W, clip_y[1] - clip_y[0])
        c.clip()
        for name, rings in world.items():
            map_path(c, rings, proj)
            if six and name in NE.values():
                src(c, HL_D if dim else HL)
            else:
                src(c, LAND)
            c.fill_preserve()
            src(c, NAVY, 0.9)
            c.set_line_width(1.3)
            c.stroke()
    return make_layer(key, paint)


def country_outline(ctx, proj, name, color, width=4, alpha=1.0):
    map_path(ctx, geo.load("50m")[name], proj)
    src(ctx, color, alpha)
    ctx.set_line_width(width)
    ctx.stroke()


def country_fill(ctx, proj, name, color, alpha=1.0):
    map_path(ctx, geo.load("50m")[name], proj)
    src(ctx, color, alpha)
    ctx.fill()


# ================================================================= icons
def building(ctx, x, y, s, color):
    src(ctx, color)
    ctx.rectangle(x - 0.7 * s, y - 2.0 * s, 1.4 * s, 2.0 * s)
    ctx.fill()
    src(ctx, YELLOW, 0.8)
    for r in range(4):
        for c in range(3):
            ctx.rectangle(x - 0.55 * s + c * 0.42 * s, y - 1.85 * s + r * 0.45 * s, 0.26 * s, 0.28 * s)
    ctx.fill()


def hospital(ctx, x, y, s, color):
    src(ctx, color)
    ctx.rectangle(x - s, y - 1.3 * s, 2 * s, 1.3 * s)
    ctx.fill()
    ctx.move_to(x - 1.15 * s, y - 1.3 * s)
    ctx.line_to(x, y - 1.95 * s)
    ctx.line_to(x + 1.15 * s, y - 1.3 * s)
    ctx.close_path()
    ctx.fill()
    src(ctx, WHITE)
    ctx.rectangle(x - 0.12 * s, y - 1.05 * s, 0.24 * s, 0.75 * s)
    ctx.rectangle(x - 0.37 * s, y - 0.8 * s, 0.74 * s, 0.24 * s)
    ctx.fill()


def school(ctx, x, y, s, color):
    src(ctx, color)
    ctx.rectangle(x - s, y - s, 2 * s, s)
    ctx.fill()
    ctx.move_to(x - 1.1 * s, y - s)
    ctx.line_to(x, y - 1.6 * s)
    ctx.line_to(x + 1.1 * s, y - s)
    ctx.close_path()
    ctx.fill()
    src(ctx, NAVY)
    ctx.rectangle(x - 0.2 * s, y - 0.6 * s, 0.4 * s, 0.6 * s)
    ctx.fill()
    ctx.arc(x, y - 1.25 * s, 0.17 * s, 0, TAU)
    src(ctx, WHITE)
    ctx.fill()


def bridge(ctx, x, y, s, color):
    src(ctx, color)
    ctx.set_line_width(0.22 * s)
    ctx.move_to(x - 1.2 * s, y - 0.5 * s)
    ctx.line_to(x + 1.2 * s, y - 0.5 * s)
    ctx.stroke()
    ctx.set_line_width(0.14 * s)
    ctx.arc_negative(x, y + 0.6 * s, 1.1 * s, -0.25, -math.pi + 0.25)
    ctx.stroke()
    for k in (-0.6, 0, 0.6):
        ctx.move_to(x + k * s, y - 0.5 * s)
        ctx.line_to(x + k * s, y - 0.5 * s + 0.6 * s * (1 - abs(k)))
    ctx.stroke()


def worker(ctx, x, y, s, color):
    """Neutral worker icon with a hard hat (no ethnicity cues)."""
    src(ctx, WHITE)
    ctx.arc(x, y - 1.55 * s, 0.38 * s, 0, TAU)
    ctx.fill()
    src(ctx, color)
    ctx.arc(x, y - 1.65 * s, 0.45 * s, math.pi, TAU)
    ctx.fill()
    ctx.rectangle(x - 0.55 * s, y - 1.68 * s, 1.1 * s, 0.1 * s)
    ctx.fill()
    rrect(ctx, x - 0.6 * s, y - 1.1 * s, 1.2 * s, 1.1 * s, 0.4 * s)
    ctx.fill()


def coins(ctx, x, y, s, color):
    for k in range(3):
        rrect(ctx, x - 0.7 * s, y - 0.35 * s - k * 0.35 * s, 1.4 * s, 0.3 * s, 0.15 * s)
        src(ctx, color)
        ctx.fill()
    text(ctx, "€", x + 0.5 * s, y - 1.35 * s, 0.9 * s, F_BLACK, WHITE)


def shop(ctx, x, y, s, color):
    src(ctx, color)
    ctx.rectangle(x - s, y - 1.2 * s, 2 * s, 1.2 * s)
    ctx.fill()
    for k in range(5):
        src(ctx, WHITE if k % 2 == 0 else color)
        ctx.rectangle(x - s + k * 0.4 * s, y - 1.5 * s, 0.4 * s, 0.32 * s)
    ctx.fill()
    src(ctx, NAVY)
    ctx.rectangle(x - 0.25 * s, y - 0.7 * s, 0.5 * s, 0.7 * s)
    ctx.fill()


def factory(ctx, x, y, s, color):
    src(ctx, color)
    ctx.move_to(x - 1.1 * s, y)
    ctx.line_to(x - 1.1 * s, y - 0.9 * s)
    for k in range(3):
        ctx.line_to(x - 1.1 * s + (k + 0.6) * 0.66 * s, y - 1.3 * s)
        ctx.line_to(x - 1.1 * s + (k + 1) * 0.66 * s, y - 0.9 * s)
    ctx.line_to(x + 1.1 * s, y)
    ctx.close_path()
    ctx.fill()
    ctx.rectangle(x + 0.55 * s, y - 1.9 * s, 0.3 * s, 1.0 * s)
    ctx.fill()


def police_badge(ctx, x, y, s):
    ctx.save()
    ctx.translate(x, y)
    src(ctx, HL_D)
    ctx.move_to(0, -1.2 * s)
    ctx.curve_to(0.7 * s, -1.0 * s, 1.0 * s, -0.9 * s, 1.0 * s, -0.9 * s)
    ctx.line_to(1.0 * s, 0)
    ctx.curve_to(1.0 * s, 0.7 * s, 0.4 * s, 1.0 * s, 0, 1.25 * s)
    ctx.curve_to(-0.4 * s, 1.0 * s, -1.0 * s, 0.7 * s, -1.0 * s, 0)
    ctx.line_to(-1.0 * s, -0.9 * s)
    ctx.curve_to(-1.0 * s, -0.9 * s, -0.7 * s, -1.0 * s, 0, -1.2 * s)
    ctx.fill_preserve()
    src(ctx, WHITE)
    ctx.set_line_width(0.08 * s)
    ctx.stroke()
    gfx.star(ctx, 0, 0.0, 0.55 * s)
    src(ctx, YELLOW)
    ctx.fill()
    ctx.restore()


# ================================================================= scene 1: hook
def scene_hook(ctx, lt, t):
    z = 1.0 + 0.25 * (1 - e_out(prog(lt, 0, 1.2)))
    ctx.save()
    ctx.translate(W / 2, 950)
    ctx.scale(z, z)
    ctx.translate(-W / 2, -950)
    blit(ctx, europe_layer(P_EU, "eu_six"), e_out(prog(lt, 0, 0.4)))
    for i, c in enumerate(CODES):
        u = prog(lt, 0.9 + i * 0.28, 1.25 + i * 0.28)
        if u > 0:
            x, y = P_EU(*LABEL_LL[c])
            flag_tag(ctx, c, x, y, s=e_back(u, 2.2) * 0.95)
    ctx.restore()
    u = e_back(prog(lt, 0.1, 0.5))
    ctx.save()
    ctx.translate(W / 2, 300)
    ctx.scale(u, u)
    text(ctx, "EUROPE'S IMMIGRATION RACE", 0, 0, 62, F_BLACK, WHITE, shadow=True)
    ctx.restore()
    u2 = e_back(prog(lt, 0.45, 0.85))
    if u2 > 0:
        ctx.save()
        ctx.translate(W / 2, 395)
        ctx.scale(u2, u2)
        pill(ctx, "WHO HAS THE MOST?", 0, 0, 52, ORANGE, WHITE)
        ctx.restore()


# ================================================================= scene 2: foreign-born population
def scene_pop(ctx, lt, t):
    pop = STATS["foreign_born_2025_m"]
    ta = e_out(prog(lt, 0.0, 0.4))
    text(ctx, "FOREIGN-BORN RESIDENTS", W / 2, 300, 60, F_BLACK, WHITE, alpha=ta)
    pill(ctx, "1 JANUARY 2025", W / 2, 375, 30, HL_D, WHITE, alpha=ta)
    x0, xmax = 60, 1020
    vmax = 18.0
    for i, c in enumerate(CODES):
        y = 470 + i * 135
        key = c.lower()
        ra = e_out(prog(lt, 0.2 + i * 0.08, 0.6 + i * 0.08))
        flag(ctx, c, x0, y - 22, 54, 36, ra)
        text(ctx, NAMES[c], x0 + 68, y - 4, 32, F_BLACK, WHITE, "l", ra)
        rrect(ctx, x0, y + 30, xmax - x0, 54, 14)
        src(ctx, WHITE, 0.07 * ra)
        ctx.fill()
        g = e_out(prog(t, EV[key], EV[key] + 0.8))
        if g > 0:
            v = pop[c]
            w = max(28, (xmax - x0) * v / vmax * g)
            rrect(ctx, x0, y + 30, w, 54, 14)
            src(ctx, ORANGE if c == "DE" else hexc("#E2E8F0"))
            ctx.fill()
            lab = f"{v * g:.1f}M" if g < 1 else f"{v:.1f} MILLION"
            if w > 380:
                text(ctx, lab, x0 + w - 18, y + 57, 34, F_BLACK, NAVY if c != "DE" else WHITE, "r")
            else:
                text(ctx, lab, x0 + w + 16, y + 57, 34, F_BLACK, WHITE, "l")
    # Germany pop-out
    u = prog(t, EV["de_num"], EV["de_num"] + 0.35)
    if u > 0:
        s = e_back(u, 2.2) * (1 + 0.03 * math.sin(t * 6))
        ctx.save()
        ctx.translate(800, 470 - 6)
        ctx.rotate(-0.06)
        ctx.scale(s, s)
        pill(ctx, "LARGEST: 17.2M", 0, 0, 34, RED, WHITE)
        ctx.restore()
    na = e_out(prog(lt, 1.5, 2.0))
    text(ctx, "Foreign-born population includes people born in another country,", W / 2, 1290, 23, F_SB,
         MUTED, alpha=na)
    text(ctx, "including people who may later become citizens.", W / 2, 1322, 23, F_SB, MUTED, alpha=na)
    gfx.source_label(ctx, "Source: Eurostat — population by country of birth, 1 January 2025", na, y=1380)


# ================================================================= scene 3: arrivals
def scene_arrivals(ctx, lt, t):
    blit(ctx, europe_layer(P_SD, "sd", clip_y=(270, 1290), six=False), e_out(prog(lt, 0, 0.3)))
    hi = e_out(prog(lt, 0.1, 0.5))
    country_fill(ctx, P_SD, "Spain", ORANGE, hi)
    country_fill(ctx, P_SD, "Germany", HL, hi)
    country_outline(ctx, P_SD, "Spain", WHITE, 3, hi)
    country_outline(ctx, P_SD, "Germany", WHITE, 3, hi)
    ta = e_out(prog(lt, 0, 0.35))
    rrect(ctx, 60, 280, 960, 110, 24)
    src(ctx, INK, 0.9 * ta)
    ctx.fill()
    text(ctx, "NEW IMMIGRANTS ARRIVING", W / 2, 312, 46, F_BLACK, WHITE, alpha=ta)
    text(ctx, "IN 2024", W / 2, 362, 40, F_BLACK, YELLOW, alpha=ta)
    arr = STATS["arrivals_2024_m"]
    for key, c, cx, cy, delay in (("es_arr", "ES", 280, 790, 0.0), ("es_arr", "DE", 800, 900, 0.9)):
        u = prog(t, EV[key] + delay - 0.2, EV[key] + delay + 0.2)
        if u <= 0:
            continue
        s = e_back(u)
        col = ORANGE if c == "ES" else HL
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(s, s)
        rrect(ctx, -220, -120, 440, 240, 26)
        src(ctx, INK, 0.95)
        ctx.fill_preserve()
        src(ctx, col)
        ctx.set_line_width(5)
        ctx.stroke()
        flag(ctx, c, -190, -95, 60, 40)
        text(ctx, NAMES[c], -116, -75, 34, F_BLACK, WHITE, "l")
        text(ctx, f"{arr[c]:.3f}", 0, 5, 84, F_BLACK, col)
        text(ctx, "MILLION", 0, 75, 32, F_BLACK, WHITE)
        ctx.restore()
    # arrow pointing to Spain
    au = e_out(prog(t, EV["es_arr"] + 0.1, EV["es_arr"] + 0.6))
    if au > 0:
        sx, sy = P_SD(-3.7, 40.2)
        bob = math.sin(t * 6) * 8
        x1, y1 = sx, sy - 40 + bob
        ctx.move_to(x1, 930)
        ctx.line_to(x1, lerp(930, y1, au))
        src(ctx, YELLOW)
        ctx.set_line_width(12)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()
        arrow_head(ctx, x1, lerp(930, y1 + 8, au), math.pi / 2, 30, YELLOW)
    na = e_out(prog(lt, 1.0, 1.4))
    rrect(ctx, 200, 1305, 680, 92, 20)
    src(ctx, hexc("#050B1A"), 0.75 * na)
    ctx.fill()
    text(ctx, "Annual immigration arrivals in 2024 —", W / 2, 1335, 24, F_SB, MUTED, alpha=na)
    text(ctx, "not the total immigrant population.", W / 2, 1367, 24, F_SB, MUTED, alpha=na)
    gfx.source_label(ctx, "Source: Eurostat — immigration, 2024", na, y=1420)


# ================================================================= scene 4: economy
def compounded(rates):
    v = 1.0
    for r in rates:
        v *= 1 + r / 100.0
    return (v - 1) * 100


def pending_card(ctx, title, alpha):
    rrect(ctx, 80, 560, 920, 520, 30)
    src(ctx, INK, 0.92 * alpha)
    ctx.fill_preserve()
    src(ctx, YELLOW, alpha)
    ctx.set_dash([18, 12])
    ctx.set_line_width(4)
    ctx.stroke()
    ctx.set_dash([])
    text(ctx, "EUROSTAT DATA PENDING", W / 2, 760, 52, F_BLACK, YELLOW, alpha=alpha)
    text(ctx, title, W / 2, 840, 30, F_XB, WHITE, alpha=alpha)
    text(ctx, "Official series not yet loaded — no values shown", W / 2, 900, 26, F_SB, MUTED, alpha=alpha)


def scene_economy(ctx, lt, t):
    split = EV["inflation"] - 0.15
    a_alpha = 1 - e_inout(prog(t, split - 0.2, split + 0.2))
    b_alpha = e_inout(prog(t, split - 0.2, split + 0.2))
    if a_alpha > 0:
        ctx.push_group()
        graphic_gdp(ctx, lt, t)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a_alpha)
    if b_alpha > 0:
        ctx.push_group()
        graphic_hicp(ctx, t - split, t)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(b_alpha)


def graphic_gdp(ctx, lt, t):
    ta = e_out(prog(lt, 0, 0.35))
    text(ctx, "REAL GDP GROWTH", W / 2, 300, 62, F_BLACK, WHITE, alpha=ta)
    pill(ctx, "2021 TO 2025 · CUMULATIVE", W / 2, 375, 28, HL_D, WHITE, alpha=ta)
    if not ECON:
        pending_card(ctx, "Real GDP growth, 2021–2025 (tec00115)", ta)
        return
    gdp = ECON["gdp_growth"]
    cum = {c: compounded([gdp[c][y] for y in ("2021", "2022", "2023", "2024", "2025")]) for c in CODES}
    order = sorted(CODES, key=lambda c: -cum[c])
    vmax = max(cum.values()) * 1.15
    x0, xmax = 60, 1020
    for i, c in enumerate(order):
        y = 470 + i * 120
        g = e_out(prog(lt, 0.6 + i * 0.12, 1.4 + i * 0.12))
        flag(ctx, c, x0, y - 20, 50, 33, ta)
        text(ctx, NAMES[c], x0 + 62, y - 4, 28, F_BLACK, WHITE, "l", ta)
        w = max(20, (xmax - x0) * cum[c] / vmax * g)
        rrect(ctx, x0, y + 26, w, 48, 12)
        src(ctx, ORANGE if c == "DE" else hexc("#E2E8F0"))
        ctx.fill()
        if g > 0:
            text(ctx, f"+{cum[c] * g:.1f}%", x0 + w + 14, y + 50, 32, F_BLACK, WHITE, "l")
    wu = prog(t, EV["weakest"], EV["weakest"] + 0.35)
    if wu > 0:
        s = e_back(wu)
        ctx.save()
        ctx.translate(W / 2, 1225)
        ctx.scale(s, s)
        pill(ctx, f"GERMANY: APPROX. {cum['DE']:.1f}% CUMULATIVE, 2021–2025", 0, 0, 30, RED, WHITE)
        ctx.restore()
    text(ctx, "Annual real GDP growth rates compounded; 2024–25 figures may be provisional.", W / 2,
         1290, 21, F_SB, MUTED, alpha=ta)
    gfx.source_label(ctx, "Source: Eurostat — real GDP growth rate, volume (tec00115), " + ECON.get("vintage", ""),
                     ta, y=1340)


def graphic_hicp(ctx, lt, t):
    ta = e_out(prog(lt, 0, 0.35))
    text(ctx, "THE EUROPEAN", W / 2, 285, 52, F_BLACK, WHITE, alpha=ta)
    text(ctx, "COST-OF-LIVING SHOCK", W / 2, 345, 52, F_BLACK, ORANGE, alpha=ta)
    if not ECON:
        pending_card(ctx, "HICP annual inflation, 2021–2025 (prc_hicp_aind)", ta)
        return
    hicp = ECON["hicp_rate"]
    years = ["2021", "2022", "2023", "2024", "2025"]
    # (1) annual inflation rate lines
    px0, px1, py0, py1 = 150, 1000, 430, 800
    vmax = max(max(hicp[c][y] for y in years) for c in CODES)
    vmax = math.ceil(vmax / 5) * 5
    vmin = min(0, min(min(hicp[c][y] for y in years) for c in CODES))
    def P(i, v):
        return px0 + (px1 - px0) * i / 4, py1 - (py1 - py0) * (v - vmin) / (vmax - vmin)
    # 2022 surge band
    bx = P(1, 0)[0]
    rrect(ctx, bx - 70, py0 - 10, 140, py1 - py0 + 20, 16)
    src(ctx, RED, 0.18 * ta * (0.7 + 0.3 * math.sin(t * 5)))
    ctx.fill()
    text(ctx, "2022 SURGE", bx, py0 - 26, 22, F_BLACK, RED, alpha=ta)
    src(ctx, WHITE, 0.15 * ta)
    for v in range(int(vmin), int(vmax) + 1, 5):
        ctx.rectangle(px0, P(0, v)[1], px1 - px0, 2)
    ctx.fill()
    for v in range(int(vmin), int(vmax) + 1, 5):
        text(ctx, f"{v}%", px0 - 14, P(0, v)[1], 20, F_SB, MUTED, "r", ta)
    for i, y in enumerate(years):
        text(ctx, y, P(i, 0)[0], py1 + 26, 22, F_XB, MUTED, "c", ta)
    draw = e_inout(prog(lt, 0.3, 1.8))
    for c in CODES:
        pts = [P(i, hicp[c][y]) for i, y in enumerate(years)]
        segs = draw * 4
        ctx.move_to(*pts[0])
        for i in range(1, 5):
            if segs >= i:
                ctx.line_to(*pts[i])
            elif segs > i - 1:
                f = segs - (i - 1)
                ctx.line_to(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f))
                break
        src(ctx, SERIES[c], ta)
        ctx.set_line_width(7 if c == "DE" else 5)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.stroke()
    text(ctx, "ANNUAL INFLATION RATE (HICP, %)", px0, 870 - 14, 22, F_BLACK, WHITE, "l", ta)
    # legend
    for i, c in enumerate(CODES):
        x = 70 + (i % 3) * 330
        y = 905 + (i // 3) * 46
        rrect(ctx, x, y - 8, 30, 16, 6)
        src(ctx, SERIES[c], ta)
        ctx.fill()
        flag(ctx, c, x + 40, y - 13, 36, 24, ta)
        text(ctx, NAMES[c], x + 86, y, 22, F_XB, WHITE, "l", ta)
    # (2) price level index, 2021 = 100 -> 2025
    iu = e_out(prog(lt, 1.6, 2.3))
    text(ctx, "PRICE LEVEL IN 2025 (2021 = 100)", W / 2, 1020, 26, F_BLACK, YELLOW, alpha=iu)
    idx = {}
    for c in CODES:
        v = 100.0
        for y in years[1:]:
            v *= 1 + hicp[c][y] / 100
        idx[c] = v
    for i, c in enumerate(CODES):
        cx = 120 + i * 168
        hgt = (idx[c] - 100) * 6 * iu
        rrect(ctx, cx - 50, 1230 - hgt, 100, hgt + 2, 10)
        src(ctx, SERIES[c], iu)
        ctx.fill()
        text(ctx, f"{idx[c]:.0f}", cx, 1230 - hgt - 22, 26, F_BLACK, WHITE, alpha=iu)
        flag(ctx, c, cx - 18, 1244, 36, 24, iu)
    text(ctx, "Inflation rate ≠ total price increase: the index compounds 2022–2025 rates.", W / 2, 1300, 21,
         F_SB, MUTED, alpha=iu)
    gfx.source_label(ctx, "Source: Eurostat — HICP annual average rate of change (prc_hicp_aind), "
                     + ECON.get("vintage", ""), ta, y=1345)


# ================================================================= scene 5: pressures vs benefits
def scene_balance(ctx, lt, t):
    qa = e_out(prog(lt, 0, 0.35))
    q_out = 1 - e_inout(prog(t, EV["pressure"] - 0.3, EV["pressure"]))
    if q_out > 0:
        text(ctx, "DID IMMIGRANTS CAUSE", W / 2, 520, 62, F_BLACK, WHITE, alpha=qa * q_out)
        text(ctx, "THE ECONOMIC PROBLEMS?", W / 2, 600, 62, F_BLACK, WHITE, alpha=qa * q_out)
        nu = prog(t, EV["no"], EV["no"] + 0.25)
        if nu > 0:
            s = lerp(1.6, 1.0, e_out(nu))
            ctx.save()
            ctx.translate(W / 2, 820)
            ctx.rotate(-0.06)
            ctx.scale(s, s)
            rrect(ctx, -380, -80, 760, 160, 22)
            src(ctx, YELLOW, nu * q_out)
            ctx.set_line_width(9)
            ctx.stroke()
            text(ctx, "NO SIMPLE CAUSE", 0, 0, 70, F_BLACK, YELLOW, alpha=nu * q_out)
            ctx.restore()
    pa = e_inout(prog(t, EV["pressure"] - 0.3, EV["pressure"] + 0.1))
    if pa <= 0:
        return
    sides = [(30, "POTENTIAL", "PRESSURES", ORANGE, "pressure",
              [(building, "Housing demand"), (hospital, "Public services"),
               (school, "School & healthcare capacity"), (bridge, "Local infrastructure")]),
             (552, "POTENTIAL", "BENEFITS", TEAL, "benefit",
              [(worker, "Workers in shortage sectors"), (coins, "Tax contributions"),
               (shop, "Business creation"), (factory, "Skills & economic activity")])]
    for x0, l1, l2, col, key, items in sides:
        rrect(ctx, x0, 280, 498, 1060, 26)
        src(ctx, col, 0.10 * pa)
        ctx.fill_preserve()
        src(ctx, col, 0.85 * pa)
        ctx.set_line_width(3)
        ctx.stroke()
        rrect(ctx, x0, 280, 498, 130, 26)
        src(ctx, col, pa)
        ctx.fill()
        text(ctx, l1, x0 + 249, 322, 32, F_BLACK, WHITE, alpha=pa)
        text(ctx, l2, x0 + 249, 368, 40, F_BLACK, WHITE, alpha=pa)
        for i, (icon, lab) in enumerate(items):
            u = prog(t, EV[key] + 0.25 + i * 0.35, EV[key] + 0.6 + i * 0.35)
            if u <= 0:
                continue
            a = e_out(u)
            cy = 520 + i * 205
            ctx.save()
            ctx.translate(0, (1 - a) * 30)
            ctx.push_group()
            ctx.arc(x0 + 100, cy, 62, 0, TAU)
            src(ctx, col, 0.22)
            ctx.fill()
            icon(ctx, x0 + 100, cy + 40, 30, col if icon not in (worker,) else col)
            words = lab.split(" ")
            lines, cur = [], ""
            for wd in words:
                if text_w(ctx, (cur + " " + wd).strip(), F_BLACK, 30) > 300:
                    lines.append(cur)
                    cur = wd
                else:
                    cur = (cur + " " + wd).strip()
            lines.append(cur)
            for k, ln in enumerate(lines):
                text(ctx, ln, x0 + 185, cy - (len(lines) - 1) * 18 + k * 36, 30, F_BLACK, WHITE, "l")
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(a)
            ctx.restore()
    na = e_out(prog(t, EV["benefit"] + 1.6, EV["benefit"] + 2.0))
    text(ctx, "Impacts differ by person, place and policy — no single figure applies.", W / 2, 1390, 23,
         F_SB, MUTED, alpha=na)


# ================================================================= scene 6: crime
def scene_crime(ctx, lt, t):
    blit(ctx, europe_layer(P_EU, "eu_dim", six=False), 0.55)
    src(ctx, NAVY, 0.35)
    ctx.rectangle(0, 270, W, 1210)
    ctx.fill()
    ta = e_out(prog(lt, 0, 0.35))
    rrect(ctx, 50, 285, 980, 170, 26)
    src(ctx, INK, 0.92 * ta)
    ctx.fill()
    text(ctx, "DOES MORE IMMIGRATION", W / 2, 335, 54, F_BLACK, WHITE, alpha=ta)
    text(ctx, "MEAN MORE CRIME?", W / 2, 405, 54, F_BLACK, YELLOW, alpha=ta)
    bu = prog(lt, 0.2, 0.6)
    if bu > 0:
        police_badge(ctx, 250, 700, 95 * e_back(bu))
    qu = prog(lt, 0.4, 0.8)
    if qu > 0:
        s = e_back(qu, 2.4) * (1 + 0.04 * math.sin(t * 5))
        ctx.save()
        ctx.translate(720, 700)
        ctx.scale(s, s)
        ctx.arc(0, 0, 130, 0, TAU)
        src(ctx, YELLOW)
        ctx.fill()
        text(ctx, "?", 0, 5, 200, F_BLACK, NAVY)
        ctx.restore()
    cu = prog(t, EV["cannot"], EV["cannot"] + 0.3)
    if cu > 0:
        s = e_back(cu)
        ctx.save()
        ctx.translate(W / 2, 960)
        ctx.scale(s, s)
        rrect(ctx, -470, -70, 940, 140, 24)
        src(ctx, WHITE)
        ctx.fill()
        text(ctx, "CORRELATION IS", 0, -24, 50, F_BLACK, NAVY)
        text(ctx, "NOT CAUSATION", 0, 30, 50, F_BLACK, RED)
        ctx.restore()
    pu = prog(t, EV["cannot"] + 0.8, EV["cannot"] + 1.2)
    if pu > 0:
        s = e_back(pu)
        ctx.save()
        ctx.translate(W / 2, 1160)
        ctx.scale(s, s)
        rrect(ctx, -460, -75, 920, 150, 22)
        src(ctx, INK, 0.95)
        ctx.fill_preserve()
        src(ctx, HL)
        ctx.set_line_width(3)
        ctx.stroke()
        text(ctx, "Crime reporting, age, income, location and", 0, -22, 30, F_XB, WHITE)
        text(ctx, "national laws affect comparisons.", 0, 22, 30, F_XB, WHITE)
        ctx.restore()
    gfx.source_label(ctx, "Source: Eurostat — crime and criminal justice statistics, methodology", ta, y=1300)


# ================================================================= scene 7: final question
def scene_final(ctx, lt, t):
    blit(ctx, europe_layer(P_EU, "eu_six"), 0.5)
    src(ctx, NAVY, 0.4)
    ctx.rectangle(0, 270, W, 1210)
    ctx.fill()
    for i, c in enumerate(CODES):
        u = prog(lt, 0.1 + i * 0.12, 0.45 + i * 0.12)
        if u > 0:
            s = e_back(u, 2.2)
            cx = 115 + i * 170
            ctx.save()
            ctx.translate(cx, 330)
            ctx.scale(s, s)
            flag(ctx, c, -60, -40, 120, 80)
            ctx.restore()
    for i, (key, word, col) in enumerate((("jobs", "JOBS.", WHITE), ("housing", "HOUSING.", WHITE),
                                          ("safety", "SAFETY.", YELLOW))):
        u = prog(t, EV[key] - 0.1, EV[key] + 0.25)
        if u > 0:
            s = e_back(u, 2.2)
            ctx.save()
            ctx.translate(200 + i * 340, 480)
            ctx.scale(s, s)
            text(ctx, word, 0, 0, 62 if i < 2 else 66, F_BLACK, col, shadow=True)
            ctx.restore()
    bu = prog(t, EV["best"] - 0.2, EV["best"] + 0.2)
    if bu > 0:
        s = e_back(bu)
        ctx.save()
        ctx.translate(W / 2, 640)
        ctx.scale(s, s)
        text(ctx, "WHICH COUNTRY IS", 0, -42, 60, F_BLACK, WHITE, shadow=True)
        text(ctx, "HANDLING IMMIGRATION BEST?", 0, 30, 54, F_BLACK, YELLOW, shadow=True)
        ctx.restore()
    cu = prog(t, EV["comment"] - 0.6, EV["comment"] - 0.2)
    if cu > 0:
        s = e_back(cu) * (1 + 0.035 * math.sin(t * 8))
        ctx.save()
        ctx.translate(W / 2, 805)
        ctx.scale(s, s)
        rrect(ctx, -400, -62, 800, 124, 62)
        src(ctx, ORANGE)
        ctx.fill()
        gfx.icon_comment(ctx, -320, -2, 36, WHITE)
        text(ctx, "COMMENT YOUR COUNTRY!", 40, 0, 48, F_BLACK, WHITE)
        ctx.restore()
    su = e_out(prog(t, EV["question"] + 2.0, EV["question"] + 2.5))
    if su > 0:
        rrect(ctx, 50, 920, 980, 420, 22)
        src(ctx, hexc("#050B1A"), 0.9 * su)
        ctx.fill_preserve()
        src(ctx, MUTED, 0.6 * su)
        ctx.set_line_width(2)
        ctx.stroke()
        text(ctx, "SOURCES", W / 2, 965, 26, F_BLACK, YELLOW, alpha=su, spacing=3)
        lines = ["Eurostat — Population by country of birth, 2025",
                 "Eurostat — Immigration arrivals, 2024",
                 "Eurostat — Real GDP growth, 2021–2025",
                 "Eurostat — Harmonised Index of Consumer Prices (HICP)",
                 "Eurostat — Crime and criminal justice statistics methodology"]
        for i, ln in enumerate(lines):
            text(ctx, ln, W / 2, 1020 + i * 50, 28, F_SB, WHITE, alpha=su * 0.95)
        text(ctx, "2024–25 figures may be provisional", W / 2, 1290, 22, F_MED, MUTED, alpha=su)


SCENE_FN = {"hook": scene_hook, "pop": scene_pop, "arrivals": scene_arrivals, "economy": scene_economy,
            "balance": scene_balance, "crime": scene_crime, "final": scene_final}
CHIPS = {"hook": None, "pop": ("WHO HAS THE MOST IMMIGRANTS?", HL_D),
         "arrivals": ("THE SURPRISE", hexc("#C2410C")), "economy": ("THE ECONOMY", HL_D),
         "balance": ("PRESSURE OR SUPPORT?", hexc("#0F766E")), "crime": ("THE FACTS ON CRIME", HL_D),
         "final": ("YOUR VERDICT", hexc("#C2410C"))}
ORDER = list(SCENES.keys())
TD = 0.4


def draw_scene(ctx, name, t):
    SCENE_FN[name](ctx, max(0.0, t - SCENES[name][0]), t)


def render_frame(t):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    gfx.background(ctx, t)
    cur = next((n for n in ORDER if SCENES[n][0] <= t < SCENES[n][1]), ORDER[-1])
    idx = ORDER.index(cur)
    a, b = SCENES[cur]
    tr = None
    if idx > 0 and t < a + TD / 2:
        tr = (ORDER[idx - 1], cur, (t - (a - TD / 2)) / TD)
    elif idx < len(ORDER) - 1 and t >= b - TD / 2:
        tr = (cur, ORDER[idx + 1], (t - (b - TD / 2)) / TD)
    if tr:
        prev, nxt, u = tr
        e = e_inout(clamp(u))
        if prev == "hook" or nxt == "final":
            for name, z, al in ((prev, 1 + 0.5 * e, 1 - e), (nxt, 1.15 - 0.15 * e, e)):
                ctx.save()
                ctx.translate(W / 2, 900)
                ctx.scale(z, z)
                ctx.translate(-W / 2, -900)
                ctx.push_group()
                draw_scene(ctx, name, t)
                ctx.pop_group_to_source()
                ctx.paint_with_alpha(al)
                ctx.restore()
        else:
            for name, x in ((prev, -W * e), (nxt, W * (1 - e))):
                ctx.save()
                ctx.translate(x, 0)
                draw_scene(ctx, name, t)
                ctx.restore()
        chip_name, chip_alpha = (nxt if u >= 0.5 else prev), abs(u - 0.5) * 2
    else:
        draw_scene(ctx, cur, t)
        chip_name, chip_alpha = cur, 1.0
    chip = CHIPS[chip_name]
    gfx.chrome(ctx, t, (chip[0], chip[1], chip_alpha) if chip else None)
    gfx.subtitles(ctx, t)
    return surf


def frame_bytes(i):
    return bytes(render_frame(i / FPS).get_data())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", default="")
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    if args.stills:
        sd = os.path.join(OUT_DIR, "stills")
        os.makedirs(sd, exist_ok=True)
        for s in args.stills.split(","):
            t = float(s)
            render_frame(t).write_to_png(os.path.join(sd, f"t{t:05.2f}.png"))
        print("stills ->", sd)
        return
    n = int(round(DURATION * FPS))
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-i", AUDIO, "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
           "-t", f"{DURATION:.3f}", OUT_FILE]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(args.workers) as pool:
        for k, data in enumerate(pool.imap(frame_bytes, range(n), chunksize=8)):
            proc.stdin.write(data)
            if k % 300 == 0:
                print(f"frame {k}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", OUT_FILE)


if __name__ == "__main__":
    main()

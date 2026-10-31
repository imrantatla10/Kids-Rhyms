"""Render "What If France Attacked the UK?" — hypothetical, high-level military comparison.

1080x1920, 30 fps, 63 s. All maps, ships, aircraft, soldiers, icons and charts are flat 2D,
drawn procedurally with cairo, and piped to ffmpeg with audio/final_mix.wav.

    python3 render.py                   # full render -> output/*.mp4
    python3 render.py --stills 3,10,20  # PNG previews into output/stills/
"""
import argparse
import math
import os
import subprocess
from multiprocessing import Pool

import cairo

import geo
import gfx
from gfx import (BLUE_L, F_BLACK, F_MED, F_SB, F_XB, GREEN, LAND, MUTED, NAVY, ORANGE, RED, TAU, WHITE,
                 YELLOW, arrow_head, blit, clamp, curve_arrow, e_back, e_inout, e_out, hexc, lerp,
                 make_layer, map_path, pill, prog, rrect, src, text, text_w, union_jack, wa, font)
from timeline import DURATION, EV, FPS, H, SCENES, W

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "output")
AUDIO = os.path.join(ROOT, "audio", "final_mix.wav")
OUT_FILE = os.path.join(OUT_DIR, "What_If_France_Attacked_the_UK_vertical.mp4")

gfx.BRAND = "HYPOTHETICAL SCENARIO  ·  NOT A PREDICTION"

FR = hexc("#2563EB")      # France = blue
FR_D = hexc("#1E40AF")
UK = hexc("#DC2626")      # UK = red
UK_D = hexc("#991B1B")
STEEL = hexc("#94A3B8")
STEEL_D = hexc("#64748B")
HULL = hexc("#7C8BA1")
DECK = hexc("#475569")
SEA = hexc("#0E3A66")
SEA_D = hexc("#082847")
AMBER = hexc("#F59E0B")


def french_flag(ctx, x, y, w, h, alpha=1.0):
    for i, c in enumerate(("#0055A4", "#FFFFFF", "#EF4135")):
        src(ctx, hexc(c), alpha)
        ctx.rectangle(x + i * w / 3, y, w / 3 + 0.5, h)
        ctx.fill()


def flag_card(ctx, which, cx, cy, w, s=1.0, alpha=1.0):
    h = w / 2 if which == "uk" else w * 2 / 3
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(s, s)
    ctx.push_group()
    rrect(ctx, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 10)
    src(ctx, WHITE)
    ctx.fill()
    ctx.save()
    rrect(ctx, -w / 2, -h / 2, w, h, 6)
    ctx.clip()
    if which == "uk":
        union_jack(ctx, -w / 2, -h / 2, w, h)
    else:
        french_flag(ctx, -w / 2, -h / 2, w, h)
    ctx.restore()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()


# ================================================================= maps
P_WE = geo.Proj(-11.0, 9.5, 42.2, 59.2, 110, 540, 860, coslat=51)
P_EU = geo.Proj(-11.0, 30.0, 35.8, 60.5, 40, 300, 1000, coslat=50)
EXAMPLES = {"Germany": (10.3, 51.2), "Spain": (-3.7, 40.2), "Italy": (12.5, 42.8),
            "Belgium": (4.6, 50.6), "Netherlands": (5.6, 52.3)}


def we_layer(c):
    world = geo.load("50m")
    c.rectangle(0, 270, W, 1200)
    c.clip()
    for name, rings in world.items():
        map_path(c, rings, P_WE)
        if name == "France":
            src(c, FR)
        elif name == "United Kingdom":
            src(c, UK)
        else:
            src(c, LAND)
        c.fill_preserve()
        src(c, NAVY, 0.9)
        c.set_line_width(1.6)
        c.stroke()
    for name in ("France", "United Kingdom"):
        map_path(c, world[name], P_WE)
        src(c, WHITE, 0.9)
        c.set_line_width(3)
        c.stroke()


def eu_layer(c):
    world = geo.load("50m")
    c.rectangle(0, 270, W, 1000)
    c.clip()
    for name, rings in world.items():
        map_path(c, rings, P_EU)
        if name == "France":
            src(c, FR)
        elif name == "United Kingdom":
            src(c, UK)
        elif name in EXAMPLES:
            src(c, hexc("#3A4F7E"))
        else:
            src(c, LAND)
        c.fill_preserve()
        src(c, NAVY, 0.9)
        c.set_line_width(1.3)
        c.stroke()


def examples_outline(c):
    world = geo.load("50m")
    for name in EXAMPLES:
        map_path(c, world[name], P_EU)
    src(c, AMBER)
    c.set_line_width(4)
    c.stroke()


def map_labels_we(ctx, a):
    x, y = P_WE(-2.2, 53.6)
    pill(ctx, "UNITED KINGDOM", x - 10, y, 30, UK_D, WHITE, alpha=a, border=WHITE)
    x, y = P_WE(2.4, 46.6)
    pill(ctx, "FRANCE", x, y, 34, FR_D, WHITE, alpha=a, border=WHITE)


# ================================================================= illustrations
def carrier(ctx, x, y, L, kind, alpha=1.0):
    """Flat side-view aircraft carrier, waterline at y, length L, centred on x.
    kind 'qe' = twin islands + ski-jump bow; 'cdg' = single island, flat deck."""
    ctx.save()
    ctx.translate(x, y)
    ctx.push_group()
    s = L / 400
    # hull
    src(ctx, HULL)
    ctx.move_to(-200 * s, -34 * s)
    if kind == "qe":
        ctx.line_to(170 * s, -34 * s)
        ctx.line_to(205 * s, -46 * s)          # ski-jump
        ctx.line_to(200 * s, -20 * s)
    else:
        ctx.line_to(205 * s, -34 * s)
        ctx.line_to(200 * s, -20 * s)
    ctx.line_to(175 * s, 0)
    ctx.line_to(-185 * s, 0)
    ctx.close_path()
    ctx.fill()
    src(ctx, hexc("#B91C1C"), 0.85)
    ctx.rectangle(-185 * s, -6 * s, 360 * s, 6 * s)
    ctx.fill()
    # flight deck
    src(ctx, DECK)
    ctx.rectangle(-205 * s, -40 * s, 380 * s if kind == "qe" else 410 * s, 7 * s)
    ctx.fill()
    # islands
    src(ctx, STEEL)
    if kind == "qe":
        for ix in (-15, 55):
            ctx.rectangle(ix * s, -72 * s, 34 * s, 32 * s)
            ctx.rectangle((ix + 8) * s, -88 * s, 18 * s, 16 * s)
    else:
        ctx.rectangle(20 * s, -78 * s, 46 * s, 38 * s)
        ctx.rectangle(32 * s, -96 * s, 20 * s, 18 * s)
    ctx.fill()
    src(ctx, NAVY)
    for ix in ((-12, 58) if kind == "qe" else (24, 40)):
        ctx.rectangle(ix * s, -66 * s, 26 * s, 5 * s)
    ctx.fill()
    # parked aircraft silhouettes on deck
    src(ctx, STEEL_D)
    for k in range(5):
        px = (-185 + k * 42) * s
        ctx.move_to(px, -40 * s)
        ctx.line_to(px + 26 * s, -40 * s)
        ctx.line_to(px + 14 * s, -48 * s)
        ctx.close_path()
    ctx.fill()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def waves(ctx, x0, x1, y, t, color=WHITE, a=0.18):
    src(ctx, color, a)
    ctx.set_line_width(3)
    for k in range(int((x1 - x0) / 70)):
        x = x0 + ((k * 70 + t * 30) % (x1 - x0))
        ctx.move_to(x, y)
        ctx.curve_to(x + 10, y - 7, x + 20, y + 7, x + 30, y)
        ctx.stroke()


def submarine(ctx, x, y, L, flag=None, alpha=1.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.push_group()
    s = L / 300
    src(ctx, hexc("#334155"))
    rrect(ctx, -150 * s, -22 * s, 300 * s, 44 * s, 22 * s)
    ctx.fill()
    ctx.move_to(150 * s, 0)
    ctx.line_to(175 * s, -16 * s)
    ctx.line_to(175 * s, 16 * s)
    ctx.close_path()
    ctx.fill()
    rrect(ctx, -60 * s, -50 * s, 52 * s, 32 * s, 8 * s)   # sail
    ctx.fill()
    src(ctx, hexc("#475569"))
    ctx.rectangle(-150 * s + 20 * s, -4 * s, 250 * s, 4 * s)
    ctx.fill()
    if flag == "uk":
        union_jack(ctx, -55 * s, -46 * s, 42 * s, 21 * s)
    elif flag == "fr":
        french_flag(ctx, -55 * s, -46 * s, 42 * s, 26 * s)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def frigate(ctx, x, y, L, alpha=1.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.push_group()
    s = L / 300
    src(ctx, HULL)
    ctx.move_to(-150 * s, -26 * s)
    ctx.line_to(150 * s, -26 * s)
    ctx.line_to(130 * s, 0)
    ctx.line_to(-140 * s, 0)
    ctx.close_path()
    ctx.fill()
    src(ctx, STEEL)
    ctx.rectangle(-60 * s, -62 * s, 90 * s, 36 * s)
    ctx.rectangle(-30 * s, -95 * s, 24 * s, 33 * s)
    ctx.rectangle(-130 * s, -40 * s, 50 * s, 14 * s)
    ctx.fill()
    ctx.set_line_width(4 * s)
    ctx.move_to(60 * s, -26 * s)
    ctx.line_to(95 * s, -38 * s)
    ctx.stroke()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def amphib(ctx, x, y, L, alpha=1.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.push_group()
    s = L / 300
    src(ctx, HULL)
    ctx.move_to(-150 * s, -40 * s)
    ctx.line_to(150 * s, -40 * s)
    ctx.line_to(140 * s, 0)
    ctx.line_to(-150 * s, 0)
    ctx.close_path()
    ctx.fill()
    src(ctx, DECK)
    ctx.rectangle(-150 * s, -46 * s, 300 * s, 6 * s)
    ctx.fill()
    src(ctx, STEEL)
    ctx.rectangle(50 * s, -86 * s, 60 * s, 40 * s)
    ctx.fill()
    src(ctx, NAVY, 0.6)
    ctx.rectangle(-140 * s, -30 * s, 50 * s, 22 * s)   # stern well-deck door
    ctx.fill()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def soldier(ctx, x, y, s, color, alpha=1.0):
    """Flat 2D soldier, feet at y, ~ 3.2*s tall."""
    ctx.save()
    ctx.translate(x, y)
    ctx.push_group()
    src(ctx, hexc("#F1C9A5"))
    ctx.arc(0, -2.55 * s, 0.32 * s, 0, TAU)
    ctx.fill()
    src(ctx, color)
    ctx.arc(0, -2.68 * s, 0.4 * s, math.pi, TAU)          # helmet
    ctx.fill()
    ctx.rectangle(-0.48 * s, -2.7 * s, 0.96 * s, 0.1 * s)
    ctx.fill()
    rrect(ctx, -0.45 * s, -2.15 * s, 0.9 * s, 1.2 * s, 0.2 * s)   # torso
    ctx.fill()
    src(ctx, wa(color, 0.85))
    ctx.rectangle(-0.42 * s, -1.0 * s, 0.36 * s, 1.0 * s)
    ctx.rectangle(0.06 * s, -1.0 * s, 0.36 * s, 1.0 * s)
    ctx.fill()
    src(ctx, hexc("#1F2937"))
    ctx.rectangle(-0.48 * s, -0.12 * s, 0.44 * s, 0.12 * s)
    ctx.rectangle(0.04 * s, -0.12 * s, 0.44 * s, 0.12 * s)
    ctx.fill()
    src(ctx, hexc("#0F172A"), 0.7)                         # backpack strap
    ctx.rectangle(-0.1 * s, -2.15 * s, 0.2 * s, 1.2 * s)
    ctx.fill()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def tank(ctx, x, y, L, color, kind, alpha=1.0):
    """Flat side silhouette; kind 'leclerc' (angular turret) or 'cr2' (wedge turret)."""
    ctx.save()
    ctx.translate(x, y)
    ctx.push_group()
    s = L / 300
    # tracks
    src(ctx, hexc("#1F2937"))
    rrect(ctx, -140 * s, -34 * s, 270 * s, 34 * s, 17 * s)
    ctx.fill()
    src(ctx, hexc("#6B7280"))
    for k in range(6):
        ctx.arc((-110 + k * 44) * s, -17 * s, 12 * s, 0, TAU)
        ctx.fill()
    # hull
    src(ctx, color)
    ctx.move_to(-150 * s, -34 * s)
    ctx.line_to(140 * s, -34 * s)
    ctx.line_to(155 * s, -58 * s)
    ctx.line_to(-145 * s, -62 * s)
    ctx.close_path()
    ctx.fill()
    # turret
    src(ctx, wa(color, 1.0))
    if kind == "leclerc":
        ctx.move_to(-80 * s, -62 * s)
        ctx.line_to(60 * s, -62 * s)
        ctx.line_to(55 * s, -98 * s)
        ctx.line_to(-90 * s, -98 * s)
        ctx.close_path()
    else:
        ctx.move_to(-90 * s, -62 * s)
        ctx.line_to(70 * s, -62 * s)
        ctx.line_to(40 * s, -96 * s)
        ctx.line_to(-80 * s, -100 * s)
        ctx.close_path()
    ctx.fill()
    src(ctx, hexc("#000000"), 0.2)
    ctx.rectangle(-150 * s, -40 * s, 300 * s, 6 * s)
    ctx.fill()
    # gun
    src(ctx, hexc("#334155"))
    ctx.rectangle(50 * s, -86 * s, 150 * s, 9 * s)
    ctx.fill()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def jet(ctx, x, y, L, color, kind, alpha=1.0, ang=-0.25):
    """Top-down flat silhouette pointing right; kind 'rafale', 'typhoon', 'f35'."""
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.push_group()
    s = L / 200
    src(ctx, color)
    # fuselage
    ctx.move_to(100 * s, 0)
    ctx.line_to(60 * s, -9 * s)
    ctx.line_to(-90 * s, -10 * s)
    ctx.line_to(-90 * s, 10 * s)
    ctx.line_to(60 * s, 9 * s)
    ctx.close_path()
    ctx.fill()
    if kind in ("rafale", "typhoon"):
        # delta wing
        root = -60 if kind == "typhoon" else -55
        ctx.move_to(25 * s, 8 * s)
        ctx.line_to(root * s, 70 * s)
        ctx.line_to(-85 * s, 70 * s)
        ctx.line_to(-85 * s, -70 * s)
        ctx.line_to(root * s, -70 * s)
        ctx.line_to(25 * s, -8 * s)
        ctx.close_path()
        ctx.fill()
        # canards
        cx = 40 if kind == "rafale" else 62
        for d in (1, -1):
            ctx.move_to(cx * s, d * 8 * s)
            ctx.line_to((cx - 22) * s, d * 32 * s)
            ctx.line_to((cx - 30) * s, d * 32 * s)
            ctx.line_to((cx - 20) * s, d * 8 * s)
            ctx.close_path()
        ctx.fill()
    else:
        # F-35: trapezoid wings + tailplanes
        for d in (1, -1):
            ctx.move_to(15 * s, d * 9 * s)
            ctx.line_to(-35 * s, d * 62 * s)
            ctx.line_to(-55 * s, d * 62 * s)
            ctx.line_to(-50 * s, d * 9 * s)
            ctx.close_path()
            ctx.move_to(-65 * s, d * 9 * s)
            ctx.line_to(-85 * s, d * 36 * s)
            ctx.line_to(-98 * s, d * 36 * s)
            ctx.line_to(-92 * s, d * 9 * s)
            ctx.close_path()
        ctx.fill()
    src(ctx, hexc("#0F172A"), 0.6)
    rrect(ctx, 50 * s, -5 * s, 30 * s, 10 * s, 5 * s)   # canopy
    ctx.fill()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def trefoil(ctx, x, y, r, color, bg):
    """Generic nuclear trefoil symbol (deterrence icon)."""
    ctx.arc(x, y, r, 0, TAU)
    src(ctx, bg)
    ctx.fill()
    src(ctx, color)
    for k in range(3):
        a0 = -math.pi / 2 + k * TAU / 3 - math.pi / 6
        ctx.move_to(x + 0.22 * r * math.cos(a0), y + 0.22 * r * math.sin(a0))
        ctx.arc(x, y, 0.85 * r, a0, a0 + math.pi / 3)
        ctx.arc_negative(x, y, 0.28 * r, a0 + math.pi / 3, a0)
        ctx.close_path()
        ctx.fill()
    ctx.arc(x, y, 0.16 * r, 0, TAU)
    ctx.fill()


def shield(ctx, x, y, w, color, alpha=1.0):
    h = w * 1.2
    ctx.move_to(x - w / 2, y - h / 2)
    ctx.line_to(x + w / 2, y - h / 2)
    ctx.line_to(x + w / 2, y)
    ctx.curve_to(x + w / 2, y + h * 0.3, x + w * 0.2, y + h * 0.45, x, y + h / 2)
    ctx.curve_to(x - w * 0.2, y + h * 0.45, x - w / 2, y + h * 0.3, x - w / 2, y)
    ctx.close_path()
    src(ctx, color, alpha)
    ctx.fill()


def bolt(ctx, x, y, s, color):
    src(ctx, color)
    ctx.move_to(x + 0.2 * s, y - s)
    ctx.line_to(x - 0.5 * s, y + 0.15 * s)
    ctx.line_to(x - 0.02 * s, y + 0.15 * s)
    ctx.line_to(x - 0.25 * s, y + s)
    ctx.line_to(x + 0.55 * s, y - 0.2 * s)
    ctx.line_to(x + 0.05 * s, y - 0.2 * s)
    ctx.close_path()
    ctx.fill()


def cargo_ship_icon(ctx, x, y, s, color):
    src(ctx, color)
    ctx.move_to(x - s, y)
    ctx.line_to(x + s, y)
    ctx.line_to(x + 0.75 * s, y + 0.45 * s)
    ctx.line_to(x - 0.85 * s, y + 0.45 * s)
    ctx.close_path()
    ctx.fill()
    for k, c in enumerate((AMBER, BLUE_L, GREEN, RED)):
        src(ctx, c)
        ctx.rectangle(x - 0.7 * s + k * 0.36 * s, y - 0.32 * s, 0.32 * s, 0.3 * s)
    ctx.fill()


# ================================================================= scene 1: hook
def scene_hook(ctx, lt, t):
    z = 1.0 + 0.06 * e_inout(prog(lt, 0, 6))
    ma = e_out(prog(lt, 0, 0.5))
    ctx.save()
    ctx.translate(W / 2, 1050)
    ctx.scale(z, z)
    ctx.translate(-W / 2, -1050)
    blit(ctx, make_layer("we", we_layer), ma)
    map_labels_we(ctx, e_out(prog(lt, 0.8, 1.3)))
    # flags pop out
    for i, (which, lon, lat, tt0) in enumerate((("uk", -8.0, 58.0, 1.9), ("fr", 7.2, 48.6, 2.3))):
        u = prog(lt, tt0, tt0 + 0.35)
        if u > 0:
            x, y = P_WE(lon, lat)
            flag_card(ctx, which, x, y, 150, s=e_back(u, 2.2) * (1 + 0.03 * math.sin(lt * 4 + i)))
    # question mark between the two countries (over the Channel)
    qu = prog(lt, 3.3, 3.7)
    if qu > 0:
        qx, qy = P_WE(-1.6, 50.3)
        s = e_back(qu, 2.4) * (1 + 0.05 * math.sin(lt * 5))
        ctx.save()
        ctx.translate(qx, qy)
        ctx.rotate(0.12 * math.sin(lt * 2.5))
        ctx.scale(s, s)
        ctx.arc(0, 0, 78, 0, TAU)
        src(ctx, YELLOW)
        ctx.fill()
        text(ctx, "?", 0, 3, 120, F_BLACK, NAVY)
        ctx.restore()
    ctx.restore()
    # title
    for i, (line, col, y) in enumerate((("WHAT IF FRANCE", WHITE, 300), ("ATTACKED THE UK?", YELLOW, 420))):
        u = e_back(prog(lt, 0.15 + i * 0.25, 0.55 + i * 0.25))
        if u > 0:
            ctx.save()
            ctx.translate(W / 2, y)
            ctx.scale(u, u)
            text(ctx, line, 0, 0, 90, F_BLACK, col, shadow=True)
            ctx.restore()


# ================================================================= scene 2: carriers
def scene_carriers(ctx, lt, t):
    pa = e_out(prog(lt, 0, 0.35))
    for side in (0, 1):
        x0 = 30 if side == 0 else 552
        col = UK if side == 0 else FR
        rrect(ctx, x0, 280, 498, 700, 26)
        src(ctx, SEA_D, pa)
        ctx.fill()
        ctx.save()
        rrect(ctx, x0, 280, 498, 700, 26)
        ctx.clip()
        src(ctx, SEA, pa)
        ctx.rectangle(x0, 600, 498, 400)
        ctx.fill()
        for yy in (650, 760, 870):
            waves(ctx, x0 + 10, x0 + 488, yy, lt + yy, WHITE, 0.12 * pa)
        ctx.restore()
        rrect(ctx, x0, 280, 498, 100, 26)
        src(ctx, col, pa)
        ctx.fill()
        ctx.rectangle(x0, 340, 498, 40)
        ctx.fill()
        flag_card(ctx, "uk" if side == 0 else "fr", x0 + 70, 330, 70, alpha=pa)
        text(ctx, "UNITED KINGDOM" if side == 0 else "FRANCE", x0 + 290, 330, 38, F_BLACK, WHITE, alpha=pa)
    # carriers appear one by one
    for k in range(2):
        u = prog(t, EV["uk_carriers"] + 0.4 * k, EV["uk_carriers"] + 0.4 * k + 0.4)
        if u > 0:
            yy = 610 + k * 230 + 40 * (1 - e_out(u))
            carrier(ctx, 279, yy + math.sin(lt * 2 + k) * 3, 430, "qe", alpha=e_out(u))
            text(ctx, "QUEEN ELIZABETH-CLASS", 279, yy + 44, 22, F_XB, WHITE, alpha=e_out(u) * 0.85)
    u = prog(t, EV["fr_carrier"], EV["fr_carrier"] + 0.4)
    if u > 0:
        yy = 720 + 40 * (1 - e_out(u))
        carrier(ctx, 801, yy + math.sin(lt * 2 + 2) * 3, 440, "cdg", alpha=e_out(u))
        cu = e_out(prog(t, EV["cdg"] - 0.3, EV["cdg"] + 0.1))
        text(ctx, "CHARLES DE GAULLE", 801, yy + 44, 24, F_XB, WHITE, alpha=e_out(u) * 0.85)
        pill(ctx, "NUCLEAR-POWERED", 801, 470, 26, hexc("#0B1733"), YELLOW, alpha=cu, border=YELLOW)
    # Graphic A: two-column comparison
    ga = e_out(prog(lt, 0.8, 1.3))
    text(ctx, "AIRCRAFT CARRIERS", W / 2, 1035, 48, F_BLACK, WHITE, alpha=ga)
    for side, n, key, col, lab in ((0, 2, "uk_carriers", UK, "UK — 2 AIRCRAFT CARRIERS"),
                                   (1, 1, "fr_carrier", FR, "FRANCE — 1 AIRCRAFT CARRIER")):
        cx = 279 if side == 0 else 801
        u = prog(t, EV[key], EV[key] + 0.5)
        rrect(ctx, cx - 240, 1085, 480, 220, 22)
        src(ctx, col, 0.18 * ga)
        ctx.fill_preserve()
        src(ctx, col, 0.9 * ga)
        ctx.set_line_width(3)
        ctx.stroke()
        if u > 0:
            s = e_back(u, 2.2)
            ctx.save()
            ctx.translate(cx, 1170)
            ctx.scale(s, s)
            text(ctx, str(n), 0, 0, 120, F_BLACK, WHITE)
            ctx.restore()
            text(ctx, lab, cx, 1268, 27, F_BLACK, WHITE, alpha=e_out(u))
    na = e_out(prog(lt, 2.0, 2.5))
    text(ctx, "Fleet inventory does not mean every carrier", W / 2, 1352, 25, F_SB, MUTED, alpha=na)
    text(ctx, "is available for deployment.", W / 2, 1384, 25, F_SB, MUTED, alpha=na)
    gfx.source_label(ctx, "Sources: Royal Navy; French Ministry of the Armed Forces (Marine nationale)", na,
                     y=1430)


# ================================================================= scene 3: submarines & warships
def scene_subs(ctx, lt, t):
    top, surf, bot = 280, 450, 900
    a = e_out(prog(lt, 0, 0.35))
    # sky / water cutaway
    rrect(ctx, 30, top, 1020, bot - top, 26)
    src(ctx, hexc("#14284D"), a)
    ctx.fill()
    ctx.save()
    rrect(ctx, 30, top, 1020, bot - top, 26)
    ctx.clip()
    g = cairo.LinearGradient(0, surf, 0, bot)
    g.add_color_stop_rgba(0, *SEA[:3], a)
    g.add_color_stop_rgba(1, *hexc("#04182F")[:3], a)
    ctx.set_source(g)
    ctx.rectangle(30, surf, 1020, bot - surf)
    ctx.fill()
    # sonar-style rings (decorative)
    for k in range(3):
        ph = (lt * 0.45 + k / 3) % 1.0
        ctx.arc(W / 2, 690, 40 + 420 * ph, 0, TAU)
        src(ctx, hexc("#38BDF8"), (1 - ph) * 0.35 * a)
        ctx.set_line_width(3)
        ctx.stroke()
    # light rays
    for k in range(5):
        src(ctx, WHITE, 0.03 * a)
        ctx.move_to(120 + k * 210, surf)
        ctx.line_to(170 + k * 210, surf)
        ctx.line_to(90 + k * 210, bot)
        ctx.line_to(30 + k * 210, bot)
        ctx.close_path()
        ctx.fill()
    waves(ctx, 40, 1040, surf, lt * 2, WHITE, 0.25 * a)
    # surface ships
    fu = prog(t, EV["frigates"], EV["frigates"] + 0.4)
    if fu > 0:
        frigate(ctx, 270, surf + 2 + math.sin(lt * 2) * 2, 300, e_out(fu))
        pill(ctx, "FRIGATES", 270, 330, 28, hexc("#0B1733"), WHITE, alpha=e_out(fu), border=BLUE_L)
    au = prog(t, EV["amphib"], EV["amphib"] + 0.4)
    if au > 0:
        amphib(ctx, 790, surf + 2 + math.sin(lt * 2 + 1) * 2, 330, e_out(au))
        pill(ctx, "AMPHIBIOUS SHIPS", 790, 330, 28, hexc("#0B1733"), WHITE, alpha=e_out(au), border=BLUE_L)
    # submarines (drifting in place — no routes or positions)
    for key, x, y, flag in (("fr_subs", 300, 640, "fr"), ("uk_subs", 770, 780, "uk")):
        u = prog(t, EV[key] - 0.2, EV[key] + 0.4)
        if u > 0:
            submarine(ctx, x + math.sin(lt * 0.8) * 10, y + math.sin(lt * 1.3) * 4, 340, flag, e_out(u))
    su = e_out(prog(t, EV["fr_subs"], EV["fr_subs"] + 0.4))
    pill(ctx, "SUBMARINES", W / 2, 860, 28, hexc("#0B1733"), WHITE, alpha=su, border=hexc("#38BDF8"))
    ctx.restore()

    # Graphic B: separate categories, no combined head-to-head total
    ga = e_out(prog(lt, 0.6, 1.0))
    for side in (0, 1):
        x0 = 30 if side == 0 else 552
        col = UK if side == 0 else FR
        rrect(ctx, x0, 935, 498, 420, 24)
        src(ctx, col, 0.14 * ga)
        ctx.fill_preserve()
        src(ctx, col, 0.85 * ga)
        ctx.set_line_width(3)
        ctx.stroke()
        flag_card(ctx, "uk" if side == 0 else "fr", x0 + 60, 985, 56, alpha=ga)
        text(ctx, "UNITED KINGDOM" if side == 0 else "FRANCE", x0 + 275, 985, 32, F_BLACK, WHITE, alpha=ga)
    # UK card
    u = prog(t, EV["uk_subs"], EV["uk_subs"] + 0.4)
    if u > 0:
        s = e_back(u, 2.0)
        ctx.save()
        ctx.translate(279, 1095)
        ctx.scale(s, s)
        text(ctx, "9", 0, 0, 120, F_BLACK, WHITE)
        ctx.restore()
        text(ctx, "SUBMARINES", 279, 1180, 36, F_BLACK, WHITE, alpha=e_out(u))
        for k in range(9):
            uu = prog(t, EV["uk_subs"] + 0.3 + k * 0.08, EV["uk_subs"] + 0.5 + k * 0.08)
            if uu > 0:
                submarine(ctx, 95 + (k % 5) * 92, 1240 + (k // 5) * 44, 70, None, uu)
        text(ctx, "UK MOD, APRIL 2026", 279, 1330, 22, F_XB, MUTED, alpha=e_out(u))
    # France card
    u = prog(t, EV["fr_subs"], EV["fr_subs"] + 0.4)
    if u > 0:
        s = e_back(u, 2.0)
        ctx.save()
        ctx.translate(680, 1095)
        ctx.scale(s, s)
        text(ctx, "4", 0, 0, 120, F_BLACK, WHITE)
        ctx.restore()
        for k in range(4):
            uu = prog(t, EV["fr_subs"] + 0.3 + k * 0.1, EV["fr_subs"] + 0.5 + k * 0.1)
            if uu > 0:
                submarine(ctx, 860 + (k % 2) * 92, 1070 + (k // 2) * 44, 72, None, uu)
        text(ctx, "NUCLEAR BALLISTIC-MISSILE", 801, 1180, 27, F_BLACK, WHITE, alpha=e_out(u))
        text(ctx, "SUBMARINES", 801, 1214, 27, F_BLACK, WHITE, alpha=e_out(u))
        u2 = e_out(prog(t, EV["fr_subs"] + 0.6, EV["fr_subs"] + 1.0))
        rrect(ctx, 580, 1250, 442, 70, 18)
        src(ctx, FR, 0.35 * u2)
        ctx.fill()
        text(ctx, "+ NUCLEAR ATTACK", 801, 1272, 24, F_BLACK, WHITE, alpha=u2)
        text(ctx, "SUBMARINE FLEET (separate)", 801, 1302, 22, F_XB, BLUE_L, alpha=u2)
    na = e_out(prog(t, EV["uk_subs"] + 0.8, EV["uk_subs"] + 1.2))
    text(ctx, "Different submarine categories — not a head-to-head total", W / 2, 1390, 24, F_SB, MUTED,
         alpha=na)
    gfx.source_label(ctx, "Sources: UK Ministry of Defence (inventory, 1 April 2026); French Ministry of the Armed Forces",
                     na, y=1425)


# ================================================================= scene 4: land & air
def scene_land(ctx, lt, t):
    a = e_out(prog(lt, 0, 0.35))
    for side in (0, 1):
        x0 = 30 if side == 0 else 552
        col = FR if side == 0 else UK
        rrect(ctx, x0, 280, 498, 1050, 26)
        src(ctx, col, 0.12 * a)
        ctx.fill_preserve()
        src(ctx, col, 0.8 * a)
        ctx.set_line_width(3)
        ctx.stroke()
        rrect(ctx, x0, 280, 498, 90, 26)
        src(ctx, col, a)
        ctx.fill()
        ctx.rectangle(x0, 330, 498, 40)
        ctx.fill()
        flag_card(ctx, "fr" if side == 0 else "uk", x0 + 65, 325, 64, alpha=a)
        text(ctx, "FRANCE" if side == 0 else "UNITED KINGDOM", x0 + 285, 325, 36, F_BLACK, WHITE, alpha=a)
    # row labels (centre pills)
    for key, y, lab in (("land", 400, "LAND FORCES"), ("vehicles", 745, "COMBAT VEHICLES"), ("air", 905, "AIR POWER")):
        u = e_out(prog(t, EV[key] - 0.2, EV[key] + 0.2))
        pill(ctx, lab, W / 2, y, 28, hexc("#0B1733"), YELLOW, alpha=u, border=YELLOW)
    # land forces: soldier + tank silhouettes
    u = e_out(prog(t, EV["land"], EV["land"] + 0.5))
    if u > 0:
        for side, col, kind, name in ((0, hexc("#3B5BA9"), "leclerc", "LECLERC"),
                                      (1, hexc("#5B6B3A"), "cr2", "CHALLENGER 2")):
            x0 = 30 if side == 0 else 552
            dx = (1 - u) * (-50 if side == 0 else 50)
            soldier(ctx, x0 + 90 + dx, 640, 62, hexc("#4B6B3A") if side else hexc("#3F5F8F"), u)
            tank(ctx, x0 + 295 + dx, 640, 255, col, kind, u)
            text(ctx, name, x0 + 295, 675, 24, F_XB, WHITE, alpha=u)
            text(ctx, "SOLDIER", x0 + 90, 675, 20, F_XB, MUTED, alpha=u)
    # combat vehicles — relative, no totals
    vu = e_out(prog(t, EV["vehicles"], EV["vehicles"] + 0.8))
    if vu > 0:
        for side, frac, col, lab in ((0, 1.0, FR, "MORE"), (1, 0.62, UK, "FEWER")):
            x0 = 60 if side == 0 else 582
            w = 440 * frac * vu
            rrect(ctx, x0, 778, w, 44, 12)
            src(ctx, col)
            ctx.fill()
            text(ctx, lab, x0 + w - 14, 800, 26, F_BLACK, WHITE, "r", alpha=clamp(vu * 2 - 1))
        text(ctx, "Relative scale only — no exact totals shown", W / 2, 843, 20, F_SB, MUTED, alpha=vu)
    # air power: aircraft illustrations
    au = e_out(prog(t, EV["air"] - 1.5, EV["air"] - 0.9))
    if au > 0:
        drift = math.sin(lt * 1.5) * 8
        jet(ctx, 279 + drift, 1030, 260, hexc("#CBD5E1"), "rafale", au)
        text(ctx, "RAFALE", 279, 1145, 26, F_XB, WHITE, alpha=au)
        jet(ctx, 700 - drift, 990, 200, hexc("#CBD5E1"), "typhoon", au)
        jet(ctx, 900 + drift, 1060, 190, hexc("#A3AEBF"), "f35", au)
        text(ctx, "TYPHOON", 700, 1100, 24, F_XB, WHITE, alpha=au)
        text(ctx, "F-35", 905, 1145, 24, F_XB, WHITE, alpha=au)
    # UK capability tags
    for i, (key, lab) in enumerate((("air", "ADVANCED AIR POWER"), ("intel", "INTELLIGENCE"),
                                    ("natolinked", "NATO-LINKED CAPABILITIES"))):
        u = prog(t, EV[key], EV[key] + 0.35)
        if u > 0:
            s = e_back(u)
            ctx.save()
            ctx.translate(801, 1195 + i * 46)
            ctx.scale(s, s)
            pill(ctx, lab, 0, 0, 22, UK, WHITE)
            ctx.restore()
    # France land tags
    fu = prog(t, EV["land"] + 1.2, EV["land"] + 1.6)
    if fu > 0:
        for i, lab in enumerate(("LARGER ARMY STRUCTURE", "IN SEVERAL AREAS")):
            pill(ctx, lab, 279, 1210 + i * 46, 22, FR, WHITE, alpha=e_out(fu))
    da = e_out(prog(lt, 1.5, 2.0))
    text(ctx, "Equipment numbers do not equal combat readiness.", W / 2, 1375, 26, F_XB, YELLOW, alpha=da)
    gfx.source_label(ctx, "Qualitative comparison · Sources: UK MOD; French Ministry of the Armed Forces", da,
                     y=1415)


# ================================================================= scene 5: nuclear danger
def scene_nuclear(ctx, lt, t):
    freeze = EV["escalate"] + 0.6
    frozen = t >= freeze
    ta = min(t, freeze)
    lta = ta - SCENES["nuclear"][0]
    blit(ctx, make_layer("we", we_layer), 1.0)
    map_labels_we(ctx, 1.0)
    # flags
    for which, lon, lat in (("uk", -8.0, 58.0), ("fr", 7.2, 48.6)):
        x, y = P_WE(lon, lat)
        flag_card(ctx, which, x, y, 130)
    # deterrence symbols, one per country
    for i, (lon, lat) in enumerate(((-3.0, 55.3), (2.2, 48.8))):
        u = prog(ta, EV["nukes"] + i * 0.25, EV["nukes"] + i * 0.25 + 0.4)
        if u > 0:
            x, y = P_WE(lon, lat)
            s = e_back(u, 2.0)
            ctx.save()
            ctx.translate(x, y)
            ctx.scale(s, s)
            shield(ctx, 0, 0, 120, hexc("#0B1733"), 0.92)
            ctx.set_line_width(5)
            shield(ctx, 0, 0, 120, YELLOW, 0.0)
            trefoil(ctx, 0, -6, 44, hexc("#0B1733"), YELLOW)
            ctx.restore()
    # red warning pulse around the map
    pu = prog(ta, EV["danger"] - 0.3, EV["danger"] + 0.2)
    if pu > 0:
        ph = (lta * 1.25) % 1.0
        inten = (0.35 + 0.45 * (1 - ph)) * pu
        for k in range(14):
            ctx.rectangle(k * 3, 270 + k * 3, W - 2 * k * 3, 1110 - 2 * k * 3)
            src(ctx, RED, inten * (1 - k / 14) * 0.5)
            ctx.set_line_width(4)
            ctx.stroke()
    # warning label
    wu = prog(ta, EV["danger"], EV["danger"] + 0.35)
    if wu > 0:
        s = e_back(wu)
        ctx.save()
        ctx.translate(W / 2, 345)
        ctx.scale(s, s)
        rrect(ctx, -420, -55, 840, 110, 18)
        src(ctx, YELLOW)
        ctx.fill()
        ctx.save()
        rrect(ctx, -420, -55, 840, 110, 18)
        ctx.clip()
        src(ctx, NAVY)
        for k in range(-12, 14):
            ctx.move_to(k * 70, -55)
            ctx.line_to(k * 70 + 30, -55)
            ctx.line_to(k * 70 - 20, 55)
            ctx.line_to(k * 70 - 50, 55)
            ctx.close_path()
        ctx.fill()
        rrect(ctx, -380, -40, 760, 80, 14)
        src(ctx, YELLOW)
        ctx.fill()
        ctx.restore()
        text(ctx, "NUCLEAR-ARMED STATES", 0, 0, 50, F_BLACK, NAVY)
        ctx.restore()
    # escalation note
    eu = prog(t, EV["escalate"], EV["escalate"] + 0.4)
    if eu > 0:
        pill(ctx, "RISK OF ESCALATION", W / 2, 445, 36, RED, WHITE, alpha=e_out(eu))
    if frozen:
        # brief freeze: desaturating veil + paused badge
        fz = e_out(prog(t, freeze, freeze + 0.25))
        src(ctx, hexc("#0A1630"), 0.35 * fz)
        ctx.rectangle(0, 270, W, 1110)
        ctx.fill()
        for k in (0, 1):
            rrect(ctx, W - 130 + k * 38, 300, 24, 70, 6)
        src(ctx, WHITE, 0.8 * fz)
        ctx.fill()
    gfx.source_label(ctx, "Both the UK and France are recognised nuclear-weapon states (NPT)",
                     e_out(prog(lt, 1.0, 1.5)), y=1405)


# ================================================================= scene 6: Europe-wide consequences
def scene_europe(ctx, lt, t):
    z = lerp(1.9, 1.0, e_inout(prog(lt, 0.0, 1.4)))
    cx, cy = P_EU(0.5, 50.5)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(z, z)
    ctx.translate(-cx, -cy)
    blit(ctx, make_layer("eu", eu_layer), 1.0)
    ou = e_out(prog(t, EV["trade"] - 0.3, EV["trade"] + 0.3))
    if ou > 0:
        blit(ctx, make_layer("eu_ex", examples_outline), ou)
    # trade routes from UK and France to the example economies (economic links, not military)
    hubs = [P_EU(-1.0, 52.3), P_EU(2.4, 47.0)]
    routes = [(0, "Netherlands"), (0, "Belgium"), (0, "Germany"), (1, "Germany"), (1, "Italy"),
              (1, "Spain"), (0, "Spain"), (1, "Belgium")]
    ru = prog(lt, 1.2, 2.2)
    for i, (h, name) in enumerate(routes):
        p2 = P_EU(*EXAMPLES[name])
        u = e_out(clamp(ru * 1.6 - i * 0.08))
        pts = curve_arrow(ctx, hubs[h], p2, 40 if i % 2 else -40, u, YELLOW, 3.5, 0.85, 0, dash=[9, 7],
                          phase=-lt * 40)
        if pts and u >= 1:
            ph = (lt * 0.6 + i * 0.13) % 1.0
            px, py = pts[int(ph * (len(pts) - 1))]
            ctx.arc(px, py, 6, 0, TAU)
            src(ctx, WHITE)
            ctx.fill()
    ctx.restore()
    # example country labels (after zoom out)
    la = e_out(prog(t, EV["trade"], EV["trade"] + 0.5))
    if la > 0:
        for name, (lon, lat), dx, dy in (("GERMANY", (10.3, 51.2), 40, -10), ("SPAIN", (-3.7, 40.2), 0, 0),
                                         ("ITALY", (12.5, 42.8), 40, 20), ("BELGIUM", (4.6, 50.6), 100, 150),
                                         ("NETHERLANDS", (5.6, 52.3), 60, -110)):
            x, y = P_EU(lon, lat)
            if dx or dy:
                ctx.move_to(x, y)
                ctx.line_to(x + dx, y + dy)
                src(ctx, AMBER, la)
                ctx.set_line_width(2.5)
                ctx.stroke()
            pill(ctx, name, x + dx, y + dy, 22, hexc("#0B1733"), AMBER, alpha=la, border=AMBER)
    # UK / France labels
    ua = e_out(prog(lt, 0.2, 0.6))
    x, y = P_EU(-2.5, 54.6)
    pill(ctx, "UK", x - 40, y - 30, 26, UK_D, WHITE, alpha=ua, border=WHITE)
    x, y = P_EU(2.4, 46.4)
    pill(ctx, "FRANCE", x - 30, y + 30, 26, FR_D, WHITE, alpha=ua, border=WHITE)
    # Graphic C: four impact cards (2 x 2) — no numbers
    cards = [("trade", "TRADE & SHIPPING", "DISRUPTION", cargo_ship_icon, BLUE_L),
             ("energy", "ENERGY", "UNCERTAINTY", bolt, AMBER),
             ("financial", "MARKET", "VOLATILITY", None, GREEN),
             ("nato", "NATO", "CRISIS", None, RED)]
    for i, (key, l1, l2, icon, col) in enumerate(cards):
        u = prog(t, EV[key] - 0.1, EV[key] + 0.3)
        if u <= 0:
            continue
        cx = 279 if i % 2 == 0 else 801
        cy = 1150 + (i // 2) * 125
        s = e_back(u)
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(s, s)
        rrect(ctx, -250, -55, 500, 110, 20)
        src(ctx, hexc("#0B1733"), 0.95)
        ctx.fill_preserve()
        src(ctx, col)
        ctx.set_line_width(4)
        ctx.stroke()
        ctx.arc(-185, 0, 40, 0, TAU)
        src(ctx, col, 0.22)
        ctx.fill()
        if key == "trade":
            cargo_ship_icon(ctx, -185, 0, 30, col)
        elif key == "energy":
            bolt(ctx, -185, 0, 28, col)
        elif key == "financial":
            text(ctx, "€£", -185, 0, 34, F_BLACK, col)
        else:
            union_jack(ctx, -213, -18, 28, 14)
            french_flag(ctx, -183, -18, 26, 17)
            src(ctx, col)
            ctx.set_line_width(3)
            ctx.move_to(-185, -24)
            ctx.line_to(-190, -8)
            ctx.line_to(-182, 4)
            ctx.stroke()
            text(ctx, "NATO", -185, 18, 15, F_BLACK, WHITE)
        text(ctx, l1, -120, -16, 30, F_BLACK, WHITE, "l")
        text(ctx, l2, -120, 20, 28, F_XB, col, "l")
        # wobbling disruption arrow
        wob = math.sin((t - EV[key]) * 6) * 4
        arrow_head(ctx, 205, 6 + wob, math.pi / 2, 18, col)
        ctx.rectangle(201, -24 + wob, 8, 24)
        src(ctx, col)
        ctx.fill()
        ctx.restore()
    na = e_out(prog(t, EV["trade"] + 0.5, EV["trade"] + 1.0))
    text(ctx, "Examples of possible indirect economic disruption —", W / 2, 1372, 23, F_SB, MUTED, alpha=na)
    text(ctx, "not a claim that these countries would join a war.", W / 2, 1402, 23, F_SB, MUTED, alpha=na)
    gfx.source_label(ctx, "Both the UK and France are NATO members · illustrative, not a forecast", na, y=1440)


# ================================================================= scene 7: final question
def scene_final(ctx, lt, t):
    blit(ctx, make_layer("we", we_layer), 0.45)
    src(ctx, NAVY, 0.35)
    ctx.rectangle(0, 270, W, 1150)
    ctx.fill()
    # flags side by side
    fa = prog(lt, 0.0, 0.4)
    for i, which in enumerate(("uk", "fr")):
        u = prog(lt, 0.1 + i * 0.15, 0.5 + i * 0.15)
        if u > 0:
            flag_card(ctx, which, 330 + i * 420, 400, 240, s=e_back(u))
    if fa > 0:
        ctx.arc(W / 2, 400, 48, 0, TAU)
        src(ctx, NAVY, fa)
        ctx.fill_preserve()
        src(ctx, WHITE, fa)
        ctx.set_line_width(4)
        ctx.stroke()
        text(ctx, "VS", W / 2, 400, 36, F_BLACK, WHITE, alpha=fa)
    # who would win? -> no reliable answer
    wu = prog(t, EV["win"] - 0.6, EV["win"] - 0.2)
    wo = 1 - prog(t, EV["nobody"] - 0.4, EV["nobody"] - 0.1)
    if wu > 0 and wo > 0:
        text(ctx, "WHO WOULD WIN?", W / 2, 640, 80, F_BLACK, WHITE, alpha=e_out(wu) * wo, shadow=True)
        su = prog(t, EV["noanswer"], EV["noanswer"] + 0.25)
        if su > 0:
            s = lerp(1.5, 1.0, e_out(su))
            ctx.save()
            ctx.translate(W / 2, 790)
            ctx.rotate(-0.06)
            ctx.scale(s, s)
            rrect(ctx, -360, -52, 720, 104, 16)
            src(ctx, RED, su * wo)
            ctx.set_line_width(7)
            ctx.stroke()
            text(ctx, "NO RELIABLE ANSWER", 0, 0, 52, F_BLACK, RED, alpha=su * wo)
            ctx.restore()
    # NO REAL WINNER?
    nu = prog(t, EV["nobody"] - 0.15, EV["nobody"] + 0.3)
    if nu > 0:
        s = e_back(nu, 2.0)
        ctx.save()
        ctx.translate(W / 2, 700)
        ctx.scale(s, s)
        text(ctx, "NO REAL", 0, -75, 130, F_BLACK, WHITE, shadow=True)
        text(ctx, "WINNER?", 0, 60, 130, F_BLACK, YELLOW, shadow=True)
        ctx.restore()
        bu = e_out(prog(t, EV["billions"] - 0.2, EV["billions"] + 0.2))
        text(ctx, "Europe could lose billions*", W / 2, 880, 40, F_XB, WHITE, alpha=bu)
        text(ctx, "*a possibility, not a forecast", W / 2, 925, 24, F_SB, MUTED, alpha=bu)
    # CTA
    cu = prog(t, EV["disaster"] + 0.3, EV["disaster"] + 0.7)
    if cu > 0:
        pulse = 1 + 0.035 * math.sin(t * 8) * prog(t, EV["disaster"] + 0.9, EV["disaster"] + 1.3)
        s = e_back(cu) * pulse
        ctx.save()
        ctx.translate(W / 2, 1060)
        ctx.scale(s, s)
        rrect(ctx, -470, -95, 940, 190, 44)
        src(ctx, YELLOW)
        ctx.fill()
        gfx.icon_comment(ctx, -385, -4, 44, NAVY)
        text(ctx, "COMMENT:", 50, -36, 50, F_BLACK, NAVY)
        text(ctx, "WHO WOULD LOSE MORE?", 50, 28, 50, F_BLACK, RED)
        ctx.restore()
    # final source card
    su = e_out(prog(t, EV["disaster"] + 0.8, EV["disaster"] + 1.2))
    if su > 0:
        rrect(ctx, 50, 1220, 980, 230, 20)
        src(ctx, hexc("#050B1A"), 0.88 * su)
        ctx.fill_preserve()
        src(ctx, MUTED, 0.6 * su)
        ctx.set_line_width(2)
        ctx.stroke()
        text(ctx, "SOURCES", W / 2, 1255, 24, F_BLACK, YELLOW, alpha=su, spacing=3)
        lines = ["UK Ministry of Defence — armed forces equipment inventory, 1 April 2026",
                 "Royal Navy · French Ministry of the Armed Forces / Marine nationale",
                 "Hypothetical scenario — not a prediction. Both countries are NATO",
                 "members and nuclear-armed states. No winner can be reliably predicted."]
        for i, ln in enumerate(lines):
            text(ctx, ln, W / 2, 1298 + i * 37, 23, F_MED, WHITE, alpha=su * 0.92)


SCENE_FN = {"hook": scene_hook, "carriers": scene_carriers, "subs": scene_subs, "land": scene_land,
            "nuclear": scene_nuclear, "europe": scene_europe, "final": scene_final}
CHIPS = {"hook": None, "carriers": ("AT SEA · AIRCRAFT CARRIERS", hexc("#1D4ED8")),
         "subs": ("SUBMARINES & WARSHIPS", hexc("#0369A1")), "land": ("LAND & AIR", hexc("#4D7C0F")),
         "nuclear": ("THE BIGGEST DANGER", hexc("#B91C1C")), "europe": ("EUROPE PAYS THE PRICE", hexc("#B45309")),
         "final": ("THE VERDICT?", hexc("#6D28D9"))}
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
            # quick zoom-through
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

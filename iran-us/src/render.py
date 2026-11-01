"""Render "Iran vs America: What Happens If the Conflict Escalates Again?" — 1920x1080, 30 fps, 2D (cairo).

No on-screen words: only maps, flags, icons and charts (the single "2026" on the timeline is the only digit use).
Military visuals stay high-level and illustrative: no targets, routes, positions or attack depictions.
Scenario scenes (from "Now imagine...") sit inside a dashed "what-if" frame with a question badge, and the
price chart shows a dashed projection inside an uncertainty band, so the escalation reads as a possibility.

    python3 src/render.py                  # full video -> output/Iran_vs_America_Escalation_1080p.mp4
    python3 src/render.py --stills 3,12,30 # PNG previews -> output/stills/
"""
import argparse
import math
import os
import subprocess
from multiprocessing import Pool

import cairo

import geo
from timeline import DURATION, EV, FPS, H, ORDER, SCENES, W, XF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "output")
OUT_FILE = os.path.join(OUT_DIR, "Iran_vs_America_Escalation_1080p.mp4")
AUDIO = os.path.join(ROOT, "audio", "final_mix.wav")
TAU = 2 * math.pi
F_BLACK = "Inter Display Black"


# ================================================================= basics
def hexc(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


BG0 = hexc("#060B18")
BG1 = hexc("#0D1A33")
SEA = hexc("#0B1730")
LAND = hexc("#1E2C47")
LAND_EDGE = hexc("#33466B")
WHITE = hexc("#FFFFFF")
MUTED = hexc("#8A9BBB")
STEEL = hexc("#B8C4D9")
DIM = hexc("#4A5B7C")
GRID = hexc("#1A2C4E")
IR_GREEN = hexc("#239F40")
IR_RED = hexc("#DA0000")
IR_HL = hexc("#2F9E5B")
US_BLUE = hexc("#3C5A9A")
US_NAVY = hexc("#0A3161")
US_RED = hexc("#B31942")
US_HL = hexc("#4C7FD6")
AMBER = hexc("#F5A524")
ORANGE = hexc("#F97316")
RED = hexc("#E5484D")
TEAL = hexc("#2DD4BF")
CYAN = hexc("#38BDF8")
GOLD = hexc("#E9C46A")
OIL = hexc("#2B2F36")
WOOD = hexc("#6B4A2F")
WOOD_L = hexc("#8A6240")


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def lerp(a, b, u):
    return a + (b - a) * u


def prog(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def e_out(u):
    return 1 - (1 - u) ** 3


def e_io(u):
    return u * u * (3 - 2 * u)


def e_back(u, s=1.7):
    u -= 1
    return u * u * ((s + 1) * u + s) + 1


def mix(c1, c2, u):
    return tuple(lerp(a, b, u) for a, b in zip(c1, c2))


def src(ctx, c, a=1.0):
    ctx.set_source_rgba(c[0], c[1], c[2], c[3] * a)


def rrect(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -TAU / 4, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, TAU / 4)
    ctx.arc(x + r, y + h - r, r, TAU / 4, TAU / 2)
    ctx.arc(x + r, y + r, r, TAU / 2, 3 * TAU / 4)
    ctx.close_path()


def circle(ctx, x, y, r):
    ctx.new_sub_path()
    ctx.arc(x, y, r, 0, TAU)


def glow_dot(ctx, x, y, r, c, a=1.0):
    g = cairo.RadialGradient(x, y, 0, x, y, r)
    g.add_color_stop_rgba(0, c[0], c[1], c[2], 0.55 * a)
    g.add_color_stop_rgba(0.4, c[0], c[1], c[2], 0.2 * a)
    g.add_color_stop_rgba(1, c[0], c[1], c[2], 0)
    ctx.set_source(g)
    circle(ctx, x, y, r)
    ctx.fill()


def glow_stroke(ctx, path_fn, c, width, a=1.0, layers=4):
    for k in range(layers, 0, -1):
        path_fn()
        src(ctx, c, a * 0.10)
        ctx.set_line_width(width * (1 + 1.6 * k))
        ctx.stroke()
    path_fn()
    src(ctx, c, a)
    ctx.set_line_width(width)
    ctx.stroke()


def pop_scale(t, t0, d=0.45):
    u = prog(t, t0, t0 + d)
    return e_back(u) if u < 1 else 1.0


class Push:
    """with Push(ctx, x, y, s, alpha): draw around local origin (x, y) scaled by s, faded by alpha."""

    def __init__(self, ctx, x=0, y=0, s=1.0, alpha=1.0, rot=0.0):
        self.ctx, self.x, self.y, self.s, self.a, self.r = ctx, x, y, s, alpha, rot

    def __enter__(self):
        self.ctx.save()
        if self.a < 0.999:
            self.ctx.push_group()
        self.ctx.translate(self.x, self.y)
        if self.r:
            self.ctx.rotate(self.r)
        self.ctx.scale(self.s, self.s)
        return self.ctx

    def __exit__(self, *exc):
        if self.a < 0.999:
            self.ctx.pop_group_to_source()
            self.ctx.paint_with_alpha(max(0.0, self.a))
        self.ctx.restore()


# ================================================================= map layers
_layers = {}


def proj_me():
    return geo.Proj(24, 76, 14.4, 40.5, 0, 0, W, coslat=27)


def proj_hormuz():
    # lon 50.6..62.6, centred on the strait
    p = geo.Proj(50.6, 62.6, 0, 29.6, 0, 0, W, coslat=26)
    return p


def proj_world():
    p = geo.Proj(-170, 190, -58, 82, 0, 70, W, coslat=0)
    return p


def map_path(ctx, rings, proj):
    for r in rings:
        if len(r) < 3:
            continue
        x, y = proj(*r[0])
        ctx.move_to(x, y)
        for lon, lat in r[1:]:
            x, y = proj(lon, lat)
            ctx.line_to(x, y)
        ctx.close_path()


GULF_STATES = ["Saudi Arabia", "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Oman", "Iraq"]


def layer(key):
    if key in _layers:
        return _layers[key]
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    c = cairo.Context(surf)
    if key in ("me_land", "hz_land", "world_land"):
        res = "110m" if key == "world_land" else "50m"
        proj = {"me_land": proj_me, "hz_land": proj_hormuz, "world_land": proj_world}[key]()
        countries = geo.load(res)
        for name, rings in countries.items():
            map_path(c, rings, proj)
            src(c, LAND)
            c.fill_preserve()
            src(c, LAND_EDGE)
            c.set_line_width(1.2 if key != "world_land" else 0.8)
            c.stroke()
    elif key.startswith("hl:"):
        _, which, name = key.split(":", 2)
        proj = {"me": proj_me, "hz": proj_hormuz, "world": proj_world}[which]()
        rings = geo.load("110m" if which == "world" else "50m")[name]
        map_path(c, rings, proj)
        c.set_source_rgba(1, 1, 1, 1)
        c.fill()
    elif key.startswith("edge:"):
        _, which, name = key.split(":", 2)
        proj = {"me": proj_me, "hz": proj_hormuz, "world": proj_world}[which]()
        rings = geo.load("110m" if which == "world" else "50m")[name]
        map_path(c, rings, proj)
        c.set_source_rgba(1, 1, 1, 1)
        c.set_line_width(2.6)
        c.set_line_join(cairo.LINE_JOIN_ROUND)
        c.stroke()
    _layers[key] = surf
    return surf


def tint(ctx, key, color, a):
    """Paint a white mask layer in a colour."""
    if a <= 0.001:
        return
    src(ctx, color, a)
    ctx.mask_surface(layer(key), 0, 0)


def blit(ctx, key, a=1.0):
    ctx.set_source_surface(layer(key), 0, 0)
    ctx.paint_with_alpha(a)


# ================================================================= background / chrome
def background(ctx, t):
    g = cairo.RadialGradient(W * 0.5, H * 0.45, 100, W * 0.5, H * 0.5, W * 0.75)
    g.add_color_stop_rgba(0, *BG1[:3], 1)
    g.add_color_stop_rgba(1, *BG0[:3], 1)
    ctx.set_source(g)
    ctx.paint()


def vignette(ctx):
    g = cairo.RadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72)
    g.add_color_stop_rgba(0, 0, 0, 0, 0)
    g.add_color_stop_rgba(1, 0, 0, 0, 0.55)
    ctx.set_source(g)
    ctx.paint()


def dust(ctx, t, a=1.0, n=46):
    # slow drifting particles for depth
    for i in range(n):
        sx = (i * 0.6180339 * W * 1.7) % W
        sy = (i * 0.4142 * H * 2.3) % H
        x = (sx + t * (8 + (i % 5) * 3)) % W
        y = (sy - t * (4 + (i % 3) * 2)) % H
        r = 1.0 + (i % 4) * 0.6
        tw = 0.35 + 0.35 * math.sin(t * 0.9 + i)
        ctx.set_source_rgba(0.75, 0.82, 1.0, 0.10 * tw * a)
        circle(ctx, x, y, r)
        ctx.fill()


def scenario_frame(ctx, t, a):
    """Dashed 'what-if' frame + rotating question badge: marks the hypothetical scenes."""
    if a <= 0.001:
        return
    m = 34
    ctx.save()
    ctx.set_dash([18, 12], -t * 30)
    rrect(ctx, m, m, W - 2 * m, H - 2 * m, 26)
    src(ctx, STEEL, 0.32 * a)
    ctx.set_line_width(2.5)
    ctx.stroke()
    ctx.set_dash([])
    # badge
    bx, by = W - 92, 92
    circle(ctx, bx, by, 34)
    src(ctx, BG0, 0.9 * a)
    ctx.fill_preserve()
    src(ctx, AMBER, 0.85 * a)
    ctx.set_line_width(3)
    ctx.stroke()
    with Push(ctx, bx, by + 2, 0.27 + 0.01 * math.sin(t * 3), 1.0):
        question_mark(ctx, 0, 0, AMBER, a, 1.0)
    ctx.restore()


# ================================================================= flags & icons
def iran_emblem(ctx, cx, cy, s, color):
    """Simplified stylised emblem (no lettering)."""
    src(ctx, color)
    ctx.set_line_width(s * 0.09)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    # two outer crescents
    for sgn in (-1, 1):
        ctx.new_path()
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(sgn, 1)
        ctx.move_to(s * 0.16, -s * 0.42)
        ctx.curve_to(s * 0.52, -s * 0.22, s * 0.52, s * 0.28, s * 0.12, s * 0.46)
        ctx.restore()
        ctx.stroke()
        ctx.new_path()
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(sgn, 1)
        ctx.move_to(s * 0.07, -s * 0.28)
        ctx.curve_to(s * 0.30, -s * 0.12, s * 0.30, s * 0.20, s * 0.06, s * 0.36)
        ctx.restore()
        ctx.stroke()
    # central blade
    ctx.new_path()
    ctx.move_to(cx, cy - s * 0.5)
    ctx.line_to(cx, cy + s * 0.46)
    ctx.stroke()


def flag_iran(ctx, x, y, w, h):
    ctx.save()
    rrect(ctx, x, y, w, h, h * 0.06)
    ctx.clip()
    src(ctx, IR_GREEN)
    ctx.rectangle(x, y, w, h / 3)
    ctx.fill()
    src(ctx, WHITE)
    ctx.rectangle(x, y + h / 3, w, h / 3)
    ctx.fill()
    src(ctx, IR_RED)
    ctx.rectangle(x, y + 2 * h / 3, w, h / 3 + 1)
    ctx.fill()
    iran_emblem(ctx, x + w / 2, y + h / 2, h * 0.30, IR_RED)
    ctx.restore()


def flag_usa(ctx, x, y, w, h):
    ctx.save()
    rrect(ctx, x, y, w, h, h * 0.06)
    ctx.clip()
    sh = h / 13
    for i in range(13):
        src(ctx, US_RED if i % 2 == 0 else WHITE)
        ctx.rectangle(x, y + i * sh, w, sh + 0.6)
        ctx.fill()
    cw, ch = w * 0.4, sh * 7
    src(ctx, US_NAVY)
    ctx.rectangle(x, y, cw, ch)
    ctx.fill()
    src(ctx, WHITE)
    rows = 9
    for r in range(rows):
        cols = 6 if r % 2 == 0 else 5
        for k in range(cols):
            px = x + cw * ((k + (0.5 if r % 2 == 0 else 1.0)) / 6.0)
            py = y + ch * ((r + 0.5) / rows)
            circle(ctx, px, py, max(0.8, h * 0.012))
            ctx.fill()
    ctx.restore()


def flag_card(ctx, which, cx, cy, w, s=1.0, a=1.0, wave_t=None):
    if a <= 0.001 or s <= 0.001:
        return
    h = w * (0.58 if which == "iran" else 0.53)
    with Push(ctx, cx, cy, s, a) as c:
        # shadow + frame
        rrect(c, -w / 2 - 6, -h / 2 - 6 + 8, w + 12, h + 12, 12)
        c.set_source_rgba(0, 0, 0, 0.35)
        c.fill()
        rrect(c, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 12)
        src(c, WHITE, 0.95)
        c.fill()
        (flag_iran if which == "iran" else flag_usa)(c, -w / 2, -h / 2, w, h)
        # subtle sheen
        if wave_t is not None:
            gx = -w / 2 + ((wave_t * 0.35) % 1.6 - 0.3) * w
            g = cairo.LinearGradient(gx - w * 0.25, 0, gx + w * 0.25, 0)
            g.add_color_stop_rgba(0, 1, 1, 1, 0)
            g.add_color_stop_rgba(0.5, 1, 1, 1, 0.16)
            g.add_color_stop_rgba(1, 1, 1, 1, 0)
            c.set_source(g)
            rrect(c, -w / 2, -h / 2, w, h, h * 0.06)
            c.fill()


def badge(ctx, x, y, r, ring, s=1.0, a=1.0, fill=BG0):
    with Push(ctx, x, y, s, a) as c:
        circle(c, 0, 0, r + 10)
        c.set_source_rgba(0, 0, 0, 0.3)
        c.fill()
        circle(c, 0, 0, r)
        src(c, fill, 0.96)
        c.fill_preserve()
        src(c, ring)
        c.set_line_width(4)
        c.stroke()


def question_mark(ctx, x, y, color, a=1.0, u=1.0, size=1.0, width=34):
    """Question mark as a stroked path; u in 0..1 animates the draw-on."""
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(size, size)
    ctx.new_path()
    # hook: arc then descender
    ctx.arc(0, -60, 52, math.pi * 1.05, math.pi * 2.25)
    ctx.curve_to(40, -10, 0, -8, 0, 30)
    path = ctx.copy_path_flat()
    ctx.new_path()
    pts = []
    for kind, p in path:
        if kind in (cairo.PATH_MOVE_TO, cairo.PATH_LINE_TO):
            pts.append(p)
    n = max(2, int(len(pts) * clamp(u / 0.8)))
    if u > 0:
        ctx.move_to(*pts[0])
        for p in pts[1:n]:
            ctx.line_to(*p)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        src(ctx, color, a)
        ctx.set_line_width(width)
        ctx.stroke()
    ud = prog(u, 0.8, 1.0)
    if ud > 0:
        circle(ctx, 0, 78 - 30 * (1 - e_back(ud, 2.5)), 19 * min(1, ud * 1.5))
        src(ctx, color, a)
        ctx.fill()
    ctx.restore()


def icon_burst(ctx, x, y, r, color, a=1.0, rot=0.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.new_path()
    n = 12
    for k in range(2 * n):
        rr = r if k % 2 == 0 else r * 0.52
        ang = k * TAU / (2 * n)
        ctx.line_to(rr * math.cos(ang), rr * math.sin(ang))
    ctx.close_path()
    src(ctx, color, a)
    ctx.fill()
    circle(ctx, 0, 0, r * 0.32)
    src(ctx, hexc("#FFE6A8"), a)
    ctx.fill()
    ctx.restore()


def icon_white_flag(ctx, x, y, s, a=1.0, t=0.0):
    ctx.save()
    ctx.translate(x, y)
    src(ctx, STEEL, a)
    ctx.set_line_width(s * 0.07)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.move_to(-s * 0.35, s * 0.5)
    ctx.line_to(-s * 0.35, -s * 0.5)
    ctx.stroke()
    ctx.new_path()
    ctx.move_to(-s * 0.32, -s * 0.48)
    for k in range(9):
        u = k / 8
        ctx.line_to(-s * 0.32 + u * s * 0.75, -s * 0.48 + math.sin(u * 5 + t * 5) * s * 0.05)
    for k in range(8, -1, -1):
        u = k / 8
        ctx.line_to(-s * 0.32 + u * s * 0.75, -s * 0.06 + math.sin(u * 5 + t * 5 + 0.4) * s * 0.05)
    ctx.close_path()
    src(ctx, WHITE, a)
    ctx.fill()
    ctx.restore()


def icon_handshake(ctx, x, y, s, a=1.0, apart=0.0):
    """Two stylised hands meeting; apart>0 pulls them away from each other."""
    for sgn, col in ((-1, US_HL), (1, IR_HL)):
        ctx.save()
        ctx.translate(x + sgn * (s * 0.22 + apart * s * 0.5), y)
        ctx.scale(-sgn, 1)
        # sleeve
        rrect(ctx, s * 0.22, -s * 0.16, s * 0.34, s * 0.32, s * 0.06)
        src(ctx, col, a)
        ctx.fill()
        # hand
        rrect(ctx, -s * 0.12, -s * 0.13, s * 0.38, s * 0.26, s * 0.12)
        src(ctx, hexc("#E7C9A9"), a)
        ctx.fill()
        # thumb
        rrect(ctx, -s * 0.02, -s * 0.24, s * 0.12, s * 0.16, s * 0.06)
        ctx.fill()
        ctx.restore()


def icon_atom(ctx, x, y, s, color, a=1.0, t=0.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.set_line_width(s * 0.055)
    for k in range(3):
        ctx.save()
        ctx.rotate(k * TAU / 6 + t * 0.4)
        ctx.scale(1, 0.36)
        circle(ctx, 0, 0, s * 0.48)
        ctx.restore()
        src(ctx, color, a)
        ctx.stroke()
        ang = t * 2.2 + k * 2.1
        ex, ey = s * 0.48 * math.cos(ang), s * 0.48 * 0.36 * math.sin(ang)
        rot = k * TAU / 6 + t * 0.4
        px = ex * math.cos(rot) - ey * math.sin(rot)
        py = ex * math.sin(rot) + ey * math.cos(rot)
        circle(ctx, px, py, s * 0.05)
        src(ctx, WHITE, a)
        ctx.fill()
    circle(ctx, 0, 0, s * 0.11)
    src(ctx, color, a)
    ctx.fill()
    ctx.restore()


def icon_sanctions(ctx, x, y, s, color, a=1.0, t=0.0):
    """Coin stack locked by a chain + padlock."""
    ctx.save()
    ctx.translate(x, y)
    for k in range(4):
        cy = s * 0.28 - k * s * 0.13
        ctx.save()
        ctx.translate(-s * 0.05, cy)
        ctx.scale(1, 0.32)
        circle(ctx, 0, 0, s * 0.30)
        ctx.restore()
        src(ctx, GOLD, a)
        ctx.fill_preserve()
        src(ctx, hexc("#9C7A2C"), a)
        ctx.set_line_width(s * 0.02)
        ctx.stroke()
    # chain
    ctx.set_line_width(s * 0.04)
    for k in range(6):
        u = k / 5
        cx = -s * 0.45 + u * s * 0.85
        cy = s * 0.05 + math.sin(u * 3.1) * s * -0.10
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(0.6 if k % 2 else -0.3)
        ctx.scale(1, 0.55)
        circle(ctx, 0, 0, s * 0.08)
        ctx.restore()
        src(ctx, STEEL, a)
        ctx.stroke()
    # padlock
    lx, ly = s * 0.24, s * 0.12 + math.sin(t * 3) * s * 0.01
    ctx.new_path()
    ctx.arc(lx, ly - s * 0.08, s * 0.10, math.pi, 0)
    src(ctx, STEEL, a)
    ctx.set_line_width(s * 0.05)
    ctx.stroke()
    rrect(ctx, lx - s * 0.15, ly - s * 0.08, s * 0.30, s * 0.24, s * 0.04)
    src(ctx, color, a)
    ctx.fill()
    circle(ctx, lx, ly + s * 0.03, s * 0.03)
    src(ctx, BG0, a)
    ctx.fill()
    ctx.restore()


def icon_mini_strait(ctx, x, y, s, a=1.0, t=0.0):
    """Two coastlines pinching a narrow channel with a ship passing."""
    ctx.save()
    ctx.translate(x, y)
    circle(ctx, 0, 0, s * 0.5)
    ctx.clip()
    src(ctx, hexc("#123A5C"), a)
    ctx.paint()
    src(ctx, hexc("#2E4064"), a)
    ctx.move_to(-s, -s)
    ctx.line_to(s, -s)
    ctx.line_to(s, -s * 0.25)
    ctx.curve_to(s * 0.3, -s * 0.3, s * 0.05, -s * 0.05, -s * 0.2, -s * 0.15)
    ctx.curve_to(-s * 0.5, -s * 0.25, -s * 0.7, -s * 0.15, -s, -s * 0.2)
    ctx.close_path()
    ctx.fill()
    ctx.move_to(-s, s)
    ctx.line_to(s, s)
    ctx.line_to(s, s * 0.4)
    ctx.curve_to(s * 0.4, s * 0.3, s * 0.2, s * 0.05, s * 0.02, s * 0.12)
    ctx.curve_to(-s * 0.3, s * 0.25, -s * 0.6, s * 0.15, -s, s * 0.2)
    ctx.close_path()
    ctx.fill()
    ctx.set_dash([s * 0.06, s * 0.05], -t * s * 0.2)
    ctx.move_to(-s, 0)
    ctx.curve_to(-s * 0.3, -s * 0.02, s * 0.3, 0.02, s, 0.04 * s)
    src(ctx, CYAN, 0.7 * a)
    ctx.set_line_width(s * 0.025)
    ctx.stroke()
    ctx.set_dash([])
    px = -s * 0.6 + ((t * 0.18) % 1.0) * s * 1.2
    cargo_ship(ctx, px, -s * 0.01, s * 0.32, a)
    ctx.restore()


def cargo_ship(ctx, x, y, L, a=1.0, flip=False, boxes=True):
    """Side view container ship, length L, waterline at y."""
    ctx.save()
    ctx.translate(x, y)
    if flip:
        ctx.scale(-1, 1)
    h = L * 0.16
    ctx.move_to(-L / 2, -h * 0.55)
    ctx.line_to(L / 2 + L * 0.04, -h * 0.55)
    ctx.line_to(L / 2 - L * 0.04, h * 0.45)
    ctx.line_to(-L / 2 + L * 0.03, h * 0.45)
    ctx.close_path()
    src(ctx, hexc("#C0392B"), a)
    ctx.fill()
    ctx.rectangle(-L / 2 + L * 0.01, -h * 0.55, L * 1.02, h * 0.18)
    src(ctx, hexc("#24324F"), a)
    ctx.fill()
    if boxes:
        cols = [hexc("#2A9D8F"), hexc("#E9C46A"), hexc("#F4A261"), hexc("#4C7FD6"), hexc("#E76F51")]
        bw = L * 0.105
        for k in range(7):
            for r in range(2 if k % 3 else 3):
                bx = -L / 2 + L * 0.08 + k * bw
                by = -h * 0.55 - (r + 1) * h * 0.42
                ctx.rectangle(bx + 1, by, bw - 2, h * 0.40)
                src(ctx, cols[(k * 2 + r) % 5], a)
                ctx.fill()
    # bridge
    ctx.rectangle(-L / 2 + L * 0.0, -h * 0.55 - h * 1.25, L * 0.07, h * 1.25)
    src(ctx, hexc("#E8EEF7"), a)
    ctx.fill()
    ctx.restore()


def carrier(ctx, x, y, L, a=1.0):
    """Side view of an aircraft carrier (generic, illustrative)."""
    ctx.save()
    ctx.translate(x, y)
    h = L * 0.075
    hull = hexc("#5D6B82")
    ctx.move_to(-L / 2, -h)
    ctx.line_to(L / 2 + L * 0.05, -h * 1.15)
    ctx.line_to(L / 2 - L * 0.02, h * 0.9)
    ctx.line_to(-L / 2 + L * 0.04, h * 0.9)
    ctx.close_path()
    src(ctx, hull, a)
    ctx.fill()
    # flight deck
    ctx.rectangle(-L / 2 - L * 0.02, -h * 1.35, L * 1.09, h * 0.35)
    src(ctx, hexc("#3E4A5E"), a)
    ctx.fill()
    ctx.set_dash([L * 0.03, L * 0.02])
    ctx.move_to(-L / 2, -h * 1.18)
    ctx.line_to(L / 2 + L * 0.04, -h * 1.18)
    src(ctx, WHITE, 0.55 * a)
    ctx.set_line_width(2)
    ctx.stroke()
    ctx.set_dash([])
    # island
    ctx.rectangle(L * 0.12, -h * 3.0, L * 0.09, h * 1.7)
    src(ctx, hexc("#7A889E"), a)
    ctx.fill()
    ctx.rectangle(L * 0.145, -h * 3.9, L * 0.012, h * 0.9)
    ctx.fill()
    ctx.rectangle(L * 0.13, -h * 2.6, L * 0.07, h * 0.3)
    src(ctx, hexc("#9FD3FF"), 0.8 * a)
    ctx.fill()
    # parked aircraft silhouettes on deck
    for k in range(5):
        jx = -L * 0.42 + k * L * 0.1
        jet_side(ctx, jx, -h * 1.45, L * 0.06, hexc("#AEB8C8"), a)
    ctx.restore()


def jet_side(ctx, x, y, L, color, a=1.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.move_to(-L / 2, 0)
    ctx.line_to(L / 2, -L * 0.04)
    ctx.line_to(L / 2 - L * 0.1, -L * 0.12)
    ctx.line_to(-L * 0.3, -L * 0.12)
    ctx.line_to(-L / 2, -L * 0.38)
    ctx.line_to(-L * 0.55, -L * 0.1)
    ctx.close_path()
    src(ctx, color, a)
    ctx.fill()
    ctx.restore()


def jet_top(ctx, x, y, L, color, a=1.0, ang=0.0):
    """Top-down generic fighter silhouette pointing +x."""
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.move_to(L * 0.5, 0)
    ctx.line_to(L * 0.18, -L * 0.07)
    ctx.line_to(-L * 0.05, -L * 0.42)
    ctx.line_to(-L * 0.18, -L * 0.42)
    ctx.line_to(-L * 0.12, -L * 0.08)
    ctx.line_to(-L * 0.38, -L * 0.08)
    ctx.line_to(-L * 0.48, -L * 0.22)
    ctx.line_to(-L * 0.52, -L * 0.22)
    ctx.line_to(-L * 0.48, 0)
    ctx.line_to(-L * 0.52, L * 0.22)
    ctx.line_to(-L * 0.48, L * 0.22)
    ctx.line_to(-L * 0.38, L * 0.08)
    ctx.line_to(-L * 0.12, L * 0.08)
    ctx.line_to(-L * 0.18, L * 0.42)
    ctx.line_to(-L * 0.05, L * 0.42)
    ctx.line_to(L * 0.18, L * 0.07)
    ctx.close_path()
    src(ctx, color, a)
    ctx.fill()
    ctx.restore()


def missile_icon(ctx, x, y, L, color, a=1.0):
    """Upright stylised missile on a short stand (static, icon-like)."""
    ctx.save()
    ctx.translate(x, y)
    w = L * 0.13
    ctx.move_to(0, -L)
    ctx.curve_to(w * 0.9, -L * 0.85, w, -L * 0.75, w, -L * 0.65)
    ctx.line_to(w, -L * 0.12)
    ctx.line_to(-w, -L * 0.12)
    ctx.line_to(-w, -L * 0.65)
    ctx.curve_to(-w, -L * 0.75, -w * 0.9, -L * 0.85, 0, -L)
    ctx.close_path()
    src(ctx, color, a)
    ctx.fill()
    ctx.rectangle(-w, -L * 0.62, 2 * w, L * 0.05)
    src(ctx, RED, a)
    ctx.fill()
    for sgn in (-1, 1):
        ctx.move_to(sgn * w, -L * 0.30)
        ctx.line_to(sgn * w * 2.3, -L * 0.12)
        ctx.line_to(sgn * w, -L * 0.12)
        ctx.close_path()
        src(ctx, mix(color, BG0, 0.3), a)
        ctx.fill()
    rrect(ctx, -w * 3, -L * 0.12, w * 6, L * 0.12, L * 0.02)
    src(ctx, hexc("#3A4A66"), a)
    ctx.fill()
    ctx.restore()


def drone_icon(ctx, x, y, L, color, a=1.0):
    """Top-down generic fixed-wing drone silhouette."""
    ctx.save()
    ctx.translate(x, y)
    # wings
    ctx.move_to(-L * 0.06, -L * 0.03)
    ctx.line_to(-L * 0.12, -L * 0.62)
    ctx.line_to(L * 0.0, -L * 0.62)
    ctx.line_to(L * 0.1, -L * 0.04)
    ctx.line_to(L * 0.1, L * 0.04)
    ctx.line_to(L * 0.0, L * 0.62)
    ctx.line_to(-L * 0.12, L * 0.62)
    ctx.line_to(-L * 0.06, L * 0.03)
    ctx.close_path()
    src(ctx, color, a)
    ctx.fill()
    # body
    rrect(ctx, -L * 0.45, -L * 0.05, L * 0.9, L * 0.1, L * 0.05)
    ctx.fill()
    # V tail
    ctx.move_to(-L * 0.38, 0)
    ctx.line_to(-L * 0.5, -L * 0.18)
    ctx.line_to(-L * 0.44, -L * 0.18)
    ctx.line_to(-L * 0.32, 0)
    ctx.line_to(-L * 0.44, L * 0.18)
    ctx.line_to(-L * 0.5, L * 0.18)
    ctx.close_path()
    ctx.fill()
    ctx.restore()


def oil_barrel(ctx, x, y, s, a=1.0):
    ctx.save()
    ctx.translate(x, y)
    w, h = s * 0.62, s
    g = cairo.LinearGradient(-w / 2, 0, w / 2, 0)
    g.add_color_stop_rgba(0, 0.12, 0.13, 0.16, a)
    g.add_color_stop_rgba(0.35, 0.30, 0.32, 0.37, a)
    g.add_color_stop_rgba(1, 0.10, 0.11, 0.13, a)
    rrect(ctx, -w / 2, -h, w, h, s * 0.06)
    ctx.set_source(g)
    ctx.fill()
    for k in (0.2, 0.5, 0.8):
        ctx.rectangle(-w / 2, -h * k - s * 0.025, w, s * 0.05)
        src(ctx, ORANGE, a)
        ctx.fill()
    ctx.save()
    ctx.translate(0, -h)
    ctx.scale(1, 0.25)
    circle(ctx, 0, 0, w / 2)
    ctx.restore()
    src(ctx, hexc("#4A505C"), a)
    ctx.fill()
    # drop symbol
    ctx.move_to(0, -h * 0.66)
    ctx.curve_to(s * 0.09, -h * 0.55, s * 0.08, -h * 0.42, 0, -h * 0.42)
    ctx.curve_to(-s * 0.08, -h * 0.42, -s * 0.09, -h * 0.55, 0, -h * 0.66)
    src(ctx, AMBER, a)
    ctx.fill()
    ctx.restore()


def icon_globe(ctx, x, y, r, color, a=1.0, t=0.0):
    ctx.save()
    ctx.translate(x, y)
    circle(ctx, 0, 0, r)
    src(ctx, hexc("#0F2A4A"), a)
    ctx.fill_preserve()
    src(ctx, color, a)
    ctx.set_line_width(r * 0.06)
    ctx.stroke()
    ctx.save()
    circle(ctx, 0, 0, r)
    ctx.clip()
    for k in range(-2, 3):
        ctx.save()
        ph = (t * 0.25 + k * 0.25) % 1.0
        sx = math.cos(ph * math.pi)
        ctx.scale(max(0.02, abs(sx)), 1)
        circle(ctx, 0, 0, r)
        ctx.restore()
        ctx.set_line_width(r * 0.035)
        src(ctx, color, 0.6 * a)
        ctx.stroke()
    for la in (-0.5, 0, 0.5):
        ctx.move_to(-r, la * r)
        ctx.line_to(r, la * r)
        ctx.stroke()
    ctx.restore()
    ctx.restore()


def icon_people(ctx, x, y, s, color, a=1.0):
    for k, (dx, sc) in enumerate(((-0.32, 0.8), (0.32, 0.8), (0, 1.0))):
        cx = x + dx * s
        circle(ctx, cx, y - s * 0.22 * sc, s * 0.16 * sc)
        src(ctx, color, a)
        ctx.fill()
        ctx.new_sub_path()
        ctx.arc(cx, y + s * 0.3 * sc, s * 0.28 * sc, math.pi, 0)
        ctx.close_path()
        ctx.fill()


def icon_chart(ctx, x, y, s, color, a=1.0):
    ctx.save()
    ctx.translate(x, y)
    for k, hh in enumerate((0.3, 0.5, 0.42, 0.75)):
        rrect(ctx, -s * 0.42 + k * s * 0.22, s * 0.4 - hh * s, s * 0.15, hh * s, s * 0.03)
        src(ctx, color, a)
        ctx.fill()
    ctx.restore()


def caution_ring(ctx, x, y, r, t, a=1.0, color=AMBER):
    for k in range(3):
        u = ((t * 0.7) + k / 3) % 1.0
        circle(ctx, x, y, r * (0.6 + 0.9 * u))
        src(ctx, color, a * (1 - u) * 0.7)
        ctx.set_line_width(3)
        ctx.stroke()


def waves(ctx, x0, x1, y, t, color, a=0.25, amp=6, k=0.02, speed=2.0):
    ctx.new_path()
    for i in range(0, int(x1 - x0) + 1, 8):
        xx = x0 + i
        ctx.line_to(xx, y + amp * math.sin(xx * k + t * speed))
    src(ctx, color, a)
    ctx.set_line_width(3)
    ctx.stroke()


def scale_icon(ctx, x, y, s, tilt, a=1.0):
    """Balance scale centred at pivot (x, y)."""
    ctx.save()
    ctx.translate(x, y)
    src(ctx, STEEL, a)
    # post + base
    rrect(ctx, -s * 0.03, 0, s * 0.06, s * 0.9, s * 0.02)
    ctx.fill()
    rrect(ctx, -s * 0.3, s * 0.88, s * 0.6, s * 0.08, s * 0.04)
    ctx.fill()
    circle(ctx, 0, 0, s * 0.06)
    ctx.fill()
    ctx.save()
    ctx.rotate(tilt)
    rrect(ctx, -s * 0.85, -s * 0.025, s * 1.7, s * 0.05, s * 0.025)
    src(ctx, STEEL, a)
    ctx.fill()
    ends = [(-s * 0.8, 0), (s * 0.8, 0)]
    ctx.restore()
    out = []
    for ex, ey in ends:
        px = ex * math.cos(tilt) - ey * math.sin(tilt)
        py = ex * math.sin(tilt) + ey * math.cos(tilt)
        ctx.move_to(px, py)
        ctx.line_to(px - s * 0.22, py + s * 0.45)
        ctx.move_to(px, py)
        ctx.line_to(px + s * 0.22, py + s * 0.45)
        src(ctx, STEEL, 0.7 * a)
        ctx.set_line_width(s * 0.012)
        ctx.stroke()
        ctx.new_sub_path()
        ctx.arc(px, py + s * 0.45, s * 0.26, 0, math.pi)
        ctx.close_path()
        src(ctx, hexc("#6E7E9C"), a)
        ctx.fill()
        out.append((x + px, y + py + s * 0.45))
    ctx.restore()
    return out


def trophy(ctx, x, y, s, a=1.0, crack=0.0):
    ctx.save()
    ctx.translate(x, y)
    split = crack * s * 0.12
    for side in (-1, 1):
        ctx.save()
        if crack > 0:
            ctx.translate(side * split, crack * s * 0.05)
            ctx.rotate(side * crack * 0.12)
        ctx.rectangle(0 if side > 0 else -s, -s, s, 2 * s)
        ctx.clip()
        # cup
        ctx.move_to(-s * 0.36, -s * 0.5)
        ctx.line_to(s * 0.36, -s * 0.5)
        ctx.curve_to(s * 0.36, s * 0.05, s * 0.15, s * 0.15, s * 0.06, s * 0.18)
        ctx.line_to(s * 0.06, s * 0.36)
        ctx.line_to(s * 0.22, s * 0.36)
        ctx.line_to(s * 0.22, s * 0.46)
        ctx.line_to(-s * 0.22, s * 0.46)
        ctx.line_to(-s * 0.22, s * 0.36)
        ctx.line_to(-s * 0.06, s * 0.36)
        ctx.line_to(-s * 0.06, s * 0.18)
        ctx.curve_to(-s * 0.15, s * 0.15, -s * 0.36, s * 0.05, -s * 0.36, -s * 0.5)
        ctx.close_path()
        src(ctx, mix(GOLD, DIM, crack * 0.6), a)
        ctx.fill()
        for sgn in (-1, 1):
            ctx.new_path()
            ctx.arc(sgn * s * 0.38, -s * 0.3, s * 0.13, 0, TAU)
            src(ctx, mix(GOLD, DIM, crack * 0.6), a)
            ctx.set_line_width(s * 0.05)
            ctx.stroke()
        ctx.restore()
    if crack > 0:
        ctx.move_to(0, -s * 0.5)
        ctx.line_to(s * 0.04, -s * 0.3)
        ctx.line_to(-s * 0.03, -s * 0.1)
        ctx.line_to(s * 0.03, s * 0.1)
        ctx.line_to(0, s * 0.46)
        src(ctx, BG0, a * min(1, crack * 3))
        ctx.set_line_width(s * 0.03)
        ctx.stroke()
    ctx.restore()


# ================================================================= scenes
def me_map(ctx, t, lt, zoom=1.0, cx=W / 2, cy=H / 2):
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(zoom, zoom)
    ctx.translate(-W / 2, -H / 2)
    src(ctx, SEA)
    ctx.paint()
    return ctx  # caller restores


def gulf_glow(ctx, proj, a, t):
    pts = [(47.9, 29.9), (49.6, 28.9), (50.8, 27.8), (52.3, 26.9), (53.8, 26.3), (55.4, 26.4),
           (56.4, 26.5), (57.1, 25.6), (58.4, 24.6), (60.5, 23.6)]

    def path():
        ctx.new_path()
        for k, (lo, la) in enumerate(pts):
            x, y = proj(lo, la)
            (ctx.move_to if k == 0 else ctx.line_to)(x, y)

    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    pulse = 0.85 + 0.15 * math.sin(t * 2.4)
    glow_stroke(ctx, path, TEAL, 22, a * 0.5 * pulse, layers=4)


def scene_hook(ctx, lt, t):
    p = proj_me()
    z = lerp(1.08, 1.0, e_io(prog(t, 0, 7.4)))
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(z, z)
    ctx.translate(-W / 2, -H / 2)
    src(ctx, SEA)
    ctx.paint()
    # gulf water glow under the land
    gulf_glow(ctx, p, prog(t, 0.9, 2.0), t)
    blit(ctx, "me_land", e_out(prog(t, 0.0, 1.0)))
    # Iran highlight
    ui = e_out(prog(t, EV["iran"] - 0.3, EV["iran"] + 0.5))
    tint(ctx, "hl:me:Iran", IR_HL, 0.55 * ui)
    tint(ctx, "edge:me:Iran", hexc("#7CF0A8"), (0.6 + 0.3 * math.sin(t * 3)) * ui)
    # Gulf neighbours faint
    ug = prog(t, EV["complex"], EV["complex"] + 0.8)
    for n in GULF_STATES:
        tint(ctx, f"hl:me:{n}", AMBER, 0.12 * ug)
    ctx.restore()

    # Iran flag on Iran
    ix, iy = p(54.5, 34.6)
    ix = W / 2 + (ix - W / 2) * z
    iy = H / 2 + (iy - H / 2) * z
    flag_card(ctx, "iran", ix, iy - 70, 190, pop_scale(t, EV["iran"]), prog(t, EV["iran"], EV["iran"] + 0.2), t)
    if t > EV["iran"]:
        ctx.move_to(ix, iy - 70 + 62)
        ctx.line_to(ix, iy + 10)
        src(ctx, WHITE, 0.6 * prog(t, EV["iran"] + 0.2, EV["iran"] + 0.5))
        ctx.set_line_width(3)
        ctx.stroke()
        circle(ctx, ix, iy + 14, 7)
        ctx.fill()

    # United States: flag card + world inset (far away)
    uu = prog(t, EV["usa"], EV["usa"] + 0.25)
    flag_card(ctx, "usa", 330, 300, 210, pop_scale(t, EV["usa"]), uu, t)
    world_inset(ctx, 330, 470, 420, uu, t)

    # "far from simple": orbiting context badges around the Gulf
    gx, gy = p(52.5, 26.5)
    uc = prog(t, EV["complex"], EV["complex"] + 0.6)
    if uc > 0:
        icons = [("oil", -1.9), ("ship", -0.6), ("people", 0.7), ("chart", 2.0)]
        for k, (kind, ang) in enumerate(icons):
            uk = prog(t, EV["complex"] + 0.25 * k, EV["complex"] + 0.25 * k + 0.5)
            if uk <= 0:
                continue
            a2 = ang + 0.08 * math.sin(t * 0.8 + k)
            R = 250 * e_out(uk)
            bx, by = gx + R * math.cos(a2), gy + 0.75 * R * math.sin(a2)
            ctx.move_to(gx, gy)
            ctx.line_to(bx, by)
            ctx.set_dash([6, 8])
            src(ctx, STEEL, 0.35 * uk)
            ctx.set_line_width(2)
            ctx.stroke()
            ctx.set_dash([])
            badge(ctx, bx, by, 46, AMBER, pop_scale(t, EV["complex"] + 0.25 * k), uk)
            with Push(ctx, bx, by, pop_scale(t, EV["complex"] + 0.25 * k), uk):
                small_icon(ctx, kind, 0, 0, 56, t)
    dust(ctx, t, 0.8)


def small_icon(ctx, kind, x, y, s, t):
    if kind == "oil":
        oil_barrel(ctx, x, y + s * 0.45, s * 0.9)
    elif kind == "ship":
        cargo_ship(ctx, x, y + s * 0.18, s * 1.1)
    elif kind == "people":
        icon_people(ctx, x, y, s * 0.8, STEEL)
    elif kind == "chart":
        icon_chart(ctx, x, y, s * 0.85, TEAL)


def world_inset(ctx, cx, cy, w, a, t):
    if a <= 0.001:
        return
    pw = proj_world()
    h = w * 0.5
    sc = w / W
    with Push(ctx, cx - w / 2, cy - h / 2, 1.0, a) as c:
        rrect(c, -8, -8, w + 16, h + 16, 16)
        src(c, BG0, 0.85)
        c.fill_preserve()
        src(c, LAND_EDGE, 0.9)
        c.set_line_width(2)
        c.stroke()
        rrect(c, 0, 0, w, h, 10)
        c.clip()
        c.scale(sc, sc)
        world_h = pw(0, -58)[1] - pw(0, 82)[1]
        c.translate(0, -pw(0, 82)[1] + (h / sc - world_h) / 2)
        blit(c, "world_land", 0.9)
        tint(c, "hl:world:United States of America", US_HL, 0.85)
        tint(c, "hl:world:Iran", IR_HL, 0.95)
        ix, iy = pw(54, 32)
        circle(c, ix, iy, 28 + 8 * math.sin(t * 4))
        src(c, hexc("#7CF0A8"), 0.6)
        c.set_line_width(8)
        c.stroke()


def scene_timeline(ctx, lt, t):
    # dim map backdrop with slow drift
    ctx.save()
    z = 1.12 + 0.03 * prog(t, 7.4, 16.2)
    ctx.translate(W / 2, H / 2)
    ctx.scale(z, z)
    ctx.translate(-W / 2 - 40, -H / 2)
    src(ctx, SEA)
    ctx.paint()
    blit(ctx, "me_land", 0.35)
    tint(ctx, "hl:me:Iran", IR_HL, 0.12)
    ctx.restore()
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgba(0, *BG0[:3], 0.55)
    g.add_color_stop_rgba(0.5, *BG0[:3], 0.25)
    g.add_color_stop_rgba(1, *BG0[:3], 0.65)
    ctx.set_source(g)
    ctx.paint()

    y = 600
    x0, x1 = 170, 1750
    nodes = {"strikes": 330, "ceasefire": 760, "diplomatic": 1150, "now": 1640}
    # line draws from left to right over the clip
    t_start, t_end = 7.7, EV["settlement"] + 0.4
    u = e_io(prog(t, t_start, t_end))
    xe = lerp(x0, x1, u)
    crack_x = (nodes["diplomatic"] + nodes["now"]) / 2 - 40
    failed = prog(t, EV["failed"], EV["failed"] + 0.5)

    def seg_line(xa, xb, color, wdt, a=1.0, wobble=0.0):
        if xb <= xa:
            return
        ctx.new_path()
        for xx in range(int(xa), int(xb) + 1, 6):
            ctx.line_to(xx, y + wobble * math.sin(xx * 0.05 + t * 9) * (0.5 + 0.5 * math.sin(xx * 0.013)))
        src(ctx, color, a)
        ctx.set_line_width(wdt)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()

    seg_line(x0, x1, DIM, 6, 0.5)  # rail
    seg_line(x0, min(xe, crack_x - 14 * failed), STEEL, 7)
    if xe > crack_x:
        # after the break: an unsettled, vibrating red line toward "now"
        seg_line(crack_x + 14 * failed, xe, mix(STEEL, RED, failed), 7, 1.0, 7 * failed)
    if failed > 0:
        # zig-zag fracture
        ctx.new_path()
        zz = [(0, -60), (-14, -30), (10, -10), (-12, 14), (8, 36), (-6, 60)]
        for k, (dx, dy) in enumerate(zz):
            kk = int(len(zz) * failed + 0.999)
            if k >= kk:
                break
            (ctx.move_to if k == 0 else ctx.line_to)(crack_x + dx, y + dy)
        src(ctx, RED, 1.0)
        ctx.set_line_width(5)
        ctx.stroke()

    # node: strikes (Feb 2026)
    ts = EV["strikes"]
    s1 = pop_scale(t, ts - 0.1)
    if t > ts - 0.1:
        badge(ctx, nodes["strikes"], y, 70, ORANGE, s1)
        icon_burst(ctx, nodes["strikes"], y, 46 * s1, ORANGE, 1.0, t * 0.3)
        glow_dot(ctx, nodes["strikes"], y, 180, ORANGE, 0.5 * (1 - prog(t, ts, ts + 1.5)) + 0.15)
    ty = EV["y2026"] - 0.3
    if t > ty:
        ua = e_out(prog(t, ty, ty + 0.5))
        with Push(ctx, nodes["strikes"], y + 150 - 20 * (1 - ua), 1.0, ua) as c:
            calendar_icon(c, -118, 0, 60)
            c.select_font_face(F_BLACK)
            c.set_font_size(64)
            src(c, WHITE)
            c.move_to(-70, 24)
            c.show_text("2026")
    # node: ceasefire
    tc = EV["ceasefire"] - 0.15
    if t > tc:
        s2 = pop_scale(t, tc)
        badge(ctx, nodes["ceasefire"], y, 70, STEEL, s2)
        with Push(ctx, nodes["ceasefire"], y, s2):
            icon_white_flag(ctx, 8, 2, 90, 1.0, t)
    # node: diplomacy -> handshake that separates on "failed"
    td = EV["diplomatic"] - 0.15
    if t > td:
        s3 = pop_scale(t, td)
        badge(ctx, nodes["diplomatic"], y, 70, CYAN, s3)
        with Push(ctx, nodes["diplomatic"], y, s3):
            icon_handshake(ctx, 0, 4, 100, 1.0, 0.35 * e_out(failed))
    # "now": pulsing present marker
    tn = EV["settlement"] - 0.4
    if t > tn:
        un = e_out(prog(t, tn, tn + 0.5))
        for k in range(3):
            uu = ((t * 0.8) + k / 3) % 1
            circle(ctx, nodes["now"], y, 26 + 70 * uu)
            src(ctx, RED, 0.5 * (1 - uu) * un)
            ctx.set_line_width(4)
            ctx.stroke()
        circle(ctx, nodes["now"], y, 22 * un)
        src(ctx, RED, 1)
        ctx.fill()
        clock_icon(ctx, nodes["now"], y - 150, 52, t, un)
    dust(ctx, t, 0.7)


def calendar_icon(ctx, x, y, s):
    rrect(ctx, x - s / 2, y - s / 2, s, s * 0.95, s * 0.12)
    src(ctx, WHITE, 0.95)
    ctx.fill()
    ctx.rectangle(x - s / 2, y - s / 2 + s * 0.02, s, s * 0.24)
    src(ctx, RED)
    ctx.fill()
    for r in range(2):
        for k in range(3):
            ctx.rectangle(x - s * 0.34 + k * s * 0.25, y - s * 0.08 + r * s * 0.22, s * 0.16, s * 0.14)
            src(ctx, DIM)
            ctx.fill()


def clock_icon(ctx, x, y, r, t, a):
    circle(ctx, x, y, r)
    src(ctx, BG0, 0.9 * a)
    ctx.fill_preserve()
    src(ctx, STEEL, a)
    ctx.set_line_width(5)
    ctx.stroke()
    for ang, L, wd in ((t * 2.0, 0.75, 4), (t * 0.17, 0.5, 6)):
        ctx.move_to(x, y)
        ctx.line_to(x + r * L * math.sin(ang), y - r * L * math.cos(ang))
        src(ctx, WHITE, a)
        ctx.set_line_width(wd)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()


def tension_line(ctx, xa, ya, xb, yb, t, a, color=RED, amp=10):
    if a <= 0.001:
        return
    n = 40
    ctx.new_path()
    for k in range(n + 1):
        u = k / n
        x = lerp(xa, xb, u)
        yv = lerp(ya, yb, u)
        off = amp * math.sin(u * 22 + t * 14) * math.sin(u * math.pi)
        (ctx.move_to if k == 0 else ctx.line_to)(x, yv + off)
    src(ctx, color, 0.85 * a)
    ctx.set_line_width(4)
    ctx.stroke()


def scene_issues(ctx, lt, t):
    background(ctx, t)
    # faint grid
    src(ctx, GRID, 0.5)
    ctx.set_line_width(1)
    for gx in range(0, W, 80):
        ctx.move_to(gx, 0)
        ctx.line_to(gx, H)
    for gy in range(0, H, 80):
        ctx.move_to(0, gy)
        ctx.line_to(W, gy)
    ctx.stroke()

    t0 = 16.3
    ua = e_out(prog(t, t0, t0 + 0.6))
    fy = 210
    fl_x, fr_x = 300, W - 300
    flag_card(ctx, "usa", fl_x, fy, 200, lerp(0.8, 1.0, ua), ua, t)
    flag_card(ctx, "iran", fr_x, fy, 200, lerp(0.8, 1.0, ua), ua, t)
    tension_line(ctx, fl_x + 125, fy, fr_x - 125, fy, t, prog(t, EV["tensions"], EV["tensions"] + 0.6),
                 RED, 12 + 6 * math.sin(t * 2))

    cards = [("nuclear", 520, EV["nuclear"]), ("sanctions", 960, EV["sanctions"]), ("strait", 1400, EV["strait"])]
    cy = 640
    dis = prog(t, EV["disagree"], EV["disagree"] + 0.8)
    for kind, cx, tk in cards:
        if t < tk - 0.2:
            continue
        s = pop_scale(t, tk - 0.2, 0.5)
        uk = prog(t, tk - 0.2, tk + 0.1)
        jitter = 3 * dis * math.sin(t * 17 + cx)
        # connection lines to both flags once disagreement is spoken
        if dis > 0:
            for fx in (fl_x, fr_x):
                ctx.move_to(cx, cy - 150)
                ctx.line_to(fx, fy + 70)
                ctx.set_dash([10, 10], -t * 40)
                src(ctx, RED, 0.45 * dis)
                ctx.set_line_width(3)
                ctx.stroke()
                ctx.set_dash([])
        ring = mix(STEEL, RED, dis * (0.6 + 0.4 * math.sin(t * 5)))
        badge(ctx, cx + jitter, cy, 150, ring, s, uk, fill=hexc("#0E1D3A"))
        if dis > 0:
            caution_ring(ctx, cx + jitter, cy, 170, t, dis * 0.6, RED)
        with Push(ctx, cx + jitter, cy, s, uk):
            if kind == "nuclear":
                icon_atom(ctx, 0, 0, 200, AMBER, 1.0, t)
            elif kind == "sanctions":
                icon_sanctions(ctx, 0, 0, 220, hexc("#9AA9C4"), 1.0, t)
            else:
                icon_mini_strait(ctx, 0, 0, 290, 1.0, t)
    dust(ctx, t, 0.6)


def scene_forces(ctx, lt, t):
    background(ctx, t)
    ti = EV["imagine"]
    # iris open into the "what-if" space
    iris = e_io(prog(t, ti - 0.2, ti + 1.1))
    ctx.save()
    circle(ctx, W / 2, H / 2, 40 + iris * W)
    ctx.clip()
    # blueprint grid
    src(ctx, hexc("#0A1A36"))
    ctx.paint()
    src(ctx, hexc("#163261"), 0.55)
    ctx.set_line_width(1)
    off = (t * 12) % 60
    for gx in range(-60, W + 60, 60):
        ctx.move_to(gx + off, 0)
        ctx.line_to(gx + off, H)
    for gy in range(0, H, 60):
        ctx.move_to(0, gy)
        ctx.line_to(W, gy)
    ctx.stroke()
    # escalation: red pressure pulse from the edges
    ue = prog(t, EV["escalation"] - 0.3, EV["escalation"] + 0.8)
    if ue > 0:
        pulse = 0.5 + 0.5 * math.sin(t * 3.2)
        g = cairo.RadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7)
        g.add_color_stop_rgba(0, 0.9, 0.2, 0.2, 0)
        g.add_color_stop_rgba(1, 0.9, 0.2, 0.2, (0.18 + 0.12 * pulse) * ue)
        ctx.set_source(g)
        ctx.paint()

    # ---- left panel: US air & naval (illustrative)
    uL = e_out(prog(t, EV["us_forces"] - 0.3, EV["us_forces"] + 0.5))
    if uL > 0:
        px = lerp(-W * 0.5, 0, uL)
        with Push(ctx, px, 0, 1.0, uL) as c:
            rrect(c, 90, 150, 830, 800, 30)
            src(c, hexc("#0F2550"), 0.85)
            c.fill_preserve()
            src(c, US_HL, 0.8)
            c.set_line_width(3)
            c.stroke()
            flag_card(c, "usa", 505, 245, 150, 1.0, 1.0, t)
            # sea
            c.save()
            rrect(c, 90, 150, 830, 800, 30)
            c.clip()
            un = e_out(prog(t, EV["naval"] - 1.2, EV["naval"]))
            g = cairo.LinearGradient(0, 700, 0, 950)
            g.add_color_stop_rgba(0, 0.08, 0.25, 0.45, 0.9)
            g.add_color_stop_rgba(1, 0.03, 0.10, 0.22, 0.9)
            c.set_source(g)
            c.rectangle(90, 720, 830, 240)
            c.fill()
            for k in range(4):
                waves(c, 90, 920, 735 + k * 45, t + k, WHITE, 0.12, 5, 0.025, 1.6 + 0.3 * k)
            cx = lerp(1100, 505, un) + 8 * math.sin(t * 0.6)
            carrier(c, cx, 720 + 4 * math.sin(t * 1.3), 620, 1.0)
            # aircraft passing in loose formation (not toward anything)
            ua = prog(t, EV["air"] - 0.5, EV["air"] + 3.5)
            for k, (dx, dy) in enumerate(((0, 0), (-110, -60), (-110, 60))):
                fx = lerp(40, 1060, ((t - EV["air"] + 0.5) * 0.16 + k * 0.03) % 1.25)
                if ua <= 0:
                    break
                jet_top(c, fx + dx, 470 + dy + 10 * math.sin(t + k), 120, hexc("#C9D3E3"), 1.0)
            c.restore()

    # ---- right panel: Iran missiles, drones, shipping pressure (illustrative icons)
    uR = e_out(prog(t, EV["iran_side"] - 0.3, EV["iran_side"] + 0.5))
    if uR > 0:
        px = lerp(W * 0.5, 0, uR)
        with Push(ctx, px, 0, 1.0, uR) as c:
            rrect(c, 1000, 150, 830, 800, 30)
            src(c, hexc("#10301F"), 0.85)
            c.fill_preserve()
            src(c, IR_HL, 0.8)
            c.set_line_width(3)
            c.stroke()
            flag_card(c, "iran", 1415, 245, 150, 1.0, 1.0, t)
            # missiles (upright, static icons)
            for k in range(3):
                tk = EV["missiles"] - 0.35 + 0.15 * k
                sk = pop_scale(t, tk)
                if t < tk:
                    continue
                with Push(c, 1120 + k * 95, 620, sk):
                    missile_icon(c, 0, 0, 240, hexc("#D4DAE5"), 1.0)
            # drones hovering
            for k in range(2):
                tk = EV["drones"] - 0.2 + 0.18 * k
                if t < tk:
                    continue
                sk = pop_scale(t, tk)
                with Push(c, 1560 + k * 150, 440 + k * 90 + 10 * math.sin(t * 2 + k), sk, rot=-0.05):
                    drone_icon(c, 0, 0, 140, hexc("#C9D3E3"), 1.0)
            # shipping route under pressure
            us = prog(t, EV["shipping"] - 0.3, EV["shipping"] + 0.4)
            if us > 0:
                c.save()
                rrect(c, 1000, 150, 830, 800, 30)
                c.clip()
                g = cairo.LinearGradient(0, 760, 0, 950)
                g.add_color_stop_rgba(0, 0.06, 0.22, 0.38, 0.9 * us)
                g.add_color_stop_rgba(1, 0.03, 0.10, 0.22, 0.9 * us)
                c.set_source(g)
                c.rectangle(1000, 770, 830, 190)
                c.fill()
                for k in range(3):
                    waves(c, 1000, 1830, 785 + k * 45, t + k, WHITE, 0.12 * us, 5, 0.025, 1.8)
                c.set_dash([16, 12], -t * 60)
                c.move_to(1000, 830)
                c.line_to(1830, 830)
                src(c, CYAN, 0.5 * us)
                c.set_line_width(3)
                c.stroke()
                c.set_dash([])
                sx = 1415 + 30 * math.sin(t * 0.5)
                cargo_ship(c, sx, 800, 300, us)
                caution_ring(c, sx, 760, 150, t, us)
                c.restore()
    # divider
    if uL > 0 and uR > 0:
        ctx.move_to(W / 2 + 5, 190)
        ctx.line_to(W / 2 + 5, 910)
        ctx.set_dash([8, 10])
        src(ctx, STEEL, 0.35 * min(uL, uR))
        ctx.set_line_width(2)
        ctx.stroke()
        ctx.set_dash([])
    ctx.restore()
    # iris edge ring
    if iris < 1:
        circle(ctx, W / 2, H / 2, 40 + iris * W)
        src(ctx, AMBER, 0.6 * (1 - iris))
        ctx.set_line_width(6)
        ctx.stroke()
    if t < ti + 0.9:
        uq = prog(t, ti - 0.4, ti + 0.1) * (1 - prog(t, ti + 0.5, ti + 0.9))
        question_mark(ctx, W / 2, H / 2, AMBER, uq, 1.0, 1.3)
    scenario_frame(ctx, t, prog(t, ti + 0.4, ti + 1.2))
    dust(ctx, t, 0.6)


def scene_hormuz(ctx, lt, t):
    background(ctx, t)
    t0 = SCENES["hormuz"][0]
    # part A: balance scale + cracked trophy  (no easy victory)
    swap = EV["wider"] - 0.3
    ua = 1 - prog(t, swap, swap + 0.6)
    if ua > 0:
        with Push(ctx, 0, 0, 1.0, ua) as c:
            src(c, hexc("#0A1A36"))
            c.paint()
            wob = math.exp(-(max(0, t - t0)) * 1.4) * 0.22 * math.sin((t - t0) * 6.0)
            pans = scale_icon(c, W / 2, 380, 520, wob)
            # loads in pans
            (lx, ly), (rx, ry) = pans
            carrier(c, lx, ly - 40, 230, 1.0)
            for k in range(3):
                missile_icon(c, rx - 50 + k * 50, ry - 12, 110, hexc("#D4DAE5"), 1.0)
            flag_card(c, "usa", lx, ly + 150, 110, 1.0, 1.0, t)
            flag_card(c, "iran", rx, ry + 150, 110, 1.0, 1.0, t)
            cr = e_out(prog(t, EV["victory"], EV["victory"] + 0.5))
            trophy(c, W / 2, 210, 120, 1.0, cr)
    if ua < 1:
        ub = 1 - ua
        p = proj_hormuz()
        with Push(ctx, 0, 0, 1.0, ub) as c:
            z = lerp(1.06, 1.0, e_io(prog(t, swap, SCENES["hormuz"][1])))
            c.translate(W / 2, H / 2)
            c.scale(z, z)
            c.translate(-W / 2, -H / 2)
            src(c, SEA)
            c.paint()
            gulf_glow(c, p, 0.2, t)
            blit(c, "hz_land", 1.0)
            tint(c, "hl:hz:Iran", IR_HL, 0.35)
            ug = prog(t, EV["gulf"] - 0.6, EV["gulf"] + 0.3)
            for k, n in enumerate(GULF_STATES):
                pk = 0.5 + 0.5 * math.sin(t * 3 + k)
                tint(c, f"hl:hz:{n}", AMBER, (0.25 + 0.2 * pk) * ug)
                tint(c, f"edge:hz:{n}", AMBER, 0.6 * ug)
            # commercial shipping lane through the strait
            lane = [(51.0, 26.75), (53.5, 26.3), (55.2, 26.2), (56.0, 26.3), (56.45, 26.55),
                    (56.8, 26.25), (57.3, 25.4), (58.3, 24.75), (60.0, 24.1), (62.6, 23.6)]
            pts = [p(lo, la) for lo, la in lane]
            c.set_dash([18, 14], -t * 50)
            c.new_path()
            for k, (x, y) in enumerate(pts):
                (c.move_to if k == 0 else c.line_to)(x, y)
            src(c, CYAN, 0.55)
            c.set_line_width(4)
            c.stroke()
            c.set_dash([])
            # narrow point pulse
            nx, ny = p(56.4, 26.55)
            caution_ring(c, nx, ny, 70, t, 0.8, AMBER)
            # ships moving along the lane
            seglen = [math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1)]
            total = sum(seglen)
            for k in range(7):
                d = ((t - swap) * 70 + k * total / 7) % total
                for i, L in enumerate(seglen):
                    if d <= L:
                        u = d / L
                        x = lerp(pts[i][0], pts[i + 1][0], u)
                        y = lerp(pts[i][1], pts[i + 1][1], u)
                        ang = math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])
                        break
                    d -= L
                ship_top(c, x, y, 46, k, ang)
    scenario_frame(ctx, t, 1.0)
    dust(ctx, t, 0.6)


def ship_top(ctx, x, y, L, k, ang=0.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.move_to(L / 2, 0)
    ctx.line_to(L * 0.3, -L * 0.16)
    ctx.line_to(-L / 2, -L * 0.16)
    ctx.line_to(-L / 2, L * 0.16)
    ctx.line_to(L * 0.3, L * 0.16)
    ctx.close_path()
    src(ctx, WHITE, 0.95)
    ctx.fill()
    cols = [hexc("#2A9D8F"), hexc("#E9C46A"), hexc("#E76F51"), hexc("#4C7FD6")]
    for j in range(4):
        ctx.rectangle(-L * 0.4 + j * L * 0.17, -L * 0.1, L * 0.14, L * 0.2)
        src(ctx, cols[(j + k) % 4])
        ctx.fill()
    ctx.restore()
    glow_dot(ctx, x, y, 40, WHITE, 0.25)


def scene_economy(ctx, lt, t):
    background(ctx, t)
    src(ctx, hexc("#0A1A36"))
    ctx.paint()
    # trade: globe + container ship
    ut = e_out(prog(t, EV["trade"] - 0.2, EV["trade"] + 0.4))
    with Push(ctx, 360, 520, lerp(0.85, 1.0, ut), ut) as c:
        icon_globe(c, 0, -60, 170, CYAN, 1.0, t)
        cargo_ship(c, 40 * math.sin(t * 0.7), 250, 380, 1.0)
        waves(c, -260, 260, 262, t, WHITE, 0.25, 6)
    # oil barrels
    for k, (bx, by) in enumerate(((760, 820), (880, 820), (820, 690))):
        tk = EV["energy"] - 0.6 + 0.18 * k
        if t < tk:
            continue
        sk = pop_scale(t, tk)
        with Push(ctx, bx, by, sk):
            oil_barrel(ctx, 0, 0, 150)
    # price chart: axes, flat history, then dashed rising possible path inside an uncertainty cone
    uc = e_out(prog(t, EV["energy"] - 0.2, EV["energy"] + 0.4))
    if uc > 0:
        gx0, gy0, gw, gh = 1060, 260, 720, 560
        with Push(ctx, 0, 0, 1.0, uc) as c:
            rrect(c, gx0 - 50, gy0 - 50, gw + 100, gh + 110, 24)
            src(c, hexc("#0E1D3A"), 0.95)
            c.fill_preserve()
            src(c, LAND_EDGE)
            c.set_line_width(2)
            c.stroke()
            src(c, GRID)
            c.set_line_width(1.5)
            for k in range(1, 5):
                c.move_to(gx0, gy0 + gh * k / 5)
                c.line_to(gx0 + gw, gy0 + gh * k / 5)
            c.stroke()
            src(c, STEEL)
            c.set_line_width(4)
            c.move_to(gx0, gy0)
            c.line_to(gx0, gy0 + gh)
            c.line_to(gx0 + gw, gy0 + gh)
            c.stroke()
            # small oil-drop marker on the y axis
            c.move_to(gx0 - 26, gy0 + 8)
            c.curve_to(gx0 - 12, gy0 + 26, gx0 - 12, gy0 + 42, gx0 - 26, gy0 + 42)
            c.curve_to(gx0 - 40, gy0 + 42, gx0 - 40, gy0 + 26, gx0 - 26, gy0 + 8)
            src(c, AMBER)
            c.fill()
            hist = [0.30, 0.33, 0.29, 0.34, 0.31, 0.35, 0.33, 0.36]
            xs = [gx0 + gw * 0.5 * k / (len(hist) - 1) for k in range(len(hist))]
            ys = [gy0 + gh * (1 - v) for v in hist]
            uh = prog(t, EV["energy"] - 0.2, EV["energy"] + 0.6)
            n = max(2, int(len(xs) * uh))
            c.move_to(xs[0], ys[0])
            for k in range(1, n):
                c.line_to(xs[k], ys[k])
            src(c, STEEL)
            c.set_line_width(5)
            c.set_line_join(cairo.LINE_JOIN_ROUND)
            c.stroke()
            up = e_io(prog(t, EV["energy"] + 0.5, EV["energy"] + 2.1))
            if up > 0:
                xa, ya = xs[-1], ys[-1]
                xb = xa + gw * 0.48 * up
                hi = gy0 + gh * (1 - lerp(0.36, 0.95, up))
                lo = gy0 + gh * (1 - lerp(0.36, 0.48, up))
                mid = gy0 + gh * (1 - lerp(0.36, 0.78, up))
                c.move_to(xa, ya)
                c.curve_to(xa + (xb - xa) * 0.5, ya, xb - 60 * up, hi + 40, xb, hi)
                c.line_to(xb, lo)
                c.curve_to(xb - 60 * up, lo, xa + (xb - xa) * 0.5, ya, xa, ya)
                c.close_path()
                src(c, ORANGE, 0.18)
                c.fill()
                c.move_to(xa, ya)
                c.curve_to(xa + (xb - xa) * 0.5, ya, xb - 60 * up, mid + 30, xb, mid)
                c.set_dash([16, 12])
                src(c, ORANGE)
                c.set_line_width(6)
                c.stroke()
                c.set_dash([])
                # up arrow
                c.save()
                c.translate(xb, mid - 50)
                c.move_to(0, -30)
                c.line_to(22, 6)
                c.line_to(-22, 6)
                c.close_path()
                src(c, ORANGE, up)
                c.fill()
                c.restore()
    scenario_frame(ctx, t, 1.0)
    dust(ctx, t, 0.6)


_world_cache = {}


def world_dist():
    if "d" in _world_cache:
        return _world_cache["d"]
    pw = proj_world()
    gx, gy = pw(53, 27)
    out = []
    for name, rings in geo.load("110m").items():
        cx, cy = geo.centroid(rings)
        x, y = pw(cx, cy)
        out.append((name, math.hypot(x - gx, y - gy)))
    _world_cache["d"] = (out, (gx, gy))
    return _world_cache["d"]


def scene_spread(ctx, lt, t):
    background(ctx, t)
    tq = EV["question"]
    ts = EV["spread"]
    # part A: weapon stacks (who has more?) that dim away
    ua = 1 - prog(t, ts - 0.4, ts + 0.3)
    if ua > 0:
        with Push(ctx, 0, 0, 1.0, ua) as c:
            src(c, hexc("#0A1A36"))
            c.paint()
            dimu = prog(t, EV["weapons"] + 0.3, EV["weapons"] + 1.0)
            flag_card(c, "usa", 640, 190, 150, 1.0, 1.0, t)
            flag_card(c, "iran", 1280, 190, 150, 1.0, 1.0, t)
            items = [("jet", 640), ("carrier", 640), ("missile", 1280), ("drone", 1280)]
            for k in range(4):
                for side, bx in ((0, 640), (1, 1280)):
                    tk = tq + 0.2 + 0.22 * k + 0.1 * side
                    if t < tk:
                        continue
                    s = pop_scale(t, tk, 0.35)
                    yy = 900 - k * 140 + 60 * dimu
                    col = mix(US_HL if side == 0 else IR_HL, DIM, dimu)
                    with Push(c, bx, yy, s, 1 - 0.55 * dimu):
                        rrect(c, -170, -60, 340, 120, 20)
                        src(c, mix(col, BG0, 0.55))
                        c.fill_preserve()
                        src(c, col)
                        c.set_line_width(3)
                        c.stroke()
                        if side == 0:
                            if k % 2 == 0:
                                jet_top(c, 0, 0, 110, hexc("#D9E1EE"))
                            else:
                                carrier(c, 0, 18, 220)
                        else:
                            if k % 2 == 0:
                                for j in range(3):
                                    missile_icon(c, -50 + j * 50, 50, 100, hexc("#D9E1EE"))
                            else:
                                drone_icon(c, 0, 0, 100, hexc("#D9E1EE"))
            # balance-of-weapons is not the point: a soft grey veil + a dashed "≠" between stacks
            if dimu > 0:
                for dy in (-14, 14):
                    c.move_to(W / 2 - 50, 600 + dy)
                    c.line_to(W / 2 + 50, 600 + dy)
                c.move_to(W / 2 + 26, 560)
                c.line_to(W / 2 - 26, 640)
                src(c, STEEL, dimu)
                c.set_line_width(8)
                c.set_line_cap(cairo.LINE_CAP_ROUND)
                c.stroke()
    # part B: world map with ripples spreading from the Gulf; countries light up as rings pass
    if ua < 1:
        ub = 1 - ua
        dist, (gx, gy) = world_dist()
        R = max(0.0, (t - ts) * 330)
        with Push(ctx, 0, 0, 1.0, ub) as c:
            z = lerp(1.25, 1.0, e_io(prog(t, ts - 0.4, ts + 1.8)))
            c.translate(gx, gy)
            c.scale(z, z)
            c.translate(-gx, -gy)
            src(c, SEA)
            c.paint()
            blit(c, "world_land", 1.0)
            for name, d in dist:
                if d < R:
                    u = clamp((R - d) / 260)
                    col = mix(RED, AMBER, clamp(d / 900))
                    tint(c, f"hl:world:{name}", col, 0.55 * u * (1 - 0.35 * clamp(d / 1400)))
            for k in range(5):
                rr = R - k * 180
                if rr <= 0:
                    continue
                circle(c, gx, gy, rr)
                src(c, AMBER, 0.55 * max(0, 1 - rr / 1700))
                c.set_line_width(4)
                c.stroke()
            glow_dot(c, gx, gy, 120, RED, 0.9)
            circle(c, gx, gy, 10)
            src(c, WHITE)
            c.fill()
    dust(ctx, t, 0.6)


def scene_diplomacy(ctx, lt, t):
    background(ctx, t)
    t0 = SCENES["diplomacy"][0]
    # warm spotlight on the table
    g = cairo.RadialGradient(W / 2, 640, 50, W / 2, 640, 820)
    g.add_color_stop_rgba(0, 0.95, 0.85, 0.6, 0.18)
    g.add_color_stop_rgba(1, 0.95, 0.85, 0.6, 0)
    ctx.set_source(g)
    ctx.paint()
    ut = e_out(prog(t, t0, t0 + 0.9))
    with Push(ctx, 0, 60 * (1 - ut), 1.0, ut) as c:
        # chairs
        for sgn in (-1, 1):
            cx = W / 2 + sgn * 470
            rrect(c, cx - 70, 560, 140, 230, 26)
            src(c, hexc("#2C3B5C"))
            c.fill()
            rrect(c, cx - 90, 760, 180, 40, 14)
            src(c, hexc("#33456B"))
            c.fill()
        # table
        rrect(c, W / 2 - 600, 780, 1200, 46, 14)
        src(c, WOOD_L)
        c.fill()
        c.rectangle(W / 2 - 560, 826, 1120, 30)
        src(c, WOOD)
        c.fill()
        for sgn in (-1, 1):
            c.rectangle(W / 2 + sgn * 520 - 18, 850, 36, 200)
            src(c, WOOD)
            c.fill()
        # documents + pen
        for k, dx in enumerate((-150, 40)):
            c.save()
            c.translate(W / 2 + dx, 772)
            c.rotate(-0.04 + 0.06 * k)
            rrect(c, -80, -12, 160, 12, 3)
            src(c, hexc("#F1F4F9"))
            c.fill()
            c.restore()
        # table flags
        uf = prog(t, EV["diplomacy"] - 0.3, EV["diplomacy"] + 0.3)
        for sgn, which in ((-1, "usa"), (1, "iran")):
            fx = W / 2 + sgn * 300
            c.move_to(fx, 780)
            c.line_to(fx, 640)
            src(c, STEEL, uf)
            c.set_line_width(5)
            c.stroke()
            flag_card(c, which, fx + 52 * 1, 668, 100, pop_scale(t, EV["diplomacy"] - 0.3), uf, t)
        # olive branch between the flags
        ub = prog(t, EV["diplomacy"], EV["diplomacy"] + 0.8)
        if ub > 0:
            olive_branch(c, W / 2, 735, 120, ub)
    # question mark draws on, then floats and breathes
    uq = prog(t, EV["qmark"], EV["qmark"] + 1.4)
    if uq > 0:
        fl = math.sin((t - EV["qmark"]) * 1.6) * 8
        br = 1 + 0.03 * math.sin((t - EV["qmark"]) * 2.4)
        glow_dot(ctx, W / 2, 330 + fl, 260, AMBER, 0.5 * uq)
        question_mark(ctx, W / 2, 330 + fl, AMBER, 1.0, e_io(uq), 1.65 * br, 30)
    dust(ctx, t, 0.8)
    # fade to black at the end
    fo = prog(t, DURATION - 1.0, DURATION - 0.1)
    if fo > 0:
        ctx.set_source_rgba(0, 0, 0, fo)
        ctx.paint()


def olive_branch(ctx, x, y, L, u):
    ctx.save()
    ctx.translate(x, y)
    ctx.move_to(-L / 2, 0)
    ctx.curve_to(-L / 4, -L * 0.12, L / 4, -L * 0.12, -L / 2 + L * u, -L * 0.04 * u)
    src(ctx, hexc("#6A8F3A"))
    ctx.set_line_width(5)
    ctx.stroke()
    for k in range(7):
        uk = k / 6
        if uk > u:
            break
        px = -L / 2 + L * uk
        py = -L * 0.09 * math.sin(uk * math.pi)
        for sgn in (-1, 1):
            ctx.save()
            ctx.translate(px, py)
            ctx.rotate(sgn * 0.8 - 0.3)
            ctx.scale(1, 0.42)
            circle(ctx, 14, 0, 14)
            ctx.restore()
            src(ctx, hexc("#8DBF4E"))
            ctx.fill()
    ctx.restore()


DRAW = {
    "hook": scene_hook, "timeline": scene_timeline, "issues": scene_issues, "forces": scene_forces,
    "hormuz": scene_hormuz, "economy": scene_economy, "spread": scene_spread, "diplomacy": scene_diplomacy,
}


def render_frame(t):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    src(ctx, BG0)
    ctx.paint()
    active = []
    for name in ORDER:
        a, b = SCENES[name]
        if a - XF / 2 <= t < b + XF / 2 or (name == ORDER[-1] and t >= a):
            active.append(name)
    for name in active:
        a, b = SCENES[name]
        alpha = 1.0
        if name != ORDER[0]:
            alpha = min(alpha, e_io(prog(t, a - XF / 2, a + XF / 2)))
        if name != ORDER[-1]:
            alpha = min(alpha, 1 - e_io(prog(t, b - XF / 2, b + XF / 2)))
        if alpha <= 0.001:
            continue
        # slight push-in during the crossfade for a smoother move
        s = 1.0 + 0.025 * (1 - alpha)
        with Push(ctx, W / 2, H / 2, s, alpha) as c:
            c.translate(-W / 2, -H / 2)
            DRAW[name](c, t - a, t)
    vignette(ctx)
    if t < 0.6:
        ctx.set_source_rgba(0, 0, 0, 1 - t / 0.6)
        ctx.paint()
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
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
           "-t", f"{DURATION:.3f}", OUT_FILE]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(args.workers) as pool:
        for k, data in enumerate(pool.imap(frame_bytes, range(n), chunksize=6)):
            proc.stdin.write(data)
            if k % 300 == 0:
                print(f"frame {k}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", OUT_FILE)


if __name__ == "__main__":
    main()

"""Render "Britain Wants Back Into the EU — Is Brexit Losing Public Support?" — 1080x1920, 30 fps, flat 2D (cairo).

On-screen text rule: no words at all (no titles, captions, labels, names, logos). The only glyphs drawn are
the numbers the narrator says: 56, 30, 63, 34, 73, 39 and 49. Everything else is maps, flags, charts,
illustrated people and buildings. Key elements stay inside a central safe area (x 90..990, y 200..1650).

    python3 src/render.py                   # full video -> output/Britain_Rejoin_EU_vertical.mp4
    python3 src/render.py --stills 3,15,30  # PNG previews -> output/stills/
"""
import argparse
import math
import os
import random
import subprocess
from multiprocessing import Pool

import cairo

import geo
from timeline import DURATION, EV, FPS, H, ORDER, SCENES, W, XF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "output")
OUT_FILE = os.path.join(OUT_DIR, "Britain_Rejoin_EU_vertical.mp4")
AUDIO = os.path.join(ROOT, "audio", "final_mix.wav")
TAU = 2 * math.pi
F_NUM = "Inter Display Black"


# ================================================================= basics
def hexc(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


BG0 = hexc("#050A17")
BG1 = hexc("#0E1B36")
SEA0 = hexc("#07122A")
LAND = hexc("#1C2A45")
LAND_EDGE = hexc("#31446A")
WHITE = hexc("#FFFFFF")
MUTED = hexc("#8A9BBB")
STEEL = hexc("#B8C4D9")
DIM = hexc("#3A4B6C")
UK_RED = hexc("#E0283E")
UK_RED_L = hexc("#FF5A6B")
EU_BLUE = hexc("#2463EB")
EU_BLUE_L = hexc("#5B8CFF")
EU_FLAG = hexc("#003399")
GOLD = hexc("#FFCC00")
AMBER = hexc("#F5A524")
UJ_BLUE = hexc("#012169")
UJ_RED = hexc("#C8102E")
STONE = hexc("#C9A86A")
STONE_D = hexc("#9C7E48")
STONE_L = hexc("#E2C88E")
WINDOW = hexc("#FFD98A")


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
    r = max(0.0, min(r, w / 2, h / 2))
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -TAU / 4, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, TAU / 4)
    ctx.arc(x + r, y + h - r, r, TAU / 4, TAU / 2)
    ctx.arc(x + r, y + r, r, TAU / 2, 3 * TAU / 4)
    ctx.close_path()


def circle(ctx, x, y, r):
    ctx.new_sub_path()
    ctx.arc(x, y, r, 0, TAU)


def ellipse(ctx, x, y, rx, ry):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(rx, ry)
    ctx.new_sub_path()
    ctx.arc(0, 0, 1, 0, TAU)
    ctx.restore()


def glow_dot(ctx, x, y, r, c, a=1.0):
    if a <= 0.001:
        return
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


def number(ctx, value, x, y, size, color=WHITE, a=1.0, glow=None):
    """Digits only, centred on (x, y) by their ink box."""
    if a <= 0.001:
        return
    s = str(value)
    ctx.select_font_face(F_NUM, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)
    ex = ctx.text_extents(s)
    x0 = x - ex.width / 2 - ex.x_bearing
    y0 = y - ex.height / 2 - ex.y_bearing
    if glow:
        glow_dot(ctx, x, y, size * 1.1, glow, 0.6 * a)
    ctx.move_to(x0 + 4, y0 + 6)
    ctx.text_path(s)
    ctx.set_source_rgba(0, 0, 0, 0.35 * a)
    ctx.fill()
    ctx.move_to(x0, y0)
    ctx.text_path(s)
    src(ctx, color, a)
    ctx.fill()


# ================================================================= background
def background(ctx, tint=None, ta=0.0, cy=H * 0.45):
    g = cairo.RadialGradient(W * 0.5, cy, 80, W * 0.5, cy, H * 0.75)
    c1 = mix(BG1, tint, ta) if tint else BG1
    g.add_color_stop_rgba(0, *c1[:3], 1)
    g.add_color_stop_rgba(1, *BG0[:3], 1)
    ctx.set_source(g)
    ctx.paint()


def grid(ctx, a=0.06, step=90, off=0.0):
    src(ctx, STEEL, a)
    ctx.set_line_width(1)
    x = -(off % step)
    while x < W:
        ctx.move_to(x, 0)
        ctx.line_to(x, H)
        x += step
    y = -(off * 0.5 % step)
    while y < H:
        ctx.move_to(0, y)
        ctx.line_to(W, y)
        y += step
    ctx.stroke()


_DUST = [(random.Random(k).random(), random.Random(k + 999).random(), random.Random(k + 77).random())
         for k in range(60)]


def dust(ctx, t, a=1.0):
    for k, (u, v, w) in enumerate(_DUST):
        x = (u * W + t * (8 + 14 * w)) % W
        y = (v * H - t * (12 + 20 * w)) % H
        r = 1.2 + 2.2 * w
        src(ctx, STEEL, a * (0.10 + 0.18 * w) * (0.6 + 0.4 * math.sin(t * 1.3 + k)))
        circle(ctx, x, y, r)
        ctx.fill()


def vignette(ctx):
    g = cairo.RadialGradient(W / 2, H / 2, W * 0.45, W / 2, H / 2, H * 0.62)
    g.add_color_stop_rgba(0, 0, 0, 0, 0)
    g.add_color_stop_rgba(1, 0, 0, 0, 0.6)
    ctx.set_source(g)
    ctx.paint()


# ================================================================= emblems / flags
def star(ctx, x, y, r, rot=-math.pi / 2):
    ctx.new_sub_path()
    for k in range(10):
        rr = r if k % 2 == 0 else r * 0.40
        ang = rot + k * TAU / 10
        px, py = x + rr * math.cos(ang), y + rr * math.sin(ang)
        if k == 0:
            ctx.move_to(px, py)
        else:
            ctx.line_to(px, py)
    ctx.close_path()


def star_ring(ctx, x, y, R, rs, color=GOLD, a=1.0, n_on=12.0, rot=0.0):
    for k in range(12):
        u = clamp(n_on - k)
        if u <= 0:
            continue
        ang = -math.pi / 2 + k * TAU / 12 + rot
        s = e_back(u) if u < 1 else 1.0
        star(ctx, x + R * math.cos(ang), y + R * math.sin(ang), rs * s)
        src(ctx, color, a * min(1, u * 1.5))
        ctx.fill()


def eu_badge(ctx, x, y, r, a=1.0, t=0.0):
    if a <= 0.001:
        return
    glow_dot(ctx, x, y, r * 1.8, EU_BLUE, 0.6 * a)
    circle(ctx, x, y, r)
    src(ctx, EU_FLAG, a)
    ctx.fill()
    star_ring(ctx, x, y, r * 0.66, r * 0.13, GOLD, a, rot=t * 0.15)
    circle(ctx, x, y, r)
    src(ctx, WHITE, 0.25 * a)
    ctx.set_line_width(3)
    ctx.stroke()


def union_flag(ctx, x, y, w, h):
    """Simplified Union Flag in the box (x, y, w, h) (caller clips if needed)."""
    ctx.save()
    ctx.rectangle(x, y, w, h)
    ctx.clip()
    src(ctx, UJ_BLUE)
    ctx.paint()
    d = math.hypot(w, h)
    cx, cy = x + w / 2, y + h / 2
    ang = math.atan2(h, w)
    for sgn in (1, -1):
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(sgn * ang)
        ctx.rectangle(-d / 2, -h * 0.10, d, h * 0.20)
        src(ctx, WHITE)
        ctx.fill()
        ctx.rectangle(-d / 2, -h * 0.035, d, h * 0.07)
        src(ctx, UJ_RED)
        ctx.fill()
        ctx.restore()
    ctx.rectangle(x, cy - h * 0.17, w, h * 0.34)
    ctx.rectangle(cx - h * 0.17, y, h * 0.34, h)
    src(ctx, WHITE)
    ctx.fill()
    ctx.rectangle(x, cy - h * 0.10, w, h * 0.20)
    ctx.rectangle(cx - h * 0.10, y, h * 0.20, h)
    src(ctx, UJ_RED)
    ctx.fill()
    ctx.restore()


def uk_badge(ctx, x, y, r, a=1.0):
    if a <= 0.001:
        return
    glow_dot(ctx, x, y, r * 1.8, UK_RED, 0.55 * a)
    with Push(ctx, alpha=a) as c:
        c.save()
        circle(c, x, y, r)
        c.clip()
        union_flag(c, x - r * 1.5, y - r, r * 3, r * 2)
        c.restore()
        circle(c, x, y, r)
        src(c, WHITE, 0.35)
        c.set_line_width(3)
        c.stroke()


# ================================================================= maps
P_EU = geo.Proj(-26, 46, 33, 72, 0, 485, W, coslat=52)
P_UK = geo.Proj(-7, 11, 42, 60, 0, 0, W, coslat=52)
P_UK.y0 = 960 - (60 - 51.5) * P_UK.s     # London sits at screen centre height
LONDON = (-0.1276, 51.5072)
BRUSSELS = (4.3517, 50.8503)

_maps = {}


def _simplify(pts, tol):
    out = [pts[0]]
    for p in pts[1:]:
        if abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) > tol:
            out.append(p)
    return out


def map_data(proj, bbox, tol):
    key = (id(proj), bbox)
    if key in _maps:
        return _maps[key]
    lon0, lon1, lat0, lat1 = bbox
    world = geo.load("50m")
    out = []
    for name, rings in world.items():
        cls = "uk" if name == "United Kingdom" else ("eu" if name in geo.EU27 else "other")
        prj = []
        for r in rings:
            lons = [p[0] for p in r]
            lats = [p[1] for p in r]
            if max(lons) < lon0 or min(lons) > lon1 or max(lats) < lat0 or min(lats) > lat1:
                continue
            pts = _simplify([proj(lon, lat) for lon, lat in r], tol)
            if len(pts) >= 3:
                prj.append(pts)
        if prj:
            out.append((name, cls, prj))
    _maps[key] = out
    return out


def rings_path(ctx, rings, dx=0.0, dy=0.0):
    for r in rings:
        ctx.move_to(r[0][0] + dx, r[0][1] + dy)
        for x, y in r[1:]:
            ctx.line_to(x + dx, y + dy)
        ctx.close_path()


EU_MAP = None
UK_CENTRE = P_EU(-2.3, 54.0)
EU_CENTRE = P_EU(13.0, 49.0)
UK_AWAY = (-24.0, -42.0)     # world-px offset when the UK has fully "drifted away"


def eu_order():
    """EU countries sorted by distance from the UK, for a staggered reveal."""
    data = map_data(P_EU, (-32, 52, 28, 75), 0.5)
    eus = [(n, geo.centroid(geo.load("50m")[n])) for n, c, _ in data if c == "eu"]
    eus.sort(key=lambda kv: math.hypot(kv[1][0] + 2, kv[1][1] - 54))
    return {n: k / max(1, len(eus) - 1) for k, (n, _) in enumerate(eus)}


_EU_RANK = None


def europe_map(ctx, cx, cy, z, uk_f, eu_u, t, uk_glow=1.0, ghost=1.0, stars=0.0, star_rot=0.0, road=0.0):
    """Vector Europe map. Camera centres world point (cx, cy) at screen centre with zoom z.
    uk_f: 0..1 fraction of UK_AWAY offset; eu_u: 0..1 reveal progress of the EU blue fill."""
    global _EU_RANK
    if _EU_RANK is None:
        _EU_RANK = eu_order()
    data = map_data(P_EU, (-32, 52, 28, 75), 0.5)
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(z, z)
    ctx.translate(-cx, -cy)
    lw = 1.3 / z
    # sea glow around Europe
    g = cairo.RadialGradient(EU_CENTRE[0], EU_CENTRE[1], 50, EU_CENTRE[0], EU_CENTRE[1], 900)
    g.add_color_stop_rgba(0, *EU_BLUE[:3], 0.10 * eu_u)
    g.add_color_stop_rgba(1, *EU_BLUE[:3], 0.0)
    ctx.set_source(g)
    ctx.paint()
    # neutral land
    for name, cls, rings in data:
        if cls == "other":
            rings_path(ctx, rings)
    src(ctx, LAND)
    ctx.fill_preserve()
    src(ctx, LAND_EDGE)
    ctx.set_line_width(lw)
    ctx.stroke()
    # EU members, staggered reveal by distance from the UK
    for name, cls, rings in data:
        if cls != "eu":
            continue
        u = e_io(clamp((eu_u - 0.6 * _EU_RANK[name]) / 0.4))
        rings_path(ctx, rings)
        src(ctx, mix(LAND, EU_BLUE, u))
        ctx.fill_preserve()
        src(ctx, mix(LAND_EDGE, EU_BLUE_L, u))
        ctx.set_line_width(lw)
        ctx.stroke()
    # EU star ring around the continent
    if stars > 0:
        star_ring(ctx, EU_CENTRE[0], EU_CENTRE[1] - 10, 330, 16, GOLD, 0.8 * clamp(stars), n_on=stars * 12,
                  rot=star_rot)
    uk = [r for n, c, r in data if c == "uk"][0]
    dx, dy = UK_AWAY[0] * uk_f, UK_AWAY[1] * uk_f
    # ghost of the UK's original place
    if uk_f > 0.03 and ghost > 0:
        rings_path(ctx, uk)
        ctx.set_dash([6 / z, 6 / z])
        src(ctx, UK_RED_L, 0.45 * ghost * clamp(uk_f * 3))
        ctx.set_line_width(1.6 / z)
        ctx.stroke()
        ctx.set_dash([])
    # road back: dotted path of light from the UK towards the continent (never touching it)
    if road > 0:
        ax, ay = UK_CENTRE[0] + 30 + dx, UK_CENTRE[1] + 50 + dy
        bx, by = P_EU(2.6, 50.6)
        ex, ey = lerp(ax, bx, 0.9 * road), lerp(ay, by, 0.9 * road)

        def p():
            ctx.move_to(ax, ay)
            ctx.line_to(ex, ey)
        ctx.set_dash([5 / z, 7 / z], -t * 30 / z)
        glow_stroke(ctx, p, GOLD, 2.6 / z, 0.85, layers=3)
        ctx.set_dash([])
        glow_dot(ctx, ex, ey, 26 / z, GOLD, 0.9)
    # the UK: red, glowing
    for k in range(4, 0, -1):
        rings_path(ctx, uk, dx, dy)
        src(ctx, UK_RED, 0.09 * uk_glow)
        ctx.set_line_width((4 + 7 * k) / z)
        ctx.stroke()
    rings_path(ctx, uk, dx, dy)
    src(ctx, UK_RED)
    ctx.fill_preserve()
    src(ctx, UK_RED_L)
    ctx.set_line_width(1.6 / z)
    ctx.stroke()
    ctx.restore()


_uk_layers = {}


def uk_map_layer(mode):
    """Cached static map of the UK + near continent (P_UK). mode: 'base'."""
    if mode in _uk_layers:
        return _uk_layers[mode]
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    c = cairo.Context(surf)
    data = map_data(P_UK, (-14, 20, 40, 64), 0.6)
    for name, cls, rings in data:
        rings_path(c, rings)
        src(c, {"uk": UK_RED, "eu": mix(LAND, EU_BLUE, 0.85), "other": LAND}[cls])
        c.fill_preserve()
        src(c, {"uk": UK_RED_L, "eu": EU_BLUE_L, "other": LAND_EDGE}[cls], 0.8)
        c.set_line_width(1.6)
        c.stroke()
    _uk_layers[mode] = surf
    return surf


def pin(ctx, x, y, color, a=1.0, s=1.0):
    if a <= 0.001:
        return
    glow_dot(ctx, x, y, 60 * s, color, a)
    circle(ctx, x, y, 14 * s)
    src(ctx, WHITE, a)
    ctx.fill()
    circle(ctx, x, y, 8 * s)
    src(ctx, color, a)
    ctx.fill()


# ================================================================= people
SKINS = [hexc("#F1C7A5"), hexc("#C98E62"), hexc("#8D5A3B"), hexc("#E8B48E"), hexc("#5C3A26"), hexc("#F5D3B8")]


def person(ctx, x, ground, h, st, t, a=1.0, sat=1.0):
    """Flat 2D standing adult. st: dict(skin, hair, hair_c, top, legs, glasses, older, beard, phase, wave)."""
    if a <= 0.001:
        return
    ph = st.get("phase", 0.0)
    breath = 1 + 0.012 * math.sin(t * 2.2 + ph)
    sway = math.sin(t * 1.1 + ph) * 0.02
    s = h / 400.0
    with Push(ctx, x, ground, s, a, sway * 0.4) as c:
        def col(cc):
            g = (cc[0] + cc[1] + cc[2]) / 3
            return mix((g, g, g, cc[3]), cc, sat)
        stoop = 8 if st.get("older") else 0
        # shadow
        ellipse(c, 0, 0, 78, 12)
        c.set_source_rgba(0, 0, 0, 0.3)
        c.fill()
        # legs
        src(c, col(st["legs"]))
        rrect(c, -36, -170, 32, 170, 12)
        rrect(c, 4, -170, 32, 170, 12)
        c.fill()
        src(c, col(hexc("#1A1F2B")))
        rrect(c, -42, -14, 42, 16, 7)
        rrect(c, 2, -14, 42, 16, 7)
        c.fill()
        # torso (with breathing)
        c.save()
        c.translate(0, -165)
        c.scale(1, breath)
        top = col(st["top"])
        src(c, top)
        c.move_to(-58, 0)
        c.line_to(-62 + stoop * 0.3, -125)
        c.curve_to(-60, -150, -30, -158, 0 + stoop, -158)
        c.curve_to(30, -158, 60, -150, 62, -125)
        c.line_to(58, 0)
        c.close_path()
        c.fill()
        if st.get("cardigan"):
            src(c, mix(top, WHITE, 0.25))
            c.rectangle(-4, -150, 8, 150)
            c.fill()
            for k in range(4):
                circle(c, 9, -130 + 34 * k, 4)
            src(c, mix(top, (0, 0, 0, 1), 0.35))
            c.fill()
        if st.get("hood"):
            src(c, mix(top, (0, 0, 0, 1), 0.25))
            c.move_to(-34, -152)
            c.curve_to(-30, -120, 30, -120, 34, -152)
            c.set_line_width(10)
            c.stroke()
        # arms
        wave = st.get("wave", 0.0)
        for sgn in (-1, 1):
            ang = sgn * (0.16 + 0.04 * math.sin(t * 1.7 + ph + sgn))
            if sgn == 1 and wave > 0:
                ang = -2.5 * wave + 0.25 * wave * math.sin(t * 7)
            c.save()
            c.translate(sgn * 56, -140)
            c.rotate(ang)
            src(c, mix(top, (0, 0, 0, 1), 0.12))
            rrect(c, -15, 0, 30, 118, 14)
            c.fill()
            src(c, col(st["skin"]))
            circle(c, 0, 124, 15)
            c.fill()
            c.restore()
        c.restore()
        # neck + head
        hy = -165 * breath - 158 - 52
        hx = stoop * 0.6
        src(c, col(st["skin"]))
        c.rectangle(hx - 13, hy + 30, 26, 34)
        c.fill()
        hair_c = col(st["hair_c"])
        hair = st["hair"]
        if hair in ("long",):
            src(c, hair_c)
            for sgn in (-1, 1):
                rrect(c, hx + sgn * 40 - 17, hy - 30, 34, 106, 16)
            c.fill()
        if hair == "bun":
            src(c, hair_c)
            circle(c, hx + 6, hy - 62, 24)
            c.fill()
        ellipse(c, hx, hy, 46, 54)
        src(c, col(st["skin"]))
        c.fill()
        # ears
        for sgn in (-1, 1):
            ellipse(c, hx + sgn * 46, hy + 4, 8, 12)
            c.fill()
        # hair styles
        src(c, hair_c)
        if hair in ("short", "long", "bun", "side"):
            c.move_to(hx - 48, hy + 2)
            c.curve_to(hx - 52, hy - 60, hx + 52, hy - 66, hx + 48, hy - 2)
            c.curve_to(hx + 30, hy - 30, hx - 10, hy - 34, hx - 48, hy + 2)
            c.fill()
        elif hair == "curly":
            for k in range(9):
                ang = math.pi + k * math.pi / 8
                circle(c, hx + 44 * math.cos(ang), hy - 8 + 46 * math.sin(ang), 19)
            c.fill()
        elif hair == "bald":
            for sgn in (-1, 1):
                ellipse(c, hx + sgn * 42, hy - 6, 10, 20)
            c.fill()
        elif hair == "cap":
            c.move_to(hx - 50, hy - 18)
            c.curve_to(hx - 46, hy - 66, hx + 46, hy - 66, hx + 52, hy - 18)
            c.line_to(hx + 66, hy - 14)
            c.line_to(hx - 50, hy - 14)
            c.close_path()
            c.fill()
        elif hair == "puff":
            for k in range(7):
                ang = math.pi * 1.05 + k * math.pi * 0.9 / 6
                circle(c, hx + 40 * math.cos(ang), hy - 14 + 40 * math.sin(ang), 24)
            c.fill()
        # face
        blink = 0.15 if ((t + ph * 1.7) % 3.7) < 0.12 else 1.0
        src(c, hexc("#1B1B22"))
        for sgn in (-1, 1):
            ellipse(c, hx + sgn * 17, hy + 2, 5.2, 6.5 * blink)
        c.fill()
        src(c, mix(hair_c, (0, 0, 0, 1), 0.2))
        c.set_line_width(4)
        for sgn in (-1, 1):
            c.move_to(hx + sgn * 9, hy - 14)
            c.line_to(hx + sgn * 26, hy - 16 + (2 if st.get("older") else 0))
        c.stroke()
        if st.get("glasses"):
            src(c, hexc("#2A2A33"))
            c.set_line_width(3)
            for sgn in (-1, 1):
                circle(c, hx + sgn * 17, hy + 2, 12)
            c.stroke()
            c.move_to(hx - 5, hy + 1)
            c.line_to(hx + 5, hy + 1)
            c.stroke()
        if st.get("beard"):
            src(c, hair_c)
            c.move_to(hx - 40, hy + 10)
            c.curve_to(hx - 36, hy + 62, hx + 36, hy + 62, hx + 40, hy + 10)
            c.curve_to(hx + 20, hy + 34, hx - 20, hy + 34, hx - 40, hy + 10)
            c.fill()
        if st.get("moustache"):
            src(c, hair_c)
            ellipse(c, hx, hy + 22, 16, 6)
            c.fill()
        smile = st.get("smile", 0.6)
        src(c, hexc("#7A2E2E"))
        c.set_line_width(3.5)
        c.move_to(hx - 12, hy + 30)
        c.curve_to(hx - 5, hy + 30 + 7 * smile, hx + 5, hy + 30 + 7 * smile, hx + 12, hy + 30)
        c.stroke()
        if st.get("older"):
            src(c, mix(col(st["skin"]), (0, 0, 0, 1), 0.18))
            c.set_line_width(1.8)
            for sgn in (-1, 1):
                c.move_to(hx + sgn * 30, hy + 4)
                c.line_to(hx + sgn * 34, hy + 10)
            c.stroke()
        if st.get("phones"):
            src(c, hexc("#22262F"))
            c.set_line_width(7)
            c.arc(hx, hy - 4, 52, math.pi * 1.05, math.pi * 1.95)
            c.stroke()
            for sgn in (-1, 1):
                rrect(c, hx + sgn * 50 - 10, hy - 8, 20, 30, 8)
            c.fill()


YOUNG = [
    dict(skin=SKINS[0], hair="long", hair_c=hexc("#3B2A20"), top=hexc("#F2B705"), legs=hexc("#2D4E8A"), phase=0.3,
         hood=True, smile=0.9),
    dict(skin=SKINS[2], hair="curly", hair_c=hexc("#17120E"), top=hexc("#14B8A6"), legs=hexc("#2A2E3A"), phase=1.4,
         phones=True, smile=0.8),
    dict(skin=SKINS[3], hair="bun", hair_c=hexc("#8B3A1E"), top=hexc("#E5484D"), legs=hexc("#3A3F55"), phase=2.2,
         smile=1.0),
    dict(skin=SKINS[1], hair="short", hair_c=hexc("#22160F"), top=hexc("#7C5CFF"), legs=hexc("#25324A"), phase=3.1,
         beard=True, smile=0.7),
]
OLDER = [
    dict(skin=SKINS[5], hair="bald", hair_c=hexc("#D6D6D6"), top=hexc("#7A5634"), legs=hexc("#4B4F5C"), phase=0.8,
         glasses=True, older=True, cardigan=True, smile=0.2),
    dict(skin=SKINS[3], hair="puff", hair_c=hexc("#EDEDED"), top=hexc("#7B4B94"), legs=hexc("#3C3F4D"), phase=1.9,
         older=True, glasses=True, smile=0.35),
    dict(skin=SKINS[1], hair="cap", hair_c=hexc("#5B5F6B"), top=hexc("#5F6B5A"), legs=hexc("#2F3340"), phase=2.7,
         older=True, moustache=True, smile=0.15),
    dict(skin=SKINS[0], hair="side", hair_c=hexc("#BFC3C9"), top=hexc("#2F5D7C"), legs=hexc("#3A3D49"), phase=3.6,
         older=True, smile=0.3, cardigan=True),
]


def bust(ctx, x, y, s, st, a=1.0):
    """Head-and-shoulders voter for the crowd shot."""
    if a <= 0.001:
        return
    with Push(ctx, x, y, s, a) as c:
        src(c, st["top"])
        c.move_to(-70, 90)
        c.curve_to(-70, 20, -40, 0, 0, 0)
        c.curve_to(40, 0, 70, 20, 70, 90)
        c.close_path()
        c.fill()
        src(c, st["skin"])
        ellipse(c, 0, -40, 34, 40)
        c.fill()
        src(c, st["hair_c"])
        c.move_to(-35, -36)
        c.curve_to(-38, -92, 38, -96, 35, -36)
        c.curve_to(20, -60, -10, -62, -35, -36)
        c.fill()


# ================================================================= icons / buildings
def clipboard(ctx, x, y, s, a=1.0, u=1.0):
    if a <= 0.001:
        return
    with Push(ctx, x, y, s, a) as c:
        rrect(c, -70, -90, 140, 180, 14)
        src(c, hexc("#E8EDF5"))
        c.fill()
        rrect(c, -30, -102, 60, 26, 8)
        src(c, STEEL)
        c.fill()
        for k in range(3):
            yy = -40 + 44 * k
            rrect(c, -48, yy - 12, 24, 24, 5)
            src(c, DIM)
            c.set_line_width(4)
            c.stroke()
            rrect(c, -10, yy - 5, 62, 10, 5)
            src(c, MUTED)
            c.fill()
            if u > k / 3:
                c.move_to(-44, yy)
                c.line_to(-37, yy + 8)
                c.line_to(-22, yy - 14)
                src(c, EU_BLUE if k != 1 else UK_RED)
                c.set_line_width(6)
                c.stroke()


def ballot_box(ctx, x, y, s, a=1.0, glow=0.0):
    if a <= 0.001:
        return
    with Push(ctx, x, y, s, a) as c:
        if glow > 0:
            glow_dot(c, 0, -40, 320, GOLD, 0.5 * glow)
        # body
        src(c, hexc("#1F2A44"))
        c.move_to(-180, -110)
        c.line_to(180, -110)
        c.line_to(160, 150)
        c.line_to(-160, 150)
        c.close_path()
        c.fill()
        # lid
        src(c, hexc("#2C3B5E"))
        c.move_to(-200, -150)
        c.line_to(200, -150)
        c.line_to(180, -110)
        c.line_to(-180, -110)
        c.close_path()
        c.fill()
        rrect(c, -110, -142, 220, 22, 8)
        src(c, hexc("#0A0F1C"))
        c.fill()
        # seal
        circle(c, 0, 20, 46)
        src(c, GOLD, 0.9)
        c.set_line_width(5)
        c.stroke()
        circle(c, 0, 20, 30)
        src(c, GOLD, 0.35)
        c.fill()
        # edge light
        src(c, WHITE, 0.08)
        c.move_to(-180, -110)
        c.line_to(-160, 150)
        c.set_line_width(6)
        c.stroke()


def ballot_paper(ctx, x, y, s, a=1.0, rot=0.0, mark=1.0, fold=0.0):
    if a <= 0.001:
        return
    with Push(ctx, x, y, s, a, rot) as c:
        c.scale(1, 1 - 0.5 * fold)
        rrect(c, -120, -160, 240, 320, 8)
        src(c, hexc("#F7F5EE"))
        c.fill()
        rrect(c, -120, -160, 240, 34, 8)
        src(c, hexc("#C9CCD6"))
        c.fill()
        for k in range(3):
            yy = -90 + 80 * k
            rrect(c, -95, yy - 6, 120, 12, 6)
            src(c, hexc("#B7BCC8"))
            c.fill()
            c.rectangle(52, yy - 26, 50, 50)
            src(c, hexc("#1E2433"))
            c.set_line_width(4)
            c.stroke()
        if mark > 0:
            yy = -10
            m = clamp(mark * 2)
            m2 = clamp(mark * 2 - 1)
            src(c, hexc("#1E2433"))
            c.set_line_width(7)
            c.set_line_cap(cairo.LINE_CAP_ROUND)
            c.move_to(60, yy - 18)
            c.line_to(lerp(60, 94, m), lerp(yy - 18, yy + 18, m))
            if m2 > 0:
                c.move_to(94, yy - 18)
                c.line_to(lerp(94, 60, m2), lerp(yy - 18, yy + 18, m2))
            c.stroke()
            c.set_line_cap(cairo.LINE_CAP_BUTT)


def hourglass(ctx, x, y, s, t, a=1.0):
    if a <= 0.001:
        return
    with Push(ctx, x, y, s, a) as c:
        src(c, STONE_L)
        rrect(c, -60, -100, 120, 14, 6)
        rrect(c, -60, 86, 120, 14, 6)
        c.fill()
        c.move_to(-46, -86)
        c.line_to(46, -86)
        c.curve_to(46, -30, 8, -16, 8, 0)
        c.curve_to(8, 16, 46, 30, 46, 86)
        c.line_to(-46, 86)
        c.curve_to(-46, 30, -8, 16, -8, 0)
        c.curve_to(-8, -16, -46, -30, -46, -86)
        c.close_path()
        src(c, WHITE, 0.10)
        c.fill_preserve()
        src(c, STEEL, 0.8)
        c.set_line_width(4)
        c.stroke()
        u = (t * 0.12) % 1.0
        src(c, GOLD, 0.9)
        top_h = 60 * (1 - u)
        c.move_to(-30 * (1 - u) - 6, -16 - top_h * 0.2)
        c.line_to(30 * (1 - u) + 6, -16 - top_h * 0.2)
        c.line_to(0, -8)
        c.close_path()
        c.fill()
        c.move_to(-40, 84)
        c.line_to(40, 84)
        c.line_to(0, 84 - 50 * u - 6)
        c.close_path()
        c.fill()
        c.rectangle(-1.5, -8, 3, 92)
        c.fill()


def no_entry(ctx, x, y, r, a=1.0):
    if a <= 0.001:
        return
    glow_dot(ctx, x, y, r * 2.0, UK_RED, 0.7 * a)
    circle(ctx, x, y, r)
    src(ctx, UK_RED, a)
    ctx.fill()
    rrect(ctx, x - r * 0.62, y - r * 0.17, r * 1.24, r * 0.34, r * 0.08)
    src(ctx, WHITE, a)
    ctx.fill()


def elizabeth_tower(ctx, x, base, s, a=1.0, t=0.0):
    with Push(ctx, x, base, s, a) as c:
        src(c, STONE_D)
        c.rectangle(-46, -560, 92, 560)
        c.fill()
        src(c, STONE)
        c.rectangle(-40, -560, 80, 560)
        c.fill()
        src(c, STONE_D)
        for k in range(9):
            c.rectangle(-28, -520 + 56 * k, 10, 34)
            c.rectangle(18, -520 + 56 * k, 10, 34)
        c.fill()
        # clock stage
        src(c, STONE_L)
        c.rectangle(-58, -720, 116, 160)
        c.fill()
        circle(c, 0, -640, 44)
        src(c, hexc("#FFF4D6"))
        c.fill()
        circle(c, 0, -640, 44)
        src(c, hexc("#3A2F1E"))
        c.set_line_width(4)
        c.stroke()
        for k in range(12):
            ang = k * TAU / 12
            c.move_to(36 * math.cos(ang), -640 + 36 * math.sin(ang))
            c.line_to(41 * math.cos(ang), -640 + 41 * math.sin(ang))
        c.set_line_width(3)
        c.stroke()
        hand = -math.pi / 2 + t * 0.6
        c.move_to(0, -640)
        c.line_to(30 * math.cos(hand), -640 + 30 * math.sin(hand))
        c.move_to(0, -640)
        c.line_to(20 * math.cos(hand / 12 + 1), -640 + 20 * math.sin(hand / 12 + 1))
        c.set_line_width(4)
        c.stroke()
        # belfry + spire
        src(c, STONE)
        c.rectangle(-48, -800, 96, 80)
        c.fill()
        src(c, hexc("#2A3550"))
        for k in range(3):
            rrect(c, -36 + 26 * k, -790, 16, 56, 8)
        c.fill()
        src(c, hexc("#3B4A6B"))
        c.move_to(-56, -800)
        c.line_to(0, -960)
        c.line_to(56, -800)
        c.close_path()
        c.fill()
        src(c, GOLD)
        c.move_to(0, -960)
        c.line_to(0, -1010)
        c.set_line_width(5)
        c.stroke()


def parliament(ctx, x, base, s, a=1.0, t=0.0):
    """Palace of Westminster: long gothic facade, Victoria Tower (left), Elizabeth Tower (right)."""
    if a <= 0.001:
        return
    with Push(ctx, x, base, s, a) as c:
        # Victoria tower
        src(c, STONE_D)
        c.rectangle(-470, -560, 150, 560)
        c.fill()
        src(c, STONE)
        c.rectangle(-462, -560, 134, 560)
        c.fill()
        for k in range(4):
            src(c, STONE_L)
            c.move_to(-470 + 50 * k, -560)
            c.line_to(-458 + 50 * k, -620)
            c.line_to(-446 + 50 * k, -560)
            c.fill()
        src(c, WINDOW, 0.75)
        for k in range(5):
            rrect(c, -430, -520 + 95 * k, 22, 60, 11)
            rrect(c, -380, -520 + 95 * k, 22, 60, 11)
        c.fill()
        # main facade
        src(c, STONE_D)
        c.rectangle(-330, -300, 650, 300)
        c.fill()
        src(c, STONE)
        c.rectangle(-330, -290, 650, 290)
        c.fill()
        for k in range(14):
            px = -320 + 46 * k
            src(c, STONE_L)
            c.rectangle(px, -330, 8, 40)
            c.move_to(px - 4, -330)
            c.line_to(px + 4, -362)
            c.line_to(px + 12, -330)
            c.fill()
            flick = 0.65 + 0.2 * math.sin(t * 2 + k * 1.7)
            src(c, WINDOW, flick)
            rrect(c, px + 14, -250, 18, 54, 9)
            rrect(c, px + 14, -150, 18, 54, 9)
            c.fill()
        src(c, STONE_D)
        c.rectangle(-330, -70, 650, 10)
        c.fill()
        # central lantern spire
        src(c, STONE_L)
        c.rectangle(-30, -420, 60, 120)
        c.fill()
        src(c, hexc("#3B4A6B"))
        c.move_to(-36, -420)
        c.line_to(0, -520)
        c.line_to(36, -420)
        c.close_path()
        c.fill()
    elizabeth_tower(ctx, x + 400 * s, base, s * 0.95, a, t)


def timeline_bar(ctx, y, t, u, a=1.0, hold=0.0, eu=0.0):
    """Horizontal arrow into the future; the near segment (this Parliament) is closed off."""
    if a <= 0.001:
        return
    x0, x1 = 110, 970
    xe = lerp(x0, x1, e_out(u))
    src(ctx, STEEL, 0.85 * a)
    ctx.set_line_width(6)
    ctx.move_to(x0, y)
    ctx.line_to(xe, y)
    ctx.stroke()
    if u > 0.95:
        ctx.move_to(x1 + 20, y)
        ctx.line_to(x1 - 14, y - 22)
        ctx.line_to(x1 - 14, y + 22)
        ctx.close_path()
        src(ctx, STEEL, a)
        ctx.fill()
    # ticks scrolling toward the past = time moving forward
    off = (t * 60) % 86
    xx = x0 + 86 - off
    while xx < xe - 10:
        ctx.move_to(xx, y - 14)
        ctx.line_to(xx, y + 14)
        xx += 86
    src(ctx, STEEL, 0.6 * a)
    ctx.set_line_width(3)
    ctx.stroke()
    # now marker
    circle(ctx, x0, y, 14)
    src(ctx, WHITE, a)
    ctx.fill()
    # this-Parliament bracket (closed)
    if hold > 0:
        hx1 = lerp(x0, 520, e_out(hold))
        rrect(ctx, x0, y - 34, hx1 - x0, 68, 34)
        src(ctx, UK_RED, 0.30 * a)
        ctx.fill_preserve()
        src(ctx, UK_RED_L, 0.9 * a)
        ctx.set_line_width(3)
        ctx.stroke()
        if hold > 0.6:
            no_entry(ctx, (x0 + 520) / 2 + 30, y - 110, 44, a * clamp((hold - 0.6) / 0.4))
    # EU badge waiting further in the future
    if eu > 0:
        ex = 820
        ctx.set_dash([10, 10], -t * 20)
        ctx.move_to(540, y)
        ctx.curve_to(620, y - 150, 740, y - 170, ex, y - 150)
        src(ctx, EU_BLUE_L, 0.7 * a * eu)
        ctx.set_line_width(4)
        ctx.stroke()
        ctx.set_dash([])
        eu_badge(ctx, ex, y - 150, 56, a * eu, t)


# ================================================================= portrait (editorial illustration)
def portrait_pm(ctx, cx, cy, s, t, a=1.0):
    """Stylised editorial illustration of the Prime Minister: dark side-parted hair greying at the
    temples, strong dark eyebrows, dark suit, white shirt, tie. No desk, microphone or studio."""
    if a <= 0.001:
        return
    with Push(ctx, cx, cy, s, a) as c:
        skin = hexc("#EAC0A0")
        skin_d = hexc("#D3A383")
        hair = hexc("#2B2420")
        grey = hexc("#7D7873")
        # frame
        circle(c, 0, 0, 330)
        g = cairo.LinearGradient(0, -330, 0, 330)
        g.add_color_stop_rgba(0, *hexc("#24365E")[:3], 1)
        g.add_color_stop_rgba(1, *hexc("#0E1830")[:3], 1)
        c.set_source(g)
        c.fill()
        c.save()
        circle(c, 0, 0, 330)
        c.clip()
        # faint union-flag sweep behind
        c.save()
        c.translate(0, -40)
        c.rotate(-0.12)
        c.push_group()
        union_flag(c, -420, -260, 840, 420)
        c.pop_group_to_source()
        c.paint_with_alpha(0.10)
        c.restore()
        tilt = 0.025 * math.sin(t * 0.9)
        c.save()
        c.rotate(tilt * 0.3)
        # suit shoulders
        src(c, hexc("#1A2233"))
        c.move_to(-300, 340)
        c.curve_to(-290, 200, -200, 150, -95, 140)
        c.line_to(95, 140)
        c.curve_to(200, 150, 290, 200, 300, 340)
        c.close_path()
        c.fill()
        # shirt + tie
        src(c, hexc("#F3F5F9"))
        c.move_to(-70, 140)
        c.line_to(0, 260)
        c.line_to(70, 140)
        c.close_path()
        c.fill()
        src(c, hexc("#8E1B2C"))
        c.move_to(-16, 160)
        c.line_to(16, 160)
        c.line_to(26, 300)
        c.line_to(0, 330)
        c.line_to(-26, 300)
        c.close_path()
        c.fill()
        rrect(c, -20, 140, 40, 26, 6)
        c.fill()
        # lapels
        src(c, hexc("#121827"))
        for sgn in (-1, 1):
            c.move_to(sgn * 70, 140)
            c.line_to(sgn * 12, 290)
            c.line_to(sgn * 120, 200)
            c.close_path()
            c.fill()
        # neck
        src(c, skin_d)
        c.rectangle(-48, 60, 96, 95)
        c.fill()
        c.restore()
        c.save()
        c.translate(0, -60)
        c.rotate(tilt)
        # ears
        src(c, skin_d)
        for sgn in (-1, 1):
            ellipse(c, sgn * 112, 10, 20, 34)
        c.fill()
        # head (slightly long oval, defined jaw)
        src(c, skin)
        c.move_to(-110, -40)
        c.curve_to(-112, -170, 112, -170, 110, -40)
        c.curve_to(112, 60, 80, 130, 0, 142)
        c.curve_to(-80, 130, -112, 60, -110, -40)
        c.fill()
        # cheek shading
        src(c, skin_d, 0.5)
        for sgn in (-1, 1):
            ellipse(c, sgn * 70, 50, 26, 40)
        c.fill()
        # hair: dark, short, side parting, greying temples
        src(c, hair)
        c.move_to(-116, -20)
        c.curve_to(-130, -150, -40, -190, 30, -178)
        c.curve_to(100, -170, 132, -110, 116, -20)
        c.curve_to(104, -80, 70, -112, 20, -118)
        c.line_to(-30, -126)
        c.curve_to(-70, -112, -100, -80, -116, -20)
        c.close_path()
        c.fill()
        src(c, grey, 0.85)
        for sgn in (-1, 1):
            c.move_to(sgn * 116, -20)
            c.curve_to(sgn * 118, -50, sgn * 108, -76, sgn * 96, -88)
            c.line_to(sgn * 104, -36)
            c.close_path()
            c.fill()
        src(c, hexc("#14100E"), 0.6)
        c.set_line_width(4)
        c.move_to(-30, -126)
        c.curve_to(-10, -150, 20, -165, 40, -172)
        c.stroke()
        # eyebrows (strong, dark)
        src(c, hexc("#1A1411"))
        for sgn in (-1, 1):
            c.move_to(sgn * 18, -36)
            c.curve_to(sgn * 40, -50, sgn * 66, -50, sgn * 84, -38)
            c.curve_to(sgn * 66, -42, sgn * 40, -40, sgn * 18, -28)
            c.close_path()
            c.fill()
        # eyes
        blink = 0.12 if (t % 4.1) < 0.12 else 1.0
        for sgn in (-1, 1):
            ellipse(c, sgn * 50, -10, 18, 10 * blink)
            src(c, WHITE)
            c.fill()
            if blink > 0.5:
                circle(c, sgn * 50 + 1, -10, 8)
                src(c, hexc("#4A3426"))
                c.fill()
                circle(c, sgn * 50 + 1, -10, 3.5)
                src(c, hexc("#111111"))
                c.fill()
        # nose
        src(c, skin_d)
        c.move_to(-4, -6)
        c.curve_to(-8, 30, -22, 44, -12, 52)
        c.curve_to(-4, 58, 12, 56, 18, 50)
        c.set_line_width(4)
        c.stroke()
        # mouth: closed, slight warm smile
        src(c, hexc("#9C5A4E"))
        c.set_line_width(5)
        c.move_to(-36, 86)
        c.curve_to(-14, 98, 14, 98, 36, 86)
        c.stroke()
        c.restore()
        c.restore()
        circle(c, 0, 0, 330)
        src(c, WHITE, 0.25)
        c.set_line_width(5)
        c.stroke()


# ================================================================= scenes
def scene_hook(ctx, lt, t):
    background(ctx)
    grid(ctx, 0.04, off=t * 6)
    zu = e_io(prog(t, 0.2, 5.0))
    z = lerp(3.3, 1.12, zu)
    cx = lerp(UK_CENTRE[0], 540, zu)
    cy = lerp(UK_CENTRE[1], 960, zu)
    # dramatic push-in on the question
    pu = e_io(prog(t, EV["question"] - 0.2, EV["q_end"] + 0.3))
    z *= 1 + 0.14 * pu
    cx = lerp(cx, 470, pu)
    cy = lerp(cy, 930, pu)
    away = e_io(prog(t, EV["leave"] + 0.6, EV["leave_end"] + 0.3))
    back = e_io(prog(t, EV["back_inside"] - 0.5, EV["eu_union"] + 0.6))
    uk_f = away * (1 - 0.42 * back)
    eu_u = prog(t, 1.4, 5.2)
    stars = clamp((t - EV["eu_union"]) / 1.2) if t > EV["eu_union"] else 0.0
    pulse = 1 + 0.25 * math.sin(t * 3.2)
    europe_map(ctx, cx, cy, z, uk_f, eu_u, t, uk_glow=pulse, stars=stars, star_rot=t * 0.03)
    dust(ctx, t, 0.7)


def bar(ctx, x, base, w, hpx, color, light, a):
    if hpx <= 1 or a <= 0.001:
        return
    g = cairo.LinearGradient(0, base - hpx, 0, base)
    g.add_color_stop_rgba(0, *light[:3], a)
    g.add_color_stop_rgba(1, *color[:3], a)
    rrect(ctx, x - w / 2, base - hpx, w, hpx, 22)
    ctx.set_source(g)
    ctx.fill()
    rrect(ctx, x - w / 2, base - hpx, w, min(hpx, 26), 13)
    src(ctx, WHITE, 0.12 * a)
    ctx.fill()


def chart(ctx, t, base, vals, times, a, icon):
    """Two-bar comparison (blue = rejoin, red = stay out); bars and digits count up from zero."""
    if a <= 0.001:
        return
    PX = 10.5   # px per percentage point
    xs = (330, 750)
    # baseline
    src(ctx, STEEL, 0.5 * a)
    ctx.set_line_width(4)
    ctx.move_to(130, base)
    ctx.line_to(950, base)
    ctx.stroke()
    for k, (x, v, t0) in enumerate(zip(xs, vals, times)):
        u = e_out(prog(t, t0 - 0.35, t0 + 0.75))
        col, lig = (EU_BLUE, EU_BLUE_L) if k == 0 else (UK_RED, UK_RED_L)
        # ghost track
        rrect(ctx, x - 130, base - 100 * PX * 0.70, 260, 100 * PX * 0.70, 22)
        src(ctx, WHITE, 0.035 * a)
        ctx.fill()
        bar(ctx, x, base, 260, v * PX * u, col, lig, a)
        if u > 0.02:
            number(ctx, int(round(v * u)), x, base - v * PX * u - 95, 150, WHITE, a * clamp(u * 3), glow=col)
        if k == 0:
            eu_badge(ctx, x, base + 95, 58, a * clamp(u * 3 + 0.4), t)
        else:
            uk_badge(ctx, x, base + 95, 58, a * clamp(u * 3 + 0.4))
    icon(ctx, a)


def scene_poll(ctx, lt, t):
    background(ctx, EU_BLUE, 0.12)
    grid(ctx, 0.05, off=t * 10)
    sw = e_io(prog(t, EV["likely"] - 0.35, EV["likely"] + 0.55))
    dy1 = -1250 * sw
    dy2 = 1250 * (1 - sw)
    if sw < 1:
        with Push(ctx, 0, dy1, 1.0, 1 - sw * 0.8) as c:
            chart(c, t, 1380, (56, 30), (EV["n56"], EV["n30"]), 1.0,
                  lambda cc, a: clipboard(cc, 540, 330, 1.0 * pop_scale(t, EV["poll"] - 0.2), a,
                                          prog(t, EV["poll"], EV["n30"] + 0.5)))
    if sw > 0:
        def icon2(cc, a):
            for k in range(5):
                st = (YOUNG + OLDER)[k * 2 % 8]
                bust(cc, 300 + 120 * k, 340 + (k % 2) * 10, 0.62 * pop_scale(t, EV["likely"] + 0.08 * k), st, a)
            # tick badge
            tu = pop_scale(t, EV["likely"] + 0.6)
            circle(cc, 820, 250, 40 * tu)
            src(cc, EU_BLUE_L, a)
            cc.fill()
            cc.move_to(800, 250)
            cc.line_to(815, 266)
            cc.line_to(842, 234)
            src(cc, WHITE, a * clamp(tu))
            cc.set_line_width(8)
            cc.stroke()
        with Push(ctx, 0, dy2, 1.0, min(1, sw * 1.4)) as c:
            chart(c, t, 1380, (63, 34), (EV["n63"], EV["n34"]), 1.0, icon2)
    dust(ctx, t, 0.6)


def ring(ctx, x, y, r, frac, color, a, val, t0, t):
    if a <= 0.001:
        return
    u = e_out(prog(t, t0 - 0.3, t0 + 0.9))
    circle(ctx, x, y, r)
    src(ctx, BG0, 0.7 * a)
    ctx.fill()
    ctx.new_path()
    ctx.arc(x, y, r, 0, TAU)
    src(ctx, WHITE, 0.10 * a)
    ctx.set_line_width(26)
    ctx.stroke()
    if u > 0:
        ctx.new_path()
        ctx.arc(x, y, r, -math.pi / 2, -math.pi / 2 + TAU * frac * u)
        glow_stroke(ctx, lambda: (ctx.new_path(), ctx.arc(x, y, r, -math.pi / 2, -math.pi / 2 + TAU * frac * u)),
                    color, 26, a, layers=3)
        number(ctx, int(round(val * u)), x, y, 128, WHITE, a * clamp(u * 3))


def scene_generation(ctx, lt, t):
    background(ctx)
    # halves
    top_t = mix(BG1, EU_BLUE, 0.22)
    bot_t = mix(BG1, AMBER, 0.10)
    split = e_io(prog(t, EV["divide"] - 0.1, EV["divide"] + 0.8))
    g = cairo.LinearGradient(0, 0, 0, 960)
    g.add_color_stop_rgba(0, *BG0[:3], 0)
    g.add_color_stop_rgba(1, *top_t[:3], 0.9 * split)
    ctx.set_source(g)
    ctx.rectangle(0, 0, W, 960)
    ctx.fill()
    g = cairo.LinearGradient(0, 960, 0, H)
    g.add_color_stop_rgba(0, *bot_t[:3], 0.9 * split)
    g.add_color_stop_rgba(1, *BG0[:3], 0)
    ctx.set_source(g)
    ctx.rectangle(0, 960, W, 960)
    ctx.fill()
    # divider
    def dl():
        ctx.move_to(W / 2 - 520 * split, 960)
        ctx.line_to(W / 2 + 520 * split, 960)
    glow_stroke(ctx, dl, STEEL, 3, 0.8 * split, layers=3)
    dust(ctx, t, 0.5)
    # top: younger adults
    yin = e_out(prog(t, EV["divide"] + 0.2, EV["divide"] + 1.1))
    yhi = prog(t, EV["young"] - 0.3, EV["young"] + 0.3)
    old_on = prog(t, EV["old"] - 0.3, EV["old"] + 0.3)
    ysat = 1.0 - 0.35 * old_on * (1 - yhi * 0)
    xs = (170, 300, 430, 560)
    for k, st in enumerate(YOUNG):
        dx = -500 * (1 - e_out(clamp(yin * 1.6 - k * 0.15)))
        st = dict(st, wave=e_io(prog(t, EV["n73"] + 0.1, EV["n73"] + 0.6)) * (1 - prog(t, EV["old"] - 0.2, EV["old"] + 0.4)) if k == 2 else 0.0)
        person(ctx, xs[k] + dx + (k % 2) * 6, 900 - (k % 2) * 22, 380 + (k % 2) * 14, st, t, yin, ysat)
    ring(ctx, 815, 560, 140, 0.73, EU_BLUE_L, clamp(yin * 1.5) * (1 - 0.3 * old_on), 73, EV["n73"], t)
    # bottom: older adults
    oin = e_out(prog(t, EV["divide"] + 0.6, EV["divide"] + 1.5))
    osat = lerp(0.55, 1.0, old_on)
    xs2 = (560, 430, 300, 170)
    for k, st in enumerate(OLDER):
        dx = 600 * (1 - e_out(clamp(oin * 1.6 - k * 0.15)))
        person(ctx, xs2[k] + dx, 1620 - (k % 2) * 22, 370 + (k % 2) * 12, st, t + 0.7, oin * lerp(0.7, 1, old_on), osat)
    ring(ctx, 815, 1290, 140, 0.39, EU_BLUE_L, clamp(oin * 1.5) * lerp(0.5, 1, old_on), 39, EV["n39"], t)


def scene_politics(ctx, lt, t):
    background(ctx, UJ_BLUE, 0.3)
    grid(ctx, 0.04, off=t * 8)
    # --- beat A: portrait
    a_out = e_io(prog(t, EV["ruled_out"] - 0.15, EV["ruled_out"] + 0.45))
    if a_out < 1:
        pin_s = lerp(0.9, 1.0, e_out(prog(t, EV["pm"] - 0.3, EV["pm"] + 0.8)))
        push = 1 + 0.04 * prog(t, EV["pm"], EV["ruled_out"])
        # faint skyline behind
        parliament(ctx, 470, 1700, 0.5, 0.12 * (1 - a_out), t)
        portrait_pm(ctx, 540, 820 - 60 * a_out, 0.98 * pin_s * push, t, 1 - a_out)
        hu = e_out(prog(t, EV["lifetime"] - 0.4, EV["lifetime"] + 0.3))
        if hu > 0:
            hourglass(ctx, 360, 1340, 0.85 * hu, t - EV["lifetime"], (1 - a_out) * hu)
            ctx.set_dash([10, 10], -t * 20)
            ctx.move_to(440, 1340)
            ctx.curve_to(520, 1300, 600, 1300, 680, 1320)
            src(ctx, EU_BLUE_L, 0.7 * hu * (1 - a_out))
            ctx.set_line_width(4)
            ctx.stroke()
            ctx.set_dash([])
            eu_badge(ctx, 740, 1330, 58, hu * (1 - a_out), t)
    # --- beat B: Westminster -> Brussels
    b_in = e_io(prog(t, EV["ruled_out"] - 0.15, EV["ruled_out"] + 0.45))
    b_out = e_io(prog(t, EV["parliament"] - 0.3, EV["parliament"] + 0.3))
    ba = b_in * (1 - b_out)
    if ba > 0.001:
        with Push(ctx, 0, 0, 1.0, ba) as c:
            c.set_source_surface(uk_map_layer("base"), 0, 0)
            c.paint()
            lx, ly = P_UK(*LONDON)
            bx, by = P_UK(*BRUSSELS)
            ru = e_io(prog(t, EV["route"] - 0.1, EV["route"] + 0.8))
            ex, ey = lerp(lx, bx, ru), lerp(ly, by, ru) - math.sin(ru * math.pi) * 0

            def rp():
                c.move_to(lx, ly)
                c.curve_to(lerp(lx, bx, 0.33), ly - 70, lerp(lx, bx, 0.66), by - 70, bx, by)
            if ru > 0:
                c.save()
                c.rectangle(0, 0, ex + 2, H)
                c.clip()
                glow_stroke(c, rp, GOLD, 5, 0.95, layers=4)
                c.restore()
            pin(c, lx, ly, UK_RED, 1.0, 1.2)
            elizabeth_tower(c, lx - 70, ly - 30, 0.22, 1.0, t)
            pin(c, bx, by, EU_BLUE_L, clamp(ru * 3), 1.2)
            eu_badge(c, bx + 90, by - 150, 52, clamp(ru * 2), t)
            bu = pop_scale(t, EV["route"] + 0.9, 0.4)
            if t > EV["route"] + 0.9:
                mx, my = (lx + bx) / 2, (ly + by) / 2 - 52
                no_entry(c, mx, my, 46 * bu, 1.0)
    # --- beat C: Parliament + timeline into the future
    c_in = e_io(prog(t, EV["parliament"] - 0.3, EV["parliament"] + 0.3))
    if c_in > 0.001:
        with Push(ctx, 0, 60 * (1 - c_in), 1.0, c_in) as c:
            glow_dot(c, 540, 700, 600, WINDOW, 0.18)
            parliament(c, 480, 1000, 0.82, 1.0, t)
            src(c, STONE_D, 0.6)
            c.rectangle(80, 1000, 920, 8)
            c.fill()
            tu = prog(t, EV["parliament"] - 0.1, EV["parliament"] + 0.6)
            hold = prog(t, EV["parliament"] + 0.2, EV["parliament"] + 1.0)
            eu = prog(t, EV["parliament"] + 0.8, EV["pm_end"] + 0.3)
            timeline_bar(c, 1330, t, tu, 1.0, hold, eu)
    dust(ctx, t, 0.5)


VOTERS = YOUNG + OLDER


def scene_referendum(ctx, lt, t):
    background(ctx, GOLD, 0.06)
    grid(ctx, 0.04, off=t * 8)
    # --- beat A: ballot into box
    a_out = e_io(prog(t, EV["voters"] - 0.35, EV["voters"] + 0.25))
    if a_out < 1:
        z = lerp(1.15, 1.0, e_out(prog(t, EV["ballot"] - 0.3, EV["voters"])))
        with Push(ctx, 540, 1000, z * (1 + 0.1 * a_out), 1 - a_out) as c:
            drop = e_io(prog(t, EV["ballot"] + 0.2, EV["ballot"] + 1.25))
            mark = prog(t, EV["ballot"] - 0.2, EV["ballot"] + 0.3)
            fold = prog(t, EV["ballot"] + 0.15, EV["ballot"] + 0.45)
            box_glow = prog(t, EV["ballot"] + 1.1, EV["ballot"] + 1.4) * (1 - prog(t, EV["ballot"] + 1.4, EV["voters"]))
            # paper behind lid when inside
            py = lerp(-560, -150, drop)
            c.save()
            c.rectangle(-400, -1100, 800, 1100 - 150 + 12)
            c.clip()
            ballot_paper(c, 0, py, 0.95, 1.0, lerp(-0.1, 0, fold), mark, fold * 0.9)
            c.restore()
            ballot_box(c, 0, 120, 1.25, 1.0, box_glow)
    # --- beat B: voters + 49
    b_in = e_io(prog(t, EV["voters"] - 0.35, EV["voters"] + 0.25))
    b_out = e_io(prog(t, EV["not_guaranteed"] - 0.3, EV["not_guaranteed"] + 0.35))
    ba = b_in * (1 - b_out)
    if ba > 0.001:
        with Push(ctx, 0, 0, 1.0, ba) as c:
            rows = [(1230, 0.80, 7), (1380, 0.92, 6), (1540, 1.05, 5)]
            for r, (yy, sc, n) in enumerate(rows):
                for k in range(n):
                    st = VOTERS[(k * 3 + r * 5) % 8]
                    x = 540 + (k - (n - 1) / 2) * (150 * sc + 4)
                    rise = e_out(clamp(b_in * 1.6 - 0.12 * r - 0.04 * k))
                    bob = math.sin(t * 2 + k + r) * 3
                    bust(c, x, yy + 60 * (1 - rise) + bob, sc, st, rise)
                    # raised ballot papers on "referendum"
                    if (k + r) % 3 == 0:
                        pu = pop_scale(t, EV["referendum"] + 0.06 * (k + r), 0.4)
                        if t > EV["referendum"] + 0.06 * (k + r):
                            ballot_paper(c, x + 46 * sc, yy - 120 * sc, 0.22 * sc * pu, 1.0, 0.15, 1.0)
            ring(c, 540, 760, 200, 0.49, GOLD, 1.0, 49, EV["n49"], t)
            # small ballot box beside the ring
            ballot_box(c, 540, 400, 0.30 * pop_scale(t, EV["voters"] + 0.3), clamp((t - EV["voters"]) * 3))
    # --- beat C: UK between Westminster and the EU, decision ahead
    c_in = e_io(prog(t, EV["not_guaranteed"] - 0.3, EV["not_guaranteed"] + 0.35))
    if c_in > 0.001:
        with Push(ctx, 540, 960, lerp(1.06, 1.0, c_in) * (1 + 0.03 * prog(t, EV["not_guaranteed"], SCENES["referendum"][1])), c_in) as c:
            c.translate(-540, -960)
            c.set_source_surface(uk_map_layer("base"), 0, 0)
            c.paint()
            lx, ly = P_UK(*LONDON)
            bx, by = P_UK(*BRUSSELS)
            pin(c, lx, ly, UK_RED, 1.0, 1.2)
            pin(c, bx, by, EU_BLUE_L, 1.0, 1.2)
            elizabeth_tower(c, lx - 70, ly - 30, 0.22, 1.0, t)
            eu_badge(c, bx + 90, by - 150, 52, 1.0, t)
            # path to a decision point, which forks: toward Brussels, or back home
            mx, my = lerp(lx, bx, 0.5), lerp(ly, by, 0.5) - 90
            pu = e_io(prog(t, EV["not_guaranteed"] + 0.1, EV["not_guaranteed"] + 1.0))
            c.set_dash([12, 10], -t * 25)
            c.move_to(lx, ly)
            c.line_to(lerp(lx, mx, pu), lerp(ly, my, pu))
            src(c, WHITE, 0.9)
            c.set_line_width(5)
            c.stroke()
            fu = e_io(prog(t, EV["not_guaranteed"] + 1.0, EV["not_guaranteed"] + 1.8))
            if fu > 0:
                c.move_to(mx, my)
                c.line_to(lerp(mx, bx, fu * 0.85), lerp(my, by, fu * 0.85))
                src(c, EU_BLUE_L, 0.9)
                c.stroke()
                c.move_to(mx, my)
                c.line_to(lerp(mx, lx + 40, fu * 0.7), lerp(my, ly - 160, fu * 0.7))
                src(c, UK_RED_L, 0.9)
                c.stroke()
            c.set_dash([])
            if pu > 0.9:
                pr = 1 + 0.15 * math.sin(t * 5)
                glow_dot(c, mx, my, 90 * pr, AMBER, 0.9)
                circle(c, mx, my, 22 * pr)
                src(c, AMBER)
                c.set_line_width(6)
                c.stroke()
    dust(ctx, t, 0.5)


def scene_final(ctx, lt, t):
    background(ctx)
    grid(ctx, 0.04, off=t * 6)
    a0, b0 = SCENES["final"][0], DURATION
    zu = e_io(prog(t, a0, b0 - 0.4))
    z = lerp(1.36, 1.10, zu)
    cx = lerp(470, 540, zu)
    cy = lerp(930, 960, zu)
    closer = e_io(prog(t, EV["years"] + 0.6, EV["v_end"]))
    uk_f = lerp(0.58, 0.16, closer)
    stars = 1.0
    road = e_io(prog(t, EV["road"] + 0.2, EV["road_back"] + 0.4))
    # spotlight from above onto the gap between the UK and the continent
    sp = e_io(prog(t, EV["spotlight"] - 0.6, EV["spotlight"] + 0.4))
    europe_map(ctx, cx, cy, z, uk_f, 1.0, t, uk_glow=1 + 0.3 * math.sin(t * 3), ghost=0.7,
               stars=stars, star_rot=t * 0.03, road=road)
    if sp > 0:
        gx, gy = W / 2 + (P_EU(1.5, 52.0)[0] - cx) * z, H / 2 + (P_EU(1.5, 52.0)[1] - cy) * z
        ctx.save()
        ctx.move_to(gx - 60, -50)
        ctx.line_to(gx + 60, -50)
        ctx.line_to(gx + 330, gy + 40)
        ctx.line_to(gx - 330, gy + 40)
        ctx.close_path()
        lg = cairo.LinearGradient(0, 0, 0, gy)
        lg.add_color_stop_rgba(0, 1, 0.95, 0.8, 0.0)
        lg.add_color_stop_rgba(1, 1, 0.95, 0.8, 0.13 * sp)
        ctx.set_source(lg)
        ctx.fill()
        ctx.restore()
        glow_dot(ctx, gx, gy, 340, hexc("#FFF2CC"), 0.35 * sp)
    dust(ctx, t, 0.7)
    fo = prog(t, DURATION - 1.3, DURATION - 0.1)
    if fo > 0:
        ctx.set_source_rgba(0, 0, 0, e_io(fo))
        ctx.paint()


DRAW = {
    "hook": scene_hook, "poll": scene_poll, "generation": scene_generation, "politics": scene_politics,
    "referendum": scene_referendum, "final": scene_final,
}


def render_frame(t):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    src(ctx, BG0)
    ctx.paint()
    for name in ORDER:
        a, b = SCENES[name]
        if not (a - XF / 2 <= t < b + XF / 2 or (name == ORDER[-1] and t >= a)):
            continue
        alpha = 1.0
        if name != ORDER[0]:
            alpha = min(alpha, e_io(prog(t, a - XF / 2, a + XF / 2)))
        if name != ORDER[-1]:
            alpha = min(alpha, 1 - e_io(prog(t, b - XF / 2, b + XF / 2)))
        if alpha <= 0.001:
            continue
        s = 1.0 + 0.03 * (1 - alpha)
        with Push(ctx, W / 2, H / 2, s, alpha) as c:
            c.translate(-W / 2, -H / 2)
            DRAW[name](c, t - a, t)
    vignette(ctx)
    if t < 0.5:
        ctx.set_source_rgba(0, 0, 0, 1 - t / 0.5)
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
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
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

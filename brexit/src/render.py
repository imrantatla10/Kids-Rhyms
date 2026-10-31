"""Render "Brexit: Did Britain Win or Lose? The Real Numbers (2020-2025)" — 1080x1920, 30 fps.

Every map, chart, icon, character and animation is drawn procedurally with cairo
(flat 2D only) and piped to ffmpeg together with audio/final_mix.wav.

    python3 render.py                    # full render -> output/*.mp4
    python3 render.py --stills 2,10,30   # PNG previews into output/stills/
"""
import argparse
import math
import os
import subprocess
from multiprocessing import Pool

import cairo

import geo
from timeline import CHUNKS, DURATION, EV, FPS, H, SCENES, VOICE_START, W

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "output")
AUDIO = os.path.join(ROOT, "audio", "final_mix.wav")
OUT_FILE = os.path.join(OUT_DIR, "Brexit_Win_or_Lose_vertical.mp4")

F_BLACK = "Inter Display Black"
F_XB = "Inter Display ExtraBold"
F_SB = "Inter SemiBold"
F_MED = "Inter Medium"
TAU = 2 * math.pi


# ================================================================= helpers
def hexc(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


NAVY = hexc("#0A1630")
NAVY2 = hexc("#112247")
PANEL = hexc("#16294F")
LINE = hexc("#2A3F6B")
WHITE = hexc("#FFFFFF")
MUTED = hexc("#9FB0CF")
BLUE = hexc("#3B82F6")
BLUE_L = hexc("#7FB2FF")
GREEN = hexc("#22C55E")
ORANGE = hexc("#F97316")
RED = hexc("#EF4444")
GOLD = hexc("#F2B705")
YELLOW = hexc("#FFD60A")
LAND = hexc("#22345C")
LAND_EDGE = hexc("#34497A")
UK_RED = hexc("#C8102E")
UK_BLUE = hexc("#012169")
EU_BLUE = hexc("#003399")
EU_STAR = hexc("#FFCC00")


def wa(c, a):
    return (c[0], c[1], c[2], c[3] * a)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def lerp(a, b, u):
    return a + (b - a) * u


def prog(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def e_out(u):
    return 1 - (1 - u) ** 3


def e_inout(u):
    return 3 * u * u - 2 * u * u * u


def e_back(u, s=1.8):
    u -= 1
    return u * u * ((s + 1) * u + s) + 1


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


def font(ctx, face, size):
    ctx.select_font_face(face, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)


def text_w(ctx, s, face, size, spacing=0.0):
    font(ctx, face, size)
    return ctx.text_extents(s).x_advance + spacing * max(0, len(s) - 1)


def text(ctx, s, x, y, size, face=F_BLACK, color=WHITE, align="c", alpha=1.0, spacing=0.0,
         shadow=False, stroke=0.0):
    """Draw text with baseline-centred vertical anchor (y = visual middle of caps)."""
    if alpha <= 0.001:
        return 0
    font(ctx, face, size)
    w = text_w(ctx, s, face, size, spacing)
    x0 = {"c": x - w / 2, "l": x, "r": x - w}[align]
    yb = y + size * 0.36
    def path():
        if spacing:
            xx = x0
            for ch in s:
                ctx.move_to(xx, yb)
                ctx.text_path(ch)
                xx += ctx.text_extents(ch).x_advance + spacing
        else:
            ctx.move_to(x0, yb)
            ctx.text_path(s)
    if shadow:
        ctx.save()
        ctx.translate(0, size * 0.06)
        path()
        src(ctx, hexc("#000000"), 0.45 * alpha)
        ctx.fill()
        ctx.restore()
    if stroke:
        path()
        src(ctx, hexc("#050B1A"), alpha)
        ctx.set_line_width(stroke)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.stroke()
    path()
    src(ctx, color, alpha)
    ctx.fill()
    return w


def pill(ctx, s, x, y, size, bg, fg=WHITE, face=F_BLACK, alpha=1.0, padx=None, pady=None,
         align="c", spacing=0.0, border=None):
    padx = size * 0.7 if padx is None else padx
    pady = size * 0.42 if pady is None else pady
    w = text_w(ctx, s, face, size, spacing) + 2 * padx
    h = size + 2 * pady
    x0 = {"c": x - w / 2, "l": x, "r": x - w}[align]
    rrect(ctx, x0, y - h / 2, w, h, h / 2)
    src(ctx, bg, alpha)
    ctx.fill_preserve()
    if border:
        src(ctx, border, alpha)
        ctx.set_line_width(3)
        ctx.stroke()
    else:
        ctx.new_path()
    text(ctx, s, x0 + w / 2, y, size, face, fg, "c", alpha, spacing)
    return w, h


def arrow_head(ctx, x, y, ang, size, color, alpha=1.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.move_to(size, 0)
    ctx.line_to(-size * 0.7, size * 0.75)
    ctx.line_to(-size * 0.35, 0)
    ctx.line_to(-size * 0.7, -size * 0.75)
    ctx.close_path()
    src(ctx, color, alpha)
    ctx.fill()
    ctx.restore()


def bezier_pts(p0, p1, p2, n=48):
    pts = []
    for i in range(n + 1):
        u = i / n
        x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0]
        y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]
        pts.append((x, y))
    return pts


def curve_arrow(ctx, p0, p2, bend, u, color, width=6, alpha=1.0, head=18, dash=None, phase=0.0):
    """Quadratic arrow from p0 to p2 drawn up to fraction u."""
    if u <= 0:
        return None
    mx, my = (p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2
    dx, dy = p2[0] - p0[0], p2[1] - p0[1]
    L = math.hypot(dx, dy) or 1
    p1 = (mx - dy / L * bend, my + dx / L * bend)
    pts = bezier_pts(p0, p1, p2)
    k = max(1, int(len(pts) * u))
    seg = pts[:k + 1]
    ctx.move_to(*seg[0])
    for p in seg[1:]:
        ctx.line_to(*p)
    src(ctx, color, alpha)
    ctx.set_line_width(width)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    if dash:
        ctx.set_dash(dash, phase)
    ctx.stroke()
    ctx.set_dash([])
    if len(seg) >= 2 and head:
        (ax, ay), (bx, by) = seg[-2], seg[-1]
        arrow_head(ctx, bx, by, math.atan2(by - ay, bx - ax), head, color, alpha)
    return pts


def star(ctx, cx, cy, r, rot=-TAU / 4):
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.4
        a = rot + i * TAU / 10
        (ctx.move_to if i == 0 else ctx.line_to)(cx + rr * math.cos(a), cy + rr * math.sin(a))
    ctx.close_path()


# ================================================================= flags
def union_jack(ctx, x, y, w, h):
    ctx.save()
    ctx.rectangle(x, y, w, h)
    ctx.clip()
    src(ctx, UK_BLUE)
    ctx.paint()
    ctx.translate(x, y)
    ctx.scale(w / 60, h / 30)
    ctx.set_line_cap(cairo.LINE_CAP_BUTT)
    for (a, b, c, d) in ((0, 0, 60, 30), (0, 30, 60, 0)):
        ctx.move_to(a, b)
        ctx.line_to(c, d)
    src(ctx, WHITE)
    ctx.set_line_width(6)
    ctx.stroke()
    # red diagonals (counterchanged)
    src(ctx, UK_RED)
    ctx.set_line_width(2)
    ctx.new_path()
    segs = [((0, 0), (30, 15), (0.0, 1.0)), ((60, 30), (30, 15), (0.0, -1.0)),
            ((0, 30), (30, 15), (1.0, 0.0)), ((60, 0), (30, 15), (-1.0, 0.0))]
    for (p, q, (ox, oy)) in segs:
        ctx.move_to(p[0] + ox, p[1] + oy)
        ctx.line_to(q[0] + ox, q[1] + oy)
    ctx.stroke()
    src(ctx, WHITE)
    ctx.rectangle(25, 0, 10, 30)
    ctx.rectangle(0, 10, 60, 10)
    ctx.fill()
    src(ctx, UK_RED)
    ctx.rectangle(27, 0, 6, 30)
    ctx.rectangle(0, 12, 60, 6)
    ctx.fill()
    ctx.restore()


def eu_flag(ctx, x, y, w, h, star_alpha=1.0, drift=0.0, alpha=1.0):
    ctx.save()
    rrect(ctx, x, y, w, h, 6)
    src(ctx, EU_BLUE, alpha)
    ctx.fill()
    cx, cy = x + w / 2, y + h / 2
    R = h / 3
    for i in range(12):
        a = -TAU / 4 + i * TAU / 12
        rr = R * (1 + drift * 1.6)
        sx = cx + rr * math.cos(a) + drift * 60 * math.cos(a * 3)
        sy = cy + rr * math.sin(a) - drift * 40
        star(ctx, sx, sy, h / 18 * (1 - 0.4 * drift))
        src(ctx, EU_STAR, star_alpha)
        ctx.fill()
    ctx.restore()


def eu_stars_icon(ctx, cx, cy, R, color=EU_STAR, alpha=1.0):
    for i in range(12):
        a = -TAU / 4 + i * TAU / 12
        star(ctx, cx + R * math.cos(a), cy + R * math.sin(a), R * 0.17)
    src(ctx, color, alpha)
    ctx.fill()


# ================================================================= icons & characters
def person(ctx, x, y, s, color, alpha=1.0):
    """Flat 2D person icon, feet at (x, y), height ~ 2.2*s."""
    src(ctx, color, alpha)
    ctx.arc(x, y - 1.75 * s, 0.42 * s, 0, TAU)
    ctx.fill()
    rrect(ctx, x - 0.6 * s, y - 1.25 * s, 1.2 * s, 1.25 * s, 0.5 * s)
    ctx.fill()


def icon_box(ctx, x, y, s, color):
    src(ctx, color)
    ctx.move_to(x - s, y - 0.4 * s)
    ctx.line_to(x, y - 0.9 * s)
    ctx.line_to(x + s, y - 0.4 * s)
    ctx.line_to(x + s, y + 0.7 * s)
    ctx.line_to(x, y + 1.1 * s)
    ctx.line_to(x - s, y + 0.7 * s)
    ctx.close_path()
    ctx.fill()
    src(ctx, NAVY, 0.5)
    ctx.move_to(x - s, y - 0.4 * s)
    ctx.line_to(x, y + 0.1 * s)
    ctx.line_to(x + s, y - 0.4 * s)
    ctx.move_to(x, y + 0.1 * s)
    ctx.line_to(x, y + 1.1 * s)
    ctx.set_line_width(s * 0.12)
    ctx.stroke()


def icon_gauge(ctx, x, y, s, color, needle=0.25):
    ctx.set_line_width(s * 0.28)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    src(ctx, color)
    ctx.arc(x, y + 0.3 * s, s, math.pi, TAU)
    ctx.stroke()
    a = math.pi + needle * math.pi
    ctx.set_line_width(s * 0.16)
    ctx.move_to(x, y + 0.3 * s)
    ctx.line_to(x + 0.85 * s * math.cos(a), y + 0.3 * s + 0.85 * s * math.sin(a))
    src(ctx, WHITE)
    ctx.stroke()
    ctx.arc(x, y + 0.3 * s, s * 0.15, 0, TAU)
    ctx.fill()


def icon_people(ctx, x, y, s, color):
    person(ctx, x - 0.75 * s, y + 0.9 * s, 0.55 * s, wa(color, 0.7))
    person(ctx, x + 0.75 * s, y + 0.9 * s, 0.55 * s, wa(color, 0.7))
    person(ctx, x, y + 1.0 * s, 0.7 * s, color)


def icon_pen(ctx, x, y, s, color):
    """Signing pen over a document = independent trade powers."""
    src(ctx, WHITE, 0.92)
    rrect(ctx, x - 0.8 * s, y - s, 1.4 * s, 1.9 * s, 0.15 * s)
    ctx.fill()
    src(ctx, MUTED)
    for i in range(3):
        ctx.rectangle(x - 0.55 * s, y - 0.65 * s + i * 0.38 * s, 0.9 * s, 0.1 * s)
    ctx.fill()
    ctx.save()
    ctx.translate(x + 0.45 * s, y + 0.35 * s)
    ctx.rotate(-0.8)
    src(ctx, color)
    rrect(ctx, -0.16 * s, -1.1 * s, 0.32 * s, 1.2 * s, 0.1 * s)
    ctx.fill()
    ctx.move_to(-0.16 * s, 0.1 * s)
    ctx.line_to(0.16 * s, 0.1 * s)
    ctx.line_to(0, 0.45 * s)
    ctx.close_path()
    ctx.fill()
    ctx.restore()


def icon_globe(ctx, x, y, s, color):
    src(ctx, color)
    ctx.set_line_width(s * 0.14)
    ctx.arc(x, y, s, 0, TAU)
    ctx.stroke()
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(0.45, 1)
    ctx.arc(0, 0, s, 0, TAU)
    ctx.restore()
    ctx.stroke()
    ctx.move_to(x - s, y)
    ctx.line_to(x + s, y)
    ctx.stroke()


def icon_chart_up(ctx, x, y, s, color):
    src(ctx, color)
    for i, hh in enumerate((0.6, 1.0, 1.5)):
        ctx.rectangle(x - s + i * 0.72 * s, y + 0.9 * s - hh * s, 0.5 * s, hh * s)
    ctx.fill()
    ctx.set_line_width(s * 0.14)
    ctx.move_to(x - s, y - 0.1 * s)
    ctx.line_to(x - 0.2 * s, y - 0.6 * s)
    ctx.line_to(x + 0.9 * s, y - 1.0 * s)
    ctx.stroke()
    arrow_head(ctx, x + 0.95 * s, y - 1.02 * s, -0.35, 0.3 * s, color)


def icon_comment(ctx, x, y, s, color):
    src(ctx, color)
    rrect(ctx, x - s, y - 0.75 * s, 2 * s, 1.4 * s, 0.35 * s)
    ctx.fill()
    ctx.move_to(x - 0.5 * s, y + 0.5 * s)
    ctx.line_to(x - 0.7 * s, y + 1.05 * s)
    ctx.line_to(x - 0.05 * s, y + 0.5 * s)
    ctx.close_path()
    ctx.fill()
    src(ctx, NAVY)
    for i in (-1, 0, 1):
        ctx.arc(x + i * 0.45 * s, y - 0.05 * s, 0.13 * s, 0, TAU)
        ctx.fill()


def icon_thumb(ctx, x, y, s, color, down=False):
    ctx.save()
    ctx.translate(x, y)
    if down:
        ctx.scale(1, -1)
    src(ctx, color)
    rrect(ctx, -s, -0.1 * s, 0.45 * s, 1.1 * s, 0.1 * s)
    ctx.fill()
    ctx.move_to(-0.45 * s, 0.0)
    ctx.line_to(-0.1 * s, -0.25 * s)
    ctx.line_to(0.05 * s, -1.0 * s)
    ctx.curve_to(0.4 * s, -1.05 * s, 0.45 * s, -0.5 * s, 0.3 * s, -0.15 * s)
    ctx.line_to(0.9 * s, -0.15 * s)
    ctx.curve_to(1.15 * s, -0.1 * s, 1.1 * s, 0.9 * s, 0.85 * s, 1.0 * s)
    ctx.line_to(-0.45 * s, 1.0 * s)
    ctx.close_path()
    ctx.fill()
    ctx.restore()


# ================================================================= map layers (cached)
_layers = {}


def map_path(ctx, rings, proj, dx=0.0, dy=0.0):
    for r in rings:
        if len(r) < 3:
            continue
        x, y = proj(*r[0])
        ctx.move_to(x + dx, y + dy)
        for lon, lat in r[1:]:
            x, y = proj(lon, lat)
            ctx.line_to(x + dx, y + dy)
        ctx.close_path()


def make_layer(key, painter):
    if key not in _layers:
        surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        c = cairo.Context(surf)
        painter(c)
        _layers[key] = surf
    return _layers[key]


def blit(ctx, surf, alpha=1.0):
    ctx.set_source_surface(surf, 0, 0)
    ctx.paint_with_alpha(alpha)


# projections
P_UK = geo.Proj(-8.8, 2.1, 49.8, 60.9, 330, 610, 430, coslat=54)
P_EUR = geo.Proj(-13.0, 33.0, 35.5, 62.5, -10, 300, 1100, coslat=50)
P_WMIG = geo.Proj(-125, 150, -42, 72, 0, 300, 1080, coslat=0)
P_WDEAL = geo.Proj(-135, 182, -48, 72, -5, 360, 1090, coslat=0)


def uk_layer_hook(c):
    world = geo.load("50m")
    # neighbours faint
    for name in ("Ireland", "France", "Belgium", "Netherlands", "Isle of Man"):
        if name in world:
            map_path(c, world[name], P_UK)
    src(c, LAND, 0.9)
    c.fill()
    # UK filled with the Union Jack
    c.save()
    map_path(c, world["United Kingdom"], P_UK)
    c.clip()
    x0, y0 = P_UK(-8.8, 60.9)
    x1, y1 = P_UK(2.1, 49.8)
    union_jack(c, x0, y0 + (y1 - y0) * 0.15, x1 - x0, (x1 - x0) / 2 * 1.4)
    # fill the rest (the flag is wider than tall) with blue stripes
    src(c, UK_BLUE)
    c.rectangle(x0 - 10, y0 - 10, x1 - x0 + 20, (y1 - y0) * 0.15 + 10)
    c.fill()
    hh = (x1 - x0) / 2 * 1.4
    yy = y0 + (y1 - y0) * 0.15 + hh
    union_jack(c, x0, yy, x1 - x0, (x1 - x0) / 2 * 1.4)
    c.restore()
    map_path(c, world["United Kingdom"], P_UK)
    src(c, WHITE, 0.95)
    c.set_line_width(3)
    c.stroke()


def europe_layer(c, include_uk=False):
    world = geo.load("50m")
    c.rectangle(0, 250, W, H)
    c.clip()
    for name, rings in world.items():
        if name == "United Kingdom" and not include_uk:
            continue
        map_path(c, rings, P_EUR)
        if name in geo.EU27:
            src(c, GOLD, 0.92)
        elif name == "United Kingdom":
            src(c, BLUE)
        else:
            src(c, LAND)
        c.fill_preserve()
        src(c, NAVY, 0.9)
        c.set_line_width(1.4)
        c.stroke()


def world_mig_layer(c):
    world = geo.load("110m")
    for name, rings in world.items():
        map_path(c, rings, P_WMIG)
        if name == "United Kingdom":
            src(c, WHITE)
        elif geo.is_europe(name, rings):
            src(c, BLUE)
        else:
            src(c, ORANGE, 0.85)
        c.fill_preserve()
        src(c, NAVY, 0.8)
        c.set_line_width(1.0)
        c.stroke()


def world_deal_layer(c):
    world = geo.load("110m")
    for name, rings in world.items():
        map_path(c, rings, P_WDEAL)
        if name == "United Kingdom":
            src(c, BLUE_L)
        elif name in geo.CPTPP:
            src(c, GREEN)
        else:
            src(c, LAND)
        c.fill_preserve()
        src(c, NAVY, 0.8)
        c.set_line_width(1.0)
        c.stroke()


def uk_only(c, proj):
    world = geo.load("50m" if proj is P_EUR else "110m")
    map_path(c, world["United Kingdom"], proj)


# ================================================================= background / chrome
def background(ctx, t):
    pat = cairo.LinearGradient(0, 0, 0, H)
    pat.add_color_stop_rgb(0, *NAVY2[:3])
    pat.add_color_stop_rgb(0.55, *NAVY[:3])
    pat.add_color_stop_rgb(1, 0.02, 0.05, 0.12)
    ctx.set_source(pat)
    ctx.paint()
    # subtle dot grid drifting
    src(ctx, WHITE, 0.035)
    off = (t * 12) % 60
    for gy in range(0, H + 60, 60):
        for gx in range(0, W + 60, 60):
            ctx.rectangle(gx - off * 0.5, gy - off, 3, 3)
    ctx.fill()


def chrome(ctx, t, chip):
    # progress bar
    src(ctx, WHITE, 0.12)
    ctx.rectangle(0, 0, W, 8)
    ctx.fill()
    src(ctx, YELLOW)
    ctx.rectangle(0, 0, W * t / DURATION, 8)
    ctx.fill()
    text(ctx, "BREXIT  ·  THE REAL NUMBERS  2020–2025", W / 2, 112, 28, F_XB, MUTED, spacing=2.5)
    if chip:
        label, color, a = chip
        if a > 0:
            pill(ctx, label, W / 2, 182, 38, color, WHITE, F_BLACK, alpha=a, spacing=1.5)


def source_label(ctx, s, alpha, y=1398):
    if alpha <= 0:
        return
    text(ctx, s, W / 2, y, 23, F_MED, MUTED, alpha=alpha * 0.95)


# ================================================================= subtitles
def subtitles(ctx, t):
    for ch in CHUNKS:
        if ch["t0"] <= t < ch["t1"]:
            break
    else:
        return
    size = 64
    words = ch["words"]
    font(ctx, F_BLACK, size)
    space = ctx.text_extents(" ").x_advance
    widths = [ctx.text_extents(w["text"]).x_advance for w in words]
    total = sum(widths) + space * (len(words) - 1)
    cy = 1585
    a_in = e_out(prog(t, ch["t0"], ch["t0"] + 0.12))
    a_out = 1 - prog(t, ch["t1"] - 0.08, ch["t1"])
    al = a_in * a_out
    # backing plate
    rrect(ctx, W / 2 - total / 2 - 34, cy - 62, total + 68, 124, 30)
    src(ctx, hexc("#050B1A"), 0.62 * al)
    ctx.fill()
    x = W / 2 - total / 2
    for w, ww in zip(words, widths):
        spoken = t >= w["t0"]
        u = e_back(prog(t, w["t0"], w["t0"] + 0.16)) if spoken else 0
        sc = 0.88 + 0.12 * u
        col = YELLOW if w["key"] else WHITE
        alpha = (0.42 + 0.58 * clamp(u)) * al
        ctx.save()
        ctx.translate(x + ww / 2, cy)
        ctx.scale(sc, sc)
        text(ctx, w["text"], 0, 0, size, F_BLACK, col, "c", alpha, stroke=8)
        ctx.restore()
        x += ww + space


# ================================================================= scene 1: hook
def scene_hook(ctx, lt, t):
    z = 1.0 + 0.45 * (1 - e_out(prog(lt, 0, 0.7)))
    ctx.save()
    ctx.translate(W / 2, 1000)
    ctx.scale(z, z)
    ctx.translate(-W / 2, -1000)
    # glow behind the UK
    g = cairo.RadialGradient(540, 1000, 50, 540, 1000, 520)
    g.add_color_stop_rgba(0, *BLUE[:3], 0.35)
    g.add_color_stop_rgba(1, *BLUE[:3], 0.0)
    ctx.set_source(g)
    ctx.paint()
    blit(ctx, make_layer("uk_hook", uk_layer_hook), e_out(prog(lt, 0, 0.35)))
    ctx.restore()

    # EU flag top-right, stars drift away and fade (2.0 -> 3.0)
    u = e_inout(prog(lt, 1.9, 3.0))
    a = 1 - u
    fx, fy = 735, 650 + 30 * u
    if a > 0:
        eu_flag(ctx, fx, fy, 270, 180, star_alpha=a, drift=u, alpha=a * a)
        text(ctx, "EU", fx + 135, fy + 215, 34, F_BLACK, GOLD, alpha=a * e_out(prog(lt, 0.4, 0.8)))

    # title
    tu = e_back(prog(lt, 0.15, 0.6))
    ctx.save()
    ctx.translate(W / 2, 330)
    ctx.scale(tu, tu)
    text(ctx, "BREXIT:", 0, 0, 150, F_BLACK, WHITE, shadow=True)
    ctx.restore()
    tu2 = e_back(prog(lt, 0.45, 0.9))
    ctx.save()
    ctx.translate(W / 2, 480)
    ctx.scale(tu2, tu2)
    font(ctx, F_BLACK, 112)
    parts = [("WIN", GREEN), (" OR ", WHITE), ("LOSE?", RED)]
    tw = sum(ctx.text_extents(p).x_advance for p, _ in parts)
    x = -tw / 2
    for p, c in parts:
        w = text(ctx, p, x, 0, 112, F_BLACK, c, "l", shadow=True)
        x += w
    ctx.restore()

    # bold question mark pop-up
    qu = prog(lt, 1.45, 1.85)
    if qu > 0:
        s = e_back(qu, 2.6)
        wob = math.sin(lt * 5) * 0.08
        ctx.save()
        ctx.translate(800, 1180)
        ctx.rotate(0.15 + wob)
        ctx.scale(s, s)
        ctx.arc(0, 0, 120, 0, TAU)
        src(ctx, YELLOW)
        ctx.fill()
        text(ctx, "?", 0, 4, 190, F_BLACK, NAVY)
        ctx.restore()


# ================================================================= scene 2: timeline
def scene_timeline(ctx, lt, t):
    blit(ctx, make_layer("europe", lambda c: europe_layer(c, False)), 1.0)
    sep = e_inout(prog(lt, 0.5, 2.6))
    dx, dy = -95 * sep, -25 * sep
    # UK (moves away)
    world = geo.load("50m")
    ctx.save()
    ctx.rectangle(0, 250, W, H)
    ctx.clip()
    map_path(ctx, world["United Kingdom"], P_EUR, dx, dy)
    src(ctx, BLUE)
    ctx.fill_preserve()
    src(ctx, WHITE, 0.9)
    ctx.set_line_width(3)
    ctx.stroke()
    ctx.restore()
    # break line between UK and the continent
    if sep > 0.05:
        ctx.set_dash([18, 12], -lt * 60)
        ctx.move_to(*P_EUR(-5.5, 61.5))
        ctx.line_to(*P_EUR(-1.0, 49.0))
        ctx.line_to(*P_EUR(-6.5, 46.0))
        src(ctx, WHITE, 0.7 * sep)
        ctx.set_line_width(5)
        ctx.stroke()
        ctx.set_dash([])
    # arrow showing the UK moving away
    ua = prog(lt, 0.8, 2.0)
    ux, uy = P_EUR(-2.5, 54)
    curve_arrow(ctx, (ux + 80 + dx, uy + 160 + dy), (ux - 120 + dx, uy - 50 + dy), -60, e_out(ua),
                WHITE, 9, 0.95, 26)
    # labels
    la = e_out(prog(lt, 0.3, 0.9))
    lx, ly = P_EUR(-2.0, 57.2)
    pill(ctx, "UNITED KINGDOM", lx + dx + 90 - 40 * (1 - la), ly + dy - 175, 34, BLUE, WHITE, alpha=la,
         border=WHITE)
    ex, ey = P_EUR(11.5, 49.2)
    lb = e_out(prog(lt, 0.6, 1.2))
    pill(ctx, "EUROPEAN UNION · 27", ex + 60 * (1 - lb), ey - 30, 34, hexc("#B07F00"), WHITE, alpha=lb,
         border=GOLD)

    # date pop-ups
    for i, (key, date, sub) in enumerate(((("date1"), "31 JANUARY 2020", "UK officially leaves the EU"),
                                          (("date2"), "1 JANUARY 2021",
                                           "Transition ends: out of the single market"))):
        u = prog(t, EV[key], EV[key] + 0.35)
        if u <= 0:
            continue
        s = e_back(u)
        cy = 1040 + i * 190
        ctx.save()
        ctx.translate(W / 2, cy)
        ctx.scale(s, s)
        rrect(ctx, -440, -78, 880, 156, 26)
        src(ctx, hexc("#0B1733"), 0.94)
        ctx.fill_preserve()
        src(ctx, YELLOW if i == 0 else BLUE_L)
        ctx.set_line_width(4)
        ctx.stroke()
        # calendar icon
        rrect(ctx, -405, -48, 92, 96, 14)
        src(ctx, WHITE)
        ctx.fill()
        ctx.rectangle(-405, -48, 92, 28)
        src(ctx, RED)
        ctx.fill()
        text(ctx, "31" if i == 0 else "1", -359, 18, 40, F_BLACK, NAVY)
        text(ctx, date, -280, -18, 52, F_BLACK, YELLOW if i == 0 else BLUE_L, "l")
        text(ctx, sub, -280, 36, 30, F_SB, WHITE, "l")
        ctx.restore()
    # connecting timeline line
    if t > EV["date2"]:
        ctx.move_to(W / 2 - 359, 1040 + 50)
        ctx.line_to(W / 2 - 359, 1040 + 190 - 50)
        src(ctx, WHITE, 0.6 * prog(t, EV["date2"], EV["date2"] + 0.3))
        ctx.set_line_width(5)
        ctx.stroke()


# ================================================================= scene 3: trade
def ship(ctx, x, y, s):
    # hull
    src(ctx, hexc("#E2E8F0"))
    ctx.move_to(x - 150 * s, y)
    ctx.line_to(x + 160 * s, y)
    ctx.line_to(x + 120 * s, y + 46 * s)
    ctx.line_to(x - 135 * s, y + 46 * s)
    ctx.close_path()
    ctx.fill()
    src(ctx, RED)
    ctx.rectangle(x - 140 * s, y + 30 * s, 270 * s, 10 * s)
    ctx.fill()
    # bridge
    src(ctx, WHITE)
    ctx.rectangle(x - 140 * s, y - 70 * s, 42 * s, 70 * s)
    ctx.fill()
    src(ctx, NAVY)
    for i in range(3):
        ctx.rectangle(x - 134 * s + i * 13 * s, y - 60 * s, 8 * s, 8 * s)
    ctx.fill()
    # containers
    cols = [BLUE, GREEN, ORANGE, RED, GOLD, BLUE_L]
    for row in range(2):
        for k in range(6):
            src(ctx, cols[(k + row * 2) % len(cols)])
            ctx.rectangle(x - 90 * s + k * 40 * s, y - (row + 1) * 30 * s, 36 * s, 27 * s)
    ctx.fill()


def crane(ctx, x, y, s, flip=False):
    d = -1 if flip else 1
    src(ctx, ORANGE)
    ctx.set_line_width(7 * s)
    ctx.move_to(x, y)
    ctx.line_to(x, y - 150 * s)
    ctx.move_to(x - 40 * d * s, y - 150 * s)
    ctx.line_to(x + 120 * d * s, y - 150 * s)
    ctx.move_to(x, y - 190 * s)
    ctx.line_to(x + 110 * d * s, y - 150 * s)
    ctx.move_to(x, y - 190 * s)
    ctx.line_to(x - 40 * d * s, y - 150 * s)
    ctx.move_to(x, y - 150 * s)
    ctx.line_to(x, y - 190 * s)
    ctx.stroke()
    ctx.set_line_width(3 * s)
    ctx.move_to(x + 90 * d * s, y - 150 * s)
    ctx.line_to(x + 90 * d * s, y - 90 * s)
    ctx.stroke()
    ctx.rectangle(x + 76 * d * s - (28 * s if flip else 0), y - 90 * s, 28 * s, 18 * s)
    ctx.fill()


def trade_illustration(ctx, lt):
    top, bot = 290, 700
    # sea
    src(ctx, hexc("#123A6B"))
    ctx.rectangle(0, 545, W, bot - 545)
    ctx.fill()
    src(ctx, WHITE, 0.15)
    for k in range(8):
        x = (k * 150 + lt * 40) % (W + 150) - 75
        ctx.move_to(x, 600 + (k % 3) * 30)
        ctx.curve_to(x + 15, 590 + (k % 3) * 30, x + 30, 610 + (k % 3) * 30, x + 45, 600 + (k % 3) * 30)
        ctx.set_line_width(3)
        ctx.stroke()
    # UK quay (left) / EU quay (right)
    for side in (0, 1):
        x0 = 0 if side == 0 else W - 220
        src(ctx, hexc("#2B3E66"))
        ctx.rectangle(x0, 520, 220, 40)
        ctx.fill()
        crane(ctx, 70 if side == 0 else W - 70, 520, 0.95, flip=side == 1)
        # container stacks
        cols = [BLUE, GREEN, ORANGE, RED]
        for r in range(2):
            for k in range(3):
                src(ctx, cols[(k + r) % 4])
                ctx.rectangle(x0 + 100 - (60 if side else 0) + k * 34 - (0 if side == 0 else 0),
                              493 - r * 26, 31, 24)
        ctx.fill()
    union_jack(ctx, 30, 300, 120, 60)
    eu_flag(ctx, W - 150, 300, 120, 80)
    text(ctx, "UK", 90, 400, 34, F_BLACK, WHITE)
    text(ctx, "EU", W - 90, 412, 34, F_BLACK, GOLD)
    # ship sailing UK -> EU, looping
    period = 6.0
    u = (lt % period) / period
    sx = lerp(260, W - 260, e_inout(u))
    bob = math.sin(lt * 3) * 4
    ship(ctx, sx, 560 + bob, 0.85)
    # trade arrows
    for i, (y, lab, col) in enumerate(((330, "GOODS", BLUE), (420, "SERVICES", GREEN))):
        a = e_out(prog(lt, 0.4 + i * 0.3, 1.2 + i * 0.3))
        if a <= 0:
            continue
        ctx.set_dash([22, 14], -lt * 90)
        ctx.move_to(210, y + 20)
        ctx.line_to(lerp(210, W - 230, a), y + 20)
        src(ctx, col)
        ctx.set_line_width(8)
        ctx.stroke()
        ctx.set_dash([])
        arrow_head(ctx, lerp(210, W - 222, a), y + 20, 0, 22, col)
        pill(ctx, lab, W / 2, y + 20, 26, col, WHITE, alpha=a)


def scene_trade(ctx, lt, t):
    trade_illustration(ctx, lt)
    # chart
    ca = e_out(prog(lt, 1.0, 1.6))
    text(ctx, "UK EXPORTS TO THE EU", W / 2, 775, 44, F_BLACK, WHITE, alpha=ca)
    text(ctx, "2025 vs 2019 · real terms (2019 = 100)", W / 2, 825, 30, F_SB, MUTED, alpha=ca)
    base_y, top_y = 1320, 900
    vmax = 140
    def vy(v):
        return base_y - (base_y - top_y) * v / vmax
    # axis
    src(ctx, WHITE, 0.5 * ca)
    ctx.rectangle(140, base_y, 800, 3)
    ctx.fill()
    # bars
    g = e_out(prog(lt, 1.8, 3.0))
    goods = 100 * g
    serv = 100 * g
    goods -= 14 * e_inout(prog(t, EV["goods_pct"] - 0.5, EV["goods_pct"] + 0.3))
    serv += 28 * e_inout(prog(t, EV["serv_pct"] - 0.5, EV["serv_pct"] + 0.3))
    for cx, v, col, lab in ((340, goods, BLUE, "GOODS EXPORTS"), (740, serv, GREEN, "SERVICES EXPORTS")):
        if v > 0:
            rrect(ctx, cx - 125, vy(v), 250, base_y - vy(v), 14)
            src(ctx, col)
            ctx.fill()
            ctx.rectangle(cx - 125, base_y - 14, 250, 14)
            ctx.fill()
            text(ctx, f"{v:.0f}", cx, vy(v) + 42, 42, F_BLACK, WHITE, alpha=clamp(g * 2 - 1))
        text(ctx, lab, cx, base_y + 40, 30, F_BLACK, WHITE, alpha=ca)
    # 2019 baseline
    ba = e_out(prog(lt, 1.4, 2.0))
    if ba > 0:
        ctx.set_dash([16, 10])
        ctx.move_to(130, vy(100))
        ctx.line_to(130 + 820 * ba, vy(100))
        src(ctx, YELLOW, 0.95)
        ctx.set_line_width(4)
        ctx.stroke()
        ctx.set_dash([])
        pill(ctx, "2019 = 100", 540, vy(100), 24, hexc("#0B1733"), YELLOW, alpha=ba, border=YELLOW)
    # percentage pop-ups
    for key, cx, v, s, col in (("goods_pct", 340, 86, "−14%", RED), ("serv_pct", 740, 128, "+28%", GREEN)):
        u = prog(t, EV[key] + 0.2, EV[key] + 0.55)
        if u > 0:
            sc = e_back(u, 2.4)
            ctx.save()
            ctx.translate(cx, min(vy(v), vy(100)) - 78)
            ctx.scale(sc, sc)
            pill(ctx, s, 0, 0, 64, col, WHITE)
            ctx.restore()
    source_label(ctx, "Source: ONS (Office for National Statistics) · UK trade, real terms", ca)


# ================================================================= scene 4: migration
MIG_ORIGINS = [(78, 22), (69, 30), (8, 9), (105, 33), (-48, -12), (-98, 38), (45, 24), (36, -1),
               (121, 14), (134, -25)]


def scene_migr(ctx, lt, t):
    ma = e_out(prog(lt, 0, 0.4))
    blit(ctx, make_layer("wmig", world_mig_layer), ma)
    ukx, uky = P_WMIG(-1.5, 53)
    # pulse ring on the UK
    for k in range(2):
        ph = ((lt * 0.9 + k * 0.5) % 1.0)
        ctx.arc(ukx, uky, 10 + 50 * ph, 0, TAU)
        src(ctx, YELLOW, (1 - ph) * 0.9 * ma)
        ctx.set_line_width(4)
        ctx.stroke()
    # arrows into the UK with travelling people icons
    fm = prog(t, EV["fm_ended"], EV["fm_ended"] + 0.6)
    for i, (lon, lat) in enumerate(MIG_ORIGINS):
        p0 = P_WMIG(lon, lat)
        u = e_out(prog(lt, 0.4 + i * 0.12, 1.6 + i * 0.12))
        bend = 90 if lon > 0 else -90
        pts = curve_arrow(ctx, p0, (ukx, uky + 6), bend, u, ORANGE, 4, 0.95, 13)
        if pts and u >= 1:
            for k in range(2):
                ph = ((lt * 0.35 + i * 0.13 + k * 0.5) % 1.0)
                px, py = pts[int(ph * (len(pts) - 1))]
                person(ctx, px, py + 10, 7, WHITE, math.sin(ph * math.pi))
    # Europe arrow (free movement) — becomes thin & dashed after free movement ends
    p0 = P_WMIG(18, 50)
    eu_w = lerp(9, 3.5, fm)
    curve_arrow(ctx, p0, (ukx + 6, uky + 2), -40, e_out(prog(lt, 0.3, 1.0)), BLUE_L, eu_w, 1.0, 15,
                dash=[10, 8] if fm > 0.5 else None)
    # legend
    la = e_out(prog(lt, 0.6, 1.0))
    if la > 0:
        for i, (lab, col) in enumerate((("EUROPE", BLUE), ("REST OF WORLD", ORANGE), ("UK", WHITE))):
            x = 80 + i * 330
            rrect(ctx, x, 770, 30, 30, 6)
            src(ctx, col, la)
            ctx.fill()
            text(ctx, lab, x + 44, 785, 26, F_XB, WHITE, "l", la)
    # free movement ended stamp
    su = prog(t, EV["fm_ended"], EV["fm_ended"] + 0.25)
    so = 1 - prog(t, EV["disappear"] - 0.3, EV["disappear"])
    if su > 0 and so > 0:
        s = lerp(1.6, 1.0, e_out(su))
        ctx.save()
        ctx.translate(W / 2, 520)
        ctx.rotate(-0.08)
        ctx.scale(s, s)
        rrect(ctx, -400, -60, 800, 120, 18)
        src(ctx, hexc("#0B1733"), 0.85 * su * so)
        ctx.fill_preserve()
        src(ctx, RED, su * so)
        ctx.set_line_width(8)
        ctx.stroke()
        text(ctx, "EU FREE MOVEMENT ENDED", 0, 0, 52, F_BLACK, RED, alpha=su * so)
        ctx.restore()
    # message banner
    mu = prog(t, EV["disappear"], EV["disappear"] + 0.4)
    if mu > 0:
        s = e_back(mu)
        ctx.save()
        ctx.translate(W / 2, 872)
        ctx.scale(s, s)
        rrect(ctx, -500, -55, 1000, 110, 22)
        src(ctx, YELLOW)
        ctx.fill()
        text(ctx, "IMMIGRATION DID NOT DISAPPEAR.", 0, -18, 40, F_BLACK, NAVY)
        text(ctx, "IT CHANGED.", 0, 26, 40, F_BLACK, RED)
        ctx.restore()
    # horizontal bar chart
    rows = [("TOTAL ARRIVALS", 813000, hexc("#E2E8F0"), "total"),
            ("NON-EU+", 627000, ORANGE, "noneu"),
            ("EU+", 76000, BLUE, "eu"),
            ("BRITISH NATIONALS", 110000, GREEN, "british")]
    x0, xmax = 70, 1010
    for i, (lab, v, col, key) in enumerate(rows):
        y = 975 + i * 100
        ga = e_out(prog(t, EV[key] - 0.15, EV[key] + 0.25))
        # placeholder track
        tr = e_out(prog(lt, 1.0, 1.6))
        rrect(ctx, x0, y + 8, xmax - x0, 46, 12)
        src(ctx, WHITE, 0.07 * tr)
        ctx.fill()
        text(ctx, lab, x0, y - 16, 28, F_BLACK, WHITE if ga > 0 else MUTED, "l", max(tr * 0.6, ga))
        g = e_out(prog(t, EV[key], EV[key] + 0.7))
        if g > 0:
            wbar = max(24, (xmax - x0) * v / 813000 * g)
            rrect(ctx, x0, y + 8, wbar, 46, 12)
            src(ctx, col)
            ctx.fill()
            num = f"{int(round(v * g / 1000.0)) * 1000:,}" if g < 1 else f"{v:,}"
            if wbar > 300:
                text(ctx, num, x0 + wbar - 16, y + 31, 34, F_BLACK, NAVY, "r")
            else:
                text(ctx, num, x0 + wbar + 16, y + 31, 34, F_BLACK, col, "l")
    na = e_out(prog(lt, 1.0, 1.6))
    text(ctx, "EU+ = EU plus Iceland, Liechtenstein, Norway & Switzerland", W / 2, 1365, 22, F_MED,
         MUTED, alpha=na)
    source_label(ctx, "Source: ONS · long-term international migration, 2025", na, y=1400)


# ================================================================= scene 5: economy
def skyline(ctx, base, s, lt):
    """Flat 2D City of London-style skyline sitting on y=base."""
    # back row
    src(ctx, hexc("#1C3260"))
    for i, (x, w, h) in enumerate(((40, 90, 260), (140, 70, 330), (220, 110, 220), (700, 80, 300),
                                   (790, 110, 250), (910, 120, 340), (330, 60, 280))):
        ctx.rectangle(x, base - h * s, w, h * s)
    ctx.fill()
    # Gherkin-like tower
    src(ctx, hexc("#3B82F6"))
    cx = 470
    ctx.move_to(cx, base - 420 * s)
    ctx.curve_to(cx + 95, base - 360 * s, cx + 85, base - 80 * s, cx + 55, base)
    ctx.line_to(cx - 55, base)
    ctx.curve_to(cx - 85, base - 80 * s, cx - 95, base - 360 * s, cx, base - 420 * s)
    ctx.fill()
    src(ctx, hexc("#1E40AF"))
    ctx.set_line_width(4)
    for k in range(-3, 4):
        ctx.move_to(cx + k * 22, base)
        ctx.curve_to(cx + k * 30, base - 200 * s, cx - k * 10, base - 330 * s, cx, base - 420 * s)
    ctx.stroke()
    # shard-like spire
    src(ctx, hexc("#7FB2FF"))
    ctx.move_to(640, base - 560 * s)
    ctx.line_to(700, base)
    ctx.line_to(560, base)
    ctx.close_path()
    ctx.fill()
    src(ctx, hexc("#5B8FE0"))
    ctx.move_to(640, base - 560 * s)
    ctx.line_to(700, base)
    ctx.line_to(640, base)
    ctx.close_path()
    ctx.fill()
    # walkie-talkie-like (wider at top)
    src(ctx, hexc("#2F5BB0"))
    ctx.move_to(250, base)
    ctx.line_to(370, base)
    ctx.line_to(395, base - 360 * s)
    ctx.line_to(225, base - 380 * s)
    ctx.close_path()
    ctx.fill()
    # Canary-Wharf-like pyramid top tower
    src(ctx, hexc("#4A6FB5"))
    ctx.rectangle(830, base - 470 * s, 110, 470 * s)
    ctx.fill()
    ctx.move_to(830, base - 470 * s)
    ctx.line_to(885, base - 530 * s)
    ctx.line_to(940, base - 470 * s)
    ctx.close_path()
    ctx.fill()
    # windows
    src(ctx, YELLOW, 0.55)
    for bx, bw, bh in ((140, 70, 330), (830, 110, 470), (910, 120, 340), (40, 90, 260)):
        for r in range(int(bh * s / 34)):
            for c in range(int(bw / 26)):
                if (r * 7 + c * 3 + int(lt * 2)) % 5 == 0:
                    ctx.rectangle(bx + 8 + c * 26, base - bh * s + 14 + r * 34, 12, 14)
    ctx.fill()
    # river
    src(ctx, hexc("#123A6B"))
    ctx.rectangle(0, base, W, 70)
    ctx.fill()
    src(ctx, WHITE, 0.2)
    for k in range(7):
        x = (k * 170 + lt * 50) % (W + 100) - 50
        ctx.rectangle(x, base + 20 + (k % 3) * 14, 60, 4)
    ctx.fill()


def scene_economy(ctx, lt, t):
    shrink = e_inout(prog(lt, 2.4, 3.2))
    # skyline: big at first, then rises into a compact band at the top
    ctx.save()
    sc = lerp(1.0, 0.5, shrink)
    base = lerp(1250, 600, shrink)
    ctx.translate(W / 2, base)
    ctx.scale(sc, sc)
    ctx.translate(-W / 2, -base)
    skyline(ctx, base, 1.25 + 0.05 * prog(lt, 0, 3), lt)
    ctx.restore()
    # floating currency symbols + business icons (first part)
    fa = 1 - shrink
    if fa > 0:
        for i, sym in enumerate("£€$£$€£"):
            ph = (lt * 0.25 + i * 0.17) % 1.0
            x = 90 + i * 150
            y = 1150 - ph * 700
            text(ctx, sym, x, y, 70 + (i % 3) * 14, F_BLACK, [GREEN, YELLOW, BLUE_L][i % 3],
                 alpha=fa * math.sin(ph * math.pi))
        # briefcase
        ctx.save()
        ctx.translate(180, 470)
        src(ctx, ORANGE, fa)
        rrect(ctx, -60, -35, 120, 80, 12)
        ctx.fill()
        rrect(ctx, -22, -55, 44, 26, 8)
        ctx.set_line_width(8)
        ctx.stroke()
        ctx.restore()
        ctx.save()
        ctx.translate(900, 470)
        icon_chart_up(ctx, 0, 0, 55, wa(GREEN, fa))
        ctx.restore()
        text(ctx, "LONDON · THE CITY", W / 2, 1400, 36, F_BLACK, WHITE, alpha=fa * e_out(prog(lt, 0.3, 0.8)))
    # line graph
    ga = e_out(prog(lt, 2.9, 3.4))
    if ga <= 0:
        return
    px0, px1, py0, py1 = 150, 960, 760, 1250
    vmin, vmax = 96, 128
    def P(xu, v):
        return px0 + (px1 - px0) * xu, py1 - (py1 - py0) * (v - vmin) / (vmax - vmin)
    text(ctx, "PRODUCTIVITY: TWO PATHS", W / 2, 680, 44, F_BLACK, WHITE, alpha=ga)
    text(ctx, "Counterfactual comparison · index, 2016 = 100", W / 2, 724, 26, F_SB, MUTED, alpha=ga)
    src(ctx, WHITE, 0.25 * ga)
    for v in (100, 110, 120):
        x, y = P(0, v)
        ctx.rectangle(px0, y, px1 - px0, 2)
    ctx.fill()
    for v in (100, 110, 120):
        text(ctx, str(v), px0 - 18, P(0, v)[1], 24, F_SB, MUTED, "r", ga)
    ticks = [(0.0, "2016"), (0.25, "2020"), (0.5, "2025"), (0.75, "2030"), (1.0, "LONG TERM")]
    for xu, lab in ticks:
        text(ctx, lab, P(xu, 0)[0], py1 + 34, 24, F_XB, MUTED, "c", ga)
    # paths (illustrative): both rise; post-Brexit ends 4% below the EU path
    def eu_path(u):
        return 100 + 20 * u
    def brexit_path(u):
        gap = 0.04 * (u ** 1.1)
        return eu_path(u) * (1 - gap)
    draw = e_inout(prog(t, EV["watchdog"] - 0.2, EV["prod"] + 0.2))
    n = 80
    for fn, col, dash, wdt in ((eu_path, BLUE_L, [18, 10], 7), (brexit_path, RED, None, 8)):
        k = int(n * draw)
        if k < 1:
            continue
        for i in range(k + 1):
            x, y = P(i / n, fn(i / n))
            (ctx.move_to if i == 0 else ctx.line_to)(x, y)
        src(ctx, col, ga)
        ctx.set_line_width(wdt)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        if dash:
            ctx.set_dash(dash)
        ctx.stroke()
        ctx.set_dash([])
        hx, hy = P(k / n, fn(k / n))
        ctx.arc(hx, hy, 10, 0, TAU)
        src(ctx, col, ga)
        ctx.fill()
    # legend
    la = e_out(prog(t, EV["watchdog"], EV["watchdog"] + 0.4))
    if la > 0:
        ctx.set_dash([14, 8])
        ctx.move_to(150, 1335)
        ctx.line_to(210, 1335)
        src(ctx, BLUE_L, la)
        ctx.set_line_width(7)
        ctx.stroke()
        ctx.set_dash([])
        text(ctx, "UK WITH EU MEMBERSHIP (counterfactual)", 225, 1335, 26, F_XB, WHITE, "l", la)
        ctx.move_to(150, 1380)
        ctx.line_to(210, 1380)
        src(ctx, RED, la)
        ctx.stroke()
        text(ctx, "UK POST-BREXIT (OBR estimate)", 225, 1380, 26, F_XB, WHITE, "l", la)
    # 4% gap marker + pop-up
    u = prog(t, EV["four"] - 0.1, EV["four"] + 0.35)
    if u > 0:
        xa, ya = P(1.0, eu_path(1.0))
        xb, yb = P(1.0, brexit_path(1.0))
        ctx.move_to(xa + 30, ya)
        ctx.line_to(xa + 30, lerp(ya, yb, e_out(u)) - 10)
        src(ctx, RED)
        ctx.set_line_width(8)
        ctx.stroke()
        arrow_head(ctx, xa + 30, lerp(ya, yb, e_out(u)), math.pi / 2, 22, RED)
        s = e_back(u, 2.2)
        ctx.save()
        ctx.translate(xa - 70, (ya + yb) / 2 + 2)
        ctx.scale(s, s)
        pill(ctx, "−4%", 0, 0, 50, RED, WHITE)
        ctx.restore()
        # explanatory pop-up card (top-left, empty area of the chart)
        cu = prog(t, EV["four"] + 0.25, EV["four"] + 0.6)
        if cu > 0:
            s = e_back(cu)
            ctx.save()
            ctx.translate(440, 850)
            ctx.scale(s, s)
            rrect(ctx, -290, -95, 580, 190, 22)
            src(ctx, hexc("#0B1733"), 0.95)
            ctx.fill_preserve()
            src(ctx, RED)
            ctx.set_line_width(4)
            ctx.stroke()
            text(ctx, "ESTIMATED LONG-TERM", 0, -58, 34, F_BLACK, WHITE)
            text(ctx, "PRODUCTIVITY IMPACT", 0, -18, 34, F_BLACK, WHITE)
            text(ctx, "−4% vs. staying in the EU", 0, 28, 30, F_XB, RED)
            text(ctx, "Not a 4% shrink — a smaller gain", 0, 68, 24, F_SB, MUTED)
            ctx.restore()
    source_label(ctx, "Source: Office for Budget Responsibility (OBR) · paths illustrative", ga, y=1420)


# ================================================================= scene 6: trade deals
CPTPP_PTS = {"Canada": (-100, 56), "Mexico": (-102, 23), "Peru": (-75, -10), "Chile": (-71, -33),
             "Japan": (138, 36), "Vietnam": (106, 15), "Malaysia": (102, 4), "Singapore": (103.8, 1.35),
             "Brunei": (114.7, 4.5), "Australia": (134, -25), "New Zealand": (172, -41)}


def scene_deals(ctx, lt, t):
    ma = e_out(prog(lt, 0, 0.4))
    blit(ctx, make_layer("wdeal", world_deal_layer), ma)
    ukx, uky = P_WDEAL(-1.5, 53)
    # trade routes
    for i, (name, (lon, lat)) in enumerate(CPTPP_PTS.items()):
        p2 = P_WDEAL(lon, lat)
        u = e_out(prog(lt, 0.3 + i * 0.1, 1.3 + i * 0.1))
        bend = -110 if lon < 0 else 110
        pts = curve_arrow(ctx, (ukx, uky), p2, bend, u, YELLOW, 3.5, 0.9, 0, dash=[10, 7], phase=-lt * 40)
        if u >= 1 and pts:
            ph = (lt * 0.5 + i * 0.09) % 1.0
            px, py = pts[int(ph * (len(pts) - 1))]
            ctx.arc(px, py, 6, 0, TAU)
            src(ctx, WHITE)
            ctx.fill()
        if u > 0.6:
            ctx.arc(*p2, 7, 0, TAU)
            src(ctx, GREEN)
            ctx.fill_preserve()
            src(ctx, WHITE)
            ctx.set_line_width(2)
            ctx.stroke()
    # UK pulse
    for k in range(2):
        ph = ((lt * 0.9 + k * 0.5) % 1.0)
        ctx.arc(ukx, uky, 8 + 40 * ph, 0, TAU)
        src(ctx, BLUE_L, (1 - ph))
        ctx.set_line_width(4)
        ctx.stroke()
    # legend
    la = e_out(prog(lt, 0.5, 0.9))
    for i, (lab, col) in enumerate((("CPTPP MEMBERS", GREEN), ("UK (joined Dec 2024)", BLUE_L))):
        x = 90 + i * 470
        rrect(ctx, x, 330 - 16, 30, 30, 6)
        src(ctx, col, la)
        ctx.fill()
        text(ctx, lab, x + 44, 330, 26, F_XB, WHITE, "l", la)
    # headline
    hu = prog(t, EV["powers"] - 0.3, EV["powers"] + 0.2)
    if hu > 0:
        s = e_back(hu)
        ctx.save()
        ctx.translate(W / 2, 905)
        ctx.scale(s, s)
        text(ctx, "NEW TRADE", 0, -42, 84, F_BLACK, WHITE, shadow=True)
        text(ctx, "OPPORTUNITIES", 0, 42, 84, F_BLACK, GREEN, shadow=True)
        ctx.restore()
    # info pop-up: projection, not achieved
    cu = prog(t, EV["gdp2bn"], EV["gdp2bn"] + 0.35)
    if cu > 0:
        s = e_back(cu)
        ctx.save()
        ctx.translate(W / 2, 1180)
        ctx.scale(s, s)
        rrect(ctx, -470, -150, 940, 300, 26)
        src(ctx, hexc("#0B1733"), 0.95)
        ctx.fill_preserve()
        src(ctx, GREEN)
        ctx.set_line_width(4)
        ctx.stroke()
        pill(ctx, "PROJECTION", -330, -110, 22, YELLOW, NAVY)
        text(ctx, "ESTIMATED £2 BILLION", 0, -60, 52, F_BLACK, GREEN)
        text(ctx, "LONG-TERM GDP GAIN", 0, -6, 44, F_BLACK, WHITE)
        # mini timeline 2024 -> 2040
        ctx.set_dash([12, 9])
        ctx.move_to(-340, 70)
        ctx.line_to(340, 70)
        src(ctx, WHITE, 0.8)
        ctx.set_line_width(5)
        ctx.stroke()
        ctx.set_dash([])
        ctx.arc(-340, 70, 12, 0, TAU)
        src(ctx, BLUE_L)
        ctx.fill()
        ctx.arc(340, 70, 16, 0, TAU)
        src(ctx, GREEN)
        ctx.fill()
        text(ctx, "2024 joined", -340, 112, 24, F_XB, BLUE_L)
        text(ctx, "by 2040 (projected)", 260, 112, 24, F_XB, GREEN)
        text(ctx, "Government forecast — not yet achieved", 0, 36, 24, F_SB, MUTED)
        ctx.restore()
    source_label(ctx, "Source: UK Government (Dept for Business & Trade) CPTPP impact assessment", ma)


# ================================================================= scene 7: final comparison
def scene_final(ctx, lt, t):
    q = e_inout(prog(t, EV["price"] - 0.2, EV["price"] + 0.4))
    # panels (dim and slide up when the question arrives)
    pa = e_out(prog(lt, 0, 0.4)) * (1 - 0.88 * q)
    oy = -40 * q
    for side in (0, 1):
        x0 = 30 if side == 0 else 552
        col = RED if side == 0 else GREEN
        rrect(ctx, x0, 290 + oy, 498, 1050, 28)
        src(ctx, col, 0.12 * pa)
        ctx.fill_preserve()
        src(ctx, col, 0.8 * pa)
        ctx.set_line_width(4)
        ctx.stroke()
        rrect(ctx, x0, 290 + oy, 498, 110, 28)
        src(ctx, col, 0.9 * pa)
        ctx.fill()
        text(ctx, "CHALLENGES" if side == 0 else "GAINS", x0 + 249, 345 + oy, 46, F_BLACK, WHITE, alpha=pa)
    # VS badge
    if pa > 0:
        ctx.arc(W / 2, 830 + oy, 52, 0, TAU)
        src(ctx, NAVY, pa)
        ctx.fill_preserve()
        src(ctx, WHITE, pa)
        ctx.set_line_width(4)
        ctx.stroke()
        text(ctx, "VS", W / 2, 830 + oy, 40, F_BLACK, WHITE, alpha=pa)
    left = [(icon_box, "Goods exports", "to EU −14%"),
            (icon_gauge, "Productivity", "−4% (OBR est.)"),
            (icon_people, "Migration", "shifted to non-EU")]
    right = [(icon_pen, "Independent", "trade powers"),
             (icon_globe, "Joined", "CPTPP"),
             (icon_chart_up, "£2bn GDP gain", "projected by 2040")]
    for side, items, key in ((1, right, "control"), (0, left, "challenges")):
        x0 = 30 if side == 0 else 552
        col = RED if side == 0 else GREEN
        for i, (ic, l1, l2) in enumerate(items):
            u = prog(t, EV[key] - 0.3 + i * 0.22, EV[key] + 0.05 + i * 0.22)
            if u <= 0:
                continue
            a = e_out(u) * (1 - 0.92 * q)
            cy = 520 + i * 285 + oy
            sx = (1 - e_out(u)) * (-60 if side == 0 else 60)
            ctx.save()
            ctx.translate(sx, 0)
            ctx.push_group()
            ctx.arc(x0 + 249, cy, 62, 0, TAU)
            src(ctx, col, 0.25)
            ctx.fill()
            ic(ctx, x0 + 249, cy, 38, WHITE if ic is icon_pen else col if ic is not icon_box else ORANGE)
            text(ctx, l1, x0 + 249, cy + 100, 36, F_BLACK, WHITE)
            text(ctx, l2, x0 + 249, cy + 145, 32, F_XB, col if side else hexc("#FCA5A5"))
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(a)
            ctx.restore()
    # big question
    if q > 0:
        s = e_back(prog(t, EV["price"] - 0.1, EV["price"] + 0.35))
        ctx.save()
        ctx.translate(W / 2, 640)
        ctx.scale(s, s)
        text(ctx, "DID BRITAIN", 0, -70, 104, F_BLACK, WHITE, shadow=True)
        font(ctx, F_BLACK, 112)
        parts = [("WIN", GREEN), (" OR ", WHITE), ("LOSE?", RED)]
        tw = sum(ctx.text_extents(p).x_advance for p, _ in parts)
        x = -tw / 2
        for p, c in parts:
            x += text(ctx, p, x, 52, 112, F_BLACK, c, "l", shadow=True)
        ctx.restore()
    # WIN / LOSE buttons
    for key, x, lab, col, down in (("win", 290, "WIN", GREEN, False), ("lose", 790, "LOSE", RED, True)):
        u = prog(t, EV[key] - 0.15, EV[key] + 0.2)
        if u <= 0:
            continue
        pulse = 1 + 0.05 * math.sin((t - EV[key]) * 9) * prog(t, EV[key] + 0.3, EV[key] + 0.6)
        s = e_back(u, 2.4) * pulse
        ctx.save()
        ctx.translate(x, 960)
        ctx.scale(s, s)
        rrect(ctx, -210, -90, 420, 180, 40)
        src(ctx, col)
        ctx.fill()
        icon_thumb(ctx, -110, 0 if not down else 6, 40, WHITE, down)
        text(ctx, lab, 50, 0, 74, F_BLACK, WHITE)
        ctx.restore()
    # CTA
    cu = prog(t, EV["decide"] - 0.1, EV["decide"] + 0.3)
    if cu > 0:
        pulse = 1 + 0.04 * math.sin(t * 8) * prog(t, EV["decide"] + 0.4, EV["decide"] + 0.8)
        s = e_back(cu) * pulse
        ctx.save()
        ctx.translate(W / 2, 1210)
        ctx.scale(s, s)
        rrect(ctx, -440, -70, 880, 140, 70)
        src(ctx, YELLOW)
        ctx.fill()
        icon_comment(ctx, -350, -2, 40, NAVY)
        text(ctx, "COMMENT: WIN OR LOSE?", 40, 0, 52, F_BLACK, NAVY)
        ctx.restore()


SCENE_FN = {"hook": scene_hook, "timeline": scene_timeline, "trade": scene_trade, "migr": scene_migr,
            "economy": scene_economy, "deals": scene_deals, "final": scene_final}
CHIPS = {"hook": None, "timeline": ("THE BREXIT TIMELINE", hexc("#1D4ED8")),
         "trade": ("01 · TRADE", hexc("#1D4ED8")), "migr": ("02 · IMMIGRATION", hexc("#C2410C")),
         "economy": ("03 · THE ECONOMY", hexc("#B91C1C")), "deals": ("04 · NEW TRADE DEALS", hexc("#15803D")),
         "final": ("THE VERDICT?", hexc("#6D28D9"))}
ORDER = list(SCENES.keys())
TD = 0.42   # transition duration


def draw_scene(ctx, name, t):
    a, b = SCENES[name]
    SCENE_FN[name](ctx, max(0.0, t - a), t)


def render_frame(t):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    background(ctx, t)
    # which scene(s)
    cur = next(n for n in ORDER if SCENES[n][0] <= t < SCENES[n][1]) if t < DURATION else ORDER[-1]
    idx = ORDER.index(cur)
    a, b = SCENES[cur]
    in_tr = None
    if idx > 0 and t < a + TD / 2:
        in_tr = (ORDER[idx - 1], cur, (t - (a - TD / 2)) / TD)
    elif idx < len(ORDER) - 1 and t >= b - TD / 2:
        in_tr = (cur, ORDER[idx + 1], (t - (b - TD / 2)) / TD)
    chip_alpha = 1.0
    if in_tr:
        prev, nxt, u = in_tr
        e = e_inout(clamp(u))
        if prev == "hook":
            # fast zoom transition
            ctx.save()
            z = 1 + 1.6 * e
            ctx.translate(W / 2, 900)
            ctx.scale(z, z)
            ctx.translate(-W / 2, -900)
            ctx.push_group()
            draw_scene(ctx, prev, t)
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(1 - e)
            ctx.restore()
            ctx.save()
            z = 1.25 - 0.25 * e
            ctx.translate(W / 2, 900)
            ctx.scale(z, z)
            ctx.translate(-W / 2, -900)
            ctx.push_group()
            draw_scene(ctx, nxt, t)
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(e)
            ctx.restore()
        else:
            ctx.save()
            ctx.translate(-W * e, 0)
            draw_scene(ctx, prev, t)
            ctx.restore()
            ctx.save()
            ctx.translate(W * (1 - e), 0)
            draw_scene(ctx, nxt, t)
            ctx.restore()
        chip_name = nxt if u >= 0.5 else prev
        chip_alpha = abs(u - 0.5) * 2
    else:
        draw_scene(ctx, cur, t)
        chip_name = cur
    chip = CHIPS[chip_name]
    chrome(ctx, t, (chip[0], chip[1], chip_alpha) if chip else None)
    subtitles(ctx, t)
    return surf


def frame_bytes(i):
    surf = render_frame(i / FPS)
    return bytes(surf.get_data())


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
    n = int(DURATION * FPS)
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-i", AUDIO, "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
           "-t", f"{DURATION:.3f}", OUT_FILE]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(args.workers) as pool:
        for k, data in enumerate(pool.imap(frame_bytes, range(n), chunksize=8)):
            proc.stdin.write(data)
            if k % 150 == 0:
                print(f"frame {k}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", OUT_FILE)


if __name__ == "__main__":
    main()

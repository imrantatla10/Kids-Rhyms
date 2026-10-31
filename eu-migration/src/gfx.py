"""Shared flat-2D drawing helpers (cairo): text, pills, arrows, flags, icons, map layers, chrome, subtitles."""
import argparse
import math
import os
import subprocess
from multiprocessing import Pool

import cairo

import geo
from timeline import CHUNKS, DURATION, H, W


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


BRAND = ""


def chrome(ctx, t, chip):
    # progress bar
    src(ctx, WHITE, 0.12)
    ctx.rectangle(0, 0, W, 8)
    ctx.fill()
    src(ctx, YELLOW)
    ctx.rectangle(0, 0, W * t / DURATION, 8)
    ctx.fill()
    text(ctx, BRAND, W / 2, 112, 28, F_XB, MUTED, spacing=2.5)
    if chip:
        label, color, a = chip
        if a > 0:
            pill(ctx, label, W / 2, 182, 38, color, WHITE, F_BLACK, alpha=a, spacing=1.5)


def source_label(ctx, s, alpha, y=1398):
    if alpha <= 0:
        return
    w = text_w(ctx, s, F_MED, 23)
    rrect(ctx, W / 2 - w / 2 - 18, y - 20, w + 36, 40, 20)
    src(ctx, hexc("#050B1A"), 0.7 * alpha)
    ctx.fill()
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


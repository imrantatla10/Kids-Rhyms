"""Render "The Magic Animal Train – Learn Your ABCs!" as a vertical 1080x1920 video.

Everything is drawn procedurally with cairo, frame by frame, and piped to ffmpeg
together with audio/final_mix.wav.

    python3 render_video.py                 # full render -> output/*.mp4
    python3 render_video.py --stills 3,15   # PNG previews into output/stills/
"""
import argparse
import math
import os
import subprocess
import sys
from multiprocessing import Pool

import cairo

from timeline import BEAT, DURATION, EVENTS as EV, FPS, H, SCENES, VOICE_START, W

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "output")
AUDIO = os.path.join(ROOT, "audio", "final_mix.wav")
OUT_FILE = os.path.join(OUT_DIR, "The_Magic_Animal_Train_ABC_vertical.mp4")

FONT = "Luckiest Guy"
TAU = 2 * math.pi
TRACK_Y = 1450.0          # rail top (world y == screen y at the zoom pivot)
GROUND_Y = 1735.0         # where animals stand on the grass in front of the track
CAR_Y = 1360.0            # animal feet inside a carriage
L_ENG, CAR_W, GAP = 440.0, 300.0, 22.0


# ============================================================ small helpers
def hexc(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


OUT = hexc("#2B1B3D")
WHITE = hexc("#FFFFFF")


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def lerp(a, b, u):
    return a + (b - a) * u


def smooth(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


def sstep(t, t0, t1):
    return smooth((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t1)


def ease_out(u):
    u = clamp(u)
    return 1 - (1 - u) ** 3


def elastic(u):
    u = clamp(u)
    if u in (0.0, 1.0):
        return u
    return 2 ** (-10 * u) * math.sin((u * 10 - 0.75) * TAU / 3) + 1


def lerp_col(c1, c2, u):
    return tuple(lerp(a, b, u) for a, b in zip(c1, c2))


def src(ctx, c):
    ctx.set_source_rgba(*c)


def ellipse(ctx, x, y, rx, ry):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(max(rx, 0.01), max(ry, 0.01))
    ctx.new_sub_path()
    ctx.arc(0, 0, 1, 0, TAU)
    ctx.restore()


def rrect(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    ctx.close_path()


def paint(ctx, fill, lw=6.0, outline=OUT):
    """Fill the current path, then stroke it with a cartoon outline."""
    src(ctx, fill)
    if lw > 0:
        ctx.fill_preserve()
        src(ctx, outline)
        ctx.set_line_width(lw)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.stroke()
    else:
        ctx.fill()


def blob_ellipse(ctx, x, y, rx, ry, fill, lw=6.0):
    ellipse(ctx, x, y, rx, ry)
    paint(ctx, fill, lw)


def circle(ctx, x, y, r, fill, lw=6.0):
    ellipse(ctx, x, y, r, r)
    paint(ctx, fill, lw)


def limb(ctx, x, y, length, ang, width, fill, lw=6.0):
    """Capsule limb starting at (x,y) pointing along ang (0 = right, -pi/2 = up)."""
    x2, y2 = x + length * math.cos(ang), y + length * math.sin(ang)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.move_to(x, y)
    ctx.line_to(x2, y2)
    src(ctx, OUT)
    ctx.set_line_width(width + 2 * lw)
    ctx.stroke()
    ctx.move_to(x, y)
    ctx.line_to(x2, y2)
    src(ctx, fill)
    ctx.set_line_width(width)
    ctx.stroke()
    return x2, y2


def curve_stroke(ctx, pts, width, fill, lw=6.0):
    for wdt, col in ((width + 2 * lw, OUT), (width, fill)):
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.move_to(*pts[0])
        ctx.curve_to(*pts[1], *pts[2], *pts[3])
        src(ctx, col)
        ctx.set_line_width(wdt)
        ctx.stroke()


def poly(ctx, pts):
    ctx.move_to(*pts[0])
    for p in pts[1:]:
        ctx.line_to(*p)
    ctx.close_path()


def star_path(ctx, x, y, r, rot=0.0, points=5, inner=0.45):
    for i in range(points * 2):
        rr = r if i % 2 == 0 else r * inner
        a = rot - math.pi / 2 + i * math.pi / points
        (ctx.move_to if i == 0 else ctx.line_to)(x + rr * math.cos(a), y + rr * math.sin(a))
    ctx.close_path()


def text_size(ctx, s, size, font=FONT):
    ctx.select_font_face(font, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)
    return ctx.text_extents(s)


def text_c(ctx, s, x, y, size, fill, ow=10.0, outline=OUT, shadow=True, font=FONT):
    ext = text_size(ctx, s, size, font)
    tx = x - ext.width / 2 - ext.x_bearing
    ty = y - ext.height / 2 - ext.y_bearing
    if shadow:
        ctx.move_to(tx + size * 0.04, ty + size * 0.06)
        ctx.text_path(s)
        src(ctx, (0, 0, 0, 0.25 * fill[3]))
        ctx.fill()
    ctx.move_to(tx, ty)
    ctx.text_path(s)
    if ow > 0:
        src(ctx, (*outline[:3], fill[3]))
        ctx.set_line_width(ow)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.stroke_preserve()
    src(ctx, fill)
    ctx.fill()
    return ext


def hash01(*a):
    v = math.sin(sum(x * k for x, k in zip(a, (12.9898, 78.233, 37.719, 4.581)))) * 43758.5453
    return v - math.floor(v)


# ============================================================ train motion
def _move(t, t0, t1, p0, p1):
    return lerp(p0, p1, smooth((t - t0) / (t1 - t0)))


MOVES = [  # (t0, t1, P0, P1, off0, off1)
    (10.0, 12.8, 0.0, 2400.0, 330.0, 520.0),
    (19.3, 21.8, 2400.0, 4600.0, 520.0, 850.0),
    (28.0, 30.5, 4600.0, 7000.0, 850.0, 1417.0),
    (39.6, 41.8, 7000.0, 9200.0, 1417.0, 2061.0),
]
R_T0, R_ACC, R_DEC0, R_DEC1, R_V = 48.6, 1.5, 59.0, 61.6, 800.0


def train_P(t):
    """World x of the engine's front buffer."""
    if t < 4.5:
        return lerp(-1900.0, 0.0, ease_out(t / 4.5))
    P = 0.0
    for t0, t1, p0, p1, _, _ in MOVES:
        if t < t0:
            return P
        if t < t1:
            return _move(t, t0, t1, p0, p1)
        P = p1
    if t < R_T0:
        return P
    # rainbow run: accelerate, cruise, decelerate to a stop
    dt = t - R_T0
    if dt < R_ACC:
        return P + R_V * dt * dt / (2 * R_ACC)
    P += R_V * R_ACC / 2
    if t < R_DEC0:
        return P + R_V * (t - R_T0 - R_ACC)
    P += R_V * (R_DEC0 - R_T0 - R_ACC)
    T = R_DEC1 - R_DEC0
    d = clamp(t - R_DEC0, 0, T)
    return P + R_V * (d - d * d / (2 * T))


def train_speed(t):
    return (train_P(t + 0.02) - train_P(t - 0.02)) / 0.04


def cam_off(t):
    off = 330.0
    for t0, t1, _, _, o0, o1 in MOVES:
        if t < t0:
            return off
        if t < t1:
            return _move(t, t0, t1, o0, o1)
        off = o1
    off = lerp(off, 250.0, sstep(t, 49.4, 57.6))
    off = lerp(off, 1186.0, sstep(t, 58.6, 60.4))
    return off


def cam_x(t):
    if t < 4.5:
        return -330.0
    return train_P(t) - cam_off(t)


def zoom(t):
    z = 0.82
    z = lerp(z, 1.0, sstep(t, 10.0, 12.8))
    z = lerp(z, 0.64, sstep(t, 48.8, 50.6))
    z = lerp(z, 0.44, sstep(t, 58.6, 60.4))
    return z


def car_center_off(k):
    return L_ENG + GAP + (k - 1) * (CAR_W + GAP) + CAR_W / 2


class Cam:
    def __init__(self, t):
        self.x = cam_x(t)
        self.z = zoom(t)

    def apply(self, ctx):
        ctx.translate(W / 2, TRACK_Y)
        ctx.scale(self.z, self.z)
        ctx.translate(-self.x, -TRACK_Y)

    def sx(self, wx):
        return W / 2 + (wx - self.x) * self.z


# ============================================================ background
def sky_colors(t):
    rf = sstep(t, 48.6, 50.2) * (1 - sstep(t, 58.6, 60.2))
    top = lerp_col(hexc("#5BB8FF"), hexc("#8E7CFF"), rf)
    bot = lerp_col(hexc("#CDEFFF"), hexc("#FFC7E8"), rf)
    return top, bot, rf


def draw_sky(ctx, t, cam):
    top, bot, rf = sky_colors(t)
    g = cairo.LinearGradient(0, 0, 0, 1370)
    g.add_color_stop_rgba(0, *top)
    g.add_color_stop_rgba(1, *bot)
    ctx.set_source(g)
    ctx.rectangle(0, 0, W, H)
    ctx.fill()

    # sun (fades out for the outro letter row)
    sun_a = 1 - sstep(t, 58.6, 59.2)
    sx, sy = 930, 300
    ctx.push_group()
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(t * 0.25)
    for i in range(12):
        ctx.rotate(TAU / 12)
        poly(ctx, [(0, -105), (14, -150), (-14, -150)])
        src(ctx, hexc("#FFC93C", 0.9))
        ctx.fill()
    ctx.restore()
    gl = cairo.RadialGradient(sx, sy, 40, sx, sy, 190)
    gl.add_color_stop_rgba(0, *hexc("#FFF3B0", 0.7))
    gl.add_color_stop_rgba(1, *hexc("#FFF3B0", 0.0))
    ctx.set_source(gl)
    ctx.arc(sx, sy, 190, 0, TAU)
    ctx.fill()
    circle(ctx, sx, sy, 85, hexc("#FFD93D"), 6)
    # sun face
    for ex in (-26, 26):
        blob_ellipse(ctx, sx + ex, sy - 12, 7, 10, OUT, 0)
    ctx.arc(sx, sy + 8, 30, 0.2 * math.pi, 0.8 * math.pi)
    src(ctx, OUT)
    ctx.set_line_width(6)
    ctx.stroke()
    for ex in (-48, 48):
        blob_ellipse(ctx, sx + ex, sy + 18, 13, 8, hexc("#FF8FA3", 0.7), 0)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(sun_a)

    # twinkling stars in the rainbow sky
    if rf > 0.01:
        for i in range(40):
            x = (hash01(i, 1) * W * 1.3 - cam.x * 0.03 * (1 + hash01(i, 2))) % W
            y = hash01(i, 3) * 1000
            tw = 0.5 + 0.5 * math.sin(t * (2 + 3 * hash01(i, 4)) + i)
            star_path(ctx, x, y, 8 + 10 * hash01(i, 5), t + i)
            src(ctx, (1, 1, 1, rf * (0.3 + 0.7 * tw)))
            ctx.fill()

    # fluffy clouds
    for i in range(6):
        span = W + 700
        x = (hash01(i, 7) * span + t * (10 + 8 * hash01(i, 8)) - cam.x * 0.06) % span - 350
        y = 160 + i * 150 + 40 * hash01(i, 9)
        s = 0.8 + 0.6 * hash01(i, 10)
        draw_cloud(ctx, x, y, s, 0.95)


def draw_cloud(ctx, x, y, s, a=1.0):
    lobes = [(-90, 10, 55), (-35, -30, 70), (35, -25, 65), (95, 10, 50), (0, 20, 60)]
    for dx, dy, r in lobes:
        ellipse(ctx, x + dx * s, y + dy * s + 6, r * s + 4, r * s + 4)
    src(ctx, hexc("#B9D9F5", 0.8 * a))
    ctx.fill()
    for dx, dy, r in lobes:
        ellipse(ctx, x + dx * s, y + dy * s, r * s, r * s)
    src(ctx, (1, 1, 1, a))
    ctx.fill()


def hill_path(ctx, base, amp, freq, phase, scroll):
    ctx.move_to(0, H)
    for i in range(0, W + 41, 40):
        x = i
        wx = x + scroll
        y = base - amp * (0.6 * math.sin(wx * freq + phase) + 0.4 * math.sin(wx * freq * 2.3 + phase * 1.7))
        ctx.line_to(x, y)
    ctx.line_to(W, H)
    ctx.close_path()


def draw_land(ctx, t, cam):
    rf = sky_colors(t)[2]
    far = lerp_col(hexc("#9BE07A"), hexc("#B8A6FF"), rf * 0.6)
    near = lerp_col(hexc("#5CC94E"), hexc("#7FD0A0"), rf * 0.5)
    hill_path(ctx, 1230, 70, 0.0035, 0.5, cam.x * 0.15)
    paint(ctx, far, 0)
    # little distant trees on the far hills
    for i in range(-1, 9):
        sp = 260
        wx = math.floor(cam.x * 0.15 / sp) * sp + i * sp
        x = wx - cam.x * 0.15
        yb = 1230 - 70 * (0.6 * math.sin(wx * 0.0035 + 0.5) + 0.4 * math.sin(wx * 0.0035 * 2.3 + 0.85))
        if hash01(wx, 11) > 0.45:
            ellipse(ctx, x, yb - 30, 22, 34)
            paint(ctx, hexc("#3FA34D"), 0)
    hill_path(ctx, 1330, 55, 0.005, 2.0, cam.x * 0.4)
    paint(ctx, near, 0)
    for i in range(-1, 8):
        sp = 340
        wx = math.floor(cam.x * 0.4 / sp) * sp + i * sp
        x = wx - cam.x * 0.4
        yb = 1330 - 55 * (0.6 * math.sin(wx * 0.005 + 2.0) + 0.4 * math.sin(wx * 0.005 * 2.3 + 3.4))
        if hash01(wx, 12) > 0.35:
            draw_tree(ctx, x, yb + 10, 0.8 + 0.4 * hash01(wx, 13))
    # meadow band behind the track
    ctx.rectangle(0, 1360, W, H - 1360)
    src(ctx, hexc("#6BD25A"))
    ctx.fill()


def draw_tree(ctx, x, y, s):
    ctx.rectangle(x - 10 * s, y - 70 * s, 20 * s, 70 * s)
    paint(ctx, hexc("#9C6B3C"), 4)
    for dx, dy, r in ((-28, -95, 38), (28, -95, 38), (0, -130, 45)):
        ellipse(ctx, x + dx * s, y + dy * s, r * s + 3, r * s + 3)
        src(ctx, OUT)
        ctx.fill()
    for dx, dy, r in ((-28, -95, 38), (28, -95, 38), (0, -130, 45)):
        ellipse(ctx, x + dx * s, y + dy * s, r * s, r * s)
        src(ctx, hexc("#2FA84F"))
        ctx.fill()
    ellipse(ctx, x - 12 * s, y - 145 * s, 14 * s, 10 * s)
    src(ctx, hexc("#7FE08A", 0.8))
    ctx.fill()


def draw_track(ctx, cam):
    """Track in world space (call with camera transform applied)."""
    half = W / 2 / cam.z + 200
    x0, x1 = cam.x - half, cam.x + half
    # gravel bed
    ctx.rectangle(x0, TRACK_Y - 6, x1 - x0, 52)
    src(ctx, hexc("#C8A27A"))
    ctx.fill()
    sp = 70
    k0 = math.floor(x0 / sp)
    for k in range(k0, k0 + int((x1 - x0) / sp) + 2):
        rrect(ctx, k * sp, TRACK_Y + 2, 38, 30, 6)
        paint(ctx, hexc("#8B5A2B"), 3)
    for yy in (TRACK_Y - 6, TRACK_Y + 26):
        ctx.rectangle(x0, yy, x1 - x0, 12)
        paint(ctx, hexc("#9AA6B2"), 3)


def draw_foreground(ctx, t, cam):
    """Flowers + grass tufts in front of the track (world space, parallax 1)."""
    half = W / 2 / cam.z + 200
    x0, x1 = cam.x - half, cam.x + half
    sp = 95
    k0 = math.floor(x0 / sp)
    for k in range(k0, k0 + int((x1 - x0) / sp) + 2):
        h = hash01(k, 21)
        x = k * sp + 40 * hash01(k, 22)
        y = TRACK_Y + 110 + 330 * hash01(k, 23)
        if h < 0.45:
            # grass tuft
            for j in (-1, 0, 1):
                ctx.move_to(x + j * 10, y)
                ctx.line_to(x + j * 18, y - 30 - 10 * (j == 0))
            src(ctx, hexc("#3E9E3E"))
            ctx.set_line_width(6)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.stroke()
        elif h < 0.8:
            col = ["#FF5D8F", "#FFD23F", "#FFFFFF", "#B388FF"][int(hash01(k, 24) * 4)]
            ctx.move_to(x, y)
            ctx.line_to(x, y - 34)
            src(ctx, hexc("#2E8B3E"))
            ctx.set_line_width(5)
            ctx.stroke()
            sw = 0.15 * math.sin(t * 3 + k)
            for p in range(5):
                a = p * TAU / 5 + sw
                ellipse(ctx, x + 13 * math.cos(a), y - 38 + 13 * math.sin(a), 10, 10)
                paint(ctx, hexc(col), 3)
            circle(ctx, x, y - 38, 8, hexc("#FFB703"), 3)


def draw_station(ctx, t):
    """Magic Station building (world space) near the arrival stop."""
    cx = -230.0
    base = TRACK_Y - 30
    # platform
    ctx.rectangle(cx - 520, base, 1040, 24)
    paint(ctx, hexc("#D9D2E9"), 4)
    # building
    rrect(ctx, cx - 300, base - 330, 600, 330, 10)
    paint(ctx, hexc("#FFF1D6"), 6)
    for i in range(-2, 3):
        rrect(ctx, cx + i * 110 - 35, base - 280, 70, 110, 30)
        paint(ctx, hexc("#9AD0FF"), 5)
    # striped awning
    for i in range(10):
        x = cx - 330 + i * 66
        poly(ctx, [(x, base - 330), (x + 66, base - 330), (x + 66, base - 380), (x, base - 380)])
        paint(ctx, hexc("#FF5D73" if i % 2 == 0 else "#FFFFFF"), 4)
    for i in range(10):
        ctx.arc(cx - 297 + i * 66, base - 330, 33, 0, math.pi)
        src(ctx, hexc("#FF5D73" if i % 2 == 0 else "#FFFFFF"))
        ctx.fill_preserve()
        src(ctx, OUT)
        ctx.set_line_width(4)
        ctx.stroke()
    # roof + sign
    poly(ctx, [(cx - 340, base - 380), (cx, base - 520), (cx + 340, base - 380)])
    paint(ctx, hexc("#7B5CFF"), 6)
    sy = base - 610
    rrect(ctx, cx - 300, sy - 70, 600, 140, 30)
    paint(ctx, hexc("#5B2DB8"), 7)
    text_c(ctx, "MAGIC STATION", cx, sy + 4, 74, hexc("#FFE45E"), 8, shadow=False)
    for i in range(7):
        a = t * 1.5 + i * TAU / 7
        x = cx + 340 * math.cos(a) * 1.0
        y = sy + 110 * math.sin(a)
        star_path(ctx, x, y, 16 + 6 * math.sin(t * 5 + i), t * 2 + i)
        paint(ctx, hexc("#FFE45E"), 3)
    # lamp posts
    for lx in (cx - 450, cx + 450):
        ctx.rectangle(lx - 8, base - 300, 16, 300)
        paint(ctx, hexc("#3D3B8E"), 4)
        circle(ctx, lx, base - 315, 26, hexc("#FFF59D"), 5)


def draw_rainbow_ring(ctx, ax, half, alpha):
    """Half of a rainbow ring around the track (half: 'back' or 'front')."""
    cols = ["#FF4D4D", "#FF9F1C", "#FFE14D", "#4CD964", "#3A86FF", "#5E60CE", "#B15EFF"]
    cy = TRACK_Y - 230
    rx, ry = 150, 520
    a0, a1 = (math.pi / 2, 1.5 * math.pi) if half == "back" else (-math.pi / 2, math.pi / 2)
    for i, c in enumerate(cols):
        r_scale = 1 - i * 0.055
        ctx.save()
        ctx.translate(ax, cy)
        ctx.scale(rx * r_scale, ry * r_scale)
        ctx.new_sub_path()
        ctx.arc(0, 0, 1, a0, a1)
        ctx.restore()
        src(ctx, hexc(c, alpha))
        ctx.set_line_width(30)
        ctx.set_line_cap(cairo.LINE_CAP_BUTT)
        ctx.stroke()


RING_X0, RING_SP = 9900.0, 900.0


def rainbow_rings(cam, t):
    if not (48.0 < t < 61.5):
        return []
    half = W / 2 / cam.z + 400
    out = []
    k0 = max(0, math.floor((cam.x - half - RING_X0) / RING_SP))
    for k in range(k0, k0 + 6):
        ax = RING_X0 + k * RING_SP
        if ax > 17600:
            break
        if cam.x - half < ax < cam.x + half:
            out.append(ax)
    return out


# ============================================================ eyes / faces
def eye(ctx, x, y, rx, ry, t, seed=0.0, look=(0.25, 0.1), lid=0.0):
    ph = (t + seed * 1.7) % 3.6
    blink = 1.0 if ph < 0.12 else 0.0
    if blink:
        ctx.move_to(x - rx, y)
        ctx.curve_to(x - rx * 0.4, y + ry * 0.5, x + rx * 0.4, y + ry * 0.5, x + rx, y)
        src(ctx, OUT)
        ctx.set_line_width(6)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()
        return
    blob_ellipse(ctx, x, y, rx, ry, WHITE, 5)
    px, py = x + look[0] * rx, y + look[1] * ry
    blob_ellipse(ctx, px, py, rx * 0.58, ry * 0.6, hexc("#1B1030"), 0)
    blob_ellipse(ctx, px - rx * 0.2, py - ry * 0.25, rx * 0.2, ry * 0.2, WHITE, 0)
    if lid > 0:  # half-closed clever eyelid
        ctx.save()
        ellipse(ctx, x, y, rx + 1, ry + 1)
        ctx.clip()
        ctx.rectangle(x - rx - 2, y - ry - 2, 2 * rx + 4, 2 * ry * lid + 2)
        src(ctx, hexc("#F57C20"))
        ctx.fill()
        ctx.restore()
        ctx.move_to(x - rx, y - ry + 2 * ry * lid)
        ctx.line_to(x + rx, y - ry + 2 * ry * lid)
        src(ctx, OUT)
        ctx.set_line_width(5)
        ctx.stroke()


def smile(ctx, x, y, r, open_=0.0, lw=6):
    if open_ > 0.05:
        ctx.move_to(x - r, y)
        ctx.curve_to(x - r * 0.6, y + r * 1.3 * open_ + r * 0.3, x + r * 0.6,
                     y + r * 1.3 * open_ + r * 0.3, x + r, y)
        ctx.close_path()
        paint(ctx, hexc("#B5243E"), lw)
        ellipse(ctx, x, y + r * 0.55 * open_ + r * 0.15, r * 0.45, r * 0.25 * open_ + 3)
        src(ctx, hexc("#FF8FA3"))
        ctx.fill()
    else:
        ctx.arc(x, y - r * 0.6, r, 0.2 * math.pi, 0.8 * math.pi)
        src(ctx, OUT)
        ctx.set_line_width(lw)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()


def cheeks(ctx, x1, x2, y, r=14):
    for x in (x1, x2):
        blob_ellipse(ctx, x, y, r, r * 0.65, hexc("#FF7AA2", 0.55), 0)


# ============================================================ animals
# Each animal is drawn in local coords: feet at (0,0), up is negative y, ~290 tall.
def animal_body(ctx, col, belly, arm_l, arm_r, arm_len=58, leg_col=None):
    leg_col = leg_col or col
    blob_ellipse(ctx, -34, -18, 28, 22, leg_col)
    blob_ellipse(ctx, 34, -18, 28, 22, leg_col)
    limb(ctx, -52, -118, arm_len, arm_l, 28, col)
    limb(ctx, 52, -118, arm_len, arm_r, 28, col)
    blob_ellipse(ctx, 0, -85, 66, 72, col)
    if belly:
        blob_ellipse(ctx, 0, -76, 42, 48, belly, 0)


def draw_bear(ctx, t, pose):
    br, tan = hexc("#9A5B2E"), hexc("#E8B886")
    animal_body(ctx, br, tan, pose["al"], pose["ar"])
    for ex in (-56, 56):
        circle(ctx, ex, -258, 28, br)
        circle(ctx, ex, -258, 14, tan, 0)
    circle(ctx, 0, -200, 80, br)
    blob_ellipse(ctx, 0, -172, 40, 30, tan, 5)
    blob_ellipse(ctx, 0, -186, 15, 11, hexc("#2B1B3D"), 0)
    eye(ctx, -32, -218, 13, 16, t, 1)
    eye(ctx, 32, -218, 13, 16, t, 1)
    smile(ctx, 0, -158, 16, pose["mouth"], 5)
    cheeks(ctx, -55, 55, -180)


def draw_cat(ctx, t, pose):
    fur, inner = hexc("#FFC98B"), hexc("#FFE9D2")
    # curly tail
    sw = 20 * math.sin(t * 4)
    curve_stroke(ctx, [(45, -40), (120, -60), (110 + sw, -170), (70 + sw, -180)], 22, fur)
    animal_body(ctx, fur, inner, pose["al"], pose["ar"])
    # fluffy head: scalloped outline
    lobes = [(math.cos(a) * 74, -200 + math.sin(a) * 70) for a in [i * TAU / 14 for i in range(14)]]
    for x, y in lobes:
        ellipse(ctx, x, y, 25, 25)
    src(ctx, OUT)
    ctx.fill()
    for ex in (-1, 1):  # ears
        poly(ctx, [(ex * 30, -262), (ex * 76, -300), (ex * 72, -228)])
        paint(ctx, fur)
        poly(ctx, [(ex * 40, -258), (ex * 68, -284), (ex * 66, -240)])
        paint(ctx, hexc("#FF9BB5"), 0)
    for x, y in lobes:
        ellipse(ctx, x, y, 20, 20)
    src(ctx, fur)
    ctx.fill()
    ellipse(ctx, 0, -200, 76, 70)
    src(ctx, fur)
    ctx.fill()
    blob_ellipse(ctx, 0, -172, 44, 30, inner, 0)
    eye(ctx, -30, -215, 14, 18, t, 2, look=(0.2, 0.15))
    eye(ctx, 30, -215, 14, 18, t, 2, look=(0.2, 0.15))
    poly(ctx, [(-9, -188), (9, -188), (0, -178)])
    paint(ctx, hexc("#FF6F91"), 3)
    smile(ctx, -9, -170, 9, 0, 4)
    smile(ctx, 9, -170, 9, pose["mouth"] * 0.6, 4)
    for s in (-1, 1):
        for dy in (-6, 6):
            ctx.move_to(s * 40, -178 + dy)
            ctx.line_to(s * 92, -184 + dy * 2.2)
    src(ctx, OUT)
    ctx.set_line_width(3)
    ctx.stroke()
    cheeks(ctx, -52, 52, -182, 12)


def draw_dog(ctx, t, pose):
    fur, ear, spot = hexc("#F6D3A0"), hexc("#A0522D"), hexc("#C77D46")
    wag = 0.6 * math.sin(t * 14)
    limb(ctx, 50, -60, 50, -0.6 + wag, 18, fur)
    animal_body(ctx, fur, hexc("#FFF1DD"), pose["al"], pose["ar"])
    circle(ctx, 0, -200, 78, fur)
    blob_ellipse(ctx, 30, -222, 26, 24, spot, 0)
    for s in (-1, 1):  # floppy ears
        ctx.save()
        ctx.translate(s * 70, -236)
        ctx.rotate(s * (0.35 + 0.15 * math.sin(t * 6)))
        ellipse(ctx, 0, 40, 24, 54)
        paint(ctx, ear)
        ctx.restore()
    blob_ellipse(ctx, 0, -170, 40, 28, hexc("#FFF1DD"), 4)
    blob_ellipse(ctx, 0, -186, 16, 12, hexc("#2B1B3D"), 0)
    eye(ctx, -30, -218, 13, 16, t, 3)
    eye(ctx, 30, -218, 13, 16, t, 3)
    # tongue
    rrect(ctx, -10, -162, 20, 28 + 6 * pose["mouth"], 10)
    paint(ctx, hexc("#FF6F91"), 4)
    smile(ctx, -12, -158, 12, 0, 4)
    smile(ctx, 12, -158, 12, 0, 4)


def draw_elephant(ctx, t, pose):
    sk, pink = hexc("#A7BCDD"), hexc("#F7B6C8")
    animal_body(ctx, sk, hexc("#C9D7EE"), pose["al"], pose["ar"])
    flap = 0.12 * math.sin(t * 5)
    for s in (-1, 1):
        ctx.save()
        ctx.translate(s * 72, -205)
        ctx.rotate(s * flap)
        ellipse(ctx, s * 30, 0, 62, 78)
        paint(ctx, sk)
        ellipse(ctx, s * 32, 4, 42, 56)
        paint(ctx, pink, 0)
        ctx.restore()
    circle(ctx, 0, -205, 80, sk)
    # curly trunk
    lift = 30 * math.sin(t * 3)
    curve_stroke(ctx, [(0, -180), (0, -120), (45, -110 - lift), (55, -150 - lift)], 30, sk)
    eye(ctx, -32, -225, 13, 17, t, 4)
    eye(ctx, 32, -225, 13, 17, t, 4)
    cheeks(ctx, -52, 52, -190)
    smile(ctx, -32, -165, 14, 0, 4)


def draw_fox(ctx, t, pose):
    org, wht, dark = hexc("#F57C20"), hexc("#FFF6EC"), hexc("#5D3A1A")
    # bushy tail
    sw = 0.25 * math.sin(t * 3)
    ctx.save()
    ctx.translate(45, -60)
    ctx.rotate(-0.7 + sw)
    ctx.move_to(0, 0)
    ctx.curve_to(60, -10, 150, -60, 150, -120)
    ctx.curve_to(110, -140, 40, -90, 0, -30)
    ctx.close_path()
    paint(ctx, org)
    ctx.move_to(150, -120)
    ctx.curve_to(150, -95, 130, -80, 118, -78)
    ctx.curve_to(115, -100, 125, -120, 150, -120)
    paint(ctx, wht, 0)
    ctx.restore()
    animal_body(ctx, org, wht, pose["al"], pose["ar"], leg_col=dark)
    for s in (-1, 1):
        poly(ctx, [(s * 22, -262), (s * 78, -320), (s * 74, -225)])
        paint(ctx, org)
        poly(ctx, [(s * 60, -300), (s * 78, -320), (s * 76, -290)])
        paint(ctx, dark, 0)
    circle(ctx, 0, -205, 78, org)
    # white cheeks / muzzle
    ctx.move_to(-78, -195)
    ctx.curve_to(-60, -150, -20, -135, 0, -140)
    ctx.curve_to(20, -135, 60, -150, 78, -195)
    ctx.curve_to(40, -170, -40, -170, -78, -195)
    paint(ctx, wht, 0)
    blob_ellipse(ctx, 0, -160, 13, 10, hexc("#2B1B3D"), 0)
    eye(ctx, -30, -215, 13, 15, t, 5, lid=0.35)
    eye(ctx, 30, -215, 13, 15, t, 5, lid=0.35)
    # clever raised eyebrow
    ctx.move_to(14, -246)
    ctx.line_to(48, -254)
    src(ctx, dark)
    ctx.set_line_width(6)
    ctx.stroke()
    ctx.move_to(-12, -146)
    ctx.curve_to(0, -134, 14, -134, 26, -150)
    src(ctx, OUT)
    ctx.set_line_width(5)
    ctx.stroke()


def draw_gator(ctx, t, pose):
    gr, dk, belly = hexc("#5DBB63"), hexc("#3E8E41"), hexc("#FFF3B8")
    # tail on the ground
    curve_stroke(ctx, [(-40, -30), (-110, -20), (-150, -10), (-175, -40)], 30, gr)
    animal_body(ctx, gr, belly, pose["al"], pose["ar"])
    for i in range(3):
        ctx.move_to(-30, -100 + i * 22)
        ctx.line_to(30, -100 + i * 22)
    src(ctx, hexc("#D9C77A"))
    ctx.set_line_width(4)
    ctx.stroke()
    snap = pose["mouth"]
    # head + long snout (upper jaw)
    rrect(ctx, -60, -268, 130, 120, 55)
    paint(ctx, gr)
    ctx.save()
    ctx.translate(30, -205)
    ctx.rotate(-0.25 * snap)
    rrect(ctx, 0, -42, 150, 46, 22)
    paint(ctx, gr)
    for i in range(6):  # top teeth
        x = 22 + i * 21
        poly(ctx, [(x, 4), (x + 10, 4), (x + 5, 16)])
        paint(ctx, WHITE, 3)
    blob_ellipse(ctx, 132, -30, 6, 4, dk, 0)
    ctx.restore()
    # lower jaw
    ctx.save()
    ctx.translate(30, -190)
    ctx.rotate(0.15 * snap)
    rrect(ctx, 0, 0, 140, 34, 16)
    paint(ctx, gr)
    for i in range(6):
        x = 28 + i * 19
        poly(ctx, [(x, 2), (x + 10, 2), (x + 5, -10)])
        paint(ctx, WHITE, 3)
    ctx.restore()
    # spots + eye bumps
    for x, y in ((-30, -230), (10, -250), (-40, -190)):
        blob_ellipse(ctx, x, y, 9, 6, dk, 0)
    for ex in (-18, 34):
        circle(ctx, ex, -272, 26, gr)
        eye(ctx, ex, -274, 15, 17, t, 6, look=(0.35, 0.0))
    cheeks(ctx, 0, 60, -180, 12)


ANIMALS = {
    "gator": draw_gator, "bear": draw_bear, "cat": draw_cat,
    "dog": draw_dog, "elephant": draw_elephant, "fox": draw_fox,
}

# (kind, carriage, appear, board, ground dx from carriage centre, stop P)
CAST = [
    ("gator", 1, EV["gator_appear"], EV["gator_board"], 90, 2400.0),
    ("bear", 2, EV["bear_appear"] + 0.6, EV["bear_jump"], 80, 4600.0),
    ("cat", 3, EV["cat_appear"], EV["catdog_board"], -40, 7000.0),
    ("dog", 4, EV["dog_appear"], EV["catdog_board"] + 0.35, 40, 7000.0),
    ("elephant", 5, EV["ele_appear"], EV["elefox_board"], -40, 9200.0),
    ("fox", 6, EV["fox_appear"], EV["elefox_board"] + 0.35, 40, 9200.0),
]
JUMP = 0.7


def talk(t, t0, t1):
    if t0 <= t <= t1:
        return clamp(0.5 + 0.5 * math.sin(t * 22))
    return 0.0


def animal_pose(kind, t, state, idx):
    beat = (t / BEAT) % 1.0
    bounce = abs(math.sin(math.pi * t / BEAT))
    pose = {"al": math.radians(150), "ar": math.radians(30), "mouth": 0.0,
            "bob": 0.0, "rot": 0.0, "sx": 1.0, "sy": 1.0}
    dance = state == "train" and t > SCENES["rainbow"][0]
    if state == "ground":
        pose["bob"] = -6 * bounce
        wave = math.sin(t * 9 + idx)
        pose["ar"] = math.radians(-50 + 30 * wave)
        if kind == "dog":  # dancing dog
            pose["rot"] = 0.18 * math.sin(math.pi * t / BEAT)
            pose["bob"] = -30 * bounce
            pose["al"] = math.radians(-130 + 25 * math.sin(t * 8))
            pose["ar"] = math.radians(-50 - 25 * math.sin(t * 8))
        if kind == "gator":
            pose["mouth"] = clamp(math.sin(t * 7)) if EV["gator_appear"] + 1.5 < t < EV["letter_A"] + 0.5 else 0.3
    elif state == "train":
        pose["bob"] = -5 * bounce
        pose["ar"] = math.radians(-40 + 20 * math.sin(t * 6 + idx))
        pose["al"] = math.radians(200)
    if dance:
        ph = math.pi * t / BEAT + idx * 0.8
        pose["bob"] = -26 * abs(math.sin(ph))
        pose["rot"] = 0.14 * math.sin(ph)
        up = math.sin(ph) > 0
        pose["al"] = math.radians(-140 if up else -110)
        pose["ar"] = math.radians(-40 if up else -70)
        pose["sy"] = 1 + 0.05 * math.sin(2 * ph)
        pose["mouth"] = 0.6
    if t > EV["bye"] - 0.3:  # everyone waves bye-bye
        pose["ar"] = math.radians(-60 + 35 * math.sin(t * 10 + idx))
        pose["mouth"] = 0.7
    if kind == "gator" and state != "ground" and not dance:
        pose["mouth"] = 0.3 + 0.2 * math.sin(t * 3)
    return pose


def draw_animal(ctx, kind, x, y, s, t, pose, alpha=1.0):
    ctx.save()
    ctx.translate(x, y + pose["bob"] * s)
    ctx.rotate(pose["rot"])
    ctx.scale(s * pose["sx"], s * pose["sy"])
    if alpha < 1:
        ctx.push_group()
    ANIMALS[kind](ctx, t, pose)
    if alpha < 1:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    ctx.restore()


def animal_state(entry, t):
    kind, k, appear, board, dx, stopP = entry
    car_world = stopP - car_center_off(k)
    gx = car_world + dx
    if t < appear:
        return None
    if t < board:
        u = (t - appear) / 0.6
        return ("ground", gx, GROUND_Y, 1.12 * elastic(u))
    P = train_P(t)
    cx_now = P - car_center_off(k)
    if t < board + JUMP:
        u = (t - board) / JUMP
        x = lerp(gx, cx_now, smooth(u))
        y = lerp(GROUND_Y, CAR_Y, u) - 380 * 4 * u * (1 - u)
        return ("jump", x, y, lerp(1.12, 0.86, u))
    return ("train", cx_now, CAR_Y + train_jiggle(t), 0.86)


def train_jiggle(t):
    v = abs(train_speed(t))
    return -abs(math.sin(train_P(t) * 0.02)) * 4 * min(1, v / 600)


# ============================================================ train
CAR_COLS = ["#FF5A5F", "#3A86FF", "#2EC4B6", "#FF9F1C", "#9B5DE5", "#FF70A6"]


def wheel(ctx, x, y, r, ang, col="#2F6FE0"):
    circle(ctx, x, y, r, hexc(col), 6)
    circle(ctx, x, y, r * 0.62, hexc("#7FB2FF"), 0)
    for i in range(6):
        a = ang + i * TAU / 6
        ctx.move_to(x, y)
        ctx.line_to(x + r * 0.8 * math.cos(a), y + r * 0.8 * math.sin(a))
    src(ctx, OUT)
    ctx.set_line_width(4)
    ctx.stroke()
    circle(ctx, x, y, r * 0.28, hexc("#FFD23F"), 4)


def draw_carriage(ctx, k, x, t, P):
    col = hexc(CAR_COLS[k - 1])
    y0 = TRACK_Y + train_jiggle(t)
    ang = P / 34
    wheel(ctx, x - 92, TRACK_Y - 34, 34, ang)
    wheel(ctx, x + 92, TRACK_Y - 34, 34, ang + 1)
    rrect(ctx, x - 150, y0 - 190, 300, 135, 18)
    paint(ctx, col, 6)
    rrect(ctx, x - 150, y0 - 190, 300, 26, 12)
    paint(ctx, hexc("#FFE45E"), 5)
    star_path(ctx, x, y0 - 112, 30, 0.1 * math.sin(t * 2 + k))
    paint(ctx, hexc("#FFFFFF", 0.9), 4)
    for sx in (-100, 100):
        circle(ctx, x + sx, y0 - 112, 12, hexc("#FFFFFF", 0.7), 0)


def draw_engine(ctx, t, P):
    x0 = P
    y0 = TRACK_Y + train_jiggle(t)
    ang = P / 50
    Y, R, B = hexc("#FFD23F"), hexc("#E53935"), hexc("#1E88E5")
    # cowcatcher
    poly(ctx, [(x0 - 15, y0 - 115), (x0 + 38, y0 - 12), (x0 - 15, y0 - 12)])
    paint(ctx, R)
    # chassis
    rrect(ctx, x0 - 432, y0 - 118, 420, 48, 14)
    paint(ctx, R)
    # boiler
    rrect(ctx, x0 - 305, y0 - 262, 285, 150, 70)
    paint(ctx, Y)
    for bx in (-238, -168):
        ctx.move_to(x0 + bx, y0 - 258)
        ctx.line_to(x0 + bx, y0 - 116)
    src(ctx, hexc("#E8A900"))
    ctx.set_line_width(7)
    ctx.stroke()
    # smokebox front
    rrect(ctx, x0 - 45, y0 - 255, 40, 136, 18)
    paint(ctx, B)
    # headlamp
    gl = cairo.RadialGradient(x0 + 5, y0 - 230, 5, x0 + 5, y0 - 230, 90)
    gl.add_color_stop_rgba(0, *hexc("#FFF8C4", 0.6 + 0.2 * math.sin(t * 6)))
    gl.add_color_stop_rgba(1, *hexc("#FFF8C4", 0))
    ctx.set_source(gl)
    ctx.arc(x0 + 5, y0 - 230, 90, 0, TAU)
    ctx.fill()
    circle(ctx, x0 - 8, y0 - 232, 18, hexc("#FFF59D"), 5)
    # chimney
    poly(ctx, [(x0 - 108, y0 - 255), (x0 - 62, y0 - 255), (x0 - 52, y0 - 330), (x0 - 118, y0 - 330)])
    paint(ctx, R)
    rrect(ctx, x0 - 128, y0 - 352, 86, 28, 10)
    paint(ctx, B)
    # dome
    ctx.arc(x0 - 200, y0 - 258, 30, math.pi, 0)
    ctx.close_path()
    paint(ctx, R)
    # cab
    rrect(ctx, x0 - 445, y0 - 370, 155, 260, 14)
    paint(ctx, Y)
    rrect(ctx, x0 - 425, y0 - 340, 115, 92, 22)
    paint(ctx, hexc("#9AD0FF"), 6)
    rrect(ctx, x0 - 470, y0 - 400, 200, 40, 16)
    paint(ctx, R)
    text_c(ctx, "TILLY", x0 - 367, y0 - 190, 46, hexc("#1E88E5"), 6, shadow=False)
    # waving glove from the cab window
    wave_on = (t < 10.0) or (t > EV["bye"] - 0.4)
    if wave_on:
        a = math.sin(t * 9) * 0.5
        hx, hy = x0 - 370 + 40 * math.sin(a), y0 - 330 - 30 * math.cos(a)
        limb(ctx, x0 - 360, y0 - 290, 55, -math.pi / 2 + a, 16, hexc("#FFD23F"), 5)
        circle(ctx, hx, hy - 12, 24, WHITE, 5)
        ellipse(ctx, hx - 20, hy - 10, 9, 13)
        paint(ctx, WHITE, 4)
    # face on the boiler
    look = (0.3, 0.05) if abs(train_speed(t)) > 50 else (0.0, 0.25)
    eye(ctx, x0 - 158, y0 - 200, 26, 33, t, 0, look=look)
    eye(ctx, x0 - 92, y0 - 200, 26, 33, t, 0, look=look)
    talking = any(talk(t, VOICE_START[0] + a, VOICE_START[0] + b) for a, b in ((0.0, 3.9),))
    mouth = talk(t, VOICE_START[0], VOICE_START[0] + 3.9) * 0.9 if talking else 0.0
    if t > EV["great_job"]:
        mouth = 0.8
    smile(ctx, x0 - 125, y0 - 150, 32, mouth, 6)
    cheeks(ctx, x0 - 195, x0 - 55, y0 - 160, 17)
    # wheels + rod
    wr = [(x0 - 360, 56), (x0 - 175, 38), (x0 - 75, 38)]
    for wx, r in wr:
        wheel(ctx, wx, TRACK_Y - r, r, ang * 50 / r, "#1E5BD8")
    cr = 22
    p1 = (wr[0][0] + cr * math.cos(ang), TRACK_Y - 56 + cr * math.sin(ang))
    p2 = (wr[2][0] + cr * math.cos(ang), TRACK_Y - 38 + cr * math.sin(ang))
    for wdt, c in ((16, OUT), (9, hexc("#C0C8D0"))):
        ctx.move_to(*p1)
        ctx.line_to(*p2)
        src(ctx, c)
        ctx.set_line_width(wdt)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()


def draw_smoke(ctx, t):
    period = 0.28
    n0 = int(max(0, (t - 2.6)) / period)
    for n in range(n0, int(t / period) + 1):
        te = n * period
        a = t - te
        if a < 0 or a > 2.6:
            continue
        P = train_P(te)
        ex, ey = P - 85, TRACK_Y - 360
        x = ex - 60 * a + 12 * math.sin(n * 1.3 + a * 2)
        y = ey - 150 * a + 30 * a * a
        r = 20 + 34 * a
        al = 0.85 * (1 - a / 2.6)
        ellipse(ctx, x, y, r + 4, r + 4)
        src(ctx, hexc("#C7D3E6", al))
        ctx.fill()
        ellipse(ctx, x - 3, y - 3, r, r)
        src(ctx, (1, 1, 1, al))
        ctx.fill()


def draw_train(ctx, t, cam, animal_states):
    P = train_P(t)
    # couplings
    ctx.rectangle(P - L_ENG - 2400, TRACK_Y - 90, 2400, 14)
    paint(ctx, hexc("#4B3B5C"), 3)
    for i, st in enumerate(animal_states):
        if st and st[0] == "train":
            kind = CAST[i][0]
            draw_animal(ctx, kind, st[1], st[2], st[3], t, animal_pose(kind, t, "train", i))
    for k in range(1, 7):
        draw_carriage(ctx, k, P - car_center_off(k), t, P)
    draw_engine(ctx, t, P)


# ============================================================ letters & text
LETTER_COLS = {"A": "#FF4D4D", "B": "#FF9F1C", "C": "#FFD60A",
               "D": "#2EC4B6", "E": "#3A86FF", "F": "#9B5DE5"}
WORDS = {"A": "Alligator", "B": "Bear", "C": "Cat", "D": "Dog", "E": "Elephant", "F": "Fox"}
LETTERS = [  # letter, pop, fly-to-row time, x, size, style
    ("A", EV["letter_A"], 19.0, 540, 420, "bounce"),
    ("B", EV["letter_B"], 27.5, 540, 420, "bounce"),
    ("C", EV["letter_C"], 39.0, 290, 330, "spin"),
    ("D", EV["letter_D"], 39.0, 790, 330, "spin"),
    ("E", EV["letter_E"], 48.3, 290, 330, "glow"),
    ("F", EV["letter_F"], 48.3, 790, 330, "glow"),
]
LETTER_Y = 520
ROW_Y = 105
FLY = 0.6


def slot_x(i):
    return 540 + (i - 2.5) * 152


def draw_big_letter(ctx, ch, x, y, size, rot=0.0, sx=1.0, sy=1.0, alpha=1.0, glow=0.0):
    col = hexc(LETTER_COLS[ch], alpha)
    if glow > 0:
        g = cairo.RadialGradient(x, y, size * 0.1, x, y, size * 0.85)
        g.add_color_stop_rgba(0, *hexc("#FFFFFF", 0.85 * glow * alpha))
        g.add_color_stop_rgba(0.45, *hexc(LETTER_COLS[ch], 0.5 * glow * alpha))
        g.add_color_stop_rgba(1, *hexc(LETTER_COLS[ch], 0))
        ctx.set_source(g)
        ctx.arc(x, y, size * 0.85, 0, TAU)
        ctx.fill()
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.scale(sx, sy)
    text_c(ctx, ch, 0, 0, size, col, size * 0.07, shadow=True)
    # glossy highlight
    ctx.save()
    ext = text_size(ctx, ch, size)
    ctx.move_to(-ext.width / 2 - ext.x_bearing, -ext.height / 2 - ext.y_bearing)
    ctx.text_path(ch)
    ctx.clip()
    ctx.rectangle(-size, -size, 2 * size, size * 0.62)
    src(ctx, (1, 1, 1, 0.22 * alpha))
    ctx.fill()
    ctx.restore()
    ctx.restore()


def draw_letters(ctx, t):
    for i, (ch, t0, tfly, x, size, style) in enumerate(LETTERS):
        if t < t0 or t > tfly + FLY:
            continue
        u = (t - t0) / 0.7
        sc = elastic(u)
        rot, glow = 0.0, 0.0
        bounce = abs(math.sin(math.pi * (t - t0) / BEAT))
        y = LETTER_Y - 30 * bounce * clamp(u)
        sy = 1 - 0.06 * (1 - bounce) * clamp(u)
        sx = 1 + 0.04 * (1 - bounce) * clamp(u)
        if style == "spin":
            rot = TAU * (1 - ease_out((t - t0) / 1.1)) + 0.1 * math.sin(t * 4)
            sc = ease_out(u * 1.3)
        if style == "glow":
            glow = clamp(u) * (0.65 + 0.35 * math.sin(t * 7))
        cx, cy, csize = x, y, size
        alpha = 1.0
        if t > tfly:  # fly to the progress row
            f = smooth((t - tfly) / FLY)
            cx = lerp(x, slot_x(i), f)
            cy = lerp(y, ROW_Y, f)
            csize = lerp(size, 96, f)
            rot *= 1 - f
            glow *= 1 - f
        draw_big_letter(ctx, ch, cx, cy, csize * sc, rot, sx, sy, alpha, glow)
        # word under the letter
        if t < tfly:
            wu = clamp((t - t0 - 0.25) / 0.5)
            if wu > 0:
                ws = 92 if size > 400 else 70
                wy = LETTER_Y + size * 0.52 + 20
                ext = text_size(ctx, WORDS[ch], ws)
                bw = ext.width + 60
                ctx.save()
                ctx.translate(x, wy)
                ctx.scale(elastic(wu), elastic(wu))
                rrect(ctx, -bw / 2, -ws * 0.68, bw, ws * 1.3, ws * 0.6)
                paint(ctx, hexc("#FFFFFF", 0.92), 6)
                ctx.select_font_face(FONT)
                ctx.set_font_size(ws)
                # first letter in colour, rest in purple
                first, rest = WORDS[ch][0], WORDS[ch][1:]
                e1 = ctx.text_extents(first)
                tx = -ext.width / 2 - ext.x_bearing
                ty = -ext.height / 2 - ext.y_bearing
                ctx.move_to(tx, ty)
                ctx.text_path(first)
                src(ctx, OUT)
                ctx.set_line_width(7)
                ctx.stroke_preserve()
                src(ctx, hexc(LETTER_COLS[ch]))
                ctx.fill()
                ctx.move_to(tx + e1.x_advance, ty)
                ctx.text_path(rest)
                src(ctx, hexc("#5B2DB8"))
                ctx.fill()
                ctx.restore()


def draw_progress_row(ctx, t):
    a = sstep(t, 10.0, 10.8) * (1 - sstep(t, 58.6, 59.0))
    if a <= 0:
        return
    for i, (ch, _, tfly, *_rest) in enumerate(LETTERS):
        x = slot_x(i)
        done = t >= tfly + FLY
        ctx.arc(x, ROW_Y, 62, 0, TAU)
        if done:
            pop = elastic((t - tfly - FLY) / 0.5)
            src(ctx, hexc("#FFFFFF", 0.95 * a))
            ctx.fill_preserve()
            src(ctx, hexc(LETTER_COLS[ch], a))
            ctx.set_line_width(8)
            ctx.stroke()
            b = 6 * abs(math.sin(math.pi * t / BEAT + i))
            draw_big_letter(ctx, ch, x, ROW_Y - b, 96 * pop, alpha=a)
        else:
            src(ctx, hexc("#FFFFFF", 0.45 * a))
            ctx.fill_preserve()
            ctx.set_dash([12, 10])
            src(ctx, hexc("#FFFFFF", 0.9 * a))
            ctx.set_line_width(5)
            ctx.stroke()
            ctx.set_dash([])
            text_c(ctx, "?", x, ROW_Y, 64, hexc("#FFFFFF", 0.85 * a), 0, shadow=False)


CAPTIONS = [  # (clip, start offset, text)
    (1, 0.0, "Choo choo!"), (1, 1.3, "Hello, friends!"), (1, 2.5, "I'm Tilly the Train!"),
    (1, 4.2, "Welcome to the Magic Station!"), (1, 6.4, "Hop aboard..."),
    (1, 7.2, "...let's learn our ABCs!"),
    (2, 0.0, "Ooh, look!"), (2, 1.38, "Who's that by the railway?"),
    (2, 3.0, "It's an alligator!"), (2, 4.5, "Snap, snap!"), (2, 5.74, "A... A..."),
    (2, 6.98, "A is for Alligator!"),
    (3, 0.0, "Here comes Benny Bear!"), (3, 1.67, "Jump, Benny, jump!"),
    (3, 3.2, "Into the second carriage!"), (3, 5.07, "B... B... B is for Bear!"),
    (4, 0.0, "Meow! A fluffy cat!"), (4, 2.39, "C is for Cat!"),
    (4, 4.2, "Woof, woof! A dancing dog!"), (4, 7.26, "D is for Dog!"),
    (5, 0.0, "Toot toot!"), (5, 1.17, "Ellie Elephant is here!"),
    (5, 2.89, "E is for Elephant!"), (5, 4.75, "And clever Freddie Fox!"),
    (5, 6.9, "F is for Fox!"),
    (6, 0.0, "Choo choo, come along with me,"), (6, 2.51, "let's learn letters A, B, C!"),
    (6, 5.02, "A for Alligator, B for Bear,"), (6, 7.75, "C for Cat with fluffy hair!"),
    (7, 0.0, "A, B, C, D, E, F!"), (7, 2.34, "Great job, friends!"), (7, 3.95, "Bye bye!"),
]
CLIP_LEN = [9.11, 8.70, 7.46, 8.82, 8.46, 9.96, 4.71]


def caption_at(t):
    cur = None
    for i, (c, off, txt) in enumerate(CAPTIONS):
        st = VOICE_START[c - 1] + off
        nxt = CAPTIONS[i + 1] if i + 1 < len(CAPTIONS) else None
        if nxt and nxt[0] == c:
            en = VOICE_START[c - 1] + nxt[1]
        else:
            en = VOICE_START[c - 1] + CLIP_LEN[c - 1] + 0.35
        if st <= t < en:
            cur = (txt, st, en)
    return cur


def draw_caption(ctx, t):
    cap = caption_at(t)
    if not cap:
        return
    txt, st, en = cap
    pop = elastic((t - st) / 0.45)
    out = 1 - sstep(t, en - 0.12, en)
    size = 76
    ext = text_size(ctx, txt, size)
    if ext.width > 900:
        size = size * 900 / ext.width
        ext = text_size(ctx, txt, size)
    bw, bh = ext.width + 70, size * 1.55
    y = 1830
    sing = SCENES["rainbow"][0] <= t < SCENES["rainbow"][1]
    ctx.save()
    ctx.translate(540, y)
    ctx.scale(pop * out, pop * out)
    rrect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2)
    paint(ctx, hexc("#5B2DB8") if sing else hexc("#FFFFFF", 0.95), 7)
    text_c(ctx, txt, 0, 2, size, hexc("#FFE45E") if sing else hexc("#5B2DB8"), 0 if not sing else 8,
           shadow=False)
    if sing:  # little music notes either side
        for s in (-1, 1):
            nx = s * (bw / 2 + 50)
            ny = -10 * math.sin(t * 6 + s)
            text_c(ctx, "♪", nx, ny, 70, hexc("#FFFFFF"), 6, shadow=False, font="DejaVu Sans")
    ctx.restore()


def draw_title(ctx, t):
    t0, t1 = EV["title_in"], 9.4
    if t < t0 or t > t1 + 0.5:
        return
    out = 1 - sstep(t, t1, t1 + 0.5)
    lines = [("THE MAGIC", 300, 120), ("ANIMAL TRAIN", 440, 128)]
    cols = ["#FF4D4D", "#FF9F1C", "#FFD60A", "#2EC4B6", "#3A86FF", "#9B5DE5"]
    ci = 0
    for li, (line, y, size) in enumerate(lines):
        ext = text_size(ctx, line, size)
        x = 540 - ext.width / 2
        for j, ch in enumerate(line):
            e = text_size(ctx, ch, size)
            if ch != " ":
                u = (t - t0 - 0.06 * (j + li * 9)) / 0.6
                sc = elastic(u) * out
                bob = 14 * math.sin(t * 5 - j * 0.6)
                ctx.save()
                ctx.translate(x + e.x_advance / 2, y + bob)
                ctx.scale(sc, sc)
                text_c(ctx, ch, 0, 0, size, hexc(cols[ci % 6]), 12)
                ctx.restore()
                ci += 1
            x += e.x_advance
    # ribbon subtitle
    u = elastic((t - 1.6) / 0.6) * out
    if u > 0:
        ctx.save()
        ctx.translate(540, 590)
        ctx.scale(u, u)
        ctx.rotate(-0.03 + 0.02 * math.sin(t * 3))
        poly(ctx, [(-400, -55), (400, -55), (370, 0), (400, 55), (-400, 55), (-370, 0)])
        paint(ctx, hexc("#FF5D8F"), 7)
        text_c(ctx, "Learn Your ABCs!", 0, 4, 80, hexc("#FFFFFF"), 8, shadow=False)
        ctx.restore()


def draw_bursts(ctx, t):
    for bi, (ch, t0, _, x, size, _) in enumerate(LETTERS):
        a = t - t0
        if 0 <= a < 1.3:
            for i in range(22):
                ang = hash01(bi, i, 1) * TAU
                sp = 380 + 420 * hash01(bi, i, 2)
                d = sp * ease_out(a / 1.3)
                px = x + d * math.cos(ang)
                py = LETTER_Y + d * math.sin(ang) + 120 * a * a
                al = 1 - a / 1.3
                col = list(LETTER_COLS.values())[int(hash01(bi, i, 3) * 6)]
                star_path(ctx, px, py, 18 * (1 - a / 2), a * 6 + i)
                paint(ctx, hexc(col, al), 3 * al)
    # outro "great job" confetti
    a = t - EV["great_job"]
    if a > 0:
        for i in range(60):
            x = hash01(i, 31) * W
            y = -50 + (a * (300 + 300 * hash01(i, 32)) + hash01(i, 33) * 400) % 1300
            col = list(LETTER_COLS.values())[i % 6]
            ctx.save()
            ctx.translate(x + 30 * math.sin(a * 3 + i), y)
            ctx.rotate(a * 5 + i)
            ctx.rectangle(-10, -5, 20, 10)
            src(ctx, hexc(col))
            ctx.fill()
            ctx.restore()


def draw_poofs(ctx, t, cam):
    """Sparkle ring when an animal pops onto the grass (world space)."""
    for kind, k, appear, board, dx, stopP in CAST:
        a = t - appear
        if 0 <= a < 0.8:
            gx = stopP - car_center_off(k) + dx
            for i in range(12):
                ang = i * TAU / 12
                d = 80 + 220 * ease_out(a / 0.8)
                star_path(ctx, gx + d * math.cos(ang), GROUND_Y - 150 + d * math.sin(ang) * 0.7,
                          20 * (1 - a / 0.8), a * 5)
                paint(ctx, hexc("#FFE45E", 1 - a / 0.8), 3)


def draw_outro(ctx, t):
    t0 = EV["recap"]
    if t < t0 - 0.1:
        return
    for i, ch in enumerate("ABCDEF"):
        tp = t0 + i * 0.34
        if t < tp:
            continue
        sc = elastic((t - tp) / 0.5)
        x = 540 + (i - 2.5) * 162
        b = abs(math.sin(math.pi * (t - tp) / BEAT + i * 0.5))
        draw_big_letter(ctx, ch, x, 300 - 35 * b, 180 * sc, 0.12 * math.sin(t * 4 + i))
    if t > EV["great_job"]:
        u = elastic((t - EV["great_job"]) / 0.6)
        ctx.save()
        ctx.translate(540, 700)
        ctx.scale(u, u)
        ctx.rotate(0.05 * math.sin(t * 5))
        star_path(ctx, 0, 0, 290, t * 0.5, 12, 0.78)
        paint(ctx, hexc("#FFE45E"), 8)
        text_c(ctx, "GREAT JOB!", 0, 6, 120, hexc("#FF4D4D"), 12)
        ctx.restore()
    if t > EV["bye"]:
        u = elastic((t - EV["bye"]) / 0.5)
        ctx.save()
        ctx.translate(540, 1030)
        ctx.scale(u, u)
        text_c(ctx, "BYE BYE!", 0, 0, 110, hexc("#3A86FF"), 12)
        ctx.restore()


def draw_iris(ctx, t):
    t0, t1 = 63.25, DURATION
    if t < t0:
        return
    u = smooth((t - t0) / (t1 - t0 - 0.1))
    r = lerp(1300, 0, u)
    ctx.rectangle(0, 0, W, H)
    ctx.new_sub_path()
    ctx.arc_negative(540, 1050, max(r, 0.1), TAU, 0)
    src(ctx, hexc("#2B1B3D"))
    ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
    ctx.fill()
    ctx.set_fill_rule(cairo.FILL_RULE_WINDING)


def draw_fade_in(ctx, t):
    if t < 0.5:
        ctx.rectangle(0, 0, W, H)
        src(ctx, (1, 1, 1, 1 - t / 0.5))
        ctx.fill()


# ============================================================ frame
class SafeContext(cairo.Context):
    """cairo raises on non-invertible matrices; pop-in animations start at scale 0."""

    def scale(self, sx, sy):
        def fix(v):
            return v if abs(v) > 1e-4 else (1e-4 if v >= 0 else -1e-4)
        super().scale(fix(sx), fix(sy))


def render_frame(t):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = SafeContext(surf)
    ctx.set_antialias(cairo.ANTIALIAS_GOOD)
    cam = Cam(t)

    draw_sky(ctx, t, cam)
    draw_land(ctx, t, cam)

    states = [animal_state(e, t) for e in CAST]
    rings = rainbow_rings(cam, t)
    ring_a = sstep(t, 48.4, 49.2) * (1 - sstep(t, 59.5, 60.5))

    ctx.save()
    cam.apply(ctx)
    if t < 16:
        draw_station(ctx, t)
    for ax in rings:
        draw_rainbow_ring(ctx, ax, "back", ring_a)
    draw_track(ctx, cam)
    draw_smoke(ctx, t)
    draw_train(ctx, t, cam, states)
    for ax in rings:
        draw_rainbow_ring(ctx, ax, "front", 0.75 * ring_a)
    draw_foreground(ctx, t, cam)
    # animals on the grass / mid-jump are in front of everything
    for i, st in enumerate(states):
        if st and st[0] in ("ground", "jump"):
            kind = CAST[i][0]
            pose = animal_pose(kind, t, "ground" if st[0] == "ground" else "jump", i)
            draw_animal(ctx, kind, st[1], st[2], st[3], t, pose)
    draw_poofs(ctx, t, cam)
    ctx.restore()

    draw_title(ctx, t)
    draw_progress_row(ctx, t)
    draw_letters(ctx, t)
    draw_bursts(ctx, t)
    draw_outro(ctx, t)
    draw_caption(ctx, t)
    draw_fade_in(ctx, t)
    draw_iris(ctx, t)
    surf.flush()
    return surf


def frame_bytes(i):
    return bytes(render_frame(i / FPS).get_data())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", help="comma-separated times (s) to export as PNG")
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    ap.add_argument("--end", type=float, default=DURATION)
    ap.add_argument("--segment", help="START:END frame range -> silent segment file (for parallel renders)")
    ap.add_argument("--out", help="segment output path")
    args = ap.parse_args()

    if args.stills:
        d = os.path.join(OUT_DIR, "stills")
        os.makedirs(d, exist_ok=True)
        for s in args.stills.split(","):
            t = float(s)
            render_frame(t).write_to_png(os.path.join(d, f"t{t:05.2f}.png"))
            print("still", t)
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    if args.segment:
        f0, f1 = (int(x) for x in args.segment.split(":"))
        cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra",
               "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium",
               "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high", "-threads", "1", args.out]
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for i in range(f0, f1):
            ff.stdin.write(frame_bytes(i))
        ff.stdin.close()
        sys.exit(ff.wait())
    n = int(round(args.end * FPS))
    cmd = ["ffmpeg", "-v", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", AUDIO,
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-c:a", "aac", "-b:a", "192k",
           "-t", f"{args.end:.3f}", "-movflags", "+faststart", OUT_FILE]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(args.workers) as pool:
        for i, buf in enumerate(pool.imap(frame_bytes, range(n), chunksize=4)):
            ff.stdin.write(buf)
            if i % 150 == 0:
                print(f"frame {i}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()
    if ff.returncode:
        sys.exit("ffmpeg failed")
    print("wrote", OUT_FILE)


if __name__ == "__main__":
    main()

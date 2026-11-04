"""News-style green screen template v4 (1:1 square, 3D bevel frame + animated intro/shine): world map, rotating globe, HUD graphics.
Usage: python3 make_template_v2.py out.mp4 [preview_seconds]
Land data: Natural Earth (public domain)."""
import json, sys, os, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H, FPS, DUR = 1080, 1080, 30, 10
out = sys.argv[1]
N = int(FPS * (float(sys.argv[2]) if len(sys.argv) > 2 else DUR))
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)
font_s = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 18)
font_m = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 26)

# ---------- land polygons ----------
polys = []
for f in json.load(open(os.path.join(HERE, 'assets/ne_50m_land.geojson')))['features']:
    g = f['geometry']
    for p in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        polys.append(np.array(p[0]))

# equirectangular land mask for globe texture
MW, MH = 2048, 1024
mask = Image.new('L', (MW, MH), 0); d = ImageDraw.Draw(mask)
for p in polys:
    d.polygon([((x + 180) / 360 * MW, (90 - y) / 180 * MH) for x, y in p], fill=255)
landmask = np.asarray(mask, np.float32) / 255
edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3)), np.float32) / 255

# ---------- flat world map outline layer (pans horizontally) ----------
MAPW, MAPH = 2600, 1300
mp = Image.new('L', (MAPW, MAPH), 0); d = ImageDraw.Draw(mp)
for p in polys:
    pts = [((x + 180) / 360 * MAPW, (90 - y) / 180 * MAPH - 60) for x, y in p]
    d.line(pts + [pts[0]], fill=255, width=3)
mapline = np.asarray(mp, np.float32) / 255
mapglow = np.asarray(mp.filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
maplayer = 0.55 * mapline + 0.6 * mapglow
maplayer = np.concatenate([maplayer, maplayer], 1)  # for wrap

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
xn, yn = xx / W, yy / H
dc = np.sqrt(((xn - 0.5) * 1.5) ** 2 + ((yn - 0.45) * 1.3) ** 2)
v = np.clip(1 - dc, 0, 1) ** 1.2
BG = np.stack([0.01 + 0.06 * v, 0.06 + 0.30 * v, 0.40 + 0.55 * v], -1)
MAPC = np.array([0.45, 0.75, 1.0], np.float32)

# ---------- globe precompute ----------
GR, GCX, GCY = 340, 70, 560
gy, gx = np.mgrid[GCY - GR:GCY + GR, GCX - GR:GCX + GR].astype(np.float32)
u, w_ = (gx - GCX) / GR, (gy - GCY) / GR
r2 = u * u + w_ * w_
inside = r2 <= 1
z = np.sqrt(np.clip(1 - r2, 0, 1))
tilt = np.radians(18)
yv = -w_; y2 = yv * np.cos(tilt) + z * np.sin(tilt); z2 = -yv * np.sin(tilt) + z * np.cos(tilt)
glat = np.degrees(np.arcsin(np.clip(y2, -1, 1)))
glon0 = np.degrees(np.arctan2(u, z2))
shade = np.clip(0.35 + 0.75 * (-0.45 * u - 0.45 * w_ + 0.77 * z), 0, 1.15)
aa = np.clip((1 - np.sqrt(r2)) * GR, 0, 1)
rim = np.exp(-((np.sqrt(r2) - 1) * GR / 14) ** 2)
my = np.clip(((90 - glat) / 180 * MH).astype(int), 0, MH - 1)
glat_line = np.exp(-((((glat + 90) % 15) - 7.5).__abs__() - 7.5) ** 2 / 0.08)

def globe(t):
    lon = (glon0 + 180 - 120 + t * 7) % 360 - 180   # 7 deg/sec spin
    mx = ((lon + 180) / 360 * MW).astype(int) % MW
    land = landmask[my, mx]; e = edge[my, mx]
    lon_line = np.exp(-(np.abs(((lon + 180) % 15) - 7.5) - 7.5) ** 2 / 0.08)
    grid = np.clip(lat_l + lon_line, 0, 1) * z ** 0.5
    ocean = np.stack([0.05 + 0.10 * shade, 0.20 + 0.30 * shade, 0.60 + 0.40 * shade], -1)
    landc = np.stack([0.80 * shade, 0.86 * shade, 0.95 * shade], -1)
    col = ocean * (1 - land[..., None]) + landc * land[..., None]
    col = col + 0.55 * grid[..., None] * (1 - 0.6 * land[..., None]) + 0.4 * e[..., None]
    alpha = np.where(inside, 0.55 + 0.4 * land, 0) * aa
    return np.clip(col, 0, 1), alpha, rim
lat_l = glat_line

# ---------- HUD static layer ----------
hud = Image.new('L', (W, H), 0); d = ImageDraw.Draw(hud)
for (x0, y0, x1, y1) in [(10, 8, 300, 70), (330, 20, 560, 70), (1012, 250, 1075, 380), (1012, 600, 1075, 760), (900, 1010, 1075, 1070), (10, 1010, 220, 1070)]:
    d.rectangle([x0, y0, x1, y1], outline=170, width=2)
for xg in [40, 1040]: d.line([(xg, 0), (xg, H)], fill=70, width=1)
for yg in [85, 1045]: d.line([(0, yg), (W, yg)], fill=70, width=1)
for yg in range(400, 760, 40): d.line([(1020, yg), (1040, yg)], fill=200, width=2)
hudS = np.asarray(hud.filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255

labels = [(10, 10), (330, 22), (1010, 255), (1010, 610), (905, 1015), (15, 1015), (600, 30), (450, 1040)]
RCX, RCY = 985, 95

ff = ['ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out]
pp = subprocess.Popen(ff, stdin=subprocess.PIPE)
# ---------- 3D bevel frame (precomputed at full scale) ----------
CX, CY = 540, 520
bw, bh, T = 840, 740, 26                       # green size, border thickness
gx0, gy0, gx1, gy1 = CX - bw // 2, CY - bh // 2, CX + bw // 2, CY + bh // 2
ox0, oy0, ox1, oy1 = gx0 - T, gy0 - T, gx1 + T, gy1 + T
dT, dB, dL, dR = yy - oy0, oy1 - yy, xx - ox0, ox1 - xx
dout = np.minimum(np.minimum(dT, dB), np.minimum(dL, dR))
inner = (xx >= gx0) & (xx < gx1) & (yy >= gy0) & (yy < gy1)
outer = dout >= 0
border = outer & ~inner
tt = np.clip(dout / T, 0, 1)                    # 0 at outer edge -> 1 at inner edge
side = np.argmin(np.stack([dT, dL, dR, dB]), 0)  # nearest outer side
sdir = np.array([1.0, 0.7, -0.7, -1.0], np.float32)[side]
light = 0.80 + 0.26 * sdir * np.cos(np.pi * tt) + 0.18 * np.exp(-((tt - 0.42) / 0.07) ** 2)
light -= 0.45 * np.exp(-(dout / 1.2) ** 2) + 0.55 * np.exp(-((T - dout) / 1.6) ** 2)  # dark rims
BEV = np.clip(light, 0, 1.2)[..., None] * np.array([0.97, 0.99, 1.0], np.float32)
ang = (np.arctan2(yy - CY, (xx - CX) * bh / bw) / (2 * np.pi)) % 1.0  # perimeter coordinate
dist_out = np.maximum(np.maximum(ox0 - xx, xx - ox1), np.maximum(oy0 - yy, yy - oy1))
halo = np.exp(-(np.clip(dist_out, 0, None) / 14) ** 2) * (~outer)
sh = Image.fromarray(((outer).astype(np.uint8) * 255)).filter(ImageFilter.GaussianBlur(18))
SHADOW = np.roll(np.roll(np.asarray(sh, np.float32) / 255, 16, 0), 16, 1)

def ease_out_back(x, k=1.6):
    x = min(max(x, 0), 1) - 1
    return 1 + (k + 1) * x ** 3 + k * x ** 2

def frame_layer(t):
    """Returns RGBA layer (uint8) of shadow+frame+green and additive glow, at full scale."""
    rgb = np.zeros((H, W, 3), np.float32); a = np.zeros((H, W), np.float32)
    a = np.maximum(a, SHADOW * 0.75)
    rgb[border] = BEV[border]; a[border] = 1
    rgb[inner] = (0, 1, 0); a[inner] = 1
    # two glints running around the border
    g = 0
    for ph in (0.0, 0.5):
        dd = np.abs(((ang - t / 4.0 - ph + 0.5) % 1.0) - 0.5)
        g = g + np.exp(-(dd / 0.03) ** 2)
    flash = max(0.0, 1 - abs(t - 0.75) / 0.35) if t < 1.1 else 0.0
    # diagonal shine sweep across the border every 3.3 s
    sp = ((t - 1.0) % 3.3) / 1.1
    diag = np.exp(-(((xx + yy) / (W + H) - (sp * 1.4 - 0.2)) / 0.025) ** 2) if 0 <= sp <= 1 else 0
    gb = (0.9 * g + 1.2 * flash + 0.9 * diag)
    rgb[border] = np.clip(rgb[border] + (gb if np.isscalar(gb) else gb[border])[..., None] * np.array([0.35, 0.6, 1.0]), 0, 1)
    glow = (halo * (0.9 * g + 1.5 * flash + 0.25))[..., None] * np.array([0.25, 0.55, 1.0])
    return rgb, a, glow

def scale_about(arr, s):
    if s >= 0.999: return arr
    im = Image.fromarray(arr)
    c = (1 / s, 0, CX - CX / s, 0, 1 / s, CY - CY / s)
    return np.asarray(im.transform((W, H), Image.AFFINE, c, resample=Image.BILINEAR))
nums = [f'{rng.uniform(10, 999):.5f}' for _ in labels]

for i in range(N):
    t = i / FPS
    img = BG.copy()
    # panning world map
    off = (int(t * 22) + 700) % MAPW
    img += maplayer[:H, off:off + W][..., None] * MAPC * 0.55
    # vertical sweeping light beams
    for k, (sp, wd, st) in enumerate([(110, 60, 0), (-80, 110, 500), (160, 35, 900)]):
        bxp = (st + sp * t) % (W + 600) - 300
        img += (0.35 * np.exp(-((xx[0] - bxp) / wd) ** 2))[None, :, None] * np.array([0.3, 0.6, 1.0])
    # horizontal light streaks
    for k, (row, sp) in enumerate([(0.07, 1), (0.30, -1), (0.62, 1), (0.88, -1)]):
        pos = ((sp * t * 0.12 + k * 0.3) % 1.0) * 1.6 - 0.3
        img += (0.9 * np.exp(-((yn[:, :1] - row) / 0.0025) ** 2) * np.exp(-((xn[:1] - pos) / 0.18) ** 2))[..., None] * np.array([0.5, 0.8, 1.0])
    # HUD animated layer
    hd = Image.new('L', (W, H), 0); d = ImageDraw.Draw(hd)
    if i % 6 == 0:
        nums = [f'{rng.uniform(10, 999):.5f}' if rng.random() < 0.6 else n for n in nums]
    for (lx, ly), n in zip(labels, nums): d.text((lx + 6, ly + 6), n[:5] if lx > 950 else n, font=font_s, fill=230)
    d.text((620, 52), f'{int(t * 1000 + 43037) % 99999:05d}', font=font_m, fill=200)
    # sliding bars
    for k, (y0, ln, sp) in enumerate([(80, 200, 200), (1000, 300, -180), (470, 120, 140)]):
        x0 = (k * 500 + sp * t) % (W + ln) - ln
        d.rectangle([x0, y0, x0 + ln, y0 + 5], fill=255)
    # radar circles
    for rr in range(20, 101, 20):
        d.ellipse([RCX - rr, RCY - rr, RCX + rr, RCY + rr], outline=220 if rr % 40 else 150, width=3)
    a0 = (t * 120) % 360
    d.arc([RCX - 110, RCY - 110, RCX + 110, RCY + 110], a0, a0 + 70, fill=255, width=6)
    d.arc([RCX - 60, RCY - 60, RCX + 60, RCY + 60], -a0 * 1.5, -a0 * 1.5 + 100, fill=255, width=5)
    # blinking blocks
    for k in range(8):  # status blocks
        if (i // 8 + k * 3) % 5 < 3: d.rectangle([985 + k * 11, 345, 993 + k * 11, 355], fill=230)
    hdA = np.asarray(hd.filter(ImageFilter.GaussianBlur(0.5)), np.float32) / 255
    hdG = np.asarray(hd.filter(ImageFilter.GaussianBlur(5)), np.float32) / 255
    img += ((hudS * 0.6 + hdA * 0.8 + hdG * 0.6)[..., None]) * np.array([0.55, 0.85, 1.0])
    # globe (left, partly behind the screen)
    col, al, rim_ = globe(t)
    cx0 = max(0, GR - GCX); col, al, rm = col[:, cx0:], al[:, cx0:], rim_[:, cx0:]
    reg = img[GCY - GR:GCY + GR, max(0, GCX - GR):GCX + GR]
    reg[:] = reg * (1 - al[..., None]) + col * al[..., None] + rm[..., None] * np.array([0.3, 0.6, 1.0]) * 0.8
    # bottom band with red rule
    img[985:] *= 0.45
    img[981:985] = [0.85, 0.15, 0.35]
    img *= (0.95 + 0.05 * np.sin(yy * np.pi / 2))[..., None]
    # 3D frame with intro pop-in (0-0.7s), border flash, running glints, shine sweep
    rgb, a, glow = frame_layer(t)
    sc = 0.15 + 0.85 * ease_out_back(t / 0.7) if t < 0.7 else 1.0
    lay = np.dstack([np.clip(rgb, 0, 1), np.clip(a, 0, 1)])
    lay = scale_about((lay * 255).astype(np.uint8), sc).astype(np.float32) / 255
    glw = scale_about((np.clip(glow, 0, 1) * 255).astype(np.uint8), sc).astype(np.float32) / 255
    al = lay[..., 3:]
    img = img * (1 - al) + lay[..., :3] * al + glw * (1 - al)
    f = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    f[(lay[..., 3] > 0.99) & (lay[..., 1] > 0.99) & (lay[..., 0] < 0.01)] = (0, 255, 0)  # keep key colour exact
    pp.stdin.write(f.tobytes())
pp.stdin.close(); pp.wait()

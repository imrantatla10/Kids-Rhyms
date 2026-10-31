"""Tiny TopoJSON decoder for the Natural Earth world-atlas files in data/ (public domain)."""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EU27 = {"Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia",
        "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia",
        "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania",
        "Slovakia", "Slovenia", "Spain", "Sweden"}
# CPTPP parties besides the UK (the UK's accession entered into force 15 Dec 2024)
CPTPP = {"Australia", "Brunei", "Canada", "Chile", "Japan", "Malaysia", "Mexico",
         "New Zealand", "Peru", "Singapore", "Vietnam"}

_cache = {}


def load(res="50m"):
    """Return {name: [ring, ...]} with rings as lists of (lon, lat)."""
    if res in _cache:
        return _cache[res]
    d = json.load(open(os.path.join(ROOT, "data", f"countries-{res}.json")))
    sx, sy = d["transform"]["scale"]
    tx, ty = d["transform"]["translate"]
    arcs = []
    for arc in d["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(idx):
        pts = []
        for a in idx:
            seg = arcs[a] if a >= 0 else arcs[~a][::-1]
            pts.extend(seg if not pts else seg[1:])
        return pts

    out = {}
    for g in d["objects"]["countries"]["geometries"]:
        name = g.get("properties", {}).get("name")
        if not name or name == "Antarctica":
            continue
        polys = []
        if g["type"] == "Polygon":
            polys = [g["arcs"]]
        elif g["type"] == "MultiPolygon":
            polys = g["arcs"]
        rings = []
        for p in polys:
            for r in p:
                pts = ring(r)
                lons = [x for x, _ in pts]
                if max(lons) - min(lons) > 270:   # crosses the antimeridian
                    pts = [(x + 360 if x < 0 else x, y) for x, y in pts]
                rings.append(pts)
        out.setdefault(name, []).extend(rings)
    _cache[res] = out
    return out


def centroid(rings):
    # area-weighted centroid of the largest ring
    best = max(rings, key=lambda r: abs(_area(r)))
    a = _area(best)
    cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(best, best[1:] + best[:1]):
        c = x0 * y1 - x1 * y0
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    if abs(a) < 1e-9:
        return best[0]
    return cx / (6 * a), cy / (6 * a)


def _area(r):
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(r, r[1:] + r[:1]))


def is_europe(name, rings):
    if name in ("Russia", "Turkey", "Kazakhstan", "Greenland", "Georgia", "Azerbaijan", "Armenia",
                "N. Cyprus"):
        return False
    if name in EU27 or name == "United Kingdom":
        return True
    lon, lat = centroid(rings)
    return -25 <= lon <= 42 and 35 <= lat <= 72


class Proj:
    """Equirectangular projection with cos(lat0) x-scaling, mapping a lon/lat box to a screen box."""

    def __init__(self, lon0, lon1, lat0, lat1, x0, y0, width, coslat=None):
        self.lon0, self.lat1 = lon0, lat1
        k = math.cos(math.radians(coslat if coslat is not None else (lat0 + lat1) / 2))
        self.s = width / ((lon1 - lon0) * k)
        self.k = k
        self.x0, self.y0 = x0, y0
        self.height = (lat1 - lat0) * self.s

    def __call__(self, lon, lat):
        return self.x0 + (lon - self.lon0) * self.k * self.s, self.y0 + (self.lat1 - lat) * self.s

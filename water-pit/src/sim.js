// Sports Cars vs Giant Water Pit: deterministic 3D crash scene with a camera
// director and on-screen survival HUD. The same output time always renders the
// same frame, so parallel render workers stay in sync.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CRASH_TIMES, HEAVY, SLOW, HOOK_LEN, OUT_DURATION, outToSim, simToOut, simToMainOut, slowAt } from './timeline.js';

// ---------------------------------------------------------------- utilities
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const buildRand = mulberry32(777);
const simRand = mulberry32(4242);
const BR = (a, b) => a + (b - a) * buildRand();
const SR = (a, b) => a + (b - a) * simRand();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIO = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a, b, t) => a + (b - a) * t;

function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
              lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm2 = (x, z, s = 0) => vnoise(x, 0.5, z, s) * 0.55 + vnoise(x * 2.1, 3.5, z * 2.1, s + 1) * 0.3 + vnoise(x * 4.3, 7.5, z * 4.3, s + 2) * 0.15;

// ---------------------------------------------------------------- layout constants
const ROAD_HALF = 4.3;
const PIT = { x: 6.6, z0: -10.0, z1: -2.6, floor: -1.9, water: -0.75 };
const APRON = { x: 9.6, z0: -12.6, z1: 0.6, top: 0.12 };
const WALL = { z0: -2.6, z1: -1.6, top: 1.5 };
const RAMP = { hinge: -12.5, lip: -10.0, len: 2.5 };
const inPit = (x, z) => Math.abs(x) < PIT.x && z > PIT.z0 && z < PIT.z1;

function roadH(z) {
  const a = -24, b = -340, H = 46;
  if (z >= a) return 0;
  if (z <= b) return H;
  const t = (a - z) / (a - b);
  return H * t * t * (3 - 2 * t);
}
function roadSlope(z) { return roadH(z - 0.5) - roadH(z + 0.5); }
function terrainH(x, z) {
  const ax = Math.abs(x);
  let h = roadH(z);
  const e = Math.max(0, ax - 7.5);
  const side = x < 0 ? 1.0 : 0.75;
  const flat = smooth(14, 34, Math.hypot(x * 0.8, z + 6));   // level yard around the installation
  h += flat * side * 16 * (1 - Math.exp(-e / 7)) * smooth(0, 3, e);
  h += flat * (fbm2(x * 0.014, z * 0.014, x < 0 ? 3 : 9) - 0.35) * 55 * smooth(8, 70, e);
  return h;
}
function driveY(z) { return (z > APRON.z0 && z < APRON.z1) ? APRON.top : roadH(z); }

// ---------------------------------------------------------------- renderer / scene
const W = window.__W || 1080, H = window.__H || 1920;
const glCanvas = document.createElement('canvas');
glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(62, W / H, 0.2, 2500);
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#3a7bd6'); gr.addColorStop(0.55, '#84b5ea'); gr.addColorStop(1, '#d9eaf7');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x55703a, 0.85));
const sun = new THREE.DirectionalLight(0xfff4e2, 2.9);
sun.position.set(-14, 70, -14);
sun.target.position.set(0, 0, -30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 70, bottom: -70, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function noiseFill(g, w, h, base, spread, n, sizeMax = 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = BR(-spread, spread);
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    const s = BR(0.5, sizeMax); g.fillRect(BR(0, w), BR(0, h), s, s);
  }
}
function mergeGeos(list) {
  let vCount = 0; const pos = [], uv = [], nor = [], idx = [];
  for (const g of list) {
    const gi = g.index ? g.index.array : null;
    const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    if (u) for (let i = 0; i < u.length; i++) uv.push(u[i]); else for (let i = 0; i < p.length / 3; i++) uv.push(0, 0);
    if (gi) for (let i = 0; i < gi.length; i++) idx.push(gi[i] + vCount); else for (let i = 0; i < p.length / 3; i++) idx.push(i + vCount);
    vCount += p.length / 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const warnTex = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#d0201c'; for (let x = -64; x < w + 64; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 + h, h); g.lineTo(x + h, h); g.fill(); } });
warnTex.wrapS = THREE.RepeatWrapping; warnTex.repeat.set(4, 1);
const warnMat = new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.6 });
const hazardTex = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#f5c400'; g.fillRect(0, 0, w, h); g.fillStyle = '#151515'; for (let x = -64; x < w + 64; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 + h, h); g.lineTo(x + h, h); g.fill(); } });
hazardTex.wrapS = THREE.RepeatWrapping; hazardTex.repeat.set(5, 1);
const concreteTex = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#a3a19b', 0.18, 7000, 3));
concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;
const concrete = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 });
const ironMat = new THREE.MeshStandardMaterial({ color: '#2e3134', metalness: 0.6, roughness: 0.55 });
const rustMat = new THREE.MeshStandardMaterial({ color: '#6e4a31', metalness: 0.5, roughness: 0.75 });

// ---- terrain (with a hole where the installation sits)
{
  const geo = new THREE.PlaneGeometry(760, 1060, 190, 265);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -470);
  const pos = geo.attributes.position, col = [];
  const cA = new THREE.Color('#5f9a3c'), cB = new THREE.Color('#7fb04a'), cC = new THREE.Color('#4a7f31'), cD = new THREE.Color('#a8a36a');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainH(x, z) - (Math.abs(x) < ROAD_HALF + 1.6 ? 0.05 : 0));
    const n = fbm2(x * 0.05, z * 0.05, 5);
    const c = cA.clone().lerp(cB, n).lerp(cC, clamp(fbm2(x * 0.011, z * 0.011, 6) - 0.35, 0, 1) * 0.9);
    if (Math.abs(x) < 7.2) c.lerp(cD, 0.18 * (1 - (Math.abs(x) - 4.3) / 2.9));
    col.push(c.r, c.g, c.b);
  }
  const idx = geo.index.array, keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    let cx = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cx += pos.getX(idx[i + k]) / 3; cz += pos.getZ(idx[i + k]) / 3; }
    if (Math.abs(cx) < 9.2 && cz > -12.4 && cz < 0.4) continue;
    keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(keep);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const grass = canvasTex(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#d9e6cf', 0.22, 9000, 2.5);
    for (let i = 0; i < 1400; i++) { g.strokeStyle = `rgba(40,70,20,${BR(0.05, 0.25)})`; const x = BR(0, w), y = BR(0, h); g.beginPath(); g.moveTo(x, y); g.lineTo(x + BR(-2, 2), y - BR(2, 6)); g.stroke(); }
  }, [190, 265]);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grass, roughness: 0.95 }));
  m.receiveShadow = true;
  scene.add(m);
}

// ---- road, shoulders, markings (cut by the installation)
function stripGeo(x0, x1, z0, z1, step, yOff, uvScaleV = 8) {
  const verts = [], uvs = [], idx = [];
  const n = Math.max(1, Math.ceil((z0 - z1) / step));
  for (let i = 0; i <= n; i++) {
    const z = z0 - (z0 - z1) * i / n, y = roadH(z) + yOff;
    verts.push(x0, y, z, x1, y, z);
    uvs.push(0, -z / uvScaleV, 1, -z / uvScaleV);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
{
  const asphalt = canvasTex(512, 1024, (g, w, h) => {
    noiseFill(g, w, h, '#5d5f62', 0.16, 60000, 2.2);
    for (const cx of [0.22, 0.36, 0.64, 0.78]) { g.fillStyle = 'rgba(30,30,32,0.13)'; g.fillRect(cx * w - 22, 0, 44, h); }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${BR(0, 1) > 0.5 ? '20,20,22' : '140,140,140'},${BR(0.05, 0.12)})`; g.fillRect(BR(0, w), BR(0, h), BR(30, 140), BR(30, 200)); }
    g.strokeStyle = 'rgba(25,25,25,0.5)'; g.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) { let x = BR(0, w), y = BR(0, h); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += BR(-18, 18); y += BR(5, 25); g.lineTo(x, y); } g.stroke(); }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const gravel = canvasTex(128, 256, (g, w, h) => noiseFill(g, w, h, '#8e8573', 0.25, 9000, 2.5));
  gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping;
  const gMat = new THREE.MeshStandardMaterial({ map: gravel, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const lineMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const white = lineMat('#e8e8e2'), yellow = lineMat('#e9b420');
  for (const [za, zb] of [[60, APRON.z1], [APRON.z0, -990]]) {
    const road = new THREE.Mesh(stripGeo(-ROAD_HALF, ROAD_HALF, za, zb, 2, 0.0, 17), roadMat); road.receiveShadow = true; scene.add(road);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(stripGeo(s < 0 ? -ROAD_HALF - 1.1 : ROAD_HALF, s < 0 ? -ROAD_HALF : ROAD_HALF + 1.1, za, zb, 2, -0.02, 6), gMat); m.receiveShadow = true; scene.add(m);
      const l = new THREE.Mesh(stripGeo(s * 3.95 - 0.07, s * 3.95 + 0.07, za, zb, 2, 0.012), white); l.receiveShadow = true; scene.add(l);
    }
    const dashes = [];
    for (let z = za - 2; z > zb + 3.2; z -= 9) dashes.push(stripGeo(-0.08, 0.08, z, z - 3.2, 1.6, 0.014));
    if (dashes.length) { const dm = new THREE.Mesh(mergeGeos(dashes), yellow); dm.receiveShadow = true; scene.add(dm); }
  }
}

// ---- pine trees, telephone poles, radio tower
{
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6); trunkG.translate(0, 1.2, 0);
  const f1 = new THREE.ConeGeometry(2.2, 4.6, 8); f1.translate(0, 4.2, 0);
  const f2 = new THREE.ConeGeometry(1.7, 3.8, 8); f2.translate(0, 6.3, 0);
  const f3 = new THREE.ConeGeometry(1.1, 2.8, 8); f3.translate(0, 8.1, 0);
  const foliG = mergeGeos([f1, f2, f3]);
  const N = 620;
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 1 }), N);
  const folis = new THREE.InstancedMesh(foliG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  while (k < N) {
    const side = buildRand() < 0.5 ? -1 : 1;
    const z = BR(-900, 26);
    const x = side * BR(13, 30 + (-z) * 0.45);
    if (z > -45 && Math.abs(x) < 20) continue;
    const sc = BR(0.7, 1.45);
    p.set(x, terrainH(x, z) - 0.2, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), BR(0, 6.28)); s.set(sc, sc * BR(0.85, 1.25), sc);
    m.compose(p, q, s);
    trunks.setMatrixAt(k, m); folis.setMatrixAt(k, m);
    folis.setColorAt(k, new THREE.Color().setHSL(BR(0.27, 0.33), BR(0.35, 0.55), BR(0.17, 0.27)));
    k++;
  }
  trunks.castShadow = folis.castShadow = true; folis.receiveShadow = true;
  scene.add(trunks, folis);

  const poleMat = new THREE.MeshStandardMaterial({ color: '#6b5640', roughness: 1 });
  const poleG = new THREE.CylinderGeometry(0.13, 0.17, 9.5, 6); poleG.translate(0, 4.75, 0);
  const armG = new THREE.BoxGeometry(2.2, 0.14, 0.14); armG.translate(0, 8.9, 0);
  const tops = [];
  for (let z = 26; z > -900; z -= 38) {
    const x = 12.5, y = terrainH(x, z);
    const pm = new THREE.Mesh(mergeGeos([poleG, armG]), poleMat);
    pm.position.set(x, y - 0.3, z); pm.castShadow = true; scene.add(pm);
    tops.push(new THREE.Vector3(x, y - 0.3 + 8.95, z));
  }
  const wireMat = new THREE.LineBasicMaterial({ color: '#2a2a2a' });
  for (const dx of [-0.95, 0, 0.95]) {
    const pts = [];
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i], b = tops[i + 1];
      for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector3(a.x + dx, a.y + (b.y - a.y) * t - 0.9 * 4 * t * (1 - t), a.z + (b.z - a.z) * t)); }
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }
  const tx = -150, tz = -560, ty = terrainH(tx, tz);
  for (let i = 0; i < 10; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.7 - i * 0.05, 0.75 - i * 0.05, 7, 4, 1, true), new THREE.MeshStandardMaterial({ color: i % 2 ? '#f2f2f2' : '#d23a2a', roughness: 0.7 }));
    seg.position.set(tx, ty + 3.5 + i * 7, tz); scene.add(seg);
  }
}

// ---------------------------------------------------------------- the water pit installation
function block(x0, x1, y0, y1, z0, z1, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
let waterMat, waterNormal;
const paddles = [];
const ramp = new THREE.Group();
const pistons = [];
{
  const A = APRON;
  block(-A.x, A.x, -3, A.top, A.z0, PIT.z0, concrete);                       // far apron (ramp base)
  block(-A.x, -PIT.x, -3, A.top, PIT.z0, WALL.z0, concrete);                 // left side
  block(PIT.x, A.x, -3, A.top, PIT.z0, WALL.z0, concrete);                   // right side
  block(-A.x, A.x, -3, WALL.top, WALL.z0, WALL.z1, concrete);                // crash barrier wall
  block(-A.x, A.x, -3, A.top, WALL.z1, A.z1, concrete);                      // near apron
  block(-PIT.x, PIT.x, -3.2, PIT.floor, PIT.z0, PIT.z1, new THREE.MeshStandardMaterial({ color: '#4a5052', roughness: 1 }));
  // warning bands on the barrier and pit edges
  block(-A.x - 0.01, A.x + 0.01, WALL.top - 0.32, WALL.top - 0.02, WALL.z0 - 0.02, WALL.z0 - 0.01, warnMat);
  block(-A.x, A.x, WALL.top, WALL.top + 0.06, WALL.z0, WALL.z1, hazardMatOf(6));
  for (const s of [-1, 1]) block(s > 0 ? PIT.x : -PIT.x - 0.5, s > 0 ? PIT.x + 0.5 : -PIT.x, A.top, A.top + 0.04, PIT.z0, WALL.z0, hazardMatOf(2));
  block(-A.x, A.x, A.top, A.top + 0.04, PIT.z0 - 0.5, PIT.z0, hazardMatOf(6));
  // iron edge beams
  for (const s of [-1, 1]) block(s * PIT.x - 0.08, s * PIT.x + 0.08, PIT.floor, A.top + 0.02, PIT.z0, WALL.z0, ironMat);

  // water: translucent, with scrolling ripple normals
  const nc = document.createElement('canvas'); nc.width = nc.height = 256;
  const ng = nc.getContext('2d'); const img = ng.createImageData(256, 256);
  const hgt = (x, y) => vnoise(x / 18, y / 18, 0, 11) * 0.7 + vnoise(x / 7, y / 7, 3, 12) * 0.3;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 6, dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 6;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize(); const i = (y * 256 + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ng.putImageData(img, 0, 0);
  waterNormal = new THREE.CanvasTexture(nc); waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping; waterNormal.repeat.set(3, 2);
  waterMat = new THREE.MeshStandardMaterial({ color: '#2f7d86', transparent: true, opacity: 0.74, roughness: 0.08, metalness: 0.2, normalMap: waterNormal, normalScale: new THREE.Vector2(0.6, 0.6), depthWrite: false });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(PIT.x * 2, PIT.z1 - PIT.z0), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, PIT.water, (PIT.z0 + PIT.z1) / 2); water.receiveShadow = true; water.renderOrder = 2;
  scene.add(water);

  // hydraulic launch ramp, hinged at the far end
  ramp.position.set(0, A.top, RAMP.hinge); scene.add(ramp);
  const plateTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#8f969c'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(40,40,40,0.35)'; for (let y = 8; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) { g.save(); g.translate(x, y); g.rotate(0.7); g.fillRect(-5, -1.5, 10, 3); g.restore(); } }, [6, 2]);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.2, RAMP.len), new THREE.MeshStandardMaterial({ map: plateTex, metalness: 0.6, roughness: 0.4 }));
  plate.position.set(0, 0.1, RAMP.len / 2); plate.castShadow = plate.receiveShadow = true; ramp.add(plate);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(8.82, 0.22, 0.3), hazardMatOf(5)); lip.position.set(0, 0.11, RAMP.len - 0.15); ramp.add(lip);
  for (const s of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 12), ironMat); barrel.castShadow = true; scene.add(barrel);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 10), new THREE.MeshStandardMaterial({ color: '#d8dade', metalness: 0.9, roughness: 0.2 })); rod.castShadow = true; scene.add(rod);
    pistons.push({ s, barrel, rod });
  }
  // two rusty paddle wheels churning the water at the pit ends
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 5.55, PIT.water + 0.15, (PIT.z0 + PIT.z1) / 2); scene.add(g);
    const spin = new THREE.Group(); g.add(spin);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 16), ironMat); hub.rotation.z = Math.PI / 2; spin.add(hub);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.1), rustMat);
      p.position.set(0, Math.cos(a) * 0.9, Math.sin(a) * 0.9); p.rotation.x = -a; p.castShadow = true; spin.add(p);
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 10), ironMat); axle.rotation.z = Math.PI / 2; axle.position.x = s * 0.9; g.add(axle);
    paddles.push({ spin, dir: s });
  }
  // bollards with chains along both sides of the pit
  for (const s of [-1, 1]) for (const z of [-11.8, -6.3, -1.0]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.2, 12), concrete); b.position.set(s * 8.6, A.top + 0.6, z); b.castShadow = true; scene.add(b);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 12), warnMat); cap.position.set(s * 8.6, A.top + 1.05, z); scene.add(cap);
  }
}
function hazardMatOf(rep) { const t = hazardTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }); }

// ---- chains (instanced links)
const chains = [];
const chainLinkMesh = (() => {
  const g = new THREE.TorusGeometry(0.13, 0.045, 6, 12); g.scale(1.45, 1, 1);
  const defs = [];
  for (const s of [-1, 1]) { defs.push({ a: [s * 8.6, 1.1, -11.8], b: [s * 8.6, 1.1, -6.3], sag: 0.45, phase: s }); defs.push({ a: [s * 8.6, 1.1, -6.3], b: [s * 8.6, 1.1, -1.0], sag: 0.45, phase: s + 1.4 }); }
  let total = 0;
  for (const d of defs) {
    const A = new THREE.Vector3(...d.a), B = new THREE.Vector3(...d.b);
    const n = Math.round(A.distanceTo(B) * 1.06 / 0.27);
    chains.push({ A, B, sag: d.sag, phase: d.phase, n, offset: total, kick: 0, kickT: -99 });
    total += n;
  }
  const im = new THREE.InstancedMesh(g, rustMat, total); im.castShadow = true; scene.add(im); return im;
})();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s1 = new THREE.Vector3(1, 1, 1);
function updateChains(t) {
  for (const c of chains) {
    const kickAmp = t >= c.kickT ? c.kick * Math.exp(-(t - c.kickT) * 0.9) : 0;
    const ang = 0.08 * Math.sin(1.3 * t + c.phase) + kickAmp * Math.sin((t - c.kickT) * 3.2);
    const axis = new THREE.Vector3().subVectors(c.B, c.A).normalize();
    const down = new THREE.Vector3(0, -1, 0).applyAxisAngle(axis, ang);
    for (let i = 0; i < c.n; i++) {
      const s = (i + 0.5) / c.n;
      const P = new THREE.Vector3().lerpVectors(c.A, c.B, s).addScaledVector(down, c.sag * 4 * s * (1 - s));
      const T = new THREE.Vector3().subVectors(c.B, c.A).addScaledVector(down, c.sag * 4 * (1 - 2 * s)).normalize();
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), T);
      if (i % 2) { _q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); _q.multiply(_q2); }
      _m.compose(P, _q, _s1); chainLinkMesh.setMatrixAt(c.offset + i, _m);
    }
  }
  chainLinkMesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- vehicles
const MAT = {
  glass: new THREE.MeshStandardMaterial({ color: '#2b3a48', metalness: 0.6, roughness: 0.08 }),
  broken: new THREE.MeshStandardMaterial({ color: '#0e1114', roughness: 0.9 }),
  black: new THREE.MeshStandardMaterial({ color: '#16181a', roughness: 0.7 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#232527', roughness: 0.8 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d8dade', metalness: 0.9, roughness: 0.18 }),
  tire: new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.9 }),
  hub: new THREE.MeshStandardMaterial({ color: '#a9adb2', metalness: 0.7, roughness: 0.35 }),
  hubBlack: new THREE.MeshStandardMaterial({ color: '#202224', metalness: 0.6, roughness: 0.3 }),
  head: new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c8', emissiveIntensity: 0.35, roughness: 0.2 }),
  tail: new THREE.MeshStandardMaterial({ color: '#b3101a', emissive: '#6a0008', emissiveIntensity: 0.4, roughness: 0.3 }),
  red: new THREE.MeshStandardMaterial({ color: '#d4141c', emissive: '#7a0000', emissiveIntensity: 0.5, roughness: 0.3 }),
  amber: new THREE.MeshStandardMaterial({ color: '#ffae1a', emissive: '#a35a00', emissiveIntensity: 0.5, roughness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: '#4d5257', roughness: 0.55, metalness: 0.55 }),
  seat: new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.85 }),
};
const paint = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.28 });

function boxG(cx, cy, cz, w, h, l, seg = [3, 2, 6], taper = null) {
  const g = new THREE.BoxGeometry(w, h, l, seg[0], seg[1], seg[2]);
  if (taper) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      if (y > 0) {
        p.setX(i, p.getX(i) * (1 - (taper.x || 0)));
        if (z > 0) p.setZ(i, z - (taper.front || 0)); else p.setZ(i, z + (taper.rear || 0));
        if (taper.wedge && z > 0) p.setY(i, y - taper.wedge * (z / (l / 2)) * h * 2);
      }
    }
  }
  g.translate(cx, cy, cz);
  return g;
}
function beamG(a, b, t) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = d.length();
  const g = new THREE.BoxGeometry(t, len, t, 1, 3, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

// crash order (README lineup). lane = driving x; rest = final pose in the pit
const SPECS = [
  { key: 'coupe', label: 'RED SPORTS COUPE', color: '#e0161b', L: 4.3, Wd: 1.8, bodyH: 0.58, clr: 0.2, wheelR: 0.32, wheelZ: [1.35, -1.3],
    cabin: { z0: -1.25, z1: 0.75, h: 0.52, front: 0.72, rear: 0.62, x: 0.16 }, lip: true, lane: -1.6, speed: 30, damage: 78 },
  { key: 'roadster', label: 'BLUE ROADSTER', color: '#1d48d1', L: 4.1, Wd: 1.78, bodyH: 0.6, clr: 0.2, wheelR: 0.32, wheelZ: [1.3, -1.25],
    open: true, lane: 1.5, speed: 31, damage: 84 },
  { key: 'hatch', label: 'GREEN HOT HATCH', color: '#5cc21c', L: 4.0, Wd: 1.82, bodyH: 0.66, clr: 0.24, wheelR: 0.32, wheelZ: [1.28, -1.25],
    cabin: { z0: -1.75, z1: 0.6, h: 0.64, front: 0.6, rear: 0.15, x: 0.1 }, roofSpoiler: true, vents: true, lane: -1.8, speed: 30, damage: 91 },
  { key: 'supercar', label: 'ORANGE SUPERCAR', color: '#ff7a0d', L: 4.55, Wd: 1.98, bodyH: 0.55, clr: 0.14, wheelR: 0.34, wheelZ: [1.4, -1.35], wedge: 0.22,
    cabin: { z0: -0.95, z1: 0.85, h: 0.46, front: 0.8, rear: 0.45, x: 0.2 }, wing: true, blackWheels: true, lane: 1.7, speed: 33, damage: 88 },
  { key: 'bus', label: 'YELLOW SCHOOL BUS', color: '#f6b400', L: 11, Wd: 2.5, bus: true, clr: 0.42, wheelR: 0.52, wheelZ: [4.35, -2.85], lane: 0.2, speed: 25, damage: 97 },
  { key: 'muscle', label: 'PINK MUSCLE CAR', color: '#ff4fa3', L: 4.8, Wd: 1.95, bodyH: 0.7, clr: 0.24, wheelR: 0.35, wheelZ: [1.5, -1.45],
    cabin: { z0: -1.45, z1: 0.45, h: 0.56, front: 0.62, rear: 0.95, x: 0.12 }, stripes: true, scoop: true, chromeBumpers: true, lane: -1.4, speed: 30, damage: 86 },
  { key: 'gt', label: 'WHITE GRAND TOURER', color: '#f2f0e8', L: 4.95, Wd: 1.96, bodyH: 0.64, clr: 0.24, wheelR: 0.35, wheelZ: [1.6, -1.5],
    cabin: { z0: -1.6, z1: 0.5, h: 0.58, front: 0.72, rear: 0.62, x: 0.14 }, glassRoof: true, grille: true, lane: 0.6, speed: 26, damage: 93 },
  { key: 'semi', label: 'GREEN CAR-CARRIER SEMI', color: '#22b24c', L: 5.8, Wd: 2.5, semi: true, clr: 0.6, wheelR: 0.53, wheelZ: [1.9, -1.75], lane: 1.0, speed: 23, damage: 100 },
];
// how each one flies and wrecks
const CRASH = [
  { A: 0.1, zImp: WALL.z0, front: 1.1, roof: 0.08, rest: { x: -2.3, z: -4.4, y: PIT.floor, yaw: 0.28, pitch: 0.12, roll: 0.05 }, detach: ['bumperF', 'lip', 'wheelFR'], shards: 170, chunks: 18 },
  { A: 0.12, zImp: WALL.z0, front: 1.2, roof: 0.0, rest: { x: 2.4, z: -4.6, y: PIT.floor, yaw: -0.35, pitch: 0.1, roll: 0.14 }, detach: ['bumperF', 'hoops', 'wheelFL', 'doorL'], shards: 120, chunks: 18 },
  { A: 0.09, zImp: WALL.z0, front: 1.1, roof: 0.25, rest: { x: -3.0, z: -7.9, y: PIT.floor, yaw: -0.6, pitch: 0.0, roll: -0.2 }, detach: ['bumperF', 'roofSpoiler', 'doorR'], shards: 190, chunks: 20 },
  { A: 0.14, zImp: WALL.z0, front: 1.25, roof: 0.15, rest: { x: 3.3, z: -8.0, y: PIT.floor, yaw: 0.5, pitch: 0.0, roll: 0.25 }, detach: ['bumperF', 'wing', 'doorL', 'wheelFR'], shards: 200, chunks: 24 },
  { A: 0.12, zImp: WALL.z0, front: 2.0, roof: 0.3, bend: 0.7, rest: { x: 0.2, z: -5.6, y: -0.35, yaw: 0.1, pitch: 0.08, roll: 0.08 }, detach: ['bumperF', 'stopArm', 'wheelFL', 'lightsF'], shards: 650, chunks: 44,
    land: [[0, 0.3, 0.12], [1, 0.25, 0.1]] },
  { A: 0.1, zImp: WALL.z0, front: 1.3, roof: 0.2, rest: { x: -3.3, z: -7.4, y: PIT.floor + 1.1, yaw: 0.4, pitch: 0.22, roll: -0.15 }, detach: ['bumperF', 'scoop', 'bumperR', 'doorR'], shards: 210, chunks: 22,
    land: [[2, 0.3, 0.1]] },
  { A: 0.4, zImp: -3.4, front: 1.0, roof: 0.35, rest: { x: 0.6, z: -6.3, y: 2.75, yaw: 1.15, pitch: 0.05, roll: 0.22 }, detach: ['bumperF', 'doorL', 'doorR', 'wheelFL'], shards: 240, chunks: 22,
    land: [[4, 0.35, 0.05]] },
  { A: 0.08, zImp: WALL.z0, front: 1.6, roof: 0.3, rest: { x: 3.1, z: -5.0, y: -0.95, yaw: -0.15, pitch: 0.48, roll: 0.18 }, detach: ['bumperF', 'stacks', 'wheelFR', 'tankL'], shards: 300, chunks: 40,
    land: [[1, 0.3, 0.1], [3, 0.3, 0.1], [4, 0.0, 0.0]] },
];

const vehicles = [];
function buildVehicle(spec, idx) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const body = paint(spec.color);
  const v = { spec, idx, root, deform: [], parts: {}, glass: [], wheels: [], seed: 100 + idx * 17,
    def: { front: 0, rear: 0, roof: 0, bend: 0 }, defDirty: true, state: 'wait' };
  const L = spec.L, hw = spec.Wd / 2;
  const add = (geo, mat, opts = {}) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; root.add(m);
    if (opts.deform !== false) v.deform.push({ mesh: m, orig: geo.attributes.position.array.slice() });
    if (opts.part) v.parts[opts.part] = (v.parts[opts.part] || []).concat([m]);
    if (opts.glass) v.glass.push(m);
    return m;
  };
  let roofY, hoodY;
  if (spec.bus) {
    const c = spec.clr, bh = 2.55;
    add(boxG(0, c + bh / 2, -0.85, spec.Wd, bh, 9.3, [4, 6, 22]), body);
    add(boxG(0, c + 0.6, 4.65, 2.2, 1.2, 1.75, [3, 2, 4], { x: 0.06, front: 0.25 }), body);
    add(boxG(0, c + 0.45, 5.5, 1.5, 0.55, 0.06, [2, 1, 1]), MAT.plastic, { part: 'lightsF' });
    add(boxG(0, c + 0.2, 5.55, 2.35, 0.22, 0.2, [3, 1, 1]), MAT.black, { part: 'bumperF' });
    add(boxG(0, c + 0.2, -5.55, 2.5, 0.22, 0.18, [3, 1, 1]), MAT.black, { part: 'bumperR' });
    for (const s of [-1, 1]) {
      add(boxG(s * 0.78, c + 0.75, 5.53, 0.26, 0.2, 0.04, [1, 1, 1]), MAT.head, { part: 'lightsF' });
      for (const ry of [0.42, 0.95, 1.3]) add(boxG(s * (hw + 0.012), c + ry, -0.85, 0.03, 0.09, 9.2, [1, 1, 18]), MAT.black);
      for (let k = 0; k < 9; k++) add(boxG(s * (hw + 0.008), c + 1.85, 3.15 - k * 0.98, 0.03, 0.75, 0.82, [1, 1, 1]), MAT.glass, { glass: true });
      add(boxG(s * 0.75, c + bh + 0.08, 3.55, 0.22, 0.14, 0.16, [1, 1, 1]), MAT.red);
      add(boxG(s * 0.4, c + bh + 0.08, 3.55, 0.2, 0.13, 0.15, [1, 1, 1]), MAT.amber);
      add(boxG(s * 0.75, c + bh + 0.08, -5.25, 0.22, 0.14, 0.16, [1, 1, 1]), MAT.red);
      add(boxG(s * 0.8, c + 0.7, -5.52, 0.25, 0.32, 0.04, [1, 1, 1]), MAT.tail);
    }
    add(boxG(0, c + 1.85, 3.66, 2.3, 0.85, 0.03, [2, 1, 1]), MAT.glass, { glass: true });
    add(boxG(0, c + 1.85, -5.52, 2.1, 0.7, 0.03, [2, 1, 1]), MAT.glass, { glass: true });
    add(boxG(0, c + bh + 0.02, -0.85, spec.Wd - 0.1, 0.06, 9.2, [3, 1, 18]), paint('#ffc21a'));
    const sa = new THREE.Shape(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; sa[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 0.25, Math.sin(a) * 0.25); }
    const sg = new THREE.ExtrudeGeometry(sa, { depth: 0.03, bevelEnabled: false }); sg.rotateY(Math.PI / 2); sg.translate(-hw - 0.05, c + 1.45, 2.75);
    add(sg, MAT.red, { part: 'stopArm', deform: false });
    roofY = c + bh; hoodY = c + 1.0;
  } else if (spec.semi) {
    const c = spec.clr;
    add(boxG(0, c + 1.0, 2.15, 2.5, 2.0, 1.5, [3, 3, 4]), body);                                          // cab lower
    add(boxG(0, c + 2.45, 2.12, 2.42, 0.9, 1.44, [3, 2, 4], { x: 0.02, front: 0.05 }), MAT.glass, { glass: true });
    add(boxG(0, c + 2.95, 2.05, 2.46, 0.14, 1.5, [3, 1, 4]), body);
    add(boxG(0, c + 2.45, 1.38, 2.46, 0.95, 0.06, [3, 2, 1]), body);
    for (const s of [-1, 1]) {
      add(beamG([s * 1.2, c + 2.0, 2.88], [s * 1.2, c + 2.92, 2.84], 0.1), body);
      add(boxG(s * 0.9, c + 0.55, 2.92, 0.36, 0.22, 0.04, [1, 1, 1]), MAT.head, { part: 'lightsF' });
      add(boxG(s * 0.6, c + 3.05, 2.6, 0.16, 0.1, 0.1, [1, 1, 1]), MAT.amber);
      add(boxG(s * 1.1, c + 3.05, 2.6, 0.16, 0.1, 0.1, [1, 1, 1]), MAT.amber);
      const tank = new THREE.CylinderGeometry(0.32, 0.32, 1.3, 14); tank.rotateX(Math.PI / 2); tank.translate(s * 1.05, c + 0.15, 0.2);
      add(tank, MAT.chrome, { part: s < 0 ? 'tankL' : 'tankR' });
      const st = new THREE.CylinderGeometry(0.1, 0.1, 2.0, 10); st.translate(s * 1.0, c + 3.0, 1.25);
      add(st, MAT.chrome, { part: 'stacks' });
    }
    add(boxG(0, c + 0.9, 2.92, 1.7, 0.7, 0.05, [2, 2, 1]), MAT.chrome, { part: 'lightsF' });
    add(boxG(0, c + 0.2, 2.98, 2.5, 0.3, 0.2, [3, 1, 1]), MAT.chrome, { part: 'bumperF' });
    add(boxG(0, c + 0.05, -0.6, 1.0, 0.35, 4.6, [2, 1, 8]), MAT.steel);                               // chassis rails
    add(boxG(0, c + 0.35, -1.75, 1.6, 0.12, 1.4, [2, 1, 2]), MAT.black);                              // fifth wheel
    roofY = c + 3.0; hoodY = c + 1.6;
  } else {
    const c = spec.clr, bh = spec.bodyH, cb = spec.cabin;
    add(boxG(0, c + bh / 2, 0, spec.Wd, bh, L, [4, 3, 10], spec.wedge ? { wedge: spec.wedge } : null), body);
    const yb = c + bh;
    if (spec.open) {
      // roadster: windshield, seats, chrome roll hoops
      add(boxG(0, yb + 0.22, 0.45, spec.Wd - 0.25, 0.44, 0.05, [2, 1, 1], { x: 0.06, front: 0.22, rear: -0.22 }), MAT.glass, { glass: true });
      for (const s of [-1, 1]) {
        add(boxG(s * 0.42, yb + 0.16, -0.35, 0.5, 0.32, 0.5, [1, 1, 1]), MAT.seat);
        add(beamG([s * 0.42 - 0.22, yb, -0.75], [s * 0.42 - 0.2, yb + 0.45, -0.8], 0.06), MAT.chrome, { part: 'hoops' });
        add(beamG([s * 0.42 + 0.22, yb, -0.75], [s * 0.42 + 0.2, yb + 0.45, -0.8], 0.06), MAT.chrome, { part: 'hoops' });
        add(beamG([s * 0.42 - 0.2, yb + 0.45, -0.8], [s * 0.42 + 0.2, yb + 0.45, -0.8], 0.06), MAT.chrome, { part: 'hoops' });
        add(boxG(s * (hw - 0.3), c + bh * 0.62, L / 2 + 0.005, 0.32, 0.14, 0.03, [1, 1, 1]), MAT.head, { part: 'lightsF' });
        add(boxG(s * (hw - 0.25), c + bh * 0.65, -L / 2 - 0.005, 0.3, 0.14, 0.03, [1, 1, 1]), MAT.tail);
        add(boxG(s * (hw + 0.012), c + bh * 0.55, 0.0, 0.03, bh * 0.8, 1.0, [1, 2, 2]), body, { part: s < 0 ? 'doorL' : 'doorR' });
      }
      roofY = yb + 0.45;
    } else {
      const cl = cb.z1 - cb.z0, cz = (cb.z0 + cb.z1) / 2;
      add(boxG(0, yb + cb.h / 2, cz, spec.Wd - 0.08, cb.h, cl, [3, 2, 5], { x: cb.x, front: cb.front, rear: cb.rear }), MAT.glass, { glass: true });
      const topW = (spec.Wd - 0.08) * (1 - cb.x), rz0 = cb.z0 + cb.rear, rz1 = cb.z1 - cb.front;
      add(boxG(0, yb + cb.h + 0.035, (rz0 + rz1) / 2, topW + 0.04, 0.07, rz1 - rz0 + 0.06, [2, 1, 4]), spec.glassRoof ? MAT.glass : body, spec.glassRoof ? { glass: true } : {});
      for (const s of [-1, 1]) {
        const xb = s * (spec.Wd / 2 - 0.05), xt = s * (topW / 2);
        add(beamG([xb, yb, cb.z1], [xt, yb + cb.h, rz1], 0.09), body);
        add(beamG([xb, yb, cb.z0], [xt, yb + cb.h, rz0], 0.12), body);
        add(beamG([xb * 1.005, yb, cz - 0.1], [xt * 1.005, yb + cb.h, (rz0 + rz1) / 2 - 0.1], 0.08), body);
        add(boxG(s * (hw - 0.3), c + bh * 0.62 - (spec.wedge ? 0.1 : 0), L / 2 + 0.005, 0.34, 0.12, 0.03, [1, 1, 1]), MAT.head, { part: 'lightsF' });
        add(boxG(s * (hw - 0.25), c + bh * 0.65, -L / 2 - 0.005, 0.32, 0.12, 0.03, [1, 1, 1]), MAT.tail);
        add(boxG(s * (hw + 0.012), c + bh * 0.55, cz + cl * 0.15, 0.03, bh * 0.85, Math.min(1.15, cl * 0.55), [1, 2, 2]), body, { part: s < 0 ? 'doorL' : 'doorR' });
        if (spec.wedge) add(boxG(s * (hw + 0.01), c + bh * 0.45, -0.6, 0.03, bh * 0.4, 0.7, [1, 1, 1]), MAT.black);
      }
      roofY = yb + cb.h;
    }
    hoodY = yb - 0.08;
    const bm = spec.chromeBumpers ? MAT.chrome : MAT.plastic;
    add(boxG(0, c + 0.12, L / 2 + 0.06, spec.Wd + 0.04, 0.22, 0.16, [3, 1, 1]), bm, { part: 'bumperF' });
    add(boxG(0, c + 0.12, -L / 2 - 0.06, spec.Wd + 0.04, 0.22, 0.16, [3, 1, 1]), bm, { part: 'bumperR' });
    add(boxG(0, c + bh * 0.4, L / 2 + 0.01, spec.Wd * 0.45, bh * 0.25, 0.03, [1, 1, 1]), spec.grille ? MAT.chrome : MAT.black, { part: 'lightsF' });
    if (spec.lip) add(boxG(0, yb + 0.05, -L / 2 + 0.15, spec.Wd - 0.3, 0.06, 0.25, [2, 1, 1]), MAT.black, { part: 'lip' });
    if (spec.roofSpoiler) add(boxG(0, roofY + 0.04, spec.cabin.z0 + spec.cabin.rear - 0.12, spec.Wd * 0.8, 0.06, 0.3, [2, 1, 1]), MAT.black, { part: 'roofSpoiler' });
    if (spec.vents) for (const s of [-1, 1]) add(boxG(s * 0.35, yb + 0.005, L / 2 - 0.55, 0.3, 0.02, 0.4, [1, 1, 1]), MAT.black);
    if (spec.wing) {
      add(beamG([-0.6, yb - 0.05, -L / 2 + 0.35], [-0.6, yb + 0.35, -L / 2 + 0.3], 0.06), MAT.black, { part: 'wing' });
      add(beamG([0.6, yb - 0.05, -L / 2 + 0.35], [0.6, yb + 0.35, -L / 2 + 0.3], 0.06), MAT.black, { part: 'wing' });
      add(boxG(0, yb + 0.38, -L / 2 + 0.28, spec.Wd - 0.1, 0.05, 0.42, [3, 1, 1]), MAT.black, { part: 'wing' });
    }
    if (spec.stripes) for (const s of [-1, 1]) {
      add(boxG(s * 0.2, yb + 0.006, 0.6, 0.18, 0.012, L / 2, [1, 1, 6]), MAT.white);
      add(boxG(s * 0.2, roofY + 0.072, (spec.cabin.z0 + spec.cabin.rear + spec.cabin.z1 - spec.cabin.front) / 2, 0.18, 0.012, 0.9, [1, 1, 3]), MAT.white);
    }
    if (spec.scoop) add(boxG(0, yb + 0.08, L / 2 - 0.9, 0.7, 0.16, 0.8, [2, 1, 2], { x: 0.1, front: 0.2 }), paint(spec.color), { part: 'scoop' });
  }
  v.roofY = roofY; v.hoodY = hoodY;
  const tireG = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, spec.semi || spec.bus ? 0.3 : 0.27, 18); tireG.rotateZ(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(spec.wheelR * 0.6, spec.wheelR * 0.6, 0.29, 10); hubG.rotateZ(Math.PI / 2);
  const dual = spec.bus || spec.semi;
  for (const wz of spec.wheelZ) for (const s of [-1, 1]) {
    const name = 'wheel' + (wz > 0 ? 'F' : 'R') + (s < 0 ? 'L' : 'R');
    const g = new THREE.Group(); const spin = new THREE.Group(); g.add(spin);
    const tire = new THREE.Mesh(tireG, MAT.tire); tire.castShadow = true; spin.add(tire);
    spin.add(new THREE.Mesh(hubG, spec.blackWheels ? MAT.hubBlack : MAT.hub));
    if (dual && wz < 0) { const t2 = new THREE.Mesh(tireG, MAT.tire); t2.position.x = -s * 0.3; t2.castShadow = true; spin.add(t2); }
    g.position.set(s * (hw - 0.12), spec.wheelR, wz);
    root.add(g);
    v.wheels.push({ g, spin, name, z0: wz, side: s, attached: true });
    v.parts[name] = [g];
  }
  return v;
}
SPECS.forEach((s, i) => vehicles.push(buildVehicle(s, i)));

// car-carrier trailer pulled by the semi, with three plain gray cars on board
const trailer = { root: new THREE.Group(), cars: [], len: 12.5 };
{
  const T = trailer.root; T.visible = false; scene.add(T);
  const steel = new THREE.MeshStandardMaterial({ color: '#4a4f55', metalness: 0.6, roughness: 0.5 });
  const addM = (g, m) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; T.add(mesh); return mesh; };
  for (const s of [-1, 1]) {
    addM(new THREE.BoxGeometry(0.16, 0.3, 11.0), steel).position.set(s * 1.15, 1.0, -0.9);
    addM(new THREE.BoxGeometry(0.12, 0.2, 12.4), steel).position.set(s * 1.18, 2.7, -0.2);
    for (let k = 0; k < 6; k++) addM(new THREE.BoxGeometry(0.1, 1.7, 0.1), steel).position.set(s * 1.18, 1.85, 5.2 - k * 2.2);
    addM(new THREE.BoxGeometry(0.14, 0.14, 0.14), MAT.amber).position.set(s * 1.2, 2.85, 5.9);
  }
  addM(new THREE.BoxGeometry(2.3, 0.08, 10.8), steel).position.set(0, 1.12, -0.9);           // lower deck
  addM(new THREE.BoxGeometry(2.3, 0.08, 12.0), steel).position.set(0, 2.62, -0.2);           // upper deck
  addM(new THREE.BoxGeometry(2.0, 0.5, 1.6), steel).position.set(0, 1.5, 5.4);               // gooseneck over the fifth wheel
  const tireG = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 16); tireG.rotateZ(Math.PI / 2);
  for (const z of [-4.6, -5.7]) for (const s of [-1, 1]) addM(tireG, MAT.tire).position.set(s * 0.95, 0.5, z);
  // carried cars
  const gray = paint('#8e959c');
  const mk = (x, y, z) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.6, 4.2), gray); b.position.y = 0.55; b.castShadow = true; g.add(b);
    const cbn = new THREE.Mesh(boxG(0, 1.1, -0.2, 1.6, 0.5, 2.0, [1, 1, 1], { x: 0.12, front: 0.45, rear: 0.3 }), MAT.glass); cbn.castShadow = true; g.add(cbn);
    const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12); wg.rotateZ(Math.PI / 2);
    for (const wz of [1.3, -1.3]) for (const s of [-1, 1]) { const w = new THREE.Mesh(wg, MAT.tire); w.position.set(s * 0.8, 0.3, wz); g.add(w); }
    g.position.set(x, y, z); T.add(g); trailer.cars.push(g);
  };
  mk(0, 2.66, 3.0); mk(0, 2.66, -2.6); mk(0, 1.16, -2.4);
}

// crumple deformation, in vehicle-local coordinates
function applyDeform(v) {
  const d = v.def, sp = v.spec, hl = sp.L / 2, hw = sp.Wd / 2, s = v.seed;
  for (const { mesh, orig } of v.deform) {
    const pos = mesh.geometry.attributes.position, arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      let x = orig[i], y = orig[i + 1], z = orig[i + 2];
      if (d.front > 0) {
        const F = d.front, zc = hl - F, zone = 0.7 * F + 0.3;
        if (z > zc - zone) {
          const w = clamp((z - (zc - zone)) / zone, 0, 1.6);
          if (z > zc) z = zc + (z - zc) * 0.16;
          const amp = Math.min(F, 1.6) * w;
          x += (vnoise(x * 2.3, y * 2.3, z * 2.3, s) - 0.5) * 0.5 * amp + Math.sign(x) * 0.1 * amp;
          y += (vnoise(x * 2.1 + 7, y * 2.1, z * 2.1, s + 1) - 0.5) * 0.45 * amp + (y > v.hoodY ? 0.22 * amp * (1 - Math.abs(x) / hw) : -0.03 * amp);
          z += (vnoise(x * 1.9, y * 1.9 + 3, z * 1.9, s + 2) - 0.5) * 0.3 * amp;
        }
      }
      if (d.roof > 0 && y > v.roofY - 0.45) {
        const w = clamp((y - (v.roofY - 0.45)) / 0.45, 0, 1);
        y -= d.roof * w * (0.5 + vnoise(x * 1.4, 1, z * 1.1, s + 5));
      }
      if (d.bend) {
        const t = 1 - Math.abs(z) / hl;
        y += d.bend * t * t * 0.9 * (y > 0.6 ? 1 : 0.7);
        x += d.bend * 0.3 * t * t;
      }
      arr[i] = x; arr[i + 1] = y; arr[i + 2] = z;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
  for (const w of v.wheels) if (w.attached && w.z0 > 0) w.g.position.z = Math.min(w.z0, hl - d.front - sp.wheelR * 0.6);
  v.defDirty = false;
}

// ---------------------------------------------------------------- debris, glass, dust, water fx
const debris = [];
const CHUNK_MAX = 900, SHARD_MAX = 4500, DUST_MAX = 300, DROP_MAX = 3000, FOAM_MAX = 260, RING_MAX = 18;
const chunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0.3 }), CHUNK_MAX);
chunkMesh.castShadow = true; chunkMesh.count = 0; scene.add(chunkMesh);
const shardGeo = new THREE.BufferGeometry();
shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.6, 0.5, 0, -0.4, -0.55, 0, -0.3], 3));
shardGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
const shardMesh = new THREE.InstancedMesh(shardGeo, new THREE.MeshStandardMaterial({ color: '#d8f0f6', metalness: 0.85, roughness: 0.06, side: THREE.DoubleSide, emissive: '#3a5560', emissiveIntensity: 0.4 }), SHARD_MAX);
shardMesh.count = 0; scene.add(shardMesh);
const dropMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#e6f6ff', roughness: 0.15, metalness: 0.1, emissive: '#7fa6b4', emissiveIntensity: 0.35 }), DROP_MAX);
dropMesh.count = DROP_MAX; scene.add(dropMesh);
const chunks = [], shards = [], dusts = [], drops = [], foams = [], rings = [];
const softTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
for (let i = 0; i < DUST_MAX; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#cbbfa6', transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; scene.add(sp); dusts.push({ sp, alive: false }); }
for (let i = 0; i < FOAM_MAX; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; sp.renderOrder = 3; scene.add(sp); foams.push({ sp, alive: false }); }
for (let i = 0; i < DROP_MAX; i++) drops.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0 });
for (let i = 0; i < RING_MAX; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; scene.add(m); rings.push({ m, alive: false });
}
_m.makeScale(0, 0, 0); for (let i = 0; i < DROP_MAX; i++) dropMesh.setMatrixAt(i, _m);

function groundAt(x, z) {
  if (inPit(x, z)) return PIT.floor;
  if (Math.abs(x) < APRON.x && z > APRON.z0 && z < APRON.z1) return (z > WALL.z0 && z < WALL.z1) ? WALL.top : APRON.top;
  return Math.abs(x) < 7.5 ? roadH(z) : terrainH(x, z);
}

let simTime = 0;
const EVENTS = { vehicles: [], clatter: [], splashes: [], tracks: [] };

function spawnSplash(x, z, size, logIt = true) {
  const n = Math.round(160 * size);
  for (let i = 0, k = 0; i < DROP_MAX && k < n; i++) {
    const d = drops[i]; if (d.alive) continue;
    const a = SR(0, Math.PI * 2), r = SR(0.2, 1.4) * Math.sqrt(size);
    d.alive = true; d.size = SR(0.05, 0.18) * Math.sqrt(size);
    d.pos.set(x + Math.cos(a) * r, PIT.water + 0.05, z + Math.sin(a) * r);
    const hs = SR(1.5, 7) * Math.sqrt(size);
    d.vel.set(Math.cos(a) * hs, SR(4, 11) * Math.sqrt(size), Math.sin(a) * hs);
    k++;
  }
  for (let i = 0, k = 0; i < FOAM_MAX && k < Math.round(16 * size); i++) {
    const f = foams[i]; if (f.alive) continue;
    f.alive = true; f.born = simTime; f.life = SR(1.0, 2.2);
    f.pos = new THREE.Vector3(x + SR(-1.5, 1.5) * size, PIT.water + SR(0, 0.6), z + SR(-1.2, 1.2) * size);
    f.vel = new THREE.Vector3(SR(-1.5, 1.5), SR(2, 7) * Math.sqrt(size), SR(-1.5, 1.5));
    f.s0 = SR(0.8, 1.8) * size; f.s1 = SR(3, 5.5) * size; f.op = SR(0.55, 0.85);
    k++;
  }
  for (let k = 0; k < 2; k++) { const r = rings.find((r) => !r.alive); if (!r) break; r.alive = true; r.born = simTime + k * 0.25; r.x = x; r.z = z; r.size = size; }
  if (logIt) EVENTS.splashes.push({ t: simTime, x, z, size });
}
function spawnDust(at, n, scale = 1) {
  for (let i = 0; i < n; i++) {
    const d = dusts.find((d) => !d.alive); if (!d) return;
    d.alive = true; d.born = simTime; d.life = SR(3, 5.5) * scale;
    d.pos = new THREE.Vector3(at.x + SR(-1.5, 1.5) * scale, at.y + SR(0, 1.0), at.z + SR(-1, 1) * scale);
    d.vel = new THREE.Vector3(SR(-1.4, 1.4), SR(0.2, 1.0), SR(-1.0, 1.4));
    d.s0 = SR(1.0, 2.0) * scale; d.s1 = SR(3.5, 6) * scale; d.op = SR(0.2, 0.36);
  }
}

function integrateBody(b, dt) {
  if (b.sleep) return;
  const wet = inPit(b.pos.x, b.pos.z) && b.pos.y < PIT.water;
  b.vel.y -= (wet ? 2.5 : 9.81) * dt;
  if (wet) { b.vel.multiplyScalar(1 - Math.min(0.9, 3.0 * dt)); if (b.av) b.av.multiplyScalar(1 - Math.min(0.9, 2.0 * dt)); }
  const wasAbove = b.pos.y >= PIT.water;
  b.pos.addScaledVector(b.vel, dt);
  if (b.av) { _v.copy(b.av).multiplyScalar(dt); const ang = _v.length(); if (ang > 1e-6) { _q.setFromAxisAngle(_v.normalize(), ang); b.quat.premultiply(_q); } }
  if (wasAbove && b.pos.y < PIT.water && inPit(b.pos.x, b.pos.z) && b.vel.y < -2 && b.mass > 0.4) {
    spawnSplash(b.pos.x, b.pos.z, clamp(b.mass * 0.35, 0.15, 0.8), false);
    EVENTS.splashes.push({ t: simTime, x: b.pos.x, z: b.pos.z, size: clamp(b.mass * 0.35, 0.15, 0.8), small: true });
  }
  // barrier wall face
  if (Math.abs(b.pos.x) < APRON.x && b.pos.z > WALL.z0 - b.rad && b.pos.z < WALL.z0 + 0.3 && b.pos.y < WALL.top && b.vel.z > 0) { b.pos.z = WALL.z0 - b.rad; b.vel.z *= -0.3; }
  const g = groundAt(b.pos.x, b.pos.z) + b.rad;
  if (b.pos.y < g) {
    const impactV = -b.vel.y;
    b.pos.y = g;
    if (b.vel.y < 0) b.vel.y = -b.vel.y * (wet ? 0.05 : b.rest);
    b.vel.x *= b.fric; b.vel.z *= b.fric;
    if (b.av) b.av.multiplyScalar(0.72);
    if (b.log && !wet && impactV > 2.2 && b.bounces < 4) { EVENTS.clatter.push({ t: simTime, x: b.pos.x, z: b.pos.z, mag: Math.min(1, impactV / 9) * b.mass, kind: b.kind }); b.bounces++; }
    if (b.vel.lengthSq() < 0.05 && (!b.av || b.av.lengthSq() < 0.3)) { b.vel.set(0, 0, 0); if (b.av) b.av.set(0, 0, 0); b.sleep = true; }
  }
}

function makeBody(holder, vel, rad, opts = {}) {
  return Object.assign({ obj: holder, pos: holder.position, quat: holder.quaternion, vel, av: new THREE.Vector3(SR(-7, 7), SR(-5, 5), SR(-7, 7)),
    rad, rest: 0.25, fric: 0.6, sleep: false, log: true, bounces: 0, mass: 0.6, kind: 'panel' }, opts);
}
function detachToScene(obj, root) {
  root.updateMatrixWorld(true);
  if (obj.isGroup) {
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion(); obj.getWorldPosition(wp); obj.getWorldQuaternion(wq);
    obj.parent.remove(obj); scene.add(obj); obj.position.copy(wp); obj.quaternion.copy(wq); obj.scale.set(1, 1, 1); obj.rotation.setFromQuaternion(wq);
  } else {
    obj.geometry.computeBoundingBox();
    const c = new THREE.Vector3(); obj.geometry.boundingBox.getCenter(c);
    obj.geometry.translate(-c.x, -c.y, -c.z);
    const wp = c.clone().applyMatrix4(root.matrixWorld);
    obj.parent.remove(obj); scene.add(obj); obj.position.copy(wp); obj.quaternion.copy(root.quaternion);
  }
}
function spawnPart(v, name, speed) {
  const list = v.parts[name]; if (!list) return;
  for (const obj of list) {
    if (obj.userData.detached) continue;
    obj.userData.detached = true;
    const di = v.deform.findIndex((d) => d.mesh === obj); if (di >= 0) v.deform.splice(di, 1);
    detachToScene(obj, v.root);
    const w = v.wheels.find((w) => w.g === obj); if (w) w.attached = false;
    const bb = new THREE.Box3().setFromObject(obj); const size = new THREE.Vector3(); bb.getSize(size);
    const isWheel = name.startsWith('wheel');
    const side = obj.position.x - v.root.position.x;
    debris.push(makeBody(obj, new THREE.Vector3(side * SR(1.5, 3.5) + SR(-1.5, 1.5), SR(3, 7), -speed * SR(0.05, 0.2)),
      isWheel ? v.spec.wheelR * 0.55 : Math.max(0.04, Math.min(size.x, size.y, size.z) / 2),
      { rest: isWheel ? 0.38 : 0.22, fric: isWheel ? 0.86 : 0.6, mass: isWheel ? 0.8 : 0.6, kind: isWheel ? 'wheel' : 'panel' }));
  }
}
function spawnChunks(v, n, at, speed) {
  const col = new THREE.Color(v.spec.color);
  for (let i = 0; i < n && chunks.length < CHUNK_MAX; i++) {
    const r = simRand();
    const c = r < 0.55 ? col.clone().multiplyScalar(SR(0.8, 1.05)) : r < 0.85 ? new THREE.Color('#222426') : new THREE.Color('#c9ccd0');
    const sz = new THREE.Vector3(SR(0.07, 0.32), SR(0.03, 0.12), SR(0.07, 0.3));
    chunks.push({ pos: new THREE.Vector3(at.x + SR(-v.spec.Wd / 2, v.spec.Wd / 2), at.y + SR(0.1, 0.9), at.z + SR(-0.4, 0.1)),
      vel: new THREE.Vector3(SR(-5, 5), SR(2, 8), -speed * SR(0.0, 0.25) + SR(-2, 1)),
      av: new THREE.Vector3(SR(-15, 15), SR(-15, 15), SR(-15, 15)), quat: new THREE.Quaternion(), size: sz, rad: sz.y / 2,
      rest: 0.25, fric: 0.55, sleep: false, log: simRand() < 0.3, bounces: 0, mass: 0.25, kind: 'chunk', dirty: true });
    chunkMesh.setColorAt(chunks.length - 1, c);
  }
  if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
}
function spawnShards(v, n, at, speed, spread = 1) {
  for (let i = 0; i < n && shards.length < SHARD_MAX; i++) {
    shards.push({ pos: new THREE.Vector3(at.x + SR(-v.spec.Wd / 2, v.spec.Wd / 2), at.y + SR(-0.2, 0.6), at.z + SR(-1.0, 0.2) * spread),
      vel: new THREE.Vector3(SR(-4.5, 4.5) * spread, SR(1.5, 7), -speed * SR(0.0, 0.2) + SR(-2.5, 2)),
      av: new THREE.Vector3(SR(-20, 20), SR(-20, 20), SR(-20, 20)), quat: new THREE.Quaternion(), scale: SR(0.03, 0.11),
      rad: 0.005, rest: 0.18, fric: 0.5, sleep: false, log: false, mass: 0.05, dirty: true });
  }
}

// ---------------------------------------------------------------- simulation
const DT = 1 / 240;
function rampAngle(t) {
  let a = 0;
  vehicles.forEach((v, i) => {
    const TL = v.TL, A = CRASH[i].A;
    const k = smooth(TL - 1.4, TL - 0.35, t) * (1 - smooth(TL + 0.25, TL + 1.3, t));
    a = Math.max(a, A * k);
  });
  return a + 0.015 * Math.max(0, Math.sin(t * 2.6));
}

vehicles.forEach((v, i) => {
  const sp = v.spec, cr = CRASH[i];
  v.crash = cr; v.x = sp.lane; v.yaw = 0; v.roll = 0; v.pitch = 0; v.y = 0; v.speed = sp.speed; v.wheelRot = 0; v.extra = { y: 0, roof: 0 };
  const vz = sp.speed * Math.cos(cr.A);
  v.TL = CRASH_TIMES[i] - Math.max(0.03, (cr.zImp - sp.L / 2 - RAMP.lip) / vz);
  v.spawnT = Math.max(0, v.TL - 360 / sp.speed);
  v.z = RAMP.lip - (v.TL - v.spawnT) * sp.speed;
});

function trailerFollow(v) {
  // rigidly hitched behind the tractor while driving
  const T = trailer.root;
  T.visible = true;
  trailer.z = v.z - 1.75 - 5.6; trailer.x = v.x; trailer.yaw = 0; trailer.roll = 0;
  trailer.y = driveY(trailer.z); trailer.pitch = Math.atan(roadSlope(trailer.z));
}

function stepVehicle(v, dt) {
  const t = simTime, sp = v.spec, cr = v.crash;
  if (v.state === 'wait') {
    if (t < v.spawnT) return;
    v.state = 'drive'; v.root.visible = true;
    EVENTS.vehicles[v.idx] = { name: sp.key, label: sp.label, spawn: t, x: v.x, heavy: !!(sp.bus || sp.semi) };
  }
  if (v.state === 'drive') {
    const remain = v.TL - t, dist = RAMP.lip - v.z;
    if (remain > 1.0) { const want = clamp(dist / remain, sp.speed * 0.75, sp.speed * 1.35); v.speed += (want - v.speed) * Math.min(1, dt * 0.8); }
    v.z += v.speed * dt;
    v.wheelRot += v.speed * dt / sp.wheelR;
    if (v.z > RAMP.hinge) {
      const a = rampAngle(t);
      v.y = APRON.top + (v.z - RAMP.hinge) * Math.tan(a); v.pitch = -a;
    } else { v.y = driveY(v.z); v.pitch = Math.atan(roadSlope(v.z)); }
    if (sp.semi) trailerFollow(v);
    if (v.z >= RAMP.lip) {
      const a = rampAngle(t);
      v.state = 'air'; v.vz = v.speed * Math.cos(a); v.vy = v.speed * Math.sin(a);
      EVENTS.vehicles[v.idx].launch = t; EVENTS.vehicles[v.idx].rampAngle = a;
      if (sp.semi) startTrailerCrash(v);
    }
  } else if (v.state === 'air') {
    v.z += v.vz * dt; v.vy -= 9.81 * dt; v.y += v.vy * dt;
    v.pitch = Math.min(0.3, v.pitch + 0.55 * dt);
    v.wheelRot += v.speed * dt / sp.wheelR;
    if (v.z + sp.L / 2 * Math.cos(v.pitch) >= cr.zImp || v.y < PIT.water - 0.3) startCrash(v);
  } else if (v.state === 'crash') {
    const u = t - v.tc;
    const F = cr.front;
    if (u < 0.14) {
      const k = easeOut(u / 0.14);
      v.z = v.c0.z + F * 0.85 * k; v.y = v.c0.y + v.vy0 * u * 0.3;
      v.def.front = F * k; v.tireCrush = k; v.defDirty = true;
      v.pitch = v.c0.pitch - 0.12 * k;
      v.a0 = { x: v.x, y: v.y, z: v.z, yaw: v.yaw, pitch: v.pitch, roll: v.roll };
    } else {
      const R = cr.rest, Tf = v.Tf;
      const p = clamp((u - 0.14) / Tf, 0, 1);
      const prevY = v.y;
      v.x = lerp(v.a0.x, R.x, easeOut(p)); v.z = lerp(v.a0.z, R.z, easeOut(p));
      v.y = lerp(v.a0.y, R.y, p * p);
      v.yaw = lerp(v.a0.yaw, R.yaw, easeOut(p)) + 0.15 * Math.sin(p * Math.PI) * Math.sign(R.yaw || 1);
      v.pitch = lerp(v.a0.pitch, R.pitch, easeOut(p * 1.2));
      v.roll = lerp(v.a0.roll, R.roll, easeOut(p)) + 0.12 * Math.sin(p * Math.PI * 2) * (1 - p);
      v.def.roof = cr.roof * smooth(0, 0.6, p); v.def.bend = (cr.bend || 0) * smooth(0, 0.7, p); v.defDirty = true;
      if (!v.splashed && prevY > PIT.water - 0.2 && v.y <= PIT.water - 0.2 && R.y < PIT.water) {
        v.splashed = true;
        const big = sp.bus || sp.semi;
        spawnSplash(v.x, v.z, big ? 2.4 : 1.4);
        for (const ch of chains) { ch.kick = 0.25; ch.kickT = t; }
      }
      if (p >= 1) {
        v.state = 'rest'; v.restT = t;
        if (!v.splashed && R.y < PIT.water) { v.splashed = true; spawnSplash(v.x, v.z, 1.2); }
        for (const [j, roof, sink] of (cr.land || [])) { const w = vehicles[j]; w.landFx = { t0: t, roof0: w.def.roof, roof, sink }; }
        EVENTS.vehicles[v.idx].land = t;
      }
    }
  } else if (v.state === 'rest') {
    const R = cr.rest, u = t - v.restT;
    const wet = R.y < PIT.water;
    v.x = R.x; v.z = R.z; v.yaw = R.yaw; v.pitch = R.pitch;
    v.y = R.y + (wet ? 0.05 * Math.sin(u * 5) * Math.exp(-u * 1.2) : 0);
    v.roll = R.roll + (wet ? 0.03 * Math.sin(u * 3.7) * Math.exp(-u * 0.8) : 0);
    if (v.landFx) {
      const k = easeOut((t - v.landFx.t0) / 0.35);
      v.y -= v.landFx.sink * k;
      const nr = v.landFx.roof0 + v.landFx.roof * k;
      if (Math.abs(nr - v.def.roof) > 1e-3) { v.def.roof = nr; v.defDirty = true; }
    }
  }
}

function startCrash(v) {
  const sp = v.spec, cr = v.crash, t = simTime;
  v.state = 'crash'; v.tc = t; v.vy0 = v.vy;
  v.c0 = { y: v.y, z: v.z, pitch: v.pitch };
  v.Tf = Math.max(0.45, Math.sqrt(2 * Math.max(0.1, v.y - cr.rest.y) / 9.81) * 1.1);
  const E = EVENTS.vehicles[v.idx];
  E.contact = t; E.speed = v.speed; E.x = v.x;
  const front = new THREE.Vector3(v.x, v.y + sp.clr + 0.5, v.z + sp.L / 2);
  for (const p of cr.detach) spawnPart(v, p, v.speed);
  spawnChunks(v, cr.chunks, front, v.speed);
  spawnShards(v, cr.shards, new THREE.Vector3(v.x, v.y + (sp.bus || sp.semi ? 2.0 : sp.clr + sp.bodyH + 0.35), v.z + sp.L / 2 - (sp.bus ? 2 : 0.8)), v.speed, sp.bus ? 2.2 : 1);
  for (const gm of v.glass) gm.material = MAT.broken;
  spawnDust(front, sp.bus || sp.semi ? 18 : 9, sp.bus || sp.semi ? 1.4 : 1);
  for (const ch of chains) { ch.kick = 0.3; ch.kickT = t; }
}

function startTrailerCrash(v) {
  trailer.crash = { t0: simTime, x0: trailer.x, z0: trailer.z, y0: trailer.y, pitch0: trailer.pitch, v: v.speed,
    rest: { x: 1.7, z: PIT.z0 - 6.0, yaw: 0.28, roll: 0.3, pitch: 0.16, y: APRON.top + 0.5 } };
  trailer.carsOff = false;
}
function stepTrailer() {
  const c = trailer.crash; if (!c) return;
  const u = simTime - c.t0, R = c.rest;
  const total = R.z - c.z0, tau = Math.max(0.2, total / c.v);
  const k = 1 - Math.exp(-u / tau);
  trailer.z = c.z0 + total * Math.min(1, k * 1.02);
  const p = easeOut(u / 1.6);
  trailer.x = lerp(c.x0, R.x, p); trailer.yaw = R.yaw * p; trailer.roll = R.roll * smooth(0.3, 1.4, u);
  trailer.pitch = lerp(c.pitch0, R.pitch, p); trailer.y = lerp(c.y0, R.y, smooth(0.2, 1.2, u));
  if (!trailer.carsOff && u > 0.35) {
    trailer.carsOff = true;
    trailer.root.updateMatrixWorld(true);
    trailer.cars.slice(0, 2).forEach((car, i) => {
      detachToScene(car, trailer.root);
      car.position.y += 0.6;
      debris.push(makeBody(car, new THREE.Vector3(SR(-1.5, 1.5), SR(3, 5), c.v * SR(0.3, 0.42) - i * 1.5), 0.55,
        { mass: 1.6, kind: 'car', rest: 0.15, fric: 0.5, av: new THREE.Vector3(SR(-1.5, 1.5), SR(-1, 1), SR(-2.5, 2.5)) }));
    });
    EVENTS.trailerCars = simTime;
  }
}

function stepSim(dt) {
  for (const v of vehicles) stepVehicle(v, dt);
  stepTrailer();
  for (const b of debris) integrateBody(b, dt);
  for (const b of chunks) if (!b.sleep) { integrateBody(b, dt); b.dirty = true; }
  for (const b of shards) if (!b.sleep) { integrateBody(b, dt); b.dirty = true; }
  for (const d of drops) {
    if (!d.alive) continue;
    d.vel.y -= 9.81 * dt; d.pos.addScaledVector(d.vel, dt);
    if (d.vel.y < 0 && d.pos.y < (inPit(d.pos.x, d.pos.z) ? PIT.water : groundAt(d.pos.x, d.pos.z))) d.alive = false;
  }
  for (const f of foams) {
    if (!f.alive) continue;
    f.vel.y -= 5.5 * dt; f.pos.addScaledVector(f.vel, dt); if (f.pos.y < PIT.water) { f.pos.y = PIT.water; f.vel.y = 0; f.vel.multiplyScalar(0.9); }
    if (simTime - f.born > f.life) { f.alive = false; f.sp.visible = false; }
  }
  for (const d of dusts) {
    if (!d.alive) continue;
    d.pos.addScaledVector(d.vel, dt); d.vel.multiplyScalar(1 - 0.6 * dt);
    if (simTime - d.born > d.life) { d.alive = false; d.sp.visible = false; }
  }
  for (const r of rings) if (r.alive && simTime - r.born > 2.2) { r.alive = false; r.m.visible = false; }
  // paddle churn: little foam puffs
  const step = Math.round(simTime / dt);
  if (step % 36 === 0) for (const s of [-1, 1]) {
    const f = foams.find((f) => !f.alive); if (!f) break;
    f.alive = true; f.born = simTime; f.life = 1.2; f.pos = new THREE.Vector3(s * 4.8, PIT.water + 0.1, -6.3 + SR(-0.6, 0.6));
    f.vel = new THREE.Vector3(-s * 0.6, SR(0.8, 1.6), 0); f.s0 = 0.5; f.s1 = 1.6; f.op = 0.5;
  }
  if (step % 12 === 0) EVENTS.tracks.push({ t: simTime, v: vehicles.map((v) => (v.state === 'drive' || v.state === 'air' ? [Math.round(v.z * 10) / 10, Math.round(v.speed * 10) / 10, v.x] : null)) });
  simTime += dt;
}
function simTo(ts) { while (simTime + DT <= ts + 1e-9) stepSim(DT); }

// ---------------------------------------------------------------- visuals sync
function syncVisuals() {
  const t = simTime;
  const a = rampAngle(t);
  ramp.rotation.x = -a;
  for (const p of pistons) {
    const z = RAMP.hinge + 2.0, top = APRON.top + 2.0 * Math.tan(a) - 0.05;
    p.barrel.position.set(p.s * 4.62, APRON.top + 0.45, z);
    const len = Math.max(0.1, top - (APRON.top + 0.9));
    p.rod.scale.y = len + 0.2; p.rod.position.set(p.s * 4.62, APRON.top + 0.9 + len / 2 - 0.1, z);
  }
  for (const p of paddles) p.spin.rotation.x = p.dir * 1.5 * t;
  waterNormal.offset.set(t * 0.03, t * 0.05);
  updateChains(t);
  for (const v of vehicles) {
    if (!v.root.visible) continue;
    if (v.defDirty) applyDeform(v);
    v.root.position.set(v.x, v.y, v.z);
    v.root.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
    for (const w of v.wheels) if (w.attached) {
      w.spin.rotation.x = v.wheelRot;
      const k = (w.z0 > 0 ? 1 : 0.3) * (v.tireCrush || 0);
      w.g.scale.set(1 + 0.3 * k, 1 - 0.42 * k, 1 + 0.12 * k);
      w.g.rotation.set(0, w.side * 0.25 * k, w.side * 0.45 * k);
      w.g.position.y = v.spec.wheelR * (1 - 0.42 * k);
    }
  }
  if (trailer.root.visible) { trailer.root.position.set(trailer.x, trailer.y, trailer.z); trailer.root.rotation.set(trailer.pitch, trailer.yaw, trailer.roll, 'YXZ'); }
  chunkMesh.count = chunks.length;
  chunks.forEach((b, i) => { if (b.dirty) { _m.compose(b.pos, b.quat, b.size); chunkMesh.setMatrixAt(i, _m); b.dirty = false; } });
  chunkMesh.instanceMatrix.needsUpdate = true;
  shardMesh.count = shards.length;
  shards.forEach((b, i) => { if (b.dirty) { _v2.setScalar(b.scale); _m.compose(b.pos, b.quat, _v2); shardMesh.setMatrixAt(i, _m); b.dirty = false; } });
  shardMesh.instanceMatrix.needsUpdate = true;
  drops.forEach((d, i) => { if (d.alive) { _v2.setScalar(d.size); _q.identity(); _m.compose(d.pos, _q, _v2); } else _m.makeScale(0, 0, 0); dropMesh.setMatrixAt(i, _m); });
  dropMesh.instanceMatrix.needsUpdate = true;
  for (const f of foams) if (f.alive) {
    const a = (t - f.born) / f.life; f.sp.visible = true; f.sp.position.copy(f.pos);
    const s = f.s0 + (f.s1 - f.s0) * Math.sqrt(a); f.sp.scale.set(s, s, 1); f.sp.material.opacity = f.op * Math.min(1, a * 8) * (1 - a);
  }
  for (const d of dusts) if (d.alive) {
    const a = (t - d.born) / d.life; d.sp.visible = true; d.sp.position.copy(d.pos);
    const s = d.s0 + (d.s1 - d.s0) * Math.sqrt(a); d.sp.scale.set(s, s, 1); d.sp.material.opacity = d.op * Math.min(1, a * 6) * (1 - a);
  }
  for (const r of rings) if (r.alive && t >= r.born) {
    const a = (t - r.born) / 2.2; r.m.visible = true; r.m.position.set(r.x, PIT.water + 0.02, r.z);
    const s = (1 + 7 * Math.sqrt(a)) * r.size * 0.7; r.m.scale.set(s, s, 1); r.m.material.opacity = 0.55 * (1 - a);
  }
}

// ---------------------------------------------------------------- camera director
const WIDE = { pos: new THREE.Vector3(0, 24, 27), look: new THREE.Vector3(0, -1, -44), fov: 62 };
// impact angle for each crash: front = over the barrier wall, side, high = above the pit
const ANGLES = [['front'], ['side'], ['front'], ['side'], ['side', 'high'], ['front'], ['high'], ['front', 'high']];
const SIDES = [1, -1, -1, 1, -1, 1, -1, 1];
const SHOTS = [];
{
  // hook: the bus hit (flash-forward)
  SHOTS.push({ t0: 0, t1: 2.9, type: 'front', i: 4, hook: true });
  SHOTS.push({ t0: 2.9, t1: HOOK_LEN, type: 'high', i: 4, hook: true });
  CRASH_TIMES.forEach((ct, i) => {
    const C = simToOut(ct), S0 = simToOut(SLOW[i][0]), S1 = simToOut(SLOW[i][1]);
    SHOTS.push({ t0: C - 2.75, t1: S0 - 0.3, type: 'chase', i });
    const ang = ANGLES[i];
    if (ang.length === 1) SHOTS.push({ t0: S0 - 0.3, t1: S1 + 0.45, type: ang[0], i });
    else { const mid = (C + S1) / 2 + 0.3; SHOTS.push({ t0: S0 - 0.3, t1: mid, type: ang[0], i }); SHOTS.push({ t0: mid, t1: S1 + 0.45, type: ang[1], i }); }
  });
}
function shotAt(to) { for (const s of SHOTS) if (to >= s.t0 && to < s.t1) return s; return null; }

function camFor(shot, to) {
  const v = vehicles[shot.i], sp = v.spec, side = SIDES[shot.i];
  const prog = clamp((to - shot.t0) / (shot.t1 - shot.t0), 0, 1);
  const big = sp.bus || sp.semi;
  if (shot.type === 'chase') {
    const vz = v.z, vy = v.y;
    return { pos: new THREE.Vector3(v.x * 0.5 + side * 1.2, vy + (big ? 5.0 : 3.4), vz - (big ? 13 : 9.5)), look: new THREE.Vector3(v.x * 0.4, vy + 0.6, vz + 10), fov: 58 };
  }
  const fx = sp.lane * 0.6, fz = -5.5;
  if (shot.type === 'front') {
    const pos = new THREE.Vector3(side * (7.6 - 1.0 * prog), (big ? 7.0 : 5.4) - 0.4 * prog, 1.2 + 0.4 * prog);
    return { pos, look: new THREE.Vector3(fx * 0.8, big ? 0.8 : 0.2, -5.2), fov: (big ? 58 : 50) - 5 * prog };
  }
  if (shot.type === 'side') {
    const th = 1.42 - 0.38 * prog, d = big ? 15 : 10.5;
    const pos = new THREE.Vector3(fx + side * Math.sin(th) * d, (big ? 3.4 : 2.4), fz + Math.cos(th) * d);
    pos.y = Math.max(pos.y, terrainH(pos.x, pos.z) + 1.6);
    return { pos, look: new THREE.Vector3(fx, big ? 0.3 : -0.4, fz - 0.5), fov: (big ? 52 : 46) - 5 * prog };
  }
  // high
  const pos = new THREE.Vector3(side * (6 - 1.5 * prog), 15 - 2 * prog, 5.5);
  return { pos, look: new THREE.Vector3(0.5, -1.0, -6.3), fov: 54 - 4 * prog };
}

function direct(to) {
  const shot = shotAt(to);
  let c = shot ? camFor(shot, to) : WIDE;
  const pos = c.pos.clone(), look = c.look.clone();
  // punchy push-in during the first 0.35 s of every shot
  let fov = c.fov;
  if (shot) fov += 9 * (1 - easeOut((to - shot.t0) / 0.35));
  // impact shake on impact shots
  if (shot && shot.type !== 'chase') {
    const v = vehicles[shot.i];
    if (v.tc !== undefined) {
      const dt = to - simToOut(v.tc) - (shot.hook ? 0 : 0);
      const dtc = shot.hook ? to - (v.tc - outToSim(0)) / 0.27 : dt;
      if (dtc >= 0 && dtc < 1.0) { const a = (v.spec.bus || v.spec.semi ? 0.2 : 0.11) * Math.exp(-dtc / 0.22); pos.x += a * Math.sin(dtc * 83); pos.y += a * Math.sin(dtc * 71 + 1); }
    }
  }
  camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look);
  return shot;
}

// ---------------------------------------------------------------- HUD
const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
const cg = comp.getContext('2d');
document.body.appendChild(comp);
const FONT = (s) => `900 ${s}px Inter, "Inter Display", sans-serif`;
function outlined(text, x, y, size, fill, stroke = '#000', lw = 0.18, align = 'center') {
  cg.font = FONT(size); cg.textAlign = align; cg.textBaseline = 'middle'; cg.lineJoin = 'round';
  cg.lineWidth = size * lw; cg.strokeStyle = stroke; cg.strokeText(text, x, y); cg.fillStyle = fill; cg.fillText(text, x, y);
}
function fitSize(text, size, maxW) { cg.font = FONT(size); const w = cg.measureText(text).width; return w > maxW ? size * maxW / w : size; }
function pill(x, y, w, h, fill) { cg.beginPath(); cg.roundRect(x - w / 2, y - h / 2, w, h, h / 2); cg.fillStyle = fill; cg.fill(); }
const damageColor = (p) => (p < 50 ? '#ffd21a' : p < 85 ? '#ff8a1a' : '#ff2a2a');

function drawHUD(to, shot) {
  const isHook = to < HOOK_LEN;
  // contact output times (main run)
  const contactOut = vehicles.map((v, i) => simToOut(CRASH_TIMES[i]));
  // --- top: survival mode badge + title
  const pulse = 1 + 0.04 * Math.sin(to * 6);
  pill(W / 2, 74, 430 * pulse, 70, '#d81e1e');
  outlined('SURVIVAL MODE', W / 2, 75, 44, '#ffffff', '#7a0000', 0.08);
  outlined('SPORTS CARS vs WATER PIT', W / 2, 158, fitSize('SPORTS CARS vs WATER PIT', 74, W - 70), '#ffffff');
  if (isHook) {
    const a1 = smooth(0.15, 0.5, to) * (1 - smooth(2.6, 2.9, to));
    if (a1 > 0) { cg.globalAlpha = a1; const s = 1 + 0.25 * (1 - easeOut((to - 0.15) / 0.35)); outlined('CAN ANY CAR', W / 2, 760, 108 * s, '#ffffff'); outlined('SURVIVE?', W / 2, 880, 128 * s, '#ffd21a'); cg.globalAlpha = 1; }
    const a2 = smooth(3.1, 3.4, to);
    if (a2 > 0) { cg.globalAlpha = a2; outlined('WATCH TILL THE END!', W / 2, 1640, fitSize('WATCH TILL THE END!', 84, W - 80), '#ffffff'); cg.globalAlpha = 1; }
    // big damage readout for the bus in the hook
    const busHit = (CRASH_TIMES[4] - outToSim(0)) / 0.27;
    if (to > busHit) drawDamage(clamp((to - busHit) / 1.6, 0, 1) * SPECS[4].damage, 1);
    pill(W - 150, 1840, 250, 56, 'rgba(0,0,0,0.55)'); outlined('SLOW-MO', W - 150, 1841, 34, '#ffffff', '#000', 0.05);
    return;
  }
  // which vehicle is "current": from its chase shot until the next one's chase
  let cur = -1;
  CRASH_TIMES.forEach((ct, i) => { if (to >= contactOut[i] - 2.75) cur = i; });
  const alive = 8 - contactOut.filter((c) => to >= c).length;
  outlined(cur >= 0 ? `CAR ${cur + 1}/8` : 'CAR 0/8', 40, 74, 36, '#ffffff', '#000', 0.16, 'left');
  outlined(`ALIVE ${alive}/8`, W - 40, 74, 36, alive > 0 ? '#7dff6a' : '#ff4a4a', '#000', 0.16, 'right');
  if (to < HOOK_LEN + 1.1) {
    const k = (to - HOOK_LEN) / 1.1, s = 1 + 0.5 * (1 - easeOut(k * 2.5));
    cg.globalAlpha = 1 - smooth(0.75, 1, k); outlined("LET'S GO!", W / 2, 900, 150 * s, '#ffd21a'); cg.globalAlpha = 1;
  }
  const endT = OUT_DURATION - 3.6;
  if (cur >= 0 && to < endT) {
    const sp = SPECS[cur], C = contactOut[cur];
    // damage readout at the top once it hits
    if (to >= C) drawDamage(clamp((to - C) / (HEAVY[cur] ? 2.4 : 1.4), 0, 1) * sp.damage, 1);
    // name card, lower third
    const t0 = C - 2.75, k = easeOut((to - t0) / 0.4);
    const cx = -500 + (W / 2 + 500) * k, cy = 1560;
    cg.save(); cg.translate(cx, cy);
    cg.beginPath(); cg.roundRect(-470, -70, 940, 140, 28); cg.fillStyle = 'rgba(10,12,16,0.72)'; cg.fill();
    cg.beginPath(); cg.roundRect(-470, -70, 34, 140, [28, 0, 0, 28]); cg.fillStyle = sp.color; cg.fill();
    outlined(sp.label, 20, -14, fitSize(sp.label, 66, 820), '#ffffff', '#000', 0.1);
    outlined(`${Math.round(EVENTS.vehicles[cur]?.speed ? EVENTS.vehicles[cur].speed * 3.6 : sp.speed * 3.6)} KM/H`, 20, 48, 36, '#ffffff', '#000', 0.14);
    cg.restore();
    // WRECKED stamp
    const st = C + (HEAVY[cur] ? 1.4 : 0.8);
    if (to >= st) {
      const sk = easeOut((to - st) / 0.18), sc = 1.8 - 0.8 * sk;
      cg.save(); cg.translate(W / 2 + 180, 1440); cg.rotate(-0.16); cg.scale(sc, sc); cg.globalAlpha = Math.min(1, sk * 1.5);
      cg.strokeStyle = '#ff2020'; cg.lineWidth = 10; cg.strokeRect(-210, -58, 420, 116);
      outlined('WRECKED!', 0, 4, 78, '#ff2a2a', '#ffffff', 0.08); cg.restore(); cg.globalAlpha = 1;
    }
  }
  if (slowAt(to)) { pill(W - 150, 1840, 250, 56, 'rgba(0,0,0,0.55)'); outlined('SLOW-MO', W - 150, 1841, 34, '#ffffff', '#000', 0.05); }
  // end card
  if (to >= endT) {
    const k = easeOut((to - endT) / 0.5);
    cg.fillStyle = `rgba(0,0,0,${0.55 * k})`; cg.fillRect(0, 0, W, H);
    cg.globalAlpha = k;
    outlined('SURVIVORS', W / 2, 720, 96, '#ffffff');
    outlined('0 / 8', W / 2, 860, 190 * (1 + 0.3 * (1 - k)), '#ff2a2a');
    outlined('THE WATER PIT WINS!', W / 2, 1020, fitSize('THE WATER PIT WINS!', 80, W - 90), '#ffd21a');
    const k2 = smooth(endT + 1.0, endT + 1.4, to); cg.globalAlpha = k2;
    outlined('WHICH CRASH WAS THE BEST?', W / 2, 1300, fitSize('WHICH CRASH WAS THE BEST?', 62, W - 90), '#ffffff');
    outlined('COMMENT 1 - 8!', W / 2, 1390, 70, '#7dff6a');
    cg.globalAlpha = 1;
  }
}
function drawDamage(p, alpha) {
  cg.globalAlpha = alpha;
  const pct = Math.round(p);
  outlined(`CRASHED ${pct}%`, W / 2, 262, 96, damageColor(pct));
  cg.beginPath(); cg.roundRect(W / 2 - 330, 330, 660, 30, 15); cg.fillStyle = 'rgba(0,0,0,0.6)'; cg.fill();
  cg.beginPath(); cg.roundRect(W / 2 - 326, 334, 652 * pct / 100, 22, 11); cg.fillStyle = damageColor(pct); cg.fill();
  cg.globalAlpha = 1;
}

let lastShot = null;
function renderFrame(to) {
  syncVisuals();
  const shot = direct(to);
  renderer.render(scene, camera);
  cg.drawImage(glCanvas, 0, 0);
  // white flash on every cut into a slow-motion impact shot, and at the hook -> main transition
  let flash = 0;
  for (const s of SHOTS) if (s.type !== 'chase' && to >= s.t0 && to < s.t0 + 0.22) flash = Math.max(flash, 0.55 * (1 - (to - s.t0) / 0.22));
  if (to >= HOOK_LEN - 0.25 && to < HOOK_LEN + 0.3) flash = Math.max(flash, to < HOOK_LEN ? (to - (HOOK_LEN - 0.25)) / 0.25 : 1 - (to - HOOK_LEN) / 0.3);
  if (slowAt(to)) {
    const gr = cg.createRadialGradient(W / 2, H * 0.55, H * 0.28, W / 2, H * 0.55, H * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.38)'); cg.fillStyle = gr; cg.fillRect(0, 0, W, H);
  }
  if (flash > 0) { cg.fillStyle = `rgba(255,255,255,${flash})`; cg.fillRect(0, 0, W, H); }
  drawHUD(to, shot);
  return comp.toDataURL('image/jpeg', 0.93);
}

window.SIM = {
  simTo, renderFrame, outToSim, simToOut,
  simTime: () => simTime,
  events: () => Object.assign({}, EVENTS, { shots: SHOTS.map((s) => ({ t0: s.t0, t1: s.t1, type: s.type, i: s.i })) }),
  frameAt(to) { const ts = outToSim(to); if (ts < simTime - 1e-6) return 'RESET'; simTo(ts); return renderFrame(to); },
};
window.SIM_READY = true;

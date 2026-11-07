// Cars & School Bus vs Chained Crushers: deterministic 3D crash scene.
// Everything is driven by a fixed-step simulation so the same frame always
// renders identically, even across parallel render workers.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TIMELINE, CRASH_TIMES, HEAVY, outToSim, simToOut, slowAmountAtOut } from './timeline.js';

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

function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
           l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm2 = (x, z, s = 0) => vnoise(x, 0.5, z, s) * 0.55 + vnoise(x * 2.1, 3.5, z * 2.1, s + 1) * 0.3 + vnoise(x * 4.3, 7.5, z * 4.3, s + 2) * 0.15;

// ---------------------------------------------------------------- terrain
const ROAD_HALF = 4.3;
function roadH(z) {
  // flat around the obstacle, then a long climb to a crest near the horizon
  const a = -24, b = -340, H = 46;
  if (z >= a) return 0;
  if (z <= b) return H;
  const t = (a - z) / (a - b);
  return H * t * t * (3 - 2 * t);
}
function roadSlope(z) { return (roadH(z - 0.5) - roadH(z + 0.5)); } // rise per metre going -z
function terrainH(x, z) {
  const ax = Math.abs(x);
  let h = roadH(z);
  const e = Math.max(0, ax - 7.5);
  const side = x < 0 ? 1.0 : 0.75;
  h += side * 16 * (1 - Math.exp(-e / 7)) * smooth(0, 3, e);          // steep grassy embankment
  h += (fbm2(x * 0.014, z * 0.014, x < 0 ? 3 : 9) - 0.35) * 55 * smooth(8, 70, e); // rolling hills
  return h;
}

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
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(64, W / H, 0.3, 2500);
camera.position.set(0, 24, 31);
camera.lookAt(0, 0, -40);

// sky gradient
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#3f7fd6'); gr.addColorStop(0.55, '#86b6ea'); gr.addColorStop(1, '#d7e8f6');
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
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
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

// ---- terrain mesh
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

// ---- road, shoulders, markings
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
    // worn wheel tracks and patches
    for (const cx of [0.22, 0.36, 0.64, 0.78]) { g.fillStyle = 'rgba(30,30,32,0.13)'; g.fillRect(cx * w - 22, 0, 44, h); }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${BR(0, 1) > 0.5 ? '20,20,22' : '140,140,140'},${BR(0.05, 0.12)})`; g.fillRect(BR(0, w), BR(0, h), BR(30, 140), BR(30, 200)); }
    g.strokeStyle = 'rgba(25,25,25,0.5)'; g.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) { let x = BR(0, w), y = BR(0, h); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += BR(-18, 18); y += BR(5, 25); g.lineTo(x, y); } g.stroke(); }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const road = new THREE.Mesh(stripGeo(-ROAD_HALF, ROAD_HALF, 60, -990, 2, 0.0, 17), roadMat);
  road.receiveShadow = true; scene.add(road);
  const gravel = canvasTex(128, 256, (g, w, h) => noiseFill(g, w, h, '#8e8573', 0.25, 9000, 2.5));
  gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping;
  const gMat = new THREE.MeshStandardMaterial({ map: gravel, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(stripGeo(s < 0 ? -ROAD_HALF - 1.1 : ROAD_HALF, s < 0 ? -ROAD_HALF : ROAD_HALF + 1.1, 60, -990, 2, -0.02, 6), gMat);
    m.receiveShadow = true; scene.add(m);
  }
  const lineMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const white = lineMat('#e8e8e2'), yellow = lineMat('#e9b420');
  for (const s of [-1, 1]) { const m = new THREE.Mesh(stripGeo(s * 3.95 - 0.07, s * 3.95 + 0.07, 60, -990, 2, 0.012), white); m.receiveShadow = true; scene.add(m); }
  const dashes = [];
  for (let z = 58; z > -990; z -= 9) dashes.push(stripGeo(-0.08, 0.08, z, z - 3.2, 1.6, 0.014));
  const merged = mergeGeos(dashes);
  const dm = new THREE.Mesh(merged, yellow); dm.receiveShadow = true; scene.add(dm);
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

// ---- pine trees (instanced)
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
    if (z > -40 && Math.abs(x) < 16) continue;
    const sc = BR(0.7, 1.45);
    p.set(x, terrainH(x, z) - 0.2, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), BR(0, 6.28)); s.set(sc, sc * BR(0.85, 1.25), sc);
    m.compose(p, q, s);
    trunks.setMatrixAt(k, m); folis.setMatrixAt(k, m);
    folis.setColorAt(k, new THREE.Color().setHSL(BR(0.27, 0.33), BR(0.35, 0.55), BR(0.17, 0.27)));
    k++;
  }
  trunks.castShadow = folis.castShadow = true; folis.receiveShadow = true;
  scene.add(trunks, folis);
}

// ---- telephone poles + wires, radio tower
{
  const poleMat = new THREE.MeshStandardMaterial({ color: '#6b5640', roughness: 1 });
  const poleG = new THREE.CylinderGeometry(0.13, 0.17, 9.5, 6); poleG.translate(0, 4.75, 0);
  const armG = new THREE.BoxGeometry(2.2, 0.14, 0.14); armG.translate(0, 8.9, 0);
  const tops = [];
  for (let z = 30; z > -900; z -= 38) {
    const x = 9.2, y = terrainH(x, z);
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
  // radio tower on a far hill
  const tx = -150, tz = -560, ty = terrainH(tx, tz);
  for (let i = 0; i < 10; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.7 - i * 0.05, 0.75 - i * 0.05, 7, 4, 1, true), new THREE.MeshStandardMaterial({ color: i % 2 ? '#f2f2f2' : '#d23a2a', roughness: 0.7, wireframe: false }));
    seg.position.set(tx, ty + 3.5 + i * 7, tz); scene.add(seg);
  }
}

// ---------------------------------------------------------------- the obstacle
const DRUM_R = 1.6, DRUM_Y = 1.95, DRUM_LEN = 10.4;
const DRUM_Z = [-2.2, 2.2];
const DRUM_FRONT = DRUM_Z[0] - DRUM_R - 0.05; // first surface an approaching vehicle meets
const drumSpin = [];
{
  const drumTex = canvasTex(1024, 1024, (g, w, h) => {
    // u around the circumference (x), v along the axis (y)
    g.fillStyle = '#b8bdc3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${BR(0, 1) > 0.5 ? '255,255,255' : '40,45,50'},${BR(0.03, 0.12)})`; g.fillRect(BR(0, w), BR(0, h), BR(40, 300), 1); }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(90,70,50,${BR(0.03, 0.08)})`; g.beginPath(); g.ellipse(BR(0, w), BR(0, h), BR(20, 90), BR(10, 50), 0, 0, 6.3); g.fill(); }
    const band = h * 0.1;
    for (const y0 of [0, h - band]) {
      g.save(); g.beginPath(); g.rect(0, y0, w, band); g.clip();
      g.fillStyle = '#f2f2ee'; g.fillRect(0, y0, w, band);
      g.fillStyle = '#d0201c';
      for (let x = -band * 2; x < w + band; x += 64) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 32, y0); g.lineTo(x + 32 + band, y0 + band); g.lineTo(x + band, y0 + band); g.fill(); }
      g.restore();
      g.fillStyle = 'rgba(30,30,30,0.55)'; g.fillRect(0, y0 === 0 ? band : y0 - 6, w, 6);
    }
  });
  const drumMat = new THREE.MeshStandardMaterial({ map: drumTex, metalness: 0.55, roughness: 0.38 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#2e3134', metalness: 0.6, roughness: 0.55 });
  const ribMat = new THREE.MeshStandardMaterial({ color: '#8d9399', metalness: 0.7, roughness: 0.4 });
  const concreteTex = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#a3a19b', 0.18, 7000, 3));
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 });
  const warnTex = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#d0201c'; for (let x = -64; x < w + 64; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 + h, h); g.lineTo(x + h, h); g.fill(); } });
  const warnMat = new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.6 });

  DRUM_Z.forEach((dz, i) => {
    const holder = new THREE.Group(); holder.position.set(0, DRUM_Y, dz); scene.add(holder);
    const spin = new THREE.Group(); holder.add(spin);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R, DRUM_R, DRUM_LEN, 64, 1), drumMat);
    cyl.rotation.z = Math.PI / 2; cyl.castShadow = cyl.receiveShadow = true; spin.add(cyl);
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(DRUM_LEN * 0.8, 0.14, 0.2), ribMat);
      rib.position.set(0, Math.cos(a) * (DRUM_R + 0.05), Math.sin(a) * (DRUM_R + 0.05)); rib.rotation.x = -a;
      rib.castShadow = true; spin.add(rib);
    }
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R + 0.12, DRUM_R + 0.12, 0.3, 48), ironMat);
      cap.rotation.z = Math.PI / 2; cap.position.x = sx * (DRUM_LEN / 2 + 0.1); cap.castShadow = true; spin.add(cap);
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2;
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 6), ribMat);
        bolt.rotation.z = Math.PI / 2; bolt.position.set(sx * (DRUM_LEN / 2 + 0.3), Math.cos(a) * 1.2, Math.sin(a) * 1.2); spin.add(bolt);
      }
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, DRUM_LEN + 2.6, 16), ironMat);
    axle.rotation.z = Math.PI / 2; holder.add(axle);
    drumSpin.push({ g: spin, dir: i === 0 ? 1 : -1 });
  });

  // side frames: concrete plinths, A-frame legs, top gantry beams
  const beam = (a, b, t, mat) => {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  };
  for (const sx of [-1, 1]) {
    const x = sx * 6.15;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 10.4), concrete);
    plinth.position.set(x, 0.4, 0); plinth.castShadow = plinth.receiveShadow = true; scene.add(plinth);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.18, 10.42), warnMat); stripe.position.set(x, 0.72, 0); scene.add(stripe);
    for (const dz of DRUM_Z) {
      beam(new THREE.Vector3(x, 0.8, dz - 1.7), new THREE.Vector3(x, DRUM_Y, dz), 0.32, ironMat);
      beam(new THREE.Vector3(x, 0.8, dz + 1.7), new THREE.Vector3(x, DRUM_Y, dz), 0.32, ironMat);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 20), ironMat); hub.rotation.z = Math.PI / 2; hub.position.set(x, DRUM_Y, dz); scene.add(hub);
    }
    for (const pz of [-4.6, 4.6]) beam(new THREE.Vector3(x, 0.8, pz), new THREE.Vector3(x, 4.5, pz), 0.38, ironMat);
    beam(new THREE.Vector3(x, 4.5, -4.8), new THREE.Vector3(x, 4.5, 4.8), 0.42, ironMat);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 9.8), warnMat); cap.position.set(x, 4.82, 0); scene.add(cap);
  }
}

// ---- heavy chains (instanced links)
const chains = [];
const chainLinkMesh = (() => {
  const g = new THREE.TorusGeometry(0.15, 0.05, 6, 12); g.scale(1.45, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: '#6e4a31', metalness: 0.55, roughness: 0.72 });
  const defs = [
    { a: [-6.15, 4.4, -0.55], b: [6.15, 4.4, -0.55], sag: 0.8, phase: 0.0 },
    { a: [-6.15, 4.4, 0.55], b: [6.15, 4.4, 0.55], sag: 0.82, phase: 1.7 },
    { a: [-5.75, DRUM_Y, DRUM_Z[0]], b: [-5.75, DRUM_Y, DRUM_Z[1]], sag: 0.75, phase: 0.6 },
    { a: [5.75, DRUM_Y, DRUM_Z[0]], b: [5.75, DRUM_Y, DRUM_Z[1]], sag: 0.75, phase: 2.4 },
  ];
  let total = 0;
  for (const d of defs) {
    const A = new THREE.Vector3(...d.a), B = new THREE.Vector3(...d.b);
    const n = Math.round(A.distanceTo(B) * 1.08 / 0.3);
    chains.push({ A, B, sag: d.sag, phase: d.phase, n, offset: total, kick: 0, kickT: -99 });
    total += n;
  }
  const im = new THREE.InstancedMesh(g, mat, total); im.castShadow = true;
  scene.add(im); return im;
})();
function chainAngle(c, t) {
  const kickAmp = c.kick * Math.exp(-(t - c.kickT) * 0.9) * (t >= c.kickT ? 1 : 0);
  return 0.16 * Math.sin(1.25 * t + c.phase) + kickAmp * Math.sin((t - c.kickT) * 3.2);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s1 = new THREE.Vector3(1, 1, 1);
function updateChains(t) {
  for (const c of chains) {
    const ang = chainAngle(c, t);
    const axis = new THREE.Vector3().subVectors(c.B, c.A).normalize();
    const down = new THREE.Vector3(0, -1, 0).applyAxisAngle(axis, ang);
    let prev = null;
    for (let i = 0; i < c.n; i++) {
      const s = (i + 0.5) / c.n;
      const P = new THREE.Vector3().lerpVectors(c.A, c.B, s).addScaledVector(down, c.sag * 4 * s * (1 - s));
      const T = new THREE.Vector3().subVectors(c.B, c.A).addScaledVector(down, c.sag * 4 * (1 - 2 * s)).normalize();
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), T);
      if (i % 2) { _q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); _q.multiply(_q2); }
      _m.compose(P, _q, _s1);
      chainLinkMesh.setMatrixAt(c.offset + i, _m);
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
  head: new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c8', emissiveIntensity: 0.35, roughness: 0.2 }),
  tail: new THREE.MeshStandardMaterial({ color: '#b3101a', emissive: '#6a0008', emissiveIntensity: 0.4, roughness: 0.3 }),
  red: new THREE.MeshStandardMaterial({ color: '#d4141c', emissive: '#7a0000', emissiveIntensity: 0.5, roughness: 0.3 }),
  amber: new THREE.MeshStandardMaterial({ color: '#ffae1a', emissive: '#a35a00', emissiveIntensity: 0.5, roughness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.45, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: '#5b6066', roughness: 0.6, metalness: 0.5 }),
};
function paint(c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.25 }); }

// box geometry with optional top taper (for cabins) baked to vehicle-local space
function boxG(cx, cy, cz, w, h, l, seg = [3, 2, 6], taper = null) {
  const g = new THREE.BoxGeometry(w, h, l, seg[0], seg[1], seg[2]);
  if (taper) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0) {
        p.setX(i, p.getX(i) * (1 - taper.x));
        const z = p.getZ(i);
        if (z > 0) p.setZ(i, z - taper.front); else p.setZ(i, z + taper.rear);
      }
    }
  }
  g.translate(cx, cy, cz);
  return g;
}
function beamG(a, b, t) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = d.length();
  const g = new THREE.BoxGeometry(t, len, t, 1, 3, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

// vehicle specs, in crash order (see README lineup)
const SPECS = [
  { name: 'microcar', color: '#d4161b', L: 3.0, Wd: 1.6, bodyH: 0.72, clr: 0.24, wheelR: 0.29, wheelZ: [1.0, -1.0],
    cabin: { z0: -1.25, z1: 0.75, h: 0.78, front: 0.5, rear: 0.12, x: 0.1 }, lane: -0.7, speed: 28 },
  { name: 'hatchback', color: '#1d44c9', L: 3.95, Wd: 1.76, bodyH: 0.7, clr: 0.27, wheelR: 0.32, wheelZ: [1.3, -1.25],
    cabin: { z0: -1.85, z1: 0.75, h: 0.68, front: 0.6, rear: 0.22, x: 0.1 }, rails: true, lane: 1.0, speed: 30 },
  { name: 'sedan', color: '#ff7712', L: 4.55, Wd: 1.8, bodyH: 0.66, clr: 0.25, wheelR: 0.32, wheelZ: [1.45, -1.4],
    cabin: { z0: -1.25, z1: 0.95, h: 0.62, front: 0.7, rear: 0.45, x: 0.12 }, chromeTrim: true, lane: -1.3, speed: 31 },
  { name: 'wagon', color: '#3ba534', L: 4.85, Wd: 1.82, bodyH: 0.7, clr: 0.27, wheelR: 0.33, wheelZ: [1.55, -1.5],
    cabin: { z0: -2.3, z1: 0.95, h: 0.68, front: 0.65, rear: 0.05, x: 0.08 }, rack: true, lane: 1.1, speed: 30 },
  { name: 'bus', color: '#f6b400', L: 11.0, Wd: 2.5, bus: true, clr: 0.42, wheelR: 0.52, wheelZ: [4.35, -2.85], lane: 0.0, speed: 25 },
  { name: 'minivan', color: '#ff5ea6', L: 4.95, Wd: 1.92, bodyH: 0.86, clr: 0.3, wheelR: 0.34, wheelZ: [1.6, -1.55],
    cabin: { z0: -2.35, z1: 1.35, h: 0.84, front: 0.75, rear: 0.1, x: 0.08 }, lane: -1.0, speed: 29 },
  { name: 'pickup', color: '#f4f4f2', L: 5.6, Wd: 2.0, pickup: true, bodyH: 0.85, clr: 0.55, wheelR: 0.46, wheelZ: [1.85, -1.75],
    cabin: { z0: -0.55, z1: 1.3, h: 0.8, front: 0.55, rear: 0.05, x: 0.08 }, lane: 1.2, speed: 30 },
  { name: 'boxtruck', color: '#ff6a00', L: 8.2, Wd: 2.45, truck: true, clr: 0.7, wheelR: 0.52, wheelZ: [2.95, -2.6], lane: 0.0, speed: 24 },
];

// crash tuning per vehicle: target contact time (sim seconds) and how it wrecks
const CRASH = [
  { t: CRASH_TIMES[0],  front: 1.05, roof: 0.06, pen: 1.1, rb: 2.6, yaw: 0.55, roll: 0.05, pitch: 0.35, hop: 0.45, push: 0.0, detach: ['bumperF', 'wheelFR'], shards: 160, chunks: 16 },
  { t: CRASH_TIMES[1],  front: 1.15, roof: 0.18, pen: 1.2, rb: 1.3, yaw: -0.4, roll: -0.08, pitch: 0.3, hop: 0.4, push: 0.6, detach: ['bumperF', 'doorL', 'wheelFL'], shards: 180, chunks: 18 },
  { t: CRASH_TIMES[2], front: 1.25, roof: 0.1, pen: 1.3, rb: 1.2, yaw: 0.3, roll: 0.12, pitch: 0.25, hop: 0.35, push: 0.7, detach: ['bumperF', 'bumperR', 'hood'], shards: 180, chunks: 20 },
  { t: CRASH_TIMES[3], front: 1.3, roof: 0.2, pen: 1.4, rb: 1.1, yaw: -0.65, roll: -0.06, pitch: 0.3, hop: 0.4, push: 0.8, detach: ['bumperF', 'rack', 'wheelFR'], shards: 220, chunks: 22 },
  { t: CRASH_TIMES[4], front: 2.3, roof: 0.35, bend: 0.75, pen: 3.4, rb: 0.9, yaw: 0.32, roll: 0.07, pitch: 0.22, hop: 0.6, push: 2.6, detach: ['bumperF', 'stopArm', 'wheelFL', 'lightsF'], shards: 650, chunks: 40, slow: true },
  { t: CRASH_TIMES[5], front: 1.35, roof: 0.12, pen: 1.4, rb: 1.2, yaw: 0.5, roll: 0.1, pitch: 0.3, hop: 0.45, push: 0.6, detach: ['bumperF', 'doorR', 'doorL'], shards: 220, chunks: 22 },
  { t: CRASH_TIMES[6], front: 1.45, roof: 0.12, pen: 1.5, rb: 1.2, yaw: -0.45, roll: -0.12, pitch: 0.35, hop: 0.55, push: 0.9, detach: ['bumperF', 'guard', 'wheelFR', 'tailgate'], shards: 200, chunks: 24 },
  { t: CRASH_TIMES[7], front: 2.1, roof: 0.25, bend: 0.35, pen: 4.0, rb: 0.7, yaw: -0.22, roll: -0.05, pitch: 0.2, hop: 0.5, push: 3.2, detach: ['bumperF', 'rollDoor', 'wheelFL', 'wheelRR', 'lightsF'], shards: 380, chunks: 46, slow: true },
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
    if (opts.deform !== false) { v.deform.push({ mesh: m, orig: geo.attributes.position.array.slice() }); }
    if (opts.part) v.parts[opts.part] = (v.parts[opts.part] || []).concat([m]);
    if (opts.glass) v.glass.push(m);
    return m;
  };
  let roofY = 0, hoodY = 0;
  if (spec.bus) {
    const c = spec.clr, bh = 2.55;
    add(boxG(0, c + bh / 2, -0.85, spec.Wd, bh, 9.3, [4, 6, 22]), body);                          // main box
    add(boxG(0, c + 0.6, 4.65, 2.2, 1.2, 1.75, [3, 2, 4], { x: 0.06, front: 0.25, rear: 0 }), body); // conventional nose
    add(boxG(0, c + 0.45, 5.5, 1.5, 0.55, 0.06, [2, 1, 1]), MAT.plastic, { part: 'lightsF' });       // grille
    add(boxG(0, c + 0.2, 5.55, 2.35, 0.22, 0.2, [3, 1, 1]), MAT.black, { part: 'bumperF' });
    add(boxG(0, c + 0.2, -5.55, 2.5, 0.22, 0.18, [3, 1, 1]), MAT.black, { part: 'bumperR' });
    for (const s of [-1, 1]) {
      add(boxG(s * 0.78, c + 0.75, 5.53, 0.26, 0.2, 0.04, [1, 1, 1]), MAT.head, { part: 'lightsF' });
      for (const ry of [0.42, 0.95, 1.3]) add(boxG(s * (hw + 0.012), c + ry, -0.85, 0.03, 0.09, 9.2, [1, 1, 18]), MAT.black);
      // side windows, separated by yellow pillars
      for (let k = 0; k < 9; k++) {
        const z = 3.15 - k * 0.98;
        add(boxG(s * (hw + 0.008), c + 1.85, z, 0.03, 0.75, 0.82, [1, 1, 1]), MAT.glass, { glass: true });
      }
      add(boxG(s * 0.75, c + bh + 0.08, 3.55, 0.22, 0.14, 0.16, [1, 1, 1]), MAT.red);
      add(boxG(s * 0.4, c + bh + 0.08, 3.55, 0.2, 0.13, 0.15, [1, 1, 1]), MAT.amber);
      add(boxG(s * 0.75, c + bh + 0.08, -5.25, 0.22, 0.14, 0.16, [1, 1, 1]), MAT.red);
      add(boxG(s * 0.8, c + 0.7, -5.52, 0.25, 0.32, 0.04, [1, 1, 1]), MAT.tail);
    }
    add(boxG(0, c + 1.85, 3.66, 2.3, 0.85, 0.03, [2, 1, 1]), MAT.glass, { glass: true });             // windshield
    add(boxG(0, c + 1.85, -5.52, 2.1, 0.7, 0.03, [2, 1, 1]), MAT.glass, { glass: true });
    add(boxG(0, c + bh + 0.02, -0.85, spec.Wd - 0.1, 0.06, 9.2, [3, 1, 18]), paint('#ffc21a'));      // roof cap
    // stop arm (left side, viewer sees it on the bus's left)
    const sa = new THREE.Shape(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; sa[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 0.25, Math.sin(a) * 0.25); }
    const sg = new THREE.ExtrudeGeometry(sa, { depth: 0.03, bevelEnabled: false }); sg.rotateY(Math.PI / 2); sg.translate(-hw - 0.05, c + 1.45, 2.75);
    add(sg, MAT.red, { part: 'stopArm', deform: false });
    roofY = c + bh; hoodY = c + 1.0;
  } else if (spec.truck) {
    const c = spec.clr;
    add(boxG(0, c + 0.75, 3.2, 2.3, 1.5, 1.9, [3, 3, 5]), body);                                        // cab lower
    add(boxG(0, c + 1.95, 3.0, 2.2, 0.95, 1.5, [3, 2, 4], { x: 0.04, front: 0.18, rear: 0 }), MAT.glass, { glass: true });
    add(boxG(0, c + 2.48, 2.95, 2.1, 0.1, 1.25, [3, 1, 3]), body);                                     // cab roof
    for (const s of [-1, 1]) {
      add(beamG([s * 1.06, c + 1.5, 3.78], [s * 1.0, c + 2.45, 3.6], 0.1), body);
      add(beamG([s * 1.08, c + 1.5, 2.25], [s * 1.04, c + 2.45, 2.3], 0.12), body);
      add(boxG(s * 0.85, c + 0.6, 4.16, 0.32, 0.22, 0.04, [1, 1, 1]), MAT.head, { part: 'lightsF' });
      add(boxG(s * 1.1, c + 2.95 + 0.6, 1.8, 0.14, 0.1, 0.1, [1, 1, 1]), MAT.amber);
    }
    add(boxG(0, c + 0.35, 4.2, 2.35, 0.3, 0.2, [3, 1, 1]), MAT.black, { part: 'bumperF' });
    add(boxG(0, c + 0.85, 4.15, 1.5, 0.45, 0.04, [2, 1, 1]), MAT.plastic, { part: 'lightsF' });
    add(boxG(0, c + 1.75, -1.85, 2.45, 2.85, 5.9, [4, 6, 14]), MAT.white);                              // cargo box
    add(boxG(0, c + 0.2, -1.85, 2.2, 0.25, 6.0, [2, 1, 10]), MAT.steel);                               // chassis rail
    add(boxG(0, c + 1.6, -4.83, 2.2, 2.5, 0.05, [3, 4, 1]), MAT.steel, { part: 'rollDoor' });           // roll-up door
    roofY = c + 3.2; hoodY = c + 1.4;
  } else {
    const c = spec.clr, bh = spec.bodyH, cb = spec.cabin;
    if (spec.pickup) {
      add(boxG(0, c + bh / 2, 1.1, spec.Wd, bh, 3.4, [4, 3, 9]), body);
      add(boxG(0, c + 0.2, -1.7, spec.Wd, 0.3, 2.2, [3, 1, 5]), body);
      for (const s of [-1, 1]) add(boxG(s * (hw - 0.05), c + 0.6, -1.7, 0.1, 0.6, 2.2, [1, 2, 5]), body);
      add(boxG(0, c + 0.6, -2.78, spec.Wd, 0.6, 0.08, [3, 2, 1]), body, { part: 'tailgate' });
      add(boxG(0, c + 0.36, -1.7, spec.Wd - 0.2, 0.04, 2.1, [2, 1, 4]), MAT.plastic);
      const gy = c + 0.45;
      add(beamG([-0.9, gy - 0.25, 2.98], [-0.9, gy + 0.45, 2.98], 0.08), MAT.black, { part: 'guard' });
      add(beamG([0.9, gy - 0.25, 2.98], [0.9, gy + 0.45, 2.98], 0.08), MAT.black, { part: 'guard' });
      add(beamG([-0.95, gy + 0.35, 2.98], [0.95, gy + 0.35, 2.98], 0.08), MAT.black, { part: 'guard' });
      add(beamG([-0.95, gy, 2.98], [0.95, gy, 2.98], 0.08), MAT.black, { part: 'guard' });
    } else {
      add(boxG(0, c + bh / 2, 0, spec.Wd, bh, L, [4, 3, 10]), body);
    }
    // cabin glass + roof + pillars
    const yb = c + bh, cl = cb.z1 - cb.z0, cz = (cb.z0 + cb.z1) / 2;
    add(boxG(0, yb + cb.h / 2, cz, spec.Wd - 0.08, cb.h, cl, [3, 2, 5], { x: cb.x, front: cb.front, rear: cb.rear }), MAT.glass, { glass: true });
    const topW = (spec.Wd - 0.08) * (1 - cb.x), rz0 = cb.z0 + cb.rear, rz1 = cb.z1 - cb.front;
    add(boxG(0, yb + cb.h + 0.035, (rz0 + rz1) / 2, topW + 0.04, 0.07, rz1 - rz0 + 0.06, [2, 1, 4]), body);
    for (const s of [-1, 1]) {
      const xb = s * (spec.Wd / 2 - 0.05), xt = s * (topW / 2);
      add(beamG([xb, yb, cb.z1], [xt, yb + cb.h, rz1], 0.09), body);
      add(beamG([xb, yb, cb.z0], [xt, yb + cb.h, rz0], 0.12), body);
      add(beamG([xb * 1.005, yb, cz - 0.1], [xt * 1.005, yb + cb.h, (rz0 + rz1) / 2 - 0.1], 0.08), body);
      add(boxG(s * (hw - 0.3), c + bh * 0.62, L / 2 + 0.005, 0.32, 0.14, 0.03, [1, 1, 1]), MAT.head, { part: 'lightsF' });
      add(boxG(s * (hw - 0.25), c + bh * 0.65, -L / 2 - 0.005, 0.3, 0.14, 0.03, [1, 1, 1]), MAT.tail);
      if (spec.chromeTrim) add(boxG(s * (hw + 0.005), yb - 0.04, cz, 0.02, 0.04, cl, [1, 1, 3]), MAT.chrome);
      if (spec.rails) add(boxG(s * (topW / 2 - 0.05), yb + cb.h + 0.1, (rz0 + rz1) / 2, 0.05, 0.06, rz1 - rz0, [1, 1, 3]), MAT.black, { part: 'rack' });
      const doorZ = spec.pickup ? 1.0 : cz + cl * 0.15;
      add(boxG(s * (hw + 0.012), c + bh * 0.55, doorZ, 0.03, bh * 0.85, Math.min(1.1, cl * 0.5), [1, 2, 2]), body, { part: s < 0 ? 'doorL' : 'doorR' });
    }
    if (spec.rack) {
      for (const rz of [rz0 + 0.3, (rz0 + rz1) / 2, rz1 - 0.3]) add(boxG(0, yb + cb.h + 0.14, rz, topW + 0.02, 0.05, 0.06, [2, 1, 1]), MAT.black, { part: 'rack' });
      for (const s of [-1, 1]) add(boxG(s * (topW / 2 - 0.03), yb + cb.h + 0.1, (rz0 + rz1) / 2, 0.05, 0.08, rz1 - rz0, [1, 1, 3]), MAT.black, { part: 'rack' });
    }
    const front = spec.pickup ? 2.8 : L / 2, rear = spec.pickup ? -2.82 : -L / 2;
    add(boxG(0, c + 0.12, front + 0.06, spec.Wd + 0.04, 0.24, 0.16, [3, 1, 1]), MAT.plastic, { part: 'bumperF' });
    add(boxG(0, c + 0.12, rear - 0.06, spec.Wd + 0.04, 0.24, 0.16, [3, 1, 1]), MAT.plastic, { part: 'bumperR' });
    add(boxG(0, c + bh * 0.45, front + 0.01, spec.Wd * 0.45, bh * 0.25, 0.03, [1, 1, 1]), MAT.black, { part: 'lightsF' });
    if (!spec.pickup) add(boxG(0, c + bh + 0.005, front - 0.6, spec.Wd - 0.12, 0.02, 1.1, [2, 1, 2]), body, { part: 'hood' });
    roofY = yb + cb.h; hoodY = yb - 0.08;
  }
  v.roofY = roofY; v.hoodY = hoodY;
  // wheels (not deformed, separate groups so they can spin and detach)
  const tireG = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.26, 18); tireG.rotateZ(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(spec.wheelR * 0.55, spec.wheelR * 0.55, 0.28, 10); hubG.rotateZ(Math.PI / 2);
  const dual = spec.bus || spec.truck;
  for (const wz of spec.wheelZ) for (const s of [-1, 1]) {
    const name = 'wheel' + (wz > 0 ? 'F' : 'R') + (s < 0 ? 'L' : 'R');
    const g = new THREE.Group(); const spin = new THREE.Group(); g.add(spin);
    const tire = new THREE.Mesh(tireG, MAT.tire); tire.castShadow = true; spin.add(tire);
    const hub = new THREE.Mesh(hubG, MAT.hub); spin.add(hub);
    if (dual && wz < 0) { const t2 = new THREE.Mesh(tireG, MAT.tire); t2.position.x = -s * 0.28; t2.castShadow = true; spin.add(t2); }
    g.position.set(s * (hw - 0.12), spec.wheelR, wz);
    root.add(g);
    v.wheels.push({ g, spin, name, z0: wz, side: s, attached: true });
    v.parts[name] = [g];
  }
  return v;
}
SPECS.forEach((s, i) => vehicles.push(buildVehicle(s, i)));

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
      if (d.rear > 0) {
        const F = d.rear, zc = -hl + F, zone = 0.6 * F + 0.25;
        if (z < zc + zone) {
          const w = clamp(((zc + zone) - z) / zone, 0, 1.6);
          if (z < zc) z = zc + (z - zc) * 0.2;
          const amp = Math.min(F, 1.4) * w;
          x += (vnoise(x * 2.3, y * 2.3, z * 2.3, s + 3) - 0.5) * 0.45 * amp + Math.sign(x) * 0.08 * amp;
          y += (vnoise(x * 2.1, y * 2.1, z * 2.1 + 5, s + 4) - 0.5) * 0.4 * amp;
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

// ---------------------------------------------------------------- debris, glass, dust
const debris = []; // detached rigid parts (meshes/groups)
const CHUNK_MAX = 900, SHARD_MAX = 4500, DUST_MAX = 420;
const chunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0.3 }), CHUNK_MAX);
chunkMesh.castShadow = true; chunkMesh.count = 0; scene.add(chunkMesh);
const shardGeo = new THREE.BufferGeometry();
shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.6, 0.5, 0, -0.4, -0.55, 0, -0.3], 3));
shardGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
const shardMesh = new THREE.InstancedMesh(shardGeo, new THREE.MeshStandardMaterial({ color: '#d8f0f6', metalness: 0.85, roughness: 0.06, side: THREE.DoubleSide, emissive: '#3a5560', emissiveIntensity: 0.4 }), SHARD_MAX);
shardMesh.count = 0; scene.add(shardMesh);
const chunks = [], shards = [], dusts = [];
const dustTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
for (let i = 0; i < DUST_MAX; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, color: '#cbbfa6', transparent: true, depthWrite: false, opacity: 0 }));
  sp.visible = false; scene.add(sp); dusts.push({ sp, alive: false });
}

function groundAt(x, z) { return Math.abs(x) < 7.5 ? roadH(z) : terrainH(x, z); }

function drumCollide(p, vel, rad) {
  if (Math.abs(p.x) > DRUM_LEN / 2) return false;
  let hit = false;
  DRUM_Z.forEach((dz, i) => {
    const dy = p.y - DRUM_Y, dzz = p.z - dz, dist = Math.hypot(dy, dzz), min = DRUM_R + rad;
    if (dist < min && dist > 1e-4) {
      const ny = dy / dist, nz = dzz / dist;
      p.y = DRUM_Y + ny * min; p.z = dz + nz * min;
      const vn = vel.y * ny + vel.z * nz;
      if (vn < 0) { vel.y -= 1.4 * vn * ny; vel.z -= 1.4 * vn * nz; }
      // surface speed of the spinning drum flings things
      const dir = drumSpin[i].dir, sv = 1.7 * DRUM_R * dir;
      vel.y += -nz * sv * 0.1; vel.z += ny * sv * 0.1;
      hit = true;
    }
  });
  return hit;
}

function integrateBody(b, dt) {
  if (b.sleep) return;
  b.vel.y -= 9.81 * dt;
  b.pos.addScaledVector(b.vel, dt);
  if (b.av) { _v.copy(b.av).multiplyScalar(dt); const ang = _v.length(); if (ang > 1e-6) { _q.setFromAxisAngle(_v.normalize(), ang); b.quat.premultiply(_q); } }
  drumCollide(b.pos, b.vel, b.rad);
  const g = groundAt(b.pos.x, b.pos.z) + b.rad;
  if (b.pos.y < g) {
    const impactV = -b.vel.y;
    b.pos.y = g;
    if (b.vel.y < 0) b.vel.y = -b.vel.y * b.rest;
    b.vel.x *= b.fric; b.vel.z *= b.fric;
    if (b.av) b.av.multiplyScalar(0.72);
    if (b.log && impactV > 2.2 && b.bounces < 4) { EVENTS.clatter.push({ t: simTime, x: b.pos.x, z: b.pos.z, mag: Math.min(1, impactV / 9) * b.mass, kind: b.kind }); b.bounces++; }
    if (b.vel.lengthSq() < 0.05 && (!b.av || b.av.lengthSq() < 0.3)) { b.vel.set(0, 0, 0); if (b.av) b.av.set(0, 0, 0); b.sleep = true; }
  }
}

function spawnPart(v, name, impulseZ) {
  const list = v.parts[name]; if (!list) return;
  for (const obj of list) {
    if (obj.userData.detached) continue;
    obj.userData.detached = true;
    v.root.updateMatrixWorld(true);
    let holder;
    if (obj.isGroup) {
      // wheel group
      const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
      const wq = new THREE.Quaternion(); obj.getWorldQuaternion(wq);
      v.root.remove(obj); scene.add(obj);
      obj.position.copy(wp); obj.quaternion.copy(wq);
      holder = obj;
      const w = v.wheels.find((w) => w.g === obj); if (w) w.attached = false;
    } else {
      obj.geometry.computeBoundingBox();
      const c = new THREE.Vector3(); obj.geometry.boundingBox.getCenter(c);
      obj.geometry.translate(-c.x, -c.y, -c.z);
      const dEntry = v.deform.findIndex((d) => d.mesh === obj); if (dEntry >= 0) v.deform.splice(dEntry, 1);
      const wp = c.clone().applyMatrix4(v.root.matrixWorld);
      v.root.remove(obj); scene.add(obj);
      obj.position.copy(wp); obj.quaternion.copy(v.root.quaternion);
      holder = obj;
    }
    const bb = new THREE.Box3().setFromObject(holder); const size = new THREE.Vector3(); bb.getSize(size);
    const isWheel = name.startsWith('wheel');
    const side = holder.position.x - v.root.position.x;
    const b = {
      obj: holder, pos: holder.position, quat: holder.quaternion,
      vel: new THREE.Vector3(side * SR(1.5, 3.5) + SR(-1.5, 1.5), SR(2.5, 6.5), impulseZ * SR(0.25, 0.55)),
      av: new THREE.Vector3(SR(-8, 8), SR(-6, 6), SR(-8, 8)),
      rad: isWheel ? v.spec.wheelR * 0.55 : Math.max(0.04, Math.min(size.x, size.y, size.z) / 2),
      rest: isWheel ? 0.38 : 0.22, fric: isWheel ? 0.86 : 0.6, sleep: false, log: true, bounces: 0,
      mass: isWheel ? 0.8 : 0.6, kind: isWheel ? 'wheel' : 'panel',
    };
    if (name === 'rollDoor' || name === 'tailgate') { b.vel.set(SR(-1, 1), SR(2, 4), -SR(2, 5)); }
    if (name === 'stopArm') { b.vel.set(-SR(4, 7), SR(3, 5), SR(1, 3)); }
    debris.push(b);
  }
}

function spawnChunks(v, n, at, speed) {
  const col = new THREE.Color(v.spec.color);
  for (let i = 0; i < n && chunks.length < CHUNK_MAX; i++) {
    const r = simRand();
    const c = r < 0.55 ? col.clone().multiplyScalar(SR(0.8, 1.05)) : r < 0.85 ? new THREE.Color('#222426') : new THREE.Color('#c9ccd0');
    const sz = new THREE.Vector3(SR(0.07, 0.32), SR(0.03, 0.12), SR(0.07, 0.3));
    chunks.push({
      pos: new THREE.Vector3(at.x + SR(-v.spec.Wd / 2, v.spec.Wd / 2), at.y + SR(0.2, 1.0), at.z + SR(-0.3, 0.3)),
      vel: new THREE.Vector3(SR(-5, 5), SR(1.5, 7), speed * SR(0.15, 0.6) + SR(-1, 2)),
      av: new THREE.Vector3(SR(-15, 15), SR(-15, 15), SR(-15, 15)),
      quat: new THREE.Quaternion(), size: sz, rad: sz.y / 2, rest: 0.25, fric: 0.55, sleep: false, color: c,
      log: simRand() < 0.35, bounces: 0, mass: 0.25, kind: 'chunk', dirty: true,
    });
    chunkMesh.setColorAt(chunks.length - 1, c);
  }
  if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
}
function spawnShards(v, n, at, speed, spread = 1) {
  for (let i = 0; i < n && shards.length < SHARD_MAX; i++) {
    const s = SR(0.03, 0.11);
    shards.push({
      pos: new THREE.Vector3(at.x + SR(-v.spec.Wd / 2, v.spec.Wd / 2), at.y + SR(-0.2, 0.6), at.z + SR(-1.2, 0.4) * spread),
      vel: new THREE.Vector3(SR(-4.5, 4.5) * spread, SR(1, 6.5), speed * SR(0.1, 0.5) + SR(-1.5, 3)),
      av: new THREE.Vector3(SR(-20, 20), SR(-20, 20), SR(-20, 20)),
      quat: new THREE.Quaternion(), scale: s, rad: 0.005, rest: 0.18, fric: 0.5, sleep: false, log: false, dirty: true,
    });
  }
}
function spawnDust(at, n, scale = 1) {
  for (let i = 0; i < n; i++) {
    const d = dusts.find((d) => !d.alive); if (!d) return;
    d.alive = true; d.born = simTime; d.life = SR(3.5, 6.5) * scale;
    d.pos = new THREE.Vector3(at.x + SR(-2, 2) * scale, at.y + SR(0, 1.2), at.z + SR(-1.5, 1.5) * scale);
    d.vel = new THREE.Vector3(SR(-1.6, 1.6), SR(0.2, 1.1), SR(-1.2, 1.6));
    d.s0 = SR(1.0, 2.2) * scale; d.s1 = SR(4, 7.5) * scale; d.op = SR(0.22, 0.42);
  }
}

// ---------------------------------------------------------------- simulation
const DT = 1 / 240;
let simTime = 0;
const EVENTS = { vehicles: [], clatter: [], tracks: [], timeline: TIMELINE };
const wrecks = [];
let lastTrack = -1;

function extentFront(w) { const c = Math.abs(Math.cos(w.yaw)), s = Math.abs(Math.sin(w.yaw)); return (w.spec.L / 2 - w.def.front) * c + w.spec.Wd / 2 * s; }
function extentBack(w) { const c = Math.abs(Math.cos(w.yaw)), s = Math.abs(Math.sin(w.yaw)); return (w.spec.L / 2 - w.def.rear) * c + w.spec.Wd / 2 * s; }
function contactZFor(v) {
  let c = DRUM_FRONT, hit = null;
  for (const w of wrecks) {
    const cz = w.z - extentBack(w);
    if (cz < c) { c = cz; hit = w; }
  }
  return { c, hit };
}

function initVehicles() {
  vehicles.forEach((v, i) => {
    const cr = CRASH[i];
    v.crash = cr; v.x = v.spec.lane; v.yaw = 0; v.roll = 0; v.pitch = 0; v.yOff = 0;
    // spawn far up the hill so it arrives right on its contact time
    v.speed = v.spec.speed;
    v.spawnT = Math.max(0, cr.t - 380 / v.speed);
    v.z = -9 - (cr.t - v.spawnT) * v.speed;   // provisional, corrected each step by speed control
    v.wheelRot = 0;
  });
}
initVehicles();

function stepVehicle(v, dt) {
  const t = simTime, sp = v.spec, cr = v.crash;
  if (v.state === 'wait') {
    if (t >= v.spawnT) { v.state = 'drive'; v.root.visible = true; EVENTS.vehicles[v.idx] = { name: sp.name, spawn: t, x: v.x }; }
    else return;
  }
  if (v.state === 'drive') {
    const { c } = contactZFor(v);
    const front = v.z + sp.L / 2;
    const remain = Math.max(0.05, cr.t - t);
    const want = clamp((c - front) / remain, sp.speed * 0.75, sp.speed * 1.35);
    if (remain > 1.5) v.speed += (want - v.speed) * Math.min(1, dt * 0.8);
    v.z += v.speed * dt;
    v.pitch = Math.atan(roadSlope(v.z)) * 1.0;
    v.wheelRot += v.speed * dt / sp.wheelR;
    if (v.z + sp.L / 2 >= c) startCrash(v);
  } else if (v.state === 'crash') {
    const u = t - v.tc;
    const tau = cr.pen / v.v0;
    const pen = cr.pen * (1 - Math.exp(-u / tau));
    const rb = cr.rb * smooth(0.1, 1.3, u);
    v.z = v.zc + pen - rb;
    v.wheelRot += Math.max(0, v.v0 * Math.exp(-u / tau)) * dt / sp.wheelR;
    v.def.front = cr.front * clamp(pen / cr.pen, 0, 1);
    v.tireCrush = clamp(pen / cr.pen, 0, 1);
    v.def.roof = cr.roof * smooth(0.05, 0.5, u);
    v.def.bend = (cr.bend || 0) * smooth(0.05, 0.6, u);
    v.defDirty = true;
    v.yaw = cr.yaw * easeOut(u / 1.1);
    v.roll = cr.roll * easeOut(u / 0.9) + 0.12 * Math.sin(u * 9) * Math.exp(-u * 3) * Math.sign(cr.roll || 1);
    v.pitch = -cr.pitch * Math.sin(Math.PI * clamp(u / 0.75, 0, 1)) * (1 - 0.3 * clamp(u, 0, 1)) + 0.05 * Math.sin(u * 14) * Math.exp(-u * 4);
    v.yOff = cr.hop * Math.sin(Math.PI * clamp(u / 0.65, 0, 1));
    if (u > 2.2) {
      v.state = 'wreck'; v.yOff = 0; v.pitch = 0;
      v.base = { x: v.x, z: v.z, yaw: v.yaw, roll: v.roll };
      v.shoves = [];
      wrecks.push(v);
    }
  } else if (v.state === 'wreck') {
    let dx = 0, dz = 0, dyaw = 0, dy = 0, droll = 0;
    for (const s of v.shoves) {
      const k = easeOut((t - s.t0) / s.dur);
      dz += s.dz * k; dx += s.dx * k; dyaw += s.dyaw * k; droll += s.droll * k;
      dy += s.hop * Math.sin(Math.PI * clamp((t - s.t0) / (s.dur * 0.7), 0, 1));
      if (s.crushTo !== undefined) { const nr = s.rear0 + (s.crushTo - s.rear0) * k; if (Math.abs(nr - v.def.rear) > 1e-3) { v.def.rear = nr; v.defDirty = true; } }
      if (s.frontTo !== undefined) { const nf = s.front0 + (s.frontTo - s.front0) * k; if (Math.abs(nf - v.def.front) > 1e-3) { v.def.front = nf; v.defDirty = true; } }
    }
    v.x = v.base.x + dx; v.z = v.base.z + dz; v.yaw = v.base.yaw + dyaw; v.roll = v.base.roll + droll; v.yOff = dy;
  }
}

function startCrash(v) {
  const sp = v.spec, cr = v.crash, t = simTime;
  const { c, hit } = contactZFor(v);
  v.state = 'crash'; v.tc = t; v.v0 = v.speed; v.zc = c - sp.L / 2;
  const at = new THREE.Vector3(v.x, roadH(c) + sp.clr + 0.6, c);
  EVENTS.vehicles[v.idx].contact = t;
  v.contactZ = c;
  EVENTS.vehicles[v.idx].hitDrum = !hit;
  EVENTS.vehicles[v.idx].speed = v.speed;
  for (const p of cr.detach) spawnPart(v, p, v.speed);
  spawnChunks(v, cr.chunks, at, v.speed);
  const glassAt = new THREE.Vector3(v.x, roadH(c) + sp.clr + (sp.bus ? 1.9 : sp.truck ? 1.9 : sp.bodyH + 0.35), c - (sp.bus ? 1.5 : 0.8));
  spawnShards(v, cr.shards, glassAt, v.speed, sp.bus ? 2.2 : 1);
  for (const gm of v.glass) gm.material = MAT.broken;
  spawnDust(at, sp.bus || sp.truck ? 26 : 12, sp.bus || sp.truck ? 1.5 : 1);
  if (!hit) { for (const ch of chains) { ch.kick = 0.35; ch.kickT = t; } }
  else { for (const ch of chains) { ch.kick = Math.max(0.12, 0.08 * cr.push); ch.kickT = t; } }
  // shove the existing pile toward the drums, compressing it
  if (hit && wrecks.length) {
    const ordered = wrecks.slice().sort((a, b) => b.z - a.z); // nearest the drums first
    let push = cr.push;
    const room = [];
    let limit = DRUM_FRONT;
    for (const w of ordered) {
      const curFront = w.z + extentFront(w);
      const avail = Math.max(0, limit - curFront);
      room.push(avail);
      limit = w.z - extentBack(w) + Math.min(push, avail) + 0.0;
    }
    ordered.forEach((w, i) => {
      const mv = Math.min(push * (0.55 + 0.45 * (i + 1) / ordered.length), room[i] + push * 0.25);
      const excess = Math.max(0, push - room[i]);
      w.shoves.push({ t0: t + 0.02 * (ordered.length - i), dur: 0.45, dz: mv, dx: SR(-0.35, 0.35) * cr.push, dyaw: SR(-0.18, 0.18) * Math.min(2, cr.push),
        droll: SR(-0.06, 0.06) * cr.push, hop: 0.12 * cr.push,
        rear0: w.def.rear, crushTo: Math.min(1.4, w.def.rear + 0.25 + excess * 0.25),
        front0: w.def.front, frontTo: Math.min(w.spec.L * 0.33, w.def.front + excess * 0.2) });
      // extra glass and bits from the shoved wrecks on the big hits
      if (cr.push > 2) { spawnShards(w, 30, new THREE.Vector3(w.x, roadH(w.z) + 1.2, w.z), 4); spawnChunks(w, 5, new THREE.Vector3(w.x, roadH(w.z) + 0.8, w.z), 4); }
    });
  }
}

function stepSim(dt) {
  for (const v of vehicles) stepVehicle(v, dt);
  for (const b of debris) integrateBody(b, dt);
  for (const b of chunks) { if (!b.sleep) { integrateBody(b, dt); b.dirty = true; } }
  for (const b of shards) { if (!b.sleep) { integrateBody(b, dt); b.dirty = true; } }
  for (const d of dusts) {
    if (!d.alive) continue;
    d.pos.addScaledVector(d.vel, dt); d.vel.multiplyScalar(1 - 0.6 * dt); d.vel.y -= 0.05 * dt;
    if (simTime - d.born > d.life) { d.alive = false; d.sp.visible = false; }
  }
  // sampled tracks for the audio engine
  const ti = Math.floor(simTime * 20);
  if (ti !== lastTrack) {
    lastTrack = ti;
    EVENTS.tracks.push({ t: simTime, v: vehicles.map((v) => (v.state === 'drive' ? [Math.round(v.z * 10) / 10, Math.round(v.speed * 10) / 10, v.x] : null)) });
  }
  simTime += dt;
}

function simTo(ts) { while (simTime + DT <= ts + 1e-9) stepSim(DT); }

// ---------------------------------------------------------------- render
const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
const cg = comp.getContext('2d');
document.body.appendChild(comp);

function syncVisuals() {
  const t = simTime;
  for (const d of drumSpin) d.g.rotation.x = d.dir * 1.7 * t;
  updateChains(t);
  for (const v of vehicles) {
    if (!v.root.visible) continue;
    if (v.defDirty) applyDeform(v);
    const gy = roadH(v.z) + v.yOff;
    v.root.position.set(v.x, gy, v.z);
    v.root.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
    for (const w of v.wheels) if (w.attached) {
      w.spin.rotation.x = v.wheelRot;
      // tyres squash, splay and buckle as the front end is crushed
      const k = (w.z0 > 0 ? 1 : (v.spec.bus || v.spec.truck ? 0.45 : 0.25)) * (v.tireCrush || 0);
      w.g.scale.set(1 + 0.3 * k, 1 - 0.42 * k, 1 + 0.12 * k);
      w.g.rotation.z = w.side * 0.45 * k;
      w.g.rotation.y = w.side * 0.25 * k;
      w.g.position.y = v.spec.wheelR * (1 - 0.42 * k);
    }
  }
  chunkMesh.count = chunks.length;
  chunks.forEach((b, i) => { if (b.dirty) { _m.compose(b.pos, b.quat, b.size); chunkMesh.setMatrixAt(i, _m); b.dirty = false; } });
  chunkMesh.instanceMatrix.needsUpdate = true;
  shardMesh.count = shards.length;
  shards.forEach((b, i) => { if (b.dirty) { _v2.setScalar(b.scale); _m.compose(b.pos, b.quat, _v2); shardMesh.setMatrixAt(i, _m); b.dirty = false; } });
  shardMesh.instanceMatrix.needsUpdate = true;
  for (const d of dusts) {
    if (!d.alive) continue;
    const a = (t - d.born) / d.life;
    d.sp.visible = true; d.sp.position.copy(d.pos);
    const s = d.s0 + (d.s1 - d.s0) * Math.sqrt(a); d.sp.scale.set(s, s, 1);
    d.sp.material.opacity = d.op * Math.min(1, a * 6) * (1 - a);
  }
}

const TITLE = window.__TITLE || ['CARS & SCHOOL BUS', 'VS CHAINED CRUSHERS'];
function drawTitle() {
  const lines = [{ text: TITLE[0], fill: '#ffffff', size: 104, y: 150 }, { text: TITLE[1], fill: '#ffd21a', size: 92, y: 262 }];
  cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.lineJoin = 'round';
  for (const l of lines) {
    let size = l.size;
    cg.font = `900 ${size}px Inter, "Inter Display", sans-serif`;
    const wdt = cg.measureText(l.text).width; if (wdt > W - 90) { size *= (W - 90) / wdt; cg.font = `900 ${size}px Inter, "Inter Display", sans-serif`; }
    cg.lineWidth = size * 0.2; cg.strokeStyle = '#000'; cg.strokeText(l.text, W / 2, l.y);
    cg.fillStyle = l.fill; cg.fillText(l.text, W / 2, l.y);
  }
}

// ---------------------------------------------------------------- camera director
const WIDE = { pos: new THREE.Vector3(0, 24, 31), look: new THREE.Vector3(0, 0, -40), fov: 64 };
const SIDES = [-1, 1, -1, 1, 1, -1, 1, -1];
const SHOTS = CRASH_TIMES.map((t, i) => {
  const [a, b] = TIMELINE.slow[i];
  const inStart = simToOut(a) - (HEAVY[i] ? 1.1 : 0.75);
  return { i, heavy: HEAVY[i], inStart, inEnd: inStart + 0.45, outStart: simToOut(b) + 0.25, outEnd: simToOut(b) + 1.0, side: SIDES[i] };
});
const easeIO = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
function focusOf(v) {
  const big = v.spec.bus || v.spec.truck;
  const fz = (v.state === 'drive' || v.state === 'wait') ? contactZFor(v).c : v.contactZ;
  const z = fz - (big ? 2.2 : 0.7);
  return new THREE.Vector3(v.spec.lane * 0.7, roadH(z) + (big ? 1.4 : 0.7), z);
}
function closeShot(sh, tOut) {
  const v = vehicles[sh.i], f = focusOf(v);
  const prog = clamp((tOut - sh.inStart) / (sh.outEnd - sh.inStart), 0, 1);
  let theta, dist, h, fov;
  if (sh.i === 0) { theta = 2.05 - 0.35 * prog; dist = 10; h = 2.6; fov = 46; }          // sees it slam the drums
  else if (sh.heavy) {
    const mid = (sh.inEnd + sh.outStart) / 2;
    if (tOut < mid) { theta = 1.0 + 0.3 * prog; dist = 17; h = 3.2; fov = 50; }           // low side angle
    else { theta = 0.5 + 0.25 * prog; dist = 14; h = 14; fov = 54; }                       // high angle over the pile
  } else { theta = 1.08 + 0.4 * prog; dist = 10.5; h = 2.4; fov = 46; }
  const pos = new THREE.Vector3(f.x + sh.side * Math.sin(theta) * dist, 0, f.z + Math.cos(theta) * dist);
  pos.y = Math.max(roadH(pos.z) + h, terrainH(pos.x, pos.z) + 1.6);
  return { pos, look: f, fov: fov - 6 * prog };
}
function direct(tOut) {
  let cam = WIDE, k = 0, sh = null;
  for (const s of SHOTS) if (tOut >= s.inStart && tOut <= s.outEnd) { sh = s; break; }
  if (sh) {
    cam = closeShot(sh, tOut);
    k = tOut < sh.inEnd ? easeIO((tOut - sh.inStart) / (sh.inEnd - sh.inStart))
      : tOut > sh.outStart ? 1 - easeIO((tOut - sh.outStart) / (sh.outEnd - sh.outStart)) : 1;
  }
  const pos = WIDE.pos.clone().lerp(cam.pos, k), look = WIDE.look.clone().lerp(cam.look, k);
  // impact shake on the close-ups
  if (sh) {
    const v = vehicles[sh.i];
    if (v.tc !== undefined) {
      const dt = tOut - simToOut(v.tc);
      if (dt >= 0 && dt < 1.2) {
        const a = (sh.heavy ? 0.22 : 0.12) * Math.exp(-dt / 0.25) * k;
        pos.x += a * Math.sin(dt * 83); pos.y += a * Math.sin(dt * 71 + 1); look.x += a * 0.5 * Math.sin(dt * 59);
      }
    }
  }
  camera.position.copy(pos);
  camera.fov = WIDE.fov + (cam.fov - WIDE.fov) * k;
  camera.updateProjectionMatrix();
  camera.lookAt(look);
}

function renderFrame(tOut) {
  syncVisuals();
  direct(tOut);
  renderer.render(scene, camera);
  cg.drawImage(glCanvas, 0, 0);
  // slow-motion look: soft vignette while slowed, white flash on enter/exit
  const sm = slowAmountAtOut(tOut);
  if (sm.amount > 0) {
    const gr = cg.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.45 * sm.amount})`);
    cg.fillStyle = gr; cg.fillRect(0, 0, W, H);
  }
  if (sm.flash > 0) { cg.fillStyle = `rgba(255,255,255,${sm.flash})`; cg.fillRect(0, 0, W, H); }
  drawTitle();
  return comp.toDataURL('image/jpeg', 0.93);
}

window.SIM = {
  simTo, renderFrame, outToSim, simToOut,
  events: () => EVENTS,
  debug: () => ({ debris: debris.map((b) => [b.kind, +b.pos.x.toFixed(1), +b.pos.y.toFixed(1), +b.pos.z.toFixed(1)]), chunksFar: chunks.filter((b) => b.pos.z < -30).map((b)=>[+b.pos.z.toFixed(0), +b.pos.y.toFixed(1)]).slice(0,12), shardsFar: shards.filter((b) => b.pos.z < -30).length, veh: vehicles.map((v) => [v.spec.name, v.state, +v.z.toFixed(1)]) }),
  simTime: () => simTime,
  frameAt(tOut) { simTo(outToSim(tOut)); return renderFrame(tOut); },
};
window.SIM_READY = true;

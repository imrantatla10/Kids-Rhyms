// "The Car Vending Machine" – deterministic 3D (three.js) + 2D overlay renderer.
// window.renderFrame(t) draws the frame at time t (seconds) and returns a JPEG data URL.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1080, H = 1920;
const SEG = window.SEGMENTS || [];

// ---------------------------------------------------------------- helpers
const cl = (x) => Math.min(1, Math.max(0, x));
const st = (a, b, t) => cl((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eo = (x) => 1 - Math.pow(1 - x, 3);
const ei = (x) => x * x * x;
const eob = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const bounce = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(42);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- renderer
const glCanvas = document.createElement('canvas');
glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 400);

const out = document.getElementById('out');
const ctx = out.getContext('2d');

// ---------------------------------------------------------------- materials
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.0, ...o });
const mat = {
  grass: M(0x6cc24a, { roughness: 0.95 }),
  grass2: M(0x5bb33e, { roughness: 0.95 }),
  dirt: M(0x7a4f2e, { roughness: 1, side: THREE.BackSide }),
  dirtChunk: M(0x6b4226, { roughness: 1 }),
  concrete: M(0x9a9a95, { roughness: 0.9 }),
  road: M(0x3d4248, { roughness: 0.9 }),
  walk: M(0xd9d4c7, { roughness: 0.9 }),
  white: M(0xffffff),
  steel: M(0x8f9aa6, { metalness: 0.75, roughness: 0.35 }),
  steelDark: M(0x58626e, { metalness: 0.7, roughness: 0.45 }),
  yellow: M(0xffc21a, { metalness: 0.3, roughness: 0.4 }),
  black: M(0x1b1b1f, { roughness: 0.6 }),
  tire: M(0x202024, { roughness: 0.8 }),
  hub: M(0xd8dde3, { metalness: 0.8, roughness: 0.25 }),
  carGlass: M(0x1d3557, { metalness: 0.3, roughness: 0.08 }),
  head: new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff3c4, emissiveIntensity: 0.6 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff2233, emissiveIntensity: 0.4 }),
  skin: M(0xf2b48a, { roughness: 0.6 }),
  shirt: M(0xff7a1a, { roughness: 0.7 }),
  pants: M(0x2f5fa8, { roughness: 0.8 }),
  hair: M(0x3b2416, { roughness: 0.8 }),
  shoe: M(0x2a2a2a),
  eyeW: M(0xffffff, { roughness: 0.2 }),
  pupil: M(0x111111, { roughness: 0.2 }),
  mouth: M(0x5a1a1a),
  trunk: M(0x8a5a33),
  leaf: M(0x3fa34d, { roughness: 0.8 }),
  leaf2: M(0x58b85a, { roughness: 0.8 }),
  house: M(0xf6e7c8),
  roof: M(0xc0483b),
  door: M(0x7b4a2a),
  win: new THREE.MeshStandardMaterial({ color: 0x9fd3ff, emissive: 0xffc861, emissiveIntensity: 0, roughness: 0.15 }),
  nest: M(0x8b5a2b, { roughness: 1 }),
  egg: M(0xbfe6ff, { roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xa8dcff, transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
  frame: M(0xdfe6ee, { metalness: 0.8, roughness: 0.25 }),
  led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1c9, emissiveIntensity: 0 }),
  turn: M(0x50575f, { metalness: 0.6, roughness: 0.4 }),
  stripe: M(0xffc21a, { emissive: 0xffa000, emissiveIntensity: 0 }),
  cloud: M(0xffffff, { roughness: 1 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffd88a, emissiveIntensity: 0 }),
};

function mesh(geo, m, cast = true, recv = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
const box = (w, h, d, m, r = 0) => mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), m);

// ---------------------------------------------------------------- lights
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5d8a3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
sun.position.set(14, 26, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18; sun.shadow.camera.right = 18; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -14;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xbcd7ff, 0.5);
fill.position.set(-12, 8, 10);
scene.add(fill);
const towerGlow = new THREE.PointLight(0xffd79a, 0, 30, 1.6);
towerGlow.position.set(0, 6, 4);
scene.add(towerGlow);

// ---------------------------------------------------------------- sky
const skyU = { night: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform float night; varying vec3 vp;
    float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
    void main(){ float y = clamp(vp.y,0.,1.);
      vec3 dTop = vec3(0.28,0.6,0.98), dHor = vec3(0.78,0.92,1.0);
      vec3 nTop = vec3(0.02,0.03,0.12), nHor = vec3(0.12,0.12,0.32);
      vec3 c = mix(mix(dHor,dTop,pow(y,0.6)), mix(nHor,nTop,pow(y,0.5)), night);
      vec3 q = floor(vp*260.); float s = step(0.9965, h(q)) * smoothstep(0.08,0.4,y);
      c += vec3(s)*night*0.9;
      gl_FragColor = vec4(c,1.); }`,
}));
scene.add(sky);
const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6d5, transparent: true, opacity: 0 }));
moon.position.set(-40, 70, -120);
scene.add(moon);

// clouds
const clouds = [];
for (let i = 0; i < 9; i++) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) {
    const s = mesh(new THREE.SphereGeometry(1.4 + R() * 1.4, 16, 12), mat.cloud, false, false);
    s.position.set(k * 1.8 - n * 0.9, R() * 0.8, R() * 1.2);
    s.scale.y = 0.75;
    g.add(s);
  }
  g.position.set(-50 + R() * 100, 22 + R() * 14, -70 + R() * 40);
  g.userData.x0 = g.position.x; g.userData.sp = 0.3 + R() * 0.5;
  scene.add(g); clouds.push(g);
}

// ---------------------------------------------------------------- ground with a pit
const HX = 4.6, HZ = 2.45, PIT = 2.6;
{
  const sh = new THREE.Shape();
  sh.moveTo(-60, -60); sh.lineTo(60, -60); sh.lineTo(60, 10.8); sh.lineTo(-60, 10.8); sh.lineTo(-60, -60);
  const hole = new THREE.Path();
  hole.moveTo(-HX, -HZ); hole.lineTo(-HX, HZ); hole.lineTo(HX, HZ); hole.lineTo(HX, -HZ); hole.lineTo(-HX, -HZ);
  sh.holes.push(hole);
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  const lawn = mesh(g, mat.grass, false, true);
  scene.add(lawn);
  // mowing stripes
  for (let i = -6; i < 6; i++) {
    const s = mesh(new THREE.PlaneGeometry(2.2, 20), mat.grass2, false, true);
    s.rotation.x = -Math.PI / 2; s.position.set(i * 4.4 + 1.1, 0.004, 0.5);
    if (Math.abs(s.position.x) < HX + 1.2) continue;
    scene.add(s);
  }
}
const patch = mesh(new THREE.PlaneGeometry(HX * 2 + 0.02, HZ * 2 + 0.02), mat.grass, false, true);
patch.rotation.x = -Math.PI / 2; patch.position.y = 0.002; scene.add(patch);
const pit = mesh(new THREE.BoxGeometry(HX * 2, PIT, HZ * 2), mat.dirt, false, true);
pit.position.y = -PIT / 2; scene.add(pit);
const concrete = mesh(new THREE.BoxGeometry(HX * 2 - 0.02, 1, HZ * 2 - 0.02), mat.concrete, false, true);
scene.add(concrete);
const pour = mesh(new THREE.CylinderGeometry(0.28, 0.36, 1, 14, 1, true), mat.concrete, false, false);
scene.add(pour);
const chute = new THREE.Group();
{
  const c = box(0.8, 0.25, 4.5, mat.yellow); c.rotation.x = 0.35; chute.add(c);
  chute.position.set(-3.2, 7.5, 3.5);
  scene.add(chute);
}
// dirt chunks (instanced)
const DIRT_N = 90;
const dirt = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.16, 0), mat.dirtChunk, DIRT_N);
dirt.castShadow = true;
const dirtV = [];
for (let i = 0; i < DIRT_N; i++) dirtV.push({ x: (R() - 0.5) * HX * 1.8, z: (R() - 0.5) * HZ * 1.8, vx: (R() - 0.5) * 7, vz: (R() - 0.5) * 5 + 1, vy: 5 + R() * 6, t0: 15.25 + R() * 0.7, s: 0.6 + R() * 1.2 });
scene.add(dirt);

// road & sidewalk
{
  const walk = mesh(new THREE.BoxGeometry(120, 0.08, 1.6), mat.walk, false, true); walk.position.set(0, 0.04, 11.6); scene.add(walk);
  const road = mesh(new THREE.PlaneGeometry(120, 7), mat.road, false, true); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 15.9); scene.add(road);
  for (let i = -20; i < 20; i++) { const d = mesh(new THREE.PlaneGeometry(1.6, 0.18), mat.white, false, true); d.rotation.x = -Math.PI / 2; d.position.set(i * 3.4, 0.02, 15.9); scene.add(d); }
  const drive = mesh(new THREE.PlaneGeometry(2.8, 8.4), mat.walk, false, true); drive.rotation.x = -Math.PI / 2; drive.position.set(0, 0.006, 6.8); scene.add(drive);
}
// picket fence
{
  const fg = new THREE.Group();
  const add = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 0.45);
    for (let i = 0; i <= n; i++) { const u = i / n; const p = box(0.12, 0.9, 0.05, mat.white); p.position.set(lerp(x0, x1, u), 0.45, lerp(z0, z1, u)); p.rotation.y = Math.atan2(x1 - x0, z1 - z0); fg.add(p); }
    for (const yy of [0.3, 0.68]) { const r = box(len, 0.07, 0.04, mat.white); r.position.set((x0 + x1) / 2, yy, (z0 + z1) / 2); r.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); fg.add(r); }
  };
  add(-13, 10.4, -1.6, 10.4); add(1.6, 10.4, 13, 10.4); add(-13, 10.4, -13, -9); add(13, 10.4, 13, -9);
  scene.add(fg);
}
// house
const house = new THREE.Group();
{
  const b = box(10, 5, 6, mat.house); b.position.y = 2.5; house.add(b);
  const roofG = new THREE.CylinderGeometry(0.01, 6.6, 3.2, 4, 1); roofG.rotateY(Math.PI / 4); roofG.scale(1.22, 1, 0.8);
  const r = mesh(roofG, mat.roof); r.position.y = 6.6; house.add(r);
  const d = box(1.4, 2.4, 0.1, mat.door); d.position.set(0, 1.2, 3.02); house.add(d);
  for (const x of [-3, 3]) for (const y of [1.6, 3.8]) { const w = box(1.6, 1.2, 0.1, mat.win); w.position.set(x, y, 3.02); house.add(w); const f = box(1.8, 0.12, 0.14, mat.white); f.position.set(x, y - 0.66, 3.05); house.add(f); }
  const ch = box(0.9, 2, 0.9, mat.roof); ch.position.set(2.6, 7.2, 0); house.add(ch);
  house.position.set(0, 0, -15);
  scene.add(house);
}
// trees
const trees = [];
function tree(x, z, s, kind) {
  const g = new THREE.Group();
  const tr = mesh(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 2.2 * s, 8), mat.trunk); tr.position.y = 1.1 * s; g.add(tr);
  const top = new THREE.Group(); top.position.y = 2.0 * s; g.add(top);
  if (kind) { for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry((1.5 - i * 0.35) * s, 1.6 * s, 10), mat.leaf); c.position.y = (0.4 + i * 0.85) * s; top.add(c); } }
  else { for (let i = 0; i < 4; i++) { const c = mesh(new THREE.IcosahedronGeometry((0.9 + R() * 0.5) * s, 1), i % 2 ? mat.leaf : mat.leaf2); c.position.set((R() - 0.5) * 1.4 * s, (0.6 + R() * 1.0) * s, (R() - 0.5) * 1.2 * s); top.add(c); } }
  g.position.set(x, 0, z); g.userData.top = top; g.userData.ph = R() * 6;
  scene.add(g); trees.push(g);
}
tree(-9, -4, 1.3, 0); tree(-10.5, 3, 1.1, 1); tree(9.5, -5, 1.4, 1); tree(10, 4, 1.0, 0); tree(-7, -10, 1.2, 0); tree(7.5, -11, 1.1, 0); tree(-16, 8, 1.4, 1); tree(17, 7, 1.3, 0); tree(-20, -6, 1.6, 0); tree(21, -4, 1.5, 1);
// bushes
for (let i = 0; i < 10; i++) { const b = mesh(new THREE.IcosahedronGeometry(0.6 + R() * 0.3, 1), mat.leaf2); const x = (i < 5 ? -1 : 1) * (5.6 + R() * 5); b.position.set(x, 0.35, -9 + R() * 3); b.scale.y = 0.75; scene.add(b); }
// street lamps
const lamps = [];
for (const x of [-7, 7]) { const g = new THREE.Group(); const p = mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 8), mat.steelDark); p.position.y = 2.1; g.add(p); const h = box(0.5, 0.3, 0.5, mat.lamp); h.position.y = 4.3; g.add(h); g.position.set(x, 0, 11.6); scene.add(g); lamps.push(h); }

// ---------------------------------------------------------------- cars
const COLORS = [0x2a9df4, 0x2ec27e, 0xff8c1a, 0x9b5de5, 0x00bbf9, 0xf15bb5, 0x43aa8b, 0xf3722c, 0x577590, 0x3a86ff,
  0x8ac926, 0xff595e, 0x6a4c93, 0xffd23f, 0x1982c4, 0xef476f, 0x06d6a0, 0xfb8500, 0x4361ee, 0xe63946];
const FAV = 19;      // floor 10, bay B (top-right) – the favourite red car
const B7 = 13;       // floor 7, bay B – the car that gets stuck
const WINDY = 9;     // floor 5, bay B – the car the wind pushes
const FLOOR_Y = (i) => 0.95 + i * 1.2;
const TOWER_H = FLOOR_Y(9) + 1.35;
const slotLocal = (k) => V3((k & 1) ? 2.4 : -2.4, FLOOR_Y(k >> 1) + 0.05, 0);

function makeCar(color, k) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.35, emissive: color, emissiveIntensity: 0 });
  const lower = mesh(new RoundedBoxGeometry(1.04, 0.42, 2.0, 3, 0.14), paint); lower.position.y = 0.42; body.add(lower);
  const cab = mesh(new RoundedBoxGeometry(0.9, 0.4, 1.08, 3, 0.14), mat.carGlass); cab.position.set(0, 0.78, -0.1); body.add(cab);
  const roof = mesh(new RoundedBoxGeometry(0.94, 0.09, 0.98, 2, 0.04), paint); roof.position.set(0, 0.98, -0.12); body.add(roof);
  for (const x of [-0.3, 0.3]) { const h = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.04), mat.head, false, false); h.position.set(x, 0.48, 1.0); body.add(h); const tl = mesh(new THREE.BoxGeometry(0.22, 0.08, 0.04), mat.tail, false, false); tl.position.set(x, 0.5, -1.0); body.add(tl); }
  const bump = mesh(new THREE.BoxGeometry(1.0, 0.1, 0.08), mat.hub); bump.position.set(0, 0.26, 1.0); body.add(bump);
  const wheels = [];
  for (const [x, z] of [[-0.5, 0.64], [0.5, 0.64], [-0.5, -0.64], [0.5, -0.64]]) {
    const w = new THREE.Group(); w.position.set(x, 0.21, z);
    const tire = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.17, 18), mat.tire); tire.rotation.z = Math.PI / 2; w.add(tire);
    const hub = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 12), mat.hub); hub.rotation.z = Math.PI / 2; w.add(hub);
    const sp = mesh(new THREE.BoxGeometry(0.185, 0.04, 0.2), mat.tire, false, false); w.add(sp);
    g.add(w); wheels.push(w);
  }
  g.userData = { body, wheels, paint, k };
  scene.add(g);
  return g;
}
const cars = COLORS.map((c, k) => makeCar(c, k));
// pile layout (pyramid 6-5-4-3-2)
const ROWS = [6, 5, 4, 3, 2];
const pileSlot = []; // pile index -> {r, j}
ROWS.forEach((n, r) => { for (let j = 0; j < n; j++) pileSlot.push({ r, j, n }); });
const order = [...Array(20).keys()];
{ const r2 = rng(7); for (let i = 19; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } }
// car k sits at pile index pileOf[k]
const pileOf = []; order.forEach((k, p) => { pileOf[k] = p; });
const pileJit = [...Array(20)].map(() => ({ ry: (R() - 0.5) * 0.5 + (R() < 0.5 ? 0 : Math.PI), rz: (R() - 0.5) * 0.14, dx: (R() - 0.5) * 0.15 }));
const PILE_Z = 5.0;

// ---------------------------------------------------------------- tower
const tower = new THREE.Group(); scene.add(tower);
const cols = [], shelves = [], beams = [], clamps = [], leds = [], braces = [];
const colGeo = new THREE.BoxGeometry(0.2, 1, 0.2); colGeo.translate(0, 0.5, 0);
for (const x of [-3.6, -1.2, 1.2, 3.6]) for (const z of [-1.45, 1.45]) { const c = mesh(colGeo, mat.steel); c.position.set(x, 0, z); c.scale.y = TOWER_H; tower.add(c); cols.push(c); }
for (let i = 0; i < 10; i++) {
  for (const s of [-1, 1]) {
    const sh = box(2.3, 0.1, 2.85, mat.steelDark); sh.position.set(s * 2.4, FLOOR_Y(i) - 0.05, 0); tower.add(sh); shelves.push(sh);
    const led = mesh(new THREE.BoxGeometry(1.9, 0.05, 0.12), mat.led.clone(), false, false); led.position.set(s * 2.4, FLOOR_Y(i) + 1.08, 1.2); tower.add(led); leds.push(led);
    // X-brace on the outer side faces
    if (i < 9) for (const d of [-1, 1]) { const b = box(0.06, 1.75, 0.06, mat.steel); b.position.set(s * 3.62, FLOOR_Y(i) + 0.6, 0); b.rotation.x = d * 0.98; tower.add(b); braces.push(b); }
  }
  for (const z of [-1.45, 1.45]) { const b = box(7.4, 0.12, 0.12, mat.steel); b.position.set(0, FLOOR_Y(i) + 1.12, z); tower.add(b); beams.push(b); }
}
const roofCap = box(7.8, 0.3, 3.3, mat.steelDark); roofCap.position.y = TOWER_H; tower.add(roofCap);
// lift rails + lift
const rails = [];
for (const x of [-1.05, 1.05]) { const r = mesh(colGeo, mat.yellow); r.position.set(x, 0, -1.25); r.scale.set(0.5, TOWER_H, 0.5); tower.add(r); rails.push(r); }
const lift = new THREE.Group(); tower.add(lift);
{
  const back = box(2.1, 0.2, 0.25, mat.yellow); back.position.set(0, 0.05, -1.15); lift.add(back);
  for (const x of [-0.5, 0.5]) { const f = box(0.16, 0.08, 2.4, mat.yellow); f.position.set(x, 0, 0); lift.add(f); }
  const lamp = mesh(new THREE.SphereGeometry(0.09, 10, 8), mat.stripe, false, false); lamp.position.set(0, 0.25, -1.15); lift.add(lamp);
}
const grabber = new THREE.Group(); lift.add(grabber);
{ for (const z of [-0.6, 0.6]) { const a = box(1.2, 0.06, 0.12, mat.steel); a.position.set(0.6, 0.02, z); grabber.add(a); } }
// turntable
const turntable = new THREE.Group(); tower.add(turntable);
{
  const disk = mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.1, 40), mat.turn); disk.position.y = 0.05; turntable.add(disk);
  const ring = mesh(new THREE.TorusGeometry(1.15, 0.04, 6, 40), mat.stripe, false, false); ring.rotation.x = Math.PI / 2; ring.position.y = 0.105; turntable.add(ring);
  const ar = mesh(new THREE.ConeGeometry(0.22, 0.45, 3), mat.stripe, false, false); ar.rotation.x = Math.PI / 2; ar.position.set(0, 0.11, 0.85); ar.scale.y = 0.3; turntable.add(ar);
}
// steel wheel clamps: 4 per car slot
for (let k = 0; k < 20; k++) {
  const p = slotLocal(k);
  const set = [];
  for (const [x, z] of [[-0.5, 0.64], [0.5, 0.64], [-0.5, -0.64], [0.5, -0.64]]) {
    const piv = new THREE.Group(); piv.position.set(p.x + x * 1.42, p.y, p.z - z);
    const arm = box(0.07, 0.5, 0.07, mat.yellow); arm.position.y = 0.25; piv.add(arm);
    const cup = box(0.32, 0.07, 0.09, mat.steel); cup.position.set(-Math.sign(x) * 0.13, 0.46, 0); piv.add(cup);
    piv.userData.side = Math.sign(x);
    tower.add(piv); set.push(piv);
  }
  clamps.push(set);
}
// glass skin
const glassG = new THREE.Group(); tower.add(glassG);
const glassPanels = [];
{
  const hh = TOWER_H + 0.2;
  const mk = (w, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const pg = new THREE.PlaneGeometry(w, hh); pg.translate(0, hh / 2, 0);
    const p = new THREE.Mesh(pg, mat.glass); p.renderOrder = 5; g.add(p);
    for (let i = 0; i <= 10; i++) { const b = box(w, 0.06, 0.06, mat.frame); b.position.y = i === 10 ? hh : (i === 0 ? 0.03 : FLOOR_Y(i - 1) + 1.15); g.add(b); }
    for (let j = 0; j <= 4; j++) { const b = mesh(colGeo, mat.frame); b.scale.set(0.3, hh, 0.3); b.position.x = -w / 2 + j * w / 4; g.add(b); }
    glassG.add(g); glassPanels.push(g);
  };
  mk(7.8, 0, 1.62, 0); mk(3.3, 3.92, 0, Math.PI / 2); mk(3.3, -3.92, 0, -Math.PI / 2); mk(7.8, 0, -1.62, Math.PI);
}
// neon sign on the roof
const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 256;
const signTex = new THREE.CanvasTexture(signCanvas); signTex.colorSpace = THREE.SRGBColorSpace;
const signMat = new THREE.MeshStandardMaterial({ color: 0x222233, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0, map: signTex });
const sign = new THREE.Group(); tower.add(sign);
{
  const b = mesh(new THREE.BoxGeometry(7.2, 1.8, 0.2), signMat); b.position.y = 1.0; sign.add(b);
  for (const x of [-2.5, 2.5]) { const l = box(0.12, 0.8, 0.12, mat.steelDark); l.position.set(x, -0.1, -0.05); sign.add(l); }
  sign.position.set(0, TOWER_H + 0.3, 0.6);
}
function drawSign(on) {
  const c = signCanvas.getContext('2d');
  c.fillStyle = '#14122a'; c.fillRect(0, 0, 1024, 256);
  c.strokeStyle = on > 0.5 ? '#ff4fd8' : '#553355'; c.lineWidth = 10; c.strokeRect(14, 14, 996, 228);
  c.font = '120px "Luckiest Guy"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#ffde59'; c.shadowBlur = on * 30;
  c.fillStyle = on > 0.5 ? '#ffe46b' : '#5a5040';
  c.fillText('CAR VENDING', 512, 138);
  signTex.needsUpdate = true;
}
let signState = -1;

// keypad pillar
const kpCanvas = document.createElement('canvas'); kpCanvas.width = 512; kpCanvas.height = 1024;
const kpTex = new THREE.CanvasTexture(kpCanvas); kpTex.colorSpace = THREE.SRGBColorSpace;
const keypad = new THREE.Group(); scene.add(keypad);
{
  const body = box(1.3, 2.5, 0.6, M(0x2b2f3a, { metalness: 0.5, roughness: 0.4 }), 0.08); body.position.y = 1.25; keypad.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), new THREE.MeshStandardMaterial({ map: kpTex, emissiveMap: kpTex, emissive: 0xffffff, emissiveIntensity: 0.65, roughness: 0.4 }));
  face.position.set(0, 1.3, 0.305); keypad.add(face);
  const top = box(1.42, 0.12, 0.7, mat.yellow); top.position.y = 2.55; keypad.add(top);
  keypad.position.set(4.9, -3, 3.4); keypad.rotation.y = -0.35;
}
const KEYS = ['A', 'B', 'C', '1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0', 'OK'];
let kpState = '';
function drawKeypad(disp, dispColor, pressed) {
  const key = disp + '|' + dispColor + '|' + pressed;
  if (key === kpState) return; kpState = key;
  const c = kpCanvas.getContext('2d');
  c.fillStyle = '#1d212b'; c.fillRect(0, 0, 512, 1024);
  c.fillStyle = '#071a12'; c.beginPath(); c.roundRect(36, 40, 440, 190, 24); c.fill();
  c.strokeStyle = '#4ef0a0'; c.lineWidth = 6; c.stroke();
  c.font = '130px "Luckiest Guy"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = dispColor; c.shadowColor = dispColor; c.shadowBlur = 25; c.fillText(disp, 256, 145); c.shadowBlur = 0;
  KEYS.forEach((k, i) => {
    const x = 50 + (i % 3) * 142, y = 270 + Math.floor(i / 3) * 145;
    const on = k === pressed;
    c.fillStyle = on ? '#ffd23f' : (k === 'OK' ? '#2ec27e' : (k === '<' ? '#ef476f' : '#e8edf5'));
    c.beginPath(); c.roundRect(x, y, 128, 128, 22); c.fill();
    c.fillStyle = on ? '#3a2600' : '#1d212b'; c.font = (k.length > 1 ? 54 : 70) + 'px "Luckiest Guy"'; c.fillText(k, x + 64, y + 72);
  });
  kpTex.needsUpdate = true;
}

// ---------------------------------------------------------------- owner character
function makeOwner() {
  const g = new THREE.Group();
  const root = new THREE.Group(); g.add(root);
  const P = {};
  const torso = mesh(new THREE.CapsuleGeometry(0.33, 0.42, 6, 16), mat.shirt); torso.position.y = 1.3; root.add(torso);
  const belt = mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.1, 18), mat.black); belt.position.y = 0.98; root.add(belt);
  const head = new THREE.Group(); head.position.y = 1.98; root.add(head); P.head = head;
  head.add(mesh(new THREE.SphereGeometry(0.34, 24, 18), mat.skin));
  const hair = mesh(new THREE.SphereGeometry(0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mat.hair); hair.position.y = 0.04; hair.rotation.x = -0.25; head.add(hair);
  const nose = mesh(new THREE.SphereGeometry(0.07, 12, 10), mat.skin); nose.position.set(0, -0.02, 0.34); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.08, 10, 8), mat.skin); ear.position.set(s * 0.33, 0, 0); head.add(ear);
    const eye = mesh(new THREE.SphereGeometry(0.085, 14, 12), mat.eyeW, false); eye.position.set(s * 0.13, 0.07, 0.28); head.add(eye);
    const pu = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat.pupil, false); pu.position.set(s * 0.13, 0.07, 0.355); head.add(pu); (P.pupils ||= []).push(pu);
    const brow = mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), mat.hair, false); brow.position.set(s * 0.13, 0.19, 0.31); head.add(brow); (P.brows ||= []).push(brow);
  }
  const smile = mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 16, Math.PI), mat.mouth, false); smile.rotation.z = Math.PI; smile.position.set(0, -0.12, 0.31); head.add(smile); P.smile = smile;
  const oh = mesh(new THREE.SphereGeometry(0.065, 12, 10), mat.mouth, false); oh.scale.set(1, 1.3, 0.5); oh.position.set(0, -0.14, 0.31); head.add(oh); P.oh = oh;
  P.arms = []; P.fore = [];
  for (const s of [1, -1]) { // s=+1 left (+x), -1 right
    const sh = new THREE.Group(); sh.position.set(s * 0.42, 1.6, 0); root.add(sh);
    const up = mesh(new THREE.CapsuleGeometry(0.095, 0.3, 4, 10), mat.shirt); up.position.y = -0.2; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.4; sh.add(el);
    const lo = mesh(new THREE.CapsuleGeometry(0.085, 0.25, 4, 10), mat.skin); lo.position.y = -0.16; el.add(lo);
    const hand = mesh(new THREE.SphereGeometry(0.11, 12, 10), mat.skin); hand.position.y = -0.36; el.add(hand);
    P.arms.push(sh); P.fore.push(el);
  }
  P.legs = [];
  for (const s of [1, -1]) {
    const hp = new THREE.Group(); hp.position.set(s * 0.16, 0.95, 0); root.add(hp);
    const leg = mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 10), mat.pants); leg.position.y = -0.42; hp.add(leg);
    const shoe = box(0.22, 0.14, 0.38, mat.shoe, 0.05); shoe.position.set(0, -0.86, 0.08); hp.add(shoe);
    P.legs.push(hp);
  }
  g.userData = { root, P };
  scene.add(g);
  return g;
}
const owner = makeOwner();
// pose: {aL:[x,z], aR:[x,z], eL, eR (elbow bend), lL, lR (hip x), hx, hy, hz, bob, mouth:'smile'|'oh', brow}
function applyPose(p) {
  const { root, P } = owner.userData;
  const d = { aL: [0, 0.12], aR: [0, 0.12], eL: 0, eR: 0, lL: 0, lR: 0, hx: 0, hy: 0, hz: 0, bob: 0, lean: 0, mouth: 'smile', brow: 0, look: [0, 0], ...p };
  P.arms[0].rotation.set(d.aL[0], 0, d.aL[1]);
  P.arms[1].rotation.set(d.aR[0], 0, -d.aR[1]);
  P.fore[0].rotation.x = -d.eL; P.fore[1].rotation.x = -d.eR;
  P.legs[0].rotation.x = d.lL; P.legs[1].rotation.x = d.lR;
  P.head.rotation.set(d.hx, d.hy, d.hz);
  root.position.y = d.bob; root.rotation.x = d.lean;
  P.smile.visible = d.mouth === 'smile'; P.oh.visible = d.mouth === 'oh';
  P.brows.forEach((b, i) => { b.position.y = 0.19 + d.brow * 0.04; b.rotation.z = (i ? -1 : 1) * d.brow * 0.3; });
  P.pupils.forEach((pu, i) => { pu.position.x = (i ? 1 : -1) * 0.13 + d.look[0] * 0.03; pu.position.y = 0.07 + d.look[1] * 0.03; });
}

// ---------------------------------------------------------------- birds & nests
const birds = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const col = [0x4ea8de, 0xff6b6b, 0xffd166, 0x9b5de5, 0x2ec4b6][i];
  const bm = M(col, { roughness: 0.6 });
  const b = mesh(new THREE.SphereGeometry(0.22, 14, 10), bm); b.scale.set(1, 0.85, 1.3); g.add(b);
  const h = mesh(new THREE.SphereGeometry(0.15, 12, 10), bm); h.position.set(0, 0.17, 0.22); g.add(h);
  const bk = mesh(new THREE.ConeGeometry(0.05, 0.14, 8), M(0xff9f1c)); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.15, 0.4); g.add(bk);
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.035, 8, 6), mat.pupil, false); e.position.set(s * 0.08, 0.22, 0.33); g.add(e); }
  const wings = [];
  for (const s of [-1, 1]) { const wp = new THREE.Group(); wp.position.set(s * 0.15, 0.06, 0); const w = mesh(new THREE.BoxGeometry(0.42, 0.04, 0.26), bm); w.position.x = s * 0.21; wp.add(w); g.add(wp); wings.push(wp); }
  const tail = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.22), bm); tail.position.set(0, 0.05, -0.33); tail.rotation.x = 0.4; g.add(tail);
  g.userData = { wings };
  g.scale.setScalar(1.25);
  scene.add(g); birds.push(g);
}
const NEST_CARS = [16, 17, 18, 14, 15];
const nests = NEST_CARS.map(() => {
  const g = new THREE.Group();
  const n = mesh(new THREE.TorusGeometry(0.26, 0.11, 8, 18), mat.nest); n.rotation.x = Math.PI / 2; g.add(n);
  const f = mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.08, 14), mat.nest); f.position.y = -0.04; g.add(f);
  for (let e = 0; e < 3; e++) { const egg = mesh(new THREE.SphereGeometry(0.07, 10, 8), mat.egg); egg.scale.y = 1.3; egg.position.set(Math.cos(e * 2.1) * 0.09, 0.03, Math.sin(e * 2.1) * 0.09); g.add(egg); }
  scene.add(g); return g;
});

// ---------------------------------------------------------------- timeline helpers
const T = window.TL || {};
function wordT(seg, idx) { const s = SEG[seg]; return s ? s.words[Math.min(idx, s.words.length - 1)].s : 0; }

// state functions -------------------------------------------------------------
function towerState(t) {
  let y = 0, rz = 0;
  const sink = eio(st(12.3, 13.9, t));
  y = -1.7 * sink; rz = 0.045 * sink + Math.sin(t * 9) * 0.004 * sink * (1 - st(14.4, 14.8, t));
  const up = eio(st(15.0, 15.8, t)); y = lerp(y, 2.3, up); rz = lerp(rz, 0, up);
  const down = st(17.35, 17.95, t); if (down > 0) y = lerp(2.3, 0, bounce(down));
  // kick shake
  const k = st(59.42, 60.1, t); if (k > 0 && k < 1) rz += Math.sin(k * 40) * 0.012 * (1 - k);
  return { y, rz };
}
function liftY(t) {
  // climbs to top for the favourite, comes down, later B7 trip
  const top = FLOOR_Y(9), f7 = FLOOR_Y(6);
  let y = 0.1;
  if (t < 29.4) return 0.1;
  if (t < 31.1) return lerp(0.1, top, eio(st(29.4, 31.1, t)));
  if (t < 33.55) return top;
  if (t < 34.6) return lerp(top, 0.1, eio(st(33.55, 34.6, t)));
  if (t < 51.45) return 0.1;
  if (t < 52.15) return lerp(0.1, f7, eio(st(51.45, 52.15, t)));
  if (t < 52.6) return f7;
  if (t < 59.5) return lerp(f7, f7 - 0.9, eo(st(52.6, 53.3, t)));  // jams
  if (t < 59.8) return f7 - 0.9;
  return lerp(f7 - 0.9, 0.1, eio(st(59.8, 60.45, t)));
}
function turnAngle(t) { return Math.PI * eio(st(37.85, 38.85, t)) + Math.PI * eio(st(60.4, 60.9, t)); }
function nightAmt(t) { return eio(st(44.1, 44.9, t)); }
function clampAmt(k, t) {
  const fl = k >> 1;
  let a = eob(st(23.35 + fl * 0.05 + (k & 1) * 0.03, 23.85 + fl * 0.05 + (k & 1) * 0.03, t));
  if (k === WINDY) a = eob(st(23.35, 23.8, t));
  if (k === FAV) a *= 1 - st(31.15, 31.4, t);
  if (k === B7) a *= 1 - st(51.9, 52.1, t);
  return a;
}

const tmpV = new THREE.Vector3();
function placeCars(t) {
  tower.updateMatrixWorld(true);
  const ts = towerState(t);
  for (let k = 0; k < 20; k++) {
    const car = cars[k], ud = car.userData;
    const p = pileOf[k], ps = pileSlot[p], j = pileJit[p];
    // pile transform with crush
    const crush = eo(st(6.35, 6.6, t)) * (1 - st(8.4, 8.8, t));
    const rowS = (r) => 1 - crush * [0.48, 0.28, 0.12, 0.04, 0][r];
    let py = 0; for (let r = 0; r < ps.r; r++) py += 0.98 * rowS(r);
    const px = (ps.j - (ps.n - 1) / 2) * 1.12 + j.dx;
    const pileP = V3(px, py, PILE_Z + (ps.r % 2) * 0.12);
    // drop in
    const td = 0.3 + p * 0.17;
    const dropU = st(td, td + 0.42, t);
    const dropY = (1 - bounce(dropU)) * 9;
    let pos = pileP.clone(); pos.y += dropY;
    let ry = j.ry, rz = j.rz * (1 - crush * 0.3), rx = 0, sy = rowS(ps.r), sx = 1 + (1 - sy) * 0.35;
    car.visible = t >= td - 0.01 || t > 8;
    // fly to the shelf
    const fo = 19 - p; // top of pile flies first
    const tf = 8.65 + fo * 0.08;
    const fu = eio(st(tf, tf + 0.7, t));
    const slotW = tower.localToWorld(slotLocal(k).clone());
    if (fu > 0) {
      pos.lerpVectors(pileP, slotW, fu); pos.y += Math.sin(fu * Math.PI) * 2.5;
      ry = lerp(j.ry, Math.PI * (j.ry > 1.5 ? 1 : 1), fu); rz = lerp(rz, 0, fu); sy = lerp(sy, 1, Math.min(1, fu * 3)); sx = lerp(sx, 1, Math.min(1, fu * 3));
      rx = Math.sin(fu * Math.PI) * 0.3;
    }
    let onShelf = fu >= 1;
    let spin = 0;
    if (onShelf) { pos.copy(slotW); ry = Math.PI; rz = ts.rz; }
    // wind car
    if (k === WINDY && onShelf) {
      const roll = eio(st(20.1, 21.0, t)) * 0.95 - eio(st(22.0, 22.6, t)) * 0.95;
      const teeter = st(20.9, 21.1, t) * (1 - st(21.9, 22.05, t));
      pos.z += roll; rx = teeter * (0.06 + Math.sin(t * 14) * 0.05);
      spin = roll / 0.21;
    }
    // favourite car: pulled onto the lift, down, turned, drives away
    if (k === FAV && t > 31.3) {
      const pull = eio(st(31.4, 32.9, t));
      const ly = liftY(t);
      const onLift = tower.localToWorld(V3(0, ly + 0.08, 0));
      pos.lerpVectors(slotW, onLift, pull); if (pull >= 1) pos.copy(onLift);
      spin = -pull * 2.4 / 0.21;
      if (t > 34.6) { pos.copy(tower.localToWorld(V3(0, 0.1, 0))); ry = Math.PI + turnAngle(t); }
      const drive = st(39.0, 41.2, t);
      if (drive > 0) { pos.z += ei(drive) * 16; spin = ei(drive) * 16 / 0.21; }
      if (t > 41.2) car.visible = false;
    }
    // B7: pulled, jams half on the lift, kick, drops, rides down
    if (k === B7 && t > 52.0) {
      const pull = eio(st(52.05, 52.6, t)) * 0.55;
      const ly = liftY(t);
      const hang = eo(st(52.6, 53.3, t));
      const xl = lerp(2.4, 0, pull);
      pos.copy(tower.localToWorld(V3(xl - hang * 0.15, FLOOR_Y(6) + 0.05 - hang * 0.48, 0)));
      rz = -hang * 0.42 + Math.sin(t * 3.1) * 0.02 * hang;
      spin = -pull * 2.4 / 0.21;
      const drop = st(59.48, 59.8, t);
      if (drop > 0) {
        const a = tower.localToWorld(V3(xl - 0.15, FLOOR_Y(6) - 0.43, 0));
        const b = tower.localToWorld(V3(0, ly + 0.08, 0));
        pos.lerpVectors(a, b, bounce(drop)); rz = lerp(-0.42, 0, bounce(drop));
      }
      if (t >= 59.8) { pos.copy(tower.localToWorld(V3(0, ly + 0.08, 0))); rz = 0; }
      if (t > 60.4) { ry = Math.PI + (turnAngle(t) - Math.PI); }
      const roll = eio(st(60.9, 61.7, t)); if (roll > 0) { pos.z += roll * 3.2; spin = roll * 3.2 / 0.21; }
    }
    car.position.copy(pos);
    car.rotation.set(rx, ry, rz, 'ZYX');
    ud.body.scale.set(sx, sy, 1);
    ud.wheels.forEach((w) => { w.rotation.x = spin; w.position.y = 0.21 * sy; w.scale.set(1, Math.max(sy, 0.7), 1); w.position.x = Math.sign(w.position.x) * 0.5 * sx; });
    // lit at night, floor by floor
    const lit = st(45.0 + (k >> 1) * 0.12, 45.2 + (k >> 1) * 0.12, t);
    ud.paint.emissiveIntensity = 0.16 * lit;
  }
}

function placeTower(t) {
  const ts = towerState(t);
  tower.position.set(0, ts.y, 0); tower.rotation.z = ts.rz;
  const build = (a, b) => eob(st(a, b, t));
  cols.forEach((c, i) => { const u = eo(st(7.35 + (i % 4) * 0.08, 8.25 + (i % 4) * 0.08, t)); c.scale.y = Math.max(0.0001, TOWER_H * u); c.visible = u > 0; });
  rails.forEach((r) => { const u = eo(st(7.6, 8.4, t)); r.scale.y = Math.max(0.0001, TOWER_H * u); r.visible = u > 0; });
  shelves.forEach((s, i) => { const fl = i >> 1; const u = build(7.9 + fl * 0.09, 8.3 + fl * 0.09); s.scale.set(Math.max(0.001, u), 1, Math.max(0.001, u)); s.visible = u > 0; });
  beams.forEach((b, i) => { const fl = i >> 1; const u = eo(st(7.95 + fl * 0.09, 8.35 + fl * 0.09, t)); b.scale.x = Math.max(0.001, u); b.visible = u > 0; });
  braces.forEach((b, i) => { const u = st(8.3 + (i % 20) * 0.02, 8.6 + (i % 20) * 0.02, t); b.visible = u > 0; b.scale.y = Math.max(0.001, u); });
  roofCap.visible = t > 8.9; roofCap.scale.setScalar(Math.max(0.001, eob(st(8.9, 9.3, t))));
  lift.visible = t > 28.9; lift.position.y = liftY(t);
  lift.scale.setScalar(Math.max(0.001, eob(st(28.9, 29.35, t))));
  grabber.scale.x = Math.max(0.001, eo(st(31.15, 31.4, t)) * (1 - st(33.0, 33.3, t)) + eo(st(52.0, 52.2, t)) * (1 - st(59.8, 60.0, t)));
  turntable.visible = t > 36.3; turntable.scale.setScalar(Math.max(0.001, eob(st(36.3, 36.8, t)))); turntable.rotation.y = turnAngle(t);
  clamps.forEach((set, k) => { const a = clampAmt(k, t); set.forEach((p) => { p.visible = t > 23.0; p.rotation.z = p.userData.side * lerp(-Math.PI / 2, 0.15, a); }); });
  // glass
  glassPanels.forEach((g, i) => { const u = eo(st(42.6 + i * 0.25, 43.7 + i * 0.25, t)); g.visible = u > 0; g.scale.y = Math.max(0.001, u); });
  // LEDs
  leds.forEach((l, i) => { const fl = i >> 1; l.material.emissiveIntensity = 3.2 * st(45.0 + fl * 0.12, 45.2 + fl * 0.12, t); });
  // sign
  sign.visible = t > 61.9; sign.scale.setScalar(Math.max(0.001, eob(st(61.9, 62.4, t))));
  const on = t > 63.3 ? ((t > 63.42 && t < 63.5) ? 0.2 : 1) : 0;
  if (on !== signState) { drawSign(on); signState = on; }
  signMat.emissiveIntensity = on * 1.6 + 0.25;
}

function placeGround(t) {
  patch.visible = t < 15.25;
  pit.visible = !patch.visible;
  const fill = eio(st(15.9, 17.35, t));
  concrete.visible = fill > 0;
  const h = Math.max(0.01, fill * PIT);
  concrete.scale.y = h; concrete.position.y = -PIT + h / 2;
  pour.visible = t > 15.75 && t < 17.45;
  const topY = 7.2, bot = -PIT + h;
  pour.scale.set(1 + Math.sin(t * 30) * 0.06, topY - bot, 1); pour.position.set(-3.1, (topY + bot) / 2, 1.6);
  chute.visible = t > 15.6 && t < 17.7; chute.position.set(-3.1, 7.6 + (1 - eo(st(15.6, 15.9, t))) * 6 + st(17.45, 17.7, t) * 8, 2.2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < DIRT_N; i++) {
    const d = dirtV[i], u = t - d.t0;
    if (u < 0 || u > 1.4) { m.makeScale(0, 0, 0); }
    else {
      const x = d.x + d.vx * u, z = d.z + d.vz * u, y = -1 + d.vy * u - 9.8 * u * u / 2;
      q.setFromEuler(new THREE.Euler(u * 5 + i, u * 3, 0));
      m.compose(V3(x, Math.max(0.05, y), z), q, V3(d.s, d.s, d.s).multiplyScalar(1 - st(1.1, 1.4, u)));
    }
    dirt.setMatrixAt(i, m);
  }
  dirt.instanceMatrix.needsUpdate = true;
  dirt.visible = t > 15.2 && t < 17;
  // keypad rises
  const kp = eob(st(48.95, 49.6, t));
  keypad.position.y = lerp(-3, 0, kp); keypad.visible = t > 48.9;
  // keypad display
  let disp = '', col = '#4ef0a0', pressed = '';
  if (t > 50.78) disp = 'B'; if (t > 50.78 && t < 50.98) pressed = 'B';
  if (t > 51.08) disp = 'B7'; if (t > 51.08 && t < 51.28) pressed = '7';
  if (t > 51.3 && t < 51.5) pressed = 'OK';
  if (t > 51.3) disp = 'B7 ✓';
  if (t > 53.3 && t < 59.5) { disp = (Math.floor(t * 3) % 2) ? 'ERROR' : 'ERR!'; col = '#ff4d5e'; }
  if (t > 59.6) { disp = 'B7 ✓'; col = '#4ef0a0'; }
  drawKeypad(disp, col, pressed);
}

function placeEnv(t) {
  const n = nightAmt(t);
  skyU.night.value = n;
  moon.material.opacity = n;
  sun.intensity = lerp(2.6, 0.35, n); sun.color.setHex(n > 0.5 ? 0x9fb4ff : 0xfff2dc);
  hemi.intensity = lerp(1.1, 0.35, n); hemi.color.setHex(n > 0.5 ? 0x6677bb : 0xcfe8ff);
  fill.intensity = lerp(0.5, 0.25, n);
  scene.environmentIntensity = lerp(0.55, 0.22, n);
  towerGlow.intensity = 60 * st(45.0, 46.2, t);
  mat.win.emissiveIntensity = 1.4 * n;
  mat.lamp.emissiveIntensity = 2.5 * n;
  mat.stripe.emissiveIntensity = 0.6 * n;
  renderer.toneMappingExposure = lerp(1.05, 1.25, n);
  // wind
  const wind = st(18.7, 19.2, t) * (1 - st(21.4, 22.0, t));
  trees.forEach((tr) => { tr.userData.top.rotation.z = -wind * (0.25 + Math.sin(t * 6 + tr.userData.ph) * 0.08) + Math.sin(t * 0.8 + tr.userData.ph) * 0.02; tr.rotation.z = -wind * 0.05; });
  clouds.forEach((c) => { c.position.x = c.userData.x0 + t * c.userData.sp + wind * 0; });
}

function placeOwner(t) {
  const P = (x, z) => V3(x, 0, z);
  let pos = P(3.4, 7.6), ry = -2.6, pose = {};
  const sw = (f, a) => Math.sin(t * f) * a;
  const walk = (a, b, t0, t1) => { const u = st(t0, t1, t); pos = a.clone().lerp(b, eio(u)); const moving = u > 0 && u < 1; const ph = Math.sin(t * 11) * (moving ? 0.55 : 0); pose = { ...pose, lL: ph, lR: -ph, aL: [-ph * 0.7, 0.1], aR: [ph * 0.7, 0.1], bob: moving ? Math.abs(Math.cos(t * 11)) * 0.05 : 0 }; ry = moving ? Math.atan2(b.x - a.x, b.z - a.z) : ry; return moving; };
  if (t < 4.5) { // proud presenter
    pos = P(3.4, 7.6); ry = 0.1;
    const u = st(1.0, 1.5, t);
    pose = { aL: [-0.4 * u, 0.4 + 0.9 * u], aR: [-0.4 * u, 0.4 + 0.9 * u], eL: 0.2, eR: 0.2, bob: sw(5, 0.02), hy: sw(1.5, 0.15) };
  } else if (t < 7.25) { // hands on head when crushed
    pos = P(3.3, 7.4); ry = -2.55;
    const u = eo(st(6.4, 6.7, t));
    pose = { aL: [-2.4 * u, 0.5], aR: [-2.4 * u, 0.5], eL: 1.9 * u, eR: 1.9 * u, mouth: u > 0.3 ? 'oh' : 'smile', brow: u, lean: -0.08 * u, bob: u * sw(30, 0.015) };
  } else if (t < 11.0) { // watches tower go up
    pos = P(5.0, 7.3); ry = -2.6;
    pose = { hx: -0.45 * st(7.5, 8.5, t), aR: [-0.3, 0.3], aL: [-1.2, 0.2], eL: 1.2, mouth: 'smile', look: [0, 1] };
  } else if (t < 14.5) { // panic
    pos = P(4.3, 2.8); ry = -2.3;
    const j = Math.abs(Math.sin(t * 9)) * 0.25 * st(12.4, 12.6, t);
    pose = { bob: j, aL: [-2.6, 0.9], aR: [-2.6, 0.9], eL: 0.4, eR: 0.4, mouth: 'oh', brow: 1, lL: -j, lR: j };
  } else if (t < 18.1) {
    pos = P(5.8, 4.0); ry = -2.2;
    pose = { aR: [-1.5, 0.4 + sw(6, 0.2)], aL: [0, 0.3], hx: 0.3, mouth: 'oh' };
  } else if (t < 25.5) { // hidden behind (far)
    pos = P(6.2, 6.5); ry = -2.4; pose = { aL: [-0.3, 1.0], aR: [-0.3, 1.0], hx: -0.4, mouth: t > 23.4 ? 'smile' : 'oh' };
  } else if (t < 28.75) { // looks up at favourite, shrug
    pos = P(1.6, 3.8); ry = Math.PI + 0.25;
    const s = eo(st(27.75, 28.1, t));
    pose = { hx: -0.6, look: [0, 1], aL: [-0.6 * s, 0.25 + 0.8 * s], aR: [-0.6 * s, 0.25 + 0.8 * s], eL: 1.4 * s, eR: 1.4 * s, mouth: s > 0.5 ? 'oh' : 'smile', brow: s, bob: sw(4, 0.01) };
  } else if (t < 33.5) {
    pos = P(2.6, 4.6); ry = Math.PI + 0.45;
    pose = { hx: -0.7 * (1 - st(32.5, 33.4, t)) + 0.0, aR: [-2.8 * st(30.3, 30.8, t), 0.2], look: [0, 1] };
  } else if (t < 35.85) { // confused – scratches head
    pos = P(2.3, 2.6); ry = -0.4;
    pose = { aR: [-2.5, 0.6], eR: 1.8 + sw(14, 0.25), hz: 0.18, mouth: 'oh', brow: 1, look: [-1, 0] };
  } else if (t < 39.15) { // thumbs up as it turns
    pos = P(2.0, 2.3); ry = 0.5;
    const u = eo(st(38.6, 38.9, t));
    pose = { aL: [-1.4 * u, 0.3], eL: 1.2 * u, bob: u * Math.abs(sw(8, 0.06)), mouth: 'smile' };
    if (t > 38.9) { pose.hy = -0.6 * st(38.9, 39.15, t); }
  } else if (t < 46.35) {
    pos = P(5.6, 7.5); ry = -2.7; pose = { hx: -0.4, mouth: 'smile', aL: [-0.2, 0.3], aR: [-0.2, 0.3] };
  } else if (t < 48.55) { // which car is where?
    pos = P(1.9, 4.6); ry = Math.PI + 0.3;
    pose = { hx: -0.45, hz: sw(2.2, 0.2), aR: [-2.5, 0.6], eR: 1.8 + sw(14, 0.25), mouth: 'oh', brow: 1, look: [sw(2.2, 1), 1] };
  } else if (t < 57.35) { // at the keypad
    pos = P(3.75, 4.45); ry = 2.35;
    const press = Math.max(Math.exp(-Math.pow((t - 50.85) / 0.08, 2)), Math.exp(-Math.pow((t - 51.15) / 0.08, 2)), Math.exp(-Math.pow((t - 51.4) / 0.08, 2)));
    const reach = st(50.3, 50.7, t) * (1 - st(51.6, 51.9, t));
    pose = { aR: [-1.35 * reach - press * 0.2, 0.3 * reach], eR: 0.25 - press * 0.15, hx: 0.1, mouth: 'smile' };
    if (t > 51.9) { pose = { hx: -0.5, look: [0, 1], mouth: t > 53.4 ? 'oh' : 'smile', brow: st(53.4, 53.8, t), aL: [-0.2, 0.3], aR: [-0.2, 0.3] }; ry = Math.PI + 0.3; }
    if (t > 55.0) { const u = eo(st(55.0, 55.3, t)); pose.aL = [-0.3, 0.3 + 0.9 * u]; pose.aR = [-0.3, 0.3 + 0.9 * u]; pose.eL = 1.0 * u; pose.eR = 1.0 * u; }
  } else if (t < 59.0) { // walks to the tower, rolls up sleeves
    const mv = walk(P(3.75, 4.45), P(1.2, 2.45), 57.4, 58.6);
    if (!mv && t > 58.6) { ry = Math.PI + 0.1; const r = Math.sin(t * 16); pose = { aL: [-1.3, 0.3], aR: [-1.3, 0.3], eL: 1.6 + r * 0.3, eR: 1.6 - r * 0.3, brow: -1, mouth: 'smile', hx: -0.2 }; }
  } else if (t < 60.65) { // the kick
    pos = P(1.2, 2.45); ry = Math.PI + 0.1;
    const wind = eo(st(59.05, 59.3, t)), kick = st(59.3, 59.45, t), back = st(59.6, 60.0, t);
    const leg = lerp(lerp(0, 0.9, wind), -1.4, eob(kick)) * (1 - back);
    pose = { lR: leg, aL: [0.6 * wind - 0.8 * kick, 0.6], aR: [-0.8 * wind, 0.6], lean: -0.15 * kick, mouth: kick > 0 ? 'oh' : 'smile', brow: -1 * (1 - back), bob: 0.05 * kick * (1 - back) };
    if (t > 59.75) { pose.hx = -0.6; pose.look = [0, 1]; }
  } else { // celebrate
    pos = P(1.8, 2.1); ry = 0.5;
    const j = Math.abs(Math.sin((t - 60.65) * 7)) * 0.4 * (1 - st(63.0, 63.5, t));
    pose = { bob: j, aL: [-2.8, 0.5], aR: [-2.8, 0.5], lL: -j * 0.6, lR: -j * 0.6, mouth: 'oh', hx: -0.2 };
    if (t > 63.5) pose = { aL: [-0.3, 1.3], aR: [-0.3, 1.3], eL: 0.3, eR: 0.3, mouth: 'smile', hx: -0.35, bob: sw(4, 0.02) };
  }
  owner.position.copy(pos); owner.rotation.y = ry;
  applyPose(pose);
}

function placeBirds(t) {
  const roofW = (k) => { const c = cars[k]; return V3(c.position.x, c.position.y + 1.04, c.position.z - 0.12); };
  birds.forEach((b, i) => {
    const land = roofW(NEST_CARS[i]).add(V3(0.22, 0.08, 0.15));
    const t0 = 39.25 + i * 0.12, t1 = t0 + 0.9;
    const start = V3(-14 + i * 1.5, 16 + i * 0.6, 8 - i);
    const leave = V3(-18 + i * 3, 24, 12);
    let p, flap;
    if (t < t0 || t > 43.6 || (t > 41.8 && t < 42.55 + i * 0.05)) { /* positioned below */ }
    if (t < t1) { const u = eio(st(t0, t1, t)); p = start.clone().lerp(land, u); p.y += Math.sin(u * Math.PI) * 1.5; flap = 1; }
    else if (t < 42.6 + i * 0.08) { p = land.clone(); p.y += Math.abs(Math.sin(t * 6 + i)) * 0.08 * (t < 41 ? 1 : 0.3); flap = 0; b.rotation.y = Math.sin(t * 2 + i) * 0.6; }
    else { const u = ei(st(42.6 + i * 0.08, 43.9 + i * 0.08, t)); p = land.clone().lerp(leave, u); flap = 1; }
    b.visible = t > t0 && t < 44.2;
    b.position.copy(p);
    if (flap) b.lookAt(t < t1 ? land : leave);
    const a = flap ? Math.sin(t * 38 + i) * 0.9 : 0.15;
    b.userData.wings[0].rotation.z = a; b.userData.wings[1].rotation.z = -a;
  });
  nests.forEach((n, i) => {
    const s = eob(st(40.15 + i * 0.12, 40.5 + i * 0.12, t));
    n.visible = s > 0;
    const c = cars[NEST_CARS[i]];
    n.position.set(c.position.x - 0.1, c.position.y + 1.06, c.position.z - 0.1);
    n.scale.setScalar(Math.max(0.001, s));
  });
}

// ---------------------------------------------------------------- camera shots
function shake(t) {
  let s = 0;
  for (const [t0, a, d] of [[6.45, 0.12, 0.5], [12.5, 0.05, 1.6], [17.6, 0.1, 0.5], [59.45, 0.22, 0.6], [59.85, 0.08, 0.6], [1.2, 0.02, 3]]) {
    const u = (t - t0) / d; if (u > 0 && u < 1) s += a * (1 - u) * (1 - u);
  }
  return s;
}
const lift3 = (t) => liftY(t);
const SHOTS = [
  [0.0, 4.48, (u, t) => ({ p: V3(lerp(9, 4.8, eio(u)), lerp(15, 4.6, eio(u)), lerp(24, 13.6, eio(u))), g: V3(0, lerp(1.0, 1.9, u), lerp(2.5, 4.8, u)), f: 52 })],
  [4.48, 7.25, (u, t) => ({ p: V3(lerp(3.0, 2.0, eio(u)), lerp(3.6, 2.6, eio(u)), lerp(15.5, 13.2, eio(u))), g: V3(0, lerp(2.0, 1.6, u), PILE_Z), f: 50 })],
  [7.25, 11.02, (u, t) => ({ p: V3(lerp(-9, 8, eio(u)), lerp(1.0, 1.6, u), lerp(15.5, 15.5, u) - Math.sin(u * Math.PI) * 1.5), g: V3(0, lerp(5.2, 6.6, u), 1.2), f: 54 })],
  [11.02, 14.5, (u, t) => ({ p: V3(lerp(10.5, 8.6, eio(u)), lerp(1.3, 0.75, u), lerp(9, 7.4, eio(u))), g: V3(0, lerp(3.4, 2.4, u), 0.6), f: 56 })],
  [14.5, 18.12, (u, t) => ({ p: V3(lerp(9.5, 7.5, eio(u)), lerp(10.5, 8.0, eio(u)), lerp(14.0, 12.0, eio(u))), g: V3(0, lerp(1.5, 2.5, u), 0), f: 52 })],
  [18.12, 21.74, (u, t) => ({ p: V3(lerp(6.6, 5.6, u), lerp(7.0, 6.5, u), lerp(8.6, 7.4, u)), g: V3(2.3, 5.75, 0.6), f: 46 })],
  [21.74, 25.52, (u, t) => ({ p: V3(lerp(6.2, 5.3, eio(u)), lerp(7.2, 6.8, u), lerp(6.6, 5.2, eio(u))), g: V3(2.4, 5.5, 0.3), f: 44 })],
  [25.52, 28.73, (u, t) => ({ p: V3(lerp(2.4, 2.1, u), lerp(1.2, 0.8, u), lerp(6.5, 5.6, u)), g: V3(2.0, lerp(9.0, 10.6, eio(u)), 0), f: 62 })],
  [28.73, 31.1, (u, t) => { const y = lift3(t); return { p: V3(4.2, y + 2.2, 8.8), g: V3(0.3, y + 0.8, 0), f: 50 }; }],
  [31.1, 33.47, (u, t) => ({ p: V3(lerp(4.6, 3.8, u), FLOOR_Y(9) + 1.7, lerp(6.4, 5.4, u)), g: V3(lerp(2.0, 0.6, eio(u)), FLOOR_Y(9) + 0.4, 0), f: 48 })],
  [33.47, 35.86, (u, t) => ({ p: V3(lerp(1.4, 1.0, u), lerp(2.0, 1.25, eio(st(0, 0.45, u))), lerp(6.4, 5.4, u)), g: V3(-0.1, lerp(4.0, 1.2, eio(st(0, 0.45, u))), -8), f: 50 })],
  [35.86, 39.18, (u, t) => ({ p: V3(lerp(4.4, 3.2, u), lerp(4.6, 3.6, u), lerp(6.6, 6.4, u)), g: V3(0, 0.5, 0.6), f: 50 })],
  [39.18, 41.82, (u, t) => ({ p: V3(lerp(-6.0, -4.6, u), lerp(14.6, 13.8, u), lerp(8.2, 7.2, u)), g: V3(-0.4, 11.2, 0), f: 50 })],
  [41.82, 46.36, (u, t) => ({ p: V3(lerp(-3, 2.5, eio(u)), lerp(3.2, 4.6, eio(u)), lerp(22.5, 21, eio(u))), g: V3(0, 6.8, 0), f: 46 })],
  [46.36, 48.57, (u, t) => ({ p: V3(lerp(3.4, 2.9, u), lerp(1.6, 1.5, u), lerp(8.8, 8.0, u)), g: V3(-0.2, 5.8, 0), f: 56 })],
  [48.57, 50.58, (u, t) => ({ p: V3(lerp(7.4, 6.6, eio(u)), lerp(2.2, 2.0, u), lerp(8.6, 7.4, eio(u))), g: V3(4.8, 1.5, 3.4), f: 48 })],
  [50.58, 51.42, (u, t) => ({ p: V3(lerp(4.5, 4.35, u), 1.95, lerp(5.8, 5.6, u)), g: V3(4.82, 1.75, 3.45), f: 40 })],
  [51.42, 53.22, (u, t) => ({ p: V3(lerp(6.5, 5.8, u), lerp(7.0, 7.6, u), lerp(10.5, 9.6, u)), g: V3(1.2, lerp(5.0, 7.0, eio(u)), 0), f: 52 })],
  [53.22, 57.37, (u, t) => ({ p: V3(lerp(5.0, 4.4, u), lerp(7.8, 7.3, u), lerp(6.2, 5.6, u)), g: V3(1.4, 7.4, 0), f: 46, r: 0.06 })],
  [57.37, 59.02, (u, t) => ({ p: V3(lerp(4.0, 3.2, u), 0.9, lerp(8.6, 7.4, u)), g: V3(1.6, 1.6, 1.4), f: 52 })],
  [59.02, 59.76, (u, t) => ({ p: V3(4.4, 1.0, 4.1), g: V3(1.0, 1.0, 1.9), f: 50 })],
  [59.76, 60.68, (u, t) => ({ p: V3(5.5, 5.4, 11.5), g: V3(0.5, lerp(5.6, 2.5, eio(u)), 0), f: 54 })],
  [60.68, 61.84, (u, t) => ({ p: V3(lerp(4.0, 3.5, u), 2.0, lerp(9.6, 8.8, u)), g: V3(0.6, 1.4, 1.6), f: 52 })],
  [61.84, 66.5, (u, t) => { const e = eio(st(0, 0.7, u)); return { p: V3(lerp(3.0, 0.0, e), lerp(1.8, 5.0, e), lerp(9, 27.5, e)), g: V3(0, lerp(1.6, 7.6, e), 0), f: 48 }; }],
];
function placeCamera(t) {
  let s = SHOTS.find((x) => t >= x[0] && t < x[1]) || SHOTS[SHOTS.length - 1];
  const u = cl((t - s[0]) / (s[1] - s[0]));
  const c = s[2](u, t);
  const sk = shake(t);
  const hand = V3(Math.sin(t * 1.3) * 0.04 + Math.sin(t * 31) * sk, Math.sin(t * 1.7) * 0.03 + Math.sin(t * 27 + 1) * sk, 0);
  camera.position.copy(c.p).add(hand);
  camera.fov = c.f; camera.updateProjectionMatrix();
  camera.up.set(Math.sin(c.r || 0), Math.cos(c.r || 0), 0);
  camera.lookAt(c.g);
  return s;
}

// ---------------------------------------------------------------- 2D overlay
function scr(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, ok: p.z < 1 }; }
function outlineText(txt, x, y, size, fill, stroke = '#141414', sw = 0.16, font = 'Luckiest Guy') {
  ctx.font = `${size}px "${font}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = size * sw; ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y + size * 0.06);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y + size * 0.06);
}
function burst(x, y, r, text, col, age, rot = -0.12) {
  if (age < 0 || age > 1.1) return;
  const s = eob(cl(age / 0.22)) * (1 - st(0.85, 1.1, age));
  if (s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath();
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, rr = i % 2 ? r * 0.72 : r; ctx.lineTo(Math.cos(a) * rr * 1.3, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#141414'; ctx.stroke();
  outlineText(text, 0, 0, r * 0.62, '#ffffff');
  ctx.restore();
}
function pop(age, d = 0.25) { return eob(cl(age / d)); }
function arrow(x0, y0, x1, y1, col, w = 14, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * w * 1.6, y1 + Math.sin(a) * w * 1.6);
  ctx.lineTo(x1 + Math.cos(a + 2.4) * w * 2.4, y1 + Math.sin(a + 2.4) * w * 2.4); ctx.lineTo(x1 + Math.cos(a - 2.4) * w * 2.4, y1 + Math.sin(a - 2.4) * w * 2.4); ctx.fill();
  ctx.restore();
}
function heart(x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -30, -55, 0, -25); ctx.bezierCurveTo(30, -55, 60, -10, 0, 30); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = '#141414'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-18, -18, 9, 6, -0.6, 0, 7); ctx.fill();
  ctx.restore();
}
function carIcon(x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineWidth = 6; ctx.strokeStyle = '#141414';
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-50, -10, 100, 30, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-28, -32, 56, 26, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9fd3ff'; ctx.fillRect(-20, -26, 16, 16); ctx.fillRect(4, -26, 16, 16);
  ctx.fillStyle = '#222'; for (const wx of [-28, 28]) { ctx.beginPath(); ctx.arc(wx, 22, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(wx, 22, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; }
  ctx.restore();
}
function questionMark(x, y, s, age, col = '#ffd23f') {
  const p = pop(age); if (p <= 0) return;
  ctx.save(); ctx.translate(x, y + Math.sin(age * 6) * 8); ctx.rotate(Math.sin(age * 4) * 0.15); ctx.scale(p * s, p * s);
  outlineText('?', 0, 0, 120, col, '#141414', 0.14);
  ctx.restore();
}
function wind(t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = 250 + i * 150 + Math.sin(i * 3.1) * 50;
    const ph = ((t * 1.4 + i * 0.37) % 1);
    const x = -300 + ph * (W + 600);
    ctx.lineWidth = 7 + (i % 3) * 3;
    ctx.beginPath(); ctx.moveTo(x - 260, y); ctx.bezierCurveTo(x - 120, y - 30, x - 40, y + 25, x + 60, y);
    ctx.arc(x + 60, y - 32, 32, Math.PI / 2, -Math.PI * 0.9, true); ctx.stroke();
  }
  ctx.restore();
}
function confetti(t, t0) {
  const age = t - t0; if (age < 0 || age > 3.5) return;
  const r = rng(99);
  for (let i = 0; i < 140; i++) {
    const x0 = r() * W, vy = 300 + r() * 500, vx = (r() - 0.5) * 300, ph = r() * 6, col = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff7ae0'][i % 6];
    const side = i % 2 ? -1 : 1;
    const x = side > 0 ? 0 + (x0 * 0.3) + vx * age + (r() * 700) * eo(cl(age * 2)) : W - (x0 * 0.3) - (r() * 700) * eo(cl(age * 2)) + vx * age;
    const y = H * 0.75 - (900 + r() * 600) * eo(cl(age * 1.6)) + vy * age * age * 0.5 + Math.sin(age * 5 + ph) * 20;
    ctx.save(); ctx.translate(x, y); ctx.rotate(age * 6 + ph); ctx.fillStyle = col; ctx.globalAlpha = 1 - st(2.8, 3.5, age);
    ctx.fillRect(-9, -5, 18, 10); ctx.restore();
  }
}
function ladderX(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(0, 0, 110, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#a0662a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-35, 75); ctx.lineTo(-25, -75); ctx.moveTo(35, 75); ctx.lineTo(25, -75); ctx.stroke();
  ctx.lineWidth = 9; for (let i = 0; i < 5; i++) { const yy = 55 - i * 30; ctx.beginPath(); ctx.moveTo(-33 + i * 1.5, yy); ctx.lineTo(33 - i * 1.5, yy); ctx.stroke(); }
  ctx.strokeStyle = '#e63946'; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(-70, -70); ctx.lineTo(70, 70); ctx.moveTo(70, -70); ctx.lineTo(-70, 70); ctx.stroke();
  ctx.restore();
}
function vendingInset(t, age) {
  const p = pop(age, 0.3) * (1 - st(1.1, 1.35, t - 56.0 - 0 + 0)); if (p <= 0) return;
  ctx.save(); ctx.translate(800, 470); ctx.rotate(0.06); ctx.scale(p, p);
  // machine
  ctx.fillStyle = '#d7263d'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.roundRect(-190, -250, 380, 500, 28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#cdeefd'; ctx.beginPath(); ctx.roundRect(-160, -220, 250, 370, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.fillRect(110, -200, 55, 120); ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 6; i++) ctx.fillRect(118 + (i % 2) * 22, -192 + Math.floor(i / 2) * 36, 16, 26);
  ctx.fillStyle = '#222'; ctx.fillRect(-160, 175, 250, 50);
  // shelves with spirals + snacks
  for (let r = 0; r < 3; r++) {
    const yy = -130 + r * 115;
    ctx.fillStyle = '#7d8a96'; ctx.fillRect(-160, yy + 30, 250, 8);
    for (let c = 0; c < 3; c++) {
      const xx = -125 + c * 85;
      if (r === 1 && c === 1) {
        // the stuck bar – hanging
        ctx.save(); ctx.translate(xx, yy + 30); ctx.rotate(0.55 + Math.sin(t * 5) * 0.05);
        ctx.fillStyle = '#5b2e12'; ctx.fillRect(-12, -6, 70, 34); ctx.fillStyle = '#d4a017'; ctx.fillRect(18, -6, 18, 34); ctx.strokeRect(-12, -6, 70, 34);
        ctx.restore();
      } else {
        ctx.fillStyle = ['#5b2e12', '#2a9df4', '#2ec27e'][(r + c) % 3]; ctx.fillRect(xx - 30, yy - 10, 60, 40); ctx.strokeRect(xx - 30, yy - 10, 60, 40);
      }
      ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 4; ctx.beginPath(); for (let k = 0; k < 4; k++) ctx.ellipse(xx - 22 + k * 14, yy + 22, 6, 12, 0, 0, 7); ctx.stroke(); ctx.strokeStyle = '#141414'; ctx.lineWidth = 9;
    }
  }
  ctx.restore();
  // little tag
  ctx.save(); ctx.translate(720, 790); ctx.rotate(-0.05); ctx.scale(p, p); outlineText('SAME ENERGY', 0, 0, 58, '#ffd23f'); ctx.restore();
}

function captions(t) {
  // chunk words: max 4 words, break after punctuation
  let seg = null;
  for (let i = 0; i < SEG.length; i++) { const s = SEG[i]; const next = SEG[i + 1]; const end = next ? Math.min(next.start - 0.02, s.end + 0.6) : s.end + 1.2; if (t >= s.start - 0.08 && t < end) { seg = s; break; } }
  if (!seg) return;
  const chunks = []; let cur = [];
  seg.words.forEach((w, i) => { cur.push(w); const punct = /[,.!?]$/.test(w.w); if (cur.length >= 4 || punct || i === seg.words.length - 1) { chunks.push(cur); cur = []; } });
  let ch = chunks[0];
  for (const c of chunks) if (t >= c[0].s - 0.08) ch = c;
  const age = t - (ch[0].s - 0.08);
  const sc = eob(cl(age / 0.18));
  const size = 96;
  ctx.save(); ctx.translate(W / 2, 1515); ctx.scale(sc, sc);
  ctx.font = `${size}px "Luckiest Guy"`;
  const words = ch.map((w) => w.w.toUpperCase());
  const widths = words.map((w) => ctx.measureText(w).width);
  const gap = 26; const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  // two lines if too wide
  let lines = [[0, words.length]];
  if (total > 940) { const mid = Math.ceil(words.length / 2); lines = [[0, mid], [mid, words.length]]; }
  lines.forEach(([a, b], li) => {
    const lw = widths.slice(a, b).reduce((x, y) => x + y, 0) + gap * (b - a - 1);
    let x = -lw / 2; const y = (li - (lines.length - 1) / 2) * size * 1.08;
    for (let i = a; i < b; i++) {
      const w = ch[i]; const active = t >= w.s - 0.03 && (i === ch.length - 1 || t < ch[i + 1].s - 0.03);
      const cx = x + widths[i] / 2;
      ctx.save(); ctx.translate(cx, y); const ps = active ? 1.12 : 1; ctx.scale(ps, ps);
      outlineText(words[i], 0, 0, size, active ? '#ffd93d' : '#ffffff', '#141414', 0.2);
      ctx.restore();
      x += widths[i] + gap;
    }
  });
  ctx.restore();
}

function overlay(t, shot) {
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.35 + nightAmt(t) * 0.15})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // --- 0-4.5: car counter + no garage
  if (t < 4.5) {
    const n = Math.min(20, Math.max(0, Math.floor((t - 0.3) / 0.17) + 1));
    const a = pop(t - 0.6) * (1 - st(4.25, 4.48, t));
    if (a > 0) { ctx.save(); ctx.translate(250, 220); ctx.scale(a, a); ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 9; ctx.beginPath(); ctx.roundRect(-190, -90, 380, 180, 40); ctx.fill(); ctx.stroke(); carIcon(-90, 10, 1.2, '#e63946'); outlineText('×' + n, 70, 5, 110, '#ffd23f'); ctx.restore(); }
    const g = pop(t - 1.85) * (1 - st(4.25, 4.48, t));
    if (g > 0) {
      ctx.save(); ctx.translate(830, 230); ctx.scale(g, g); ctx.rotate(0.08);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 9; ctx.beginPath(); ctx.roundRect(-150, -120, 300, 240, 40); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8d99ae'; ctx.beginPath(); ctx.moveTo(-90, 70); ctx.lineTo(-90, -20); ctx.lineTo(0, -80); ctx.lineTo(90, -20); ctx.lineTo(90, 70); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#edf2f4'; ctx.fillRect(-55, -5, 110, 75); ctx.strokeRect(-55, -5, 110, 75); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-55, -5 + i * 19); ctx.lineTo(55, -5 + i * 19); ctx.stroke(); }
      ctx.strokeStyle = '#e63946'; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-105, -95); ctx.lineTo(105, 95); ctx.stroke();
      ctx.restore();
    }
  }
  // crunch
  if (t > 6.4 && t < 7.6) { const p = scr(V3(-1.5, 0.8, PILE_Z + 1)); burst(Math.max(300, p.x), Math.max(300, p.y - 120), 170, 'CRUNCH!', '#ff595e', t - 6.42); }
  // tower build sparkles + clang
  if (t > 8.15 && t < 9.2) { const p = scr(V3(0, TOWER_H + 0.5, 0)); burst(p.x + 200, p.y + 120, 120, 'CLANG!', '#4cc9f0', t - 8.2, 0.12); }
  // sinking arrows + cracks
  if (t > 12.5 && t < 14.5) {
    const a = pop(t - 12.6) * (1 - st(14.2, 14.5, t));
    const base = scr(V3(3.8, 0, 1.6));
    for (let i = 0; i < 3; i++) { const yy = base.y - 380 + i * 90 + ((t * 120) % 90); ctx.globalAlpha = a; arrow(base.x + 150, yy - 70, base.x + 150, yy, '#ff595e', 18); ctx.globalAlpha = 1; }
    // dust puffs
    for (let i = 0; i < 8; i++) { const s = scr(V3(-4 + i * 1.15, 0.2, 1.8)); const u = st(12.6 + i * 0.05, 13.8, t); ctx.fillStyle = `rgba(190,160,120,${0.5 * (1 - u) * a})`; ctx.beginPath(); ctx.arc(s.x, s.y - u * 60, 30 + u * 70, 0, 7); ctx.fill(); }
  }
  // lift up arrows during dig, thud
  if (t > 15.0 && t < 15.9) { const p = scr(V3(-4.5, 4, 2)); const a = pop(t - 15.0) * (1 - st(15.7, 15.9, t)); ctx.globalAlpha = a; for (let i = 0; i < 2; i++) arrow(p.x - 60 + i * 120, p.y + 120, p.x - 60 + i * 120, p.y - 60, '#4cc9f0', 18); ctx.globalAlpha = 1; }
  if (t > 17.55 && t < 18.12) { const p = scr(V3(0, 0, 2.6)); burst(p.x, p.y - 40, 130, 'THUD!', '#ffb703', t - 17.6, 0.05); }
  // wind
  wind(t, st(18.8, 19.1, t) * (1 - st(21.3, 21.74, t)));
  if (t > 20.8 && t < 21.74) { const c = cars[WINDY]; const p = scr(c.position.clone().add(V3(0, 1.2, 1.2))); questionMark(p.x + 90, p.y - 90, 1, t - 20.85, '#ff595e'); outlineText('!', p.x - 40, p.y - 120, 130 * pop(t - 20.9), '#ff595e'); }
  // clicks
  if (t > 23.3 && t < 25.5) {
    const c = cars[WINDY];
    [[-0.5, 0.64], [0.5, 0.64], [-0.5, -0.64], [0.5, -0.64]].forEach(([x, z], i) => {
      const w = c.localToWorld(V3(x * 1.4, 0.3, z)); const p = scr(w);
      const age = t - (23.4 + i * 0.28);
      if (age > 0 && age < 0.9) { const s = pop(age, 0.15) * (1 - st(0.6, 0.9, age)); ctx.save(); ctx.translate(p.x, p.y - 70); ctx.scale(s, s); ctx.rotate(-0.1 + i * 0.07); outlineText('CLICK!', 0, 0, 62, '#ffd23f'); ctx.restore(); }
    });
    // lock icon
    const la = pop(t - 24.6) * (1 - st(25.3, 25.5, t));
    if (la > 0) { ctx.save(); ctx.translate(W / 2, 400); ctx.scale(la, la); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 10; ctx.beginPath(); ctx.roundRect(-80, -30, 160, 130, 22); ctx.fill(); ctx.stroke(); ctx.lineWidth = 24; ctx.strokeStyle = '#141414'; ctx.beginPath(); ctx.arc(0, -30, 55, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 12; ctx.strokeStyle = '#c0c8d0'; ctx.beginPath(); ctx.arc(0, -30, 55, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(0, 25, 16, 0, 7); ctx.fill(); ctx.fillRect(-6, 25, 12, 40); ctx.restore(); }
  }
  // favourite heart
  if (t > 25.85 && t < 33.47) { const c = cars[FAV]; const p = scr(c.position.clone().add(V3(0, 1.5, 0))); const s = pop(t - 25.86) * (1 + Math.sin(t * 8) * 0.08); if (p.ok) heart(p.x, p.y - 30, s * (shotIdx(t) === 7 ? 1.3 : 1.6), '#ff4d6d'); }
  if (t > 28.15 && t < 28.73) { ladderX(W - 230, 700, pop(t - 28.15) * 0.95); }
  // lift climbing arrows
  if (t > 29.5 && t < 31.1) { const p = scr(tower.localToWorld(V3(0, liftY(t) + 1.2, 1.4))); for (let i = 0; i < 2; i++) arrow(p.x - 160 + i * 320, p.y + 80, p.x - 160 + i * 320, p.y - 80, '#ffd23f', 16); }
  if (t > 31.15 && t < 31.9) { const c = cars[FAV]; const p = scr(c.position.clone().add(V3(0, 0.7, 1))); burst(p.x - 60, p.y - 200, 105, 'GRAB!', '#4cc9f0', t - 31.2, 0.1); }
  // facing the house
  if (t > 34.55 && t < 35.86) {
    const a = scr(tower.localToWorld(V3(0, 0.6, -1.3))); const b = scr(V3(0, 2.5, -12));
    const u = eo(st(34.6, 35.0, t)); ctx.globalAlpha = 1 - st(35.6, 35.86, t);
    arrow(a.x, a.y, lerp(a.x, b.x, u), lerp(a.y, b.y, u), '#ffd23f', 14, [26, 20]);
    ctx.globalAlpha = 1;
    const o = scr(owner.position.clone().add(V3(0, 2.7, 0))); questionMark(o.x, o.y - 30, 1, t - 34.7);
  }
  // spinning floor arrow
  if (t > 37.6 && t < 39.18) {
    const c = scr(tower.localToWorld(V3(0, 0.1, 0))); const a = pop(t - 37.65) * (1 - st(38.95, 39.18, t));
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(a, a * 0.42); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    const rot = t * 4; ctx.beginPath(); ctx.arc(0, 0, 330, rot, rot + 4.6); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; const ea = rot + 4.6; ctx.translate(Math.cos(ea) * 330, Math.sin(ea) * 330); ctx.rotate(ea + Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(-45, -10); ctx.lineTo(45, -10); ctx.fill();
    ctx.restore();
    if (t > 38.75) { const p = scr(V3(0, 1.8, 3)); burst(p.x - 200, p.y - 260, 110, 'VROOM!', '#8ac926', t - 38.8, -0.15); }
  }
  // bird notes
  if (t > 39.6 && t < 41.82) {
    birds.forEach((b, i) => { if (!b.visible) return; const p = scr(b.position.clone().add(V3(0, 0.5, 0))); const age = (t * 1.3 + i * 0.37) % 1; ctx.globalAlpha = 1 - age; outlineText(i % 2 ? '♪' : '♫', p.x + 30 + age * 40, p.y - 40 - age * 90, 70, '#ffffff', '#141414', 0.12, 'Fredoka'); ctx.globalAlpha = 1; });
    const age = t - 40.3; if (age > 0) { const c = cars[NEST_CARS[0]]; const p = scr(c.position.clone().add(V3(0, 1.4, 0))); burst(p.x + 230, p.y - 160, 100, 'TWEET!', '#ff7ae0', age, 0.12); }
  }
  // glass shine
  if (t > 43.3 && t < 44.6) {
    const u = st(43.3, 44.4, t); const a = scr(V3(-4, 0, 1.7)), b = scr(V3(4, TOWER_H, 1.7));
    ctx.save(); ctx.globalAlpha = 0.55 * Math.sin(u * Math.PI); ctx.translate(lerp(a.x - 200, b.x + 200, u), (a.y + b.y) / 2); ctx.rotate(0.5);
    const gr = ctx.createLinearGradient(-60, 0, 60, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(-60, -1200, 120, 2400); ctx.restore();
    for (let i = 0; i < 6; i++) { const p = scr(V3(-3.5 + i * 1.4, 2 + (i * 2.1) % 10, 1.7)); const s = Math.sin(st(43.5 + i * 0.1, 44.2 + i * 0.1, t) * Math.PI); if (s > 0) sparkle(p.x, p.y, 40 * s); }
  }
  // moon glow star twinkles handled by sky; light-up sparkles
  if (t > 45.0 && t < 46.4) { const fl = Math.min(9, Math.floor((t - 45.0) / 0.12)); for (const s of [-2.4, 2.4]) { const p = scr(tower.localToWorld(V3(s, FLOOR_Y(fl) + 0.5, 1.6))); sparkle(p.x, p.y, 34); } }
  // question marks
  if (t > 46.6 && t < 48.57) {
    [5, 9, 15, 11, 17, 7, 13].forEach((k, i) => { const c = cars[k]; const p = scr(c.position.clone().add(V3(0, 1.2, 1.3))); if (p.ok) questionMark(Math.min(W - 90, Math.max(90, p.x)), p.y, 0.9, t - (46.7 + i * 0.15), ['#ffd23f', '#4cc9f0', '#ff7ae0', '#8ac926'][i % 4]); });
  }
  // keypad press flash
  if (t > 50.58 && t < 51.42) { for (const [t0, txt] of [[50.85, 'BEEP'], [51.15, 'BOOP'], [51.38, '✓']]) { const age = t - t0; if (age > 0 && age < 0.4) { ctx.globalAlpha = 1 - age / 0.4; outlineText(txt, 300 + (t0 - 50.85) * 900, 560 - age * 200, 80, '#4ef0a0'); ctx.globalAlpha = 1; } } }
  // stuck!
  if (t > 54.2 && t < 57.37) {
    const c = cars[B7]; const p = scr(c.position.clone().add(V3(0, 1.0, 1.5)));
    burst(Math.max(260, p.x - 120), Math.max(260, p.y - 230), 120, 'STUCK!', '#ff595e', (t - 54.3) % 3.2 < 1 ? t - 54.3 : 0.9, -0.1);
    // warning flash border
    const f = (Math.floor(t * 4) % 2) ? 0.22 : 0; ctx.fillStyle = `rgba(255,40,40,${f})`; ctx.fillRect(0, 0, W, 26); ctx.fillRect(0, H - 26, W, 26); ctx.fillRect(0, 0, 26, H); ctx.fillRect(W - 26, 0, 26, H);
  }
  if (t > 55.9 && t < 57.37) vendingInset(t, t - 55.95);
  // everyone does: tiny "sigh" puff
  if (t > 58.55 && t < 59.02) { const o = scr(owner.position.clone().add(V3(0, 2.4, 0))); outlineText('*sigh*', o.x + 160, o.y - 60, 64 * pop(t - 58.6), '#ffffff'); }
  // BONK
  if (t > 59.42 && t < 60.4) { const p = scr(V3(0.9, 0.9, 1.5)); burst(p.x, p.y - 260, 190, 'BONK!', '#ffb703', t - 59.44, -0.08); }
  if (t > 59.42 && t < 59.55) { ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - st(59.42, 59.55, t))})`; ctx.fillRect(0, 0, W, H); }
  if (t > 59.8 && t < 60.4) { const c = cars[B7]; const p = scr(c.position.clone().add(V3(0, 1.4, 1))); burst(p.x + 160, p.y - 120, 110, 'CLUNK!', '#4cc9f0', t - 59.82, 0.12); }
  // congratulations
  confetti(t, 60.7);
  if (t > 60.7 && t < 61.84) { const a = pop(t - 60.72, 0.3); ctx.save(); ctx.translate(W / 2, 360); ctx.scale(a * 0.8, a * 0.8); ctx.rotate(Math.sin(t * 5) * 0.04); for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i * Math.PI / 6 + t); ctx.fillStyle = i % 2 ? 'rgba(255,214,61,.9)' : 'rgba(255,122,224,.9)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -420); ctx.lineTo(40, -420); ctx.fill(); ctx.restore(); } outlineText('★', 0, 0, 260, '#ffd23f'); ctx.restore(); }
  // final title
  if (t > 62.0) {
    const a = pop(t - 62.4, 0.35);
    ctx.save(); ctx.translate(W / 2, 330); ctx.scale(a, a); ctx.rotate(-0.04);
    ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 40 * (0.8 + Math.sin(t * 8) * 0.2);
    outlineText('THE CAR', 0, -70, 120, '#ffffff', '#3a0a4a', 0.2);
    outlineText('VENDING MACHINE', 0, 70, 104, '#ffe46b', '#3a0a4a', 0.2);
    ctx.restore();
    const c2 = pop(t - 63.5, 0.3);
    if (c2 > 0) { ctx.save(); ctx.translate(W / 2, 560); ctx.scale(c2, c2); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(-170, 0, 42, 0, 7); ctx.fill(); ctx.stroke(); outlineText('$', -170, 0, 56, '#141414', '#ffd23f', 0.05); outlineText('INSERT COIN', 50, 0, 64, '#4ef0a0'); ctx.restore(); }
  }
  captions(t);
  // fade in / out
  const fade = Math.max(1 - st(0, 0.35, t), st(65.3, 66.0, t));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  // cut flashes (soft white pop at a few cuts)
  for (const tc of [7.25, 14.5, 28.73, 41.82, 48.57, 61.84]) { const u = (t - tc) / 0.16; if (u >= 0 && u < 1) { ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - u)})`; ctx.fillRect(0, 0, W, H); } }
}
function sparkle(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = 20;
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * 0.22 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
}
function shotIdx(t) { return SHOTS.findIndex((x) => t >= x[0] && t < x[1]); }

// ---------------------------------------------------------------- frame
window.renderFrame = (t, q = 0.92) => {
  placeEnv(t);
  placeTower(t);
  placeGround(t);
  placeCars(t);
  placeOwner(t);
  placeBirds(t);
  const shot = placeCamera(t);
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(glCanvas, 0, 0);
  overlay(t, shot);
  return out.toDataURL('image/jpeg', q);
};
document.fonts.load('96px "Luckiest Guy"').then(() => document.fonts.load('70px "Fredoka"')).then(() => { drawSign(0); window.READY = true; });

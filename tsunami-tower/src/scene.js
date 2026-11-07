// Tsunami Tower: 3D explainer. Every frame is a pure function of time t (seconds),
// driven by the voiceover line timings in timing.json.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TIMING = await (await fetch('/src/timing.json')).json();
const WORDS = TIMING.words, LINES = TIMING.lines;
export const DURATION = Math.ceil((LINES[LINES.length - 1].e + 1.3) * 30) / 30;
const LS = LINES.map((l) => l.s);
const lineEnd = (i) => (i + 1 < LS.length ? LS[i + 1] : DURATION);

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function hash(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function vnoise2(x, z, s = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
  const h = (a, b) => hash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(s, 83492791));
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), w);
}
let rs = 1234; const R = (a = 0, b = 1) => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return a + (b - a) * rs / 4294967296; };
// line progress
const P = (i, t) => clamp((t - LS[i]) / (lineEnd(i) - LS[i]), 0, 1);
const lineAt = (t) => { let k = 0; for (let i = 0; i < LS.length; i++) if (t >= LS[i] - 1e-6) k = i; return k; };
const after = (i, t) => t >= LS[i];

// ---------------------------------------------------------------- renderer
const W = window.__W || 1080, H = window.__H || 1920;
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
scene.fog = new THREE.Fog('#cfe0ee', 140, 900);
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);

function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, base, spread, n, smax = 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const v = R(-spread, spread); g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; const s = R(0.5, smax); g.fillRect(R(0, w), R(0, h), s, s); }
}
// sky dome with clouds
{
  const sky = canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f6fc4'); gr.addColorStop(0.42, '#7fb2e6'); gr.addColorStop(0.5, '#d6e6f3'); gr.addColorStop(1, '#d6e6f3');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let c = 0; c < 46; c++) {
      const cx = R(0, w), cy = R(h * 0.12, h * 0.46), sc = R(0.5, 1.6) * (0.4 + cy / h);
      for (let k = 0; k < 26; k++) {
        const x = cx + R(-90, 90) * sc, y = cy + R(-22, 12) * sc, r = R(18, 46) * sc;
        const rg = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
        rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.7, 'rgba(240,244,250,0.7)'); rg.addColorStop(1, 'rgba(225,232,242,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
  });
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = sky;
}
scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x9c7f55, 0.7));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(30, 60, 25); sun.target.position.set(0, 0, 0); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 200 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const M = {
  concrete: new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => speckle(g, w, h, '#9c9a95', 0.14, 9000, 2.5), [2, 2]), roughness: 0.92 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: '#7f7d79', roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: 0.8, roughness: 0.3 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.85 }),
  glass: new THREE.MeshStandardMaterial({ color: '#2d4357', metalness: 0.5, roughness: 0.1 }),
};

// ---------------------------------------------------------------- ground (sand heightfield near the site)
const sandTex = canvasTex(512, 512, (g, w, h) => { speckle(g, w, h, '#d9b77e', 0.14, 60000, 2); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(150,120,80,${R(0.04, 0.1)})`; g.lineWidth = R(1, 3); g.beginPath(); const y = R(0, h); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 6); g.stroke(); } }, [40, 40]);
const groundMat = new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 0.95, transparent: true, opacity: 1 });
const COLS = [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]];
function baseGround(x, z) {
  let y = 0.12 * (vnoise2(x * 0.08, z * 0.08, 2) - 0.5) + 0.5 * smooth(20, 80, z) * vnoise2(x * 0.03, z * 0.03, 5);
  if (z < -6) y -= (-6 - z) * 0.075;
  y += smooth(30, 70, z) * 3;                    // dunes rising inland
  return y;
}
const GS = { hole: 0, hill: 0, hillR: 5, hillErode: 0, scour: 0, xray: 0 };
function groundH(x, z) {
  let y = baseGround(x, z);
  if (GS.hole > 0) { const m = smooth(1.75, 1.45, Math.abs(x)) * smooth(1.25, 0.95, Math.abs(z)); y -= GS.hole * m; }
  if (GS.hill > 0) {
    const r = Math.hypot(x, z) / GS.hillR;
    let hh = GS.hill * Math.pow(clamp(1 - r, 0, 1), 1.1);
    if (GS.hillErode > 0) hh *= 1 - GS.hillErode * (0.6 + 0.4 * vnoise2(x * 0.9, z * 0.9, 9)) * smooth(-1, 1, -z * 0.3 + GS.hillErode * 3);
    y += Math.max(0, hh);
  }
  if (GS.scour > 0) for (const [cx, cz] of COLS) { const d = Math.hypot(x - cx, z - cz); y -= GS.scour * Math.exp(-((d / 1.5) ** 2)) * (1 + 0.3 * vnoise2(x * 2, z * 2, 4)); }
  return y;
}
const ground = (() => {
  const N = 160, S = 80;
  const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array((N + 1) * (N + 1) * 3), 3));
  const m = new THREE.Mesh(geo, groundMat); m.receiveShadow = true; scene.add(m);
  // far sand / land skirt
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1400, 900, 140, 90).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 0.95 }));
  const fp = far.geometry.attributes.position, fc = [];
  far.position.set(0, 0, 330);
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i) + 330; let y = baseGround(x, z);
    if (Math.abs(x) < 38 && z > -38 && z < 38) y -= 30; else if (Math.abs(x) < 41 && z > -41 && z < 41) y -= 0.3;
    y += smooth(80, 300, z) * 18 * vnoise2(x * 0.01, z * 0.01, 7);
    fp.setY(i, y); const gr = smooth(60, 120, z); fc.push(lerp(0.95, 0.42, gr), lerp(0.9, 0.62, gr), lerp(0.8, 0.32, gr));
  }
  far.geometry.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); far.geometry.computeVertexNormals();
  far.receiveShadow = true; scene.add(far);
  return m;
})();
function updateGround(wetLevel) {
  const pos = ground.geometry.attributes.position, col = ground.geometry.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = groundH(x, z);
    pos.setY(i, y);
    const wet = smooth(0.6, -0.4, y - wetLevel), dug = smooth(-0.2, -1.0, y - baseGround(x, z));
    const k = Math.max(wet * 0.45, dug * 0.75);
    col.setXYZ(i, 1 - k * 0.55, 1 - k * 0.6, 1 - k * 0.65);
  }
  pos.needsUpdate = true; col.needsUpdate = true; ground.geometry.computeVertexNormals();
}

// subsurface (x-ray) strata and piles
const strata = new THREE.Group(); scene.add(strata);
{
  const mk = (y0, y1, c, op) => { const m = new THREE.Mesh(new THREE.BoxGeometry(24, y1 - y0, 24), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: op, roughness: 1, depthWrite: false })); m.position.y = (y0 + y1) / 2; strata.add(m); return m; };
  mk(-8, -0.05, '#e3c88f', 0.28); mk(-17, -8, '#8a4f32', 0.42);
  const line = new THREE.Mesh(new THREE.BoxGeometry(24.05, 0.08, 24.05), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })); line.position.y = -8; strata.add(line);
  strata.visible = false;
}

// ---------------------------------------------------------------- water surface (sea + tsunami + flood)
const WS = { sea: -1.0, waves: [], flow: 0, flowLevel: -9 };
function nonUniform(n, a, b, center, power) {
  const arr = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1) * 2 - 1; const s = Math.sign(u) * Math.pow(Math.abs(u), power); arr.push(s < 0 ? center + s * (center - a) : center + s * (b - center)); }
  return arr;
}
const WX = nonUniform(121, -160, 160, 0, 1.7), WZ = nonUniform(241, -520, 90, 0, 1.6);
const water = (() => {
  const nx = WX.length, nz = WZ.length, pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; pos[k * 3] = WX[i]; pos[k * 3 + 2] = WZ[j]; uv[k * 2] = WX[i] / 12; uv[k * 2 + 1] = WZ[j] / 12;
    if (i < nx - 1 && j < nz - 1) idx.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const nc = document.createElement('canvas'); nc.width = nc.height = 256; const ng = nc.getContext('2d'), img = ng.createImageData(256, 256);
  const hgt = (x, y) => vnoise2(x / 16, y / 16, 11) * 0.65 + vnoise2(x / 6, y / 6, 12) * 0.35;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = (hgt((x + 1) % 256, y) - hgt((x + 255) % 256, y)) * 5, dy = (hgt(x, (y + 1) % 256) - hgt(x, (y + 255) % 256)) * 5;
    const n = V(-dx, -dy, 1).normalize(), o = (y * 256 + x) * 4; img.data[o] = (n.x * 0.5 + 0.5) * 255; img.data[o + 1] = (n.y * 0.5 + 0.5) * 255; img.data[o + 2] = (n.z * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ng.putImageData(img, 0, 0);
  const nt = new THREE.CanvasTexture(nc); nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.15, normalMap: nt, normalScale: new THREE.Vector2(0.55, 0.55), transparent: true, opacity: 0.93 });
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.renderOrder = 1; scene.add(m);
  // far sea to the horizon
  const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a7f95', roughness: 0.15, metalness: 0.2, normalMap: nt, normalScale: new THREE.Vector2(0.4, 0.4) }));
  far.position.set(0, -1.05, -2010); scene.add(far);
  return { m, nt, far };
})();
const deep = new THREE.Color('#1f6f86'), shallow = new THREE.Color('#4fb7b9'), foamC = new THREE.Color('#f2fbff'), flood = new THREE.Color('#6f9e92');
function waveSurf(w, x, z) {
  // w: {zf, crest, level}: front position, crest absolute height, trailing level
  const d = w.zf - z;
  if (d < -2.2) return -99;
  let y;
  if (d < 0) y = w.crest - (w.crest - WS.sea) * Math.pow(-d / 2.2, 0.6) * 1.05;   // steep breaking face
  else y = w.crest - (w.crest - w.level) * smooth(1.5, 30, d);
  const taper = smooth(150, 100, Math.abs(x));
  return WS.sea + (y - WS.sea) * taper;
}
function waterY(x, z, t) {
  let y = WS.sea + 0.16 * Math.sin(x * 0.09 + t * 1.3) * Math.sin(z * 0.07 - t * 0.9) + 0.1 * Math.sin(z * 0.21 + t * 2.1);
  for (const w of WS.waves) y = Math.max(y, waveSurf(w, x, z));
  if (WS.flow > 0) y = Math.max(y, WS.flowLevel - 0.012 * z + 0.08 * Math.sin(x * 0.7 + z * 0.4 - t * 4) * WS.flow);
  return y;
}
function updateWater(t) {
  const pos = water.m.geometry.attributes.position, col = water.m.geometry.attributes.color, nx = WX.length;
  const c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.array[k * 3], z = pos.array[k * 3 + 2];
    const y = waterY(x, z, t);
    pos.array[k * 3 + 1] = y;
    const gh = Math.abs(x) < 40 && Math.abs(z) < 40 ? groundH(x, z) : baseGround(x, z);
    const depth = y - gh;
    c.copy(deep).lerp(shallow, smooth(4, 0.3, depth));
    if (y > WS.sea + 0.4) c.lerp(flood, 0.35);
    let foam = smooth(0.35, 0.0, depth) * 0.8;
    for (const w of WS.waves) { const d = w.zf - z; if (d > -2.4 && d < 4) foam = Math.max(foam, (1 - Math.abs(d - 0.5) / 4) * smooth(150, 100, Math.abs(x))); }
    if (WS.flow > 0 && y > WS.sea + 0.3) foam = Math.max(foam, WS.flow * 0.55 * smooth(0.55, 0.85, vnoise2(x * 0.6, z * 0.25 - t * 2.2, 3)));
    // churn around the tower columns
    if (WS.flow > 0 || WS.waves.length) for (const [cx, cz] of COLS) { const d = Math.hypot(x - cx, z - cz); if (d < 2.6 && y > gh + 0.2) foam = Math.max(foam, 0.7 * smooth(2.6, 0.6, d)); }
    c.lerp(foamC, clamp(foam, 0, 1));
    col.array[k * 3] = c.r; col.array[k * 3 + 1] = c.g; col.array[k * 3 + 2] = c.b;
  }
  pos.needsUpdate = true; col.needsUpdate = true; water.m.geometry.computeVertexNormals();
  water.nt.offset.set(t * 0.02, -t * 0.035 - WS.flow * t * 0.05);
  water.far.position.y = WS.sea - 0.05;
}
// spray particles along wave fronts
const SPRAY_N = 700;
const spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 0.4, transparent: true, opacity: 0.85 }), SPRAY_N);
spray.frustumCulled = false; scene.add(spray);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function updateSpray(t) {
  let k = 0;
  for (const w of WS.waves) {
    const per = Math.floor(SPRAY_N / Math.max(1, WS.waves.length));
    for (let i = 0; i < per && k < SPRAY_N; i++, k++) {
      const ph = (t * 0.9 + hash(i * 7 + 1)) % 1;
      const x = (hash(i * 13 + 5) - 0.5) * 200;
      const hgt = w.crest - WS.sea;
      _p.set(x + (hash(i) - 0.5) * 2, w.crest + ph * hgt * 0.25 - ph * ph * hgt * 0.35, w.zf + 0.5 + ph * 2.5);
      const s = (0.1 + 0.35 * hash(i * 3)) * (1 - ph) * Math.min(1, hgt / 3) * smooth(150, 110, Math.abs(x));
      _s.setScalar(s); _m.compose(_p, _q, _s); spray.setMatrixAt(k, _m);
    }
  }
  _s.setScalar(0); _m.compose(_p.set(0, -50, 0), _q, _s);
  for (; k < SPRAY_N; k++) spray.setMatrixAt(k, _m);
  spray.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- people
function makeHuman(o) {
  const s = o.scale || 1, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const shirt = mat(o.shirt), pants = mat(o.pants), skin = mat(o.skin || '#c68a62', 0.6), shoe = mat('#222', 0.7);
  const box = (w, h, d, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 2, 2), m); me.castShadow = true; return me; };
  const rounded = (r, h, m) => { const me = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 4, 10), m); me.castShadow = true; return me; };
  const hips = new THREE.Group(); hips.position.y = 0.93 * s; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = rounded(0.17 * s, 0.34 * s, shirt); chest.scale.set(1.25, 1, 0.75); chest.position.y = 0.3 * s; torso.add(chest);
  const neck = new THREE.Group(); neck.position.y = 0.6 * s; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115 * s, 20, 16), skin); head.position.y = 0.13 * s; head.scale.set(0.9, 1.05, 0.95); head.castShadow = true; neck.add(head);
  if (o.hair) { const hr = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(o.hair)); hr.position.y = 0.14 * s; hr.rotation.x = -0.25; neck.add(hr); }
  if (o.hood) { const hd = rounded(0.1 * s, 0.1 * s, shirt); hd.position.set(0, 0.02 * s, -0.11 * s); hd.rotation.x = 1.2; neck.add(hd); }
  if (o.hardhat) {
    const hm = mat('#f2c318', 0.4);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.135 * s, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm); dome.position.y = 0.19 * s; dome.castShadow = true; neck.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.02 * s, 24), hm); brim.position.set(0, 0.19 * s, 0.03 * s); neck.add(brim);
  }
  if (o.hijab) {
    const hj = new THREE.Mesh(new THREE.SphereGeometry(0.135 * s, 20, 16), mat(o.hijab, 0.9)); hj.position.y = 0.14 * s; hj.scale.set(1, 1.08, 1.05); hj.castShadow = true; neck.add(hj);
    const drape = new THREE.Mesh(new THREE.ConeGeometry(0.24 * s, 0.4 * s, 16, 1, true), mat(o.hijab, 0.9)); drape.position.set(0, -0.08 * s, -0.01 * s); drape.castShadow = true; neck.add(drape);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 16, 12), skin); face.position.set(0, 0.13 * s, 0.045 * s); neck.add(face);
  }
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.22 * s, 0.5 * s, 0); torso.add(sh);
    const up = rounded(0.055 * s, 0.24 * s, shirt); up.position.y = -0.15 * s; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.3 * s; sh.add(el);
    const fo = rounded(0.048 * s, 0.22 * s, o.shortSleeve ? skin : shirt); fo.position.y = -0.13 * s; el.add(fo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 10, 8), skin); hand.position.y = -0.29 * s; el.add(hand);
    return { sh, el, hand };
  };
  const leg = (side) => {
    const hp = new THREE.Group(); hp.position.set(side * 0.1 * s, 0, 0); hips.add(hp);
    const th = rounded(0.075 * s, 0.32 * s, pants); th.position.y = -0.22 * s; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.45 * s; hp.add(kn);
    const sn = rounded(0.062 * s, 0.32 * s, pants); sn.position.y = -0.21 * s; kn.add(sn);
    const sh = box(0.1 * s, 0.07 * s, 0.24 * s, shoe); sh.position.set(0, -0.44 * s, 0.05 * s); kn.add(sh);
    return { hp, kn };
  };
  const A = [arm(-1), arm(1)], L = [leg(-1), leg(1)];
  if (o.dress) { const dr = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.3 * s, 0.75 * s, 18, 1, true), mat(o.dress, 0.9)); dr.position.y = -0.22 * s; dr.castShadow = true; hips.add(dr); }
  const pelvis = rounded(0.13 * s, 0.08 * s, pants); pelvis.scale.set(1.3, 1, 0.8); pelvis.position.y = 0.02 * s; hips.add(pelvis);
  scene.add(root);
  return { root, body, hips, torso, neck, A, L, s, items: {} };
}
function pose(h, kind, ph = 0) {
  const sn = Math.sin(ph), cs = Math.cos(ph);
  const set = (o, x = 0, y = 0, z = 0) => o.rotation.set(x, y, z);
  set(h.torso); set(h.neck); h.hips.position.y = 0.93 * h.s; h.body.position.set(0, 0, 0); h.body.rotation.set(0, 0, 0);
  for (const a of h.A) { set(a.sh); set(a.el); } for (const l of h.L) { set(l.hp); set(l.kn); }
  if (kind === 'stand' || kind === 'idle') {
    h.A[0].sh.rotation.z = -0.08; h.A[1].sh.rotation.z = 0.08; h.A[0].el.rotation.x = -0.15; h.A[1].el.rotation.x = -0.15;
    h.torso.rotation.x = 0.02 * Math.sin(ph * 0.5);
  } else if (kind === 'walk' || kind === 'run') {
    const run = kind === 'run', a = run ? 0.9 : 0.5;
    h.torso.rotation.x = run ? 0.28 : 0.05;
    h.L[0].hp.rotation.x = a * sn; h.L[1].hp.rotation.x = -a * sn;
    h.L[0].kn.rotation.x = -Math.max(0, -cs) * (run ? 1.4 : 0.7) - 0.1; h.L[1].kn.rotation.x = -Math.max(0, cs) * (run ? 1.4 : 0.7) - 0.1;
    h.A[0].sh.rotation.x = -a * sn * 0.9; h.A[1].sh.rotation.x = a * sn * 0.9;
    h.A[0].el.rotation.x = run ? -1.3 : -0.3; h.A[1].el.rotation.x = run ? -1.3 : -0.3;
    h.hips.position.y = 0.93 * h.s + Math.abs(sn) * (run ? 0.06 : 0.025) * h.s - (run ? 0.05 : 0) * h.s;
  } else if (kind === 'climb') {
    h.A[0].sh.rotation.x = -2.6 + 0.4 * sn; h.A[1].sh.rotation.x = -2.6 - 0.4 * sn;
    h.A[0].el.rotation.x = -0.4 - 0.3 * Math.max(0, sn); h.A[1].el.rotation.x = -0.4 - 0.3 * Math.max(0, -sn);
    h.L[0].hp.rotation.x = -0.9 * Math.max(0, sn) - 0.2; h.L[1].hp.rotation.x = -0.9 * Math.max(0, -sn) - 0.2;
    h.L[0].kn.rotation.x = 1.2 * Math.max(0, sn) + 0.2; h.L[1].kn.rotation.x = 1.2 * Math.max(0, -sn) + 0.2;
  } else if (kind === 'dig') {
    const k = 0.5 + 0.5 * sn;
    h.torso.rotation.x = 0.35 + 0.35 * k; h.L[0].hp.rotation.x = -0.35; h.L[0].kn.rotation.x = 0.5; h.L[1].hp.rotation.x = 0.15; h.L[1].kn.rotation.x = 0.2;
    h.A[0].sh.rotation.x = -0.9 - 0.5 * k; h.A[1].sh.rotation.x = -0.6 - 0.6 * k; h.A[0].el.rotation.x = -0.5; h.A[1].el.rotation.x = -0.3;
    h.A[0].sh.rotation.z = 0.3; h.A[1].sh.rotation.z = -0.3;
  } else if (kind === 'sit') {
    h.hips.position.y = 0.32 * h.s;
    h.L[0].hp.rotation.x = -1.45; h.L[1].hp.rotation.x = -1.45; h.L[0].kn.rotation.x = 1.4; h.L[1].kn.rotation.x = 1.4;
    h.A[0].sh.rotation.x = -0.4; h.A[1].sh.rotation.x = -0.4; h.A[0].el.rotation.x = -0.7; h.A[1].el.rotation.x = -0.7;
    h.torso.rotation.x = -0.05 + 0.02 * sn;
  } else if (kind === 'cheer') {
    h.A[0].sh.rotation.x = -2.8 - 0.25 * Math.abs(sn); h.A[1].sh.rotation.x = -2.8 - 0.25 * Math.abs(cs);
    h.A[0].sh.rotation.z = -0.35; h.A[1].sh.rotation.z = 0.35; h.hips.position.y = 0.93 * h.s + 0.05 * Math.abs(sn) * h.s;
  } else if (kind === 'look') {
    h.neck.rotation.x = -0.15; h.A[0].sh.rotation.z = -0.1; h.A[1].sh.rotation.x = -1.2; h.A[1].el.rotation.x = -1.6;
  }
}
const worker = makeHuman({ shirt: '#ef6f1d', pants: '#2f3542', hardhat: true, hood: true, skin: '#b9825c' });
const mom = makeHuman({ shirt: '#3f8f93', pants: '#3f8f93', hijab: '#f3efe6', dress: '#3f8f93', scale: 0.95, skin: '#c99772' });
const kid = makeHuman({ shirt: '#8fc2e8', pants: '#7aa6c7', hair: '#1d1612', scale: 0.62, skin: '#c99772' });
const grandpa = makeHuman({ shirt: '#f1efe8', pants: '#8b8578', scale: 0.97, skin: '#c08a66', shortSleeve: true });
const FAMILY = [mom, kid, grandpa];
// shovel held by the worker
const shovel = new THREE.Group();
{ const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), M.wood); h.position.y = -0.55; shovel.add(h); const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.02), M.steel); b.position.y = -1.2; shovel.add(b); shovel.traverse((o) => { o.castShadow = true; }); }
worker.A[1].hand.add(shovel);
function place(h, x, z, yaw, y) { h.root.position.set(x, y !== undefined ? y : groundH(x, z), z); h.root.rotation.y = yaw; h.root.visible = true; }

// ---------------------------------------------------------------- structures
const solid = new THREE.Group(); scene.add(solid);
const halves = [];
{
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 1.5, 0, 0); solid.add(g);
    const b = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 6), M.concrete); b.position.y = 4; b.castShadow = b.receiveShadow = true; g.add(b);
    halves.push(g);
  }
  // crack: jagged dark ribbon on the sea-facing wall
  const pts = []; let x = 0;
  for (let y = 0; y <= 8; y += 0.5) { pts.push(V(x, y, -3.02)); x = clamp(x + (hash(y * 10) - 0.5) * 0.7, -0.4, 0.4); }
  const crackGeo = new THREE.BufferGeometry(), v = [], ix = [];
  pts.forEach((p, i) => { const w = 0.07 + 0.06 * hash(i * 3); v.push(p.x - w, p.y, p.z, p.x + w, p.y, p.z); if (i) { const a = (i - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); crackGeo.setIndex(ix);
  solid.userData.crack = new THREE.Mesh(crackGeo, new THREE.MeshBasicMaterial({ color: '#141210', side: THREE.DoubleSide })); solid.add(solid.userData.crack);
  // a few side branches
  for (let k = 0; k < 6; k++) {
    const y0 = 1 + k * 1.1, len = 0.6 + hash(k) * 1.2, side = k % 2 ? 1 : -1;
    const br = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.07), solid.userData.crack.material);
    br.position.set(side * len / 2, y0, -3.025); br.rotation.set(Math.PI, 0, side * (0.3 + hash(k + 9) * 0.5)); br.userData.branch = true; solid.add(br);
  }
}
const tower = new THREE.Group(); scene.add(tower);
const T = { colSq: [], colRd: [], piles: [], level2: new THREE.Group(), roofRails: new THREE.Group(), ladder: new THREE.Group(), ramp: null, rampRails: null };
const SLAB1 = 5.0, ROOF1 = 8.5, ROOF2 = 13.0;
{
  for (const [x, z] of COLS) {
    const sq = new THREE.Mesh(new THREE.BoxGeometry(0.5, SLAB1 + 2, 0.5), M.concrete); sq.position.set(x, SLAB1 / 2 - 1, z); sq.castShadow = sq.receiveShadow = true; tower.add(sq); T.colSq.push(sq);
    const rd = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, SLAB1 + 2, 28), M.concrete); rd.position.set(x, SLAB1 / 2 - 1, z); rd.castShadow = rd.receiveShadow = true; tower.add(rd); T.colRd.push(rd);
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1, 16), new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.6, metalness: 0.3 })); pile.position.set(x, 0, z); tower.add(pile); T.piles.push(pile);
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.45, 6.6), M.concrete); slab.position.y = SLAB1 + 0.22; slab.castShadow = slab.receiveShadow = true; tower.add(slab);
  // level-1 room: walls with a window band
  const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.concrete); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
  const room = (g, y0, y1) => {
    const hgt = y1 - y0;
    for (const s of [-1, 1]) {
      g.add(wall(6.4, hgt * 0.42, 0.25, 0, y0 + hgt * 0.21, s * 3.1)); g.add(wall(6.4, hgt * 0.22, 0.25, 0, y1 - hgt * 0.11, s * 3.1));
      g.add(wall(0.25, hgt * 0.42, 6.4, s * 3.1, y0 + hgt * 0.21, 0)); g.add(wall(0.25, hgt * 0.22, 6.4, s * 3.1, y1 - hgt * 0.11, 0));
      for (const c of [-1, 1]) { g.add(wall(0.5, hgt, 0.5, s * 3.0, (y0 + y1) / 2, c * 3.0)); }
    }
    const roof = wall(6.8, 0.4, 6.8, 0, y1 + 0.2, 0); g.add(roof);
  };
  room(tower, SLAB1 + 0.45, ROOF1);
  room(T.level2, ROOF1 + 0.4, ROOF2 - 0.4); tower.add(T.level2);
  // railings on the current roof
  const railMat = M.steel;
  for (const s of [-1, 1]) {
    for (const along of ['x', 'z']) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6.6, 8), railMat);
      if (along === 'x') { bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.05, s * 3.3); } else { bar.rotation.x = Math.PI / 2; bar.position.set(s * 3.3, 1.05, 0); }
      T.roofRails.add(bar);
      for (let k = -3; k <= 3; k++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6), railMat); post.position.set(along === 'x' ? k * 1.1 : s * 3.3, 0.52, along === 'x' ? s * 3.3 : k * 1.1); T.roofRails.add(post); }
    }
  }
  tower.add(T.roofRails);
  // ladder on the land side
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, ROOF1 + 1.2, 8), railMat); r.position.set(s * 0.3, (ROOF1 + 1.2) / 2, 3.45); T.ladder.add(r); }
  for (let y = 0.4; y < ROOF1 + 1; y += 0.32) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), railMat); r.rotation.z = Math.PI / 2; r.position.set(0, y, 3.45); T.ladder.add(r); }
  tower.add(T.ladder);
  // spiral ramp up to the level-1 slab
  const turns = 1.25, steps = 220, r0 = 5.6, wR = 1.7, a0 = Math.PI / 2;
  const v = [], ix = [], rv = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, a = a0 + u * turns * Math.PI * 2, y = 0.1 + u * (SLAB1 + 0.35);
    const ci = Math.cos(a), si = Math.sin(a);
    v.push((r0 - wR / 2) * si, y, (r0 - wR / 2) * ci, (r0 + wR / 2) * si, y, (r0 + wR / 2) * ci, (r0 - wR / 2) * si, y - 0.3, (r0 - wR / 2) * ci, (r0 + wR / 2) * si, y - 0.3, (r0 + wR / 2) * ci);
    if (i < steps) { const b = i * 4; ix.push(b, b + 4, b + 1, b + 1, b + 4, b + 5, b + 3, b + 7, b + 1, b + 1, b + 7, b + 5, b + 2, b + 6, b + 3, b + 3, b + 6, b + 7); }
    rv.push((r0 + wR / 2) * si, y + 1.0, (r0 + wR / 2) * ci);
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); rg.setIndex(ix); rg.computeVertexNormals();
  T.ramp = new THREE.Mesh(rg, M.concrete); T.ramp.castShadow = T.ramp.receiveShadow = true; tower.add(T.ramp);
  T.ramp.userData.total = ix.length; T.ramp.userData.turns = turns; T.ramp.userData.r0 = r0; T.ramp.userData.a0 = a0;
  const railPts = []; for (let i = 0; i < rv.length; i += 3) railPts.push(V(rv[i], rv[i + 1], rv[i + 2]));
  T.rampRails = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 220, 0.045, 6), M.steel); tower.add(T.rampRails);
  T.rampPosts = new THREE.Group();
  for (let i = 0; i <= 44; i++) { const u = i / 44, a = a0 + u * turns * Math.PI * 2, y = 0.1 + u * (SLAB1 + 0.35); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6), M.steel); p.position.set((r0 + wR / 2) * Math.sin(a), y + 0.5, (r0 + wR / 2) * Math.cos(a)); p.userData.u = u; T.rampPosts.add(p); }
  tower.add(T.rampPosts);
  // ramp supports
  for (let i = 1; i < 8; i++) { const u = i / 8, a = a0 + u * turns * Math.PI * 2, y = 0.1 + u * (SLAB1 + 0.35); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, y + 1), M.concrete); c.position.set(r0 * Math.sin(a), (y - 1) / 2, r0 * Math.cos(a)); c.userData.u = u; c.castShadow = true; T.rampPosts.add(c); }
}
function rampPoint(u, lane = 0) { const d = T.ramp.userData, a = d.a0 + u * d.turns * Math.PI * 2, r = d.r0 + lane; return { x: r * Math.sin(a), z: r * Math.cos(a), y: 0.1 + u * (SLAB1 + 0.35), yaw: a + Math.PI / 2 }; }

// three-story house for scale
const house = new THREE.Group(); scene.add(house);
{
  const wallM = new THREE.MeshStandardMaterial({ color: '#e9dcc6', roughness: 0.9 }), roofM = new THREE.MeshStandardMaterial({ color: '#a8442f', roughness: 0.8 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(7, 9.6, 6), wallM); b.position.y = 4.8; b.castShadow = b.receiveShadow = true; house.add(b);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.3, 2.4, 4), roofM); roof.position.y = 10.8; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.86); roof.castShadow = true; house.add(roof);
  for (let f = 0; f < 3; f++) for (let k = -1; k <= 1; k++) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.06), M.glass); w.position.set(k * 2.1, 1.7 + f * 3.2, s * 3.02); house.add(w); }
  for (let f = 1; f < 3; f++) { const band = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.18, 6.1), new THREE.MeshStandardMaterial({ color: '#cbbca4' })); band.position.y = f * 3.2; house.add(band); }
  house.position.set(-11, 0, 4);
}

// debris: boats and cars carried by the flood
function makeBoat(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 4.4, 2, 2, 4), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
  const p = hull.geometry.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) < 0) p.setX(i, p.getX(i) * 0.45); if (p.getZ(i) > 1.5) p.setX(i, p.getX(i) * (1 - (p.getZ(i) - 1.5) / 1.4)); }
  hull.geometry.computeVertexNormals(); hull.castShadow = true; g.add(hull);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.4), new THREE.MeshStandardMaterial({ color: '#f4f4f0' })); cab.position.set(0, 0.7, -0.4); cab.castShadow = true; g.add(cab);
  scene.add(g); return g;
}
function makeCar(color) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.6, 4.1), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 })); b.position.y = 0.5; b.castShadow = true; g.add(b);
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 2.0), M.glass); c.position.set(0, 1.05, -0.2); g.add(c);
  for (const x of [-0.8, 0.8]) for (const z of [-1.3, 1.3]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14).rotateZ(Math.PI / 2), M.dark); w.position.set(x, 0.3, z); g.add(w); }
  scene.add(g); return g;
}
const DEBRIS = [
  { o: makeBoat('#2d6fd6'), x: -2.2, z0: -26, delay: 0.0, spin: 0.6, kind: 'boat' },
  { o: makeCar('#d6322d'), x: 2.3, z0: -30, delay: 0.25, spin: -0.8, kind: 'car' },
  { o: makeBoat('#f1f1ec'), x: 0.2, z0: -36, delay: 0.45, spin: 0.9, kind: 'boat' },
  { o: makeCar('#f0b52a'), x: -3.6, z0: -40, delay: 0.6, spin: 1.1, kind: 'car' },
  { o: makeCar('#3a3f46'), x: 3.8, z0: -44, delay: 0.75, spin: -1.2, kind: 'car' },
];

// rooftop props: blanket, radio, crab
const props = new THREE.Group(); scene.add(props);
const crab = new THREE.Group();
{
  const blanket = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < w; i += 32) { g.fillRect(i, 0, 10, h); g.fillRect(0, i, w, 10); } g.fillStyle = 'rgba(30,30,80,0.3)'; for (let i = 16; i < w; i += 64) { g.fillRect(i, 0, 6, h); g.fillRect(0, i, w, 6); } }), roughness: 0.95 }));
  blanket.position.set(-0.6, 0.02, 0.6); blanket.receiveShadow = true; props.add(blanket);
  const radio = new THREE.Group();
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.16), new THREE.MeshStandardMaterial({ color: '#3b3f44', roughness: 0.5 })); rb.position.y = 0.15; rb.castShadow = true; radio.add(rb);
  const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20).rotateX(Math.PI / 2), M.steel); spk.position.set(-0.11, 0.15, 0.085); radio.add(spk);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6), M.steel); ant.position.set(0.18, 0.55, 0); ant.rotation.z = -0.4; radio.add(ant);
  radio.position.set(0.9, 0.02, 1.2); props.add(radio);
  const red = new THREE.MeshStandardMaterial({ color: '#d4401f', roughness: 0.45 });
  const cb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), red); cb.scale.set(1.3, 0.5, 1); cb.castShadow = true; crab.add(cb);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.22), red); l.position.set(s * 0.2, -0.03, -0.08 + k * 0.08); l.rotation.z = s * 1.0; l.userData.leg = s * (k + 1); crab.add(l); }
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), red); claw.position.set(s * 0.17, 0.02, 0.17); claw.scale.set(1, 0.7, 1.4); crab.add(claw);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color: '#111' })); eye.position.set(s * 0.05, 0.1, 0.12); crab.add(eye);
  }
  scene.add(crab);
}

// ---------------------------------------------------------------- camera per line
// [pos0, pos1, look0, look1, fov]
const CAMS = [
  [V(6.5, 3.6, 7.5), V(4.6, 2.8, 5.4), V(0, 0, -2), V(0, -0.2, -1), 52],              // 0 dig a hole
  [V(10, 4.5, 7), V(7.5, 3.2, 8.5), V(0, 0, -6), V(0, 0, -2), 54],                      // 1 wave fills it
  [V(3.2, 1.2, 5), V(4.5, 11, 10), V(0, 0.8, -1), V(0, 7, -6), 56],                     // 2 go up (crane)
  [V(11, 5, 11), V(8.5, 6.5, 9), V(0, 2, 0), V(0, 2.8, -1), 52],                        // 3 sand hill
  [V(15, 7, 13), V(12, 6, 15), V(0, 2, -6), V(0, 1.5, -2), 56],                         // 4 wave washes hill
  [V(13, 6, 13), V(10.5, 9, 10.5), V(0, 3, 0), V(0, 4.5, 0), 52],                       // 5 concrete tower
  [V(13, 10, -15), V(11, 9, -12.5), V(0, 3.5, -2), V(0, 3.8, -2.5), 54],                // 6 cracks
  [V(9.5, 2.6, 9.5), V(6.5, 2.2, 6.5), V(0, 2.2, -1), V(0, 2.4, -2), 54],               // 7 open floor
  ['orbit', 22, 9, 0.55, 1.45, V(0, 4.5, 0), 50],                                     // 8 this is a tsunami tower
  [V(8, 3.6, 7.5), V(6, 2.6, 5.6), V(0, -0.8, 0), V(0, -0.9, 0), 56],                   // 9 scour
  [V(16, 0.5, 0.01), V(19, -4, 0.01), V(0, -3, 0), V(0, -6.5, 0), 58],                  // 10 piles x-ray
  [V(9, 4.2, -10), V(7.5, 3.4, -7.5), V(0, 1.5, -2), V(0, 1.4, -1), 54],               // 11 boats & cars
  [V(7.5, 3.2, 7.5), V(5.5, 3, 5), V(0, 1.6, -2), V(0, 1.6, -3), 54],                   // 12 round columns
  [V(9, 4.5, 13), V(6.5, 6, 10), V(0, 3, 1), V(0, 5, 1), 52],                           // 13 minutes of warning
  ['orbit', 24, 11, 0.75, 1.85, V(0, 3.5, 0), 52],                                      // 14 ramp
  [V(8, 7, 30), V(7, 7.5, 27), V(-5, 5.5, -12), V(-5, 6, -12), 60],                     // 15 3-story house
  [V(16, 8, 17), V(13, 11, 13), V(0, 7, 0), V(0, 9, 0), 54],                            // 16 roof +30%
  [V(15, 12, 16), V(18, 14, 21), V(-3, -1, -20), V(-3, -1.5, -24), 58],                 // 17 sea pulls back
  [V(11.5, 3.2, 11.5), V(9, 2.8, 9), V(0, 2.4, -1), V(0, 2.4, -2), 54],                 // 18 empty on purpose
  [V(20, 7, 9), V(17, 6.5, 6), V(0, 4, -3), V(0, 4, 0), 56],                            // 19 wave goes through
  [V(3.4, 15.6, 4.6), V(2.6, 15, 3.6), V(0, 13.2, 0.4), V(0, 13.1, 0.5), 54],           // 20 blanket radio crab
  [V(9, 17, 11), V(22, 24, 30), V(0, 9, 0), V(0, 7, 0), 52],                            // 21 congratulations
];
// extra wide angles: [order, split]. 'W1' = wide first then the main shot, 'W2' = main shot then wide.
const WIDES = { 0: ['W1', 0.4], 1: ['W1', 0.36], 3: ['W2', 0.58], 4: ['W1', 0.38], 5: ['W2', 0.55], 6: ['W1', 0.3], 7: ['W1', 0.33],
  9: ['W2', 0.62], 11: ['W1', 0.32], 12: ['W2', 0.5], 13: ['W1', 0.42], 16: ['W2', 0.55], 17: ['W1', 0.5], 18: ['W2', 0.55], 20: ['W1', 0.28] };
function wideCam(i, q) {
  // high, wide establishing angles that change side every time
  const base = [0.5, -0.7, 1.0, -1.1, 0.25, -0.35, 1.25, -0.9, 0.75, -0.2, 1.1, -0.6, 0.4, -1.2, 0.9, -0.45, 0.15, -1.0, 0.6, -0.8, 1.2, -0.3][i];
  const a = base + 0.18 * q, r = i >= 15 ? 38 : 30, h = i >= 15 ? 18 : 13;
  const lookY = i >= 16 ? 6 : i === 20 ? 12 : 2.5;
  camera.position.set(r * Math.sin(a), h + 2 * q, r * Math.cos(a));
  camera.fov = 50; camera.lookAt(0, lookY, -3); camera.updateProjectionMatrix();
}
function setCamera(t) {
  const i = lineAt(t);
  const wd = WIDES[i];
  if (wd) {
    const pr = P(i, t), [ord, sp] = wd;
    if (ord === 'W1' && pr < sp) return wideCam(i, pr / sp);
    if (ord === 'W2' && pr >= sp) return wideCam(i, (pr - sp) / (1 - sp));
  }
  const c = CAMS[i], p = easeIO(P(i, t));
  if (c[0] === 'orbit') {
    const [, r, h, a0, a1, look, fov] = c; const a = lerp(a0, a1, P(i, t));
    camera.position.set(r * Math.sin(a), h, r * Math.cos(a)); camera.fov = fov; camera.lookAt(look);
  } else {
    camera.position.copy(c[0]).lerp(c[1], p); camera.fov = c[4];
    camera.lookAt(c[2].clone().lerp(c[3], p));
  }
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- the story: state at time t
function wave(i, t, startFrac, passFrac, crestAbs, level, dist = 70) {
  // a front that reaches z=0 (the site) at passFrac of line i
  const t0 = lerp(LS[i], lineEnd(i), startFrac), tp = lerp(LS[i], lineEnd(i), passFrac);
  if (t < t0) return null;
  const v = dist / (tp - t0);
  return { zf: -dist + v * (t - t0), crest: crestAbs, level };
}
function setState(t) {
  const L = lineAt(t);
  rs = 999;
  WS.sea = -1.0; WS.waves = []; WS.flow = 0; WS.flowLevel = -9;
  GS.hole = 0; GS.hill = 0; GS.hillErode = 0; GS.scour = 0; GS.xray = 0;
  solid.visible = false; tower.visible = false; house.visible = false; props.visible = false; crab.visible = false; strata.visible = false;
  for (const h of [worker, ...FAMILY]) h.root.visible = false;
  for (const d of DEBRIS) d.o.visible = false;
  shovel.visible = false;
  tower.rotation.set(0, 0, 0);
  groundMat.opacity = 1; groundMat.depthWrite = true;
  const tw = t * 6;

  if (L === 0) {
    const p = P(0, t);
    GS.hole = 1.7 * easeOut(p / 0.75);
    const pit = -GS.hole;
    place(worker, 0.4, 0.2, -2.4, Math.min(groundH(0.4, 0.2), 0) + Math.max(0, pit * 0) ); worker.root.position.y = Math.max(pit + 0.02, -1.7);
    pose(worker, 'dig', tw * 1.3); shovel.visible = true;
    WS.waves.push({ zf: -170 + p * 20, crest: 1.6, level: 0.2 });
  } else if (L === 1) {
    const p = P(1, t);
    GS.hole = 1.7;
    const w = wave(1, t, 0.0, 0.42, 0.9, 0.35, 80); if (w) WS.waves.push(w);
    // worker scrambles out of the hole toward the land
    const out = smooth(0.38, 0.8, p);
    const z = lerp(0.3, 2.6, out), y = lerp(-1.65, groundH(0, 2.6), smooth(0.4, 0.75, p));
    place(worker, 0.2, z, 0.0, y); pose(worker, p < 0.38 ? 'look' : p < 0.78 ? 'climb' : 'run', tw * 2.2);
  } else if (L === 2) {
    const p = P(2, t);
    GS.hole = 1.7 * (1 - smooth(0.5, 1, p));
    WS.flowLevel = 0.15 - 0.6 * p; WS.flow = 0.3;
    place(worker, 1.2, 3.0, -0.5); pose(worker, 'look', tw);
  } else if (L === 3) {
    const p = P(3, t);
    GS.hill = 4.2 * easeOut(p / 0.6); GS.hillR = 5.2;
    if (p < 0.6) { place(worker, 3.3, 3.0, -2.2); pose(worker, 'dig', tw * 1.5); shovel.visible = true; }
    else { const k = smooth(0.6, 1, p); const x = lerp(3.0, 0.2, k), z = lerp(2.8, 0.2, k); place(worker, x, z, -2.4); pose(worker, 'climb', tw * 2); }
  } else if (L === 4) {
    const p = P(4, t);
    GS.hill = 4.2; GS.hillR = 5.2; GS.hillErode = smooth(0.42, 0.9, p) * 0.93;
    const w = wave(4, t, 0.0, 0.45, 4.6, 2.2, 90); if (w) WS.waves.push(w);
    // worker runs off the hill inland, then the water level drops
    const k = smooth(0.15, 0.6, p);
    place(worker, lerp(0.2, 4, k), lerp(0.2, 13, k), 0.3); pose(worker, k > 0 && k < 1 ? 'run' : 'stand', tw * 2.4);
    if (k <= 0) worker.root.position.y = groundH(0.2, 0.2);
  } else if (L === 5) {
    const p = P(5, t);
    solid.visible = true; const g = easeOut(p / 0.8);
    halves.forEach((h) => { h.scale.set(1, Math.max(0.02, g), 1); h.rotation.set(0, 0, 0); h.position.y = 0; });
    solid.userData.crack.visible = false; solid.children.forEach((c) => { if (c.userData.branch) c.visible = false; });
    place(worker, 5.5, 4.0, -0.9); pose(worker, 'stand', tw); if (p > 0.85) { place(worker, 0.5, 0.5, -2.4, 8.0 * g); pose(worker, 'cheer', tw); }
  } else if (L === 6) {
    const p = P(6, t);
    solid.visible = true;
    const w = wave(6, t, 0.0, 0.35, 5.5, 2.6, 80); if (w) WS.waves.push(w);
    const crack = smooth(0.36, 0.55, p), split = smooth(0.6, 0.95, p);
    solid.userData.crack.visible = crack > 0; solid.userData.crack.scale.y = crack;
    solid.children.forEach((c, k) => { if (c.userData.branch) c.visible = crack > 0.4 + 0.08 * (k % 6); });
    halves.forEach((h, k) => { const s = k ? 1 : -1; h.scale.set(1, 1, 1); h.rotation.set(-split * 0.12, 0, s * split * 0.16); h.position.set(s * (1.5 + split * 0.8), 0, split * 0.6); });
    place(worker, 0.5, 0.8, -2.4, 8.0 + split * 0.3); pose(worker, split > 0.1 ? 'climb' : 'stand', tw * 3);
    worker.root.rotation.z = split * 0.3;
  } else if (L >= 7) {
    tower.visible = true;
    // column style: square until line 12 morphs them round
    const rk = L > 12 ? 1 : L === 12 ? easeOut(P(12, t) / 0.35) : 0;
    T.colSq.forEach((c) => { c.visible = rk < 1; c.scale.set(1 - rk, 1, 1 - rk); });
    T.colRd.forEach((c) => { c.visible = rk > 0; c.scale.set(rk, 1, rk); });
    // level 2 / roof height
    const g2 = L > 16 ? 1 : L === 16 ? easeOut(smooth(0.1, 0.7, P(16, t))) : 0;
    T.level2.visible = g2 > 0; T.level2.scale.y = Math.max(0.001, g2); T.level2.position.y = (1 - g2) * ROOF1 * 0;
    T.level2.scale.y = g2; T.level2.position.y = ROOF1 * (1 - g2) * 0;
    T.level2.children.forEach(() => {});
    T.level2.position.y = 0;
    T.level2.scale.y = 1; T.level2.visible = g2 > 0.01;
    T.level2.position.y = -(ROOF2 - ROOF1) * (1 - g2);
    T.roofRails.position.y = lerp(ROOF1 + 0.4, ROOF2 + 0.4, g2);
    // ramp
    const rp = L > 14 ? 1 : L === 14 ? easeOut(smooth(0.0, 0.55, P(14, t))) : 0;
    T.ramp.visible = rp > 0; T.rampRails.visible = rp > 0.98; T.ramp.geometry.setDrawRange(0, Math.floor(T.ramp.userData.total * rp / 18) * 18);
    T.rampPosts.children.forEach((c) => { c.visible = rp > 0 && c.userData.u <= rp; });
    T.ladder.visible = true;
    // piles (driven in line 10, then stay)
    const pl = L > 10 ? 1 : L === 10 ? easeOut(smooth(0.1, 0.75, P(10, t))) : 0;
    T.piles.forEach((pile) => { pile.visible = pl > 0; const len = 14 * pl + 0.01; pile.scale.y = len; pile.position.y = -len / 2 - 0.5; });

    if (L === 7) {
      const p = P(7, t);
      WS.flow = 1; WS.flowLevel = lerp(-0.4, 2.0, smooth(0.15, 0.5, p));
      place(worker, 0.6, -0.4, 2.6, ROOF1 + 0.4); pose(worker, 'stand', tw);
    } else if (L === 8) {
      WS.flow = 0.8; WS.flowLevel = lerp(2.0, 1.2, P(8, t));
      place(worker, 0.6, -0.4, 2.6, ROOF1 + 0.4); pose(worker, 'cheer', tw);
    } else if (L === 9) {
      const p = P(9, t);
      WS.flow = 1; WS.flowLevel = -0.35;
      GS.scour = 1.6 * easeOut(p / 0.8);
      tower.rotation.z = -0.04 * smooth(0.4, 1, p);
      place(worker, 0.6, -0.4, 2.6, ROOF1 + 0.4); pose(worker, 'look', tw);
    } else if (L === 10) {
      const p = P(10, t);
      GS.scour = 1.6 * (1 - smooth(0.6, 1, p)); tower.rotation.z = -0.04 * (1 - smooth(0.5, 0.9, p));
      strata.visible = true; groundMat.opacity = 0.18; groundMat.depthWrite = false;
      WS.sea = -1.0; WS.flowLevel = -9;
    } else if (L === 11 || L === 12) {
      const p = P(L, t);
      WS.flow = 1; WS.flowLevel = 1.6;
      DEBRIS.forEach((d, k) => {
        d.o.visible = true;
        const ts = LS[11] + d.delay, v = 15;
        const zFront = -2.2 - 0.25 - (d.kind === 'boat' ? 2.2 : 2.05);   // nose against the column face
        let z = d.z0 + v * Math.max(0, t - ts), yaw = 0, x = d.x;
        if (L === 11) {
          if (z > zFront - k * 0.0) {
            const hitT = ts + (zFront - d.z0) / v, u = t - hitT;
            z = zFront - 0.6 * Math.exp(-u * 4) * Math.sin(u * 12) * 0.3 - (Math.abs(d.x) > 3 ? -0.6 : 0);
            yaw = d.spin * easeOut(u / 0.8); x = d.x + d.spin * 0.3 * easeOut(u / 0.8);
          }
        } else {
          // round columns: everything slides around and past
          const rel = LS[12] + 0.6 + k * 0.25, u = Math.max(0, t - rel);
          z = (u > 0 ? -4.5 + 7 * u : -4.5 - k * 1.2);
          const nearest = COLS.reduce((b, c) => (Math.abs(c[0] - d.x) < Math.abs(b[0] - d.x) ? c : b));
          const dz = z - nearest[1];
          x = d.x + Math.sign(d.x - nearest[0] || 1) * 1.4 * Math.exp(-((dz / 2.2) ** 2)) * (Math.abs(d.x - nearest[0]) < 1.6 ? 1 : 0.3);
          yaw = 0.25 * Math.sin(u * 2 + k);
        }
        d.o.position.set(x, waterY(x, z, t) - (d.kind === 'boat' ? 0.25 : 0.55), z);
        d.o.rotation.set(0.04 * Math.sin(t * 3 + k), yaw, 0.05 * Math.sin(t * 2.4 + k * 2));
      });
      place(worker, 0.6, -0.4, 2.6, ROOF1 + 0.4); pose(worker, 'look', tw);
    } else if (L === 13) {
      const p = P(13, t);
      WS.flowLevel = -9; WS.flow = 0;
      // family runs in from inland and queues at the ladder; the ladder is slow
      const lad = (k) => smooth(0.3 + k * 0.18, 0.62 + k * 0.18, p);
      [worker, ...FAMILY].forEach((h, k) => {
        const arrive = smooth(0, 0.3 + k * 0.1, p);
        const qz = 4.0 + k * 1.1;
        if (lad(k) <= 0) { place(h, lerp(2 + k, 0, arrive), lerp(22 + k * 2, qz, arrive), Math.PI, undefined); pose(h, arrive < 1 ? 'run' : 'stand', tw * 2.5 + k); }
        else { const y = lad(k) * (ROOF1 - 0.6) * 0.55; place(h, 0, 3.8, Math.PI, y); pose(h, 'climb', tw * 1.2 + k); }
      });
    } else if (L === 14) {
      const p = P(14, t);
      [worker, ...FAMILY].forEach((h, k) => {
        const u = clamp((p - 0.45 - k * 0.06) / 0.45, 0, 1);
        if (u <= 0) { place(h, 1.5 + k * 0.6, 9.5 + k * 0.8, Math.PI); pose(h, 'stand', tw); }
        else { const rp = rampPoint(u, (k % 2 ? 0.35 : -0.35)); place(h, rp.x, rp.z, rp.yaw, rp.y); pose(h, 'run', tw * 2.6 + k); }
      });
    } else if (L === 15) {
      const p = P(15, t);
      house.visible = true;
      WS.waves.push({ zf: -150 + 25 * p, crest: 9.6, level: 6 });
      [worker, ...FAMILY].forEach((h, k) => { place(h, -1.5 + k * 1.0, 1.5, Math.PI, ROOF1 + 0.4); pose(h, 'look', tw + k); });
    } else if (L === 16) {
      const p = P(16, t);
      house.visible = true;
      WS.waves.push({ zf: -125 + 15 * p, crest: 9.6, level: 6 });
      const g2 = easeOut(smooth(0.1, 0.7, p));
      [worker, ...FAMILY].forEach((h, k) => { place(h, -1.5 + k * 1.0, 1.5, Math.PI, lerp(ROOF1, ROOF2, g2) + 0.4); pose(h, 'cheer', tw + k); });
    } else if (L === 17) {
      const p = P(17, t);
      WS.sea = lerp(-1.0, -3.6, smooth(0.0, 0.45, p));
      // family on the empty beach turns and runs up the ramp
      [worker, ...FAMILY].forEach((h, k) => {
        const run = smooth(0.5 + k * 0.04, 1, p);
        if (run <= 0) { place(h, -2 + k * 1.3, -12 - (k % 2), Math.PI * 0 + 0.0, undefined); h.root.rotation.y = Math.PI; pose(h, 'look', tw + k); }
        else { const u = clamp(run, 0, 1); const a = smooth(0, 0.45, u), b = smooth(0.45, 1, u);
          if (b <= 0) { place(h, lerp(-2 + k * 1.3, 0, a), lerp(-12, 5.6, a), 0); pose(h, 'run', tw * 2.8 + k); }
          else { const rp = rampPoint(b * 0.9, k % 2 ? 0.35 : -0.35); place(h, rp.x, rp.z, rp.yaw, rp.y); pose(h, 'run', tw * 2.8 + k); } }
      });
    } else if (L === 18 || L === 19) {
      const p = P(L, t);
      if (L === 18) { WS.flow = 0.4; WS.flowLevel = -0.6; }
      else { const w = wave(19, t, 0.0, 0.4, 4.4, 3.3, 70); if (w) WS.waves.push(w); }
      [worker, ...FAMILY].forEach((h, k) => { place(h, -1.8 + k * 1.2, 1.2, Math.PI, ROOF2 + 0.4); pose(h, L === 19 ? 'look' : 'stand', tw + k); });
    } else if (L === 20) {
      const p = P(20, t);
      WS.flow = 0.7; WS.flowLevel = 2.4;
      props.visible = true; props.position.set(0, ROOF2 + 0.4, 0);
      place(mom, -0.9, 0.4, 0.4, ROOF2 + 0.42); pose(mom, 'sit', tw * 0.3);
      place(kid, -0.1, 0.9, -0.3, ROOF2 + 0.42); pose(kid, 'sit', tw * 0.3);
      place(grandpa, -1.7, 1.0, 0.9, ROOF2 + 0.42); pose(grandpa, 'sit', tw * 0.3);
      place(worker, 1.6, -0.4, -0.6, ROOF2 + 0.4); pose(worker, 'stand', tw);
      crab.visible = true; const ck = smooth(0.45, 0.95, p);
      crab.position.set(lerp(2.6, 1.3, ck), ROOF2 + 0.4 + 0.06 + (ck < 0.15 ? -0.5 * (1 - ck / 0.15) : 0), lerp(3.35, 2.0, ck));
      crab.rotation.set(ck < 0.15 ? -1.2 * (1 - ck / 0.15) : 0, -2.4, 0);
      crab.children.forEach((c) => { if (c.userData.leg) c.rotation.x = 0.4 * Math.sin(t * 22 + c.userData.leg); });
    } else if (L === 21) {
      const p = P(21, t);
      WS.flow = 0.5; WS.flowLevel = lerp(2.0, 0.6, p);
      props.visible = true; props.position.set(0, ROOF2 + 0.4, 0); crab.visible = true; crab.position.set(1.3, ROOF2 + 0.46, 2.0);
      [worker, ...FAMILY].forEach((h, k) => { place(h, -1.8 + k * 1.2, 0.4, 0.4, ROOF2 + 0.4); pose(h, 'cheer', tw + k * 1.3); });
    }
  }
  // wet line on the sand follows the highest water so far
  const wet = L <= 0 ? -1 : L <= 2 ? 0.4 : L <= 4 ? 1.5 : 2.0;
  updateGround(L === 10 ? -9 : wet);
}

// ---------------------------------------------------------------- 2D overlay: captions + graphics
const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
const cg = comp.getContext('2d'); document.body.appendChild(comp);
const FONT = (s, w = 900) => `${w} ${s}px Inter, "Inter Display", sans-serif`;
function txt(text, x, y, size, fill = '#fff', stroke = '#000', lw = 0.16, align = 'center', weight = 900) {
  cg.font = FONT(size, weight); cg.textAlign = align; cg.textBaseline = 'middle'; cg.lineJoin = 'round';
  if (stroke) { cg.lineWidth = size * lw; cg.strokeStyle = stroke; cg.strokeText(text, x, y); }
  cg.fillStyle = fill; cg.fillText(text, x, y);
}
function fit(text, size, maxW, weight = 900) { cg.font = FONT(size, weight); const w = cg.measureText(text).width; return w > maxW ? size * maxW / w : size; }
function project(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, ok: p.z < 1 }; }
function tag(text, world, dx, dy, a, color = '#ffd21a') {
  if (a <= 0) return; const p = project(world); if (!p.ok) return;
  cg.globalAlpha = a;
  const tx = p.x + dx, ty = p.y + dy;
  cg.strokeStyle = '#fff'; cg.lineWidth = 5; cg.beginPath(); cg.moveTo(p.x, p.y); cg.lineTo(tx, ty); cg.stroke();
  cg.fillStyle = '#fff'; cg.beginPath(); cg.arc(p.x, p.y, 11 * a, 0, 6.3); cg.fill();
  cg.fillStyle = color; cg.beginPath(); cg.arc(p.x, p.y, 7 * a, 0, 6.3); cg.fill();
  const size = 46; cg.font = FONT(size); const w = cg.measureText(text).width + 44;
  cg.fillStyle = 'rgba(12,18,28,0.82)'; cg.beginPath(); cg.roundRect(tx - w / 2, ty - 38, w, 76, 16); cg.fill();
  cg.fillStyle = color; cg.beginPath(); cg.roundRect(tx - w / 2, ty - 38, 10, 76, [16, 0, 0, 16]); cg.fill();
  txt(text, tx + 4, ty + 2, size, '#fff', null);
  cg.globalAlpha = 1;
}
function banner(text, y, a, bg = '#d81e1e', size = 64) {
  if (a <= 0) return; cg.globalAlpha = a; const s = fit(text, size, W - 160); cg.font = FONT(s); const w = cg.measureText(text).width + 80;
  const sc = 0.85 + 0.15 * easeOut(a);
  cg.save(); cg.translate(W / 2, y); cg.scale(sc, sc);
  cg.fillStyle = bg; cg.beginPath(); cg.roundRect(-w / 2, -s * 0.85, w, s * 1.7, 22); cg.fill();
  txt(text, 0, 4, s, '#fff', null); cg.restore(); cg.globalAlpha = 1;
}
function bigNumber(text, sub, x, y, a, color = '#ffd21a', size = 200) {
  if (a <= 0) return; cg.globalAlpha = Math.min(1, a * 1.5);
  const sc = 1 + 0.35 * (1 - easeOut(a)); cg.save(); cg.translate(x, y); cg.scale(sc, sc);
  size = fit(text, size, W - 90);
  txt(text, 0, 0, size, color, '#000', 0.12); if (sub) txt(sub, 0, size * 0.62, size * 0.27, '#fff', '#000', 0.16);
  cg.restore(); cg.globalAlpha = 1;
}
function dimLine(x, yTop, yBot, label, color, a) {
  if (a <= 0) return; cg.globalAlpha = a; cg.strokeStyle = color; cg.lineWidth = 6; cg.setLineDash([]);
  cg.beginPath(); cg.moveTo(x, yBot); cg.lineTo(x, yTop); cg.moveTo(x - 24, yTop); cg.lineTo(x + 24, yTop); cg.moveTo(x - 24, yBot); cg.lineTo(x + 24, yBot); cg.stroke();
  txt(label, x + 34, (yTop + yBot) / 2, 40, color, '#000', 0.18, 'left'); cg.globalAlpha = 1;
}
function hline(y, color, label, a, dashed = true) {
  if (a <= 0) return; cg.globalAlpha = a; cg.strokeStyle = color; cg.lineWidth = 5; cg.setLineDash(dashed ? [26, 16] : []);
  cg.beginPath(); cg.moveTo(40, y); cg.lineTo(W - 40, y); cg.stroke(); cg.setLineDash([]);
  txt(label, W - 50, y - 34, 40, color, '#000', 0.18, 'right'); cg.globalAlpha = 1;
}
function caption(t) {
  let k = -1; for (let i = 0; i < WORDS.length; i++) if (t >= WORDS[i].s - 0.04) k = i;
  if (k < 0 || t > WORDS[k].e + 0.6 && (k + 1 >= WORDS.length || t < WORDS[k + 1].s - 0.04) && t - WORDS[k].e > 0.6) return;
  const w = WORDS[k].w.replace(/[.,!?]$/, '').toLowerCase();
  const pop = 1 + 0.18 * (1 - easeOut((t - WORDS[k].s + 0.04) / 0.12));
  const emph = /^(tsunami|up|bathtub|tower|30%|three-story|minutes|clay|piles|round|ramp|empty|run|congratulations|crab|radio|blanket|wave|open|solid|cracks|concrete|hill)$/.test(w.replace(/[^a-z0-9%-]/g, ''));
  cg.save(); cg.translate(W / 2, H * 0.62); cg.scale(pop, pop);
  cg.shadowColor = 'rgba(0,0,0,0.55)'; cg.shadowBlur = 18;
  txt(w, 0, 0, fit(w, 104, W - 120), emph ? '#ffd21a' : '#ffffff', '#111', 0.13);
  cg.restore();
}
function overlay(t) {
  const L = lineAt(t), p = P(L, t), A = (a, b) => smooth(a, b, p) * (1 - smooth(0.93, 1, p));
  if (L === 0) tag('BATHTUB?', V(0, -1.2, 0), -260, -330, A(0.62, 0.72));
  if (L === 1) tag('FILLS TO THE TOP', V(0, -0.4, 0), 220, -380, A(0.45, 0.55), '#5bd0ff');
  if (L === 2) { banner('GO UP', H * 0.27, A(0.55, 0.65), '#1f9d55', 110); const a = A(0.55, 0.65); if (a > 0) { cg.globalAlpha = a; cg.fillStyle = '#1f9d55'; const y0 = H * 0.42 - 60 * Math.sin(t * 6); cg.beginPath(); cg.moveTo(W / 2, y0 - 110); cg.lineTo(W / 2 + 90, y0); cg.lineTo(W / 2 + 34, y0); cg.lineTo(W / 2 + 34, y0 + 110); cg.lineTo(W / 2 - 34, y0 + 110); cg.lineTo(W / 2 - 34, y0); cg.lineTo(W / 2 - 90, y0); cg.closePath(); cg.fill(); cg.globalAlpha = 1; } }
  if (L === 3) tag('SAND HILL', V(0, 4.2, 0), 250, -260, A(0.45, 0.55));
  if (L === 4) banner('WASHED AWAY', H * 0.2, A(0.6, 0.7));
  if (L === 5) tag('SOLID CONCRETE', V(-3, 6, 0), -200, -300, A(0.5, 0.6), '#c9ced6');
  if (L === 6) { banner('CRACK!', H * 0.2, A(0.45, 0.52)); tag('FULL PUSH OF THE WAVE', V(0, 3, -3), 0, -480, A(0.3, 0.4), '#5bd0ff'); }
  if (L === 7) tag('OPEN GROUND FLOOR', V(0, 2.2, -2.2), 0, -520, A(0.35, 0.45), '#5bd0ff');
  if (L === 8) { const a = A(0.1, 0.25); if (a > 0) { cg.globalAlpha = a; txt('TSUNAMI', W / 2, H * 0.2, 150 * (0.9 + 0.1 * a), '#ffffff', '#0b2a4a', 0.14); txt('TOWER', W / 2, H * 0.2 + 150, 170 * (0.9 + 0.1 * a), '#ffd21a', '#0b2a4a', 0.14); cg.globalAlpha = 1; } }
  if (L === 9) { tag('SCOUR', V(2.2, -1.2, -2.2), 230, -260, A(0.35, 0.45), '#ff6a3a'); tag('SAND WASHED OUT', V(-2.2, -1.2, 2.2), -150, 330, A(0.5, 0.6), '#ff6a3a'); }
  if (L === 10) { tag('SAND', V(0, -3.5, 9), -250, -120, A(0.12, 0.22), '#e3c88f'); tag('HARD CLAY', V(0, -12, 9), -230, 160, A(0.3, 0.4), '#d17a4a'); tag('LONG PILES', V(0, -9, 2.2), 230, -260, A(0.5, 0.6), '#c9ced6'); }
  if (L === 11) banner('SMASH!', H * 0.2, A(0.55, 0.62));
  if (L === 12) tag('THICK + ROUND', V(-2.2, 3.4, -2.2), -200, -380, A(0.12, 0.25), '#c9ced6');
  if (L === 13) { const a = A(0.0, 0.12); if (a > 0) { const rem = Math.max(0, 600 - p * 420 - (p > 0.5 ? (p - 0.5) * 300 : 0)); const mm = String(Math.floor(rem / 60)).padStart(2, '0'), ss = String(Math.floor(rem % 60)).padStart(2, '0');
      cg.globalAlpha = a; cg.fillStyle = 'rgba(160,12,12,0.9)'; cg.beginPath(); cg.roundRect(W / 2 - 300, H * 0.14 - 95, 600, 190, 30); cg.fill();
      txt(`${mm}:${ss}`, W / 2, H * 0.14 - 10, 130, '#fff', null); txt('MINUTES OF WARNING', W / 2, H * 0.14 + 62, 40, '#ffd9d9', null); cg.globalAlpha = 1; } }
  if (L === 14) tag('WIDE RAMP', V(0, 2.4, 6.4), 220, -300, A(0.35, 0.45), '#7dff6a');
  if (L === 15) {
    const a = A(0.45, 0.55);
    if (a > 0) { const top = project(V(-11, 9.6, 4)), bot = project(V(-11, 0, 4)); dimLine(top.x - 170, top.y, bot.y, '', '#ffd21a', a); bigNumber('3', 'STORY HOUSE', top.x - 30, top.y - 150, a, '#ffd21a', 150); }
    const a2 = A(0.7, 0.8); if (a2 > 0) banner('WAVE IS EVEN TALLER', H * 0.13, a2, '#0b6fb8', 56);
  }
  if (L === 16) {
    const wave = project(V(0, 9.6, 0)), roof = project(V(0, ROOF2 + 0.4, 0));
    hline(wave.y, '#5bd0ff', 'BIGGEST WAVE', A(0.05, 0.15)); hline(roof.y, '#7dff6a', 'ROOF', A(0.6, 0.7), false);
    bigNumber('+30%', 'HIGHER THAN THE WAVE', W / 2, H * 0.18, A(0.25, 0.35), '#7dff6a', 190);
  }
  if (L === 17) { banner('SEA PULLS BACK', H * 0.12, A(0.08, 0.2), '#0b6fb8', 60); const a = A(0.62, 0.7); if (a > 0) { const fl = 0.75 + 0.25 * Math.sin(t * 18); banner("DON'T LOOK. RUN UP!", H * 0.22, a * fl, '#d81e1e', 70); } }
  if (L === 18) tag('EMPTY ON PURPOSE', V(0, 2.2, -2.2), 0, -520, A(0.45, 0.55), '#7dff6a');
  if (L === 19) banner('THE WAVE GOES THROUGH', H * 0.16, A(0.3, 0.4), '#0b6fb8', 58);
  if (L === 20) { tag('BLANKET', V(-0.6, ROOF2 + 0.42, 0.6), -260, -250, A(0.05, 0.15), '#ff6a5a'); tag('RADIO', V(0.9, ROOF2 + 0.6, 1.2), 240, -330, A(0.2, 0.3), '#c9ced6'); tag('CRAB', crab.position.clone(), 160, 260, A(0.62, 0.72), '#ff8a4a'); }
  if (L === 21) { const a = smooth(0.08, 0.3, p); if (a > 0) { bigNumber('CONGRATULATIONS!', null, W / 2, H * 0.17, a, '#ffd21a', 104); cg.globalAlpha = a; txt('YOU BUILT A', W / 2, H * 0.17 + 110, 60, '#fff', '#000', 0.16); txt('TSUNAMI TOWER', W / 2, H * 0.17 + 190, 96, '#fff', '#0b2a4a', 0.16); cg.globalAlpha = 1; } }
  caption(t);
  // cut flash between lines
  let since = t - LS[L];
  const wd = WIDES[L]; if (wd) { const ct = lerp(LS[L], lineEnd(L), wd[1]); if (t >= ct) since = t - ct; }
  if ((L > 0 || wd) && since < 0.12) { cg.fillStyle = `rgba(255,255,255,${0.3 * (1 - since / 0.12)})`; cg.fillRect(0, 0, W, H); }
}

function renderFrame(t) {
  setState(t);
  updateWater(t); updateSpray(t);
  setCamera(t);
  renderer.render(scene, camera);
  cg.drawImage(glCanvas, 0, 0);
  overlay(t);
  return comp.toDataURL('image/jpeg', 0.93);
}

window.SIM = { frameAt: (t) => renderFrame(t), duration: DURATION, lines: LINES };
window.SIM_READY = true;

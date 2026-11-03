// "Diverging Diamond" – deterministic 3D (three.js) + 2D icon overlays (no captions).
// window.renderFrame(t) -> JPEG data URL. Beat times come from the voiceover word timings.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1080, H = 1920;
const SEG = window.SEGMENTS || [];
const DUR = window.DUR || 65.0;

const cl = (x) => Math.min(1, Math.max(0, x));
const st = (a, b, t) => cl((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eo = (x) => 1 - Math.pow(1 - x, 3);
const eob = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const sstep = (a, b, x) => { const u = cl((x - a) / (b - a)); return u * u * (3 - 2 * u); };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(5);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- beats from word timings
const WORDS = SEG.flatMap((s) => s.words.map((w) => ({ w: w.w.toLowerCase().replace(/[^a-z0-9']/g, ''), s: w.s })));
function Wt(word, after = 0) { const ws = word.split('|'); const x = WORDS.find((q) => ws.includes(q.w) && q.s >= after); return x ? x.s : after + 1.5; }
const B = {};
B.interchange = Wt('interchange'); B.but1 = Wt('but', B.interchange); B.left1 = Wt('left', B.but1); B.guess = Wt('guess'); B.crash = Wt('crash', B.guess);
B.so1 = Wt('so', B.crash); B.arrow = Wt('arrow', B.so1); B.three = Wt('three'); B.backs = Wt('backs');
B.so2 = Wt('so', B.backs); B.crazy = Wt('crazy'); B.flip = Wt('flip'); B.wrong = Wt('wrong', B.flip);
B.right = Wt('right', B.wrong); B.swap = Wt('swap'); B.left2 = Wt('left', B.swap); B.onramp = Wt('onramp|ramp', B.left2); B.noone = Wt('no', B.onramp);
B.thats = Wt('that\'s', B.noone); B.diverging = Wt('diverging');
B.but2 = Wt('but', B.diverging); B.headlights = Wt('headlights'); B.wall = Wt('wall');
B.where = Wt('where', B.wall); B.turns = Wt('turns', B.where); B.two2 = Wt('two', B.turns); B.phases = Wt('phases');
B.walkers = Wt('walkers'); B.walls = Wt('walls', B.walkers);
B.first = Wt('first', B.walls); B.springfield = Wt('springfield'); B.y2009 = Wt('2009', B.springfield); B.hundred = Wt('hundred|200', B.y2009 + 0.5);
B.and3 = Wt('and', B.hundred); B.fewer = Wt('fewer');
B.add = Wt('add', B.fewer); B.painted = Wt('painted'); B.signs = Wt('signs'); B.confused = Wt('confused');
B.congrats = Wt('congratulations'); B.diamond2 = Wt('diamond', B.congrats);
window.BEATS = B;
const T = B;

// ---------------------------------------------------------------- renderer
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe3f2, 140, 330);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.3, 600);
const out = document.getElementById('out'); const ctx = out.getContext('2d');

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
function stripeTex(c1, c2, n = 8, rot = 0) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = c1; g.fillRect(0, 0, 256, 256); g.fillStyle = c2; for (let i = 0; i < n; i += 2) g.fillRect(i * 256 / n, 0, 256 / n, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const grassTex = stripeTex('#79bf4f', '#6cb246');
const mat = {
  grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
  slope: M(0x69ad45, { roughness: 0.95 }),
  asphalt: M(0x55595f, { roughness: 0.92 }), asphalt2: M(0x4a4e54, { roughness: 0.92 }),
  concrete: M(0xc9c6bd, { roughness: 0.85 }), concreteDark: M(0x9d9a92, { roughness: 0.85 }),
  paint: new THREE.MeshBasicMaterial({ color: 0xf4f4f0 }), yellowPaint: new THREE.MeshBasicMaterial({ color: 0xf5c518 }),
  pole: M(0x6f7780, { metalness: 0.6, roughness: 0.4 }), black: M(0x1c1d20),
  walk: M(0xd8c9a8, { roughness: 0.9 }),
  tire: M(0x202024, { roughness: 0.8 }), hub: M(0xd8dde3, { metalness: 0.8, roughness: 0.25 }), carGlass: M(0x1d3557, { metalness: 0.3, roughness: 0.08 }),
  head: new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff3c4, emissiveIntensity: 0.6 }), tail: new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff2233, emissiveIntensity: 0.5 }),
  leaf: M(0x3f9a45, { roughness: 0.8 }), leaf2: M(0x55b25a, { roughness: 0.8 }), trunk: M(0x7a5232), cloud: M(0xffffff, { roughness: 1 }),
  signBlue: M(0x1f5fbf), house: M(0xf3e6cc), roof: M(0xb5473a),
};
function mesh(geo, m, cast = true, recv = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
const box = (w, h, d, m, r = 0) => mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), m);

// lights & sky
const hemi = new THREE.HemisphereLight(0xd6ecff, 0x6a8f45, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.6); sun.position.set(40, 70, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 200 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; scene.add(sun);
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 vp; void main(){ float y = clamp(vp.y,0.,1.); gl_FragColor = vec4(mix(vec3(0.84,0.92,0.98), vec3(0.36,0.62,0.95), pow(y,0.5)),1.); }' }));
scene.add(sky);
const clouds = [];
for (let i = 0; i < 12; i++) { const g = new THREE.Group(); const n = 3 + Math.floor(R() * 3); for (let k = 0; k < n; k++) { const s = mesh(new THREE.SphereGeometry(4 + R() * 4, 14, 10), mat.cloud, false, false); s.position.set(k * 5 - n * 2.5, R() * 2, R() * 3); s.scale.y = 0.6; g.add(s); } g.position.set(-200 + R() * 400, 70 + R() * 30, -260 + R() * 120); g.userData = { x0: g.position.x, sp: 0.6 + R() }; scene.add(g); clouds.push(g); }

// ---------------------------------------------------------------- terrain: trench for the highway
const HW_Y = -5, TR = 12, HW_W = 9;
for (const s of [-1, 1]) {
  const g = new THREE.PlaneGeometry(700, 300); g.rotateX(-Math.PI / 2);
  const ground = mesh(g, mat.grass, false, true); ground.position.set(0, 0, s * (TR + 150));
  grassTex.repeat.set(70, 30); scene.add(ground);
  const sl = new THREE.PlaneGeometry(700, Math.hypot(TR - HW_W, -HW_Y)); sl.rotateX(-Math.PI / 2);
  const slope = mesh(sl, mat.slope, false, true); slope.position.set(0, HW_Y / 2, s * (TR + HW_W) / 2); slope.rotation.x = -s * Math.atan2(-HW_Y, TR - HW_W); scene.add(slope);
}
{ const g = new THREE.PlaneGeometry(700, HW_W * 2); g.rotateX(-Math.PI / 2); const hw = mesh(g, mat.asphalt, false, true); hw.position.y = HW_Y; scene.add(hw); }
// highway markings
for (const z of [-1, 1]) for (const zz of [1.2, 8.2]) { const l = mesh(new THREE.PlaneGeometry(700, 0.18), zz === 1.2 ? mat.yellowPaint : mat.paint, false, false); l.rotation.x = -Math.PI / 2; l.position.set(0, HW_Y + 0.02, z * zz); scene.add(l); }
{ const dg = new THREE.PlaneGeometry(3, 0.16); dg.rotateX(-Math.PI / 2); const im = new THREE.InstancedMesh(dg, mat.paint, 240); let k = 0; const m4 = new THREE.Matrix4(); for (const z of [-4.7, 4.7]) for (let i = 0; i < 120; i++) { m4.makeTranslation(-350 + i * 6, HW_Y + 0.02, z); im.setMatrixAt(k++, m4); } scene.add(im); }
{ const mb = box(700, 0.8, 0.5, mat.concrete); mb.position.set(0, HW_Y + 0.4, 0); scene.add(mb); }
// light poles along the highway
for (let i = -6; i <= 6; i++) { if (Math.abs(i) < 1) continue; const p = mesh(new THREE.CylinderGeometry(0.1, 0.14, 8, 8), mat.pole); p.position.set(i * 22, HW_Y + 4, 0); scene.add(p); const a = box(3.5, 0.15, 0.2, mat.pole); a.position.set(i * 22, HW_Y + 8, 0); a.rotation.y = Math.PI / 2; scene.add(a); }

// ---------------------------------------------------------------- local road + bridge
const ROAD_HW = 5.2, LANE = 2.6;
{
  const g = new THREE.PlaneGeometry(ROAD_HW * 2, 260); g.rotateX(-Math.PI / 2);
  for (const s of [-1, 1]) { const r = mesh(g, mat.asphalt2, false, true); r.scale.z = 0.5; r.position.set(0, 0.03, s * (TR + 65)); scene.add(r); }
  const deck = box(ROAD_HW * 2 + 1.0, 0.9, TR * 2 + 0.4, mat.concreteDark); deck.position.y = -0.42; scene.add(deck);
  const top = mesh(new THREE.PlaneGeometry(ROAD_HW * 2, TR * 2 + 0.4), mat.asphalt2, false, true); top.rotation.x = -Math.PI / 2; top.position.y = 0.035; scene.add(top);
  for (const s of [-1, 1]) { const p = box(0.4, 0.8, TR * 2 + 0.4, mat.concrete); p.position.set(s * (ROAD_HW + 0.3), 0.4, 0); scene.add(p); }
  for (const z of [-HW_W - 0.3, 0, HW_W + 0.3]) { const pier = box(ROAD_HW * 1.6, -HW_Y - 0.9, 1.0, mat.concrete); pier.position.set(0, HW_Y + (-HW_Y - 0.9) / 2, z); scene.add(pier); }
  for (const s of [-1, 1]) { const e = mesh(new THREE.PlaneGeometry(700, 0.2), mat.paint, false, false); e.rotation.x = -Math.PI / 2; e.position.set(0, 0.05, 0); }
  for (const s of [-1, 1]) { const ed = mesh(new THREE.PlaneGeometry(0.18, 260), mat.paint, false, false); ed.rotation.x = -Math.PI / 2; ed.position.set(s * (ROAD_HW - 0.3), 0.045, 0); scene.add(ed); }
}
// ramps (ribbons)
const RAMP_PTS = [[6, 0, 16], [14, 0, 15.2], [26, 0.02, 13.4], [36, -0.55, 11.6], [46, -3.2, 9.9], [56, -5, 8.4], [90, -5, 7]];
const rp = (sx, sz, rev) => { const p = RAMP_PTS.map(([x, y, z]) => V3(sx * x, y + 0.12, sz * z)); return rev ? p.reverse() : p; };
const RAMPS = { wbOn: rp(-1, -1, false), ebOn: rp(1, 1, false), ebOff: rp(-1, 1, true), wbOff: rp(1, -1, true) };
const rampCurves = {};
for (const [k, pts] of Object.entries(RAMPS)) {
  const c = new THREE.CatmullRomCurve3(pts); rampCurves[k] = c;
  const N = 120, w = 2.4, pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const p = c.getPointAt(i / N), tg = c.getTangentAt(i / N); const n = V3(-tg.z, 0, tg.x).normalize(); for (const s of [-1, 1]) pos.push(p.x + n.x * w * s, p.y + 0.04, p.z + n.z * w * s); if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const r = mesh(g, new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.92, side: THREE.DoubleSide }), false, true); scene.add(r);
  // edge lines
  for (const s of [-1, 1]) { const lp = []; for (let i = 0; i <= N; i++) { const p = c.getPointAt(i / N), tg = c.getTangentAt(i / N); const n = V3(-tg.z, 0, tg.x).normalize(); lp.push(V3(p.x + n.x * (w - 0.25) * s, p.y + 0.07, p.z + n.z * (w - 0.25) * s)); } const tube = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp), 120, 0.07, 3), mat.paint, false, false); scene.add(tube); }
}
// trees, houses, distant scenery
function tree(x, z, s) { const g = new THREE.Group(); const tr = mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 3 * s, 7), mat.trunk); tr.position.y = 1.5 * s; g.add(tr); const c = mesh(new THREE.ConeGeometry(1.6 * s, 4.2 * s, 9), R() < 0.5 ? mat.leaf : mat.leaf2); c.position.y = 4.5 * s; g.add(c); g.position.set(x, 0, z); scene.add(g); }
for (let i = 0; i < 70; i++) { const x = (R() - 0.5) * 260, z = (R() < 0.5 ? -1 : 1) * (22 + R() * 110); if (Math.abs(x) < 12) continue; if (Math.abs(z) < 30 && Math.abs(x) < 60) continue; tree(x, z, 0.8 + R() * 0.8); }
for (let i = 0; i < 10; i++) { const g = new THREE.Group(); const b = box(6, 4, 6, mat.house); b.position.y = 2; g.add(b); const r = mesh(new THREE.ConeGeometry(5, 2.6, 4), mat.roof); r.position.y = 5.3; r.rotation.y = Math.PI / 4; g.add(r); const s = R() < 0.5 ? -1 : 1; g.position.set(s * (25 + R() * 60), 0, (R() < 0.5 ? -1 : 1) * (40 + R() * 70)); g.rotation.y = R() * 3; scene.add(g); }

// ---------------------------------------------------------------- lanes (morph from normal to diverging diamond)
const XO = 22; // crossover distance from bridge centre
function ddiAmt(t) { return eio(st(T.flip - 0.1, T.wrong + 0.6, t)); }
// northbound (travels -z) uses dir=+1 ; southbound (+z) dir=-1
function laneX(dir, z, d) { const flip = 1 - 2 * sstep(XO + 3.5, XO - 3.5, Math.abs(z)); return dir * LANE * lerp(1, flip, d); }
const DASH_N = 130;
const dashGeo = new THREE.PlaneGeometry(0.16, 1.4); dashGeo.rotateX(-Math.PI / 2);
const dashes = new THREE.InstancedMesh(dashGeo, mat.paint, DASH_N * 4); scene.add(dashes);
function placeDashes(t) {
  const d = ddiAmt(t); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
  for (const dir of [1, -1]) for (const off of [-1.45, 1.45]) {
    for (let i = 0; i < DASH_N; i++) {
      const z = -129 + i * 2; const x = laneX(dir, z, d) + off; const x2 = laneX(dir, z + 0.5, d) + off;
      q.setFromAxisAngle(V3(0, 1, 0), Math.atan2(x2 - x, 0.5));
      const inner = Math.abs(off * dir + 0) < 0 ? 1 : 1;
      m4.compose(V3(x, 0.06, z), q, V3(1, 1, inner)); dashes.setMatrixAt(k++, m4);
    }
  }
  dashes.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- signals
const signals = [];
function makeSignal(x, z, face) {
  const g = new THREE.Group();
  const p = mesh(new THREE.CylinderGeometry(0.12, 0.15, 6, 8), mat.pole); p.position.y = 3; g.add(p);
  const arm = box(4.4, 0.14, 0.14, mat.pole); arm.position.set(-2.2, 5.8, 0); g.add(arm);
  const heads = [];
  for (const hx of [-1.6, -3.6]) {
    const h = new THREE.Group(); h.position.set(hx, 5.0, 0); const bx = box(0.5, 1.5, 0.4, mat.black, 0.06); h.add(bx);
    const lamps = ['#ff3b30', '#ffcc00', '#34c759'].map((c, i) => { const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(c), emissiveIntensity: 0 }); const s = mesh(new THREE.SphereGeometry(0.15, 10, 8), m, false, false); s.position.set(0, 0.45 - i * 0.45, 0.2); h.add(s); return m; });
    g.add(h); heads.push(lamps);
  }
  g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
  const s = { g, heads }; signals.push(s); return s;
}
// conventional terminals (z=±16) and DDI crossovers (z=±XO)
const sigN = makeSignal(6.2, -12.8, 0), sigS = makeSignal(-6.2, 12.8, Math.PI);
const sigXN = makeSignal(6.4, -XO + 3.5, 0), sigXS = makeSignal(-6.4, XO - 3.5, Math.PI);
function setSignal(s, state) { s.heads.forEach((lamps) => lamps.forEach((m, i) => { m.emissiveIntensity = (state === 'r' && i === 0) || (state === 'y' && i === 1) || (state === 'g' && i === 2) ? 3 : 0.0; m.color.setHex((state === 'r' && i === 0) || (state === 'y' && i === 1) || (state === 'g' && i === 2) ? 0xffffff : 0x222222); })); }
// left-turn arrow lamp
const arrowLamp = (() => { const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x34c759, emissiveIntensity: 0 }); const sh = new THREE.Shape(); sh.moveTo(0.18, -0.08); sh.lineTo(-0.02, -0.08); sh.lineTo(-0.02, -0.16); sh.lineTo(-0.2, 0); sh.lineTo(-0.02, 0.16); sh.lineTo(-0.02, 0.08); sh.lineTo(0.18, 0.08); const g = new THREE.ShapeGeometry(sh); const bx = box(0.5, 0.5, 0.4, mat.black, 0.06); bx.position.set(-1.6, 4.0, 0); const ar = new THREE.Mesh(g, m); ar.position.set(-1.6, 4.0, 0.21); sigN.g.add(bx); sigN.g.add(ar); bx.visible = ar.visible = false; return { m, bx, ar }; })();

// ---------------------------------------------------------------- medians, walls, walkway, painted arrows, signs
const wallC = box(0.35, 1.1, XO * 2 - 7, mat.concrete); scene.add(wallC);
const walls2 = [-1, 1].map(() => { const w = box(0.3, 1.0, XO * 2 - 7, mat.concrete); scene.add(w); return w; });
const walkway = box(1.5, 0.12, XO * 2 - 7, mat.walk); scene.add(walkway);
const paintedArrows = [];
{
  const sh = new THREE.Shape(); sh.moveTo(-0.25, -1.2); sh.lineTo(0.25, -1.2); sh.lineTo(0.25, 0.2); sh.lineTo(0.7, 0.2); sh.lineTo(0, 1.2); sh.lineTo(-0.7, 0.2); sh.lineTo(-0.25, 0.2); sh.closePath();
  const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
  for (const dir of [1, -1]) for (const z of [-34, -10, 6, 30]) { const a = new THREE.Mesh(g, mat.paint); a.userData = { dir, z }; scene.add(a); paintedArrows.push(a); }
}
const signCanvas = document.createElement('canvas'); signCanvas.width = signCanvas.height = 256;
{ const c = signCanvas.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#111'; c.fillRect(10, 10, 236, 236); c.fillStyle = '#fff'; c.fillRect(18, 18, 220, 220); c.strokeStyle = '#111'; c.lineWidth = 22; c.lineCap = 'round'; c.beginPath(); c.moveTo(128, 210); c.lineTo(128, 60); c.stroke(); c.fillStyle = '#111'; c.beginPath(); c.moveTo(128, 30); c.lineTo(78, 95); c.lineTo(178, 95); c.fill(); c.strokeStyle = '#d00'; c.lineWidth = 14; c.beginPath(); c.moveTo(60, 150); c.lineTo(100, 150); c.moveTo(156, 150); c.lineTo(196, 150); c.stroke(); }
const signTex = new THREE.CanvasTexture(signCanvas); signTex.colorSpace = THREE.SRGBColorSpace;
const roadSigns = [];
for (const [x, z, ry] of [[-6.4, 30, Math.PI], [6.4, -30, 0], [-6.4, -8, Math.PI], [6.4, 8, 0]]) {
  const g = new THREE.Group(); const p = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), mat.pole); p.position.y = 1.3; g.add(p);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({ map: signTex })); s.position.set(0, 2.8, 0.05); g.add(s);
  const back = box(1.45, 1.45, 0.05, mat.pole); back.position.set(0, 2.8, -0.01); g.add(back);
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); roadSigns.push(g);
}

// ---------------------------------------------------------------- people (pedestrians)
function makePed(shirt, pants, skin, hair) {
  const g = new THREE.Group(); const sm = M(shirt), pm = M(pants), km = M(skin), hm = M(hair);
  const body = mesh(new THREE.CapsuleGeometry(0.28, 0.45, 4, 10), sm); body.position.y = 1.25; g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.27, 14, 12), km); head.position.y = 1.9; g.add(head);
  const hr = mesh(new THREE.SphereGeometry(0.29, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hm); hr.position.y = 1.93; hr.rotation.x = -0.3; g.add(hr);
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.05, 8, 6), mat.black, false); e.position.set(s * 0.1, 1.95, 0.24); g.add(e); }
  const legs = [], arms = [];
  for (const s of [-1, 1]) { const hp = new THREE.Group(); hp.position.set(s * 0.14, 0.9, 0); const l = mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), pm); l.position.y = -0.4; hp.add(l); g.add(hp); legs.push(hp); const sh = new THREE.Group(); sh.position.set(s * 0.36, 1.5, 0); const a = mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), sm); a.position.y = -0.32; sh.add(a); g.add(sh); arms.push(sh); }
  g.userData = { legs, arms }; g.scale.setScalar(0.85); scene.add(g); return g;
}
const peds = [[0xff7f50, 0x2f4858, 0xf1c27d, 0x3b2416], [0x33a1fd, 0x333333, 0x8d5524, 0x111111], [0xf7b801, 0x6d597a, 0xffdbac, 0xb5651d], [0x7bc950, 0x22223b, 0xc68642, 0x2b1b10], [0xe63946, 0x1d3557, 0xf1c27d, 0x6b3e26]].map((c) => makePed(...c));

// ---------------------------------------------------------------- cars
const COLORS = [0x2a9df4, 0x2ec27e, 0xff8c1a, 0x9b5de5, 0x00bbf9, 0xf15bb5, 0x43aa8b, 0xf3722c, 0x577590, 0x3a86ff, 0x8ac926, 0xffd23f, 0x1982c4, 0xef476f, 0x06d6a0, 0xfb8500, 0x4361ee, 0xffffff, 0x9aa5b1, 0x2b2d42];
function makeCar(color) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.35 });
  const lower = mesh(new RoundedBoxGeometry(1.04, 0.42, 2.0, 2, 0.14), paint); lower.position.y = 0.42; body.add(lower);
  const cab = mesh(new RoundedBoxGeometry(0.9, 0.4, 1.08, 2, 0.14), mat.carGlass); cab.position.set(0, 0.78, -0.1); body.add(cab);
  const roof = mesh(new RoundedBoxGeometry(0.94, 0.09, 0.98, 2, 0.04), paint); roof.position.set(0, 0.98, -0.12); body.add(roof);
  for (const x of [-0.3, 0.3]) { const h = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.04), mat.head, false, false); h.position.set(x, 0.48, 1.0); body.add(h); const tl = mesh(new THREE.BoxGeometry(0.22, 0.08, 0.04), mat.tail, false, false); tl.position.set(x, 0.5, -1.0); body.add(tl); }
  const wheels = [];
  for (const [x, z] of [[-0.5, 0.64], [0.5, 0.64], [-0.5, -0.64], [0.5, -0.64]]) { const w = new THREE.Group(); w.position.set(x, 0.21, z); const tire = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.17, 14), mat.tire); tire.rotation.z = Math.PI / 2; w.add(tire); g.add(w); wheels.push(w); }
  g.userData = { wheels, paint }; g.scale.setScalar(1.35); scene.add(g); return g;
}
// highway traffic
const HWY = [];
for (let i = 0; i < 26; i++) { const dir = i % 2 ? 1 : -1; const lane = (i >> 1) % 2 ? 3.0 : 6.4; HWY.push({ car: makeCar(COLORS[i % COLORS.length]), dir, z: dir * lane, off: R() * 240, v: 9 + R() * 4 }); }
// local road pool
const LOC = []; for (let i = 0; i < 34; i++) LOC.push(makeCar(COLORS[(i * 7 + 3) % COLORS.length]));
const hero = makeCar(0xe63946); const rival = makeCar(0xf5f5f5);

function placeOnPath(car, p, p2, spin) {
  car.visible = true; car.position.copy(p);
  const dx = p2.x - p.x, dz = p2.z - p.z, dy = p2.y - p.y;
  car.rotation.set(0, Math.atan2(dx, dz), 0, 'YXZ'); car.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
  car.userData.wheels.forEach((w) => { w.rotation.x = spin; });
}
// a straight local-road path at distance s for direction dir
function localPt(dir, s, d) { const z = dir > 0 ? 130 - s : -130 + s; return V3(laneX(dir, z, d), 0.05, z); }
function placeLocal(car, dir, s, d) { placeOnPath(car, localPt(dir, s, d), localPt(dir, s + 0.6, d), s / 0.28); }

// curve paths built per phase (hero turns)
function heroCurve(ddi) {
  const pts = ddi ? [V3(LANE, 0.05, 70), V3(LANE, 0.05, XO + 6), V3(0, 0.05, XO), V3(-LANE, 0.05, XO - 6), V3(-LANE, 0.05, -11), V3(-3.4, 0.05, -14.6), V3(-6, 0.05, -16)]
    : [V3(LANE, 0.05, 70), V3(LANE, 0.05, -11.5), V3(1.6, 0.05, -14.8), V3(-1.5, 0.05, -16.4), V3(-6, 0.05, -16)];
  const r = rampCurves.wbOn.points.slice(1);
  return new THREE.CatmullRomCurve3([...pts, ...r]);
}
const curveConv = heroCurve(false), curveDDI = heroCurve(true);
const LCONV = curveConv.getLength(), LDDI = curveDDI.getLength();
function placeCurve(car, curve, L, s) { const u = cl(s / L), u2 = cl((s + 0.6) / L); placeOnPath(car, curve.getPointAt(u), curve.getPointAt(Math.min(1, u2 + 1e-4)), s / 0.28); }

// stream with a signal queue: free path s0+v*t, held behind stop position while red
function queued(i, s0, v, t, stopS, tr, tg, gap = 3.6) {
  const free = s0 + v * t;
  const atR = s0 + v * tr;
  // rank among blocked cars computed by caller-provided list
  return { free, atR };
}

// ---------------------------------------------------------------- scene logic for traffic
function placeTraffic(t) {
  const d = ddiAmt(t);
  // highway: always flowing
  HWY.forEach((h) => { const x = ((h.off + h.v * t) % 240) - 120; const p = V3(h.dir * x, HW_Y + 0.02, h.z); placeOnPath(h.car, p, V3(p.x + h.dir, p.y, p.z), x / 0.28); });
  LOC.forEach((c) => (c.visible = false)); hero.visible = false; rival.visible = false;
  let used = 0; const take = () => LOC[used++];
  const flow = (dir, n, v, gap, phase, skip = () => false) => { for (let i = 0; i < n; i++) { const s = ((phase + v * t + i * gap) % (n * gap)) + (260 - n * gap) / 2; if (skip(s, i)) continue; const c = take(); if (!c) return; placeLocal(c, dir, s, d); } };

  if (t < T.but1 - 0.05) { // intro: normal two-way traffic, signals cycling
    flow(1, 9, 9, 13, 0); flow(-1, 9, 9, 13, 6);
    setSignal(sigN, 'g'); setSignal(sigS, 'g');
  } else if (t < T.so1 - 0.05) { // left turn across oncoming traffic -> crash
    // oncoming southbound stream
    const tc = T.crash - 0.15;
    setSignal(sigN, 'g'); setSignal(sigS, 'g');
    // rival = the oncoming car that hits the hero
    const rS = 130 - 16.4; // z of conflict
    const rs = lerp(rS - 32, rS, st(T.guess - 0.6, tc, t)) + Math.max(0, t - tc) * 1.2;
    flow(-1, 8, 10, 14, 3, (s) => Math.abs(s - rs) < 10);
    const hs = LCONV * 0;
    // hero waits near the stop line then goes on "guess wrong"
    const waitS = 130 - (-11.5);
    let s = Math.min(waitS, (t - T.but1) * 14 + waitS - 22);
    if (t > T.guess) s = waitS + (t - T.guess) * 7;
    const tcS = waitS + (tc - T.guess) * 7;
    if (t > tc) s = tcS + (1 - Math.exp(-(t - tc) * 4)) * 1.0;
    const startP = curveConv.getPointAt(0); // unused
    placeCurve(hero, curveConv, LCONV, s - (130 - 70));
    if (t > tc) { const k = 1 - Math.exp(-(t - tc) * 3.5); hero.rotation.y += 0.7 * k; }
    placeLocal(rival, -1, Math.min(rs, rS - 2 + 0), d);
    if (t > tc) { const k = 1 - Math.exp(-(t - tc) * 3.5); rival.rotation.y -= 0.6 * k; rival.position.x -= 0.6 * k; }
    // northbound others queued behind the hero
    for (let i = 0; i < 4; i++) { const c = take(); placeLocal(c, 1, waitS - 70 - 4.5 * (i + 1) + 70 - 0, d); }
  } else if (t < T.so2 - 0.05) { // green arrow, then three cycles + queue over the bridge
    const arrowOn = t > T.arrow - 0.2 && t < T.three - 0.1;
    setSignal(sigN, t < T.three ? 'r' : ['r', 'g', 'y'][Math.floor((t - T.three) * 1.6) % 3]);
    setSignal(sigS, t < T.three ? 'r' : ['g', 'y', 'r'][Math.floor((t - T.three) * 1.6) % 3]);
    arrowLamp.m.emissiveIntensity = arrowOn ? 3 : 0; arrowLamp.m.color.setHex(arrowOn ? 0xffffff : 0x222222);
    const waitS = 130 - (-11.5);
    const s = t < T.arrow ? waitS : waitS + (t - T.arrow) * 9;
    placeCurve(hero, curveConv, LCONV, s - 60);
    // queue: northbound cars stopped from the stop line back over the bridge
    const grow = st(T.three - 0.5, T.backs + 0.8, t);
    const nq = Math.round(3 + grow * 10);
    for (let i = 0; i < nq; i++) { const c = take(); const z = -10.5 + i * 3.6; placeLocal(c, 1, 130 - z, d); }
    flow(-1, 6, 7, 18, 4, (s2) => 130 - (-130 + s2) < 0 && false);
  } else if (t < T.thats - 0.05) { // flip to the wrong side; hero takes the easy left
    setSignal(sigN, 'g'); setSignal(sigS, 'g'); setSignal(sigXN, d > 0.5 ? 'g' : 'r'); setSignal(sigXS, d > 0.5 ? 'g' : 'r');
    arrowLamp.m.emissiveIntensity = 0;
    const hs = t > T.right - 0.3 ? (t - (T.right - 0.3)) * 11.5 + (130 - 70) - 26 : -999;
    flow(1, 8, 8, 14, 2, (s2) => Math.abs(s2 - (hs + 60)) < 9); flow(-1, 8, 8, 14, 9);
    if (hs > -999) placeCurve(hero, curveDDI, LDDI, hs);
  } else if (t < T.but2 - 0.05) { flow(1, 10, 9, 13, 2); flow(-1, 10, 9, 13, 8); setSignal(sigXN, 'g'); setSignal(sigXS, 'g'); }
  else if (t < T.where - 0.05) { // headlights beside you, wall goes up
    flow(1, 8, 8, 14, 5); flow(-1, 8, 8, 14, 1);
    placeLocal(hero, 1, 130 - lerp(16, -4, st(T.but2, T.where, t)), d);
  } else if (t < T.walkers - 0.05) { // crossover light: sides take turns
    const half = (T.walkers + T.where) / 2;
    const nGo = t < half, sGo = !nGo;
    setSignal(sigXS, nGo ? 'g' : 'r'); setSignal(sigXN, nGo ? 'r' : 'g');
    // northbound approaching the south crossover (stop at z = XO + 4)
    const stopN = 130 - (XO + 4.5), stopS = 130 - (XO + 4.5);
    for (let i = 0; i < 6; i++) { const c = take(); const free = (t - T.where) * 9 + 60 + i * 9; let s = free; if (!nGo) s = Math.min(free, stopN - (5 - i) * 3.6 + 0) ; placeLocal(c, 1, s, d); }
    for (let i = 0; i < 6; i++) { const c = take(); const free = (t - half) * 9 + (stopS - 6 * 3.6) + i * 3.6; const s = nGo ? stopS - (5 - i) * 3.6 : Math.max(stopS - (5 - i) * 3.6, free); placeLocal(c, -1, 260 - s, d); }
  } else if (t < T.add - 0.05) { flow(1, 10, 9, 13, 2); flow(-1, 10, 9, 13, 8); setSignal(sigXN, 'g'); setSignal(sigXS, 'g'); }
  else { // confused drivers + finale
    flow(1, 9, 8, 14, 3); flow(-1, 9, 8, 14, 10);
    if (t > T.confused - 0.4 && t < T.congrats) { placeLocal(hero, 1, 130 - (XO + 1.5), d); hero.rotation.y += Math.sin(t * 7) * 0.35; hero.position.x += Math.sin(t * 7) * 0.4; }
  }
  // set the not-used conventional/ddi signal visibility
  const showConv = d < 0.5; sigN.g.visible = sigS.g.visible = showConv; sigXN.g.visible = sigXS.g.visible = !showConv;
  arrowLamp.bx.visible = arrowLamp.ar.visible = t > T.so1 - 0.05 && t < T.so2;
}

function placeStatic(t) {
  const wallU = eob(st(T.wall - 0.2, T.wall + 0.4, t));
  const split = eio(st(T.walkers - 0.3, T.walkers + 0.6, t));
  wallC.visible = wallU > 0 && split < 0.01; wallC.scale.y = Math.max(0.001, wallU); wallC.position.set(0, 0.55 * wallU, 0);
  walls2.forEach((w, i) => { w.visible = split > 0; w.position.set((i ? 1 : -1) * 0.95 * split, 0.5, 0); });
  walkway.visible = split > 0.3; walkway.position.set(0, 0.07, 0); walkway.scale.x = Math.max(0.001, split);
  paintedArrows.forEach((a, i) => { const u = eob(st(T.painted - 0.2 + i * 0.06, T.painted + 0.15 + i * 0.06, t)); a.visible = u > 0; const z = a.userData.z, dir = a.userData.dir; const x = laneX(dir, z, ddiAmt(t)); a.position.set(x, 0.07, z); a.rotation.y = dir > 0 ? Math.PI : 0; a.scale.setScalar(Math.max(0.001, u)); });
  roadSigns.forEach((g, i) => { const u = eob(st(T.signs - 0.15 + i * 0.1, T.signs + 0.2 + i * 0.1, t)); g.visible = u > 0; g.scale.setScalar(Math.max(0.001, u)); });
  // pedestrians walking in the protected path
  peds.forEach((p, i) => {
    p.visible = t > T.walkers && t < T.first + 0.3;
    const dir = i % 2 ? 1 : -1; const z = dir * (-14 + ((t - T.walkers) * 1.3 + i * 5.5) % 28);
    p.position.set((i % 2 ? 0.2 : -0.2), 0.13, z); p.rotation.y = dir > 0 ? 0 : Math.PI;
    const ph = Math.sin(t * 7 + i); p.userData.legs[0].rotation.x = ph * 0.5; p.userData.legs[1].rotation.x = -ph * 0.5; p.userData.arms[0].rotation.x = -ph * 0.4; p.userData.arms[1].rotation.x = ph * 0.4;
  });
  clouds.forEach((c) => { c.position.x = c.userData.x0 + t * c.userData.sp; });
}

// ---------------------------------------------------------------- camera (wide angles)
function shake(t) { let s = 0; for (const [t0, a, dd] of [[T.crash - 0.15, 0.35, 0.8], [T.wall, 0.08, 0.5]]) { const u = (t - t0) / dd; if (u > 0 && u < 1) s += a * (1 - u) * (1 - u); } return s; }
let SHOTS = [];
function buildShots() {
  SHOTS = [
    [-1, T.but1 - 0.05, (u) => ({ p: V3(lerp(55, 18, eio(u)), lerp(70, 34, eio(u)), lerp(95, 46, eio(u))), g: V3(0, -2, lerp(-10, -4, u)), f: 50 })],
    [T.but1 - 0.05, T.so1 - 0.05, (u) => ({ p: V3(lerp(16, 12, u), lerp(16, 12, u), lerp(4, 2, u)), g: V3(-0.5, -1, -15), f: 52 })],
    [T.so1 - 0.05, T.three - 0.3, (u) => ({ p: V3(lerp(13, 10, u), lerp(14, 12, u), lerp(-2, -4, u)), g: V3(-2, -1, -15), f: 52 })],
    [T.three - 0.3, T.so2 - 0.05, (u) => ({ p: V3(lerp(14, 10, u), lerp(30, 34, u), lerp(46, 50, u)), g: V3(0, -2, lerp(0, 4, u)), f: 46 })],
    [T.so2 - 0.05, T.right - 0.05, (u) => ({ p: V3(lerp(4, 0, u), lerp(70, 62, u), lerp(52, 44, u)), g: V3(0, -2, 2), f: 48 })],
    [T.right - 0.05, T.thats - 0.05, (u, t) => { const c = hero.visible ? hero.position.clone() : V3(0, 0, 20); return { p: c.clone().add(V3(9, 12, 16)), g: c.clone().add(V3(-1, -1, -6)), f: 50 }; }],
    [T.thats - 0.05, T.but2 - 0.05, (u) => ({ p: V3(lerp(-30, 30, eio(u)), lerp(95, 100, u), lerp(60, 55, u)), g: V3(0, -3, 0), f: 46 })],
    [T.but2 - 0.05, T.where - 0.05, (u) => ({ p: V3(lerp(5.5, 4.5, u), lerp(2.6, 3.4, u), lerp(-16, -20, u)), g: V3(-1, 0.8, lerp(4, 0, u)), f: 54 })],
    [T.where - 0.05, T.walkers - 0.05, (u) => ({ p: V3(lerp(18, 14, u), lerp(24, 22, u), lerp(48, 44, u)), g: V3(0, -1, XO - 2), f: 48 })],
    [T.walkers - 0.05, T.first - 0.05, (u) => ({ p: V3(lerp(3.2, 2.4, u), lerp(3.4, 2.8, u), lerp(-14, -11, u)), g: V3(0, 0.8, 6), f: 56 })],
    [T.first - 0.05, T.and3 - 0.05, (u) => ({ p: V3(lerp(-40, 40, eio(u)), 120, lerp(70, 60, u)), g: V3(0, -5, 0), f: 44 })],
    [T.and3 - 0.05, T.add - 0.05, (u) => ({ p: V3(lerp(20, 12, u), lerp(26, 22, u), lerp(40, 36, u)), g: V3(0, -1, XO - 4), f: 48 })],
    [T.add - 0.05, T.congrats - 0.05, (u) => ({ p: V3(lerp(12, 9, u), lerp(14, 11, u), lerp(46, 40, u)), g: V3(0, -1, lerp(20, 24, u)), f: 50 })],
    [T.congrats - 0.05, DUR + 1, (u, t) => { const e = eio(st(T.congrats, DUR - 0.3, t)); return { p: V3(lerp(14, 0, e), lerp(20, 110, e), lerp(46, 70, e)), g: V3(0, -3, lerp(14, 0, e)), f: 48 }; }],
  ];
}
buildShots();
function placeCamera(t) {
  const s = SHOTS.find((x) => t >= x[0] && t < x[1]) || SHOTS[SHOTS.length - 1];
  const c = s[2](cl((t - Math.max(0, s[0])) / (s[1] - Math.max(0, s[0]))), t);
  const sk = shake(t);
  camera.position.copy(c.p).add(V3(Math.sin(t * 0.9) * 0.15 + Math.sin(t * 31) * sk, Math.sin(t * 1.3) * 0.1 + Math.sin(t * 27) * sk, 0));
  camera.fov = c.f; camera.updateProjectionMatrix(); camera.lookAt(c.g);
}

// ---------------------------------------------------------------- 2D overlay (icons only, no captions)
function scr(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, ok: p.z < 1 }; }
const pop = (age, dd = 0.25) => eob(cl(age / dd));
function star(x, y, r, col, age) { if (age < 0 || age > 1.2) return; const s = eob(cl(age / 0.2)) * (1 - st(0.9, 1.2, age)); ctx.save(); ctx.translate(x, y); ctx.rotate(age * 0.6); ctx.scale(s, s); ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = i % 2 ? r * 0.55 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#141414'; ctx.stroke(); ctx.fillStyle = '#fff7c2'; ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = (i % 2 ? r * 0.55 : r) * 0.5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); ctx.restore(); }
function warn(x, y, s) { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#ffcc00'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(0, -95); ctx.lineTo(105, 85); ctx.lineTo(-105, 85); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#141414'; ctx.fillRect(-11, -40, 22, 75); ctx.beginPath(); ctx.arc(0, 60, 13, 0, 7); ctx.fill(); ctx.restore(); }
function lightIcon(x, y, s, state, faded = 0) { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = 1 - faded * 0.7; ctx.fillStyle = '#26282d'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(-45, -110, 90, 220, 22); ctx.fill(); ctx.stroke(); ['#ff3b30', '#ffcc00', '#34c759'].forEach((c, i) => { ctx.fillStyle = state === i ? c : '#44464d'; if (state === i) { ctx.shadowColor = c; ctx.shadowBlur = 30; } ctx.beginPath(); ctx.arc(0, -65 + i * 65, 26, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }); if (faded > 0.5) { ctx.globalAlpha = 1; ctx.strokeStyle = '#e63946'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-70, -130); ctx.lineTo(70, 130); ctx.stroke(); } ctx.restore(); }
function arrowIcon(x0, y0, x1, y1, col, w = 16) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * w * 1.6, y1 + Math.sin(a) * w * 1.6); ctx.lineTo(x1 + Math.cos(a + 2.4) * w * 2.4, y1 + Math.sin(a + 2.4) * w * 2.4); ctx.lineTo(x1 + Math.cos(a - 2.4) * w * 2.4, y1 + Math.sin(a - 2.4) * w * 2.4); ctx.fill(); ctx.restore(); }
function check(x, y, s) { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#2ec27e'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 80, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-38, 2); ctx.lineTo(-10, 32); ctx.lineTo(42, -28); ctx.stroke(); ctx.restore(); }
function pin(x, y, s, col = '#e63946') { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col; ctx.strokeStyle = '#141414'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-30, -40, -30, -75, 0, -75); ctx.bezierCurveTo(30, -75, 30, -40, 0, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -52, 10, 0, 7); ctx.fill(); ctx.restore(); }
function mapCard(t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(W / 2, 560); ctx.scale(a, a); ctx.rotate(-0.03);
  ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 10; ctx.beginPath(); ctx.roundRect(-430, -300, 860, 600, 40); ctx.fill(); ctx.stroke();
  // stylised country blob
  const pts = [[-360, -140], [-250, -200], [-60, -190], [120, -200], [250, -230], [330, -170], [370, -60], [300, 0], [250, 120], [150, 130], [60, 200], [-40, 130], [-180, 150], [-300, 90], [-370, -20]];
  ctx.fillStyle = '#9ad27a'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.lineWidth = 7; ctx.stroke();
  const r = rng(77);
  const many = st(T.hundred - 0.6, T.hundred + 0.8, t);
  const nPins = Math.floor(many * 70);
  for (let i = 0; i < 70; i++) { const x = -320 + r() * 640, y = -170 + r() * 300; if (i < nPins) pin(x, y, pop((t - (T.hundred - 0.6)) - i * 0.02, 0.15) * 0.45, '#ff7f11'); }
  const f = pop(t - T.springfield + 0.1, 0.3); pin(10, 30, f * 1.1); if (f > 0.5) { ctx.strokeStyle = 'rgba(230,57,70,0.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(10, 30, 40 + ((t * 60) % 60), 0, 7); ctx.stroke(); }
  ctx.restore();
}
function confetti(t, t0) { const age = t - t0; if (age < 0 || age > 4) return; const r = rng(99); for (let i = 0; i < 150; i++) { const side = i % 2 ? -1 : 1, spread = r() * 700, ph = r() * 6, vy = 300 + r() * 500, col = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff7ae0'][i % 6]; const x = side > 0 ? r() * 200 + spread * eo(cl(age * 2)) : W - r() * 200 - spread * eo(cl(age * 2)); const y = H * 0.75 - (900 + r() * 600) * eo(cl(age * 1.6)) + vy * age * age * 0.5; ctx.save(); ctx.translate(x, y); ctx.rotate(age * 6 + ph); ctx.fillStyle = col; ctx.globalAlpha = 1 - st(3.2, 4, age); ctx.fillRect(-9, -5, 18, 10); ctx.restore(); } }
function puff(x, y, r, a) { ctx.fillStyle = `rgba(110,110,110,${a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
function question(x, y, s, col) { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.font = '150px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 20; ctx.strokeStyle = '#141414'; ctx.lineJoin = 'round'; ctx.strokeText('?', 0, 0); ctx.fillStyle = col; ctx.fillText('?', 0, 0); ctx.restore(); }

function overlay(t) {
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // danger: left across oncoming
  if (t > T.left1 && t < T.so1 - 0.05) {
    const h = scr(V3(-1, 0, -15.5)); const a = scr(V3(LANE, 0.2, -10)), b = scr(V3(-3.5, 0.2, -17));
    ctx.save(); ctx.setLineDash([26, 18]); arrowIcon(a.x, a.y, lerp(a.x, b.x, eo(st(T.left1, T.left1 + 0.6, t))), lerp(a.y, b.y, eo(st(T.left1, T.left1 + 0.6, t))), '#ffcc00', 14); ctx.restore();
    if (t < T.crash - 0.2) warn(W / 2, 430, pop(t - T.left1 - 0.3) * (0.9 + Math.sin(t * 10) * 0.05));
    star(h.x, h.y - 60, 170, '#ff595e', t - T.crash + 0.15);
    if (t > T.crash) for (let i = 0; i < 6; i++) { const u = st(T.crash, T.crash + 1.4, t); puff(h.x - 60 + i * 25, h.y - 80 - u * 200 - i * 15, 30 + u * 50, 0.45 * (1 - u)); }
  }
  // green arrow + three cycles
  if (t > T.arrow - 0.15 && t < T.three - 0.3) { const p = scr(V3(-2, 1, -16)); ctx.save(); ctx.translate(Math.min(W - 200, p.x + 120), Math.max(320, p.y - 260)); const s = pop(t - T.arrow + 0.15); ctx.scale(s, s); ctx.fillStyle = '#26282d'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(-90, -90, 180, 180, 30); ctx.fill(); ctx.stroke(); ctx.shadowColor = '#34c759'; ctx.shadowBlur = 40; arrowIcon(55, 0, -45, 0, '#34c759', 26); ctx.restore(); }
  if (t > T.three - 0.3 && t < T.so2 - 0.05) { for (let i = 0; i < 3; i++) { const s = pop(t - (T.three - 0.2 + i * 0.22)); lightIcon(W / 2 - 230 + i * 230, 380, s * 0.95, Math.floor(t * 1.6 + i) % 3); } if (t > T.backs) { const a = scr(V3(LANE, 1, -9)), b = scr(V3(LANE, 1, 26)); arrowIcon(a.x + 90, a.y, lerp(a.x, b.x, eo(st(T.backs, T.backs + 0.8, t))) + 90, lerp(a.y, b.y, eo(st(T.backs, T.backs + 0.8, t))), '#ff595e', 16); } }
  // swap X glow
  if (t > T.swap - 0.2 && t < T.thats - 0.05) { for (const zc of [XO, -XO]) { const c = scr(V3(0, 0.1, zc)); const s = pop(t - T.swap + 0.2) * (1 + Math.sin(t * 8) * 0.05); ctx.save(); ctx.translate(c.x, c.y); ctx.scale(s, s); ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.shadowColor = '#ffd93d'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.moveTo(-60, -60); ctx.lineTo(60, 60); ctx.moveTo(60, -60); ctx.lineTo(-60, 60); ctx.stroke(); ctx.restore(); } }
  if (t > T.noone - 0.1 && t < T.thats - 0.05) check(W - 190, 400, pop(t - T.noone + 0.1));
  // diamond outline
  if (t > T.diverging - 0.4 && t < T.but2 - 0.05) {
    const u = eo(st(T.diverging - 0.4, T.diverging + 0.6, t)); const P = [V3(0, 0.2, -XO - 6), V3(-28, -3, 0), V3(0, 0.2, XO + 6), V3(28, -3, 0)].map(scr);
    ctx.save(); ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.shadowColor = '#ffd93d'; ctx.shadowBlur = 30; ctx.globalAlpha = u; ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 4; i++) { const p = P[i]; ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(p.x, p.y, 14 * u, 0, 7); ctx.fill(); }
  }
  // headlights scary
  if (t > T.headlights - 0.1 && t < T.wall - 0.1) { warn(W / 2, 400, pop(t - T.headlights + 0.1) * 0.8); for (const c of [LOC[0], LOC[8]]) if (c && c.visible) { const p = scr(c.position.clone().add(V3(0, 0.8, 0))); if (p.ok) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 90); g.addColorStop(0, 'rgba(255,250,210,0.8)'); g.addColorStop(1, 'rgba(255,250,210,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 90, 0, 7); ctx.fill(); ctx.restore(); } } }
  // two phases instead of three
  if (t > T.two2 - 0.3 && t < T.walkers - 0.05) { for (let i = 0; i < 3; i++) lightIcon(W / 2 - 230 + i * 230, 390, pop(t - T.two2 + 0.3 - i * 0.12) * 0.9, i === 0 ? 2 : i === 1 ? 0 : 1, i === 2 ? st(T.phases, T.phases + 0.3, t) : 0); }
  // walkers: shield/check
  if (t > T.walls - 0.3 && t < T.first - 0.05) check(W / 2, 420, pop(t - T.walls + 0.3));
  // map with pins
  if (t > T.first - 0.05 && t < T.and3 - 0.05) mapCard(t, pop(t - T.first, 0.35) * (1 - st(T.and3 - 0.35, T.and3 - 0.05, t)));
  // fewer crashes: bar halves
  if (t > T.and3 - 0.05 && t < T.add - 0.05) {
    const a = pop(t - T.and3 + 0.05); ctx.save(); ctx.translate(W / 2, 520); ctx.scale(a, a);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 9; ctx.beginPath(); ctx.roundRect(-300, -250, 600, 420, 36); ctx.fill(); ctx.stroke();
    const h2 = lerp(300, 150, eio(st(T.fewer, T.fewer + 0.8, t)));
    ctx.fillStyle = '#ff595e'; ctx.fillRect(-200, 130 - 300, 140, 300); ctx.strokeRect(-200, 130 - 300, 140, 300);
    ctx.fillStyle = '#2ec27e'; ctx.fillRect(60, 130 - h2, 140, h2); ctx.strokeRect(60, 130 - h2, 140, h2);
    star(-130, -210, 60, '#ffcc00', 0.5); if (t > T.fewer) arrowIcon(250, -160, 250, 60, '#2ec27e', 18);
    ctx.restore();
  }
  // confused drivers
  if (t > T.confused - 0.3 && t < T.congrats) { const p = scr(hero.position.clone().add(V3(0, 2.5, 0))); question(p.x, p.y - 40, pop(t - T.confused + 0.3) * 0.8, '#ffd93d'); question(p.x + 150, p.y - 120, pop(t - T.confused) * 0.6, '#4cc9f0'); }
  confetti(t, T.congrats);
  if (t > T.diamond2 - 0.3) { const a = pop(t - T.diamond2 + 0.3, 0.35); ctx.save(); ctx.translate(W / 2, 400); ctx.scale(a, a); ctx.rotate(Math.PI / 4); ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 22; ctx.shadowColor = '#ffd93d'; ctx.shadowBlur = 40; ctx.strokeRect(-110, -110, 220, 220); ctx.restore(); }
  const fade = Math.max(1 - st(0, 0.35, t), st(DUR - 0.6, DUR, t)); if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  for (const tc of [T.so2, T.thats, T.first, T.congrats]) { const u = (t - tc) / 0.16; if (u >= 0 && u < 1) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - u)})`; ctx.fillRect(0, 0, W, H); } }
}

window.renderFrame = (t, q = 0.92) => {
  placeDashes(t); placeStatic(t); placeTraffic(t); placeCamera(t);
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, W, H); ctx.drawImage(glCanvas, 0, 0); overlay(t);
  return out.toDataURL('image/jpeg', q);
};
document.fonts.load('96px "Luckiest Guy"').then(() => { window.READY = true; });

// "You Just Invented the Bridge" – deterministic 3D (three.js) + 2D overlay renderer.
// window.renderFrame(t) -> JPEG data URL. Beat times are looked up from the voiceover word timings.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1080, H = 1920;
const SEG = window.SEGMENTS || [];
const DUR = window.DUR || 61.5;

// ---------------------------------------------------------------- helpers
const cl = (x) => Math.min(1, Math.max(0, x));
const st = (a, b, t) => cl((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eo = (x) => 1 - Math.pow(1 - x, 3);
const ei = (x) => x * x * x;
const eob = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const bounce = (x) => { const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375; };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(11);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// word-time lookup ------------------------------------------------------------
const WORDS = SEG.flatMap((s) => s.words.map((w) => ({ w: w.w.toLowerCase().replace(/[^a-z']/g, ''), s: w.s, e: w.e })));
function Wt(word, after = 0) { const x = WORDS.find((q) => q.w === word && q.s >= after); return x ? x.s : after + 1; }
const SEGSTART = (i) => (SEG[i] ? SEG[i].start : 0);
const B = {};
B.river = Wt('river'); B.pizza = Wt('pizza'); B.swim = Wt('swim');
B.stones = Wt('stones'); B.so1 = Wt('so'); B.hop = Wt('hop'); B.rolls = Wt('rolls'); B.wet = Wt('wet');
B.chop = Wt('chop'); B.crash = Wt('crash'); B.tiptoe = Wt('tiptoe'); B.round = Wt('round', B.tiptoe); B.spins = Wt('spins'); B.wobble = Wt('wobble');
B.second = Wt('second'); B.so3 = Wt('so', B.wobble); B.planks = Wt('planks'); B.walkway = Wt('walkway');
B.then1 = Wt('then', B.walkway); B.truck = Wt('truck'); B.sags = Wt('sags');
B.so5 = Wt('so', B.sags); B.hammer = Wt('hammer'); B.posts = Wt('posts', B.hammer); B.beam = Wt('beam'); B.shorter = Wt('shorter'); B.genius = Wt('genius');
B.until2 = Wt('until', B.genius); B.current = Wt('current'); B.sway = Wt('sway');
B.so7 = Wt('so', B.sway); B.diagonal = Wt('diagonal'); B.triangles = Wt('triangles');
B.then2 = Wt('then', B.triangles); B.goat = Wt('goat'); B.falling = Wt('falling');
B.so9 = Wt('so', B.falling); B.railings = Wt('railings'); B.congrats = Wt('congratulations'); B.bridge = Wt('bridge', B.congrats);
B.voiceEnd = SEG.length ? SEG[SEG.length - 1].end : DUR - 3;
window.BEATS = B;

// ---------------------------------------------------------------- renderer
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 400);
const out = document.getElementById('out');
const ctx = out.getContext('2d');

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const mat = {
  grass: M(0x74c44e, { roughness: 0.95 }), grass2: M(0x63b545, { roughness: 0.95 }),
  bank: M(0x8a6a45, { roughness: 1 }), bed: M(0xc9b27a, { roughness: 1 }),
  stone: M(0x9aa1a8, { roughness: 0.85 }), stone2: M(0x7f878f, { roughness: 0.85 }),
  bark: M(0x7a4a26, { roughness: 0.9 }), barkDark: M(0x4e2e15, { roughness: 0.9 }), wood: M(0xc8894b, { roughness: 0.75 }), wood2: M(0xb5763c, { roughness: 0.75 }),
  post: M(0x8b5a2b, { roughness: 0.85 }), ring: M(0xe7c08a, { roughness: 0.8 }),
  leaf: M(0x3fa34d, { roughness: 0.8 }), leaf2: M(0x58b85a, { roughness: 0.8 }), trunk: M(0x8a5a33),
  white: M(0xffffff), black: M(0x1b1b1f), tire: M(0x202024, { roughness: 0.8 }), hub: M(0xd8dde3, { metalness: 0.8, roughness: 0.25 }),
  glassDark: M(0x1d3557, { metalness: 0.3, roughness: 0.1 }), truck: M(0x2f6fdf, { metalness: 0.35, roughness: 0.3 }),
  head: new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff3c4, emissiveIntensity: 0.5 }),
  eyeW: M(0xffffff, { roughness: 0.2 }), pupil: M(0x111111, { roughness: 0.2 }), mouth: M(0x5a1a1a),
  shopWall: M(0xfff1d6), shopRoof: M(0xe63946), awn: M(0xffffff), cloud: M(0xffffff, { roughness: 1 }),
  foam: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }),
  axeHead: M(0xb8c2cc, { metalness: 0.8, roughness: 0.3 }), hammerHead: M(0x555b63, { metalness: 0.7, roughness: 0.4 }),
  goat: M(0xf4f1ea, { roughness: 0.9 }), horn: M(0xc9b48a), hoof: M(0x3a3a3a),
};
function mesh(geo, m, cast = true, recv = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
const box = (w, h, d, m, r = 0) => mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), m);

// ---------------------------------------------------------------- lights & sky
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5d8a3a, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.7);
sun.position.set(12, 22, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 18, bottom: -16, near: 1, far: 70 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun);
const fill = new THREE.DirectionalLight(0xbcd7ff, 0.5); fill.position.set(-10, 8, 10); scene.add(fill);
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 vp; void main(){ float y = clamp(vp.y,0.,1.); vec3 c = mix(vec3(0.82,0.93,1.0), vec3(0.3,0.62,0.98), pow(y,0.55)); gl_FragColor = vec4(c,1.); }',
}));
scene.add(sky);
const clouds = [];
for (let i = 0; i < 10; i++) {
  const g = new THREE.Group(); const n = 3 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) { const s = mesh(new THREE.SphereGeometry(1.3 + R() * 1.3, 16, 12), mat.cloud, false, false); s.position.set(k * 1.7 - n * 0.85, R() * 0.7, R()); s.scale.y = 0.72; g.add(s); }
  g.position.set(-55 + R() * 110, 20 + R() * 12, -75 + R() * 45); g.userData = { x0: g.position.x, sp: 0.3 + R() * 0.4 };
  scene.add(g); clouds.push(g);
}

// ---------------------------------------------------------------- land, river, water
const BANK = 6.0, BED = -2.0, WATER = -0.55;
for (const s of [-1, 1]) {
  const land = mesh(new THREE.BoxGeometry(200, 3, 80), mat.grass, false, true); land.position.set(0, -1.5, s * (BANK + 40)); scene.add(land);
  const edge = mesh(new THREE.BoxGeometry(200, 2.2, 0.6), mat.bank, false, true); edge.position.set(0, -1.05, s * (BANK + 0.1)); scene.add(edge);
  const lip = mesh(new THREE.BoxGeometry(200, 0.14, 0.5), mat.grass2, false, true); lip.position.set(0, -0.02, s * (BANK + 0.3)); scene.add(lip);
}
const bed = mesh(new THREE.PlaneGeometry(200, BANK * 2), mat.bed, false, true); bed.rotation.x = -Math.PI / 2; bed.position.y = BED; scene.add(bed);
for (let i = 0; i < 40; i++) { const r = mesh(new THREE.DodecahedronGeometry(0.2 + R() * 0.35, 0), R() < 0.5 ? mat.stone : mat.stone2, false, true); r.position.set(-30 + R() * 60, BED + 0.1, -5 + R() * 10); r.scale.y = 0.5; scene.add(r); }
const waterU = { t: { value: 0 }, flow: { value: 1 } };
const water = new THREE.Mesh(new THREE.PlaneGeometry(200, BANK * 2 + 0.4, 200, 24), new THREE.ShaderMaterial({
  transparent: true, uniforms: waterU,
  vertexShader: `uniform float t; uniform float flow; varying vec2 vUv; varying vec3 wp;
    void main(){ vec3 p = position; p.z += sin(p.x*0.7 - t*2.0*flow)*0.04 + sin(p.y*1.3 + t*1.6)*0.03;
      vUv = uv; vec4 w = modelMatrix*vec4(p,1.); wp = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float t; uniform float flow; varying vec2 vUv; varying vec3 wp;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    void main(){ vec2 q = vec2(wp.x - t*1.4*flow, wp.z*2.2);
      float s = n(q*0.9) * 0.6 + n(q*2.3 + 3.1) * 0.4;
      float streak = smoothstep(0.72, 0.8, s);
      float edge = smoothstep(${(BANK - 0.7).toFixed(2)}, ${BANK.toFixed(2)}, abs(wp.z));
      vec3 deep = vec3(0.12,0.48,0.72), shallow = vec3(0.28,0.72,0.86);
      vec3 c = mix(deep, shallow, s*0.6 + edge*0.5) + streak*0.35 + edge*0.25;
      gl_FragColor = vec4(c, 0.82); }`,
}));
water.rotation.x = -Math.PI / 2; water.position.y = WATER; water.renderOrder = 2; scene.add(water);

// pizza shop on the far bank
const shopCanvas = document.createElement('canvas'); shopCanvas.width = 1024; shopCanvas.height = 256;
function drawShop() { const c = shopCanvas.getContext('2d'); c.fillStyle = '#e63946'; c.fillRect(0, 0, 1024, 256); c.font = '150px "Luckiest Guy"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff6d5'; c.lineWidth = 14; c.strokeStyle = '#7a0f1a'; c.strokeText('PIZZA', 512, 140); c.fillText('PIZZA', 512, 140); if (typeof shopTex !== 'undefined') shopTex.needsUpdate = true; }
const shopTex = new THREE.CanvasTexture(shopCanvas); shopTex.colorSpace = THREE.SRGBColorSpace;
const shop = new THREE.Group();
{
  const b = box(7, 4, 5, mat.shopWall); b.position.y = 2; shop.add(b);
  const r = box(7.6, 0.5, 5.6, mat.shopRoof); r.position.y = 4.25; shop.add(r);
  const sign = mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshStandardMaterial({ map: shopTex, emissiveMap: shopTex, emissive: 0xffffff, emissiveIntensity: 0.3 })); sign.position.set(0, 5.2, 2.0); shop.add(sign);
  const sb = box(5.2, 1.4, 0.15, mat.shopRoof); sb.position.set(0, 5.2, 1.9); shop.add(sb);
  for (let i = 0; i < 7; i++) { const a = box(1.0, 0.12, 1.4, i % 2 ? mat.shopRoof : mat.awn); a.position.set(-3 + i, 3.2, 3.1); a.rotation.x = 0.35; shop.add(a); }
  const d = box(1.3, 2.3, 0.1, mat.wood2); d.position.set(0, 1.15, 2.52); shop.add(d);
  for (const x of [-2.3, 2.3]) { const w = box(1.6, 1.3, 0.1, mat.glassDark); w.position.set(x, 1.8, 2.52); shop.add(w); }
  // giant pizza slice on the roof
  const sl = new THREE.Shape(); sl.moveTo(0, 0); sl.lineTo(-1.2, 2.6); sl.quadraticCurveTo(0, 3.0, 1.2, 2.6); sl.lineTo(0, 0);
  const slg = new THREE.ExtrudeGeometry(sl, { depth: 0.25, bevelEnabled: false });
  const slice = mesh(slg, M(0xffc04d)); slice.position.set(2.6, 4.5, 1.2); slice.rotation.z = Math.PI; slice.position.y = 7.4; shop.add(slice);
  for (let i = 0; i < 4; i++) { const p = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12), M(0xc0392b)); p.rotation.x = Math.PI / 2; p.position.set(2.6 + (i % 2 ? 0.3 : -0.3), 6.3 - (i >> 1) * 0.7, 1.47); shop.add(p); }
  shop.position.set(-0.5, 0, -14.5);
  scene.add(shop);
}
// hero's house on the near bank
{
  const h = new THREE.Group();
  const b = box(6, 3.6, 5, M(0xbfe0ff)); b.position.y = 1.8; h.add(b);
  const rg = new THREE.CylinderGeometry(0.01, 4.6, 2.4, 4, 1); rg.rotateY(Math.PI / 4); rg.scale(1.1, 1, 0.9);
  const r = mesh(rg, M(0x3d5a80)); r.position.y = 4.8; h.add(r);
  const d = box(1.1, 2.1, 0.1, mat.wood2); d.position.set(0, 1.05, 2.52); h.add(d);
  h.position.set(9, 0, 15); h.rotation.y = -0.5; scene.add(h);
}
// trees
const trees = [];
function tree(x, z, s) {
  const g = new THREE.Group();
  const tr = mesh(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 2.2 * s, 8), mat.trunk); tr.position.y = 1.1 * s; g.add(tr);
  const top = new THREE.Group(); top.position.y = 2 * s; g.add(top);
  for (let i = 0; i < 4; i++) { const c = mesh(new THREE.IcosahedronGeometry((0.9 + R() * 0.5) * s, 1), i % 2 ? mat.leaf : mat.leaf2); c.position.set((R() - 0.5) * 1.4 * s, (0.6 + R()) * s, (R() - 0.5) * 1.2 * s); top.add(c); }
  g.position.set(x, 0, z); g.userData.top = top; g.userData.ph = R() * 6; scene.add(g); trees.push(g);
}
for (const [x, z, s] of [[-9, 9, 1.3], [-14, 13, 1.5], [12, 8.5, 1.2], [-8, -9, 1.4], [8, -10, 1.3], [-15, -12, 1.6], [15, -9, 1.2], [-20, 8, 1.4], [22, 12, 1.6], [6, -20, 1.5]]) tree(x, z, s);
for (let i = 0; i < 14; i++) { const b = mesh(new THREE.IcosahedronGeometry(0.5 + R() * 0.3, 1), mat.leaf2); b.position.set(-16 + R() * 32, 0.3, (R() < 0.5 ? 1 : -1) * (7.5 + R() * 4)); b.scale.y = 0.7; if (Math.abs(b.position.x) < 3) b.position.x += 5; scene.add(b); }
// reeds along banks
for (let i = 0; i < 60; i++) { const r = mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.9 + R() * 0.5, 4), mat.leaf, false, false); const s = R() < 0.5 ? 1 : -1; r.position.set(-25 + R() * 50, WATER + 0.3, s * (BANK - 0.2 - R() * 0.4)); if (Math.abs(r.position.x) < 2.5 || (r.position.x > 2 && r.position.x < 10)) continue; r.rotation.z = (R() - 0.5) * 0.3; scene.add(r); }

// ---------------------------------------------------------------- people
function makePerson(o) {
  const g = new THREE.Group(); const root = new THREE.Group(); g.add(root); const P = {};
  const shirt = M(o.shirt, { roughness: 0.75 }), skin = M(o.skin, { roughness: 0.6 }), pants = M(o.pants, { roughness: 0.8 }), hair = M(o.hair, { roughness: 0.8 });
  const torso = mesh(new THREE.CapsuleGeometry(0.33, 0.42, 6, 16), shirt); torso.position.y = 1.3; root.add(torso);
  if (o.dress) { const d = mesh(new THREE.ConeGeometry(0.55, 0.9, 20, 1, true), shirt); d.position.y = 0.95; root.add(d); }
  if (o.hood) { const hd = mesh(new THREE.TorusGeometry(0.26, 0.09, 8, 18), shirt); hd.rotation.x = Math.PI / 2 - 0.3; hd.position.set(0, 1.72, -0.12); root.add(hd); }
  const head = new THREE.Group(); head.position.y = 1.98; root.add(head); P.head = head;
  head.add(mesh(new THREE.SphereGeometry(0.34, 24, 18), skin));
  if (o.cap) {
    const capM = M(o.cap, { roughness: 0.6 });
    const c = mesh(new THREE.SphereGeometry(0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), capM); c.position.y = 0.04; c.rotation.x = -0.15; head.add(c);
    const br = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 20, 1, false, -Math.PI / 2, Math.PI), capM); br.position.set(0, 0.17, 0.2); br.rotation.x = 0.12; head.add(br);
  } else {
    const hr = mesh(new THREE.SphereGeometry(0.37, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair); hr.position.y = 0.03; hr.rotation.x = -0.35; head.add(hr);
    if (o.bun) { const bn = mesh(new THREE.SphereGeometry(0.16, 14, 10), hair); bn.position.set(0, 0.36, -0.12); head.add(bn); }
  }
  if (o.beard) { const bd = mesh(new THREE.SphereGeometry(0.25, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), hair); bd.position.set(0, -0.04, 0.08); bd.scale.set(1.05, 0.9, 1.0); head.add(bd); }
  const nose = mesh(new THREE.SphereGeometry(0.07, 12, 10), skin); nose.position.set(0, -0.02, 0.34); head.add(nose);
  P.pupils = []; P.brows = [];
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.08, 10, 8), skin); ear.position.set(s * 0.33, 0, 0); head.add(ear);
    const eye = mesh(new THREE.SphereGeometry(0.085, 14, 12), mat.eyeW, false); eye.position.set(s * 0.13, 0.07, 0.28); head.add(eye);
    const pu = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat.pupil, false); pu.position.set(s * 0.13, 0.07, 0.355); head.add(pu); P.pupils.push(pu);
    const brow = mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), hair, false); brow.position.set(s * 0.13, 0.19, 0.31); head.add(brow); P.brows.push(brow);
  }
  const smile = mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 16, Math.PI), mat.mouth, false); smile.rotation.z = Math.PI; smile.position.set(0, -0.12, 0.31); head.add(smile); P.smile = smile;
  const oh = mesh(new THREE.SphereGeometry(0.065, 12, 10), mat.mouth, false); oh.scale.set(1, 1.3, 0.5); oh.position.set(0, -0.14, 0.31); head.add(oh); P.oh = oh;
  P.arms = []; P.fore = []; P.hands = [];
  for (const s of [1, -1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.42, 1.6, 0); root.add(sh);
    const up = mesh(new THREE.CapsuleGeometry(0.095, 0.3, 4, 10), shirt); up.position.y = -0.2; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.4; sh.add(el);
    const lo = mesh(new THREE.CapsuleGeometry(0.085, 0.25, 4, 10), o.sleeves ? shirt : skin); lo.position.y = -0.16; el.add(lo);
    const hand = mesh(new THREE.SphereGeometry(0.11, 12, 10), skin); hand.position.y = -0.36; el.add(hand);
    const hp = new THREE.Group(); hp.position.y = -0.38; el.add(hp);
    P.arms.push(sh); P.fore.push(el); P.hands.push(hp);
  }
  P.legs = [];
  for (const s of [1, -1]) {
    const hp = new THREE.Group(); hp.position.set(s * 0.16, 0.95, 0); root.add(hp);
    const leg = mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 10), pants); leg.position.y = -0.42; hp.add(leg);
    const shoe = box(0.22, 0.14, 0.38, M(o.shoe || 0x2a2a2a), 0.05); shoe.position.set(0, -0.86, 0.08); hp.add(shoe);
    P.legs.push(hp);
  }
  g.userData = { root, P };
  scene.add(g); return g;
}
function applyPose(person, p) {
  const { root, P } = person.userData;
  const d = { aL: [0, 0.12], aR: [0, 0.12], eL: 0, eR: 0, lL: 0, lR: 0, hx: 0, hy: 0, hz: 0, bob: 0, lean: 0, roll: 0, mouth: 'smile', brow: 0, look: [0, 0], ...p };
  P.arms[0].rotation.set(d.aL[0], 0, d.aL[1]); P.arms[1].rotation.set(d.aR[0], 0, -d.aR[1]);
  P.fore[0].rotation.x = -d.eL; P.fore[1].rotation.x = -d.eR;
  P.legs[0].rotation.x = d.lL; P.legs[1].rotation.x = d.lR;
  P.head.rotation.set(d.hx, d.hy, d.hz);
  root.position.y = d.bob; root.rotation.set(d.lean, 0, d.roll);
  P.smile.visible = d.mouth === 'smile'; P.oh.visible = d.mouth === 'oh';
  P.brows.forEach((b, i) => { b.position.y = 0.19 + d.brow * 0.04; b.rotation.z = (i ? -1 : 1) * d.brow * 0.3; });
  P.pupils.forEach((pu, i) => { pu.position.x = (i ? 1 : -1) * 0.13 + d.look[0] * 0.03; pu.position.y = 0.07 + d.look[1] * 0.03; });
}
const hero = makePerson({ shirt: 0x22b573, skin: 0xc68642, pants: 0x3b3f4a, hair: 0x2b1b10, cap: 0xff5a36, hood: true, sleeves: true, beard: true, shoe: 0xf2f2f2 });
const neighbor = makePerson({ shirt: 0x9b5de5, skin: 0xf1c27d, pants: 0x9b5de5, hair: 0xb5651d, bun: true, dress: true });
// tools held in the hero's right hand
const axe = new THREE.Group();
{ const h = box(0.06, 0.9, 0.06, mat.wood); h.position.y = -0.35; axe.add(h); const hd = box(0.08, 0.22, 0.32, mat.axeHead); hd.position.set(0, -0.72, 0.12); axe.add(hd); axe.rotation.x = Math.PI / 2; }
hero.userData.P.hands[1].add(axe);
const hammer = new THREE.Group();
{ const h = box(0.06, 0.6, 0.06, mat.wood); h.position.y = -0.2; hammer.add(h); const hd = box(0.12, 0.14, 0.32, mat.hammerHead); hd.position.set(0, -0.48, 0); hammer.add(hd); hammer.rotation.x = Math.PI / 2; }
hero.userData.P.hands[1].add(hammer);

// goat
const goat = new THREE.Group();
{
  const b = box(0.55, 0.45, 0.95, mat.goat, 0.18); b.position.y = 0.62; goat.add(b);
  const hd = new THREE.Group(); hd.position.set(0, 0.95, 0.5); goat.add(hd); goat.userData.head = hd;
  const hh = box(0.3, 0.32, 0.42, mat.goat, 0.12); hh.position.z = 0.1; hd.add(hh);
  for (const s of [-1, 1]) { const horn = mesh(new THREE.ConeGeometry(0.05, 0.28, 8), mat.horn); horn.position.set(s * 0.09, 0.22, 0); horn.rotation.x = -0.5; hd.add(horn); const ear = box(0.2, 0.05, 0.09, mat.goat); ear.position.set(s * 0.22, 0.06, 0); ear.rotation.z = s * 0.4; hd.add(ear); const e = mesh(new THREE.SphereGeometry(0.04, 8, 6), mat.pupil, false); e.position.set(s * 0.1, 0.08, 0.3); hd.add(e); }
  const bd = mesh(new THREE.ConeGeometry(0.05, 0.18, 6), M(0xd8d2c5)); bd.position.set(0, -0.2, 0.22); bd.rotation.x = Math.PI; hd.add(bd);
  goat.userData.legs = [];
  for (const [x, z] of [[-0.18, 0.32], [0.18, 0.32], [-0.18, -0.32], [0.18, -0.32]]) { const p = new THREE.Group(); p.position.set(x, 0.45, z); const l = box(0.09, 0.45, 0.09, mat.goat); l.position.y = -0.22; p.add(l); const hf = box(0.1, 0.07, 0.1, mat.hoof); hf.position.y = -0.44; p.add(hf); goat.add(p); goat.userData.legs.push(p); }
  const tail = box(0.08, 0.16, 0.06, mat.goat); tail.position.set(0, 0.85, -0.5); tail.rotation.x = -0.5; goat.add(tail);
  scene.add(goat);
}

// truck
const truck = new THREE.Group();
{
  const body = box(1.5, 0.55, 3.2, mat.truck, 0.14); body.position.y = 0.62; truck.add(body);
  const cab = box(1.4, 0.6, 1.25, mat.truck, 0.14); cab.position.set(0, 1.18, 0.45); truck.add(cab);
  const ws = box(1.3, 0.45, 0.05, mat.glassDark); ws.position.set(0, 1.22, 1.08); ws.rotation.x = -0.15; truck.add(ws);
  for (const s of [-1, 1]) { const sw = box(0.05, 0.38, 0.9, mat.glassDark); sw.position.set(s * 0.71, 1.22, 0.45); truck.add(sw); }
  const bedIn = box(1.3, 0.1, 1.4, mat.black); bedIn.position.set(0, 0.92, -0.85); truck.add(bedIn);
  for (const x of [-0.4, 0.4]) { const hl = box(0.3, 0.14, 0.05, mat.head, 0); hl.position.set(x, 0.7, 1.61); truck.add(hl); }
  const grill = box(0.5, 0.2, 0.05, mat.hub); grill.position.set(0, 0.62, 1.61); truck.add(grill);
  truck.userData.wheels = [];
  for (const [x, z] of [[-0.72, 1.0], [0.72, 1.0], [-0.72, -1.05], [0.72, -1.05]]) { const w = new THREE.Group(); w.position.set(x, 0.32, z); const t = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 18), mat.tire); t.rotation.z = Math.PI / 2; w.add(t); const h = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 12), mat.hub); h.rotation.z = Math.PI / 2; w.add(h); truck.add(w); truck.userData.wheels.push(w); }
  scene.add(truck);
}

// ---------------------------------------------------------------- stones
const STONES = [4.4, 2.6, 0.8, -1.0, -2.8, -4.6];
const stones = STONES.map((z, i) => { const s = mesh(new THREE.DodecahedronGeometry(0.62, 1), i % 2 ? mat.stone : mat.stone2); s.scale.set(1.1, 0.75, 1.0); s.position.set(0.0 + (i % 2 ? 0.2 : -0.2), WATER + 0.12, z); scene.add(s); return s; });

// ---------------------------------------------------------------- tree / logs / deck
const LOG_R = 0.42, DECK_Y = 0.32, SPAN = 15, NSEG = 15;
const treeFall = new THREE.Group(); scene.add(treeFall);
const treeTrunk = mesh(new THREE.CylinderGeometry(LOG_R * 0.85, LOG_R, SPAN, 14), mat.bark); treeTrunk.position.y = SPAN / 2; treeFall.add(treeTrunk);
const crown = new THREE.Group(); crown.position.y = SPAN + 0.6; treeFall.add(crown);
for (let i = 0; i < 9; i++) { const c = mesh(new THREE.IcosahedronGeometry(1.1 + R() * 0.7, 1), i % 2 ? mat.leaf : mat.leaf2); c.position.set((R() - 0.5) * 2.2, -i * 0.75 + (R() - 0.5) * 0.6, (R() - 0.5) * 2.2); crown.add(c); }
const TREE_BASE = V3(-0.5, 0, 7.6);
treeFall.position.copy(TREE_BASE);
const stump = mesh(new THREE.CylinderGeometry(LOG_R, LOG_R * 1.1, 0.5, 14), mat.bark); stump.position.set(TREE_BASE.x, 0.25, TREE_BASE.z); scene.add(stump);
const stumpTop = mesh(new THREE.CylinderGeometry(LOG_R * 0.98, LOG_R * 0.98, 0.02, 14), mat.ring); stumpTop.position.set(TREE_BASE.x, 0.51, TREE_BASE.z); scene.add(stumpTop);

// segmented logs (so they can bend)
function makeLog() {
  const g = new THREE.Group(); const segs = [];
  for (let i = 0; i < NSEG; i++) {
    const sg = new THREE.Group();
    const c = mesh(new THREE.CylinderGeometry(LOG_R, LOG_R, SPAN / NSEG + 0.02, 14), mat.bark); c.rotation.x = Math.PI / 2; sg.add(c);
    if (i % 3 === 1) { const k = mesh(new THREE.BoxGeometry(0.08, 0.06, SPAN / NSEG * 0.7), mat.barkDark, false); k.position.set(0, LOG_R, 0); sg.add(k); const k2 = k.clone(); k2.position.set(LOG_R, 0, 0); k2.rotation.z = Math.PI / 2; sg.add(k2); }
    sg.userData.z = SPAN / 2 - (i + 0.5) * SPAN / NSEG + 0.1;
    g.add(sg); segs.push(sg);
  }
  for (const e of [0, 1]) { const end = mesh(new THREE.CylinderGeometry(LOG_R * 0.98, LOG_R * 0.98, 0.02, 14), mat.ring); end.rotation.x = Math.PI / 2; g.add(end); segs.push(end); end.userData.z = e ? -SPAN / 2 + 0.1 : SPAN / 2 + 0.1; end.userData.end = true; }
  g.userData.segs = segs; scene.add(g); return g;
}
const logA = makeLog(), logB = makeLog();
const planks = [];
const NPL = 26;
for (let i = 0; i < NPL; i++) { const p = box(2.5, 0.09, 0.5, i % 2 ? mat.wood : mat.wood2); p.userData.z = 6.9 - i * 0.54; scene.add(p); planks.push(p); }
// posts, cap beams, braces
const BENTS = [-2.5, 2.5];
const posts = [], caps = [], braces = [];
for (const z of BENTS) {
  for (const x of [-1.15, 1.15]) { const p = mesh(new THREE.CylinderGeometry(0.17, 0.2, 2.5, 12), mat.post); p.userData = { x, z }; scene.add(p); posts.push(p); }
  const c = box(2.9, 0.22, 0.32, mat.post); c.userData = { z }; scene.add(c); caps.push(c);
  for (const d of [-1, 1]) { const b = box(0.12, 2.75, 0.14, mat.wood2); b.userData = { z, d }; scene.add(b); braces.push(b); }
}
// railings
const railPosts = [], rails = [];
for (const x of [-1.2, 1.2]) {
  for (let i = 0; i <= 14; i++) { const p = box(0.1, 0.9, 0.1, mat.wood2); p.userData = { x, z: 7.0 - i * 1.0, i }; scene.add(p); railPosts.push(p); }
  for (const y of [0.45, 0.85]) { const r = box(0.07, 0.08, 14.2, mat.wood); r.userData = { x, y }; scene.add(r); rails.push(r); }
}

// splashes (3D ring + droplets)
const splashes = [];
function makeSplash() {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(0.5, 0.07, 6, 28), mat.foam, false, false); ring.rotation.x = Math.PI / 2; g.add(ring);
  const drops = []; for (let i = 0; i < 14; i++) { const d = mesh(new THREE.SphereGeometry(0.08, 8, 6), mat.foam, false, false); g.add(d); drops.push({ d, a: i / 14 * Math.PI * 2 + R() * 0.3, v: 2.5 + R() * 2.5, h: 4 + R() * 3 }); }
  g.userData = { ring, drops }; scene.add(g); return g;
}
for (let i = 0; i < 6; i++) splashes.push(makeSplash());
function placeSplash(sp, t, t0, p, size = 1) {
  const u = t - t0;
  sp.visible = u >= 0 && u < 1.1;
  if (!sp.visible) return;
  sp.position.set(p.x, WATER + 0.02, p.z);
  const { ring, drops } = sp.userData;
  ring.scale.setScalar(size * (0.3 + u * 2.4)); ring.material.opacity = 0.85;
  drops.forEach((q) => { const r = q.v * u * size * 0.6; q.d.position.set(Math.cos(q.a) * r, Math.max(-0.2, q.h * u * size - 9.8 * u * u), Math.sin(q.a) * r); q.d.scale.setScalar(size * (1 - u * 0.6)); });
}

// ---------------------------------------------------------------- state
const T = B;
function sagAmt(t) {
  // single-span sag under the truck, removed when the posts take the load
  return 0.95 * eio(st(T.sags - 0.5, T.sags + 0.6, t)) * (1 - eio(st(T.beam - 0.1, T.beam + 0.7, t)));
}
function swayAmt(t) {
  const on = eio(st(T.current - 0.2, T.sway + 0.3, t)) * (1 - eio(st(T.diagonal + 0.3, T.triangles + 0.3, t)));
  return on * Math.sin((t - T.current) * 3.2) * 0.32;
}
function deckY(z, t) {
  const big = sagAmt(t) * Math.max(0, Math.cos(Math.PI * z / (BANK * 2)));
  // small residual bending between supports once posts are in
  const post = st(T.beam, T.beam + 0.7, t);
  let small = 0;
  if (post > 0 && Math.abs(z) < BANK) { const spans = [-BANK, -2.5, 2.5, BANK]; for (let i = 0; i < 3; i++) if (z >= spans[i] && z <= spans[i + 1]) small = Math.sin(Math.PI * (z - spans[i]) / (spans[i + 1] - spans[i])); }
  const truckLoad = truckZ(t) !== null ? 1 : 0;
  return DECK_Y - big - small * 0.06 * post * truckLoad;
}
function deckX(z, t) { return Math.abs(z) < BANK ? swayAmt(t) * Math.cos(Math.PI * z / (BANK * 2.2)) * 0.6 : 0; }
// truck z along the bridge (null when off-bridge/not visible)
function truckZ(t) {
  if (t < T.truck - 0.6) return null;
  if (t < T.so5 - 0.1) return lerp(12, 0.2, eo(st(T.truck - 0.6, T.sags + 0.2, t)));
  if (t < T.shorter) return null;
  if (t < T.until2) return lerp(9.5, -1.5, eio(st(T.shorter, T.until2 + 0.3, t)));
  if (t < T.then2) return -1.5 + Math.min(0, 0);
  if (t < T.congrats) return null;
  return lerp(9, -13, eio(st(T.congrats + 0.4, DUR - 0.4, t)));
}

function placeBridge(t) {
  const logsOn = t > T.tiptoe - 0.05;
  const fall = t < T.tiptoe - 0.05;
  // falling tree
  treeFall.visible = t > 0 && fall;
  const chopU = st(T.crash - 0.8, T.crash + 0.25, t);
  treeFall.rotation.x = -Math.PI / 2 * ei(chopU) + Math.sin(t * 30) * 0.004 * st(T.chop + 0.3, T.crash - 0.8, t);
  treeFall.position.set(TREE_BASE.x, 0.5 * (1 - chopU) + LOG_R * chopU, TREE_BASE.z - 0.3 * chopU);
  stump.visible = stumpTop.visible = t > T.crash - 0.9;
  // logs
  const rollB = eio(st(T.second, T.second + 1.0, t));
  const spin = (t > T.round - 0.3 && t < T.second) ? Math.sin((t - T.round) * 5) * 0.6 * st(T.round - 0.3, T.spins, t) : 0;
  [[logA, -0.55, 1], [logB, lerp(4.5, 0.55, rollB), 0]].forEach(([lg, x, which]) => {
    lg.visible = which ? logsOn : t > T.second - 0.05;
    lg.userData.segs.forEach((s) => {
      const z = s.userData.z; const y = deckY(z, t) - 0.08 - LOG_R * 0.55 + 0.0;
      s.position.set(x + deckX(z, t), y, z);
      const dz = 0.3; const slope = (deckY(z - dz, t) - deckY(z + dz, t)) / (2 * dz);
      s.rotation.set(0, 0, 0);
      if (s.userData.end) s.rotation.x = Math.PI / 2;
      s.rotation.x += -Math.atan(slope) * 0;
      s.rotation.z = which ? spin : -(x - 0.55) / LOG_R;
      if (!s.userData.end) s.children[0].rotation.x = Math.PI / 2 + Math.atan(slope);
    });
  });
  // planks
  planks.forEach((p, i) => {
    const t0 = T.planks - 0.15 + i * 0.055;
    const u = eob(st(t0, t0 + 0.25, t));
    p.visible = u > 0;
    const z = p.userData.z;
    p.position.set(deckX(z, t), deckY(z, t) + (1 - u) * 1.2, z);
    p.scale.setScalar(Math.max(0.001, Math.min(1, u * 1.1)));
    const dz = 0.3; p.rotation.x = Math.atan((deckY(z - dz, t) - deckY(z + dz, t)) / (2 * dz));
  });
  // posts hammered into the riverbed
  posts.forEach((p, i) => {
    const t0 = T.hammer + (i >> 1) * 0.55 + (i & 1) * 0.18;
    const drive = eo(st(t0, t0 + 0.35, t));
    p.visible = t > t0 - 0.2;
    const topY = DECK_Y - 0.35;
    const len = topY - BED + 0.2;
    p.scale.y = len / 2.5;
    const sx = swayAmt(t);
    p.position.set(p.userData.x + sx * 0.5, BED - 0.2 + len / 2 + (1 - drive) * 3.0, p.userData.z);
    p.rotation.z = -Math.atan(sx / len);
  });
  caps.forEach((c, i) => { const u = eob(st(T.beam - 0.2 + i * 0.2, T.beam + 0.15 + i * 0.2, t)); c.visible = u > 0; c.position.set(swayAmt(t), DECK_Y - 0.26 - (1 - u) * 1.5, c.userData.z); c.scale.setScalar(Math.max(0.001, u)); });
  braces.forEach((b, i) => {
    const t0 = T.diagonal - 0.1 + i * 0.16; const u = eob(st(t0, t0 + 0.3, t));
    b.visible = u > 0;
    const len = DECK_Y - 0.35 - WATER + 0.55 + 1.2; const h = (DECK_Y - 0.4) - (BED + 0.4);
    const ang = Math.atan2(2.3, h);
    b.scale.set(1, Math.max(0.001, u), 1);
    b.position.set(swayAmt(t) * 0.5, (DECK_Y - 0.4 + BED + 0.4) / 2, b.userData.z + 0.2 * b.userData.d);
    b.rotation.set(0, 0, b.userData.d * ang);
    b.scale.y = Math.max(0.001, u) * Math.hypot(2.3, h) / 2.75;
  });
  railPosts.forEach((p) => {
    const t0 = T.railings - 0.2 + p.userData.i * 0.07 + (p.userData.x > 0 ? 0.15 : 0);
    const u = eob(st(t0, t0 + 0.25, t)); p.visible = u > 0; const z = p.userData.z;
    p.position.set(p.userData.x + deckX(z, t), deckY(z, t) + 0.5, z); p.scale.set(1, Math.max(0.001, u), 1);
  });
  rails.forEach((r, i) => { const u = eo(st(T.railings + 0.5 + i * 0.12, T.railings + 1.3 + i * 0.12, t)); r.visible = u > 0; r.scale.z = Math.max(0.001, u); r.position.set(r.userData.x, DECK_Y + 0.05 + r.userData.y, 7.1 - 7.1 * u); });
  // stones
  stones.forEach((s, i) => {
    const t0 = T.stones - 0.25 + i * 0.16; const u = st(t0, t0 + 0.45, t);
    s.visible = t > t0 && t < T.chop + 0.2;
    s.position.y = WATER + 0.12 + (1 - bounce(u)) * 5;
    if (i === 2) { const r = eio(st(T.rolls - 0.1, T.rolls + 0.5, t)); s.rotation.set(r * 1.9, 0, r * 0.6); s.position.y -= r * 0.45; s.position.x = 0.2 + r * 0.5; }
  });
}

function placeTruck(t) {
  const z = truckZ(t);
  truck.visible = z !== null;
  if (z === null) return;
  const y = Math.abs(z) < BANK + 0.5 ? deckY(z, t) + 0.05 : 0;
  const yf = Math.abs(z + 1) < BANK + 0.5 ? deckY(z + 1, t) : 0, yb = Math.abs(z - 1) < BANK + 0.5 ? deckY(z - 1, t) : 0;
  truck.position.set(deckX(z, t), Math.max(y, 0) + (Math.abs(z) < BANK + 0.5 ? 0 : 0) + (Math.abs(z) < BANK + 0.5 ? (y - Math.max(y, 0)) : 0), z);
  truck.rotation.set(Math.atan2(yf - yb, 2) * -1 * -1, Math.PI, swayAmt(t) * 0.15 + (t > T.sags && t < T.so5 ? Math.sin(t * 9) * 0.01 : 0));
  truck.userData.wheels.forEach((w) => { w.rotation.x = -z / 0.32; });
}

function placeHero(t) {
  let pos = V3(0.3, 0, 8.2), ry = Math.PI, pose = {}, rx = 0;
  axe.visible = t > T.chop - 0.3 && t < T.tiptoe - 0.1;
  hammer.visible = (t > T.so3 + 0.2 && t < T.then1) || (t > T.so5 && t < T.shorter) || (t > T.so7 && t < T.then2) || (t > T.so9 && t < T.congrats);
  const sw = (f, a) => Math.sin(t * f) * a;
  if (t < T.so1) { // dreaming of pizza on the near bank
    pos = V3(0.3, 0, 7.4); ry = Math.PI;
    pose = { hx: -0.1, bob: sw(4, 0.01), aR: [-0.9 * st(T.pizza, T.pizza + 0.3, t), 0.1], mouth: 'smile' };
    if (t > T.swim - 0.3) { const u = st(T.swim - 0.3, T.swim, t); pose = { hy: Math.sin((t - T.swim) * 14) * 0.45 * u, mouth: 'oh', brow: u, aL: [-0.3, 0.2], aR: [-0.3, 0.2] }; ry = Math.PI - 0.6; }
  } else if (t < T.chop - 0.4) { // throws stones then hops
    const thr = Math.sin(Math.max(0, t - T.stones + 0.4) * 10);
    pos = V3(0.3, 0, 7.0); ry = Math.PI;
    pose = { aR: [-1.2 - thr * 0.8 * (t < T.hop ? 1 : 0), 0.2], mouth: 'smile' };
    if (t > T.hop - 0.1) {
      const k = (t - (T.hop - 0.1)) / 0.38; const idx = Math.min(2, Math.floor(k)); const f = Math.min(1, k - Math.floor(k));
      const from = idx === 0 ? V3(0.3, 0, 6.8) : stones[idx - 1].position.clone().setY(WATER + 0.55);
      const to = stones[Math.min(idx, 2)].position.clone(); to.y = WATER + 0.55;
      const hop = k < 3;
      pos = hop ? from.clone().lerp(to, f) : to; if (hop) pos.y += Math.sin(f * Math.PI) * 0.7;
      pose = { aL: [-0.4, 1.1], aR: [-0.4, 1.1], lL: hop ? -0.6 * Math.sin(f * Math.PI) : 0, lR: hop ? 0.4 * Math.sin(f * Math.PI) : 0, mouth: 'smile' };
      if (t > T.rolls - 0.1) {
        const u = st(T.rolls - 0.1, T.rolls + 0.55, t);
        pos = stones[2].position.clone(); pos.y = lerp(WATER + 0.55, WATER - 1.2, ei(u)); pos.x += u * 0.4;
        pose = { aL: [-2.6, 0.9 + sw(20, 0.3)], aR: [-2.6, 0.9 - sw(20, 0.3)], mouth: 'oh', brow: 1, roll: u * 0.6 };
        if (t > T.rolls + 0.55) { const v = st(T.rolls + 0.55, T.wet + 0.2, t); pos = V3(0.8, WATER - 1.45 + eo(v) * 0.55, 0.8); pose = { aL: [-2.8, 0.6 + sw(9, 0.4)], aR: [-2.8, 0.6 - sw(9, 0.4)], mouth: 'oh', brow: -0.5, hz: sw(3, 0.1) }; ry = 0.3; }
      }
    }
  } else if (t < T.tiptoe - 0.05) { // chopping
    pos = V3(0.6, 0, 8.35); ry = -Math.PI / 2 - 0.25;
    const sw2 = Math.sin((t - T.chop) * 9);
    pose = { aR: [-1.6 + sw2 * 0.9, 0.3], eR: 0.3, aL: [-1.2 + sw2 * 0.7, 0.4], eL: 0.6, mouth: 'smile', lean: 0.1 * sw2 };
    if (t > T.crash - 0.8) { pose = { aR: [-0.4, 0.4], aL: [-0.4, 0.4], hx: -0.3 + st(T.crash - 0.8, T.crash, t) * 0.3, mouth: 'oh', brow: 1 }; ry = Math.PI; pos = V3(1.5, 0, 8.8); }
  } else if (t < T.so3) { // tightrope on the round log
    const u = st(T.tiptoe, T.so3 - 0.3, t);
    const z = lerp(6.0, 0.2, u);
    const wob = Math.sin((t - T.tiptoe) * 6) * (0.15 + 0.35 * st(T.spins, T.wobble + 0.3, t));
    pos = V3(-0.55 + wob * 0.25, deckY(z, t) - 0.08 + LOG_R * 0.45, z); ry = Math.PI;
    pose = { aL: [0, 1.45 + wob], aR: [0, 1.45 - wob], roll: wob, lL: Math.sin(t * 8) * 0.3, lR: -Math.sin(t * 8) * 0.3, mouth: wob > 0.25 ? 'oh' : 'smile', brow: st(T.spins, T.wobble, t), look: [Math.sign(wob), -1] };
  } else if (t < T.then1) { // building the walkway, then strolling across
    pos = V3(1.9, 0, 7.4); ry = -2.6;
    const hm = Math.max(0, Math.sin((t - T.planks) * 14));
    pose = { aR: [-1.4 - hm * 0.9, 0.2], eR: 0.6, mouth: 'smile' };
    if (t > T.walkway - 0.3) { const u = st(T.walkway - 0.3, T.then1, t); const z = lerp(6.5, 2.0, u); const ph = Math.sin(t * 10) * 0.5; pos = V3(0.2, deckY(z, t) + 0.05, z); ry = Math.PI; pose = { lL: ph, lR: -ph, aL: [-0.3, 1.1], aR: [-0.3, 1.1], eL: 0.3, eR: 0.3, mouth: 'smile', bob: Math.abs(Math.cos(t * 10)) * 0.06 }; }
  } else if (t < T.so5) { // in the truck (hidden) -> panics beside
    pos = V3(2.3, 0, 7.6); ry = Math.PI + 0.4;
    pose = { aL: [-2.6, 0.7], aR: [-2.6, 0.7], eL: 0.6, eR: 0.6, mouth: t > T.sags ? 'oh' : 'smile', brow: st(T.sags, T.sags + 0.3, t), bob: t > T.sags ? Math.abs(sw(12, 0.08)) : 0 };
  } else if (t < T.until2) { // hammering posts / genius
    const bent = Math.min(1, Math.floor((t - T.hammer) / 0.55));
    pos = V3(2.2, 0, 7.0); ry = -2.7;
    const hm = Math.max(0, Math.sin((t - T.hammer) * 13));
    pose = { aR: [-2.0 + hm * 1.2, 0.2], eR: 0.4, mouth: 'smile', lean: 0.08 * hm };
    if (t > T.shorter - 0.2) { pose = { aR: [-2.6, 0.3], eR: 1.2, aL: [-0.3, 0.3], mouth: 'smile', hx: -0.2 }; ry = 2.6; pos = V3(2.4, 0, 7.2); }
    if (t > T.genius - 0.15) { pose = { aR: [-1.3, 0.3], eR: 1.3, aL: [-1.3, 0.3], eL: 1.3, mouth: 'smile', bob: Math.abs(sw(8, 0.12)) }; }
  } else if (t < T.so7) { // swaying panic
    pos = V3(-2.6, 0, 7.8); ry = Math.PI - 0.5;
    pose = { aL: [-2.5, 0.5], aR: [-2.5, 0.5], eL: 1.8, eR: 1.8, mouth: 'oh', brow: 1, hz: swayAmt(t) * 0.8 };
  } else if (t < T.then2) { // nailing braces
    pos = V3(-2.0, WATER - 0.95, 2.9); ry = Math.PI * 0.75;
    const hm = Math.max(0, Math.sin((t - T.diagonal) * 13));
    pose = { aR: [-2.0 + hm * 1.2, 0.2], eR: 0.4, mouth: 'smile' };
    if (t > T.triangles - 0.2) pose = { aR: [-1.3, 0.2], eR: 1.3, mouth: 'smile', hx: -0.2 };
  } else if (t < T.congrats) {
    pos = t < T.so9 ? V3(3.0, 0, 7.4) : V3(-1.7, 0, 7.2); ry = t < T.so9 ? Math.PI + 0.6 : Math.PI - 0.3;
    const hm = t > T.railings ? Math.max(0, Math.sin((t - T.railings) * 13)) : 0;
    pose = { aR: [-1.6 - hm * 0.6, 0.3], mouth: t > T.railings ? 'smile' : 'oh', hy: t < T.so9 ? -0.5 : 0 };
  } else { // celebrate, then drive to pizza (hidden when in truck)
    pos = V3(1.6, 0, 7.0); ry = 0.4 + Math.PI;
    const j = Math.abs(Math.sin((t - T.congrats) * 7)) * 0.35;
    pose = { bob: j, aL: [-2.8, 0.5], aR: [-2.8, 0.5], mouth: 'oh' };
    if (t > T.congrats + 0.4) hero.visible = false;
  }
  if (t < T.congrats + 0.4) hero.visible = true;
  hero.position.copy(pos); hero.rotation.set(rx, ry, 0); applyPose(hero, pose);
}

function placeNeighbor(t) {
  neighbor.visible = t > T.then2 - 0.3;
  const pos = V3(-2.6, 0, 8.3); let pose = { mouth: 'oh', brow: 1 };
  if (t < T.so9) { const w = Math.sin(t * 9); pose = { aL: [-1.6 + w * 0.5, 0.4], eL: 1.2, aR: [-0.2, 0.9], eR: 1.6, mouth: 'oh', brow: 1, hz: w * 0.08 }; }
  else if (t < T.congrats) pose = { aL: [-0.2, 0.9], eL: 1.6, aR: [-0.2, 0.9], eR: 1.6, mouth: t > T.railings + 0.8 ? 'smile' : 'oh', brow: t > T.railings + 0.8 ? 0 : 0.7 };
  else pose = { aL: [-2.6, 0.5], aR: [-2.6, 0.5], mouth: 'smile', bob: Math.abs(Math.sin(t * 7)) * 0.2 };
  neighbor.position.copy(pos); neighbor.rotation.y = 2.3; applyPose(neighbor, pose);
}

function placeGoat(t) {
  goat.visible = t > T.then2 - 0.3 && t < DUR;
  let z = lerp(5.5, 1.5, st(T.then2 - 0.2, T.falling - 0.2, t)), x = deckX(z, t), y = deckY(z, t) + 0.05, rz = 0, ry = Math.PI;
  const fall = st(T.falling - 0.2, T.falling + 0.5, t);
  if (fall > 0) { x = 0.3 + ei(fall) * 1.8 + fall * 0.5; y = lerp(deckY(z, t) + 0.05, WATER - 0.6, ei(fall)); rz = -fall * 1.6; }
  if (t > T.falling + 0.5) { x = 2.6; y = WATER - 0.55 + Math.sin(t * 5) * 0.05; rz = 0; ry = Math.PI / 2; }
  if (t > T.railings + 0.4) { const u = st(T.railings + 0.4, T.railings + 1.6, t); z = lerp(5.5, 0.5, u); x = 0.8; y = deckY(z, t) + 0.05; ry = Math.PI; rz = 0; if (u >= 1) x = 0.8 + Math.sin(t * 3) * 0.05; }
  goat.position.set(x, y, z); goat.rotation.set(0, ry, rz);
  const walking = (t < T.falling - 0.2) || (t > T.railings + 0.4 && t < T.railings + 1.6);
  goat.userData.legs.forEach((l, i) => { l.rotation.x = walking ? Math.sin(t * 12 + (i % 2) * Math.PI + (i >> 1) * Math.PI) * 0.5 : (t > T.falling ? Math.sin(t * 14 + i) * 0.7 : 0); });
  goat.userData.head.rotation.x = Math.sin(t * 2) * 0.1;
}

function placeEnv(t) {
  const strong = 1 + 2.2 * st(T.current - 0.3, T.current + 0.4, t) * (1 - st(T.diagonal, T.triangles, t));
  waterU.t.value = t * 1.0 + 2.2 * Math.max(0, Math.min(t, T.triangles) - T.current) * st(T.current - 0.3, T.current + 0.4, t);
  waterU.flow.value = 1;
  clouds.forEach((c) => { c.position.x = c.userData.x0 + t * c.userData.sp; });
  trees.forEach((tr) => { tr.userData.top.rotation.z = Math.sin(t * 0.9 + tr.userData.ph) * 0.03; });
  const sp = [
    [T.stones - 0.25, stones[0].position], [T.rolls + 0.25, V3(0.6, 0, 0.8)], [T.crash - 0.05, V3(-0.5, 0, 0)],
    [T.falling + 0.3, V3(2.3, 0, 1.5)], [T.rolls + 0.05, stones[2].position], [T.hammer + 0.25, V3(-1.15, 0, -2.5)],
  ];
  splashes.forEach((s, i) => placeSplash(s, t, sp[i][0], sp[i][1], i === 2 ? 2.2 : 1));
}

// ---------------------------------------------------------------- camera
function shake(t) { let s = 0; for (const [t0, a, d] of [[T.crash, 0.25, 0.8], [T.rolls + 0.25, 0.08, 0.5], [T.sags, 0.05, 1.2], [T.falling + 0.3, 0.06, 0.5]]) { const u = (t - t0) / d; if (u > 0 && u < 1) s += a * (1 - u) * (1 - u); } return s; }
let SHOTS = [];
function buildShots() {
  SHOTS = [
    [0, T.so1 - 0.05, (u) => ({ p: V3(lerp(7, 3.2, eio(u)), lerp(11, 2.6, eio(u)), lerp(24, 12.2, eio(u))), g: V3(-0.3, lerp(0, 1.4, u), lerp(-6, -2, u)), f: 54 })],
    [T.so1 - 0.05, T.rolls - 0.2, (u) => ({ p: V3(lerp(2.6, 2.2, u), lerp(2.4, 2.0, u), lerp(10.5, 9.4, u)), g: V3(0, -0.2, lerp(1, 2.5, u)), f: 52 })],
    [T.rolls - 0.2, T.chop - 0.4, (u) => ({ p: V3(lerp(6.8, 5.8, u), lerp(1.8, 1.2, u), lerp(6.8, 5.8, u)), g: V3(0.6, -0.3, 0.8), f: 50 })],
    [T.chop - 0.4, T.crash - 0.8, (u) => ({ p: V3(lerp(4.2, 3.6, u), lerp(1.4, 1.2, u), lerp(4.2, 4.6, u)), g: V3(-0.2, lerp(2.2, 4.0, u), 7.8), f: 58 })],
    [T.crash - 0.8, T.tiptoe - 0.05, (u) => ({ p: V3(lerp(10, 8.5, u), lerp(9, 7, u), lerp(12, 9.5, u)), g: V3(-0.4, 0.5, lerp(3, 0.5, u)), f: 54 })],
    [T.tiptoe - 0.05, T.so3 - 0.05, (u, t) => { const z = lerp(6.0, 0.2, st(T.tiptoe, T.so3 - 0.3, t)); return { p: V3(1.6, 1.9, z - 4.2), g: V3(-0.5, 1.0, z), f: 50 }; }],
    [T.so3 - 0.05, T.walkway - 0.3, (u) => ({ p: V3(lerp(8, 6.5, u), lerp(7.5, 6, u), lerp(10, 9, u)), g: V3(0, 0, lerp(2, 0.5, u)), f: 50 })],
    [T.walkway - 0.3, T.then1 - 0.05, (u, t) => ({ p: V3(0.8, 1.6, lerp(-1.5, -2.5, u)), g: V3(0.1, 1.3, 5.5), f: 52 })],
    [T.then1 - 0.05, T.so5 - 0.05, (u) => ({ p: V3(lerp(12, 10.5, u), lerp(2.4, 1.6, u), lerp(2.5, 1.0, u)), g: V3(0, lerp(0.4, 0.0, u), 0.8), f: 52 })],
    [T.so5 - 0.05, T.shorter - 0.2, (u) => ({ p: V3(lerp(6.5, 5.6, u), lerp(0.6, 0.3, u), lerp(6.5, 5.5, u)), g: V3(0, -0.9, 0), f: 54 })],
    [T.shorter - 0.2, T.until2 - 0.05, (u) => ({ p: V3(lerp(16.5, 15, u), lerp(0.4, 0.8, u), 0.3), g: V3(0, -0.3, 0.3), f: 54 })],
    [T.until2 - 0.05, T.so7 - 0.05, (u) => ({ p: V3(lerp(4.5, 3.5, u), lerp(4.2, 3.4, u), lerp(14.5, 13, u)), g: V3(0, -0.3, -0.5), f: 46 })],
    [T.so7 - 0.05, T.then2 - 0.05, (u) => ({ p: V3(lerp(3.2, 2.4, u), lerp(-0.15, 0.0, u), lerp(5.6, 5.4, u)), g: V3(0, -0.9, 2.5), f: 56 })],
    [T.then2 - 0.05, T.so9 - 0.05, (u) => ({ p: V3(lerp(-6.0, -5.2, u), lerp(2.6, 2.2, u), lerp(13, 12, u)), g: V3(-0.4, 0.6, lerp(4.0, 3.0, u)), f: 52 })],
    [T.so9 - 0.05, T.congrats - 0.05, (u) => ({ p: V3(lerp(4.2, 3.0, u), lerp(2.6, 2.2, u), lerp(10, 9.2, u)), g: V3(0, 0.6, lerp(2, 0, u)), f: 52 })],
    [T.congrats - 0.05, DUR + 1, (u, t) => { const e = eio(st(T.congrats, DUR - 0.5, t)); return { p: V3(lerp(3, 12, e), lerp(2.0, 13, e), lerp(10, 20, e)), g: V3(0, lerp(1, -1, e), lerp(2, -4, e)), f: 50 }; }],
  ];
}
buildShots();
function placeCamera(t) {
  const s = SHOTS.find((x) => t >= x[0] && t < x[1]) || SHOTS[SHOTS.length - 1];
  const u = cl((t - s[0]) / (s[1] - s[0]));
  const c = s[2](u, t);
  const sk = shake(t);
  camera.position.copy(c.p).add(V3(Math.sin(t * 1.3) * 0.04 + Math.sin(t * 31) * sk, Math.sin(t * 1.7) * 0.03 + Math.sin(t * 27 + 1) * sk, 0));
  camera.fov = c.f; camera.updateProjectionMatrix(); camera.lookAt(c.g);
  return s;
}

// ---------------------------------------------------------------- 2D overlay
function scr(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, ok: p.z < 1 }; }
function outlineText(txt, x, y, size, fill, stroke = '#141414', sw = 0.16, font = 'Luckiest Guy') {
  ctx.font = `${size}px "${font}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size * sw; ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y + size * 0.06); ctx.fillStyle = fill; ctx.fillText(txt, x, y + size * 0.06);
}
const pop = (age, d = 0.25) => eob(cl(age / d));
function burst(x, y, r, text, col, age, rot = -0.12) {
  if (age < 0 || age > 1.1) return;
  const s = eob(cl(age / 0.22)) * (1 - st(0.85, 1.1, age)); if (s <= 0) return;
  x = Math.min(W - r * 1.3, Math.max(r * 1.3, x)); y = Math.max(r * 1.2, y);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.beginPath();
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, rr = i % 2 ? r * 0.72 : r; ctx.lineTo(Math.cos(a) * rr * 1.3, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#141414'; ctx.stroke();
  outlineText(text, 0, 0, r * 0.6, '#ffffff'); ctx.restore();
}
function arrow(x0, y0, x1, y1, col, w = 14, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(a) * w * 1.6, y1 + Math.sin(a) * w * 1.6); ctx.lineTo(x1 + Math.cos(a + 2.4) * w * 2.4, y1 + Math.sin(a + 2.4) * w * 2.4); ctx.lineTo(x1 + Math.cos(a - 2.4) * w * 2.4, y1 + Math.sin(a - 2.4) * w * 2.4); ctx.fill(); ctx.restore();
}
function bubble(x, y, w, h, draw, s) {
  if (s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 7); ctx.fill(); ctx.stroke();
  for (const [dx, dy, r] of [[-w * 0.25, h * 0.62, 22], [-w * 0.36, h * 0.85, 13]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill(); ctx.stroke(); }
  draw(); ctx.restore();
}
function pizzaIcon(s) {
  ctx.save(); ctx.scale(s, s); ctx.lineWidth = 7; ctx.strokeStyle = '#141414';
  ctx.fillStyle = '#ffcf5c'; ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(-62, -45); ctx.quadraticCurveTo(0, -75, 62, -45); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c98a3b'; ctx.beginPath(); ctx.moveTo(-62, -45); ctx.quadraticCurveTo(0, -75, 62, -45); ctx.lineTo(56, -30); ctx.quadraticCurveTo(0, -58, -56, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d62828'; for (const [x, y] of [[-15, -18], [18, -10], [0, 20]]) { ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); }
  ctx.restore();
}
function noSwim(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 105, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#2a9df4'; ctx.lineWidth = 9; for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let i = -70; i <= 70; i += 5) ctx.lineTo(i, 30 + k * 26 + Math.sin(i * 0.12) * 8); ctx.stroke(); }
  ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(-20, -20, 17, 0, 7); ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = '#141414'; ctx.beginPath(); ctx.moveTo(-60, 5); ctx.lineTo(-5, 0); ctx.lineTo(45, -30); ctx.stroke();
  ctx.strokeStyle = '#e63946'; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-72, -72); ctx.lineTo(72, 72); ctx.stroke();
  ctx.restore();
}
function drops(x, y, t) { ctx.fillStyle = '#7fd3ff'; ctx.strokeStyle = '#14324a'; ctx.lineWidth = 4; for (let i = 0; i < 6; i++) { const ph = ((t * 1.6 + i * 0.17) % 1); const xx = x - 70 + i * 28, yy = y + ph * 120; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.moveTo(xx, yy - 18); ctx.quadraticCurveTo(xx + 11, yy, xx, yy + 8); ctx.quadraticCurveTo(xx - 11, yy, xx, yy - 18); ctx.fill(); ctx.stroke(); } ctx.globalAlpha = 1; }
function confetti(t, t0) {
  const age = t - t0; if (age < 0 || age > 4) return; const r = rng(99);
  for (let i = 0; i < 150; i++) {
    const side = i % 2 ? -1 : 1, spread = r() * 700, ph = r() * 6, vy = 300 + r() * 500, col = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff7ae0'][i % 6];
    const x = side > 0 ? r() * 200 + spread * eo(cl(age * 2)) : W - r() * 200 - spread * eo(cl(age * 2));
    const y = H * 0.75 - (900 + r() * 600) * eo(cl(age * 1.6)) + vy * age * age * 0.5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(age * 6 + ph); ctx.fillStyle = col; ctx.globalAlpha = 1 - st(3.2, 4, age); ctx.fillRect(-9, -5, 18, 10); ctx.restore();
  }
}
function captions(t) {
  let seg = null;
  for (let i = 0; i < SEG.length; i++) { const s = SEG[i], nx = SEG[i + 1]; const end = nx ? Math.min(nx.start - 0.02, s.end + 0.6) : s.end + 1.0; if (t >= s.start - 0.08 && t < end) { seg = s; break; } }
  if (!seg) return;
  const chunks = []; let cur = [];
  seg.words.forEach((w, i) => { cur.push(w); if (cur.length >= 4 || /[,.!?]$/.test(w.w) || i === seg.words.length - 1) { chunks.push(cur); cur = []; } });
  let ch = chunks[0]; for (const c of chunks) if (t >= c[0].s - 0.08) ch = c;
  const sc = eob(cl((t - (ch[0].s - 0.08)) / 0.18)); const size = 96;
  ctx.save(); ctx.translate(W / 2, 1515); ctx.scale(sc, sc); ctx.font = `${size}px "Luckiest Guy"`;
  const words = ch.map((w) => w.w.toUpperCase()); const widths = words.map((w) => ctx.measureText(w).width); const gap = 26;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let lines = [[0, words.length]]; if (total > 940) { const mid = Math.ceil(words.length / 2); lines = [[0, mid], [mid, words.length]]; }
  lines.forEach(([a, b], li) => {
    const lw = widths.slice(a, b).reduce((x, y) => x + y, 0) + gap * (b - a - 1); let x = -lw / 2; const y = (li - (lines.length - 1) / 2) * size * 1.08;
    for (let i = a; i < b; i++) { const w = ch[i]; const active = t >= w.s - 0.03 && (i === ch.length - 1 || t < ch[i + 1].s - 0.03); ctx.save(); ctx.translate(x + widths[i] / 2, y); const ps = active ? 1.12 : 1; ctx.scale(ps, ps); outlineText(words[i], 0, 0, size, active ? '#ffd93d' : '#ffffff', '#141414', 0.2); ctx.restore(); x += widths[i] + gap; }
  });
  ctx.restore();
}
function sparkle(x, y, s) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = 20; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * 0.22 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }

function overlay(t) {
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.33)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // opening title (before the voice starts)
  if (t < SEGSTART(0) + 0.6) { const a = pop(t - 0.15, 0.35) * (1 - st(SEGSTART(0) + 0.2, SEGSTART(0) + 0.6, t)); ctx.save(); ctx.translate(W / 2, 330); ctx.scale(a, a); ctx.rotate(-0.04); outlineText('HOW TO CROSS', 0, -70, 104, '#ffffff', '#123a5a', 0.2); outlineText('A RIVER', 0, 50, 130, '#ffd93d', '#123a5a', 0.2); ctx.restore(); }
  // pizza dream bubble
  if (t > T.pizza - 0.1 && t < T.so1 - 0.05) { const h = scr(hero.position.clone().add(V3(0, 2.6, 0))); bubble(Math.min(W - 230, h.x + 190), Math.max(260, h.y - 210), 300, 230, () => pizzaIcon(1.2), pop(t - T.pizza) * (1 - st(T.so1 - 0.3, T.so1 - 0.05, t))); }
  if (t > T.swim - 0.15 && t < T.so1 - 0.05) noSwim(230, 420, pop(t - T.swim + 0.15) * 0.95);
  if (t > T.stones - 0.25 && t < T.stones + 0.9) { const p = scr(stones[2].position); burst(p.x + 200, p.y - 300, 100, 'PLOP!', '#4cc9f0', t - T.stones + 0.1, 0.1); }
  if (t > T.hop && t < T.rolls - 0.2) { for (let i = 0; i < 3; i++) { const age = t - (T.hop - 0.1 + i * 0.38 + 0.19); if (age > 0 && age < 0.5) { const p = scr(stones[i].position.clone().add(V3(0, 1.8, 0))); ctx.globalAlpha = 1 - age * 2; outlineText('HOP!', p.x + 120, p.y - age * 150, 70, '#ffd93d'); ctx.globalAlpha = 1; } } }
  if (t > T.rolls + 0.2 && t < T.chop - 0.4) { const p = scr(V3(0.8, 0.5, 0.8)); burst(p.x, p.y - 330, 160, 'SPLASH!', '#2a9df4', t - T.rolls - 0.25, -0.1); if (t > T.wet - 0.2) { const h = scr(hero.position.clone().add(V3(0, 2.4, 0))); drops(h.x, h.y - 40, t); } }
  if (t > T.chop - 0.3 && t < T.crash - 0.8) { for (let i = 0; i < 4; i++) { const age = t - (T.chop - 0.2 + i * 0.35); if (age > 0 && age < 0.45) { const p = scr(V3(-0.5, 1.0, 7.6)); ctx.save(); ctx.translate(p.x + (i % 2 ? 160 : -160), p.y - 120 - age * 120); ctx.scale(pop(age, 0.12), pop(age, 0.12)); outlineText('CHOP!', 0, 0, 80, '#ffb703'); ctx.restore(); } } }
  if (t > T.crash - 0.15 && t < T.tiptoe) { const p = scr(V3(-0.5, 0.5, 0)); burst(p.x, p.y - 350, 190, 'CRASH!', '#ff595e', t - T.crash + 0.1, -0.08); }
  if (t > T.wobble - 0.1 && t < T.so3) { const h = scr(hero.position.clone().add(V3(0, 2.5, 0))); outlineText('!!', h.x + 130, h.y - 40, 110 * pop(t - T.wobble), '#ff595e'); }
  if (t > T.round && t < T.so3) { const p = scr(V3(-0.55, 0, hero.position.z - 1.5)); const a = pop(t - T.round) * 0.9; ctx.save(); ctx.translate(p.x, p.y + 120); ctx.scale(a, a * 0.5); ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 20; ctx.beginPath(); ctx.arc(0, 0, 150, t * 6, t * 6 + 4.4); ctx.stroke(); ctx.restore(); }
  if (t > T.planks - 0.1 && t < T.walkway - 0.3) { for (let i = 0; i < 5; i++) { const age = t - (T.planks + i * 0.3); if (age > 0 && age < 0.35) { const p = scr(planks[Math.min(NPL - 1, i * 5)].position); ctx.globalAlpha = 1 - age / 0.35; outlineText(i % 2 ? 'TAP!' : 'BANG!', p.x + 140, p.y - 80 - age * 100, 64, '#ffd93d'); ctx.globalAlpha = 1; } } }
  if (t > T.walkway && t < T.then1) { const a = pop(t - T.walkway); for (let i = 0; i < 6; i++) { const p = scr(V3(-1 + i * 0.4, 1.5 + (i % 2) * 0.6, 4 - i * 0.6)); sparkle(p.x, p.y, 40 * a * (0.7 + 0.3 * Math.sin(t * 9 + i))); } }
  if (t > T.sags - 0.2 && t < T.so5 - 0.05) {
    const p = scr(V3(0, -0.6, 0)); const a = pop(t - T.sags + 0.2);
    ctx.globalAlpha = a; for (let i = 0; i < 2; i++) arrow(p.x - 140 + i * 280, p.y - 230, p.x - 140 + i * 280, p.y - 60 + Math.sin(t * 8) * 10, '#ff595e', 18); ctx.globalAlpha = 1;
    burst(p.x, p.y - 520, 130, 'CREAK!', '#ff9f1c', t - T.sags - 0.1, 0.08);
  }
  if (t > T.hammer && t < T.shorter - 0.2) { for (let i = 0; i < 4; i++) { const age = t - (T.hammer + (i >> 1) * 0.55 + (i & 1) * 0.18 + 0.3); if (age > 0 && age < 0.45) { const p = scr(posts[i].position.clone().add(V3(0, 1.3, 0))); ctx.save(); ctx.translate(p.x, p.y - 60); ctx.scale(pop(age, 0.1), pop(age, 0.1)); outlineText('THUNK!', 0, -age * 80, 66, '#ffd93d'); ctx.restore(); } } }
  if (t > T.shorter - 0.15 && t < T.until2 - 0.05) {
    const a = pop(t - T.shorter + 0.15);
    const ys = scr(V3(0, DECK_Y + 1.3, 0)).y;
    const zs = [-BANK, -2.5, 2.5, BANK].map((z) => scr(V3(0, DECK_Y + 1.3, z)).x);
    ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 9; ctx.strokeStyle = '#ffd93d'; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const x0 = zs[i] + 8, x1 = zs[i + 1] - 8; ctx.beginPath(); ctx.moveTo(x0, ys + 20); ctx.lineTo(x0, ys); ctx.lineTo(x1, ys); ctx.lineTo(x1, ys + 20); ctx.stroke(); }
    ctx.restore();
    if (t > T.genius - 0.1) { const g = scr(V3(0, 3.5, 0)); const s = pop(t - T.genius + 0.1); ctx.save(); ctx.translate(W / 2, Math.max(330, g.y - 250)); ctx.scale(s, s); ctx.fillStyle = '#ffe66d'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 9; ctx.shadowColor = '#fff3a0'; ctx.shadowBlur = 40; ctx.beginPath(); ctx.arc(0, 0, 85, 0.75 * Math.PI, 0.25 * Math.PI); ctx.lineTo(35, 110); ctx.lineTo(-35, 110); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = '#8d99ae'; ctx.fillRect(-35, 110, 70, 40); ctx.strokeRect(-35, 110, 70, 40); for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2 + t; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 110, Math.sin(an) * 110 - 10); ctx.lineTo(Math.cos(an) * 150, Math.sin(an) * 150 - 10); ctx.stroke(); } ctx.restore(); }
  }
  if (t > T.current - 0.2 && t < T.so7 - 0.05) { const a = pop(t - T.current + 0.2); for (let i = 0; i < 4; i++) { const ph = ((t * 0.9 + i * 0.25) % 1); const y = 1000 + i * 120; ctx.globalAlpha = a * Math.sin(ph * Math.PI); arrow(-100 + ph * (W + 200), y, -100 + ph * (W + 200) + 160, y, '#e0f7ff', 16); ctx.globalAlpha = 1; } if (t > T.sway) { outlineText('~ WOBBLE ~', W / 2 + Math.sin(t * 12) * 20, 420, 92 * pop(t - T.sway), '#ff595e'); } }
  if (t > T.triangles - 0.2 && t < T.then2 - 0.05) {
    const z = 2.5; const a = scr(V3(-1.15, BED + 0.4, z)), b = scr(V3(1.15, DECK_Y - 0.4, z)), c = scr(V3(-1.15, DECK_Y - 0.4, z)), d = scr(V3(1.15, BED + 0.4, z));
    const s = pop(t - T.triangles + 0.2); ctx.save(); ctx.globalAlpha = s; ctx.lineWidth = 12; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffd93d'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = '#4cc9f0'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.stroke(); ctx.restore();
    burst(W / 2, 430, 130, 'SOLID!', '#8ac926', t - T.triangles, -0.06);
  }
  if (t > T.then2 && t < T.so9 - 0.05) { const n = scr(neighbor.position.clone().add(V3(0, 2.6, 0))); bubble(Math.max(240, n.x - 40), Math.max(300, n.y - 230), 330, 220, () => { outlineText('MY GOAT!!', 0, 0, 60, '#ff595e'); }, pop(t - T.then2)); }
  if (t > T.falling + 0.25 && t < T.so9) { const p = scr(goat.position); burst(p.x, p.y - 260, 120, 'SPLOOSH!', '#2a9df4', t - T.falling - 0.3, 0.1); }
  if (t > T.railings + 0.4 && t < T.congrats) { const n = scr(neighbor.position.clone().add(V3(0, 2.6, 0))); if (t > T.railings + 1.0) outlineText('✔', n.x, n.y - 60, 120 * pop(t - T.railings - 1.0), '#8ac926'); }
  confetti(t, T.congrats);
  if (t > T.bridge - 0.3) {
    const a = pop(t - T.bridge + 0.3, 0.35); ctx.save(); ctx.translate(W / 2, 320); ctx.scale(a, a); ctx.rotate(-0.04);
    outlineText('YOU INVENTED', 0, -70, 104, '#ffffff', '#123a5a', 0.2); outlineText('THE BRIDGE!', 0, 60, 136, '#ffd93d', '#123a5a', 0.2); ctx.restore();
    if (t > T.bridge + 1.2) { ctx.save(); ctx.translate(W - 210, 620); const s2 = pop(t - T.bridge - 1.2); ctx.scale(s2, s2); ctx.rotate(Math.sin(t * 4) * 0.12); pizzaIcon(1.1); ctx.restore(); }
  }
  captions(t);
  const fade = Math.max(1 - st(0, 0.35, t), st(DUR - 0.6, DUR, t));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  for (const tc of [T.so1, T.chop - 0.4, T.tiptoe, T.so3, T.then1, T.so5, T.until2, T.so7, T.then2, T.congrats]) { const u = (t - tc) / 0.16; if (u >= 0 && u < 1) { ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - u)})`; ctx.fillRect(0, 0, W, H); } }
}

window.renderFrame = (t, q = 0.92) => {
  placeEnv(t); placeBridge(t); placeTruck(t); placeHero(t); placeNeighbor(t); placeGoat(t);
  placeCamera(t);
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, W, H); ctx.drawImage(glCanvas, 0, 0); overlay(t);
  return out.toDataURL('image/jpeg', q);
};
document.fonts.load('96px "Luckiest Guy"').then(() => document.fonts.load('70px "Fredoka"')).then(() => { drawShop(); window.READY = true; });

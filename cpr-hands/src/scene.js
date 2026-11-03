// "Your Hands Can Save a Life" – CPR explainer. Deterministic 3D (three.js) + 2D icon overlays, no captions.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920;
const SEG = window.SEGMENTS || [];
const DUR = window.DUR || 65.5;
const cl = (x) => Math.min(1, Math.max(0, x));
const st = (a, b, t) => cl((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eo = (x) => 1 - Math.pow(1 - x, 3);
const ei = (x) => x * x * x;
const eob = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(3);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- beats
const WORDS = SEG.flatMap((s) => s.words.map((w) => ({ w: w.w.toLowerCase().replace(/[^a-z0-9']/g, ''), s: w.s })));
function Wt(word, after = 0) { const ws = word.split('|'); const x = WORDS.find((q) => ws.includes(q.w) && q.s >= after); return x ? x.s : after + 1.2; }
const B = {};
B.drops = Wt('drops'); B.pulse = Wt('pulse'); B.breath = Wt('breath'); B.brain = Wt('brain'); B.four = Wt('four'); B.ambulance = Wt('ambulance'); B.eight = Wt('eight');
B.what = Wt('what', B.eight); B.decides = Wt('decides'); B.live = Wt('live', B.decides);
B.this = Wt('this', B.live); B.wiring = Wt('wiring'); B.haywire = Wt('haywire'); B.quivers = Wt('quivers'); B.blood = Wt('blood', B.quivers);
B.but = Wt('but', B.blood); B.hands = Wt('hands', B.but);
B.cpr = Wt('cpr', B.hands); B.become = Wt('become');
B.push1 = Wt('push', B.become); B.spine = Wt('spine'); B.brain2 = Wt('brain', B.spine); B.let = Wt('let', B.brain2); B.refills = Wt('refills');
B.first = Wt('first', B.refills); B.call = Wt('call', B.first); B.speaker = Wt('speaker');
B.heel = Wt('heel'); B.other = Wt('other', B.heel); B.lock = Wt('lock'); B.hard = Wt('hard', B.lock); B.inches = Wt('inches|deep', B.hard);
B.fast = Wt('fast', B.inches); B.hundred = Wt('hundred|100', B.fast); B.beat = Wt('beat', B.hundred); B.stayin = Wt("stayin'|stayin|staying", B.beat);
B.not = Wt('not', B.stayin); B.skip = Wt('skip'); B.just = Wt('just', B.skip); B.push2 = Wt('push', B.just);
B.then = Wt('then', B.push2); B.aed = Wt('aed|a', B.then + 0.3); B.stops = Wt('stops', B.then); B.rhythm = Wt('rhythm');
B.your = Wt('your', B.rhythm); B.alive = Wt('alive', B.your);
B.now = Wt('now', B.alive); B.share = Wt('share'); B.save = Wt('save');
window.BEATS = B;
const T = B;
const BPM = 110, PERIOD = 60 / BPM;

// ---------------------------------------------------------------- renderer
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 300);
const composer = new EffectComposer(renderer); composer.setSize(W, H); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.2, 0.4, 0.9); composer.addPass(bloom); composer.addPass(new OutputPass());
const out = document.getElementById('out'); const ctx = out.getContext('2d');

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
function mesh(geo, m, cast = true, recv = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
const box = (w, h, d, m, r = 0) => mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), m);
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ---------------------------------------------------------------- living room
const room = new THREE.Group(); scene.add(room);
const floorTex = canvasTex(512, 512, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = ['#b9824f', '#c48c57', '#ad7646', '#bf8a55'][i % 4]; g.fillRect(i * 64, 0, 64, 512); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(i * 64, 0, 2, 512); g.fillRect(i * 64, ((i * 197) % 512), 64, 2); } });
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3);
const floor = mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }), false, true); floor.rotation.x = -Math.PI / 2; room.add(floor);
const wallM = M(0xe9dccb, { roughness: 0.9 }), wallM2 = M(0xd7c4ad, { roughness: 0.9 });
const backWall = box(14, 6, 0.2, wallM); backWall.position.set(0, 3, -5); room.add(backWall);
const leftWall = box(0.2, 6, 14, wallM2); leftWall.position.set(-5.5, 3, 0); room.add(leftWall);
const skirt = box(14, 0.18, 0.06, M(0xffffff)); skirt.position.set(0, 0.09, -4.88); room.add(skirt);
// window with daylight / later ambulance lights
const winGlow = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0xcfe9ff, emissiveIntensity: 0.9 });
const win = box(2.6, 2.2, 0.05, winGlow); win.position.set(2.4, 3.0, -4.88); room.add(win);
for (const [w, h, x, y] of [[2.8, 0.12, 2.4, 4.15], [2.8, 0.12, 2.4, 1.85], [0.12, 2.4, 1.05, 3.0], [0.12, 2.4, 3.75, 3.0], [0.08, 2.2, 2.4, 3.0], [2.6, 0.08, 2.4, 3.0]]) { const f = box(w, h, 0.12, M(0xffffff)); f.position.set(x, y, -4.85); room.add(f); }
const rug = mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.02, 48), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g) => { g.fillStyle = '#f2e8d8'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#d06a4c'; g.lineWidth = 10; for (let r = 30; r < 128; r += 26) { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); } }), roughness: 0.95 }), false, true);
rug.position.set(0.2, 0.01, -0.6); rug.scale.z = 0.75; room.add(rug);
// sofa
{ const sm = M(0x2f8f83, { roughness: 0.85 }); const s = new THREE.Group(); const base = box(3.6, 0.55, 1.1, sm, 0.12); base.position.y = 0.45; s.add(base); const back = box(3.6, 0.9, 0.3, sm, 0.12); back.position.set(0, 1.05, -0.45); s.add(back); for (const x of [-1.85, 1.85]) { const a = box(0.3, 0.75, 1.1, sm, 0.12); a.position.set(x, 0.65, 0); s.add(a); } for (const x of [-0.85, 0.85]) { const c = box(1.6, 0.2, 0.9, M(0x37a194, { roughness: 0.9 }), 0.08); c.position.set(x, 0.82, 0.05); s.add(c); } const p = box(0.6, 0.5, 0.18, M(0xf2a541), 0.08); p.position.set(-1.2, 1.1, -0.2); p.rotation.z = 0.2; s.add(p); s.position.set(-2.3, 0, -4.0); room.add(s); }
// coffee table, lamp, plant, frames, mug
{ const tm = M(0x8a5a33, { roughness: 0.5 }); const tb = box(1.6, 0.08, 0.8, tm, 0.03); tb.position.set(-2.6, 0.48, -2.0); room.add(tb); for (const [x, z] of [[-3.3, -2.3], [-1.9, -2.3], [-3.3, -1.7], [-1.9, -1.7]]) { const l = box(0.07, 0.46, 0.07, tm); l.position.set(x, 0.23, z); room.add(l); }
  const mug = mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.14, 14), M(0xffffff)); mug.position.set(-2.3, 0.6, -2.0); room.add(mug); }
{ const p = mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), M(0x333333, { metalness: 0.6 })); p.position.set(-4.6, 1.1, -4.3); room.add(p); const sh = mesh(new THREE.ConeGeometry(0.4, 0.5, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe2a8, emissiveIntensity: 0.8, side: THREE.DoubleSide })); sh.position.set(-4.6, 2.3, -4.3); room.add(sh); }
{ const pot = mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.5, 16), M(0xe07a5f)); pot.position.set(4.3, 0.25, -4.2); room.add(pot); for (let i = 0; i < 9; i++) { const l = mesh(new THREE.SphereGeometry(0.28, 10, 8), M(i % 2 ? 0x3f9a45 : 0x55b25a)); l.scale.set(0.6, 1.4, 0.3); l.position.set(4.3 + Math.cos(i * 0.7) * 0.25, 0.9 + (i % 3) * 0.25, -4.2 + Math.sin(i * 0.7) * 0.25); l.rotation.z = Math.cos(i) * 0.6; room.add(l); } }
for (const [x, y, w, h, c] of [[-2.8, 3.4, 1.3, 1.0, '#f4a261'], [-1.2, 3.6, 0.9, 1.2, '#2a9d8f']]) { const f = box(w, h, 0.05, new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = c; g.beginPath(); g.arc(64, 70, 34, 0, 7); g.fill(); g.fillStyle = '#264653'; g.fillRect(14, 96, 100, 16); }) })); f.position.set(x, y, -4.86); room.add(f); }
// lights
const hemi = new THREE.HemisphereLight(0xfff1e0, 0x8a6a4a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.4); sun.position.set(5, 9, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; scene.add(sun);
const winLight = new THREE.PointLight(0xcfe9ff, 8, 12, 1.6); winLight.position.set(2.4, 3, -3.8); scene.add(winLight);
const redL = new THREE.PointLight(0xff2a2a, 0, 14, 1.5); redL.position.set(1.4, 2.6, -3.6); scene.add(redL);
const blueL = new THREE.PointLight(0x2a6bff, 0, 14, 1.5); blueL.position.set(3.4, 2.6, -3.6); scene.add(blueL);
const heartGlow = new THREE.PointLight(0xff3b4a, 0, 3, 2); scene.add(heartGlow);

// ---------------------------------------------------------------- people
function makePerson(o) {
  const g = new THREE.Group(); const root = new THREE.Group(); g.add(root); const P = { mats: [] };
  const mk = (c, r = 0.7) => { const m = M(c, { roughness: r }); P.mats.push(m); return m; };
  const shirt = mk(o.shirt, 0.8), skin = mk(o.skin, 0.55), pants = mk(o.pants, 0.85), hair = mk(o.hair, 0.8), shoe = mk(0x2a2a2a);
  const torso = mesh(new THREE.CapsuleGeometry(0.33, 0.42, 6, 16), shirt); torso.position.y = 1.3; root.add(torso); P.torso = torso;
  const head = new THREE.Group(); head.position.y = 1.98; root.add(head); P.head = head;
  head.add(mesh(new THREE.SphereGeometry(0.34, 28, 20), skin));
  const hr = mesh(new THREE.SphereGeometry(0.36, 28, 14, 0, Math.PI * 2, 0, Math.PI * (o.long ? 0.62 : 0.48)), hair); hr.position.y = 0.03; hr.rotation.x = -0.35; head.add(hr);
  if (o.long) { const pony = mesh(new THREE.CapsuleGeometry(0.1, 0.35, 4, 8), hair); pony.position.set(0, -0.05, -0.32); pony.rotation.x = 0.3; head.add(pony); }
  const nose = mesh(new THREE.SphereGeometry(0.065, 12, 10), skin); nose.position.set(0, -0.02, 0.34); head.add(nose);
  P.eyes = []; P.brows = [];
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.08, 10, 8), skin); ear.position.set(s * 0.33, 0, 0); head.add(ear);
    const eye = new THREE.Group(); eye.position.set(s * 0.13, 0.07, 0.28); head.add(eye);
    eye.add(mesh(new THREE.SphereGeometry(0.085, 16, 12), M(0xffffff, { roughness: 0.15 }), false));
    const iris = mesh(new THREE.SphereGeometry(0.05, 12, 10), M(o.eye || 0x4a2e1a, { roughness: 0.2 }), false); iris.position.z = 0.055; eye.add(iris);
    const pu = mesh(new THREE.SphereGeometry(0.026, 10, 8), M(0x050505, { roughness: 0.1 }), false); pu.position.z = 0.085; eye.add(pu);
    const lid = mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, false); lid.rotation.x = -0.2; eye.add(lid); eye.userData.lid = lid;
    P.eyes.push(eye);
    const brow = mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), hair, false); brow.position.set(s * 0.13, 0.2, 0.31); head.add(brow); P.brows.push(brow);
  }
  const mouth = mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 16, Math.PI), M(0x5a1a1a), false); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.13, 0.31); head.add(mouth); P.mouth = mouth;
  P.arms = []; P.fore = [];
  for (const s of [1, -1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.42, 1.6, 0); root.add(sh);
    const up = mesh(new THREE.CapsuleGeometry(0.095, 0.3, 4, 10), shirt); up.position.y = -0.2; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.4; sh.add(el);
    const lo = mesh(new THREE.CapsuleGeometry(0.085, 0.25, 4, 10), o.sleeves ? shirt : skin); lo.position.y = -0.16; el.add(lo);
    const hand = mesh(new THREE.SphereGeometry(0.11, 12, 10), skin); hand.position.y = -0.36; hand.scale.set(1, 1.15, 0.7); el.add(hand);
    P.arms.push(sh); P.fore.push(el);
  }
  P.legs = []; P.shins = [];
  for (const s of [1, -1]) {
    const hp = new THREE.Group(); hp.position.set(s * 0.16, 0.95, 0); root.add(hp);
    const th = mesh(new THREE.CapsuleGeometry(0.125, 0.3, 4, 10), pants); th.position.y = -0.22; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
    const sn = mesh(new THREE.CapsuleGeometry(0.11, 0.28, 4, 10), pants); sn.position.y = -0.2; kn.add(sn);
    const sh = box(0.22, 0.13, 0.38, shoe, 0.05); sh.position.set(0, -0.42, 0.08); kn.add(sh);
    P.legs.push(hp); P.shins.push(kn);
  }
  g.userData = { root, P }; scene.add(g); return g;
}
function pose(person, p) {
  const { root, P } = person.userData;
  const d = { aL: [0, 0.1], aR: [0, 0.1], eL: 0, eR: 0, lL: 0, lR: 0, kL: 0, kR: 0, hx: 0, hy: 0, hz: 0, y: 0, lean: 0, blink: 0, brow: 0, mouthO: 0, ...p };
  P.arms[0].rotation.set(d.aL[0], 0, d.aL[1]); P.arms[1].rotation.set(d.aR[0], 0, -d.aR[1]);
  P.fore[0].rotation.x = -d.eL; P.fore[1].rotation.x = -d.eR;
  P.legs[0].rotation.x = d.lL; P.legs[1].rotation.x = d.lR; P.shins[0].rotation.x = d.kL; P.shins[1].rotation.x = d.kR;
  P.head.rotation.set(d.hx, d.hy, d.hz); root.position.y = d.y; root.rotation.x = d.lean;
  P.eyes.forEach((e) => { e.userData.lid.rotation.x = lerp(-0.2, 1.35, d.blink); });
  P.brows.forEach((b, i) => { b.position.y = 0.2 + d.brow * 0.04; b.rotation.z = (i ? -1 : 1) * d.brow * 0.3; });
  P.mouth.scale.set(1 - d.mouthO * 0.4, d.flat ? 0.15 : 1 + d.mouthO * 1.5, 1);
}
const victim = makePerson({ shirt: 0x3a6ea5, skin: 0xe0ac69, pants: 0x3c3c46, hair: 0x2b1b10, eye: 0x3a5a40 });
const rescuer = makePerson({ shirt: 0xff7a1a, skin: 0xc68642, pants: 0x2f3e46, hair: 0x1d1210, long: true, sleeves: true, eye: 0x4a2e1a });
// x-ray look for the victim
const xrayMat = new THREE.MeshStandardMaterial({ color: 0x1a2a6c, transparent: true, opacity: 0.32, roughness: 0.3, emissive: 0x0d1a4a, emissiveIntensity: 0.6, depthWrite: false });
const victimMeshes = []; victim.traverse((o) => { if (o.isMesh) { victimMeshes.push({ o, m: o.material }); } });
function setXray(on) { victimMeshes.forEach(({ o, m }) => { o.material = on ? xrayMat : m; o.castShadow = !on; }); }

// ---------------------------------------------------------------- heart model
function makeHeart(scale = 1) {
  const g = new THREE.Group();
  const hm = new THREE.MeshPhysicalMaterial({ color: 0xd8344a, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, emissive: 0x6a0010, emissiveIntensity: 0.4 });
  const body = new THREE.Group(); g.add(body);
  const vg = new THREE.SphereGeometry(0.55, 48, 36); const pa = vg.attributes.position;
  for (let i = 0; i < pa.count; i++) { let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); if (y < 0) { const k = Math.pow(-y / 0.55, 1.4); const f = 1 - 0.78 * k; x *= f; z *= f; y *= 1.55; x += 0.12 * k; } else { y *= 0.9; } x += Math.sin(y * 4) * 0.02; pa.setXYZ(i, x, y, z * 0.85); }
  vg.computeVertexNormals(); const v = mesh(vg, hm); v.rotation.z = 0.18; body.add(v);
  for (const [x, y, r] of [[-0.3, 0.38, 0.27], [0.26, 0.42, 0.24]]) { const a = mesh(new THREE.SphereGeometry(r, 24, 18), hm); a.scale.set(1, 0.85, 0.9); a.position.set(x, y, -0.1); body.add(a); }
  const vm = new THREE.MeshPhysicalMaterial({ color: 0x8a8ff0, roughness: 0.4, clearcoat: 0.5 });
  const aorta = mesh(new THREE.TorusGeometry(0.25, 0.11, 14, 28, Math.PI * 1.1), hm); aorta.position.set(0.02, 0.78, 0); aorta.rotation.z = 0.2; g.add(aorta);
  for (const [x, z] of [[-0.05, 0.12], [0.12, 0.05], [0.22, -0.05]]) { const br = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), hm); br.position.set(x, 1.12, z); g.add(br); }
  const pv = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 14), vm); pv.position.set(-0.22, 0.78, 0.15); pv.rotation.z = 0.5; g.add(pv);
  const sv = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 14), vm); sv.position.set(-0.42, 0.75, -0.05); g.add(sv);
  // coronary vessels
  for (let i = 0; i < 4; i++) { const c = mesh(new THREE.TorusGeometry(0.48 + i * 0.02, 0.012, 6, 30, 1.2), new THREE.MeshStandardMaterial({ color: 0xffd0a0, emissive: 0xff9050, emissiveIntensity: 0 })); c.rotation.set(0.3 + i * 0.35, 0.4 + i, 0.2); g.add(c); (g.userData.veins ||= []).push(c); }
  g.userData.body = body; g.userData.mat = hm; g.scale.setScalar(scale); scene.add(g); return g;
}
const bigHeart = makeHeart(1); // in the void set
const VOID = V3(0, 60, 0);
bigHeart.position.copy(VOID);
const voidSphere = mesh(new THREE.SphereGeometry(9, 32, 20), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 vp; void main(){ float y = vp.y*0.5+0.5; vec3 c = mix(vec3(0.02,0.02,0.06), vec3(0.12,0.05,0.18), y); gl_FragColor = vec4(pow(c, vec3(2.2)),1.); }' }), false, false);
voidSphere.position.copy(VOID); scene.add(voidSphere);
const voidKey = new THREE.PointLight(0xffffff, 30, 12, 1.5); voidKey.position.copy(VOID).add(V3(2, 2, 3)); scene.add(voidKey);
const voidRim = new THREE.PointLight(0x7a5cff, 25, 12, 1.5); voidRim.position.copy(VOID).add(V3(-2.5, 1, -2)); scene.add(voidRim);
const smallHeart = makeHeart(0.17);
const brainGlow = mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff8fb0, emissive: 0xff5c8a, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 }), false, false);
scene.add(brainGlow);
const bloodDots = []; for (let i = 0; i < 14; i++) { const d = mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff2a3a, emissive: 0xff1a2a, emissiveIntensity: 2.5 }), false, false); scene.add(d); bloodDots.push(d); }

// props: phone, AED
const phone = new THREE.Group();
{ const b = box(0.36, 0.03, 0.72, M(0x111111, { roughness: 0.3 }), 0.04); phone.add(b); const scr2 = mesh(new THREE.PlaneGeometry(0.32, 0.66), new THREE.MeshStandardMaterial({ map: canvasTex(128, 256, (g) => { g.fillStyle = '#0b1220'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#2ec27e'; g.beginPath(); g.arc(64, 200, 20, 0, 7); g.fill(); g.fillStyle = '#e63946'; g.beginPath(); g.arc(64, 90, 34, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(52, 90); g.lineTo(76, 90); g.moveTo(64, 78); g.lineTo(64, 102); g.stroke(); }), emissive: 0xffffff, emissiveIntensity: 0.0 }), false, false); scr2.rotation.x = -Math.PI / 2; scr2.position.y = 0.017; phone.add(scr2); phone.userData.scr = scr2; scene.add(phone); }
const aed = new THREE.Group();
{ const b = box(0.6, 0.2, 0.48, M(0xffc21a, { roughness: 0.4 }), 0.06); aed.add(b); const h = box(0.4, 0.06, 0.08, M(0x2ec27e), 0.02); h.position.set(0, 0.13, -0.15); aed.add(h); const btn = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0 })); btn.position.set(0.12, 0.11, 0.08); aed.add(btn); aed.userData.btn = btn; const heartIcon = mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#ffc21a'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(-6, 26, 14, 2, 32, 20); g.bezierCurveTo(50, 2, 70, 26, 32, 54); g.fill(); }) })); heartIcon.rotation.x = -Math.PI / 2; heartIcon.position.set(-0.12, 0.105, 0.05); aed.add(heartIcon); scene.add(aed); }
const pads = [0, 1].map(() => { const p = box(0.22, 0.02, 0.3, M(0xf5f5f5), 0.02); scene.add(p); return p; });

// ---------------------------------------------------------------- victim / rescuer placement
const LIE_Z = 0.9; // victim's feet position when lying (head toward -z)
function victimState(t) {
  const fall = st(T.drops + 0.15, T.drops + 0.95, t);
  const f = ei(fall) ;
  return { fall, f };
}
function chestWorld() { return victim.userData.P.torso.getWorldPosition(new THREE.Vector3()); }
function compress(t) {
  // compressions during the CPR sections
  const on = (t > T.push1 - 0.2 && t < T.first - 0.1) || (t > T.lock && t < T.then + 0.2) || (t > T.alive - 0.4 && t < T.now + 0.6);
  if (!on) return 0;
  const ph = ((t * BPM / 60) % 1);
  return ph < 0.45 ? Math.sin(ph / 0.45 * Math.PI) : 0;
}
function placePeople(t) {
  const vs = victimState(t);
  // victim: standing, wobble, then falls backwards onto the floor
  const wob = st(T.drops - 0.4, T.drops + 0.15, t);
  victim.position.set(0.0, 0, LIE_Z);
  victim.rotation.set(-Math.PI / 2 * ei(vs.fall) + Math.sin(t * 9) * 0.04 * wob * (1 - vs.fall), 0, Math.sin(t * 5) * 0.05 * wob * (1 - vs.fall));
  const lying = vs.fall >= 1;
  victim.position.y = lying ? 0.33 : 0.33 * ei(vs.fall);
  pose(victim, { aL: [lerp(0, 0.15, vs.fall), lerp(0.1, 0.4, vs.fall)], aR: [lerp(0, 0.1, vs.fall), lerp(0.1, 0.45, vs.fall)], kL: 0.4 * wob * (1 - vs.fall), kR: 0.3 * wob * (1 - vs.fall), hx: lying ? -0.2 : 0, hz: lying ? 0.25 : 0, blink: lying ? 1 : wob * 0.6, brow: wob, mouthO: lying ? 0 : wob * 0.8, flat: lying });
  const c = compress(t);
  victim.userData.P.torso.scale.set(1, 1, 1 - 0.14 * c);
  // rescuer: enters, kneels at chest, does CPR
  const kneel = st(T.what - 0.4, T.what + 0.6, t);
  if (t < T.drops + 0.6) { rescuer.visible = t > 0.0; rescuer.position.set(3.8, 0, 1.5); rescuer.rotation.y = -1.9; pose(rescuer, { aL: [-0.3, 0.2], aR: [-0.3, 0.2], brow: st(T.drops, T.drops + 0.4, t), mouthO: st(T.drops, T.drops + 0.4, t), hy: 0.2 }); }
  else {
    const P0 = V3(3.8, 0, 1.5), P1 = V3(1.02, 0, -0.42);
    const run = eio(st(T.drops + 0.6, T.what - 0.3, t));
    rescuer.position.copy(P0.clone().lerp(P1, run));
    rescuer.rotation.y = lerp(-1.9, -Math.PI / 2, run);
    const ph = Math.sin(t * 12) * (run > 0 && run < 1 ? 0.6 : 0);
    let p = { lL: ph, lR: -ph, aL: [-ph * 0.5, 0.2], aR: [ph * 0.5, 0.2], brow: 1, mouthO: 0.5 };
    if (kneel > 0) {
      const k = eio(kneel);
      p = { y: -0.52 * k, lL: -0.15 * k, lR: -0.15 * k, kL: 1.65 * k, kR: 1.65 * k, aL: [-0.5 * k, lerp(0.1, -0.28, k)], aR: [-0.5 * k, lerp(0.1, -0.28, k)], lean: 0.42 * k, hx: 0.3 * k, brow: 0.6, mouthO: 0.1 };
      // phone call pose
      if (t > T.call - 0.3 && t < T.heel - 0.2) { const u = st(T.call - 0.3, T.call, t); p.aR = [-0.3 - 0.6 * u, 0.3]; p.eR = 0.6 * u; }
      const cc = compress(t);
      p.y -= 0.06 * cc; p.lean += 0.06 * cc;
    }
    pose(rescuer, p);
  }
  // heart + brain inside the victim
  victim.updateMatrixWorld(true);
  const chest = chestWorld();
  smallHeart.position.copy(chest).add(V3(0.06, 0.02, -0.08)); smallHeart.rotation.set(-Math.PI / 2, 0, 0.2);
  const headW = victim.userData.P.head.getWorldPosition(new THREE.Vector3());
  brainGlow.position.copy(headW).add(V3(0, 0.05, -0.04));
}

function placeProps(t) {
  const chest = chestWorld();
  phone.visible = t > T.first - 0.2;
  phone.position.set(1.7, 0.02, -1.6); phone.rotation.y = 0.5 - (1 - eob(st(T.first - 0.2, T.first + 0.3, t))) * 2;
  phone.userData.scr.material.emissiveIntensity = t > T.call - 0.1 ? 0.9 + Math.sin(t * 6) * 0.1 : 0;
  const ain = eo(st(T.then + 0.1, T.aed + 0.4, t));
  aed.visible = t > T.then;
  aed.position.set(lerp(-3.5, -0.7, ain), 0.1, lerp(1.5, -0.9, ain)); aed.rotation.y = 0.4;
  aed.userData.btn.material.emissiveIntensity = t > T.aed + 0.5 ? (Math.floor(t * 4) % 2 ? 2.5 : 0.3) : 0;
  const pu = st(T.aed + 0.2, T.aed + 0.8, t);
  pads.forEach((p, i) => { p.visible = t > T.aed + 0.2; p.position.set(chest.x + (i ? -0.18 : 0.2), chest.y + 0.36 + (1 - eo(pu)) * 0.6, chest.z + (i ? -0.15 : 0.25)); p.rotation.y = i ? 0.3 : -0.3; });
}

function heartBeat(t) {
  // 0 = quiver chaos, 1 = normal beat
  const normal = st(T.stops + 0.5, T.rhythm + 0.2, t);
  const quiver = (Math.sin(t * 47) * 0.5 + Math.sin(t * 61 + 1) * 0.5) * 0.04;
  const beatPh = (t * 1.2) % 1; const beat = beatPh < 0.25 ? Math.sin(beatPh / 0.25 * Math.PI) * 0.12 : 0;
  return { s: lerp(quiver, beat, normal), normal };
}
function placeHearts(t) {
  const hb = heartBeat(t);
  const c = compress(t);
  bigHeart.rotation.set(0.1, t * 0.35, 0.15);
  bigHeart.userData.body.scale.set(1 + hb.s, 1 + hb.s * 1.2, 1 + hb.s);
  bigHeart.userData.veins.forEach((v, i) => { v.material.emissiveIntensity = (1 - hb.normal) * (Math.sin(t * 40 + i * 2) > 0.3 ? 3 : 0); });
  smallHeart.userData.body.scale.set(1 + c * 0.15, 1 - c * 0.3, 1 + c * 0.15);
  const x = xrayOn(t);
  smallHeart.visible = x; brainGlow.visible = x;
  brainGlow.material.emissiveIntensity = 0.6 + c * 1.0 + (t < T.what ? Math.sin(t * 10) * 0.4 : 0);
  heartGlow.intensity = x ? 0.5 + c * 1.2 : 0; heartGlow.position.copy(smallHeart.position).add(V3(0, 0.3, 0));
  // blood flowing heart -> brain while compressing
  const head = brainGlow.position, hp = smallHeart.position;
  bloodDots.forEach((d, i) => { const u = ((t * 0.9 + i / bloodDots.length) % 1); d.visible = x && t > T.push1 - 0.2 && flowOn(t); d.position.lerpVectors(hp, head, u); d.position.y += Math.sin(u * Math.PI) * 0.05 + 0.02; d.scale.setScalar(0.6 + c * 0.8); });
}
function flowOn(t) { return (t > T.push1 - 0.2 && t < T.first - 0.1) || (t > T.alive - 0.4); }
function xrayOn(t) { return (t > T.brain - 0.1 && t < T.this - 0.05) || (t > T.cpr - 0.05 && t < T.first - 0.05) || (t > T.alive - 0.4 && t < T.now - 0.05); }

function placeEnv(t) {
  const amb = st(T.alive - 0.6, T.alive, t);
  const fl = Math.floor(t * 4) % 2;
  redL.intensity = amb * (fl ? 22 : 2); blueL.intensity = amb * (fl ? 2 : 22);
  winGlow.emissive.setHex(amb > 0 ? (fl ? 0xff4040 : 0x4070ff) : 0xcfe9ff);
  const xr = xrayOn(t);
  setXray(xr);
  // darken the room during x-ray / void moments for drama
  const dim = xr ? 0.35 : 1;
  sun.intensity = 2.4 * dim; hemi.intensity = 0.9 * dim; winLight.intensity = 8 * dim;
  bloom.strength = xr ? 0.3 : 0.18;
}

// ---------------------------------------------------------------- camera: cinematic, wide-first
function camShake(t) { let s = 0; for (const [t0, a, d] of [[T.drops + 0.9, 0.08, 0.6], [T.aed + 0.7, 0.05, 0.5]]) { const u = (t - t0) / d; if (u > 0 && u < 1) s += a * (1 - u) * (1 - u); } return s; }
const chestTarget = () => chestWorld();
let SHOTS = [];
function buildShots() {
  const C = V3(0, 0.35, -0.55); // chest when lying
  const HD = V3(0, 0.4, -1.25); // head when lying
  SHOTS = [
    // HOOK: wide low push-in as he collapses
    [-1, T.pulse - 0.05, (u) => ({ p: V3(lerp(4.6, 3.0, eo(u)), lerp(1.0, 1.25, u), lerp(6.8, 4.6, eo(u))), g: V3(0, lerp(1.4, 0.7, eio(u)), lerp(0.9, 0.3, u)), f: lerp(58, 46, u), r: lerp(0.06, -0.02, u) })],
    // overhead spinning top-down
    [T.pulse - 0.05, T.brain - 0.05, (u) => { const a = 0.6 + u * 0.9; return { p: V3(Math.sin(a) * 0.9, lerp(5.8, 4.2, eio(u)), -0.3 + Math.cos(a) * 0.9), g: V3(0, 0, -0.3), f: 52, up: V3(Math.sin(a + Math.PI), 0, Math.cos(a + Math.PI)) }; }],
    // brain close-up (x-ray)
    [T.brain - 0.05, T.ambulance - 0.05, (u) => ({ p: V3(lerp(1.7, 1.3, u), lerp(1.3, 1.0, u), lerp(-2.7, -2.4, u)), g: V3(0, 0.33, -1.08), f: 38 })],
    // ambulance far away: window wide
    [T.ambulance - 0.05, T.what - 0.05, (u) => ({ p: V3(lerp(-1.5, -1.0, u), lerp(1.6, 1.8, u), lerp(3.5, 3.0, u)), g: V3(2.4, 2.4, -4.8), f: 50 })],
    // what you do next: low dramatic push-in over the body to the rescuer
    [T.what - 0.05, T.this - 0.05, (u) => ({ p: V3(lerp(-2.4, -1.7, eio(u)), lerp(0.55, 0.7, u), lerp(-2.9, -2.3, eio(u))), g: V3(0.7, 0.85, -0.5), f: lerp(52, 42, u) })],
    // heart in the void
    [T.this - 0.05, T.but - 0.05, (u) => ({ p: VOID.clone().add(V3(Math.sin(u * 1.2) * 3.2, 0.4, Math.cos(u * 1.2) * 3.2)), g: VOID.clone().add(V3(0, 0.15, 0)), f: lerp(44, 36, u) })],
    // but your hands can move it: rescuer's hands, wide
    [T.but - 0.05, T.cpr - 0.05, (u) => ({ p: V3(lerp(-3.6, -3.1, u), lerp(2.3, 2.0, u), lerp(3.0, 2.5, u)), g: V3(0.4, 0.6, -0.45), f: 44 })],
    // you become the heart: x-ray side view
    [T.cpr - 0.05, T.push1 - 0.25, (u) => ({ p: V3(lerp(-4.2, -3.7, u), lerp(1.6, 1.45, u), lerp(1.0, 0.7, u)), g: V3(0.3, 0.55, -0.5), f: 42 })],
    // squeeze against spine -> blood to brain
    [T.push1 - 0.25, T.first - 0.05, (u) => ({ p: V3(lerp(-3.6, -3.2, u), lerp(1.1, 0.95, u), lerp(-0.1, -0.35, u)), g: V3(0.2, 0.5, -0.75), f: 42 })],
    // phone on speaker
    [T.first - 0.05, T.heel - 0.05, (u) => ({ p: V3(lerp(2.4, 2.2, u), lerp(1.3, 1.0, u), lerp(-0.4, -0.7, u)), g: V3(1.6, 0.1, -1.55), f: 48 })],
    // hand placement top-down on chest
    [T.heel - 0.05, T.lock - 0.05, (u) => ({ p: V3(lerp(-1.9, -1.6, u), lerp(2.7, 2.4, u), -0.42), g: V3(0.1, 0.4, -0.42), f: 40 })],
    // lock elbows, push hard: front low wide
    [T.lock - 0.05, T.fast - 0.05, (u) => ({ p: V3(lerp(-3.3, -2.9, u), lerp(1.8, 1.6, u), lerp(2.4, 2.0, u)), g: V3(0.45, 0.7, -0.42), f: 42 })],
    // the rhythm: orbiting wide
    [T.fast - 0.05, T.not - 0.05, (u) => { const a = lerp(0.3, 1.4, u); return { p: V3(-Math.cos(a) * 4.6, 2.2, -0.45 + Math.sin(a) * 4.6), g: V3(0.3, 0.6, -0.45), f: 44 }; }],
    // just push: close low
    [T.not - 0.05, T.then - 0.05, (u) => ({ p: V3(lerp(-3.0, -2.6, u), 0.8, lerp(2.0, 1.7, u)), g: V3(0.5, 0.6, -0.45), f: 44 })],
    // AED arrives + shock
    [T.then - 0.05, T.stops - 0.05, (u) => ({ p: V3(lerp(-2.6, -2.2, u), lerp(2.0, 1.7, u), lerp(2.2, 1.8, u)), g: V3(-0.3, 0.3, -0.6), f: 48 })],
    // heart finds its rhythm (void)
    [T.stops - 0.05, T.your - 0.05, (u) => ({ p: VOID.clone().add(V3(Math.sin(1.5 + u) * 3.0, 0.2, Math.cos(1.5 + u) * 3.0)), g: VOID.clone().add(V3(0, 0.15, 0)), f: 40 })],
    // until help arrives: ambulance lights, wide
    [T.your - 0.05, T.now - 0.05, (u) => ({ p: V3(lerp(4.2, 3.6, u), lerp(2.4, 2.0, u), lerp(4.6, 4.0, u)), g: V3(0.2, 0.7, -1.0), f: 50 })],
    // outro crane up
    [T.now - 0.05, DUR + 1, (u, t) => { const e = eio(st(T.now, DUR, t)); return { p: V3(lerp(2.4, 0.6, e), lerp(1.6, 6.5, e), lerp(3.4, 4.2, e)), g: V3(0.2, 0.4, -0.6), f: 50 }; }],
  ];
}
buildShots();
function placeCamera(t) {
  const s = SHOTS.find((x) => t >= x[0] && t < x[1]) || SHOTS[SHOTS.length - 1];
  const u = cl((t - Math.max(0, s[0])) / (s[1] - Math.max(0, s[0])));
  const c = s[2](u, t); const sk = camShake(t);
  camera.position.copy(c.p).add(V3(Math.sin(t * 1.1) * 0.02 + Math.sin(t * 31) * sk, Math.sin(t * 1.5) * 0.015 + Math.sin(t * 27) * sk, 0));
  camera.fov = c.f; camera.updateProjectionMatrix();
  const up = c.up || V3(0, 1, 0); if (c.r) { up.set(Math.sin(c.r), Math.cos(c.r), 0); }
  camera.up.copy(up); camera.lookAt(c.g);
}

// ---------------------------------------------------------------- 2D overlay (no captions)
function scr(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, ok: p.z < 1 }; }
const pop = (age, d = 0.25) => eob(cl(age / d));
function txt(s, x, y, size, fill, stroke = '#111', sw = 0.14, font = 'Luckiest Guy') { ctx.font = `${size}px "${font}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = size * sw; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y); }
function ecg(t, x, y, w, h, mode, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const u = i / 200, xx = x + u * w; let v = 0; const tt = t * 1.4 + u * 2.5;
    if (mode === 'flat') v = Math.sin(tt * 40) * 0.01;
    else if (mode === 'chaos') v = (Math.sin(tt * 23) * 0.5 + Math.sin(tt * 37 + 1) * 0.35 + Math.sin(tt * 61) * 0.2) * 0.5;
    else { const ph = (tt % 1); v = ph > 0.4 && ph < 0.45 ? -0.2 : ph >= 0.45 && ph < 0.5 ? 1 : ph >= 0.5 && ph < 0.55 ? -0.35 : ph > 0.7 && ph < 0.85 ? Math.sin((ph - 0.7) / 0.15 * Math.PI) * 0.2 : 0; }
    const yy = y - v * h; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
  }
  ctx.stroke(); ctx.restore();
}
function heartIcon(x, y, s, col = '#ff3b4a') { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(0, 40); ctx.bezierCurveTo(-80, -10, -40, -70, 0, -32); ctx.bezierCurveTo(40, -70, 80, -10, 0, 40); ctx.closePath(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 30; ctx.fill(); ctx.restore(); }
function timerCard(x, y, s, label, secs, col, icon) {
  if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(10,12,20,0.78)'; ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-210, -85, 420, 170, 30); ctx.fill(); ctx.stroke();
  icon(-130, 0);
  const m = Math.floor(secs / 60), sec = Math.floor(secs % 60); txt(`${m}:${String(sec).padStart(2, '0')}`, 65, 8, 104, col, '#000', 0.08);
  ctx.restore();
}
function brainIcon(x, y) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ff7aa2'; ctx.strokeStyle = '#7a1f3d'; ctx.lineWidth = 5; for (const [dx, dy, r] of [[-22, -10, 28], [6, -22, 28], [26, 0, 26], [0, 16, 26], [-26, 14, 22]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill(); ctx.stroke(); } ctx.restore(); }
function ambIcon(x, y) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(-55, -30, 110, 56, 10); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.fillRect(-12, -18, 24, 32); ctx.fillRect(-20, -10, 40, 16); ctx.fillStyle = '#111'; for (const dx of [-30, 30]) { ctx.beginPath(); ctx.arc(dx, 30, 12, 0, 7); ctx.fill(); } ctx.fillStyle = (Math.floor(performance.now ? 0 : 0) % 2) ? '#2a6bff' : '#ff2a2a'; ctx.fillRect(-8, -42, 16, 12); ctx.restore(); }
function ring(x, y, r, col, a) { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore(); }
function bolt(x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 40; ctx.beginPath(); ctx.moveTo(10, -90); ctx.lineTo(-40, 10); ctx.lineTo(0, 10); ctx.lineTo(-15, 90); ctx.lineTo(45, -15); ctx.lineTo(5, -15); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
function noBreath(x, y, s) { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 100, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff8fa3'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 32, 10, 28, 50, sx * 0.2, 0, 7); ctx.fill(); ctx.stroke(); } ctx.fillStyle = '#c9c9c9'; ctx.fillRect(-6, -60, 12, 40); ctx.strokeStyle = '#e63946'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-70, -70); ctx.lineTo(70, 70); ctx.stroke(); ctx.restore(); }
function shareIcon(x, y, s) { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 95, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#ff3b4a'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-40, 40); ctx.quadraticCurveTo(-35, -25, 35, -25); ctx.stroke(); ctx.fillStyle = '#ff3b4a'; ctx.beginPath(); ctx.moveTo(30, -60); ctx.lineTo(70, -25); ctx.lineTo(30, 10); ctx.fill(); ctx.restore(); }

function overlay(t) {
  // letterbox-style cinematic vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${t < T.this ? 0.55 : 0.35})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // HOOK graphics
  if (t > T.pulse - 0.1 && t < T.brain - 0.05) { const a = pop(t - T.pulse + 0.1); ctx.save(); ctx.globalAlpha = a; ecg(t, 90, 330, 900, 90, 'flat', '#ff3b4a'); ctx.restore(); heartIcon(W / 2, 520, 0.9 * a * (1 + Math.sin(t * 3) * 0.03), '#5a5a66'); ctx.save(); ctx.strokeStyle = '#ff3b4a'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(W / 2 - 70, 450); ctx.lineTo(W / 2 + 70, 590); ctx.stroke(); ctx.restore(); }
  if (t > T.brain - 0.1 && t < T.what - 0.05) {
    const left = Math.max(0, 240 - (t - T.four) * 9);
    timerCard(W / 2, 360, pop(t - T.four + 0.2), '', t < T.four ? 240 : left, '#ff5c8a', (x, y) => brainIcon(x, y));
    if (t > T.eight - 0.2) timerCard(W / 2, 560, pop(t - T.eight + 0.2), '', 480 - (t - T.eight) * 2, '#ffd23f', (x, y) => ambIcon(x, y));
  }
  if (t > T.decides - 0.2 && t < T.this - 0.05) { const c = scr(chestTarget().add(V3(0, 0.4, 0))); for (let i = 0; i < 3; i++) ring(c.x, c.y, 60 + ((t * 120 + i * 50) % 150), '#ff3b4a', 0.7 * (1 - ((t * 120 + i * 50) % 150) / 150)); }
  // heart in the void: chaos ECG + sparks
  if (t > T.this - 0.05 && t < T.but - 0.05) { ecg(t, 60, 1520, 960, 110, t > T.haywire - 0.2 ? 'chaos' : 'normal', t > T.haywire - 0.2 ? '#ffd23f' : '#4ef0a0'); if (t > T.haywire - 0.2) { ctx.save(); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 6; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 20; const r = rng(Math.floor(t * 12)); for (let i = 0; i < 5; i++) { let x = W / 2 + (r() - 0.5) * 500, y = 760 + (r() - 0.5) * 600; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; ctx.lineTo(x, y); } ctx.stroke(); } ctx.restore(); } }
  // hands can move it: glowing hands
  if (t > T.hands - 0.2 && t < T.cpr - 0.05) { const c = scr(chestTarget().add(V3(0, 0.45, 0))); const a = pop(t - T.hands + 0.2); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 220 * a); g.addColorStop(0, 'rgba(255,190,120,0.75)'); g.addColorStop(1, 'rgba(255,120,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 220 * a, 0, 7); ctx.fill(); ctx.restore(); }
  // you become the heart
  if (t > T.become - 0.1 && t < T.push1 - 0.25) { const c = scr(chestTarget().add(V3(0, 0.6, 0))); heartIcon(c.x, c.y - 120, pop(t - T.become + 0.1) * (1 + compressAlt(t) * 0.12)); }
  // push/refill arrows
  if (t > T.push1 - 0.2 && t < T.first - 0.05) { const c = scr(chestTarget().add(V3(0, 0.7, 0))); const down = compress(t); ctx.save(); ctx.globalAlpha = 0.9; const y0 = c.y - 210; ctx.strokeStyle = down > 0.1 ? '#ff3b4a' : '#4ef0a0'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x + 230, y0); ctx.lineTo(c.x + 230, y0 + 120); ctx.stroke(); ctx.beginPath(); if (down > 0.1) { ctx.moveTo(c.x + 200, y0 + 110); ctx.lineTo(c.x + 260, y0 + 110); ctx.lineTo(c.x + 230, y0 + 160); } else { ctx.moveTo(c.x + 200, y0 + 10); ctx.lineTo(c.x + 260, y0 + 10); ctx.lineTo(c.x + 230, y0 - 40); } ctx.fill(); ctx.restore(); }
  // phone speaker waves
  if (t > T.call - 0.1 && t < T.heel - 0.05) { const p = scr(V3(1.7, 0.1, -1.6)); for (let i = 0; i < 3; i++) { const r = 70 + ((t * 140 + i * 45) % 140); ring(p.x, p.y - 30, r, '#4ef0a0', 1 - (r - 70) / 140); } }
  // hand placement target on chest centre
  if (t > T.heel - 0.05 && t < T.lock - 0.05) { const c = scr(chestTarget().add(V3(0, 0.36, 0))); const a = pop(t - T.heel); ring(c.x, c.y, 70 * a, '#4ef0a0', 1); ring(c.x, c.y, 110 * a + Math.sin(t * 6) * 6, '#4ef0a0', 0.5); ctx.fillStyle = '#4ef0a0'; ctx.beginPath(); ctx.arc(c.x, c.y, 12 * a, 0, 7); ctx.fill(); }
  // lock elbows / depth
  if (t > T.lock - 0.05 && t < T.fast - 0.05) {
    const sh = rescuer.userData.P.arms[1].getWorldPosition(new THREE.Vector3()), c = chestTarget().add(V3(0, 0.36, 0));
    const a = scr(sh), b = scr(c); ctx.save(); ctx.globalAlpha = pop(t - T.lock) * 0.9; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 14; ctx.setLineDash([24, 16]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
    if (t > T.hard - 0.1) { const s = pop(t - T.hard + 0.1); ctx.save(); ctx.translate(b.x - 230, b.y - 120); ctx.scale(s, s); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, 70); ctx.moveTo(-30, -70); ctx.lineTo(30, -70); ctx.moveTo(-30, 70); ctx.lineTo(30, 70); ctx.stroke(); txt('5 cm', 0, 120, 60, '#ffd23f'); ctx.restore(); }
  }
  // tempo: pulsing heart + beat bar
  if (t > T.fast - 0.05 && t < T.not - 0.05) { const c = compress(t); heartIcon(W / 2, 300, 0.7 + c * 0.25); const s = pop(t - T.hundred + 0.2); if (s > 0) { ctx.save(); ctx.translate(W / 2, 600); ctx.scale(s, s); txt('100–120', 0, 0, 110, '#ffffff'); txt('/ min', 0, 90, 56, '#ff8fa3'); ctx.restore(); } if (t > T.beat - 0.2) { for (let i = 0; i < 4; i++) { const ph = ((t * BPM / 60 + i * 0.25) % 1); ctx.fillStyle = `rgba(255,214,61,${1 - ph})`; ctx.font = '90px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('♪', W / 2 - 300 + i * 200, 780 - ph * 120); } } }
  // skip the breaths
  if (t > T.skip - 0.15 && t < T.then - 0.05) noBreath(W / 2, 420, pop(t - T.skip + 0.15) * 0.9);
  // AED shock
  if (t > T.aed + 0.5 && t < T.stops - 0.05) { const age = t - (T.aed + 0.9); if (age > 0 && age < 0.18) { ctx.fillStyle = `rgba(255,255,230,${0.8 * (1 - age / 0.18)})`; ctx.fillRect(0, 0, W, H); } const c = scr(chestTarget().add(V3(0, 0.5, 0))); if (age > 0) bolt(c.x, c.y - 260, pop(age, 0.15) * (1 - st(0.8, 1.2, age))); }
  if (t > T.stops - 0.05 && t < T.your - 0.05) { const n = t > T.rhythm - 0.4; ecg(t, 60, 1520, 960, 110, n ? 'normal' : 'chaos', n ? '#4ef0a0' : '#ffd23f'); }
  // until it does: heart beating icon near victim
  if (t > T.alive - 0.3 && t < T.now - 0.05) { const c = scr(chestTarget().add(V3(0, 0.7, 0))); heartIcon(c.x, c.y - 140, 0.6 + compress(t) * 0.2); }
  // outro share
  if (t > T.share - 0.2) { shareIcon(W / 2, 430, pop(t - T.share + 0.2) * 1.0); }
  const fade = Math.max(1 - st(0, 0.25, t), st(DUR - 0.5, DUR, t)); if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  for (const tc of [T.pulse, T.brain, T.this, T.stops]) { const u = (t - tc) / 0.14; if (u >= 0 && u < 1) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - u)})`; ctx.fillRect(0, 0, W, H); } }
}
function compressAlt(t) { const ph = ((t * BPM / 60) % 1); return ph < 0.45 ? Math.sin(ph / 0.45 * Math.PI) : 0; }

window.renderFrame = (t, q = 0.92) => {
  placeEnv(t); placePeople(t); placeProps(t); placeHearts(t); placeCamera(t);
  composer.render();
  ctx.clearRect(0, 0, W, H); ctx.drawImage(glCanvas, 0, 0); overlay(t);
  return out.toDataURL('image/jpeg', q);
};
document.fonts.load('96px "Luckiest Guy"').then(() => document.fonts.load('70px "Fredoka"')).then(() => { window.READY = true; });

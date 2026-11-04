// "You Just Built a Nightclub" – realistic-style 3D CGI (three.js). No captions, no 2D graphics.
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
const eob = (x) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(31);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- beats
const WORDS = SEG.flatMap((s) => s.words.map((w) => ({ w: w.w.toLowerCase().replace(/[^a-z0-9']/g, ''), s: w.s })));
function Wt(word, after = 0) { const ws = word.split('|'); const x = WORDS.find((q) => ws.includes(q.w) && q.s >= after); return x ? x.s : after + 1.0; }
const B = {};
B.lights = Wt('music'); B.crank = Wt('crank'); B.club1 = Wt('nightclub'); B.midnight = Wt('midnight'); B.packed = Wt('packed'); B.fire = Wt('fire'); B.everyone = Wt('everyone');
B.bouncer = Wt('bouncer'); B.clicker = Wt('clicker'); B.number = Wt('number'); B.nobody = Wt('nobody');
B.teen = Wt('teenagers'); B.id1 = Wt('id', B.teen);
B.scanner = Wt('scanner'); B.uv = Wt('uv'); B.real = Wt('real'); B.hidden = Wt('hidden'); B.fake = Wt('fake');
B.saves = Wt('saves'); B.banned = Wt('banned'); B.network = Wt('network'); B.away = Wt('away', B.network);
B.step = Wt('step'); B.smoke = Wt('smoke'); B.rejected = Wt('rejected'); B.slip = Wt('slip');
B.hand = Wt('hand', B.slip); B.stamped = Wt('stamped'); B.glows = Wt('glows'); B.lamp = Wt('lamp');
B.then = Wt('then', B.lamp); B.pushes = Wt('pushes');
B.alarm = Wt('alarm'); B.wired = Wt('wired'); B.music2 = Wt('music', B.wired); B.instantly = Wt('instantly');
B.fight = Wt('fight'); B.glass = Wt('glass', B.fight); B.smashed = Wt('smashed');
B.poly = Wt('polycarbonate'); B.bend = Wt('bend'); B.shatter = Wt('shattering');
B.cams = Wt('cams|cam'); B.thirty = Wt('thirty|30'); B.record = Wt('record');
B.rope = Wt('rope'); B.cloak = Wt('cloakroom'); B.bar = Wt('bar', B.cloak); B.built = Wt('built');
window.BEATS = B; const T = B;

// ---------------------------------------------------------------- renderer
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x07060c, 0.012);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture; scene.environmentIntensity = 0.18;
const camera = new THREE.PerspectiveCamera(42, W / H, 0.02, 400);
const composer = new EffectComposer(renderer); composer.setSize(W, H); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.45, 0.5, 0.78); composer.addPass(bloom); composer.addPass(new OutputPass());
const out = document.getElementById('out'); const ctx = out.getContext('2d');
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const fabric = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.85, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.3), ...o });
function mesh(geo, m, cast = true, recv = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
const box = (w, h, d, m, r = 0) => mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), m);
function canvasTex(w, h, draw, rx = 1, ry = rx) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; }
function noiseCanvas(g, w, h, base, vary, seed, speck = 0) { const r = rng(seed); const img = g.createImageData(w, h); const G = 64, grid = [...Array((G + 1) * (G + 1))].map(() => r()); const vn = (x, y) => { const xi = Math.floor(x) % G, yi = Math.floor(y) % G, xf = x - Math.floor(x), yf = y - Math.floor(y); const s = (q) => q * q * (3 - 2 * q); const i = (a, b) => grid[(b % G) * (G + 1) + (a % G)]; return (i(xi, yi) * (1 - s(xf)) + i(xi + 1, yi) * s(xf)) * (1 - s(yf)) + (i(xi, yi + 1) * (1 - s(xf)) + i(xi + 1, yi + 1) * s(xf)) * s(yf); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let f = 0, a = 0.5, fr = 4; for (let o = 0; o < 5; o++) { f += a * vn(x / w * fr, y / h * fr); a *= 0.5; fr *= 2; } const sp = speck && r() < speck ? (r() - 0.5) * 0.5 : 0; const k = (y * w + x) * 4; for (let c = 0; c < 3; c++) img.data[k + c] = Math.max(0, Math.min(255, base[c] + (f - 0.5) * vary[c] + sp * 60)); img.data[k + 3] = 255; } g.putImageData(img, 0, 0); }
const glowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }); glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping; glowTex.repeat.set(1, 1);
function glow(color, size, op = 1) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op })); s.scale.setScalar(size); return s; }

// ---------------------------------------------------------------- night street
scene.add(new THREE.HemisphereLight(0x3a4a7a, 0x0a0a10, 0.35));
const moon = new THREE.DirectionalLight(0x8fa2d8, 0.6); moon.position.set(-10, 18, 14); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 }); scene.add(moon);
const sky = mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'varying vec3 vp; void main(){ float y = clamp(vp.y,0.,1.); vec3 c = mix(vec3(0.10,0.08,0.14), vec3(0.01,0.015,0.04), pow(y,0.5)); gl_FragColor = vec4(pow(c,vec3(2.2)),1.); }' }), false, false);
scene.add(sky);
const brickTex = canvasTex(512, 512, (g, w, h) => { noiseCanvas(g, w, h, [120, 52, 40], [50, 30, 24], 3); g.fillStyle = 'rgba(190,180,170,0.55)'; for (let y = 0; y < h; y += 32) { g.fillRect(0, y, w, 4); for (let x = ((y / 32) % 2) * 32; x < w; x += 64) g.fillRect(x, y, 4, 32); } }, 4, 2);
const brickM = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9 });
const paveTex = canvasTex(512, 512, (g, w, h) => { noiseCanvas(g, w, h, [96, 96, 100], [30, 30, 30], 5, 0.2); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, 8);
const pave = mesh(new THREE.PlaneGeometry(80, 6), new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.55, metalness: 0.05 }), false, true); pave.rotation.x = -Math.PI / 2; pave.position.set(0, 0.01, 3); scene.add(pave);
const roadTex = canvasTex(512, 512, (g, w, h) => noiseCanvas(g, w, h, [40, 40, 44], [20, 20, 20], 7, 0.3), 10);
const road = mesh(new THREE.PlaneGeometry(80, 10), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.35, metalness: 0.1 }), false, true); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 11); scene.add(road);
for (let i = -6; i <= 6; i++) { const l = mesh(new THREE.PlaneGeometry(2.2, 0.15), M(0xd8c060, { roughness: 0.6 }), false, true); l.rotation.x = -Math.PI / 2; l.position.set(i * 5, 0.012, 11); scene.add(l); }
const kerb = box(80, 0.15, 0.3, M(0x7a7a7e)); kerb.position.set(0, 0.075, 6); scene.add(kerb);
const alley = mesh(new THREE.PlaneGeometry(4, 14), new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.5 }), false, true); alley.rotation.x = -Math.PI / 2; alley.position.set(9, 0.012, -6); scene.add(alley);
// club building
const club = new THREE.Group(); scene.add(club);
const CLW = 14, CLD = 12, CLH = 5.5;
const wallsOuter = [];
{ const front = new THREE.Shape(); front.moveTo(-7, 0); front.lineTo(7, 0); front.lineTo(7, CLH); front.lineTo(-7, CLH); front.closePath(); const door = new THREE.Path(); door.moveTo(-3.2, 0); door.lineTo(-3.2, 2.6); door.lineTo(-1.6, 2.6); door.lineTo(-1.6, 0); door.closePath(); front.holes.push(door);
  const fw = mesh(new THREE.ExtrudeGeometry(front, { depth: 0.35, bevelEnabled: false }), brickM); fw.position.set(0, 0, -0.35); club.add(fw); wallsOuter.push(fw);
  const side = new THREE.Shape(); side.moveTo(0, 0); side.lineTo(CLD, 0); side.lineTo(CLD, CLH); side.lineTo(0, CLH); side.closePath(); const ex = new THREE.Path(); ex.moveTo(7.4, 0); ex.lineTo(7.4, 2.3); ex.lineTo(8.6, 2.3); ex.lineTo(8.6, 0); ex.closePath(); side.holes.push(ex);
  const sw = mesh(new THREE.ExtrudeGeometry(side, { depth: 0.35, bevelEnabled: false }), brickM); sw.rotation.y = Math.PI / 2; sw.position.set(7, 0, 0); club.add(sw); wallsOuter.push(sw);
  const lw = box(0.35, CLH, CLD, brickM); lw.position.set(-7.17, CLH / 2, -CLD / 2); club.add(lw); wallsOuter.push(lw);
  const bw = box(CLW + 0.7, CLH, 0.35, brickM); bw.position.set(0, CLH / 2, -CLD - 0.17); club.add(bw); wallsOuter.push(bw); }
const roof = box(CLW + 0.8, 0.3, CLD + 0.8, M(0x2a2a2e, { roughness: 0.9 })); roof.position.set(0, CLH + 0.15, -CLD / 2); club.add(roof);
const awning = box(3.6, 0.12, 1.5, M(0x111114, { roughness: 0.5, metalness: 0.4 })); awning.position.set(-2.4, 3.0, 0.6); club.add(awning);
// neon light shape (no letters): a glowing ring + wave
const neonM = new THREE.MeshStandardMaterial({ color: 0xff3fb4, emissive: 0xff3fb4, emissiveIntensity: 3 });
{ const ring = mesh(new THREE.TorusGeometry(0.55, 0.04, 10, 48), neonM, false, false); ring.position.set(-2.4, 4.1, 0.05); club.add(ring); const pts = []; for (let i = 0; i <= 40; i++) pts.push(V3(-3.6 + i * 0.06, 4.1 + Math.sin(i * 0.5) * 0.18, 0.06)); const wave = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0x3ff0ff, emissive: 0x3ff0ff, emissiveIntensity: 3 }), false, false); club.add(wave); }
const neonL = new THREE.PointLight(0xff3fb4, 18, 9, 1.6); neonL.position.set(-2.4, 3.6, 1.2); scene.add(neonL);
const doorGlow = new THREE.PointLight(0xb04cff, 8, 6, 1.6); doorGlow.position.set(-2.4, 1.6, 0.2); scene.add(doorGlow);
const entryFill = new THREE.PointLight(0xffc9a0, 4, 6, 1.5); entryFill.position.set(-0.4, 2.3, 1.9); scene.add(entryFill);
const wallWash = new THREE.SpotLight(0xd06aff, 9, 8, 0.7, 0.6, 1.4); wallWash.position.set(-0.9, 0.3, 2.2); wallWash.target.position.set(-0.9, 1.6, 0); scene.add(wallWash); scene.add(wallWash.target);
// street lamps
for (const x of [-9, 6]) { const p = mesh(new THREE.CylinderGeometry(0.07, 0.1, 5, 10), M(0x2a2c30, { metalness: 0.7, roughness: 0.4 })); p.position.set(x, 2.5, 5.6); scene.add(p); const hd = box(0.5, 0.15, 0.3, M(0x2a2c30)); hd.position.set(x, 5.0, 5.3); scene.add(hd); const s = glow(0xffb66a, 1.6); s.position.set(x, 4.9, 5.3); scene.add(s); const l = new THREE.PointLight(0xffa860, 25, 16, 1.4); l.position.set(x, 4.8, 5.2); scene.add(l); }
// fire exit door (right side wall) with push bar and alarm box
const fireDoor = new THREE.Group(); fireDoor.position.set(7.2, 0, -7.4); scene.add(fireDoor);
{ const d = box(0.07, 2.25, 1.18, M(0x4a5560, { metalness: 0.6, roughness: 0.45 })); d.position.set(0, 1.12, -0.59); fireDoor.add(d); const bar = box(0.08, 0.07, 1.0, M(0xc8102e, { metalness: 0.4, roughness: 0.4 })); bar.position.set(-0.08, 1.05, -0.6); fireDoor.add(bar); }
const exitSign = box(0.05, 0.25, 0.6, new THREE.MeshStandardMaterial({ color: 0x0a8f3a, emissive: 0x18e070, emissiveIntensity: 2 })); exitSign.position.set(6.8, 2.6, -8.0); scene.add(exitSign);
const alarmBox = box(0.1, 0.3, 0.3, M(0xd9c400, { roughness: 0.5 })); alarmBox.position.set(6.78, 2.0, -6.9); scene.add(alarmBox);
const alarmLamp = mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 0 }), false, false); alarmLamp.position.set(6.7, 2.25, -6.9); scene.add(alarmLamp);
const alarmLight = new THREE.PointLight(0xff2020, 0, 10, 1.5); alarmLight.position.set(6.3, 2.2, -6.9); scene.add(alarmLight);

// ---------------------------------------------------------------- interior
const floorTex = canvasTex(256, 256, (g, w, h) => noiseCanvas(g, w, h, [26, 24, 30], [16, 14, 18], 9), 6);
const inFloor = mesh(new THREE.PlaneGeometry(CLW, CLD), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.2 }), false, true); inFloor.rotation.x = -Math.PI / 2; inFloor.position.set(0, 0.015, -CLD / 2); scene.add(inFloor);
const tiles = []; { const g = new THREE.BoxGeometry(0.96, 0.04, 0.96); for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) { const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.15, metalness: 0.1 }); const tl = mesh(g, m, false, true); tl.position.set(-3.5 + i, 0.035, -8.5 + j); scene.add(tl); tiles.push({ tl, i, j }); } }
const innerWallM = M(0x15131a, { roughness: 0.8 });
const ceiling = box(CLW, 0.1, CLD, innerWallM); ceiling.position.set(0, CLH - 0.05, -CLD / 2); scene.add(ceiling);
// truss + moving heads + beams
const trussM = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 });
for (const z of [-9.5, -4.5]) { const tr = mesh(new THREE.BoxGeometry(10, 0.25, 0.25), trussM); tr.position.set(0, 4.6, z); scene.add(tr); }
const heads = [], beams = [];
const beamM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
for (let k = 0; k < 6; k++) { const x = -4 + (k % 3) * 4, z = k < 3 ? -9.5 : -4.5; const h = mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.35, 16), M(0x18181c, { metalness: 0.6 })); h.position.set(x, 4.3, z); scene.add(h); heads.push(h);
  const bg = new THREE.ConeGeometry(0.9, 5, 24, 1, true); bg.translate(0, -2.5, 0); const bm = beamM.clone(); const b = mesh(bg, bm, false, false); b.position.set(x, 4.25, z); scene.add(b); beams.push(b); }
const spots = [0, 1, 2, 3].map((i) => { const s = new THREE.SpotLight(0xffffff, 40, 14, 0.4, 0.6, 1.5); s.position.set(-4 + i * 2.7, 4.3, -7); s.target.position.set(0, 0, -7); scene.add(s); scene.add(s.target); return s; });
const work = [0, 1].map((i) => { const l = new THREE.PointLight(0xf2f6ff, 0, 18, 1.2); l.position.set(-3 + i * 6, 5.0, -6); scene.add(l); return l; });
const floorWash = new THREE.PointLight(0x7a3cff, 12, 14, 1.4); floorWash.position.set(0, 2.5, -7); scene.add(floorWash);
// DJ booth, speakers, bar, cloakroom
{ const dj = box(2.6, 1.1, 0.9, M(0x0f0f12, { roughness: 0.4, metalness: 0.4 }), 0.05); dj.position.set(0, 0.55, -11.1); scene.add(dj); const strip = box(2.6, 0.05, 0.02, new THREE.MeshStandardMaterial({ color: 0x3ff0ff, emissive: 0x3ff0ff, emissiveIntensity: 2.5 })); strip.position.set(0, 0.9, -10.64); scene.add(strip);
  for (const x of [-2.4, 2.4]) { const sp = box(0.9, 2.2, 0.8, M(0x101012, { roughness: 0.6 }), 0.04); sp.position.set(x, 1.1, -11.2); scene.add(sp); for (const y of [0.6, 1.5]) { const cone = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.05, 24), M(0x1d1d22, { roughness: 0.4 })); cone.rotation.x = Math.PI / 2; cone.position.set(x, y, -10.78); scene.add(cone); } } }
const barG = new THREE.Group(); scene.add(barG);
{ const counter = box(0.8, 1.1, 5, M(0x23181a, { roughness: 0.3, metalness: 0.2 }), 0.03); counter.position.set(-5.9, 0.55, -5.5); barG.add(counter); const top = box(0.95, 0.06, 5.1, new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, roughness: 0.05, clearcoat: 1 })); top.position.set(-5.9, 1.13, -5.5); barG.add(top); const led = box(0.02, 0.04, 5, new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xffa040, emissiveIntensity: 2.5 })); led.position.set(-5.49, 1.05, -5.5); barG.add(led);
  for (let i = 0; i < 14; i++) { const b = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 12), new THREE.MeshPhysicalMaterial({ color: [0x2d6a4f, 0x7a1e2c, 0xd9a441][i % 3], roughness: 0.05, transparent: true, opacity: 0.85 })); b.position.set(-6.8, 1.8, -7.6 + i * 0.3); barG.add(b); } const shelf = box(0.3, 0.04, 5, M(0x222222)); shelf.position.set(-6.8, 1.64, -5.5); barG.add(shelf); }
const cloak = new THREE.Group(); scene.add(cloak); { const c = box(2.2, 1.05, 0.6, M(0x2a2228, { roughness: 0.5 }), 0.03); c.position.set(3.6, 0.53, -1.0); cloak.add(c); const rail = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), trussM); rail.rotation.z = Math.PI / 2; rail.position.set(3.6, 2.0, -1.6); cloak.add(rail); for (let i = 0; i < 8; i++) { const ct = box(0.42, 0.9, 0.12, fabric([0x1d1d1f, 0x5a3a28, 0x2a3a5a, 0x6a1a1a][i % 4])); ct.position.set(2.7 + i * 0.26, 1.5, -1.6); ct.rotation.y = 0.2 * (i % 2 ? 1 : -1); cloak.add(ct); } }
// velvet rope queue outside
const ropeG = new THREE.Group(); scene.add(ropeG);
{ const chrome = new THREE.MeshStandardMaterial({ color: 0xe0e3e8, metalness: 1, roughness: 0.12 }); const posts = [[-4.8, 1.0], [-4.8, 2.6], [-6.4, 2.6], [-8.0, 2.6]]; posts.forEach(([x, z]) => { const p = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 12), chrome); p.position.set(x, 0.48, z); ropeG.add(p); const b = mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 24), chrome); b.position.set(x, 0.03, z); ropeG.add(b); const k = mesh(new THREE.SphereGeometry(0.06, 14, 10), chrome); k.position.set(x, 0.97, z); ropeG.add(k); });
  for (let i = 0; i < posts.length - 1; i++) { const a = V3(posts[i][0], 0.9, posts[i][1]), b = V3(posts[i + 1][0], 0.9, posts[i + 1][1]); const mid = a.clone().lerp(b, 0.5); mid.y -= 0.22; ropeG.add(mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.025, 8), fabric(0x8a0f1e))); } }
// fire in a corner + smoke
const fireSpr = []; for (let i = 0; i < 18; i++) { const s = glow(i % 2 ? 0xff7a1a : 0xffc040, 0.6, 0); scene.add(s); fireSpr.push({ s, ph: R(), x: (R() - 0.5) * 0.6, z: (R() - 0.5) * 0.6 }); }
const fireLight = new THREE.PointLight(0xff7020, 0, 9, 1.5); fireLight.position.set(5.6, 1.0, -10.4); scene.add(fireLight);
const smokeTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(160,160,170,0.55)'); r.addColorStop(1, 'rgba(160,160,170,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }); smokeTex.wrapS = smokeTex.wrapT = THREE.ClampToEdgeWrapping; smokeTex.repeat.set(1, 1);
const smokes = []; for (let i = 0; i < 30; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s); smokes.push({ s, ph: R(), dx: (R() - 0.5) }); }
// haze in the club
const haze = []; for (let i = 0; i < 22; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x8060c0, transparent: true, depthWrite: false, opacity: 0.12, blending: THREE.AdditiveBlending })); s.position.set((R() - 0.5) * 11, 1.5 + R() * 3, -1.5 - R() * 10); s.scale.setScalar(3 + R() * 3); scene.add(s); haze.push(s); }

// ---------------------------------------------------------------- people
function ribbon(points, width, material) { const c = new THREE.CatmullRomCurve3(points); const N = 24, pos = [], idx = []; for (let i = 0; i <= N; i++) { const u = i / N, p = c.getPointAt(u), tg = c.getTangentAt(u); const side = V3(0, 0, 1).cross(tg).normalize().multiplyScalar(width / 2); for (const s of [-1, 1]) pos.push(p.x + side.x * s, p.y + side.y * s, p.z + side.z * s); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return mesh(g, material); }
function makeMan(o) {
  const g = new THREE.Group(); const P = {}; g.userData.P = P; const sc = o.scale || 1;
  const skin = new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffd0b0) }); P.skin = skin;
  const top = fabric(o.top), pants = fabric(o.pants, { roughness: 0.9 });
  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips); P.hips = hips;
  P.legs = []; for (const s of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(s * 0.1, 0, 0); hips.add(hip); const th = mesh(new THREE.CapsuleGeometry(0.08, 0.34, 4, 12), pants); th.position.y = -0.22; hip.add(th); const kn = new THREE.Group(); kn.position.y = -0.45; hip.add(kn); const sh = mesh(new THREE.CapsuleGeometry(0.065, 0.34, 4, 12), pants); sh.position.y = -0.2; kn.add(sh); const ft = mesh(new RoundedBoxGeometry(0.11, 0.08, 0.27, 3, 0.03), M(o.shoe || 0x1a1a1a, { roughness: 0.4 })); ft.position.set(0, -0.43, 0.05); kn.add(ft); P.legs.push({ hip, kn }); }
  const spine = new THREE.Group(); hips.add(spine); P.spine = spine;
  const prof = [[0.0, -0.12], [0.2, -0.12], [0.19, 0.0], [0.19, 0.2], [0.215, 0.36], [0.2, 0.44], [0.12, 0.5], [0.06, 0.52]].map(([r, y]) => new THREE.Vector2(r * (o.bulk || 1), y));
  const tg = new THREE.LatheGeometry(prof, 36); tg.scale(1, 1, 0.68); spine.add(mesh(tg, top));
  const neck = mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.1, 14), skin); neck.position.y = 0.53; spine.add(neck);
  const head = new THREE.Group(); head.position.y = 0.56; spine.add(head); P.head = head;
  const skull = mesh(new THREE.SphereGeometry(0.115, 36, 26), skin); skull.scale.set(0.86, 1.05, 0.98); skull.position.y = 0.125; head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.088, 28, 18), skin); jaw.scale.set(0.95, 0.85, 1.0); jaw.position.set(0, 0.062, 0.025); head.add(jaw);
  const nose = mesh(new THREE.ConeGeometry(0.015, 0.05, 12), skin); nose.position.set(0, 0.098, 0.104); nose.rotation.x = Math.PI * 0.62; head.add(nose);
  P.eyes = []; for (const s of [-1, 1]) { const e = new THREE.Group(); e.position.set(s * 0.038, 0.122, 0.088); head.add(e); e.add(mesh(new THREE.SphereGeometry(0.014, 14, 10), M(0xf0ece6, { roughness: 0.2 }), false)); const ir = mesh(new THREE.SphereGeometry(0.008, 12, 8), M(0x3b2414, { roughness: 0.1 }), false); ir.position.z = 0.009; e.add(ir); const lid = mesh(new THREE.SphereGeometry(0.0155, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, false); lid.rotation.x = -0.35; e.add(lid); e.userData.lid = lid; P.eyes.push(e); const brow = box(0.035, 0.007, 0.01, M(o.hair)); brow.position.set(s * 0.038, 0.144, 0.098); head.add(brow); }
  const lips = mesh(new THREE.CapsuleGeometry(0.006, 0.028, 4, 8), M(0x9a5550, { roughness: 0.4 }), false); lips.rotation.z = Math.PI / 2; lips.position.set(0, 0.052, 0.104); head.add(lips);
  for (const s of [-1, 1]) { const ear = mesh(new THREE.SphereGeometry(0.021, 10, 8), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.098, 0.11, 0); head.add(ear); }
  const hair = mesh(new THREE.SphereGeometry(0.119, 30, 14, 0, Math.PI * 2, 0, Math.PI * (o.bald ? 0.2 : 0.47)), new THREE.MeshPhysicalMaterial({ color: o.hair, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0x4a3020) })); hair.scale.set(0.88, 1.05, 1.0); hair.position.set(0, 0.135, -0.008); hair.rotation.x = -0.45; head.add(hair);
  if (o.beard) { const bd = mesh(new THREE.SphereGeometry(0.09, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), M(o.hair, { roughness: 0.9 })); bd.position.set(0, 0.075, 0.02); head.add(bd); }
  if (o.earpiece) { const ep = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0.1, 0.11, 0.0), V3(0.11, 0.05, -0.02), V3(0.12, -0.05, -0.04), V3(0.13, -0.15, -0.05)]), 16, 0.004, 5), M(0xdddddd)); head.add(ep); }
  P.arms = []; for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.22 * (o.bulk || 1), 0.42, 0); spine.add(sh); const up = mesh(new THREE.CapsuleGeometry(0.05 * (o.bulk || 1), 0.22, 4, 12), top); up.position.y = -0.14; sh.add(up); const el = new THREE.Group(); el.position.y = -0.28; sh.add(el); const lo = mesh(new THREE.CapsuleGeometry(0.042 * (o.bulk || 1), 0.2, 4, 12), o.short ? skin : top); lo.position.y = -0.13; el.add(lo); const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand); const palm = mesh(new RoundedBoxGeometry(0.07, 0.085, 0.028, 3, 0.012), skin); palm.position.y = -0.045; hand.add(palm); for (let f = 0; f < 4; f++) { const fg = mesh(new THREE.CapsuleGeometry(0.008, 0.045, 3, 8), skin); fg.position.set(-0.024 + f * 0.016, -0.11, 0.002); hand.add(fg); } const th = mesh(new THREE.CapsuleGeometry(0.009, 0.035, 3, 8), skin); th.position.set(s * -0.04, -0.045, 0.014); th.rotation.z = s * 0.6; hand.add(th); hand.userData.palm = palm; P.arms.push({ sh, el, hand }); }
  g.scale.setScalar(sc); g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g); return g;
}
function pose(h, p, t) { const P = h.userData.P; const d = { lean: 0, turn: 0, hx: 0, hy: 0, hz: 0, aL: [0.05, 0.08, 0], aR: [0.05, 0.08, 0], eL: 0.15, eR: 0.15, wL: 0, wR: 0, lL: 0, lR: 0, kL: 0, kR: 0, bob: 0, ...p };
  P.spine.rotation.set(d.lean, d.turn, 0); P.head.rotation.set(d.hx, d.hy, d.hz); P.hips.position.y = 0.92 + d.bob;
  [['aL', 'eL', 'wL', 0, 1], ['aR', 'eR', 'wR', 1, -1]].forEach(([a, e, w, i, s]) => { const A = P.arms[i]; A.sh.rotation.set(-d[a][0], d[a][2] * s, s * -d[a][1]); A.el.rotation.x = -d[e]; A.hand.rotation.x = d[w]; });
  P.legs[0].hip.rotation.x = d.lL; P.legs[1].hip.rotation.x = d.lR; P.legs[0].kn.rotation.x = d.kL; P.legs[1].kn.rotation.x = d.kR;
  const bl = (t % 3.3) < 0.1 ? 1 : 0; P.eyes.forEach((e) => { e.userData.lid.rotation.x = lerp(-0.35, 1.35, bl); }); }
function walkPose(t, f = 7, amp = 0.45) { const ph = Math.sin(t * f) * amp; return { lL: ph, lR: -ph, kL: Math.max(0, -ph) * 0.8, kR: Math.max(0, ph) * 0.8, aL: [-ph * 0.6, 0.1, 0], aR: [ph * 0.6, 0.1, 0], bob: Math.abs(Math.cos(t * f)) * 0.02 }; }
const bouncer = makeMan({ skin: 0x8d5a3b, top: 0x111114, pants: 0x18181c, hair: 0x111111, bald: true, beard: true, bulk: 1.25, earpiece: true, scale: 1.08 });
const teen = makeMan({ skin: 0xe0ac69, top: 0x2a7fd6, pants: 0x3a4a6a, hair: 0x4a2e1a, short: true, scale: 0.95 });
const smoker = makeMan({ skin: 0xc68642, top: 0xc0392b, pants: 0x2a2a30, hair: 0x1a1210 });
const mate1 = makeMan({ skin: 0xf1c27d, top: 0x2ecc71, pants: 0x34495e, hair: 0x8a5a2b, short: true });
const mate2 = makeMan({ skin: 0x8d5524, top: 0xf39c12, pants: 0x1f2a36, hair: 0x111111 });
// props: clicker, ID card, scanner, stamp, cigarette, cups, body cam
const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.15 });
const clickCanvas = document.createElement('canvas'); clickCanvas.width = 256; clickCanvas.height = 96; const clickTex = new THREE.CanvasTexture(clickCanvas); clickTex.colorSpace = THREE.SRGBColorSpace;
function drawCount(n) { const c = clickCanvas.getContext('2d'); c.fillStyle = '#111'; c.fillRect(0, 0, 256, 96); c.font = 'bold 76px monospace'; c.fillStyle = '#f4f4f4'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n).padStart(4, '0'), 128, 52); clickTex.needsUpdate = true; }
const clicker = new THREE.Group(); { const b = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 32), chrome); b.rotation.x = Math.PI / 2; clicker.add(b); const win = mesh(new THREE.PlaneGeometry(0.06, 0.022), new THREE.MeshBasicMaterial({ map: clickTex })); win.position.z = 0.0155; clicker.add(win); const btn = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 16), chrome); btn.position.y = 0.055; clicker.add(btn); clicker.userData.btn = btn; const ring = mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 20), chrome); ring.position.y = -0.058; clicker.add(ring); }
bouncer.userData.P.arms[1].hand.add(clicker); clicker.position.set(0, -0.08, 0.035); clicker.rotation.set(0.3, 0, 0);
function idTex(real, uv) { return canvasTex(512, 320, (c) => { const gr = c.createLinearGradient(0, 0, 512, 320); gr.addColorStop(0, real ? '#d9e6f2' : '#e8e2d4'); gr.addColorStop(1, real ? '#9fc0de' : '#cfc6b0'); c.fillStyle = gr; c.fillRect(0, 0, 512, 320); c.fillStyle = '#1d3557'; c.fillRect(0, 0, 512, 46); c.fillStyle = '#c9d6e2'; c.fillRect(30, 70, 150, 200); c.fillStyle = '#a07050'; c.beginPath(); c.arc(105, 150, 42, 0, 7); c.fill(); c.fillStyle = '#3a4a6a'; c.beginPath(); c.ellipse(105, 270, 70, 55, 0, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(40,40,60,0.55)'; for (let i = 0; i < 5; i++) c.fillRect(210, 90 + i * 34, 220 - i * 25, 12); if (uv) { c.globalCompositeOperation = 'source-over'; c.strokeStyle = 'rgba(80,255,220,0.95)'; c.lineWidth = 5; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(330, 190, 30 + i * 18, 0, 7); c.stroke(); } c.fillStyle = 'rgba(255,80,220,0.9)'; for (let i = 0; i < 40; i++) c.fillRect(40 + (i * 53) % 440, 60 + (i * 37) % 240, 6, 6); } }); }
const idReal = idTex(true, false), idRealUV = idTex(true, true), idFake = idTex(false, false);
[idReal, idRealUV, idFake].forEach((t) => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); });
const idMat = new THREE.MeshPhysicalMaterial({ map: idReal, roughness: 0.25, clearcoat: 1, emissiveMap: idRealUV, emissive: 0x000000 });
const idCard = mesh(new RoundedBoxGeometry(0.086, 0.054, 0.002, 2, 0.003), idMat); idCard.material.map = idFake;
teen.userData.P.arms[1].hand.add(idCard); idCard.position.set(0, -0.1, 0.03);
// scanner podium by the door
const scanner = new THREE.Group(); scanner.position.set(-0.9, 0, 0.8); scene.add(scanner);
const scanScreenC = document.createElement('canvas'); scanScreenC.width = 256; scanScreenC.height = 320; const scanTex = new THREE.CanvasTexture(scanScreenC); scanTex.colorSpace = THREE.SRGBColorSpace;
function drawScan(state, photo) { const c = scanScreenC.getContext('2d'); c.fillStyle = '#0b1020'; c.fillRect(0, 0, 256, 320); if (photo) { c.fillStyle = '#c9d6e2'; c.fillRect(48, 30, 160, 190); c.fillStyle = photo; c.beginPath(); c.arc(128, 105, 46, 0, 7); c.fill(); c.fillStyle = '#2a4a7a'; c.beginPath(); c.ellipse(128, 220, 70, 50, 0, Math.PI, 0); c.fill(); } const col = state === 'ok' ? '#2ee88a' : state === 'no' ? '#ff3344' : '#5a6a8a'; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 20; c.beginPath(); c.arc(128, 270, 30, 0, 7); c.fill(); c.shadowBlur = 0; c.strokeStyle = '#0b1020'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); if (state === 'ok') { c.moveTo(113, 270); c.lineTo(124, 282); c.lineTo(145, 258); } else if (state === 'no') { c.moveTo(116, 258); c.lineTo(140, 282); c.moveTo(140, 258); c.lineTo(116, 282); } c.stroke(); scanTex.needsUpdate = true; }
{ const post = box(0.12, 1.1, 0.12, M(0x1a1a1e, { metalness: 0.5 })); post.position.y = 0.55; scanner.add(post); const headB = box(0.38, 0.12, 0.3, M(0x202026, { metalness: 0.5, roughness: 0.3 }), 0.02); headB.position.y = 1.15; scanner.add(headB); const scr = mesh(new THREE.PlaneGeometry(0.2, 0.25), new THREE.MeshBasicMaterial({ map: scanTex, color: 0x9a9a9a })); scr.position.set(0, 1.36, -0.05); scr.rotation.x = -0.3; scanner.add(scr); const bez = box(0.23, 0.28, 0.02, M(0x111114)); bez.position.set(0, 1.36, -0.062); bez.rotation.x = -0.3; scanner.add(bez); const glassS = box(0.3, 0.012, 0.22, new THREE.MeshPhysicalMaterial({ color: 0x223344, roughness: 0.05, emissive: 0x6a2ad0, emissiveIntensity: 0 })); glassS.position.set(0, 1.215, 0.0); scanner.add(glassS); scanner.userData.glass = glassS; }
const uvGlow = new THREE.PointLight(0x8a3cff, 0, 1.2, 2); uvGlow.position.set(-0.9, 1.3, 0.8); scene.add(uvGlow);
const uvSprite = glow(0x9a4cff, 0.5, 0); uvSprite.position.set(-0.9, 1.24, 0.8); scene.add(uvSprite);
// network: more clubs across the city linked by light
const netLines = []; const otherClubs = [V3(-30, 0, -24), V3(26, 0, -30), V3(-34, 0, 20), V3(30, 0, 22)];
otherClubs.forEach((p, i) => { const b = box(8, 4 + i % 2, 7, brickM); b.position.set(p.x, 2.2, p.z); scene.add(b); const n = mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 32), new THREE.MeshStandardMaterial({ color: 0xff3fb4, emissive: [0xff3fb4, 0x3ff0ff, 0xffd23f, 0x7aff7a][i], emissiveIntensity: 3 }), false, false); n.position.set(p.x, 3.4, p.z + 3.55); scene.add(n); const a = V3(-2, 6, -6), c = V3(p.x, 6, p.z); const mid = a.clone().lerp(c, 0.5); mid.y += 8; const tb = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, c), 60, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), false, false); scene.add(tb); netLines.push(tb); });
const cig = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 8), M(0xf4f4f0)); smoker.userData.P.arms[1].hand.add(cig); cig.position.set(0.02, -0.09, 0.03); cig.rotation.z = 1.2;
const cigTip = glow(0xff6a20, 0.05); cig.add(cigTip); cigTip.position.y = 0.04;
const stamp = new THREE.Group(); { const h = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.08, 16), M(0x2a1a14, { roughness: 0.4 })); stamp.add(h); const b = box(0.05, 0.02, 0.05, M(0x111111)); b.position.y = -0.05; stamp.add(b); }
bouncer.userData.P.arms[0].hand.add(stamp); stamp.position.set(0, -0.11, 0.03);
const stampMark = mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9a4cff, emissiveIntensity: 0, transparent: true, opacity: 0 }), false, false); mate1.userData.P.arms[1].hand.add(stampMark); stampMark.position.set(0, -0.045, 0.016);
const uvLamp = box(0.5, 0.08, 0.1, new THREE.MeshStandardMaterial({ color: 0x2a1a44, emissive: 0x8a3cff, emissiveIntensity: 0 })); uvLamp.position.set(-1.6, 2.4, 0.1); scene.add(uvLamp);
const uvLampL = new THREE.PointLight(0x8a3cff, 0, 4, 1.5); uvLampL.position.set(-1.6, 2.2, 0.4); scene.add(uvLampL);
const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.35, metalness: 0, clearcoat: 1 });
const beerM = new THREE.MeshPhysicalMaterial({ color: 0xd99a2a, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x3a2000, emissiveIntensity: 0.3 });
const pint = new THREE.Group(); { const gl = mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.16, 24, 1, true), glassM); pint.add(gl); const be = mesh(new THREE.CylinderGeometry(0.042, 0.033, 0.13, 24), beerM); be.position.y = -0.01; pint.add(be); const foam = mesh(new THREE.CylinderGeometry(0.043, 0.042, 0.02, 24), M(0xf6f0e0)); foam.position.y = 0.06; pint.add(foam); }
mate2.userData.P.arms[1].hand.add(pint); pint.position.set(0, -0.1, 0.04);
const SH = 60; const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.012, 0), glassM, SH); shards.frustumCulled = false; scene.add(shards); const shardV = [...Array(SH)].map(() => [(R() - 0.5) * 3, R() * 2.5, (R() - 0.5) * 3]);
const polyCup = new THREE.Group(); { const c = mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.16, 32, 6, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.4, side: THREE.DoubleSide, clearcoat: 1 })); polyCup.add(c); const be = mesh(new THREE.CylinderGeometry(0.046, 0.035, 0.12, 24), beerM); be.position.y = -0.015; polyCup.add(be); } scene.add(polyCup);
const bodyCam = box(0.07, 0.09, 0.03, M(0x111114, { metalness: 0.5, roughness: 0.3 }), 0.01); bouncer.userData.P.spine.add(bodyCam); bodyCam.position.set(-0.08, 0.32, 0.15);
const camLens = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 16), new THREE.MeshPhysicalMaterial({ color: 0x050510, roughness: 0, metalness: 0.5, clearcoat: 1 })); camLens.rotation.x = Math.PI / 2; camLens.position.set(0, 0.01, 0.017); bodyCam.add(camLens);
const camLed = mesh(new THREE.SphereGeometry(0.005, 8, 6), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: 0 })); camLed.position.set(0.022, 0.033, 0.016); bodyCam.add(camLed);
// dancing crowd (instanced)
const CR = 90; const crowd = [];
const cTorso = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.19, 0.42, 4, 12), new THREE.MeshStandardMaterial({ roughness: 0.8 }), CR);
const cLegs = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.15, 0.62, 4, 10), new THREE.MeshStandardMaterial({ roughness: 0.85 }), CR);
const cHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ roughness: 0.6 }), CR);
const cHair = new THREE.InstancedMesh(new THREE.SphereGeometry(0.116, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), CR);
const cArmL = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), CR);
const cArmR = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), CR);
{ const tops = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22, 0x34495e, 0xfd79a8, 0x111111, 0xffffff]; const skins = [0xc68642, 0x8d5524, 0xe0ac69, 0xf1c27d, 0xa86b3c]; for (let i = 0; i < CR; i++) { const x = (R() - 0.5) * 9, z = -1.8 - R() * 8.8; crowd.push({ x, z, ph: R() * 6, sp: 1.8 + R() * 0.8, h: 0.92 + R() * 0.15, ry: (R() - 0.5) * 1.2, up: R() < 0.55 }); const top = new THREE.Color(tops[i % tops.length]); cTorso.setColorAt(i, top); cArmL.setColorAt(i, top); cArmR.setColorAt(i, top); cLegs.setColorAt(i, new THREE.Color([0x1f2a44, 0x222222, 0x3a3a46, 0x5a4a3a][i % 4])); cHead.setColorAt(i, new THREE.Color(skins[i % skins.length])); cHair.setColorAt(i, new THREE.Color([0x111111, 0x3a2414, 0x8a5a2b, 0xd9b26a][i % 4])); } }
[cTorso, cLegs, cHead, cHair, cArmL, cArmR].forEach((m) => { m.castShadow = true; m.frustumCulled = false; scene.add(m); });

// ---------------------------------------------------------------- state
function musicOn(t) { return t > T.lights && !(t > T.instantly - 0.15 && t < T.fight - 0.3); }
function placeClub(t) {
  const on = musicOn(t) ? 1 : 0; const lit = st(T.lights - 0.3, T.lights + 0.3, t);
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 2.05)), 4);
  tiles.forEach(({ tl, i, j }) => { const hue = ((i + j) * 0.09 + t * 0.12) % 1; tl.material.emissive.setHSL(hue, 0.85, 0.5); tl.material.emissiveIntensity = on * lit * (0.6 + 0.9 * (((i + j + Math.floor(t * 4.1)) % 3) === 0 ? 1 : 0.25)); });
  heads.forEach((h, k) => { const a = Math.sin(t * 0.9 + k) * 0.7, b = Math.cos(t * 0.7 + k * 1.3) * 0.5; h.rotation.set(a, 0, b); beams[k].rotation.set(a, 0, b); beams[k].material.opacity = 0.11 * on * lit; beams[k].material.color.setHSL((k * 0.17 + t * 0.05) % 1, 0.9, 0.6); });
  spots.forEach((s, k) => { s.intensity = 40 * on * lit * (0.6 + beat * 0.6); s.color.setHSL((k * 0.25 + t * 0.07) % 1, 0.9, 0.55); s.target.position.set(Math.sin(t * 0.8 + k) * 3, 0, -7 + Math.cos(t * 0.6 + k) * 2.5); });
  floorWash.intensity = 12 * on * lit; work.forEach((w) => { w.intensity = (t > T.instantly - 0.15 && t < T.fight - 0.3) ? 22 : 0; });
  haze.forEach((h, i) => { h.material.opacity = 0.12 * on * lit; h.position.x += Math.sin(t * 0.3 + i) * 0.002; });
  // crowd: grows by midnight, dances, freezes when the music cuts, rushes during the fire
  const fill = st(T.lights, T.packed + 0.5, t); const fireRush = st(T.fire, T.everyone + 0.8, t) * (1 - st(T.bouncer - 0.1, T.bouncer, t));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  crowd.forEach((c, i) => { const vis = i < Math.floor(lerp(20, CR, fill)); let x = c.x, z = c.z; if (fireRush > 0) { const tx = -2.4 + (c.x + 2.4) * 0.25, tz = -0.6 - (i % 10) * 0.18; x = lerp(c.x, tx, eio(fireRush)); z = lerp(c.z, tz, eio(fireRush)); }
    const dance = on && fireRush < 0.1 ? 1 : 0; const b = dance * Math.abs(Math.sin(t * Math.PI * 2.05 + c.ph)) * 0.07;
    const s = vis ? 1 : 0; q.setFromEuler(e.set(0, c.ry + Math.sin(t * 0.7 + c.ph) * 0.3 * dance, 0));
    m4.compose(V3(x, 0.42 * c.h + b, z), q, V3(s, s * c.h, s)); cLegs.setMatrixAt(i, m4);
    m4.compose(V3(x, 1.12 * c.h + b, z), q, V3(s, s, s)); cTorso.setMatrixAt(i, m4);
    m4.compose(V3(x, 1.6 * c.h + b, z + 0.01), q, V3(s, s, s)); cHead.setMatrixAt(i, m4); m4.compose(V3(x, 1.63 * c.h + b, z - 0.005), q, V3(s, s, s)); cHair.setMatrixAt(i, m4);
    for (const [arm, sd] of [[cArmL, -1], [cArmR, 1]]) { const raise = c.up && dance ? (1.6 + Math.sin(t * Math.PI * 2.05 + c.ph + sd) * 0.6) : 0.15 + (fireRush > 0 ? 0.5 : 0); const ax = V3(sd * 0.24, 1.32 * c.h + b, 0).applyQuaternion(q); const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.ry, sd * (Math.PI - raise))); qa.premultiply(new THREE.Quaternion()); const off = V3(0, -0.3, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sd * raise))).applyQuaternion(q); m4.compose(V3(x, 0, z).add(ax).add(off), q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sd * raise))), V3(s, s, s)); arm.setMatrixAt(i, m4); } });
  [cTorso, cLegs, cHead, cHair, cArmL, cArmR].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  // fire
  const fr = st(T.fire - 0.2, T.fire + 0.6, t) * (1 - st(T.bouncer - 0.2, T.bouncer, t));
  fireSpr.forEach((f, i) => { const ph = (t * 1.6 + f.ph) % 1; f.s.position.set(5.6 + f.x * (1 - ph), 0.15 + ph * 1.3, -10.4 + f.z * (1 - ph)); f.s.material.opacity = fr * Math.sin(ph * Math.PI); f.s.scale.setScalar(0.6 * (1 - ph * 0.6)); });
  fireLight.intensity = fr * (35 + Math.sin(t * 23) * 8);
  smokes.forEach((s) => { const ph = (t * 0.25 + s.ph) % 1; s.s.position.set(5.4 + s.dx * ph * 3 - ph * 3, 1.0 + ph * 3.5, -10.2 + ph * 3); s.s.scale.setScalar(1 + ph * 3); s.s.material.opacity = fr * 0.4 * Math.sin(ph * Math.PI); });
  // roof removed for aerial cutaways
  roof.visible = !aerial(t); ceiling.visible = !aerial(t);
  // fire exit & alarm
  const fe = eo(st(T.pushes - 0.1, T.pushes + 0.5, t)) * (1 - st(T.alarm + 0.4, T.alarm + 1.2, t)) + eo(st(T.music2 - 0.6, T.music2 - 0.2, t)) * (1 - st(T.instantly + 0.8, T.instantly + 1.5, t));
  fireDoor.rotation.y = 1.3 * cl(fe);
  const al = t > T.alarm - 0.2 && t < T.fight - 0.3 ? (Math.floor(t * 5) % 2) : 0; alarmLamp.material.emissiveIntensity = al * 4; alarmLight.intensity = al * 25;
  ropeG.visible = t > T.rope - 0.2; ropeG.scale.setScalar(Math.max(0.001, eob(st(T.rope - 0.2, T.rope + 0.3, t)))); cloak.visible = t > T.cloak - 0.3; barG.visible = t > T.bar - 0.3 || t < T.rope - 1;
  netLines.forEach((l, i) => { l.material.opacity = 0.9 * st(T.network - 0.2 + i * 0.15, T.network + 0.3 + i * 0.15, t) * (1 - st(T.step - 0.3, T.step, t)); });
}
function aerial(t) { return  (t > T.fire - 0.15 && t < T.bouncer - 0.1) || t > T.built - 0.3; }
function placeActors(t) {
  // bouncer at the door
  bouncer.position.set(-1.6, 0, 0.9); bouncer.rotation.y = 0.35; let bp = { aR: [0.55, 0.15, 0], eR: 1.25, aL: [0.1, 0.25, 0], eL: 0.3, hy: -0.2 };
  const click = (t > T.clicker - 0.2 && t < T.teen) ? (Math.floor((t - T.clicker) * 2.5) % 2) : 0; clicker.userData.btn.position.y = 0.055 - click * 0.008; clicker.visible = t < T.scanner;
  const count = t < T.clicker ? 284 : Math.min(300, 284 + Math.floor((t - T.clicker + 0.2) * 5)); drawCount(t < T.number ? count : 300);
  if (t > T.nobody - 0.3 && t < T.teen) bp = { aL: [1.5, 0.1, 0], eL: 0.2, wL: -1.3, aR: [0.55, 0.15, 0], eR: 1.25, hy: 0.2, hx: -0.05 };
  if (t > T.teen && t < T.scanner) bp = { aR: [0.55, 0.15, 0], eR: 1.25, aL: [0.4, 0.2, 0], eL: 1.0, hy: 0.35, hx: 0.12 };
  if (t > T.stamped - 0.4 && t < T.lamp + 0.5) { const p = Math.max(0, Math.sin((t - T.stamped) * 6)); bp = { aL: [0.9, -0.2, 0], eL: 0.7 + p * 0.3, wL: -0.4 - p * 0.3, aR: [0.3, 0.2, 0], eR: 0.6, hx: 0.3, hy: 0.3 }; }
  if (t > T.cams - 0.4) { bp = { aR: [0.6, -0.1, 0], eR: 1.6, wR: 0.4, aL: [0.1, 0.25, 0], hx: 0.2 }; }
  stamp.visible = t > T.stamped - 0.6 && t < T.lamp + 0.6; camLed.material.emissiveIntensity = t > T.record - 0.1 ? (Math.floor(t * 2) % 2 ? 3 : 0.5) : (t > T.cams - 0.5 ? 0.4 : 0);
  bodyCam.visible = t > T.cams - 0.6;
  pose(bouncer, bp, t);
  // teen with the borrowed ID strolls past, later scanned
  teen.visible = t > T.teen - 0.3 && t < T.saves; let tp = V3(-2.4, 0, 3.4), tr = Math.PI, tP = { aR: [0.6, 0.05, 0], eR: 1.2, hx: 0.05 };
  if (t > T.teen - 0.3 && t < T.scanner - 0.1) { const u = st(T.teen - 0.3, T.scanner - 0.3, t); tp.set(lerp(-1.0, -2.4, u), 0, lerp(3.2, -0.6, u)); tr = Math.PI + 0.1; tP = { ...walkPose(t), aR: [0.6, 0.05, 0], eR: 1.25 }; }
  if (t >= T.scanner - 0.1 && t < T.saves) { tp.set(-1.45, 0, 1.45); tr = Math.PI + 0.5; tP = { aR: [0.55, -0.05, 0], eR: 1.1, wR: -0.4, hx: 0.2 }; }
  teen.position.copy(tp); teen.rotation.y = tr; pose(teen, tP, t);
  // ID on the scanner glass under UV
  const onScan = t > T.uv - 0.3 && t < T.saves; idCard.visible = t > T.teen - 0.4 && t < T.saves;
  if (onScan) { if (idCard.parent !== scene) scene.add(idCard); idCard.position.set(-0.9, 1.225, 0.8); idCard.rotation.set(-Math.PI / 2, 0, 0); } else if (idCard.parent !== teen.userData.P.arms[1].hand) { teen.userData.P.arms[1].hand.add(idCard); idCard.position.set(0, -0.1, 0.03); idCard.rotation.set(0, 0, 0); }
  const real = t < T.fake - 0.1; idMat.map = real ? idReal : idFake; idMat.emissiveMap = real ? idRealUV : idFake; idMat.emissive.setHex(onScan && real ? 0xffffff : 0x000000); idMat.emissiveIntensity = onScan && real ? 1.2 : 0; idMat.needsUpdate = true;
  const uvOn = onScan ? 1 : 0; scanner.userData.glass.material.emissiveIntensity = uvOn * 1.2; uvGlow.intensity = 6 * uvOn; uvSprite.material.opacity = 0.8 * uvOn;
  if (t < T.scanner) drawScan('idle', null); else if (t < T.fake - 0.1) drawScan(t > T.real ? 'ok' : 'idle', t > T.real ? '#c08060' : null); else if (t < T.banned) drawScan('no', '#a07050'); else drawScan('no', '#5a3a28');
  // smoker + rejected mates slip back in; hand stamp; fire exit
  smoker.visible = t > T.step - 0.3 && t < T.hand; mate1.visible = mate2.visible = t > T.step - 0.3;
  let sp = V3(-3.4, 0, 2.2), sr = 0.4, sP = { aR: [0.9, 0.1, 0], eR: 1.9, hx: -0.1 };
  if (t > T.slip - 0.3) { const u = st(T.slip - 0.3, T.hand - 0.2, t); sp.set(lerp(-3.4, -2.4, u), 0, lerp(2.2, -0.4, u)); sr = Math.PI; sP = { ...walkPose(t), aR: [0.9, 0.1, 0], eR: 1.9 }; }
  smoker.position.copy(sp); smoker.rotation.y = sr; pose(smoker, sP, t);
  cigTip.material.opacity = 0.6 + Math.sin(t * 3) * 0.4;
  let m1 = V3(-4.6, 0, 3.2), m2 = V3(-5.3, 0, 3.6), mr = 0.5, m1P = { hy: 0.3 }, m2P = { hy: 0.2 };
  if (t > T.rejected - 0.3 && t < T.hand) { const u = st(T.slip - 0.4, T.hand - 0.2, t); m1.set(lerp(-4.0, -2.0, u), 0, lerp(2.6, -0.2, u)); m2.set(lerp(-4.6, -2.8, u), 0, lerp(3.0, 0.1, u)); mr = Math.PI - 0.3; m1P = walkPose(t); m2P = walkPose(t + 0.3); }
  if (t >= T.hand - 0.3 && t < T.then) { m1.set(-1.15, 0, 1.55); mr = Math.PI + 0.2; m1P = { aR: [0.75, -0.1, 0], eR: 0.6, wR: -0.6, hx: 0.2 }; m2.set(-2.0, 0, 2.6); }
  if (t >= T.then && t < T.alarm + 1.4) { // mates sneak through the fire exit from the alley
    const u = st(T.pushes, T.alarm + 1.0, t); m1.set(lerp(8.6, 7.6, u), 0, lerp(-5.2, -7.0, u)); m2.set(lerp(9.2, 8.2, u), 0, lerp(-4.6, -6.4, u)); mr = -Math.PI / 2 - 0.4; m1P = walkPose(t, 8, 0.4); m2P = walkPose(t + 0.5, 8, 0.4); if (t > T.alarm) { m1P = { aL: [2.6, 0.3, 0], aR: [2.6, 0.3, 0], hx: -0.2 }; m2P = { aL: [2.5, 0.3, 0], aR: [2.5, 0.3, 0] }; } }
  // fight inside (mate1 vs mate2)
  if (t >= T.fight - 0.3 && t < T.cams - 0.4) { m1.set(-0.6, 0, -2.2); m2.set(0.3, 0, -2.0); const sh = Math.sin((t - T.fight) * 5); m1P = { aL: [1.3, 0.1, 0], eL: 0.4 + sh * 0.3, aR: [1.2, 0.1, 0], eR: 0.3, lean: 0.15 + sh * 0.08, hx: 0.1 }; m2P = { aL: [1.1, 0.1, 0], eL: 0.5, aR: [lerp(0.9, 2.4, st(T.glass - 0.3, T.glass, t)), -0.1, 0], eR: lerp(1.0, 0.3, st(T.glass - 0.3, T.glass, t)), lean: -0.1 - sh * 0.05 }; }
  if (t >= T.cams - 0.4) { m1.set(-0.8, 0, -1.6); m2.set(0.4, 0, -1.4); const sh = Math.sin(t * 3); m1P = { aL: [1.0, 0.2, 0], eL: 1.2, aR: [1.2, -0.1, 0], eR: 0.3, hy: 0.2 * sh }; m2P = { aL: [1.0, 0.3, 0], eL: 1.1, aR: [1.3, -0.2, 0], eR: 0.2, hy: -0.2 * sh }; }
  mate1.position.copy(m1); mate1.rotation.y = t >= T.fight - 0.3 ? Math.atan2(m2.x - m1.x, m2.z - m1.z) : mr; mate2.position.copy(m2); mate2.rotation.y = t >= T.fight - 0.3 ? Math.atan2(m1.x - m2.x, m1.z - m2.z) : mr; pose(mate1, m1P, t); pose(mate2, m2P, t);
  stampMark.material.opacity = t > T.stamped && t < T.then ? 1 : 0; stampMark.material.emissiveIntensity = t > T.glows - 0.2 ? 3 : 0.3;
  uvLamp.material.emissiveIntensity = t > T.glows - 0.3 && t < T.then ? 2.5 : 0; uvLampL.intensity = t > T.glows - 0.3 && t < T.then ? 10 : 0;
  // glass smash vs polycarbonate cup
  const smash = T.smashed; pint.visible = t < smash + 0.02 && t > T.fight - 0.4; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const hp = mate2.userData.P.arms[1].hand.getWorldPosition(new THREE.Vector3());
  shards.visible = t > smash && t < T.poly; for (let i = 0; i < SH; i++) { const a = t - smash, v = shardV[i]; if (a < 0) m4.makeScale(0, 0, 0); else { const tt = Math.min(a, 1.2); q.setFromEuler(new THREE.Euler(a * 9 + i, a * 7, i)); m4.compose(V3(hp.x + v[0] * tt * 0.5, Math.max(0.02, hp.y + v[1] * tt * 0.6 - 4.9 * tt * tt), hp.z + v[2] * tt * 0.5), q, V3(1, 1, 1)); } shards.setMatrixAt(i, m4); }
  shards.instanceMatrix.needsUpdate = true;
  polyCup.visible = t > T.poly - 0.3 && t < T.cams - 0.4; const drop = st(T.poly, T.bend, t); const bounce = Math.abs(Math.sin(st(T.bend, T.shatter + 0.6, t) * Math.PI * 3)) * (1 - st(T.bend, T.shatter + 0.6, t));
  polyCup.position.set(-4.9, Math.max(0.08 + 1.13, lerp(2.2, 1.21, drop * drop)) + bounce * 0.12, -4.5); const squash = Math.exp(-Math.pow((t - T.bend) / 0.12, 2)); polyCup.scale.set(1 + squash * 0.35, 1 - squash * 0.4, 1 + squash * 0.35); polyCup.rotation.z = Math.sin(t * 7) * 0.08 * bounce;
}

// ---------------------------------------------------------------- cinematic wide camera
let SHOTS = [];
function buildShots() {
  SHOTS = [
    [-1, T.packed - 0.1, (u, t) => { const k = eio(st(T.lights - 0.1, T.packed - 0.1, t)); return { p: V3(lerp(0.4, 0.2, k), lerp(0.35, 1.0, k), lerp(-0.6, -5.4, k)), g: V3(0, lerp(2.6, 1.6, k), -11), f: lerp(78, 64, k) }; }],
    [T.packed - 0.1, T.fire - 0.15, (u) => ({ p: V3(lerp(-5.0, 5.0, eio(u)), lerp(4.2, 3.4, u), lerp(-0.9, -0.7, u)), g: V3(0, 1.3, -7), f: 66 })],
    [T.fire - 0.15, T.bouncer - 0.1, (u) => ({ p: V3(lerp(10, 9, u), 18, lerp(8, 6, u)), g: V3(0, 0, -5.5), f: 46 })],
    [T.bouncer - 0.1, T.number - 0.1, (u) => ({ p: V3(lerp(1.6, 0.9, eio(u)), lerp(1.8, 1.6, u), lerp(5.2, 4.0, eio(u))), g: V3(-1.6, 1.4, 0.9), f: 42 })],
    [T.number - 0.1, T.teen - 0.05, (u) => { const c = clicker.getWorldPosition(new THREE.Vector3()); return { p: c.clone().add(V3(0.22, 0.05, 0.3)), g: c, f: 30 }; }],
    [T.teen - 0.05, T.scanner - 0.1, (u) => ({ p: V3(lerp(2.6, 1.8, u), lerp(2.2, 1.8, u), lerp(6.6, 5.4, u)), g: V3(-1.8, 1.2, 1.0), f: 42 })],
    [T.scanner - 0.1, T.saves - 0.05, (u) => ({ p: V3(lerp(1.2, 0.7, eio(u)), lerp(2.1, 1.9, u), lerp(3.6, 2.9, eio(u))), g: V3(-1.0, 1.25, 0.9), f: 38 })],
    [T.saves - 0.05, T.banned - 0.1, (u) => ({ p: V3(lerp(0.4, 0.2, u), lerp(1.75, 1.7, u), lerp(2.4, 2.1, u)), g: V3(-0.95, 1.3, 0.8), f: 36 })],
    [T.banned - 0.1, T.step - 0.05, (u) => ({ p: V3(lerp(0, 10, eio(u)), lerp(30, 42, eio(u)), lerp(34, 40, eio(u))), g: V3(0, 0, -6), f: 46 })],
    [T.step - 0.05, T.hand - 0.3, (u) => ({ p: V3(lerp(0.8, 0.2, u), lerp(1.9, 1.7, u), lerp(6.8, 6.0, u)), g: V3(-2.8, 1.2, 1.2), f: 42 })],
    [T.hand - 0.3, T.then - 0.05, (u) => { const h = mate1.userData.P.arms[1].hand.getWorldPosition(new THREE.Vector3()); return { p: h.clone().add(V3(0.4, 0.25, 0.5)), g: h, f: 34 }; }],
    [T.then - 0.05, T.music2 - 0.6, (u) => ({ p: V3(lerp(11.8, 11.0, u), lerp(2.0, 1.7, u), lerp(-2.0, -3.0, u)), g: V3(7.3, 1.3, -7.8), f: 44 })],
    [T.music2 - 0.6, T.fight - 0.3, (u) => ({ p: V3(lerp(-4.5, -3.5, u), lerp(3.4, 3.0, u), lerp(-0.6, -0.9, u)), g: V3(1, 1.2, -7), f: 50 })],
    [T.fight - 0.3, T.poly - 0.3, (u) => ({ p: V3(lerp(1.8, 1.4, u), 1.6, lerp(0.8, 0.4, u)), g: V3(-0.15, 1.45, -2.1), f: 42 })],
    [T.poly - 0.3, T.cams - 0.4, (u) => ({ p: V3(-4.0, 1.55, lerp(-3.6, -3.8, u)), g: V3(-4.9, 1.3, -4.5), f: 34 })],
    [T.cams - 0.4, T.rope - 0.2, (u) => { const c = bodyCam.getWorldPosition(new THREE.Vector3()); return { p: c.clone().add(V3(lerp(0.9, 0.55, u), 0.05, lerp(1.1, 0.7, u))), g: c, f: 34 }; }],
    [T.rope - 0.2, T.built - 0.3, (u) => ({ p: V3(lerp(-1, -4, eio(u)), lerp(2.2, 2.8, u), lerp(8.5, 9, u)), g: V3(-3.4, 1.2, 0), f: 46 })],
    [T.built - 0.3, DUR + 1, (u, t) => { const e = eio(st(T.built - 0.3, DUR, t)); return { p: V3(lerp(14, 20, e), lerp(18, 28, e), lerp(16, 22, e)), g: V3(0, 0, -6), f: 46 }; }],
  ];
}
buildShots();
function placeCamera(t) { const s = SHOTS.find((x) => t >= x[0] && t < x[1]) || SHOTS[SHOTS.length - 1]; const u = cl((t - Math.max(0, s[0])) / (s[1] - Math.max(0, s[0]))); const c = s[2](u, t); camera.position.copy(c.p).add(V3(Math.sin(t * 0.9) * 0.02, Math.sin(t * 1.2) * 0.015, 0)); camera.fov = c.f; camera.updateProjectionMatrix(); camera.lookAt(c.g); }
function overlay(t) { const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); const fade = Math.max(1 - st(0, 0.3, t), st(DUR - 0.6, DUR, t)); if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); } }
window.renderFrame = (t, q = 0.92) => { placeClub(t); placeActors(t); scene.updateMatrixWorld(true); placeCamera(t); composer.render(); ctx.clearRect(0, 0, W, H); ctx.drawImage(glCanvas, 0, 0); overlay(t); return out.toDataURL('image/jpeg', q); };
window.READY = true;

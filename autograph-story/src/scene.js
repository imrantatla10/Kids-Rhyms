// "The Autograph" – a 3D re-enactment of the speaker's own account (her original audio is the only voice). No captions.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1920, H = 1080;
const DUR = window.DUR || 62.5;
const ENV = window.ENV || [];
const cl = (x) => Math.min(1, Math.max(0, x));
const st = (a, b, t) => cl((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eo = (x) => 1 - Math.pow(1 - x, 3);
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(9);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const OFF = 7.6; // the speech starts at 8.0 s (comedy intro before it)
const env = (t) => { const i = Math.floor((t - OFF) * 30); return i >= 0 ? (ENV[i] || 0) : 0; };

// story beats (seconds, audio starts at 0.4 s)
const T = Object.fromEntries(Object.entries({ land: 0.4, step: 2.4, girl: 4.46, truth: 8.9, barr: 13.42, hands: 17.54, blood: 21.7, phone: 23.52, love: 25.86, ask: 27.48, answer: 30.16, auto: 33.8, meet: 37.0, end: 38.3 }).map(([k, v]) => [k, v + OFF]));
const E = { squeal: 47.2, shove: 48.4, land: 49.5, run: 49.0, guard: 50.0, sit: 53.2, wide: 56.5 };

// ---------------------------------------------------------------- renderer
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xd9d2c2, 40, 160);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture; scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.02, 500);
const composer = new EffectComposer(renderer); composer.setSize(W, H); composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.15, 0.4, 0.93)); composer.addPass(new OutputPass());
const out = document.getElementById('out'); const ctx = out.getContext('2d');
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
const fabric = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.85, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.4), ...o });
function mesh(geo, m, cast = true, recv = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
function canvasTex(w, h, draw, rep = 1) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t; }
function noiseCanvas(g, w, h, base, vary, seed, speck = 0) { const r = rng(seed); const img = g.createImageData(w, h); const G = 64, grid = [...Array((G + 1) * (G + 1))].map(() => r()); const vn = (x, y) => { const xi = Math.floor(x) % G, yi = Math.floor(y) % G, xf = x - Math.floor(x), yf = y - Math.floor(y); const s = (q) => q * q * (3 - 2 * q); const i = (a, b) => grid[(b % G) * (G + 1) + (a % G)]; return (i(xi, yi) * (1 - s(xf)) + i(xi + 1, yi) * s(xf)) * (1 - s(yf)) + (i(xi, yi + 1) * (1 - s(xf)) + i(xi + 1, yi + 1) * s(xf)) * s(yf); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let f = 0, a = 0.5, fr = 4; for (let o = 0; o < 5; o++) { f += a * vn(x / w * fr, y / h * fr); a *= 0.5; fr *= 2; } const sp = speck && r() < speck ? (r() - 0.5) * 0.5 : 0; const k = (y * w + x) * 4; for (let c = 0; c < 3; c++) img.data[k + c] = Math.max(0, Math.min(255, base[c] + (f - 0.5) * vary[c] + sp * 60)); img.data[k + 3] = 255; } g.putImageData(img, 0, 0); }

// ---------------------------------------------------------------- sky & light (warm afternoon)
const sky = mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 vp; void main(){ float y = clamp(vp.y,0.,1.); vec3 c = mix(vec3(0.93,0.86,0.74), vec3(0.42,0.62,0.88), pow(y,0.5)); vec3 sd = normalize(vec3(-0.5,0.45,0.4)); c += vec3(1.,0.85,0.6)*pow(max(dot(vp,sd),0.),200.)*2. + vec3(1.,0.8,0.55)*pow(max(dot(vp,sd),0.),6.)*0.2; gl_FragColor = vec4(pow(c,vec3(2.2)),1.); }' }), false, false);
scene.add(sky);
scene.add(new THREE.HemisphereLight(0xe8eeff, 0x8a7350, 0.8));
const sun = new THREE.DirectionalLight(0xffe2bc, 3.0); sun.position.set(-12, 13, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; scene.add(sun);

// ---------------------------------------------------------------- grain market plaza
const dirtTex = canvasTex(512, 512, (g, w, h) => noiseCanvas(g, w, h, [176, 156, 124], [50, 44, 36], 3, 0.3), 14);
const ground = mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.95 }), false, true); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const pave = mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => { noiseCanvas(g, w, h, [150, 146, 140], [30, 30, 30], 5); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let i = 0; i < w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, 3), roughness: 0.9 }), false, true);
pave.rotation.x = -Math.PI / 2; pave.position.set(0, 0.01, 0.8); scene.add(pave);
// grain sacks (burlap) stacked around the yard
const burlap = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { noiseCanvas(g, w, h, [190, 166, 120], [40, 34, 26], 8); g.strokeStyle = 'rgba(80,60,30,0.25)'; for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, 1), roughness: 1 });
{ const g = new RoundedBoxGeometry(0.9, 0.38, 0.55, 3, 0.15); const N = 360; const im = new THREE.InstancedMesh(g, burlap, N); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
  for (const [cx, cz, nx, nz, ny] of [[-10, -9, 6, 3, 5], [9, -10, 6, 3, 5], [-12, 5, 3, 5, 4], [12, 4, 3, 5, 4], [0, -15, 10, 2, 6]]) for (let y = 0; y < ny; y++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { if (k >= N) break; if (y > 0 && R() < 0.12 * y) continue; q.setFromEuler(new THREE.Euler(0, (R() - 0.5) * 0.15, 0)); m4.compose(V3(cx + (i - nx / 2) * 0.95 + (y % 2) * 0.3, 0.2 + y * 0.36, cz + (j - nz / 2) * 0.6), q, V3(1, 1, 1)); im.setMatrixAt(k++, m4); }
  im.count = k; im.castShadow = im.receiveShadow = true; scene.add(im); }
// shop rows with shutters and tin roofs
function shops(x0, z0, n, ry) { const g = new THREE.Group(); const wall = M(0xd9c7a6, { roughness: 0.95 }); const tin = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c) => { const gr = c.createLinearGradient(0, 0, 128, 0); for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? '#8f9aa3' : '#c2c9ce'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); }, 6), metalness: 0.7, roughness: 0.45 });
  const shut = new THREE.MeshStandardMaterial({ map: canvasTex(64, 128, (c) => { c.fillStyle = '#6c7378'; c.fillRect(0, 0, 64, 128); for (let y = 0; y < 128; y += 6) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, y, 64, 2); } }), metalness: 0.6, roughness: 0.5 });
  for (let i = 0; i < n; i++) { const b = mesh(new THREE.BoxGeometry(3.2, 3.4, 3), wall); b.position.set(i * 3.3, 1.7, 0); g.add(b); const s = mesh(new THREE.PlaneGeometry(2.6, 2.4), shut); s.position.set(i * 3.3, 1.25, 1.51); g.add(s); const sign = mesh(new THREE.BoxGeometry(2.8, 0.5, 0.06), M([0x2d6a4f, 0xc1121f, 0x1d3557, 0xe9c46a][i % 4])); sign.position.set(i * 3.3, 2.85, 1.55); g.add(sign); }
  const roof = mesh(new THREE.BoxGeometry(n * 3.3 + 0.4, 0.06, 2.2), tin); roof.position.set((n - 1) * 1.65, 2.6, 2.4); roof.rotation.x = 0.18; g.add(roof);
  for (let i = 0; i <= n; i++) { const p = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), M(0x555b60, { metalness: 0.7 })); p.position.set(i * 3.3 - 1.65, 1.25, 3.4); g.add(p); }
  g.position.set(x0, 0, z0); g.rotation.y = ry; scene.add(g); }
shops(-12, -20, 8, 0); shops(20, -8, 6, -Math.PI / 2); shops(-20, 8, 6, Math.PI / 2);
const leafTexs = [1, 2, 3].map((s) => { const t = canvasTex(256, 256, (g) => { const r = rng(s * 13); for (let i = 0; i < 900; i++) { const x = 128 + (r() - 0.5) * 230 * Math.sqrt(r()), y = 128 + (r() - 0.5) * 230 * Math.sqrt(r()); if (Math.hypot(x - 128, y - 128) > 118) continue; g.fillStyle = `rgba(${50 + r() * 40 | 0},${85 + r() * 50 | 0},${30 + r() * 25 | 0},0.85)`; g.beginPath(); g.ellipse(x, y, 4 + r() * 5, 2 + r() * 3, r() * 3, 0, 7); g.fill(); } }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); return t; });
function tree(x, z, s) { const g = new THREE.Group(); const tr = mesh(new THREE.CylinderGeometry(0.2 * s, 0.35 * s, 4.5 * s, 10), M(0x5a4330, { roughness: 1 })); tr.position.y = 2.2 * s; g.add(tr); for (let i = 0; i < 24; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: leafTexs[i % 3], alphaTest: 0.35 })); const sz = (2 + R() * 1.8) * s; sp.scale.set(sz, sz, 1); sp.position.set((R() - 0.5) * 4 * s, (4.5 + R() * 3) * s, (R() - 0.5) * 4 * s); g.add(sp); } g.position.set(x, 0, z); scene.add(g); }
for (const [x, z, s] of [[-16, -14, 1.3], [15, -15, 1.4], [-18, 16, 1.2], [17, 14, 1.1], [-6, -24, 1.5], [7, -25, 1.3]]) tree(x, z, s);
// power poles with sagging wires
{ const pm = M(0x8b8b86, { roughness: 0.9 }); const pts = [[-18, -6], [-6, -11], [6, -12], [18, -7]]; pts.forEach(([x, z]) => { const p = mesh(new THREE.CylinderGeometry(0.09, 0.13, 8, 8), pm); p.position.set(x, 4, z); scene.add(p); const cr = mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), pm); cr.position.set(x, 7.6, z); scene.add(cr); }); for (let i = 0; i < pts.length - 1; i++) for (const o of [-0.6, 0, 0.6]) { const a = V3(pts[i][0] + o, 7.6, pts[i][1]), b = V3(pts[i + 1][0] + o, 7.6, pts[i + 1][1]); const mid = a.clone().lerp(b, 0.5); mid.y -= 0.7; scene.add(mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.012, 4), M(0x222222), false, false)); } }
// bunting flags (green/white)
{ const a = V3(-8, 3.6, -3.4), b = V3(8, 3.6, -3.4); for (let i = 0; i < 40; i++) { const u = i / 39; const p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * 0.5; const f = mesh(new THREE.ConeGeometry(0.12, 0.28, 3), M(i % 2 ? 0x1b7a3e : 0xf4f4f0, { side: THREE.DoubleSide }), false, false); f.position.copy(p); f.position.y -= 0.14; f.rotation.x = Math.PI; scene.add(f); } }
// steel crowd barricades along z = -3
const steel = new THREE.MeshStandardMaterial({ color: 0xb7bec6, metalness: 0.9, roughness: 0.35 });
const barriers = [];
for (let i = -5; i <= 5; i++) { const g = new THREE.Group(); const w = 2.0; for (const y of [0.15, 1.05]) { const r = mesh(new THREE.CylinderGeometry(0.025, 0.025, w, 8), steel); r.rotation.z = Math.PI / 2; r.position.y = y; g.add(r); } for (let k = 0; k < 11; k++) { const v = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), steel); v.position.set(-w / 2 + k * w / 10, 0.6, 0); g.add(v); } for (const s of [-1, 1]) { const ft = mesh(new THREE.BoxGeometry(0.05, 0.03, 0.6), steel); ft.position.set(s * (w / 2 - 0.05), 0.02, 0); g.add(ft); const lg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.08, 8), steel); lg.position.set(s * (w / 2 - 0.05), 0.55, 0); g.add(lg); } g.position.set(i * 2.05, 0, -3); scene.add(g); barriers.push(g); }
// helicopter
const heli = new THREE.Group(); scene.add(heli);
const heliPaint = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f5, roughness: 0.25, metalness: 0.2, clearcoat: 1 });
{ const prof = [[0.05, -2.2], [0.6, -1.9], [0.95, -1.2], [1.05, 0], [0.95, 1.0], [0.6, 1.8], [0.1, 2.2]].map(([r, y]) => new THREE.Vector2(r, y)); const g = new THREE.LatheGeometry(prof, 40); g.rotateZ(Math.PI / 2); g.scale(1, 0.9, 0.85); heli.add(mesh(g, heliPaint));
  const glass = mesh(new THREE.SphereGeometry(0.95, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.2), new THREE.MeshPhysicalMaterial({ color: 0x1b2633, roughness: 0.05, metalness: 0.5 })); glass.rotation.z = -Math.PI / 2; glass.position.set(1.1, 0.15, 0); glass.scale.set(0.9, 1.0, 0.8); heli.add(glass);
  const stripe = mesh(new THREE.BoxGeometry(3.4, 0.14, 1.62), M(0x1b7a3e)); stripe.position.set(0, -0.15, 0); heli.add(stripe);
  const boom = mesh(new THREE.CylinderGeometry(0.12, 0.25, 4.2, 16), heliPaint); boom.rotation.z = Math.PI / 2; boom.position.set(-3.8, 0.35, 0); heli.add(boom);
  const fin = mesh(new THREE.BoxGeometry(0.7, 1.1, 0.08), heliPaint); fin.position.set(-5.8, 0.85, 0); fin.rotation.z = 0.35; heli.add(fin);
  for (const s of [-1, 1]) { const sk = mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), M(0x2a2d31, { metalness: 0.7 })); sk.rotation.z = Math.PI / 2; sk.position.set(0.2, -0.95, s * 0.75); heli.add(sk); for (const x of [-0.7, 0.9]) { const st2 = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), M(0x2a2d31, { metalness: 0.7 })); st2.position.set(x, -0.75, s * 0.68); heli.add(st2); } }
  const mast = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 12), M(0x333333, { metalness: 0.7 })); mast.position.set(0, 1.0, 0); heli.add(mast);
  const door = new THREE.Group(); const dp = mesh(new THREE.BoxGeometry(1.1, 1.1, 0.05), heliPaint); dp.position.x = 0.55; door.add(dp); door.position.set(-0.55, -0.1, 0.9); heli.add(door); heli.userData.door = door; }
const rotor = new THREE.Group(); rotor.position.set(0, 1.25, 0); heli.add(rotor);
for (let i = 0; i < 4; i++) { const b = mesh(new THREE.BoxGeometry(5.4, 0.03, 0.22), M(0x1e1f22, { roughness: 0.5 })); b.position.x = 2.7; const p = new THREE.Group(); p.rotation.y = i * Math.PI / 2; p.add(b); rotor.add(p); }
const rotorDisc = mesh(new THREE.CircleGeometry(5.4, 48), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), false, false); rotorDisc.rotation.x = -Math.PI / 2; rotor.add(rotorDisc);
const tailRotor = new THREE.Group(); tailRotor.position.set(-5.9, 0.9, 0.12); heli.add(tailRotor); for (let i = 0; i < 2; i++) { const b = mesh(new THREE.BoxGeometry(0.06, 1.1, 0.02), M(0x1e1f22)); b.rotation.z = i * Math.PI / 2; tailRotor.add(b); }
const HELI_POS = V3(-11, 0, 3.5);
// dust sprites
const dustTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(214,192,160,0.6)'); r.addColorStop(1, 'rgba(214,192,160,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }); dustTex.wrapS = dustTex.wrapT = THREE.ClampToEdgeWrapping;
const dust = []; for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s); dust.push({ s, a: R() * 6.28, r: 1 + R() * 2, sp: 0.5 + R() }); }

// ---------------------------------------------------------------- crowd (instanced)
const CROWD = 170; const cBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.75, 4, 10), new THREE.MeshStandardMaterial({ roughness: 0.85 }), CROWD); const cHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshStandardMaterial({ roughness: 0.6 }), CROWD); const cHair = new THREE.InstancedMesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ roughness: 0.8 }), CROWD);
const crowdP = []; { const cols = [0x1b7a3e, 0xf4f4f0, 0x2a4d8f, 0xc1121f, 0x6d597a, 0xe9c46a, 0xd4a373, 0x264653, 0xf28482, 0x84a59d]; const skins = [0xc68642, 0x8d5524, 0xe0ac69, 0xa86b3c, 0xf1c27d]; for (let i = 0; i < CROWD; i++) { const row = Math.floor(i / 28), col = i % 28; const x = -7.5 + col * 0.55 + (R() - 0.5) * 0.25, z = -3.55 - row * 0.6 - R() * 0.2; if (Math.abs(x - 1.1) < 0.35 && row === 0) { crowdP.push(null); continue; } const h = 0.9 + R() * 0.18; crowdP.push({ x, z, h, ph: R() * 6 }); cBody.setColorAt(i, new THREE.Color(cols[Math.floor(R() * cols.length)])); cHead.setColorAt(i, new THREE.Color(skins[Math.floor(R() * skins.length)])); cHair.setColorAt(i, new THREE.Color(R() < 0.45 ? cols[Math.floor(R() * cols.length)] : 0x1a1210)); } }
[cBody, cHead, cHair].forEach((m) => { m.castShadow = true; scene.add(m); });

// ---------------------------------------------------------------- semi-realistic characters
function ribbon(points, width, material, cast = true) { const c = new THREE.CatmullRomCurve3(points); const N = 30, pos = [], uv = [], idx = []; for (let i = 0; i <= N; i++) { const u = i / N, p = c.getPointAt(u), tg = c.getTangentAt(u); const side = V3(0, 0, 1).cross(tg).normalize().multiplyScalar(width / 2); if (side.length() < 1e-4) side.set(width / 2, 0, 0); for (const s of [-1, 1]) { pos.push(p.x + side.x * s, p.y + side.y * s, p.z + side.z * s); uv.push(s < 0 ? 0 : 1, u); } if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); const m = mesh(g, material, cast); m.material.side = THREE.DoubleSide; return m; }
function makeHuman(o) {
  const g = new THREE.Group(); const P = {}; g.userData.P = P;
  const skin = new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffd0b0), clearcoat: 0.05 });
  P.skin = skin;
  const kam = fabric(o.kameez), pant = fabric(o.pants), dup = fabric(o.dupatta, { transparent: o.sheer || false, opacity: o.sheer ? 0.92 : 1 });
  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips); P.hips = hips;
  // legs
  P.legs = []; for (const s of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(s * 0.09, 0, 0); hips.add(hip); const th = mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 12), pant); th.position.y = -0.22; hip.add(th); const kn = new THREE.Group(); kn.position.y = -0.45; hip.add(kn); const sh = mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 12), pant); sh.position.y = -0.2; kn.add(sh); const ft = mesh(new RoundedBoxGeometry(0.09, 0.07, 0.24, 3, 0.03), M(o.shoe || 0x5a3a28, { roughness: 0.5 })); ft.position.set(0, -0.43, 0.05); kn.add(ft); P.legs.push({ hip, kn }); }
  // torso (kameez)
  const spine = new THREE.Group(); hips.add(spine); P.spine = spine;
  const prof = [[0.0, -0.44], [0.27, -0.44], [0.24, -0.25], [0.18, -0.05], [0.15, 0.06], [0.165, 0.2], [0.17, 0.32], [0.15, 0.42], [0.1, 0.47], [0.055, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const tg = new THREE.LatheGeometry(prof, 40); tg.scale(1, 1, 0.72); const torso = mesh(tg, kam); spine.add(torso);
  if (o.gown) { const gp = [[0.0, -0.7], [0.32, -0.72], [0.28, -0.4], [0.21, -0.05], [0.2, 0.2], [0.2, 0.36], [0.17, 0.45], [0.1, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)); const gg = new THREE.LatheGeometry(gp, 40, 0.42, Math.PI * 2 - 0.84); gg.scale(1, 1, 0.78); const gown = mesh(gg, fabric(0x141416, { side: THREE.DoubleSide })); spine.add(gown);
    const embTex = canvasTex(64, 512, (c) => { c.fillStyle = '#5a0f1c'; c.fillRect(0, 0, 64, 512); c.strokeStyle = '#e8dcc6'; c.lineWidth = 3; for (let y = 0; y < 512; y += 20) { c.beginPath(); c.arc(12, y, 6, 0, 3.14); c.stroke(); c.beginPath(); c.arc(52, y + 10, 6, 3.14, 6.28); c.stroke(); } for (let y = 40; y < 512; y += 130) { c.fillStyle = '#7a1424'; c.strokeStyle = '#e8dcc6'; c.beginPath(); c.moveTo(18, y); c.lineTo(46, y); c.lineTo(46, y + 30); c.lineTo(32, y + 44); c.lineTo(18, y + 30); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f4a020'; c.beginPath(); c.arc(32, y + 20, 9, 0, 7); c.fill(); c.fillStyle = '#3a6fc0'; c.beginPath(); c.arc(28, y + 16, 4, 0, 7); c.fill(); } });
    embTex.wrapS = embTex.wrapT = THREE.ClampToEdgeWrapping; embTex.repeat.set(1, 1); const sm = new THREE.MeshStandardMaterial({ map: embTex, roughness: 0.8, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const strip = ribbon([V3(s * 0.08, 0.5, 0.08), V3(s * 0.13, 0.4, 0.15), V3(s * 0.15, 0.2, 0.16), V3(s * 0.16, -0.1, 0.165), V3(s * 0.2, -0.45, 0.2), V3(s * 0.24, -0.7, 0.24)], 0.1, sm); spine.add(strip); } }
  // neck, head
  const neck = mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.09, 14), skin); neck.position.y = 0.52; spine.add(neck);
  const head = new THREE.Group(); head.position.y = 0.55; spine.add(head); P.head = head;
  const skull = mesh(new THREE.SphereGeometry(0.115, 40, 30), skin); skull.scale.set(0.84, 1.06, 0.95); skull.position.y = 0.125; head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.085, 30, 20), skin); jaw.scale.set(0.9, 0.82, 1.0); jaw.position.set(0, 0.062, 0.028); head.add(jaw);
  const nose = mesh(new THREE.ConeGeometry(0.013, 0.045, 12), skin); nose.position.set(0, 0.098, 0.103); nose.rotation.x = Math.PI * 0.62; head.add(nose);
  const tip = mesh(new THREE.SphereGeometry(0.011, 12, 10), skin); tip.position.set(0, 0.083, 0.113); head.add(tip);
  P.eyes = []; for (const s of [-1, 1]) { const e = new THREE.Group(); e.position.set(s * 0.037, 0.122, 0.089); head.add(e); e.add(mesh(new THREE.SphereGeometry(0.014, 16, 12), M(0xf6f2ec, { roughness: 0.2 }), false)); const ir = mesh(new THREE.SphereGeometry(0.0085, 14, 10), M(o.eye || 0x3b2414, { roughness: 0.1 }), false); ir.position.z = 0.009; e.add(ir); const pu = mesh(new THREE.SphereGeometry(0.004, 10, 8), M(0x050505, { roughness: 0.05 }), false); pu.position.z = 0.0145; e.add(pu); const lid = mesh(new THREE.SphereGeometry(0.0155, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, false); lid.rotation.x = -0.35; e.add(lid); e.userData.lid = lid; const lash = mesh(new THREE.TorusGeometry(0.0145, 0.0018, 4, 16, Math.PI), M(0x111111), false); lash.rotation.set(-0.3, 0, 0); lash.position.y = 0.002; e.add(lash); P.eyes.push(e);
    const brow = mesh(new THREE.TorusGeometry(0.03, 0.0035, 4, 16, Math.PI * 0.75), M(o.hair, { roughness: 0.8 }), false); brow.position.set(s * 0.038, 0.142, 0.095); brow.rotation.set(-0.25, 0, Math.PI / 2 - Math.PI * 0.375 + (s > 0 ? 0 : 0)); head.add(brow); }
  const lipM = new THREE.MeshPhysicalMaterial({ color: o.lips || 0xb5655d, roughness: 0.35, clearcoat: 0.3 });
  const upper = mesh(new THREE.CapsuleGeometry(0.006, 0.026, 4, 10), lipM, false); upper.rotation.z = Math.PI / 2; upper.position.set(0, 0.056, 0.104); head.add(upper);
  const lower = mesh(new THREE.CapsuleGeometry(0.0065, 0.022, 4, 10), lipM, false); lower.rotation.z = Math.PI / 2; lower.position.set(0, 0.047, 0.103); head.add(lower); P.lower = lower;
  const mouth = mesh(new THREE.SphereGeometry(0.012, 12, 8), M(0x3a1414), false); mouth.scale.set(1.3, 0.2, 0.4); mouth.position.set(0, 0.051, 0.1); head.add(mouth); P.mouth = mouth;
  for (const s of [-1, 1]) { const ear = mesh(new THREE.SphereGeometry(0.02, 10, 8), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.097, 0.11, 0.0); head.add(ear); }
  const hairM = new THREE.MeshPhysicalMaterial({ color: o.hair, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0x6a4a30) });
  const hair = mesh(new THREE.SphereGeometry(0.119, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM); hair.scale.set(0.86, 1.06, 0.98); hair.position.set(0, 0.135, -0.01); hair.rotation.x = -0.55; head.add(hair);
  if (o.ponytail) { const pt = mesh(new THREE.CapsuleGeometry(0.03, 0.18, 4, 10), hairM); pt.position.set(0, 0.03, -0.11); pt.rotation.x = 0.3; head.add(pt); }
  // dupatta: hood over the head + drapes
  if (!o.noDup) {
  const hood = mesh(new THREE.SphereGeometry(0.135, 40, 20, Math.PI * 0.7, Math.PI * 1.6, 0.0, Math.PI * 0.72), dup); hood.scale.set(0.9, 1.08, 1.0); hood.position.set(0, 0.12, -0.012); hood.material.side = THREE.DoubleSide; head.add(hood);
  if (o.drape === 'wrap') { spine.add(ribbon([V3(-0.11, 0.62, 0.02), V3(-0.13, 0.5, 0.06), V3(-0.08, 0.42, 0.13), V3(0.05, 0.36, 0.15), V3(0.12, 0.2, 0.15), V3(0.1, -0.05, 0.14), V3(0.06, -0.25, 0.13)], 0.15, dup)); spine.add(ribbon([V3(0.11, 0.62, 0.02), V3(0.13, 0.5, 0.0), V3(0.17, 0.42, -0.04), V3(0.18, 0.2, -0.08), V3(0.17, -0.1, -0.1)], 0.13, dup)); }
  else { for (const s of [-1, 1]) spine.add(ribbon([V3(s * 0.11, 0.62, 0.02), V3(s * 0.15, 0.5, 0.03), V3(s * 0.19, 0.4, 0.04), V3(s * 0.2, 0.15, 0.08), V3(s * 0.2, -0.15, 0.1)], 0.14, dup)); spine.add(ribbon([V3(-0.19, 0.38, -0.05), V3(0, 0.3, -0.13), V3(0.19, 0.38, -0.05)], 0.12, dup)); }
  }
  if (o.cap) { const cp = mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.07, 24), M(o.cap)); cp.position.set(0, 0.215, -0.005); head.add(cp); const vz = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 24, 1, false, -Math.PI / 2, Math.PI), M(0x111111)); vz.position.set(0, 0.185, 0.06); head.add(vz); }
  if (o.earring) for (const s of [-1, 1]) { const er = mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0x5a3aa0, metalness: 0.8, roughness: 0.1 }), false); er.position.set(s * 0.098, 0.085, 0.005); head.add(er); }
  // arms & hands
  P.arms = []; for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.19, 0.4, 0); spine.add(sh); const up = mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 12), o.gown ? fabric(0x141416) : kam); up.position.y = -0.14; sh.add(up); const el = new THREE.Group(); el.position.y = -0.28; sh.add(el); const lo = mesh(new THREE.CapsuleGeometry(o.gown ? 0.05 : 0.038, 0.2, 4, 12), o.gown ? fabric(0x141416) : kam); lo.position.y = -0.13; el.add(lo); const cuff = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), skin); cuff.position.y = -0.255; el.add(cuff);
    const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand); const palmM = skin; const palm = mesh(new RoundedBoxGeometry(0.06, 0.075, 0.024, 3, 0.01), palmM); palm.position.y = -0.04; hand.add(palm); for (let f = 0; f < 4; f++) { const fg = mesh(new THREE.CapsuleGeometry(0.0075, 0.04, 3, 8), palmM); fg.position.set(-0.021 + f * 0.014, -0.1, 0.002); hand.add(fg); } const th = mesh(new THREE.CapsuleGeometry(0.008, 0.03, 3, 8), palmM); th.position.set(s * -0.035, -0.04, 0.012); th.rotation.z = s * 0.6; hand.add(th); hand.userData.palm = palm; P.arms.push({ sh, el, hand }); }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(g); return g;
}
function pose(h, p, t) {
  const P = h.userData.P; const d = { lean: 0, turn: 0, hx: 0, hy: 0, hz: 0, aL: [0.05, 0.08, 0], aR: [0.05, 0.08, 0], eL: 0.15, eR: 0.15, wL: 0, wR: 0, lL: 0, lR: 0, kL: 0, kR: 0, blink: 0, mouth: 0, bob: 0, ...p };
  P.spine.rotation.set(d.lean, d.turn, 0); P.head.rotation.set(d.hx, d.hy, d.hz); P.hips.position.y = 0.92 + d.bob;
  [['aL', 'eL', 'wL', 0, 1], ['aR', 'eR', 'wR', 1, -1]].forEach(([a, e, w, i, s]) => { const A = P.arms[i]; A.sh.rotation.set(-d[a][0], d[a][2] * s, s * -d[a][1]); A.el.rotation.x = -d[e]; A.hand.rotation.x = d[w]; });
  P.legs[0].hip.rotation.x = d.lL; P.legs[1].hip.rotation.x = d.lR; P.legs[0].kn.rotation.x = d.kL; P.legs[1].kn.rotation.x = d.kR;
  const bl = d.blink || ((t % 3.7) < 0.12 ? 1 : 0); P.eyes.forEach((e) => { e.userData.lid.rotation.x = lerp(-0.35, 1.35, bl); });
  P.mouth.scale.set(1.3, 0.2 + d.mouth * 2.2, 0.4); P.lower.position.y = 0.047 - d.mouth * 0.01;
}
const cm = makeHuman({ skin: 0xe8b99a, kameez: 0x5b2a86, pants: 0x3c1d5e, dupatta: 0x5d2d92, hair: 0x2a1a12, gown: true, drape: 'wrap', earring: true, lips: 0xb0605a, shoe: 0x1a1a1a, sheer: true });
const guard = makeHuman({ skin: 0xa86b3c, kameez: 0x5f6b3a, pants: 0x4a5430, hair: 0x111111, noDup: true, cap: 0x2a2f1c, shoe: 0x111111 });
const girl = makeHuman({ skin: 0xd7a07a, kameez: 0xd9577a, pants: 0xf2ece4, dupatta: 0xf6e7ee, hair: 0x1a1210, ponytail: true, lips: 0xa85a55, shoe: 0x8a5a3a });
// girl's phone + diary + pen
const phoneG = new THREE.Group(); { const b = mesh(new RoundedBoxGeometry(0.075, 0.15, 0.009, 2, 0.008), M(0x18191c, { metalness: 0.6, roughness: 0.3 })); phoneG.add(b); const s = mesh(new THREE.PlaneGeometry(0.068, 0.14), new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x6a8fbf, emissiveIntensity: 0.5, roughness: 0.1 }), false); s.position.z = 0.0048; phoneG.add(s); }
girl.userData.P.arms[1].hand.add(phoneG); phoneG.position.set(0, -0.07, 0.02); phoneG.rotation.set(0.2, 0, 0);
const diary = mesh(new RoundedBoxGeometry(0.15, 0.2, 0.015, 2, 0.004), M(0x7a1e2c, { roughness: 0.6 })); girl.userData.P.arms[0].hand.add(diary); diary.position.set(0, -0.1, 0.03);
const page = mesh(new THREE.PlaneGeometry(0.13, 0.18), new THREE.MeshStandardMaterial({ map: canvasTex(128, 176, (c) => { c.fillStyle = '#fbf8f0'; c.fillRect(0, 0, 128, 176); c.strokeStyle = 'rgba(80,120,200,0.25)'; for (let y = 20; y < 176; y += 12) { c.beginPath(); c.moveTo(6, y); c.lineTo(122, y); c.stroke(); } }), roughness: 0.9 }), false); page.position.z = 0.0081; diary.add(page);
const sigCanvas = document.createElement('canvas'); sigCanvas.width = 256; sigCanvas.height = 128; const sigTex = new THREE.CanvasTexture(sigCanvas); sigTex.colorSpace = THREE.SRGBColorSpace;
const sig = mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ map: sigTex, transparent: true }), false); sig.position.set(0, -0.02, 0.0085); diary.add(sig);
const pen = mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.13, 8), M(0x1a1a1a, { metalness: 0.5, roughness: 0.3 })); cm.userData.P.arms[1].hand.add(pen); pen.position.set(0, -0.09, 0.03); pen.rotation.x = 0.6;
function drawSig(u) { const c = sigCanvas.getContext('2d'); c.clearRect(0, 0, 256, 128); c.strokeStyle = '#1b2f6e'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); const N = Math.floor(u * 120); for (let i = 0; i < N; i++) { const x = 20 + i * 1.8, y = 70 + Math.sin(i * 0.35) * 22 * Math.exp(-i / 90) + Math.sin(i * 0.9) * 8; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); sigTex.needsUpdate = true; }
// scratched / bleeding hands material for the girl after the barricade
const woundTex = canvasTex(256, 256, (c) => { c.fillStyle = '#d7a07a'; c.fillRect(0, 0, 256, 256); const r = rng(4); for (let i = 0; i < 14; i++) { const x = r() * 256, y = r() * 256, l = 30 + r() * 70, a = r() * 3.14; c.strokeStyle = `rgba(${140 + r() * 40 | 0},20,20,0.85)`; c.lineWidth = 2 + r() * 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(150,10,15,0.9)'; c.beginPath(); c.ellipse(r() * 256, r() * 256, 4 + r() * 5, 6 + r() * 10, 0, 0, 7); c.fill(); } });
woundTex.wrapS = woundTex.wrapT = THREE.ClampToEdgeWrapping; woundTex.repeat.set(1, 1);
const woundM = new THREE.MeshPhysicalMaterial({ map: woundTex, roughness: 0.4, sheen: 0.3, clearcoat: 0.2 });
const girlHandMeshes = []; girl.userData.P.arms.forEach((A) => A.hand.traverse((m) => { if (m.isMesh && m.material === girl.userData.P.skin) girlHandMeshes.push(m); }));
// blood drops
const drops = [...Array(6)].map(() => { const d = mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0x8a0a12, roughness: 0.1, clearcoat: 1 }), false); d.scale.y = 1.6; scene.add(d); return d; });

const GRAIN = 260; const grain = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 4), M(0xe0b64a, { roughness: 0.7 }), GRAIN); grain.frustumCulled = false; scene.add(grain);
const grainV = [...Array(GRAIN)].map(() => [(R() - 0.5) * 3, 1.5 + R() * 3, (R() - 0.5) * 3]);
const pile = new THREE.Group(); scene.add(pile);
{ const g = new RoundedBoxGeometry(0.9, 0.38, 0.55, 3, 0.15); for (let y = 0; y < 3; y++) for (let i = 0; i < 3 - y; i++) for (let j = 0; j < 2; j++) { const b = mesh(g, burlap); b.position.set((i - (2 - y) / 2) * 0.92, 0.2 + y * 0.36, j * 0.58); b.rotation.y = (R() - 0.5) * 0.2; pile.add(b); } pile.position.set(-1.35, 0, 2.15); pile.rotation.y = 0.75; }
const PILE_TOP = V3(-1.25, 0.95, 2.05);
// ---------------------------------------------------------------- stage set (podium shots)
const STG = V3(0, 0, 80);
const stage = new THREE.Group(); stage.position.copy(STG); scene.add(stage);
{ const plat = mesh(new THREE.BoxGeometry(10, 0.6, 6), M(0x3a2a22, { roughness: 0.6 })); plat.position.y = 0.3; stage.add(plat);
  const ledTex = canvasTex(512, 1024, (c) => { const gr = c.createLinearGradient(0, 0, 512, 1024); gr.addColorStop(0, '#b0164f'); gr.addColorStop(1, '#7a0f3a'); c.fillStyle = gr; c.fillRect(0, 0, 512, 1024); c.strokeStyle = 'rgba(255,220,235,0.55)'; c.lineWidth = 10; const r = rng(2); for (let y = 30; y < 1024; y += 90) for (let x = 20; x < 512; x += 120) { c.strokeRect(x, y, 60 + r() * 30, 40); c.beginPath(); c.moveTo(x + 90, y); c.lineTo(x + 90, y + 60); c.stroke(); } for (let i = 0; i < 4000; i++) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect((i * 37) % 512, Math.floor(i * 37 / 512) * 4 % 1024, 2, 2); } });
  ledTex.wrapS = ledTex.wrapT = THREE.ClampToEdgeWrapping; ledTex.repeat.set(1, 1);
  const led = mesh(new THREE.PlaneGeometry(6, 9), new THREE.MeshStandardMaterial({ map: ledTex, emissiveMap: ledTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.4 }), false, false); led.position.set(0, 4.8, -1.8); stage.add(led);
  const pod = mesh(new RoundedBoxGeometry(1.1, 1.15, 0.6, 3, 0.03), new THREE.MeshPhysicalMaterial({ map: canvasTex(256, 256, (g, w, h) => noiseCanvas(g, w, h, [96, 58, 38], [30, 20, 14], 6), 1), roughness: 0.4, clearcoat: 0.6 })); pod.position.set(0, 0.6 + 0.575, 0.6); stage.add(pod);
  const top = mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), M(0x5a3a28, { roughness: 0.4 })); top.position.set(0, 1.78, 0.55); top.rotation.x = 0.15; stage.add(top);
  const mic = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V3(-0.2, 1.8, 0.4), V3(-0.15, 2.1, 0.3), V3(-0.05, 2.15, 0.12)), 20, 0.006, 6), M(0x111111)); stage.add(mic); const mh = mesh(new THREE.CapsuleGeometry(0.012, 0.03, 4, 8), M(0x111111)); mh.position.set(-0.05, 2.15, 0.12); mh.rotation.x = 1.2; stage.add(mh); const red = mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); red.position.set(-0.05, 2.165, 0.135); stage.add(red);
  const key = new THREE.SpotLight(0xfff0e0, 60, 20, 0.5, 0.5); key.position.set(2, 5, 6); key.target.position.set(0, 2.2, 0); stage.add(key); stage.add(key.target); }

// ---------------------------------------------------------------- story state
const PATH = [V3(-10.2, 0, 4.6), V3(-8, 0, 3.0), V3(-4.5, 0, 1.4), V3(-1.0, 0, 0.7), V3(0.6, 0, 0.5)];
const pathC = new THREE.CatmullRomCurve3(PATH);
function placeStory(t) {
  // helicopter descends and lands, rotor slows a little after landing
  const app = eio(st(0, 5.5, t)); const desc = st(5.5, 7.6, t); const bump = Math.max(0, Math.sin(st(7.6, 8.4, t) * Math.PI * 2)) * 0.35 * (1 - st(7.6, 8.4, t));
  heli.position.set(lerp(36, HELI_POS.x, app), lerp(16, 9, app) - (9 - 0.95) * eo(desc) + bump, lerp(-10, HELI_POS.z, app));
  heli.rotation.set(Math.sin(t * 3.1) * 0.08 * (1 - st(7.6, 8.2, t)), 0.5 + (1 - app) * 0.9, (Math.sin(t * 2.3) * 0.12 + 0.15) * (1 - st(7.4, 8.0, t)));
  rotor.rotation.y = t * 28; tailRotor.rotation.z = t * 60; heli.userData.door.rotation.y = -1.6 * eo(st(T.step - 0.3, T.step + 0.4, t));
  dust.forEach((d, i) => { const g = cl((1 - Math.abs(heli.position.y - 1) / 9)) * (1 + 1.5 * st(7.6, 8.0, t) * (1 - st(9.5, 11, t))); const ph = (t * d.sp * 0.4 + i / dust.length) % 1; d.s.position.set(HELI_POS.x + Math.cos(d.a) * (d.r + ph * 5), 0.3 + ph * 1.5, HELI_POS.z + Math.sin(d.a) * (d.r + ph * 5)); const sz = 2 + ph * 5; d.s.scale.set(sz, sz, 1); d.s.material.opacity = Math.min(0.9, 0.45 * g * Math.sin(ph * Math.PI)) * (1 - st(T.girl, T.truth, t)); const big = st(7.6, 8.2, t) * (1 - st(9.8, 11.2, t)); if (big > 0) { d.s.position.x += (7 + ph * 9) * big * Math.cos(d.a) * 0.5 + 6 * big; d.s.scale.multiplyScalar(1 + big * 1.5); } });
  // crowd idle
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  crowdP.forEach((c, i) => { if (!c) { m4.makeScale(0, 0, 0); cBody.setMatrixAt(i, m4); cHead.setMatrixAt(i, m4); cHair.setMatrixAt(i, m4); return; } const excite = t > T.love - 1 ? 1 : 0.3; const b = Math.abs(Math.sin(t * 3 + c.ph)) * 0.03 * excite; m4.compose(V3(c.x, 0.58 * c.h + b, c.z), q.identity(), V3(1, c.h, 1)); cBody.setMatrixAt(i, m4); m4.compose(V3(c.x, 1.26 * c.h + b, c.z + 0.02), q, V3(1, 1, 1)); cHead.setMatrixAt(i, m4); m4.compose(V3(c.x, 1.29 * c.h + b, c.z), q, V3(1, 1, 1)); cHair.setMatrixAt(i, m4); });
  [cBody, cHead, cHair].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  // barricade panel the girl pushes through
  barriers.forEach((b, i) => { const k = i - 5; const t0 = T.barr + 1.5 + Math.abs(k) * 0.18; const f = k >= -3 ? eo(st(t0, t0 + 0.35, t)) : 0; b.rotation.set(Math.PI / 2 * 0.97 * f, 0, 0); b.position.y = 0.02 * f; });
  // --- speaker (CM)
  let cmPos = V3(-10.2, 0.0, 4.6), cmRy = 2.2, cmP = {};
  if (t < T.step + 1.2) { cmPos.set(HELI_POS.x + 0.6 + eo(st(T.step - 0.2, T.step + 0.6, t)) * 0.9, 0, HELI_POS.z + 1.1); cm.visible = t > T.step - 0.3; cmRy = 1.0; const w = st(T.step + 0.4, T.step + 0.8, t); cmP = { aR: [lerp(0.05, 2.8, w), lerp(0.08, 0.3, w), 0], eR: 0.2 + Math.sin(t * 9) * 0.25 * w, aL: [0.1, 0.5 * w, 0], eL: 1.6 * w, hx: -0.1 * w, hz: 0.1 * w }; }
  else if (t < T.girl) { const u = eio(st(T.step + 1.2, T.girl + 4, t)); const p = pathC.getPointAt(u * 0.5); cmPos.copy(p); cmRy = Math.atan2(pathC.getTangentAt(u * 0.5).x, pathC.getTangentAt(u * 0.5).z); const ph = Math.sin(t * 6.5) * 0.35; cmP = { lL: ph, lR: -ph, kL: Math.max(0, -ph) * 0.6, kR: Math.max(0, ph) * 0.6, aL: [-ph * 0.4, 0.1, 0], aR: [ph * 0.4, 0.1, 0], bob: Math.abs(Math.cos(t * 6.5)) * 0.012, hy: -0.2 }; cm.visible = true; }
  else { cmPos.copy(pathC.getPointAt(0.5)); cmRy = 1.3; cm.visible = t > T.barr - 0.5; }
  if (t >= T.barr && t < T.love - 0.6) { const u = eio(st(T.barr, T.love - 0.6, t)); cmPos.copy(pathC.getPointAt(lerp(0.5, 1, u))); const ph = Math.sin(t * 6.5) * 0.3 * (u < 1 ? 1 : 0); cmRy = Math.atan2(1.1 - cmPos.x, -0.6 - cmPos.z) * 0 + 0.9; cmP = { lL: ph, lR: -ph, kL: Math.max(0, -ph) * 0.6, kR: Math.max(0, ph) * 0.6, aL: [-ph * 0.4, 0.1, 0], aR: [ph * 0.4, 0.1, 0], bob: Math.abs(Math.cos(t * 6.5)) * 0.012 * (u < 1 ? 1 : 0) }; cm.visible = true; }
  // meeting the girl: CM at (0.6, 0.5) facing the girl at (1.3, -0.25)
  const gPos = V3(1.3, 0, -0.25);
  if (t >= T.love - 0.6) { cmPos.set(0.55, 0, 0.45); cmRy = Math.atan2(gPos.x - 0.55, gPos.z - 0.45); cm.visible = true;
    const lv = st(T.love - 0.3, T.love + 0.5, t) * (1 - st(T.ask - 0.1, T.ask + 0.4, t));
    cmP = { aR: [lerp(0.05, 1.5, lv), lerp(0.08, -0.1, lv), 0], eR: lerp(0.15, 0.7, lv), aL: [lerp(0.05, 0.6, lv), 0.15, 0], eL: lerp(0.15, 0.9, lv), hx: 0.12, hz: 0.08 * lv, lean: 0.05 };
    if (t >= T.ask - 0.1 && t < T.answer) { const a = st(T.ask - 0.1, T.ask + 0.5, t); cmP = { aL: [lerp(0.6, 0.9, a), 0.2, 0], eL: lerp(0.9, 1.4, a), aR: [lerp(1.5, 0.8, a), 0.05, 0], eR: 1.2, hx: lerp(0.12, 0.45, a), lean: 0.1 * a }; }
    if (t >= T.answer) { cmP = { aL: [0.3, 0.15, 0], eL: 1.0, aR: [0.5, 0.0, 0], eR: 1.3, hx: 0.18, hy: 0, lean: 0.03 }; }
    if (t >= T.auto + 0.3 && t < T.meet + 0.4) { const w = Math.sin(t * 9) * 0.06; cmP = { aR: [0.95 + w, -0.25, 0.2], eR: 1.25 + w, wR: -0.4, aL: [0.75, -0.1, 0], eL: 1.4, hx: 0.42, lean: 0.12 }; }
    if (t >= T.meet + 0.4) { const h = st(T.meet + 0.4, T.meet + 1.2, t); cmP = { aR: [lerp(0.95, 1.2, h), lerp(-0.25, -0.6, h), 0.3], eR: lerp(1.25, 0.9, h), aL: [0.5, 0.3, 0], eL: 0.6, hx: 0.1, hz: 0.1 * h, lean: 0.06 }; }
  }
  cm.position.copy(cmPos); cm.rotation.y = cmRy; pose(cm, cmP, t);
  // --- girl
  let gp = V3(1.1, 0, -3.65), gRy = 0, gP = { aR: [0.35, 0.05, 0], eR: 1.45, aL: [0.1, 0.1, 0], hx: -0.05, hy: -0.4 };
  if (t < T.girl) { gp.set(1.1, 0, -3.65); gP.hy = -0.5 + Math.sin(t) * 0.1; }
  if (t >= T.girl && t < T.barr) { gP = { aR: [0.4 + Math.sin(t * 3) * 0.05, 0.05, 0], eR: 1.5, aL: [0.25, 0.1, 0], eL: 0.4, hx: -0.08, hy: -0.35 + Math.sin(t * 0.8) * 0.2, bob: Math.abs(Math.sin(t * 4)) * 0.01 }; }
  if (t >= T.barr && t < T.hands) { const stuck = st(T.barr + 0.2, T.barr + 0.5, t) * (1 - st(T.barr + 1.35, T.barr + 1.5, t)); girl.scale.set(1 - stuck * 0.28 + Math.sin(t * 40) * 0.02 * stuck, 1 + stuck * 0.08, 1); const u0 = st(T.barr, T.hands - 0.3, t); const u = u0 < 0.12 ? u0 : (t < T.barr + 1.45 ? 0.12 : lerp(0.12, 1, eo(st(T.barr + 1.45, T.barr + 2.4, t)))); const squeeze = st(T.barr + 0.4, T.barr + 1.8, t); gp.set(lerp(1.1, 1.3, u), 0, lerp(-3.65, -0.25, eio(u))); gRy = 0.1; const ph = Math.sin(t * 8) * 0.4 * (u > 0.35 && u < 0.98 ? 1 : 0); gP = { aL: [lerp(0.3, 1.4, squeeze), lerp(0.1, 0.5, squeeze), 0], eL: 0.3, aR: [lerp(0.9, 1.3, squeeze), 0.4, 0], eR: 0.5, lean: 0.35 * squeeze * (1 - st(T.barr + 2.2, T.barr + 2.8, t)), lL: ph, lR: -ph, kL: Math.max(0, -ph) * 0.7, kR: Math.max(0, ph) * 0.7, hx: 0.1, bob: Math.abs(Math.cos(t * 8)) * 0.015 * (ph ? 1 : 0) }; }
  if (t >= T.hands) { gp.copy(gPos); gRy = Math.atan2(0.55 - gPos.x, 0.45 - gPos.z);
    const trem = (Math.sin(t * 31) * 0.07 + Math.sin(t * 23) * 0.04) * (t < T.love ? 1 : 0.4);
    gP = { aR: [0.5, -0.12, 0.1], eR: 1.35 + trem, wR: trem * 2, aL: [0.5, -0.18, 0], eL: 1.35 + trem, wL: -0.3 + trem, hx: 0.3, bob: trem * 0.05 };
    if (t >= T.love - 0.3) { gP.hx = lerp(0.25, -0.15, st(T.love - 0.3, T.love + 0.4, t)); }
    if (t >= T.answer) { const talk = env(t); gP = { aR: [0.45, -0.1, 0.1], eR: 1.4 + trem * 0.6, aL: [0.45, -0.15, 0], eL: 1.35, hx: -0.18, hz: Math.sin(t * 2) * 0.05, mouth: talk * 0.6, bob: 0 }; }
    if (t >= T.auto) { const hold = st(T.auto, T.auto + 0.5, t); gP.aL = [lerp(0.45, 0.75, hold), -0.25, 0]; gP.eL = lerp(1.35, 0.9, hold); gP.wL = lerp(-0.3, -1.0, hold); }
    if (t >= T.meet + 0.4) { gP.mouth = 0; gP.hx = -0.1; gP.hz = 0.12; }
  }
  if (t >= T.answer && t < T.meet + 0.2) {} else if (t >= T.meet + 0.2) {}
  if (!(t >= T.barr && t < T.hands)) girl.scale.set(1, 1, 1);
  girl.position.copy(gp); girl.rotation.y = gRy; pose(girl, gP, t);
  // CM speaks on stage
  // wounds appear once she is through the barricade
  const hurt = t > T.hands - 0.6; girlHandMeshes.forEach((m) => { m.material = hurt ? woundM : girl.userData.P.skin; });
  // blood drops falling from the hands
  drops.forEach((d, i) => { const hand = girl.userData.P.arms[i % 2].hand; const hp = hand.getWorldPosition(new THREE.Vector3()); const ph = ((t * 0.7 + i * 0.37) % 1); d.visible = t > T.blood - 0.3 && t < T.phone; d.position.set(hp.x + (i - 3) * 0.006, hp.y - 0.09 - ph * ph * 0.6, hp.z + 0.01); });
  diary.visible = t > T.auto - 0.2; phoneG.visible = t < T.auto + 0.4 || true;
  drawSig(st(T.auto + 0.5, T.meet + 0.3, t));
}
function placeEnding(t) {
  // guard: idle near the barricade, then chases the girl
  const gPath = new THREE.CatmullRomCurve3([V3(1.3, 0, -0.25), V3(2.8, 0, 0.7), V3(6, 0, 2.2), V3(12, 0, 3.4), V3(24, 0, 5)]);
  if (t < E.guard) { guard.position.set(3.6, 0, -2.3); guard.rotation.y = Math.PI + 0.3 + Math.sin(t * 0.4) * 0.2; pose(guard, { aL: [0.1, 0.1, 0], aR: [0.1, 0.1, 0], hy: Math.sin(t * 0.5) * 0.3, hx: t > E.shove ? -0.2 : 0, mouth: t > E.shove ? 0.8 : 0 }, t); }
  else { const u = st(E.guard + 0.3, DUR + 3, t) * 0.92; const pp = gPath.getPointAt(Math.min(1, u)); const start = V3(3.6, 0, -2.3); const k = st(E.guard, E.guard + 0.8, t); guard.position.copy(start.clone().lerp(pp, k)); const tg = gPath.getTangentAt(Math.min(1, u)); guard.rotation.y = Math.atan2(tg.x, tg.z); const ph = Math.sin(t * 15) * 0.8; pose(guard, { lL: ph, lR: -ph, kL: Math.max(0, -ph), kR: Math.max(0, ph), aL: [-ph * 0.8, 0.1, 0], aR: [2.6, 0.2, 0], eR: 0.3 + Math.sin(t * 15) * 0.3, lean: 0.25, bob: Math.abs(Math.cos(t * 15)) * 0.05, mouth: 0.9, hx: -0.15 }, t); }
  grain.visible = t > E.land - 0.05;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < GRAIN; i++) { const a = t - E.land; const v = grainV[i]; if (a < 0) { m4.makeScale(0, 0, 0); } else { const tt = Math.min(a, 1.4); m4.compose(V3(PILE_TOP.x + v[0] * tt, Math.max(0.01, PILE_TOP.y + v[1] * tt - 4.9 * tt * tt), PILE_TOP.z + v[2] * tt), q, V3(1, 1, 1)); } grain.setMatrixAt(i, m4); }
  grain.instanceMatrix.needsUpdate = true;
  if (t < E.squeal) return;
  const gPos = V3(1.3, 0, -0.25), cPos = V3(0.55, 0, 0.45);
  // --- girl: squeal + jump, shove, run away with the diary held high
  let gp = gPos.clone(), gry = Math.atan2(cPos.x - gPos.x, cPos.z - gPos.z), gP;
  if (t < E.shove - 0.2) { const j = Math.abs(Math.sin(st(E.squeal, E.shove - 0.2, t) * Math.PI * 3)); gp.y = j * 0.22; gP = { aL: [2.7, 0.3, 0], eL: 0.15, wL: -0.2, aR: [2.5, -0.3, 0], eR: 0.3, hx: -0.25, mouth: 0.9, kL: j * 0.8, kR: j * 0.8, lL: -j * 0.3, lR: -j * 0.3 }; }
  else if (t < E.run + 0.4) { const th = eo(st(E.shove - 0.2, E.shove + 0.15, t)); gP = { aR: [1.5, -0.15, 0], eR: lerp(1.4, 0.05, th), aL: [2.6, 0.3, 0], eL: 0.2, lean: 0.35 * th, hx: 0.1, mouth: 0.6, lL: -0.3 * th, kR: 0.3 }; }
  else { const u = st(E.run + 0.4, DUR + 2, t); const pp = gPath.getPointAt(Math.min(1, u * 1.05)); gp.copy(pp); const tg = gPath.getTangentAt(Math.min(1, u)); gry = Math.atan2(tg.x, tg.z); const ph = Math.sin(t * 17) * 0.9; gP = { lL: ph, lR: -ph, kL: Math.max(0, -ph) * 1.1, kR: Math.max(0, ph) * 1.1, aL: [2.8, 0.2, 0], eL: 0.1, aR: [-ph * 0.9, 0.15, 0], eR: 0.8, lean: 0.28, bob: Math.abs(Math.cos(t * 17)) * 0.07, mouth: 0.7, hx: -0.1 }; }
  girl.scale.set(1, 1, 1); girl.position.copy(gp); girl.rotation.y = gry; pose(girl, gP, t);
  // --- speaker: shoved backwards into the sacks, then sits up dizzy
  const fl = st(E.shove, E.land, t);
  let cp = cPos.clone(), rx = 0, cP = { aR: [0.5, 0, 0], eR: 1.2, aL: [0.4, 0.1, 0], eL: 1.0, hx: 0.15, mouth: 0.2 };
  if (t < E.shove) { cP = { aR: [0.4, 0.1, 0], eR: 0.6, aL: [0.3, 0.1, 0], eL: 0.4, hx: 0.1, mouth: 0.25 }; }
  else if (fl < 1) { cp.lerpVectors(cPos, PILE_TOP.clone().add(V3(0.1, -0.55, 0)), eo(fl)); cp.y += Math.sin(fl * Math.PI) * 0.6; rx = -1.25 * eo(fl); const w = t * 22; cP = { aR: [Math.sin(w) * 2 + 1, 0.6, 0], eR: 0.3, aL: [Math.cos(w) * 2 + 1, 0.6, 0], eL: 0.3, lL: -0.6 * fl, lR: -0.2 * fl, hx: -0.4, mouth: 1 }; }
  else { cp.copy(PILE_TOP).add(V3(0.1, -0.55, 0)); const sit = eo(st(E.sit, E.sit + 1.2, t)); rx = lerp(-1.25, -0.35, sit); const legs = 1 - st(E.land, E.land + 0.8, t) * 0.5; cP = { lL: lerp(-1.4, -0.9, sit) * legs, lR: lerp(-1.1, -0.9, sit) * legs, kL: 0.3 * sit, kR: 0.4 * sit, aL: [lerp(2.5, 0.2, st(E.land, E.land + 0.6, t)), 0.9, 0], eL: 0.3, aR: [lerp(2.2, 0.6, st(E.land, E.land + 0.6, t)), 0.9, 0], eR: 0.5 + sit * 0.8, hz: Math.sin(t * 6) * 0.2 * sit, hy: Math.sin(t * 4) * 0.3 * sit, hx: 0.1, mouth: 0.5 + Math.sin(t * 5) * 0.2, blink: (t > E.sit && Math.floor(t * 2.5) % 3 === 0) ? 1 : 0 }; }
  cm.visible = true; cm.position.copy(cp); cm.rotation.set(rx, Math.atan2(gPos.x - cPos.x, gPos.z - cPos.z), 0, 'YXZ'); pose(cm, cP, t);
  diary.visible = true; drawSig(1);
}
// stage: CM at the podium (separate copy of the look is the same character moved for these shots)
function placeStage(t) {
  if (!(t >= T.truth - 0.1 && t < T.barr)) return false;
  cm.visible = true; cm.position.copy(STG).add(V3(0, 0.6, 0)); cm.rotation.y = 0;
  const g = Math.sin(t * 2.3), talk = env(t);
  const handUp = st(T.truth + 1.0, T.truth + 1.5, t) * (1 - st(T.truth + 2.6, T.truth + 3.0, t));
  pose(cm, { aR: [lerp(0.4, 1.2, handUp), lerp(0.15, -0.3, handUp), 0], eR: lerp(1.0, 1.9, handUp), aL: [0.5 + g * 0.15, 0.25, 0], eL: 1.2 + g * 0.2, wL: g * 0.3, hx: -0.04 + Math.sin(t * 1.3) * 0.04, hy: Math.sin(t * 0.7) * 0.15, hz: Math.sin(t * 1.1) * 0.03, mouth: talk * 0.65, lean: -0.02 }, t);
  return true;
}

// ---------------------------------------------------------------- camera
function headW(h) { return h.userData.P.head.getWorldPosition(new THREE.Vector3()).add(V3(0, 0.1, 0)); }
function handW(h, i) { return h.userData.P.arms[i].hand.getWorldPosition(new THREE.Vector3()); }
let SHOTS = [
  [-1, 5.2, (u) => ({ p: V3(lerp(14, 2, eio(u)), lerp(9, 6, u), lerp(24, 20, eio(u))), g: heli.position.clone(), f: 34 })],
  [5.2, 8.7, (u) => ({ p: V3(lerp(-2.5, -3.5, u), 1.5, lerp(9.5, 9.0, u)), g: heli.position.clone().add(V3(0, 0.5, 0)), f: 36 })],
  [8.7, T.girl, (u) => ({ p: V3(lerp(-5.6, -6.2, u), 1.5, lerp(9.6, 8.6, u)), g: V3(-9.6, 1.4, 4.8), f: 32 })],
  [T.girl, T.truth - 0.1, (u) => ({ p: V3(lerp(4.5, 2.4, eio(u)), lerp(1.8, 1.55, u), lerp(2.2, -0.9, eio(u))), g: V3(1.1, 1.45, -3.6), f: lerp(38, 30, u) })],
  [T.truth - 0.1, T.barr, (u) => ({ p: STG.clone().add(V3(lerp(0.55, 0.35, u), lerp(2.15, 2.1, u), lerp(2.1, 1.8, u))), g: STG.clone().add(V3(0, 2.15, 0)), f: 30 })],
  [T.barr, T.hands - 0.1, (u, t) => { const g = girl.position.clone(); return { p: V3(lerp(3.2, 3.6, u), 0.9, lerp(-1.0, 1.5, u)), g: g.clone().add(V3(0, 1.0, 0)), f: 40 }; }],
  [T.hands - 0.1, T.phone, (u, t) => { const h = handW(girl, 1).lerp(handW(girl, 0), 0.5); return { p: h.clone().add(V3(lerp(0.75, 0.6, u), lerp(0.25, 0.15, u), lerp(0.8, 0.65, u))), g: h.clone().add(V3(0, -0.05, 0)), f: 34 }; }],
  [T.phone, T.love - 0.6, (u, t) => { const h = handW(girl, 1); return { p: h.clone().add(V3(0.55, 0.2, 0.5)), g: h.clone().add(V3(0, -0.05, 0)), f: 32 }; }],
  [T.love - 0.6, T.ask - 0.1, (u) => ({ p: V3(lerp(3.6, 3.2, u), 1.6, lerp(2.6, 2.2, u)), g: V3(0.9, 1.35, 0.1), f: 34 })],
  [T.ask - 0.1, T.answer, (u) => { const g = headW(girl); return { p: g.clone().add(V3(-1.1, 0.15, 1.5)), g: headW(girl).lerp(headW(cm), 0.5).add(V3(0, -0.15, 0)), f: 34 }; }],
  [T.answer, T.auto, (u) => { const g = headW(girl); return { p: g.clone().add(V3(lerp(-0.7, -0.6, u), 0.03, lerp(1.0, 0.85, u))), g: g.clone().add(V3(0, -0.06, 0)), f: 30 }; }],
  [T.auto, T.meet, (u) => { const d = diary.getWorldPosition(new THREE.Vector3()); return { p: d.clone().add(V3(0.45, 0.55, 0.85)), g: d.clone().add(V3(-0.1, 0.1, 0)), f: 34 }; }],
  [T.meet, E.squeal, (u) => ({ p: V3(lerp(3.2, 3.0, u), 1.55, lerp(2.6, 2.3, u)), g: V3(0.9, 1.35, 0.1), f: 30 })],
  [E.squeal, E.shove - 0.2, (u) => { const g = headW(girl); return { p: V3(g.x - 0.6, 1.45, g.z + 1.7), g: g.clone().add(V3(0, -0.15, 0)), f: 30 }; }],
  [E.shove - 0.2, E.run + 1.2, (u) => ({ p: V3(lerp(4.6, 4.2, u), 1.3, lerp(4.2, 4.6, u)), g: V3(-0.2, 0.9, 1.0), f: 34 })],
  [E.run + 1.2, E.sit - 0.2, (u, t) => { const g = girl.position.clone(); return { p: g.clone().add(V3(-2.6, 1.0, 3.2)), g: g.clone().add(V3(0.6, 1.0, 0)), f: 34 }; }],
  [E.sit - 0.2, E.wide, (u) => ({ p: V3(lerp(0.9, 0.7, u), 1.2, lerp(3.9, 3.6, u)), g: PILE_TOP.clone().add(V3(0.1, 0.3, 0)), f: 30 })],
  [E.wide, DUR + 1, (u, t) => { const e = eio(st(E.wide, DUR, t)); return { p: V3(lerp(2, -2, e), lerp(2.2, 7, e), lerp(7.5, 13, e)), g: V3(lerp(1, 4, e), lerp(1, 1.5, e), 1.5), f: 38 }; }],
];
function placeCamera(t) { const s = SHOTS.find((x) => t >= x[0] && t < x[1]) || SHOTS[SHOTS.length - 1]; const u = cl((t - Math.max(0, s[0])) / (s[1] - Math.max(0, s[0]))); const c = s[2](u, t); camera.position.copy(c.p).add(V3(Math.sin(t * 0.9) * 0.012, Math.sin(t * 1.2) * 0.01, 0)); camera.fov = c.f; camera.updateProjectionMatrix(); camera.lookAt(c.g); }
function overlay(t) {
  const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.4)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const fade = Math.max(1 - st(0, 0.4, t), st(DUR - 0.7, DUR, t)); if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}
window.renderFrame = (t, q = 0.92) => {
  cm.rotation.set(0, cm.rotation.y, 0, 'YXZ'); placeStory(t); placeEnding(t); const onStage = placeStage(t);
  scene.updateMatrixWorld(true); placeCamera(t);
  composer.render(); ctx.clearRect(0, 0, W, H); ctx.drawImage(glCanvas, 0, 0); overlay(t);
  return out.toDataURL('image/jpeg', q);
};
window.READY = true;

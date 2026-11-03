// "You Just Built a Car Wash" – realistic-style 3D CGI (three.js), no captions, no 2D graphics.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920;
const SEG = window.SEGMENTS || [];
const DUR = window.DUR || 64.5;
const cl = (x) => Math.min(1, Math.max(0, x));
const st = (a, b, t) => cl((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eo = (x) => 1 - Math.pow(1 - x, 3);
const ei = (x) => x * x * x;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(77);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- beats
const WORDS = SEG.flatMap((s) => s.words.map((w) => ({ w: w.w.toLowerCase().replace(/[^a-z0-9']/g, ''), s: w.s })));
function Wt(word, after = 0) { const ws = word.split('|'); const x = WORDS.find((q) => ws.includes(q.w) && q.s >= after); return x ? x.s : after + 1.2; }
const B = {};
B.filthy = Wt('filthy'); B.blast = Wt('blast'); B.sprinkler = Wt('sprinkler'); B.mud = Wt('mud');
B.tires = Wt('tires'); B.pour = Wt('pour'); B.slab = Wt('slab'); B.tilted = Wt('tilted'); B.drain = Wt('drain'); B.tank = Wt('tank'); B.lawn = Wt('lawn');
B.but1 = Wt('but', B.lawn); B.roof = Wt('roof', B.but1); B.doors = Wt('doors');
B.bend = Wt('bend'); B.arch = Wt('arch', B.bend); B.nozzles = Wt('nozzles'); B.rails = Wt('rails'); B.rolls = Wt('rolls');
B.now = Wt('now', B.rolls); B.everywhere = Wt('everywhere'); B.grease = Wt('grease');
B.soap = Wt('soap'); B.foams = Wt('foams'); B.loosens = Wt('loosens'); B.pump = Wt('pump'); B.pressure = Wt('pressure');
B.clean = Wt('clean', B.pressure); B.dries = Wt('dries'); B.spots = Wt('spots');
B.minerals = Wt('minerals'); B.evaporates = Wt('evaporates');
B.last = Wt('last', B.evaporates); B.reverse = Wt('reverse'); B.filter = Wt('filter'); B.strips = Wt('strips');
B.one = Wt('one', B.strips); B.final = Wt('final', B.one); B.blowers = Wt('blowers');
B.congrats = Wt('congratulations'); B.carwash = Wt('wash', B.congrats);
window.BEATS = B;
const T = B;

// ---------------------------------------------------------------- renderer
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc9dcef, 60, 220);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture; scene.environmentIntensity = 0.6;
const camera = new THREE.PerspectiveCamera(45, W / H, 0.03, 600);
const composer = new EffectComposer(renderer); composer.setSize(W, H); composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.12, 0.4, 0.95)); composer.addPass(new OutputPass());
const out = document.getElementById('out'); const ctx = out.getContext('2d');
function mesh(geo, m, cast = true, recv = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
function canvasTex(w, h, draw, rep = 1) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t; }
function noiseCanvas(g, w, h, base, vary, seed, speck = 0) { const r = rng(seed); const img = g.createImageData(w, h); const G = 64, grid = [...Array((G + 1) * (G + 1))].map(() => r()); const vn = (x, y) => { const xi = Math.floor(x) % G, yi = Math.floor(y) % G, xf = x - Math.floor(x), yf = y - Math.floor(y); const s = (q) => q * q * (3 - 2 * q); const i = (a, b) => grid[(b % G) * (G + 1) + (a % G)]; return (i(xi, yi) * (1 - s(xf)) + i(xi + 1, yi) * s(xf)) * (1 - s(yf)) + (i(xi, yi + 1) * (1 - s(xf)) + i(xi + 1, yi + 1) * s(xf)) * s(yf); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let f = 0, a = 0.5, fr = 4; for (let o = 0; o < 5; o++) { f += a * vn(x / w * fr, y / h * fr); a *= 0.5; fr *= 2; } const sp = speck && r() < speck ? (r() - 0.5) * 0.5 : 0; const k = (y * w + x) * 4; for (let c = 0; c < 3; c++) img.data[k + c] = Math.max(0, Math.min(255, (base[c] + (f - 0.5) * vary[c] + sp * 60))); img.data[k + 3] = 255; }
  g.putImageData(img, 0, 0); }

// ---------------------------------------------------------------- sky, sun
const sky = mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 vp; void main(){ float y = clamp(vp.y,0.,1.); vec3 c = mix(vec3(0.80,0.88,0.96), vec3(0.30,0.55,0.90), pow(y,0.55)); vec3 sd = normalize(vec3(0.5,0.55,0.4)); c += vec3(1.0,0.9,0.7)*pow(max(dot(vp,sd),0.),180.)*2.0 + vec3(1.,0.85,0.6)*pow(max(dot(vp,sd),0.),8.)*0.15; gl_FragColor = vec4(pow(c,vec3(2.2)),1.); }' }), false, false);
scene.add(sky);
const hemi = new THREE.HemisphereLight(0xd6e8ff, 0x51663a, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); sun.position.set(14, 16, 11); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3; scene.add(sun);

// ---------------------------------------------------------------- lawn, mud, slab
const grassTex = canvasTex(512, 512, (g, w, h) => noiseCanvas(g, w, h, [88, 128, 52], [60, 70, 40], 4, 0.25), 18);
const lawnM = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 });
lawnM.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix*vec4(transformed,1.)).xyz;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <map_fragment>', '#include <map_fragment>\nfloat stripe = step(0.5, fract(vW.x/3.0)); diffuseColor.rgb *= mix(0.88, 1.06, stripe);'); };
const lawn = mesh(new THREE.PlaneGeometry(260, 260), lawnM, false, true); lawn.rotation.x = -Math.PI / 2; scene.add(lawn);
// instanced grass blades near the set
{ const N = 26000; const g = new THREE.ConeGeometry(0.012, 0.16, 3); g.translate(0, 0.08, 0); const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x5f8f38, roughness: 0.9 }), N); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
  while (k < N) { const x = (R() - 0.5) * 24, z = (R() - 0.5) * 24; if (Math.abs(x) < 2.6 && Math.abs(z) < 4.2) continue; q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.5, R() * 6, (R() - 0.5) * 0.5)); const s = 0.6 + R() * 0.9; m4.compose(V3(x, 0, z), q, V3(s, s, s)); im.setMatrixAt(k++, m4); } im.receiveShadow = true; scene.add(im); }
const mudTex = canvasTex(512, 512, (g, w, h) => noiseCanvas(g, w, h, [92, 66, 42], [70, 50, 34], 9, 0.1), 3);
const mudM = new THREE.MeshStandardMaterial({ map: mudTex, roughness: 0.35, metalness: 0, transparent: true });
const mud = mesh(new THREE.CircleGeometry(4.2, 48), mudM, false, true); mud.rotation.x = -Math.PI / 2; mud.position.y = 0.012; scene.add(mud);
const mudPuddles = []; for (let i = 0; i < 8; i++) { const p = mesh(new THREE.CircleGeometry(0.3 + R() * 0.5, 24), new THREE.MeshStandardMaterial({ color: 0x3e2c1c, roughness: 0.05, metalness: 0.1, transparent: true }), false, true); p.rotation.x = -Math.PI / 2; p.position.set((R() - 0.5) * 5, 0.016, (R() - 0.5) * 7); scene.add(p); mudPuddles.push(p); }
const concTex = canvasTex(512, 512, (g, w, h) => noiseCanvas(g, w, h, [176, 172, 164], [40, 40, 40], 12, 0.4), 2);
const slabM = new THREE.MeshStandardMaterial({ map: concTex, roughness: 0.85, color: 0xffffff });
const slab = new THREE.Group(); scene.add(slab);
{ const s = mesh(new THREE.BoxGeometry(4.6, 0.25, 8.4), slabM, true, true); s.position.y = 0.125; slab.add(s); }
const grate = new THREE.Group(); slab.add(grate);
{ const fr = mesh(new THREE.BoxGeometry(4.2, 0.03, 0.36), new THREE.MeshStandardMaterial({ color: 0x2a2c2f, metalness: 0.8, roughness: 0.4 })); fr.position.set(0, 0.255, -3.9); grate.add(fr); for (let i = 0; i < 26; i++) { const b = mesh(new THREE.BoxGeometry(0.04, 0.035, 0.3), new THREE.MeshStandardMaterial({ color: 0x6a6e73, metalness: 0.9, roughness: 0.3 })); b.position.set(-2.0 + i * 0.16, 0.27, -3.9); grate.add(b); } }
// buried tank with cutaway trench (shown beside the slab)
const tankG = new THREE.Group(); scene.add(tankG);
{ const pit = mesh(new THREE.BoxGeometry(2.6, 1.6, 2.2), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1, side: THREE.BackSide })); pit.position.set(0, -0.8, -6.3); tankG.add(pit);
  const tank = mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.2, 32), new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.6 })); tank.rotation.z = Math.PI / 2; tank.position.set(0, -0.8, -6.3); tankG.add(tank);
  for (let i = -3; i <= 3; i++) { const rib = mesh(new THREE.TorusGeometry(0.76, 0.04, 8, 32), new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.5 })); rib.rotation.y = Math.PI / 2; rib.position.set(i * 0.3, -0.8, -6.3); tankG.add(rib); }
  const pipe = mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0, 16), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 })); pipe.rotation.x = Math.PI / 2; pipe.position.set(0, -0.15, -5.0); tankG.add(pipe); }
const trenchCover = mesh(new THREE.PlaneGeometry(2.64, 2.24), lawnM, false, true); trenchCover.rotation.x = -Math.PI / 2; trenchCover.position.set(0, 0.006, -6.3); scene.add(trenchCover);

// ---------------------------------------------------------------- house, fence, trees, props
const sidingTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e6dccb'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, y + 13, w, 3); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, y, w, 2); } }, 6);
{ const hs = new THREE.Group(); const body = mesh(new THREE.BoxGeometry(16, 6.5, 8), new THREE.MeshStandardMaterial({ map: sidingTex, roughness: 0.85 })); body.position.y = 3.25; hs.add(body);
  const roofTex = canvasTex(256, 256, (g, w, h) => { noiseCanvas(g, w, h, [128, 70, 52], [40, 30, 25], 21); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < h; y += 20) g.fillRect(0, y, w, 3); }, 5);
  const rg = new THREE.CylinderGeometry(0.01, 6.2, 3.2, 4, 1); rg.rotateY(Math.PI / 4); rg.scale(1.95, 1, 0.98); const roof = mesh(rg, new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.8 })); roof.position.y = 8.1; hs.add(roof);
  const winM = new THREE.MeshPhysicalMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.6 }); const trim = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }); const shut = new THREE.MeshStandardMaterial({ color: 0x2c4a6e, roughness: 0.7 });
  for (const y of [1.8, 4.6]) for (const x of [-6, -3.5, -1, 1.5, 4, 6.5]) { if (y < 3 && Math.abs(x - 1.5) < 0.1) continue; const w = mesh(new THREE.BoxGeometry(1.1, 1.4, 0.08), winM); w.position.set(x, y, 4.02); hs.add(w); const f = mesh(new THREE.BoxGeometry(1.25, 1.55, 0.06), trim); f.position.set(x, y, 4.0); hs.add(f); for (const s of [-1, 1]) { const sh2 = mesh(new THREE.BoxGeometry(0.4, 1.5, 0.05), shut); sh2.position.set(x + s * 0.85, y, 4.04); hs.add(sh2); } }
  const door = mesh(new THREE.BoxGeometry(1.5, 2.4, 0.1), new THREE.MeshPhysicalMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.5 })); door.position.set(1.5, 1.2, 4.03); hs.add(door);
  const deck = mesh(new THREE.BoxGeometry(7, 0.25, 2.5), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g) => { g.fillStyle = '#8a6a4a'; g.fillRect(0, 0, 256, 256); for (let x = 0; x < 256; x += 20) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 0, 2, 256); } }, 2), roughness: 0.8 })); deck.position.set(1, 0.12, 5.2); hs.add(deck);
  hs.position.set(0, 0, -19); scene.add(hs); }
{ const fm = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => noiseCanvas(g, w, h, [120, 90, 62], [30, 25, 20], 31), 2), roughness: 0.9 });
  for (const [x0, z0, x1, z1] of [[-22, -20, -22, 18], [22, -20, 22, 18], [-22, 18, -6, 18], [6, 18, 22, 18]]) { const len = Math.hypot(x1 - x0, z1 - z0); const n = Math.floor(len / 0.16); const g = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.9, 0.03), fm, n); const m4 = new THREE.Matrix4(); const ang = Math.atan2(x1 - x0, z1 - z0); for (let i = 0; i < n; i++) { const u = i / n; m4.makeRotationY(ang); m4.setPosition(lerp(x0, x1, u), 0.95 + (R() - 0.5) * 0.04, lerp(z0, z1, u)); g.setMatrixAt(i, m4); } g.castShadow = g.receiveShadow = true; scene.add(g); } }
const leafTexs = [1, 2, 3].map((s) => canvasTex(256, 256, (g) => { const r = rng(s * 13); for (let i = 0; i < 900; i++) { const x = 128 + (r() - 0.5) * 230 * Math.sqrt(r()), y = 128 + (r() - 0.5) * 230 * Math.sqrt(r()); const d = Math.hypot(x - 128, y - 128); if (d > 118) continue; g.fillStyle = `rgba(${40 + r() * 40 | 0},${80 + r() * 60 | 0},${30 + r() * 25 | 0},${0.8})`; g.beginPath(); g.ellipse(x, y, 4 + r() * 5, 2 + r() * 3, r() * 3, 0, 7); g.fill(); } }));
leafTexs.forEach((t) => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); });
function tree(x, z, s) { const g = new THREE.Group(); const tr = mesh(new THREE.CylinderGeometry(0.18 * s, 0.32 * s, 4 * s, 10), new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 1 })); tr.position.y = 2 * s; g.add(tr); for (let i = 0; i < 26; i++) { const m = new THREE.SpriteMaterial({ map: leafTexs[i % 3], color: 0xffffff, alphaTest: 0.35 }); const sp = new THREE.Sprite(m); const sz = (1.8 + R() * 1.6) * s; sp.scale.set(sz, sz, 1); sp.position.set((R() - 0.5) * 3.6 * s, (4 + R() * 3.2) * s, (R() - 0.5) * 3.6 * s); g.add(sp); } g.position.set(x, 0, z); scene.add(g); }
for (const [x, z, s] of [[-14, -12, 1.4], [15, -13, 1.5], [-17, 6, 1.2], [18, 4, 1.3], [-9, -16, 1.0], [10, -17, 1.1]]) tree(x, z, s);
// garden hose coil
{ const pts = []; for (let i = 0; i < 160; i++) { const a = i * 0.25; const r = 0.35 + 0.012 * (i % 26); pts.push(V3(-3.6 + Math.cos(a) * r, 0.04 + (i % 26) * 0.004, 3.2 + Math.sin(a) * r)); } const hose = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.022, 6), new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.5 })); scene.add(hose); }

// ---------------------------------------------------------------- car (sedan) with dirt/foam/wet/spots shader
const carU = { dirt: { value: 1 }, foam: { value: 0 }, wet: { value: 0 }, spots: { value: 0 }, sweep: { value: 99 }, sweepMode: { value: 0 } };
function carMaterial(base, opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: base, roughness: opts.rough ?? 0.25, metalness: opts.metal ?? 0.55, clearcoat: opts.clear ?? 1, clearcoatRoughness: 0.06, ...opts.extra });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, carU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vL;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix*vec4(transformed,1.)).xyz; vL = transformed;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float dirt; uniform float foam; uniform float wet; uniform float spots; uniform float sweep; uniform float sweepMode; varying vec3 vW; varying vec3 vL;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x), f.y), mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x), f.y), f.z); }
      float fb(vec3 p){ return n3(p)*0.5 + n3(p*2.1)*0.3 + n3(p*4.3)*0.2; }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float swept = sweepMode > 0.5 ? step(vW.z, sweep) : 0.;
      float dAmt = dirt * (1. - swept * (sweepMode > 1.5 ? 0. : 1.));
      float dm = smoothstep(0.55, 0.85, fb(vW*3.2) + (0.95 - vW.y)*0.75) * dAmt;
      float fm = foam * smoothstep(0.3, 0.6, fb(vW*7.) + 0.25) * (1. - (sweepMode > 1.5 ? swept : 0.));
      float sp = spots * step(0.93, n3(vW*140.)) * smoothstep(0.5, 1.0, n3(vW*9.)+0.4) * (sweepMode > 2.5 ? (1.-swept) : 1.);
      roughnessFactor = mix(roughnessFactor, 0.95, dm); roughnessFactor = mix(roughnessFactor, 0.05, wet*(1.-dm)); roughnessFactor = mix(roughnessFactor, 0.7, fm);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float swept2 = sweepMode > 0.5 ? step(vW.z, sweep) : 0.; float dA = dirt * (1. - swept2 * (sweepMode > 1.5 ? 0. : 1.));
        float d2 = smoothstep(0.55, 0.85, fb(vW*3.2) + (0.95 - vW.y)*0.75) * dA;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*0.75 + vec3(0.06,0.05,0.03), dA*0.6);
        vec3 mudc = mix(vec3(0.24,0.17,0.10), vec3(0.42,0.33,0.22), fb(vW*9.));
        diffuseColor.rgb = mix(diffuseColor.rgb, mudc, d2*0.92);
        float f2 = foam * smoothstep(0.3, 0.6, fb(vW*7.) + 0.25) * (1. - (sweepMode > 1.5 ? swept2 : 0.));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97,0.96,0.95), f2);
        float s2 = spots * step(0.93, n3(vW*140.)) * smoothstep(0.5, 1.0, n3(vW*9.)+0.4) * (sweepMode > 2.5 ? (1.-swept2) : 1.);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92,0.93,0.92), s2*0.85); }`);
  };
  return m;
}
const paintM = carMaterial(0x14408f, { rough: 0.22, metal: 0.6 });
const glassM = carMaterial(0x0c1218, { rough: 0.02, metal: 0.2, clear: 1, extra: { transparent: true, opacity: 0.82 } });
const trimM = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.45, metalness: 0.4 });
const chromeM = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.12, metalness: 1 });
const tireM = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.85 });
const rimM = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 1 });
const car = new THREE.Group(); scene.add(car);
function profileShape(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
{
  // lower body profile in (z, y): nose at +z
  const body = [[2.32, 0.34], [2.36, 0.55], [2.28, 0.74], [1.9, 0.86], [1.05, 0.98], [-1.45, 1.0], [-2.05, 0.98], [-2.32, 0.86], [-2.36, 0.55], [-2.28, 0.34]];
  const g = new THREE.ExtrudeGeometry(profileShape(body), { depth: 1.56, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 6, curveSegments: 12 });
  g.translate(0, 0, -0.78); g.rotateY(Math.PI / 2); // extrude along x
  const b = mesh(g, paintM); car.add(b);
  const cab = [[1.02, 0.98], [0.15, 1.42], [-0.95, 1.44], [-1.55, 1.0]];
  const cg = new THREE.ExtrudeGeometry(profileShape(cab), { depth: 1.28, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 5 });
  cg.translate(0, 0, -0.64); cg.rotateY(Math.PI / 2); car.add(mesh(cg, glassM));
  const rf = [[0.32, 1.38], [0.12, 1.47], [-0.9, 1.49], [-1.05, 1.41]];
  const rg = new THREE.ExtrudeGeometry(profileShape(rf), { depth: 1.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4 }); rg.translate(0, 0, -0.61); rg.rotateY(Math.PI / 2); car.add(mesh(rg, paintM));
  // pillars
  for (const s of [-1, 1]) { for (const [z0, y0, z1, y1] of [[1.0, 1.0, 0.18, 1.43], [-0.32, 1.0, -0.3, 1.45], [-1.5, 1.0, -0.95, 1.45]]) { const len = Math.hypot(z1 - z0, y1 - y0); const p = mesh(new THREE.BoxGeometry(0.06, len, 0.09), paintM); p.position.set(s * 0.71, (y0 + y1) / 2, (z0 + z1) / 2); p.rotation.x = -Math.atan2(z1 - z0, y1 - y0); car.add(p); } }
  // door seams, handles, mirrors
  for (const s of [-1, 1]) { for (const z of [0.95, -0.35, -1.5]) { const d = mesh(new THREE.BoxGeometry(0.01, 0.6, 0.012), trimM, false); d.position.set(s * 0.915, 0.66, z); car.add(d); } for (const z of [0.2, -1.0]) { const hd = mesh(new THREE.BoxGeometry(0.03, 0.035, 0.2), chromeM, false); hd.position.set(s * 0.925, 0.84, z); car.add(hd); }
    const mir = mesh(new RoundedBoxGeometry(0.22, 0.13, 0.12, 2, 0.04), paintM); mir.position.set(s * 0.98, 1.04, 0.85); car.add(mir); const sk = mesh(new THREE.BoxGeometry(0.02, 0.12, 4.2), trimM, false); sk.position.set(s * 0.92, 0.36, 0); car.add(sk); }
  // lights, grille, plates
  const headM = new THREE.MeshPhysicalMaterial({ color: 0xe8eef5, roughness: 0.05, metalness: 0.3, emissive: 0xf4f7ff, emissiveIntensity: 0.15 });
  const tailM = new THREE.MeshPhysicalMaterial({ color: 0x8a0c12, roughness: 0.1, emissive: 0x500006, emissiveIntensity: 0.3 });
  for (const s of [-1, 1]) { const h = mesh(new RoundedBoxGeometry(0.42, 0.14, 0.1, 2, 0.04), headM, false); h.position.set(s * 0.6, 0.73, 2.37); h.rotation.y = s * 0.25; car.add(h); const tl = mesh(new RoundedBoxGeometry(0.42, 0.13, 0.08, 2, 0.04), tailM, false); tl.position.set(s * 0.6, 0.82, -2.37); car.add(tl); }
  const gr = mesh(new RoundedBoxGeometry(0.75, 0.16, 0.06, 2, 0.03), trimM, false); gr.position.set(0, 0.6, 2.44); car.add(gr);
  for (const z of [2.45, -2.45]) { const p = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }), false); p.position.set(0, 0.47, z); car.add(p); }
  const under = mesh(new THREE.BoxGeometry(1.7, 0.12, 4.3), trimM, false); under.position.y = 0.33; car.add(under);
}
const wheels = [];
{ const prof = [[0.2, -0.11], [0.31, -0.115], [0.34, -0.09], [0.35, 0], [0.34, 0.09], [0.31, 0.115], [0.2, 0.11]].map(([r, y]) => new THREE.Vector2(r, y));
  for (const [x, z] of [[-0.82, 1.38], [0.82, 1.38], [-0.82, -1.4], [0.82, -1.4]]) {
    const w = new THREE.Group(); w.position.set(x, 0.35, z);
    const tg = new THREE.LatheGeometry(prof, 40); tg.rotateZ(Math.PI / 2); w.add(mesh(tg, tireM));
    const rim = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 32), rimM); rim.rotation.z = Math.PI / 2; w.add(rim);
    for (let k = 0; k < 5; k++) { const sp = mesh(new THREE.BoxGeometry(0.03, 0.38, 0.07), rimM); sp.position.x = Math.sign(x) * 0.105; sp.rotation.x = k * Math.PI * 2 / 5; w.add(sp); }
    const hub = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16), chromeM); hub.rotation.z = Math.PI / 2; w.add(hub);
    car.add(w); wheels.push(w);
  } }
const tireMud = wheels.map((w) => { const m = mesh(new THREE.TorusGeometry(0.33, 0.06, 8, 32), new THREE.MeshStandardMaterial({ color: 0x3f2c1b, roughness: 1 })); m.rotation.y = Math.PI / 2; w.add(m); return m; });

// ---------------------------------------------------------------- sprinkler frame, arch on rails, equipment
const woodM = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => noiseCanvas(g, w, h, [110, 82, 56], [40, 30, 22], 41), 1), roughness: 0.9 });
const sprinkler = new THREE.Group(); scene.add(sprinkler);
{ for (const z of [-2.8, 2.8]) { const p = mesh(new THREE.BoxGeometry(0.15, 3.0, 0.15), woodM); p.position.set(-1.9, 1.5, z); sprinkler.add(p); } const beam = mesh(new THREE.BoxGeometry(0.15, 0.15, 5.9), woodM); beam.position.set(-1.9, 3.0, 0); sprinkler.add(beam); const arm = mesh(new THREE.BoxGeometry(1.9, 0.12, 0.12), woodM); arm.position.set(-0.95, 3.0, 0); sprinkler.add(arm); const head = mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.15, 20), chromeM); head.position.set(0, 2.88, 0); sprinkler.add(head); }
const steelM = new THREE.MeshStandardMaterial({ color: 0xbfc5cc, roughness: 0.28, metalness: 1 });
const rails = [-1, 1].map((s) => { const r = mesh(new THREE.BoxGeometry(0.08, 0.08, 9.2), steelM); r.position.set(s * 2.1, 0.29, 0); scene.add(r); return r; });
const arch = new THREE.Group(); scene.add(arch);
const archPts = [V3(-2.1, 0.35, 0), V3(-2.1, 2.2, 0), V3(-1.8, 2.75, 0), V3(-1.0, 2.9, 0), V3(1.0, 2.9, 0), V3(1.8, 2.75, 0), V3(2.1, 2.2, 0), V3(2.1, 0.35, 0)];
const archCurve = new THREE.CatmullRomCurve3(archPts, false, 'catmullrom', 0.1);
arch.add(mesh(new THREE.TubeGeometry(archCurve, 120, 0.065, 16), steelM));
const nozzles = [];
for (let i = 1; i < 18; i++) { const u = i / 18; const p = archCurve.getPointAt(u); const tg = archCurve.getTangentAt(u); const n = V3(-tg.y, tg.x, 0).normalize(); const inward = V3(-p.x, 1.0 - p.y, 0).normalize(); const nz = mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.7, roughness: 0.3 })); nz.position.copy(p).addScaledVector(inward, 0.07); nz.quaternion.setFromUnitVectors(V3(0, 1, 0), inward); arch.add(nz); nozzles.push({ p: p.clone().addScaledVector(inward, 0.1), d: inward }); }
for (const s of [-1, 1]) { const tr = mesh(new THREE.BoxGeometry(0.3, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x33373d, metalness: 0.6, roughness: 0.4 })); tr.position.set(s * 2.1, 0.42, 0); arch.add(tr); for (const z of [-0.16, 0.16]) { const wh = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), steelM); wh.rotation.z = Math.PI / 2; wh.position.set(s * 2.1, 0.36, z); arch.add(wh); } }
// blower ducts on the arch
const blowers = new THREE.Group(); arch.add(blowers);
{ const bm = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.35 }); const top = mesh(new RoundedBoxGeometry(2.6, 0.35, 0.5, 3, 0.08), bm); top.position.set(0, 2.62, 0.35); blowers.add(top); for (const s of [-1, 1]) { const sd = mesh(new RoundedBoxGeometry(0.35, 1.5, 0.5, 3, 0.08), bm); sd.position.set(s * 1.72, 1.3, 0.35); blowers.add(sd); } const mot = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 24), new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.6, roughness: 0.4 })); mot.position.set(0, 3.1, 0.35); blowers.add(mot); }
// equipment table: soap tank, pump, RO filter
const equip = new THREE.Group(); equip.position.set(3.4, 0, 1.2); scene.add(equip);
const tableM = new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.9, roughness: 0.3 });
{ const top = mesh(new THREE.BoxGeometry(1.2, 0.05, 2.2), tableM); top.position.y = 0.9; equip.add(top); const shelf = mesh(new THREE.BoxGeometry(1.2, 0.04, 2.2), tableM); shelf.position.y = 0.3; equip.add(shelf); for (const [x, z] of [[-0.55, -1.05], [0.55, -1.05], [-0.55, 1.05], [0.55, 1.05]]) { const l = mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), tableM); l.position.set(x, 0.45, z); equip.add(l); } }
const soapTank = new THREE.Group(); equip.add(soapTank);
const soapLiquid = mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), new THREE.MeshPhysicalMaterial({ color: 0xd8731a, roughness: 0.1, transparent: true, opacity: 0.8, emissive: 0x401800, emissiveIntensity: 0.3 }));
{ const shell = mesh(new RoundedBoxGeometry(0.6, 0.8, 0.6, 3, 0.05), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25, metalness: 0 }), false); shell.position.y = 1.33; soapTank.add(shell); soapLiquid.position.y = 1.25; soapTank.add(soapLiquid); const cap = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x222222 })); cap.position.y = 1.77; soapTank.add(cap); soapTank.position.z = -0.6; }
const pump = new THREE.Group(); equip.add(pump);
{ const mot = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.45, 24), new THREE.MeshStandardMaterial({ color: 0x1d4f9a, metalness: 0.5, roughness: 0.35 })); mot.rotation.z = Math.PI / 2; mot.position.set(0, 1.1, 0.25); pump.add(mot); for (let i = 0; i < 8; i++) { const f = mesh(new THREE.TorusGeometry(0.175, 0.012, 6, 24), new THREE.MeshStandardMaterial({ color: 0x163f7c, metalness: 0.5 })); f.rotation.y = Math.PI / 2; f.position.set(-0.2 + i * 0.05, 1.1, 0.25); pump.add(f); } const hs = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.9, roughness: 0.25 })); hs.rotation.z = Math.PI / 2; hs.position.set(0.32, 1.1, 0.25); pump.add(hs); const gauge = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2 })); gauge.position.set(0.32, 1.3, 0.25); pump.add(gauge); }
const roUnit = new THREE.Group(); equip.add(roUnit);
const roMembrane = [];
{ const shell = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 32, 1, true, 0, Math.PI * 1.4), new THREE.MeshPhysicalMaterial({ color: 0xf5f5f5, roughness: 0.3, side: THREE.DoubleSide }), true); shell.rotation.z = Math.PI / 2; shell.position.set(0, 1.12, 0.85); roUnit.add(shell); for (let i = 0; i < 6; i++) { const m = mesh(new THREE.CylinderGeometry(0.14 - i * 0.02, 0.14 - i * 0.02, 1.0, 24, 1, true), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd9e8f5 : 0x9fbfd9, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), false); m.rotation.z = Math.PI / 2; m.position.set(0, 1.12, 0.85); roUnit.add(m); roMembrane.push(m); } for (const x of [-0.6, 0.6]) { const cap = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0x2c74c9, roughness: 0.4 })); cap.rotation.z = Math.PI / 2; cap.position.set(x, 1.12, 0.85); roUnit.add(cap); } }
// hoses from equipment to the arch (simple tubes)
const hoseM = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
const hoseToArch = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(3.1, 1.05, 1.45), V3(2.8, 0.4, 1.0), V3(2.4, 0.3, 0.2), V3(2.15, 0.5, 0)]), 40, 0.03, 8), hoseM); scene.add(hoseToArch);

// ---------------------------------------------------------------- water / foam / air particles
const waterM = new THREE.MeshPhysicalMaterial({ color: 0xbfd6ea, roughness: 0.0, metalness: 0.1, transparent: true, opacity: 0.4, envMapIntensity: 2.0 });
const DROPS = 2600; const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 6, 4), waterM, DROPS); drops.frustumCulled = false; scene.add(drops);
const dropSeeds = [...Array(DROPS)].map(() => [R(), R(), R(), R()]);
const mistTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }); mistTex.wrapS = mistTex.wrapT = THREE.ClampToEdgeWrapping;
const mists = []; for (let i = 0; i < 60; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s); mists.push(s); }
const foamM = new THREE.MeshStandardMaterial({ color: 0xfbfbf8, roughness: 0.6 });
const FOAM = 900; const foamBits = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.045, 1), foamM, FOAM); foamBits.frustumCulled = false; scene.add(foamBits);
const foamSeeds = [...Array(FOAM)].map(() => { const u = R(); return { z: (R() - 0.5) * 4.4, side: R() < 0.7 ? (R() < 0.5 ? -1 : 1) : 0, y: 0.4 + R() * 1.0, x: (R() - 0.5) * 1.2, s: 0.6 + R() * 1.4 }; });
// macro: a water bead on the hood leaving mineral spots
const bead = mesh(new THREE.SphereGeometry(0.03, 32, 16), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 0, transparent: true, opacity: 0.55, metalness: 0.1, envMapIntensity: 2 }), false); bead.scale.y = 0.45; scene.add(bead);
const mineralRing = mesh(new THREE.RingGeometry(0.022, 0.03, 40), new THREE.MeshStandardMaterial({ color: 0xe6e6e0, roughness: 0.9, transparent: true, opacity: 0 }), false); mineralRing.rotation.x = -Math.PI / 2; scene.add(mineralRing);
const MINS = 60; const minerals = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0018, 0), new THREE.MeshStandardMaterial({ color: 0xfafaf2, roughness: 0.8 }), MINS); scene.add(minerals);
const BEAD_POS = V3(0.15, 1.005, 1.55);

// ---------------------------------------------------------------- state over time
function archZ(t) {
  if (t < T.rails - 0.3) return 3.6;
  const passes = [[T.rails - 0.2, T.now + 0.2, 3.6, -3.6], [T.now + 0.2, T.grease, -3.6, 3.6], [T.foams - 0.5, T.loosens + 0.2, 3.6, -3.6], [T.pump, T.clean - 0.3, -3.6, 3.6], [T.one - 0.2, T.blowers - 0.1, 3.6, -3.6], [T.blowers, T.congrats, -3.6, 3.6]];
  let z = 3.6; for (const [a, b, z0, z1] of passes) { if (t >= a) z = lerp(z0, z1, eio(st(a, b, t))); } return z;
}
function sprayMode(t) { // 0 none, 1 sprinkler, 2 arch water, 3 foam, 4 high pressure, 5 RO rinse, 6 air
  if (t < T.pour - 0.2) return t > 0.0 ? 1 : 0;
  if (t > T.but1 - 0.1 && t < T.bend - 0.1) return 1;
  if (t > T.rails && t < T.grease + 0.2) return 2;
  if (t > T.foams - 0.5 && t < T.pump) return 3;
  if (t > T.pump && t < T.clean - 0.3) return 4;
  if (t > T.one - 0.2 && t < T.blowers - 0.1) return 5;
  if (t > T.blowers && t < T.congrats) return 6;
  return 0;
}
function placeWorld(t) {
  // mud & slab
  const mudGrow = eo(st(0.4, T.mud + 0.6, t)); const slabOn = t > T.slab - 0.15;
  mud.visible = !slabOn; mud.scale.setScalar(Math.max(0.01, mudGrow)); mudM.opacity = mudGrow;
  mudPuddles.forEach((p, i) => { p.visible = !slabOn; p.material.opacity = st(1 + i * 0.3, 2.5 + i * 0.3, t) * 0.85; });
  slab.visible = slabOn; const pourU = eo(st(T.slab - 0.15, T.slab + 0.7, t)); slab.scale.set(1, Math.max(0.01, pourU), 1); slab.rotation.x = -0.012 * st(T.tilted - 0.2, T.tilted + 0.4, t);
  const wetSlab = sprayMode(t) > 0 && slabOn ? 1 : st(T.dries, T.dries + 1, t) < 1 && t > T.rails ? 0.6 : 0.2; slabM.color.setScalar(lerp(1, 0.62, wetSlab)); slabM.roughness = lerp(0.85, 0.25, wetSlab);
  const trench = t > T.drain - 0.2 && t < T.but1 - 0.1; tankG.visible = trench; trenchCover.visible = !trench;
  // car sinks slightly into mud before the slab
  const sink = !slabOn ? 0.09 * mudGrow : 0;
  car.position.set(0, slabOn ? 0.25 : -sink, 0);
  tireMud.forEach((m) => { m.visible = t < T.soap + 2; m.material.opacity = 1; });
  // car surface state
  let dirt = 1, foam = 0, wet = 0, spots = 0, sweep = 99, mode = 0;
  const az = archZ(t);
  if (t > T.loosens && t < T.pump) { dirt = 1; foam = 1; }
  if (t >= T.foams - 0.5 && t < T.pump) { foam = 1; mode = 0; sweep = az; foam = cl(foam); }
  if (t >= T.foams - 0.5 && t < T.loosens + 0.3) { foam = 1; mode = 0; }
  if (t >= T.pump && t < T.clean - 0.3) { dirt = 1; foam = 1; mode = 2; sweep = az + 0.0; wet = 1; }
  if (t >= T.clean - 0.3) { dirt = 0; foam = 0; wet = 1 - st(T.dries - 0.3, T.spots, t); }
  if (t >= T.dries) spots = st(T.dries, T.spots + 0.4, t);
  if (t >= T.one - 0.2) { mode = 3; sweep = az; wet = 1; }
  if (t >= T.blowers) { spots = 0; mode = 0; wet = lerp(1, 0.2, st(T.blowers, T.congrats, t)); }
  if (t > T.rails && t < T.grease + 0.2) wet = 1;
  if (t < T.pour) wet = st(0.5, 2, t);
  carU.dirt.value = dirt; carU.foam.value = foam; carU.wet.value = wet; carU.spots.value = spots; carU.sweep.value = sweep; carU.sweepMode.value = mode;
  // structures
  sprinkler.visible = t < T.bend - 0.1;
  const archOn = t > T.bend - 0.2; arch.visible = archOn; arch.position.set(0, 0.0, az);
  const build = eo(st(T.bend - 0.2, T.arch + 0.4, t)); arch.scale.set(1, Math.max(0.01, build), 1);
  rails.forEach((r) => { r.visible = t > T.rails - 0.4; r.scale.z = Math.max(0.01, eo(st(T.rails - 0.4, T.rails + 0.4, t))); });
  nozzles.forEach(() => {});
  blowers.visible = t > T.blowers - 0.4; blowers.scale.setScalar(Math.max(0.01, eo(st(T.blowers - 0.4, T.blowers + 0.2, t))));
  equip.visible = t > T.soap - 0.3;
  soapTank.visible = t > T.soap - 0.3; soapLiquid.scale.y = Math.max(0.05, 1 - st(T.foams, T.pump, t) * 0.6); soapLiquid.position.y = 1.25 - (1 - soapLiquid.scale.y) * 0.3;
  pump.visible = t > T.pump - 0.3; pump.children[0].rotation.x = t * 40;
  roUnit.visible = t > T.reverse - 0.4;
  roMembrane.forEach((m, i) => { m.rotation.x = t * (0.4 + i * 0.1); });
  hoseToArch.visible = t > T.soap - 0.3; hoseToArch.position.z = az * 0.0;
}

function placeParticles(t) {
  const mode = sprayMode(t); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); const az = archZ(t);
  const life = 0.7;
  for (let i = 0; i < DROPS; i++) {
    const [a, b, c, d] = dropSeeds[i]; let pos = null, sc = 1, stretch = 1;
    const age = ((t + a * life) % life); const k = age / life;
    if (mode === 1) { // sprinkler: rotating jets from the head at (0, 2.88, 0)
      const ang = b * Math.PI * 2 + t * 4; const v = 2.2 + c * 1.6; const el = -0.3 - d * 0.9;
      const dir = V3(Math.cos(ang) * Math.cos(el), Math.sin(el), Math.sin(ang) * Math.cos(el));
      pos = V3(0, 2.85, 0).addScaledVector(dir, v * age); pos.y -= 4.9 * age * age; if (pos.y < car.position.y + 1.45 && Math.abs(pos.x) < 0.8 && Math.abs(pos.z) < 1.6) { pos.y = car.position.y + 1.48; sc = 1.5; }
      if (pos.y < 0.02) pos.y = 0.02; stretch = 3;
    } else if (mode >= 2 && mode <= 5) {
      const n = nozzles[Math.floor(b * nozzles.length)]; const spread = V3((c - 0.5) * 0.35, (d - 0.5) * 0.35, (a - 0.5) * 0.3);
      const v = mode === 4 ? 9 : mode === 3 ? 2.0 : 5; const dir = n.d.clone().add(spread).normalize();
      pos = n.p.clone().addScaledVector(dir, v * age * 0.6); pos.z += az; pos.y -= 4.9 * age * age;
      // stop at the car body (rough box)
      const cx = 0.95, ctop = car.position.y + (Math.abs(pos.z) < 1.0 ? 1.47 : 1.0);
      if (Math.abs(pos.x) < cx && pos.y < ctop && Math.abs(pos.z) < 2.4) { pos.x = Math.sign(pos.x || 1) * cx; sc = 1.3; }
      if (pos.y < 0.27) pos.y = 0.27;
      stretch = mode === 4 ? 5 : mode === 3 ? 1.6 : 3; if (mode === 3) sc = 2.2;
    } else if (mode === 6) { // blown droplets streaming off the body
      pos = V3((b - 0.5) * 2.0 + Math.sign(b - 0.5) * k * 1.6, car.position.y + 0.5 + c * 1.0 + k * 0.4, az + 0.4 + k * 2.2 + (d - 0.5) * 0.6); sc = 0.8; stretch = 2.5;
    }
    if (!pos) { m4.makeScale(0, 0, 0); } else { q.identity(); m4.compose(pos, q, V3(sc, sc * stretch, sc)); }
    drops.setMatrixAt(i, m4);
  }
  drops.instanceMatrix.needsUpdate = true;
  waterM.color.setHex(mode === 3 ? 0xf8f6f0 : 0xbfd6ea); waterM.opacity = mode === 3 ? 0.85 : 0.4;
  // mist
  mists.forEach((s, i) => { const r = rng(i * 7 + 3); const on = mode >= 1 && mode <= 5; const ph = ((t * 0.5 + r()) % 1); s.material.opacity = on ? 0.22 * Math.sin(ph * Math.PI) * (mode === 4 ? 1.6 : 1) : 0; const sz = 0.8 + ph * 1.8; s.scale.set(sz, sz, 1); if (mode === 1) s.position.set((r() - 0.5) * 3, 1.2 + r() * 1.6, (r() - 0.5) * 4); else s.position.set((r() - 0.5) * 4, 0.6 + r() * 2.2, az + (r() - 0.5) * 1.2); });
  // foam clumps on the body
  const fOn = carU.foam.value; const swp = carU.sweepMode.value === 2 ? carU.sweep.value : 99;
  for (let i = 0; i < FOAM; i++) { const f = foamSeeds[i]; let show = fOn > 0 && t > T.foams - 0.5 && f.z > (t < T.loosens + 0.3 ? az : -99) && f.z < swp; const y = car.position.y + (f.side ? f.y : 1.0 + (Math.abs(f.z) < 1 ? 0.47 : 0)); const x = f.side ? f.side * 0.95 : f.x; const drip = st(T.loosens, T.pump, t) * 0.25 * (f.side ? 1 : 0); if (show) { m4.compose(V3(x, y - drip * f.s * 0.3, f.z), q.identity(), V3(f.s, f.s * 0.7, f.s)); } else m4.makeScale(0, 0, 0); foamBits.setMatrixAt(i, m4); }
  foamBits.instanceMatrix.needsUpdate = true;
  // macro bead & minerals
  const bOn = t > T.minerals - 0.4 && t < T.last; bead.visible = bOn; mineralRing.visible = bOn; minerals.visible = bOn;
  const evap = st(T.minerals, T.evaporates + 0.8, t);
  bead.position.copy(car.position).add(BEAD_POS); bead.scale.set(1 - evap * 0.85, (1 - evap) * 0.45 + 0.02, 1 - evap * 0.85);
  mineralRing.position.copy(bead.position); mineralRing.position.y -= 0.004; mineralRing.material.opacity = st(T.evaporates - 0.2, T.evaporates + 0.8, t);
  const r = rng(11); for (let i = 0; i < MINS; i++) { const ang = r() * 6.28, rad = r() * 0.022 * (1 - evap * 0.2) + evap * 0.004; m4.compose(V3(bead.position.x + Math.cos(ang) * rad, bead.position.y - 0.004 + (1 - evap) * r() * 0.01, bead.position.z + Math.sin(ang) * rad), q.identity(), V3(1, 1, 1)); minerals.setMatrixAt(i, m4); }
  minerals.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- cinematic camera
function shake(t) { let s = 0; for (const [t0, a, d] of [[0.0, 0.05, 2.2], [T.pressure, 0.03, 1.2], [T.slab, 0.04, 0.6]]) { const u = (t - t0) / d; if (u > 0 && u < 1) s += a * (1 - u); } return s; }
let SHOTS = [];
function cz() { return car.position; }
function buildShots() {
  SHOTS = [
    // HOOK: aggressive fast push-in from very low, through the spray, at the muddy door
    [-1, T.blast - 0.05, (u) => ({ p: V3(lerp(4.8, 1.6, ei(u) * 0.6 + u * 0.4), lerp(0.25, 0.55, u), lerp(5.4, 1.6, ei(u) * 0.6 + u * 0.4)), g: V3(0.6, 0.55, 0.4), f: lerp(38, 26, u) })],
    // whip to the sprinkler blasting
    [T.blast - 0.05, T.mud - 0.3, (u) => ({ p: V3(lerp(-2.6, -1.8, u), lerp(1.2, 1.6, u), lerp(4.2, 3.6, u)), g: V3(0, 2.4, 0), f: 40 })],
    // the yard turns to mud: crane up wide
    [T.mud - 0.3, T.tires - 0.05, (u) => ({ p: V3(lerp(6, 9, eio(u)), lerp(2.5, 8, eio(u)), lerp(8, 13, eio(u))), g: V3(0, 0.3, 0), f: 40 })],
    // tires: low macro
    [T.tires - 0.05, T.slab - 0.2, (u) => ({ p: V3(lerp(1.9, 1.7, u), 0.32, lerp(2.4, 2.1, u)), g: V3(0.85, 0.3, 1.38), f: 34 })],
    // slab pour + slope: wide 3/4
    [T.slab - 0.2, T.drain - 0.2, (u) => ({ p: V3(lerp(7, 6, u), lerp(4, 3.4, u), lerp(9, 8, u)), g: V3(0, 0.2, -0.5), f: 40 })],
    // drain + tank cutaway
    [T.drain - 0.2, T.but1 - 0.1, (u) => ({ p: V3(lerp(4.2, 3.4, u), lerp(1.6, 1.2, u), lerp(-2.4, -3.0, u)), g: V3(0, -0.4, -5.4), f: 42 })],
    // sprinkler only soaks the roof
    [T.but1 - 0.1, T.bend - 0.1, (u) => ({ p: V3(lerp(4.5, 3.6, u), lerp(1.0, 0.8, u), lerp(3.2, 2.8, u)), g: V3(0, 0.9, 0), f: 38 })],
    // arch build + nozzles: orbit
    [T.bend - 0.1, T.rails - 0.1, (u) => { const a = lerp(0.7, 1.3, u); return { p: V3(Math.sin(a) * 7.5, 2.4, Math.cos(a) * 7.5 + 3.6), g: V3(0, 1.4, 3.6), f: 40 }; }],
    // rails: low tracking along the rail
    [T.rails - 0.1, T.now - 0.05, (u, t) => ({ p: V3(3.8, 0.8, archZ(t) + 3.0), g: V3(1.6, 0.6, archZ(t) - 1.5), f: 40 })],
    // water everywhere: wide
    [T.now - 0.05, T.grease - 0.05, (u) => ({ p: V3(lerp(-6.5, -5.5, u), 2.6, lerp(5.5, 4.5, u)), g: V3(0, 0.8, 0), f: 40 })],
    // grease: macro on the door, water beading off grime
    [T.grease - 0.05, T.soap - 0.05, (u) => ({ p: V3(2.6, lerp(0.95, 0.85, u), lerp(1.4, 1.0, u)), g: V3(0.9, 0.7, -0.2), f: 32 })],
    // soap tank on table
    [T.soap - 0.05, T.foams - 0.5, (u) => ({ p: V3(lerp(6.6, 6.1, u), 2.1, lerp(-1.4, -1.0, u)), g: V3(3.4, 1.25, 0.6), f: 34 })],
    // foam pass: tracking with the arch
    [T.foams - 0.5, T.pump - 0.05, (u, t) => ({ p: V3(-4.6, 1.8, archZ(t) + 3.0), g: V3(0, 0.9, archZ(t)), f: 42 })],
    // pump close-up then high pressure wide
    [T.pump - 0.05, T.pressure + 0.6, (u) => ({ p: V3(lerp(5.7, 5.3, u), 1.7, lerp(3.2, 2.9, u)), g: V3(3.4, 1.1, 1.45), f: 34 })],
    [T.pressure + 0.6, T.clean - 0.3, (u, t) => ({ p: V3(5.2, 1.4, archZ(t) + 2.5), g: V3(0, 0.8, archZ(t) - 0.5), f: 40 })],
    // clean hero glint
    [T.clean - 0.3, T.dries - 0.1, (u) => { const a = lerp(-0.6, -0.1, u); return { p: V3(Math.sin(a) * 6.5, 1.2, Math.cos(a) * 6.5), g: V3(0, 0.8, 0), f: 36 }; }],
    // spots appear: windshield / hood close
    [T.dries - 0.1, T.minerals - 0.4, (u) => ({ p: V3(lerp(1.5, 1.1, u), lerp(2.1, 1.9, u), lerp(3.4, 3.0, u)), g: V3(0, 1.3, 1.0), f: 34 })],
    // macro bead evaporating -> mineral ring
    [T.minerals - 0.4, T.last - 0.05, (u) => ({ p: cz().clone().add(BEAD_POS).add(V3(lerp(0.09, 0.07, u), lerp(0.05, 0.04, u), lerp(0.12, 0.09, u))), g: cz().clone().add(BEAD_POS), f: 30 })],
    // RO filter close-up
    [T.last - 0.05, T.one - 0.2, (u) => ({ p: V3(lerp(6.0, 5.6, u), lerp(1.9, 1.7, u), lerp(3.6, 3.3, u)), g: V3(3.4, 1.12, 2.05), f: 32 })],
    // final rinse pass: wide low
    [T.one - 0.2, T.blowers - 0.1, (u, t) => ({ p: V3(-6.6, 2.0, archZ(t) + 3.4), g: V3(0, 1.0, archZ(t) - 0.5), f: 40 })],
    // blowers
    [T.blowers - 0.1, T.congrats - 0.05, (u, t) => ({ p: V3(5.8, 3.2, archZ(t) + 5.4), g: V3(0, 1.2, archZ(t)), f: 40 })],
    // finale: crane up and around the clean car
    [T.congrats - 0.05, DUR + 1, (u, t) => { const e = eio(st(T.congrats, DUR, t)); const a = lerp(0.5, 1.6, e); return { p: V3(Math.sin(a) * lerp(6, 11, e), lerp(1.4, 6, e), Math.cos(a) * lerp(6, 11, e)), g: V3(0, 0.6, 0), f: 40 }; }],
  ];
}
buildShots();
function placeCamera(t) {
  const s = SHOTS.find((x) => t >= x[0] && t < x[1]) || SHOTS[SHOTS.length - 1];
  const u = cl((t - Math.max(0, s[0])) / (s[1] - Math.max(0, s[0])));
  const c = s[2](u, t); const sk = shake(t);
  camera.position.copy(c.p).add(V3(Math.sin(t * 0.8) * 0.02 + Math.sin(t * 29) * sk, Math.sin(t * 1.1) * 0.015 + Math.sin(t * 23) * sk, 0));
  camera.fov = c.f; camera.updateProjectionMatrix(); camera.lookAt(c.g);
}
function overlay(t) {
  const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const fade = Math.max(1 - st(0, 0.15, t), st(DUR - 0.6, DUR, t)); if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}
window.renderFrame = (t, q = 0.92) => {
  placeWorld(t); placeParticles(t); placeCamera(t);
  composer.render();
  ctx.clearRect(0, 0, W, H); ctx.drawImage(glCanvas, 0, 0); overlay(t);
  return out.toDataURL('image/jpeg', q);
};
window.READY = true;

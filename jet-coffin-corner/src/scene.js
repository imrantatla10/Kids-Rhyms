// "Coffin Corner" – why jets can lose control at high altitude. Deterministic 3D (three.js) + 2D HUD/icons, no captions.
import * as THREE from 'three';
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
const eob = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(21);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- beats
const WORDS = SEG.flatMap((s) => s.words.map((w) => ({ w: w.w.toLowerCase().replace(/[^a-z0-9']/g, ''), s: w.s })));
function Wt(word, after = 0) { const ws = word.split('|'); const x = WORDS.find((q) => ws.includes(q.w) && q.s >= after); return x ? x.s : after + 1.2; }
const B = {};
B.night = Wt('night'); B.seventy = Wt('seventy|70', B.night - 1); B.gone = Wt('gone', B.seventy);
B.no = Wt('no', B.gone); B.engine = Wt('engine', B.no); B.what = Wt('what', B.engine); B.sky = Wt('sky', B.what);
B.up = Wt('up', B.sky); B.thin = Wt('thin', B.up); B.window = Wt('window', B.thin);
B.slow = Wt('slow', B.window); B.lifting = Wt('lifting', B.slow); B.fast = Wt('fast', B.lifting); B.shock = Wt('shockwaves|shock', B.fast);
B.pilots = Wt('pilots', B.shock); B.coffin = Wt('coffin', B.pilots);
B.now = Wt('now', B.coffin); B.ice = Wt('ice', B.now); B.sand = Wt('sandpaper', B.ice); B.steal = Wt('steal', B.sand);
B.window2 = Wt('window', B.steal); B.shrinks = Wt('shrinks', B.window2);
B.then = Wt('then', B.shrinks); B.turb = Wt('turbulence', B.then); B.jolt = Wt('jolt', B.turb); B.stalls = Wt('stalls', B.jolt);
B.nose = Wt('nose', B.stalls); B.falls = Wt('falls', B.nose); B.thousands = Wt('thousands', B.falls);
B.pilots2 = Wt('pilots', B.thousands); B.ground = Wt('ground', B.pilots2);
B.rare = Wt('rare|it\'s', B.ground); B.warnings = Wt('warnings', B.rare);
B.but = Wt('but', B.warnings); B.line = Wt('line', B.but); B.deadly = Wt('deadly', B.line);
B.follow = Wt('follow', B.deadly); B.send = Wt('send', B.follow);
window.BEATS = B;
const T = B;

// ---------------------------------------------------------------- renderer
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1500);
const composer = new EffectComposer(renderer); composer.setSize(W, H); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.55, 0.5, 0.78); composer.addPass(bloom); composer.addPass(new OutputPass());
const out = document.getElementById('out'); const ctx = out.getContext('2d');
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
function mesh(geo, m) { return new THREE.Mesh(geo, m); }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const glowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
function glow(color, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(size); return s; }

// ---------------------------------------------------------------- SKY SET
const skyU = { dawn: { value: 0 }, flash: { value: 0 } };
const sky = mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform float dawn; uniform float flash; varying vec3 vp;
    float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
    void main(){ float y = clamp(vp.y*0.5+0.5,0.,1.);
      vec3 nTop = vec3(0.02,0.03,0.11), nHor = vec3(0.16,0.12,0.35);
      vec3 dTop = vec3(0.18,0.32,0.62), dHor = vec3(1.0,0.62,0.42);
      vec3 c = mix(mix(nHor,nTop,pow(y,0.7)), mix(dHor,dTop,pow(y,0.6)), dawn);
      vec3 q = floor(vp*420.); float s = step(0.9975, h(q)) * smoothstep(0.45,0.7,y);
      c += vec3(s)*(1.-dawn)*0.9; c += vec3(0.6,0.65,0.9)*flash;
      gl_FragColor = vec4(pow(c, vec3(2.2)),1.); }` }));
scene.add(sky);
const moon = glow(0xe8eeff, 140); moon.position.set(-320, 260, -520); scene.add(moon);
const moonCore = mesh(new THREE.SphereGeometry(22, 32, 24), new THREE.MeshBasicMaterial({ color: 0xf4f6ff })); moonCore.position.copy(moon.position); scene.add(moonCore);
const hemi = new THREE.HemisphereLight(0x8fa6ff, 0x1a1730, 0.8); scene.add(hemi);
const moonL = new THREE.DirectionalLight(0xc9d6ff, 2.2); moonL.position.set(-3, 3, -2); scene.add(moonL);
const rimL = new THREE.DirectionalLight(0xff9a6a, 0.0); rimL.position.set(4, 1, 3); scene.add(rimL);
const flashL = new THREE.PointLight(0xdde6ff, 0, 400, 1.2); flashL.position.set(40, 20, -60); scene.add(flashL);
// cloud sea shader
const seaU = { t: { value: 0 }, dawn: { value: 0 }, flash: { value: 0 } };
const sea = mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), new THREE.ShaderMaterial({ uniforms: seaU, transparent: false,
  vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix*vec4(position,1.); wp = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform float t; uniform float dawn; uniform float flash; varying vec3 wp;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
    void main(){ vec2 p = vec2(wp.x + t*30., wp.z) * 0.012; float c = fbm(p); float c2 = fbm(p*2.5 + 7.);
      vec3 night = mix(vec3(0.10,0.11,0.22), vec3(0.55,0.58,0.78), smoothstep(0.35,0.85,c*0.7+c2*0.3));
      vec3 day = mix(vec3(0.62,0.5,0.55), vec3(1.0,0.86,0.76), smoothstep(0.35,0.85,c*0.7+c2*0.3));
      vec3 col = mix(night, day, dawn) + vec3(0.5,0.55,0.8)*flash*c;
      float fog = smoothstep(200., 1100., length(wp.xz - cameraPosition.xz));
      col = mix(col, mix(vec3(0.16,0.12,0.35), vec3(1.0,0.62,0.42), dawn), fog);
      gl_FragColor = vec4(pow(col, vec3(2.2)), 1.); }` }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -60; scene.add(sea);
// puffy 3D clouds
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xaeb6d8, roughness: 1, emissive: 0x1a1d38, emissiveIntensity: 0.4, flatShading: false });
const clouds = [];
for (let i = 0; i < 70; i++) {
  const g = new THREE.Group(); const n = 5 + Math.floor(R() * 6); const s = 3 + R() * 6;
  for (let k = 0; k < n; k++) { const b = mesh(new THREE.IcosahedronGeometry(s * (0.6 + R() * 0.6), 2), cloudMat); b.position.set((R() - 0.5) * s * 3, (R() - 0.3) * s * 0.8, (R() - 0.5) * s * 2); b.scale.y = 0.6; g.add(b); }
  const band = R();
  g.userData = { x0: -300 + R() * 600, y0: band < 0.65 ? -45 + R() * 25 : (band < 0.9 ? -15 + R() * 20 : 8 + R() * 20), z0: (R() - 0.5) * 360, sp: 0.85 + R() * 0.3 };
  if (Math.abs(g.userData.z0) < 25 && g.userData.y0 > -20) g.userData.z0 += 60 * Math.sign(g.userData.z0 || 1);
  scene.add(g); clouds.push(g);
}
// thin-air particles / rain streaks (instanced)
const dustN = 400; const dust = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.7 }), dustN); scene.add(dust);
const dustP = [...Array(dustN)].map(() => [(R() - 0.5) * 60, (R() - 0.5) * 30, (R() - 0.5) * 40]);

// ---------------------------------------------------------------- jet
const jet = new THREE.Group(); scene.add(jet);
const jetBody = new THREE.Group(); jet.add(jetBody);
const liveryTex = canvasTex(2048, 512, (g, w, h) => {
  // u (x) = around, v (y) = along length (0 = tail, 1 = nose) - canvas y is flipped
  g.fillStyle = '#f4f5f7'; g.fillRect(0, 0, w, h);
  const vy = (v) => h * (1 - v);
  // navy belly + cheatline on both sides (u≈0.05 and u≈0.45 bands around the bottom u=0.25)
  g.fillStyle = '#1d2c5a'; g.fillRect(w * 0.12, 0, w * 0.26, h);
  g.fillStyle = '#c9a54a'; g.fillRect(w * 0.105, 0, w * 0.012, h); g.fillRect(w * 0.383, 0, w * 0.012, h);
  // windows: sides u≈0.0/1.0 and 0.5, slightly toward top (0.75)
  g.fillStyle = '#16213b';
  for (let i = 0; i < 7; i++) { const v = 0.48 + i * 0.045; for (const u of [0.535, 0.965]) { g.beginPath(); g.ellipse(w * u, vy(v), w * 0.008, h * 0.016, 0, 0, 7); g.fill(); } }
  // cockpit windshield near the nose (top u≈0.75)
  g.fillStyle = '#0d1528'; g.beginPath(); g.moveTo(w * 0.62, vy(0.865)); g.lineTo(w * 0.88, vy(0.865)); g.lineTo(w * 0.84, vy(0.905)); g.lineTo(w * 0.66, vy(0.905)); g.closePath(); g.fill();
  g.fillStyle = '#c9a54a'; g.fillRect(w * 0.0, vy(0.1), w, h * 0.004);
});
const paint = new THREE.MeshPhysicalMaterial({ map: liveryTex, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 });
{
  const prof = [[0.05, -8.2], [0.32, -7.6], [0.6, -6.6], [0.86, -5.0], [1.0, -3.2], [1.04, -1.0], [1.04, 3.0], [0.98, 4.8], [0.82, 6.0], [0.55, 7.1], [0.25, 7.8], [0.02, 8.15]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 64); g.rotateZ(-Math.PI / 2);
  jetBody.add(mesh(g, paint));
}
const wingMat = new THREE.MeshPhysicalMaterial({ color: 0xe9ecf2, roughness: 0.3, metalness: 0.2, clearcoat: 0.6 });
const navyMat = new THREE.MeshPhysicalMaterial({ color: 0x1d2c5a, roughness: 0.3, clearcoat: 0.8 });
const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.15, transmission: 0.0, transparent: true, opacity: 0.85, emissive: 0x6fa8ff, emissiveIntensity: 0.15 });
const wings = [];
function wingShape(rootC, tipC, span, sweep) { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-sweep, span); s.lineTo(-sweep - tipC, span); s.lineTo(-rootC, 0); s.closePath(); return s; }
for (const side of [-1, 1]) {
  const g = new THREE.ExtrudeGeometry(wingShape(3.8, 1.3, 7.2, 3.2), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  g.rotateX(Math.PI / 2); if (side < 0) g.scale(1, 1, -1);
  const w = mesh(g, wingMat); w.position.set(1.6, -0.55, side * 0.85); w.rotation.x = side * -0.06; jet.add(w); wings.push(w);
  const wl = mesh(new THREE.ExtrudeGeometry(wingShape(1.2, 0.6, 1.4, 0.9), { depth: 0.08, bevelEnabled: false }), navyMat); wl.position.set(1.6 - 3.2 + 0.0, -0.4, side * (0.85 + 7.2)); jet.add(wl);
  // engines
  const nac = new THREE.Group(); nac.position.set(-4.6, 0.55, side * 1.75);
  const n = mesh(new THREE.CylinderGeometry(0.55, 0.5, 3.0, 28, 1, false), wingMat); n.rotation.z = Math.PI / 2; nac.add(n);
  const lip = mesh(new THREE.TorusGeometry(0.55, 0.08, 10, 28), M(0xb8bec8, { metalness: 0.9, roughness: 0.2 })); lip.rotation.y = Math.PI / 2; lip.position.x = 1.5; nac.add(lip);
  const fan = mesh(new THREE.CircleGeometry(0.5, 24), M(0x111318, { metalness: 0.6 })); fan.rotation.y = Math.PI / 2; fan.position.x = 1.45; nac.add(fan);
  const ex = mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.4, 20), M(0x333840, { metalness: 0.8 })); ex.rotation.z = Math.PI / 2; ex.position.x = -1.65; nac.add(ex);
  const py = mesh(new THREE.BoxGeometry(1.4, 0.15, 0.9), wingMat); py.position.set(0, -0.05, -side * 0.6); nac.add(py);
  jet.add(nac);
}
{
  const fin = mesh(new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-2.2, 3.2); s.lineTo(-3.4, 3.2); s.lineTo(-3.2, 0); s.closePath(); return s; })(), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 }), navyMat);
  fin.position.set(-4.9, 0.7, -0.1); jet.add(fin);
  for (const side of [-1, 1]) { const g = new THREE.ExtrudeGeometry(wingShape(1.6, 0.8, 2.6, 1.0), { depth: 0.12, bevelEnabled: false }); g.rotateX(Math.PI / 2); if (side < 0) g.scale(1, 1, -1); const hs = mesh(g, wingMat); hs.position.set(-7.0, 3.85, side * 0.05); jet.add(hs); }
}
// nav lights
const navL = glow(0xff3030, 1.6); navL.position.set(1.6 - 3.2 - 0.6, -0.5, -(0.85 + 7.25)); jet.add(navL);
const navR = glow(0x30ff70, 1.6); navR.position.set(1.6 - 3.2 - 0.6, -0.5, (0.85 + 7.25)); jet.add(navR);
const strobeL = glow(0xffffff, 3.2); strobeL.position.copy(navL.position); jet.add(strobeL);
const strobeR = glow(0xffffff, 3.2); strobeR.position.copy(navR.position); jet.add(strobeR);
const beacon = glow(0xff2020, 1.4); beacon.position.set(-1, 1.1, 0); jet.add(beacon);
const tailLogo = glow(0xffe2a0, 1.2); tailLogo.position.set(-6.6, 2.2, 0.2); jet.add(tailLogo);
// wing ice crystals (on the left wing leading edge, visible in close-ups)
const ICE_N = 220; const iceInst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), iceMat, ICE_N); jet.add(iceInst);
const iceP = [...Array(ICE_N)].map(() => { const u = R(); return { x: 1.6 - u * 3.2 + 0.05 + R() * 0.15, y: -0.5 + (R() - 0.5) * 0.12, z: -(0.85 + u * 7.0), s: 0.5 + R() * 1.0, d: R() }; });
// leading-edge de-ice glow
const deice = mesh(new THREE.BoxGeometry(0.08, 0.1, 7.2), new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0 })); deice.position.set(0.0, -0.5, -4.4); deice.rotation.y = Math.atan2(3.2, 7.2); jet.add(deice);
const deice2 = deice.clone(); deice2.material = deice.material; deice2.position.z = 4.4; deice2.rotation.y = -deice.rotation.y; jet.add(deice2);
// speed-window walls (in sky set, around the jet)
const wallMat = new THREE.MeshBasicMaterial({ color: 0xff2b3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const walls = [-1, 1].map(() => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const p = mesh(new THREE.PlaneGeometry(2 + i * 1.2, 40), wallMat); p.rotation.y = Math.PI / 2; p.position.x = (i - 2.5) * 0.25; g.add(p); } scene.add(g); return g; });

// ---------------------------------------------------------------- LAB SET (airfoil)
const LAB = V3(0, -400, 0);
const labBg = mesh(new THREE.SphereGeometry(60, 32, 20), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 vp; void main(){ float y = vp.y*0.5+0.5; vec3 c = mix(vec3(0.02,0.03,0.09), vec3(0.08,0.12,0.3), y); gl_FragColor = vec4(pow(c,vec3(2.2)),1.); }' }));
labBg.position.copy(LAB); scene.add(labBg);
const lab = new THREE.Group(); lab.position.copy(LAB); scene.add(lab);
const foil = new THREE.Group(); lab.add(foil);
function airfoilShape(c) { const s = new THREE.Shape(); const N = 60; const pts = []; for (let i = 0; i <= N; i++) { const x = 1 - Math.cos(i / N * Math.PI / 2) ** 1; const xx = 0.5 * (1 - Math.cos(i / N * Math.PI)); const yt = 5 * 0.13 * (0.2969 * Math.sqrt(xx) - 0.126 * xx - 0.3516 * xx * xx + 0.2843 * xx ** 3 - 0.1015 * xx ** 4); const yc = 0.04 * (xx < 0.4 ? (2 * 0.4 * xx - xx * xx) / 0.16 : ((1 - 0.8) + 2 * 0.4 * xx - xx * xx) / 0.36); pts.push([xx, yc + yt, yc - yt]); } s.moveTo(c * 0.5 - c * pts[0][0], 0); pts.forEach(([x, yu]) => s.lineTo(c * 0.5 - c * x, c * yu)); for (let i = pts.length - 1; i >= 0; i--) { const [x, , yl] = pts[i]; s.lineTo(c * 0.5 - c * x, c * yl); } return s; }
{ const g = new THREE.ExtrudeGeometry(airfoilShape(9), { depth: 5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 3 }); g.translate(0, 0, -2.5); g.rotateY(Math.PI); foil.add(mesh(g, new THREE.MeshPhysicalMaterial({ color: 0xe9ecf2, roughness: 0.25, metalness: 0.3, clearcoat: 0.8 }))); }
const labKey = new THREE.PointLight(0xffffff, 120, 60, 1.5); labKey.position.copy(LAB).add(V3(6, 8, 10)); scene.add(labKey);
const labRim = new THREE.PointLight(0x6a8cff, 80, 60, 1.5); labRim.position.copy(LAB).add(V3(-8, -3, -6)); scene.add(labRim);
// streamline particles
const SL = 16, SP = 40; const flow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7fd8ff }), SL * SP); lab.add(flow);
const labIce = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), iceMat, 120); foil.add(labIce);
const labIceP = [...Array(120)].map(() => { const a = (R() - 0.5) * 2.2; return { x: 4.5 - Math.abs(a) * 0.25 + (R() - 0.2) * 0.2, y: a * 0.55, z: (R() - 0.5) * 4.8, s: 0.6 + R(), d: R() }; });
const liftArrow = new THREE.Group(); { const m = new THREE.MeshStandardMaterial({ color: 0x4ef0a0, emissive: 0x2ec27e, emissiveIntensity: 1.2 }); const sh = mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 16), m); sh.position.y = 0.5; liftArrow.add(sh); const hd = mesh(new THREE.ConeGeometry(0.45, 0.9, 20), m); hd.position.y = 1.4; liftArrow.add(hd); liftArrow.userData.sh = sh; liftArrow.userData.hd = hd; liftArrow.userData.m = m; }
liftArrow.position.set(0.8, 0.8, 2.8); lab.add(liftArrow);
const shock = mesh(new THREE.PlaneGeometry(0.6, 3), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); shock.position.set(-0.6, 1.9, 2.6); lab.add(shock);

// ---------------------------------------------------------------- COCKPIT SET
const CP = V3(0, 400, 0);
const cock = new THREE.Group(); cock.position.copy(CP); scene.add(cock);
const cpBg = mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: 0x05060c, side: THREE.BackSide })); cock.add(cpBg);
const outsideTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.c = c; return t; })();
const windshield = mesh(new THREE.PlaneGeometry(7, 3.2), new THREE.MeshBasicMaterial({ map: outsideTex })); windshield.position.set(0, 2.3, -4); cock.add(windshield);
for (const x of [-3.6, 0, 3.6]) { const p = mesh(new THREE.BoxGeometry(0.25, 3.6, 0.3), M(0x1a1c22)); p.position.set(x, 2.3, -3.9); p.rotation.z = x * 0.04; cock.add(p); }
const panel = mesh(new THREE.BoxGeometry(8, 1.4, 1.2), M(0x22252c, { roughness: 0.8 })); panel.position.set(0, 0.5, -3.2); cock.add(panel);
const screens = []; for (const x of [-2.4, -0.8, 0.8, 2.4]) { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const s = mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshBasicMaterial({ map: tx })); s.position.set(x, 0.75, -2.59); s.rotation.x = -0.25; cock.add(s); screens.push({ c, tx }); }
const master = mesh(new THREE.BoxGeometry(0.5, 0.25, 0.1), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 0 })); master.position.set(0, 1.35, -2.75); cock.add(master);
const masterGlow = glow(0xff2020, 2.0); masterGlow.position.set(0, 1.35, -2.6); cock.add(masterGlow);
const yokes = [-1.6, 1.6].map((x) => { const g = new THREE.Group(); const col = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 10), M(0x2a2d33)); col.rotation.x = Math.PI / 2; col.position.z = 0.6; g.add(col); const wheel = mesh(new THREE.TorusGeometry(0.4, 0.06, 10, 24, Math.PI * 1.3), M(0x15171b)); wheel.rotation.z = -Math.PI * 0.15 - Math.PI / 2; g.add(wheel); g.position.set(x, 0.3, -1.8); cock.add(g); return g; });
const pilots = [-1.6, 1.6].map((x) => { const g = new THREE.Group(); const body = mesh(new THREE.CapsuleGeometry(0.45, 0.6, 6, 14), M(0x1b2340)); body.position.y = 0.2; g.add(body); const hd = mesh(new THREE.SphereGeometry(0.34, 20, 16), M(0x8d5a3b)); hd.position.y = 1.05; g.add(hd); const hair = mesh(new THREE.SphereGeometry(0.36, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M(0x1a1110)); hair.position.y = 1.08; g.add(hair); const set = mesh(new THREE.TorusGeometry(0.37, 0.05, 8, 20, Math.PI), M(0x111111)); set.position.y = 1.08; set.rotation.y = Math.PI / 2; g.add(set); for (const s of [-1, 1]) { const cup = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 14), M(0x111111)); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.37, 1.02, 0); g.add(cup); const arm = mesh(new THREE.CapsuleGeometry(0.11, 0.7, 4, 8), M(0x1b2340)); arm.position.set(s * 0.45, 0.25, -0.45); arm.rotation.x = 1.2; g.add(arm); g.userData[s] = arm; } g.position.set(x, 0, 0); cock.add(g); return g; });
const cpLight = new THREE.PointLight(0xff3030, 0, 12, 1.5); cpLight.position.copy(CP).add(V3(0, 2, -2)); scene.add(cpLight);
const cpFill = new THREE.PointLight(0x7aa0ff, 14, 14, 1.5); cpFill.position.copy(CP).add(V3(0, 2.5, -3.5)); scene.add(cpFill);

// ---------------------------------------------------------------- state
function windowGap(t) { // half-width of the speed window
  let g = 9;
  g = lerp(g, 5.5, eio(st(T.coffin - 0.3, T.coffin + 0.8, t)));
  g = lerp(g, 3.0, eio(st(T.shrinks - 0.3, T.shrinks + 0.6, t)));
  return g;
}
function dive(t) { return st(T.nose - 0.2, T.nose + 1.4, t) * (1 - st(T.rare - 0.2, T.rare, t)); }
function nightAmt(t) { return 1 - eio(st(T.rare - 0.05, T.rare + 0.4, t)) * (1 - st(T.but - 0.1, T.but + 0.6, t)); }
function turbAmt(t) { return st(T.turb - 0.3, T.turb + 0.2, t) * (1 - st(T.ground, T.rare, t)); }
function flashAmt(t) { let f = 0; const r = rng(5); for (let i = 0; i < 9; i++) { const t0 = T.turb - 0.2 + i * 0.75 + r() * 0.4; const u = (t - t0) / 0.25; if (u > 0 && u < 1) f = Math.max(f, (1 - u) * (u < 0.15 ? 1 : 0.6 + 0.4 * Math.sin(u * 40))); } return f * (t < T.rare ? 1 : 0); }

function placeSky(t) {
  const dv = dive(t); const fall = t > T.nose - 0.2 && t < T.rare ? (t - (T.nose - 0.2)) : 0;
  const altDrop = fall > 0 ? 6 * fall * fall + 4 * fall : 0;
  const d = 1 - nightAmt(t);
  skyU.dawn.value = d; seaU.dawn.value = d; seaU.t.value = t;
  const fl = flashAmt(t); skyU.flash.value = fl * 0.6; seaU.flash.value = fl; flashL.intensity = fl * 3000;
  hemi.intensity = lerp(0.8, 1.6, d); moonL.intensity = lerp(2.2, 1.4, d); moonL.color.setHex(d > 0.5 ? 0xffe0c0 : 0xc9d6ff); rimL.intensity = d * 2.5;
  cloudMat.color.setHex(d > 0.5 ? 0xffe6d8 : 0xaeb6d8); cloudMat.emissive.setHex(d > 0.5 ? 0x4a3030 : 0x1a1d38);
  moon.material.opacity = 1 - d; moonCore.visible = d < 0.6;
  sea.position.y = -60 + altDrop * 0.9;
  clouds.forEach((c) => { const u = c.userData; let x = ((u.x0 - t * 26 * u.sp) % 600 + 600) % 600 - 300; c.position.set(x, u.y0 + altDrop, u.z0); });
  // jet attitude
  const tb = turbAmt(t);
  const jolt = Math.exp(-Math.pow((t - T.jolt - 0.1) / 0.18, 2));
  let pitch = Math.sin(t * 0.6) * 0.02 + tb * Math.sin(t * 13) * 0.04 + jolt * 0.25;
  let roll = Math.sin(t * 0.5) * 0.03 + tb * Math.sin(t * 9 + 1) * 0.07;
  const stall = st(T.stalls - 0.1, T.stalls + 0.5, t) * (1 - st(T.nose - 0.2, T.nose + 0.4, t));
  pitch += stall * 0.22;
  pitch = lerp(pitch, -0.95, eio(dv)); roll = lerp(roll, 0.55 + Math.sin(t * 2) * 0.1, eio(dv));
  jet.position.set(0, tb * Math.sin(t * 7) * 0.25 + jolt * 0.8, 0);
  jet.rotation.set(roll, 0, pitch, 'XYZ');
  jet.visible = !(t > T.gone - 0.05 && t < T.no - 0.05);
  // lights
  const sp = (t % 1.2); strobeL.material.opacity = strobeR.material.opacity = sp < 0.06 || (sp > 0.14 && sp < 0.2) ? 1 : 0;
  beacon.material.opacity = (t % 1.0) < 0.15 ? 1 : 0.15;
  // ice
  const ice = eo(st(T.ice - 0.2, T.steal + 0.4, t)) * (1 - st(T.rare - 0.1, T.rare + 0.8, t));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  iceP.forEach((p, i) => { const s = Math.max(0.0001, cl((ice - p.d * 0.6) * 2.5)) * p.s; q.setFromEuler(new THREE.Euler(i, i * 2, i * 3)); m4.compose(V3(p.x, p.y, p.z), q, V3(s, s * 0.6, s)); iceInst.setMatrixAt(i, m4); });
  iceInst.instanceMatrix.needsUpdate = true;
  deice.material.opacity = st(T.warnings - 0.2, T.warnings + 0.4, t) * (1 - st(T.but, T.but + 0.5, t)) * (0.6 + Math.sin(t * 6) * 0.2);
  // walls
  const show = st(T.window - 0.3, T.window + 0.3, t) * (1 - st(T.now - 0.2, T.now, t)) + st(T.window2 - 0.3, T.window2 + 0.1, t) * (1 - st(T.then - 0.1, T.then + 0.2, t));
  const gap = windowGap(t);
  walls.forEach((w, i) => { w.position.set((i ? 1 : -1) * gap, 0, 0); w.visible = show > 0.01; });
  wallMat.opacity = 0.18 * cl(show);
  // dust (thin air / rain)
  const rain = tb; const thin = st(T.thin - 0.3, T.thin + 0.3, t) * (1 - st(T.slow - 0.4, T.slow, t));
  dust.visible = rain > 0.01 || thin > 0.01;
  dustP.forEach((p, i) => { const x = ((p[0] - t * (rain > 0 ? 60 : 12)) % 60 + 60) % 60 - 30; const y = p[1] + altDrop * 0 ; const s = rain > 0 ? 1 : 0.6; m4.compose(V3(x, y, p[2]), q.identity(), V3(rain > 0 ? 8 * s : s, s * 0.4, s * 0.4)); dust.setMatrixAt(i, m4); });
  dust.instanceMatrix.needsUpdate = true; dust.material.opacity = 0.5 * Math.max(rain, thin);
  bloom.strength = 0.55 + fl * 0.6;
}

function placeLab(t) {
  // phases: slow (high AoA, separation) -> fast (shock) ; ice (lift reduced)
  const slowP = st(T.slow - 0.3, T.lifting + 0.3, t) * (1 - st(T.fast - 0.2, T.fast + 0.2, t));
  const fastP = st(T.fast - 0.2, T.fast + 0.3, t);
  const iceL = st(T.ice + 0.4, T.steal + 0.4, t);
  const aoa = lerp(0.06, 0.32, eio(slowP));
  foil.rotation.z = aoa;
  const sep = slowP * st(T.slow + 0.4, T.lifting + 0.2, t);
  const lift = cl(1 - sep * 0.85 - iceL * 0.45 - fastP * 0.15);
  liftArrow.scale.set(1, Math.max(0.05, 3.2 * lift), 1); liftArrow.userData.m.color.setHex(lift < 0.5 ? 0xff5a5a : 0x4ef0a0); liftArrow.userData.m.emissive.setHex(lift < 0.5 ? 0xff2a2a : 0x2ec27e);
  shock.material.opacity = fastP * (0.5 + Math.sin(t * 30) * 0.3) * (1 - iceL); shock.position.y = 1.7 + Math.sin(t * 20) * 0.05;
  const speed = lerp(5, 11, fastP) * (1 - slowP * 0.4);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); const r = rng(3);
  for (let l = 0; l < SL; l++) {
    const y0 = (l - (SL - 1) / 2) * 0.42;
    for (let k = 0; k < SP; k++) {
      const x = ((k / SP * 26 + t * speed + r() * 0.5) % 26) - 13; // flows -x? we draw +x -> -x (leading edge at +x)
      const xx = -x; // particles move from +x (front) to -x (back)
      const bump = Math.exp(-Math.pow(xx / 4.2, 2));
      let y = y0 + Math.sign(y0 || 1) * bump * 1.3 * Math.exp(-Math.abs(y0) * 0.5) + (y0 > 0 ? bump * 0.4 : 0);
      y += Math.sin(aoa) * (-xx) * 0.35 * Math.exp(-Math.abs(y0) * 0.3);
      // separation: above the wing, behind mid-chord -> swirl
      if (sep > 0 && y0 > -0.3 && y0 < 2.2 && xx < 1.5) { const ph = t * 7 + k + l; y += sep * Math.sin(ph) * 0.8; }
      m4.compose(V3(xx, y, 2.7 - (l % 3) * 2.2), q, V3(1, 1, 1)); flow.setMatrixAt(l * SP + k, m4);
    }
  }
  flow.instanceMatrix.needsUpdate = true;
  flow.material.color.setHex(sep > 0.4 ? 0xffb35a : 0x7fd8ff);
  labIceP.forEach((p, i) => { const s = Math.max(0.0001, cl((iceL - p.d * 0.5) * 2)) * p.s; q.setFromEuler(new THREE.Euler(i, i * 1.7, i * 2.3)); m4.compose(V3(p.x, p.y, p.z), q, V3(s, s * 0.7, s)); labIce.setMatrixAt(i, m4); });
  labIce.instanceMatrix.needsUpdate = true;
}

function drawOutside(t) {
  const c = outsideTex.userData.c, g = c.getContext('2d'); const pitch = -0.9 * dive(t) + 0.4 * st(T.pilots2, T.ground + 0.6, t);
  const hz = 256 - pitch * 600;
  const sk = g.createLinearGradient(0, 0, 0, 512); sk.addColorStop(0, '#05081a'); sk.addColorStop(1, '#2a2050'); g.fillStyle = sk; g.fillRect(0, 0, 512, 512);
  g.save(); g.translate(256, hz); g.rotate(0.35 + Math.sin(t * 2) * 0.08); g.fillStyle = '#5a5f86'; g.fillRect(-600, 0, 1200, 900); g.restore();
  g.strokeStyle = 'rgba(220,230,255,0.6)'; g.lineWidth = 3; const r = rng(Math.floor(t * 20)); for (let i = 0; i < 30; i++) { const x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 20, y - 40 - r() * 60); g.stroke(); }
  outsideTex.needsUpdate = true;
}
function drawScreens(t) {
  const pitch = -0.9 * dive(t) + 0.4 * st(T.pilots2, T.ground + 0.6, t); const roll = 0.55;
  screens.forEach((s, i) => {
    const g = s.c.getContext('2d'); g.fillStyle = '#050708'; g.fillRect(0, 0, 256, 256);
    if (i === 1) { g.save(); g.translate(128, 128); g.rotate(-roll); const off = pitch * 160; g.fillStyle = '#2b6fd6'; g.fillRect(-200, -400 + off, 400, 400); g.fillStyle = '#8a5a2b'; g.fillRect(-200, off, 400, 400); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(-200, off); g.lineTo(200, off); g.stroke(); g.restore(); g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.beginPath(); g.moveTo(70, 128); g.lineTo(110, 128); g.lineTo(128, 145); g.lineTo(146, 128); g.lineTo(186, 128); g.stroke(); }
    else if (i === 2) { const alt = altitude(t); g.fillStyle = '#0d1a10'; g.fillRect(40, 20, 176, 216); g.fillStyle = '#4ef0a0'; g.font = 'bold 44px monospace'; g.textAlign = 'center'; g.fillText(String(Math.round(alt / 10) * 10), 128, 140); g.strokeStyle = '#4ef0a0'; for (let k = -3; k <= 3; k++) { const y = 128 + k * 30 + ((alt / 3) % 30); g.beginPath(); g.moveTo(50, y); g.lineTo(70, y); g.stroke(); } }
    else { const on = Math.floor(t * 4) % 2; g.fillStyle = on ? '#ff2020' : '#401010'; g.fillRect(30, 90, 196, 76); g.fillStyle = '#ffffff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText(i === 0 ? '⚠' : '!!', 128, 145); }
    s.tx.needsUpdate = true;
  });
}
function altitude(t) { const fall = t > T.nose - 0.2 && t < T.rare ? (t - (T.nose - 0.2)) : 0; return Math.max(9000, 35000 - fall * fall * 250 - fall * 800); }
function placeCockpit(t) {
  const warn = t > T.stalls - 0.2 && t < T.rare;
  const on = Math.floor(t * 4) % 2;
  master.material.emissiveIntensity = warn ? (on ? 3 : 0.2) : 0; masterGlow.material.opacity = warn && on ? 1 : 0;
  cpLight.intensity = warn && on ? 30 : 4;
  const pull = st(T.pilots2 - 0.1, T.pilots2 + 0.6, t);
  yokes.forEach((y, i) => { y.position.z = -1.8 + pull * 0.45 + Math.sin(t * 9 + i) * 0.03 * pull; y.rotation.z = Math.sin(t * 3 + i) * 0.15 * pull; });
  pilots.forEach((p, i) => { p.rotation.x = -0.12 * pull; p.position.y = Math.sin(t * 11 + i) * 0.03; });
  cock.rotation.z = 0.12 * Math.sin(t * 2.2) * (warn ? 1 : 0); cock.rotation.x = 0.04 * Math.sin(t * 13) * (warn ? 1 : 0);
  if (t > T.pilots2 - 0.3 && t < T.rare + 0.1) { drawOutside(t); drawScreens(t); }
}

// ---------------------------------------------------------------- camera shots
function camShake(t) { const tb = turbAmt(t); let s = tb * 0.12 + dive(t) * 0.15; const j = Math.exp(-Math.pow((t - T.jolt - 0.1) / 0.25, 2)); s += j * 0.5; return s; }
let SHOTS = [];
function jetPt(x, y, z) { return jet.localToWorld(V3(x, y, z)); }
function buildShots() {
  SHOTS = [
    // HOOK 1: cinematic wide reveal in moonlight
    [-1, T.night + 0.1, (u) => ({ p: V3(lerp(-34, -18, eo(u)), lerp(9, 4, eo(u)), lerp(46, 26, eo(u))), g: V3(lerp(-2, 1, u), 0, 0), f: lerp(40, 36, u) })],
    // HOOK 2: low close tracking under the wing toward the nose
    [T.night + 0.1, T.seventy - 0.1, (u) => ({ p: V3(lerp(-10, 2, eio(u)), -3.2, lerp(12, 15, u)), g: V3(lerp(-2, 4, u), 0, 0), f: 42 })],
    // HOOK 3: very wide, jet small above the cloud sea -> it dives into the clouds and vanishes
    [T.seventy - 0.1, T.gone + 0.0, (u) => ({ p: V3(-70, 10, 110), g: V3(0, -2, 0), f: 30 })],
    [T.gone + 0.0, T.no - 0.05, (u) => ({ p: V3(-70, 10, 110), g: V3(0, -2, 0), f: 30 })],
    // no explosion / no engine failure: engine close-up, then cockpit calm
    [T.no - 0.05, T.engine + 0.6, (u) => ({ p: V3(lerp(-1.5, -2.5, u), 1.8, lerp(5.5, 5.0, u)), g: V3(-4.6, 0.6, 1.7), f: 40 })],
    [T.engine + 0.6, T.up - 0.05, (u) => ({ p: V3(lerp(14, 10, u), lerp(-2, -1, u), lerp(-16, -12, u)), g: V3(0, 0, 0), f: 40 })],
    // up here: wide side, thin air + speed walls
    [T.up - 0.05, T.slow - 0.05, (u) => ({ p: V3(lerp(0, 2, u), lerp(10, 6, u), lerp(52, 44, u)), g: V3(0, 0, 0), f: 40 })],
    // LAB: too slow / too fast
    [T.slow - 0.05, T.pilots - 0.05, (u) => ({ p: LAB.clone().add(V3(lerp(5, 2, u), lerp(2.5, 1.5, u), lerp(27, 24, u))), g: LAB.clone().add(V3(0.5, 0.6, 0)), f: 42 })],
    // coffin corner: walls closing, dramatic low wide
    [T.pilots - 0.05, T.now - 0.05, (u) => ({ p: V3(lerp(-6, -3, u), lerp(-12, -8, u), lerp(40, 34, u)), g: V3(0, 1, 0), f: 38 })],
    // ice on the wing (close)
    [T.now - 0.05, T.sand + 0.2, (u) => ({ p: jetPt(lerp(3.5, 2.8, u), lerp(1.4, 1.0, u), lerp(-3.5, -4.5, u)), g: jetPt(0.5, -0.5, lerp(-5, -6, u)), f: 40 })],
    // LAB with ice: lift stolen
    [T.sand + 0.2, T.window2 - 0.05, (u) => ({ p: LAB.clone().add(V3(lerp(7, 4, u), lerp(3, 2, u), lerp(24, 21, u))), g: LAB.clone().add(V3(1.5, 0.6, 0)), f: 40 })],
    // the window shrinks
    [T.window2 - 0.05, T.then - 0.05, (u) => ({ p: V3(0, lerp(4, 2, u), lerp(40, 30, u)), g: V3(0, 0, 0), f: 38 })],
    // turbulence + jolt + stall
    [T.then - 0.05, T.nose - 0.05, (u) => ({ p: V3(lerp(20, 15, u), lerp(5, 3.5, u), lerp(28, 22, u)), g: V3(-1, 0, 0), f: 44 })],
    // dive: chase camera
    [T.nose - 0.05, T.pilots2 - 0.05, (u) => ({ p: jetPt(-22, 6, 10), g: jetPt(6, -2, 0), f: 48 })],
    // cockpit
    [T.pilots2 - 0.05, T.rare - 0.05, (u) => ({ p: CP.clone().add(V3(lerp(0.3, 0, u), lerp(2.0, 2.2, u), lerp(2.6, 2.2, u))), g: CP.clone().add(V3(0, 1.4, -3.5)), f: 54 })],
    // rare: calm dawn, wide orbit
    [T.rare - 0.05, T.but - 0.05, (u) => { const a = lerp(2.2, 2.9, u); return { p: V3(Math.cos(a) * 30, 5, Math.sin(a) * 30), g: V3(0, 0, 0), f: 38 }; }],
    // but when it lines up: night again, slow push
    [T.but - 0.05, T.follow - 0.05, (u) => ({ p: V3(lerp(-40, -26, u), lerp(14, 8, u), lerp(-30, -20, u)), g: V3(0, -1, 0), f: 36 })],
    // outro: jet flies away into the moonlight
    [T.follow - 0.05, DUR + 1, (u, t) => { const e = eio(st(T.follow, DUR, t)); return { p: V3(lerp(-14, -40, e), lerp(2, 6, e), lerp(16, 30, e)), g: V3(lerp(2, 20, e), 0, 0), f: 40 }; }],
  ];
}
buildShots();
function placeCamera(t) {
  jet.updateMatrixWorld(true);
  const s = SHOTS.find((x) => t >= x[0] && t < x[1]) || SHOTS[SHOTS.length - 1];
  const u = cl((t - Math.max(0, s[0])) / (s[1] - Math.max(0, s[0])));
  const c = s[2](u, t); const sk = camShake(t);
  camera.position.copy(c.p).add(V3(Math.sin(t * 0.9) * 0.08 + Math.sin(t * 29) * sk, Math.sin(t * 1.3) * 0.06 + Math.sin(t * 23) * sk, Math.sin(t * 17) * sk * 0.5));
  camera.fov = c.f; camera.updateProjectionMatrix(); camera.up.set(0, 1, 0); camera.lookAt(c.g);
}
// the vanishing jet in hook 3: it dips into the cloud deck
function hookDive(t) { return st(T.seventy, T.gone, t); }

// ---------------------------------------------------------------- 2D overlay (HUD + icons, no captions)
function scr(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, ok: p.z < 1 }; }
const pop = (age, d = 0.25) => eob(cl(age / d));
function txt(s, x, y, size, fill, stroke = '#000', sw = 0.12, font = 'Luckiest Guy') { ctx.font = `${size}px "${font}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = size * sw; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y); }
function radar(t, a) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; const cx = W / 2, cy = 560, R0 = 330;
  ctx.fillStyle = 'rgba(2,20,12,0.86)'; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 7); ctx.fill(); ctx.strokeStyle = '#2ee88a'; ctx.lineWidth = 4; for (let r = 1; r <= 3; r++) { ctx.beginPath(); ctx.arc(cx, cy, R0 * r / 3, 0, 7); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(cx - R0, cy); ctx.lineTo(cx + R0, cy); ctx.moveTo(cx, cy - R0); ctx.lineTo(cx, cy + R0); ctx.stroke();
  const ang = t * 2.4; const gr = ctx.createConicGradient ? ctx.createConicGradient(ang - 0.9, cx, cy) : null; if (gr) { gr.addColorStop(0, 'rgba(46,232,138,0)'); gr.addColorStop(0.14, 'rgba(46,232,138,0.55)'); gr.addColorStop(0.145, 'rgba(46,232,138,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 7); ctx.fill(); }
  const gone = t > T.gone - 0.05; const bx = cx + 90, by = cy - 110;
  if (!gone || Math.floor(t * 6) % 2) { ctx.fillStyle = gone ? 'rgba(255,60,60,0.9)' : '#7dffb7'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(bx, by, gone ? 16 : 13, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
  if (gone) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(bx, by, 40 + ((t * 80) % 40), 0, 7); ctx.stroke(); }
  ctx.restore();
}
function altTag(x, y, alt, col = '#ffffff', a = 1) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,10,24,0.72)'; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(x - 190, y - 52, 380, 104, 22); ctx.fill(); ctx.stroke(); txt(`${Math.round(alt).toLocaleString('en-US')} ft`, x, y + 4, 70, col, '#000', 0.06, 'Luckiest Guy'); ctx.restore(); }
function gauge(x, y, s, v, zones) { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = 'rgba(8,10,24,0.85)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 120, 0, 7); ctx.fill(); ctx.stroke(); const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25; for (const [z0, z1, c] of zones) { ctx.strokeStyle = c; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(0, 0, 100, lerp(a0, a1, z0), lerp(a0, a1, z1)); ctx.stroke(); } const a = lerp(a0, a1, v); ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 88, Math.sin(a) * 88); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill(); ctx.restore(); }
function cornerChart(t, s) {
  if (s <= 0) return; ctx.save(); ctx.translate(W / 2, 520); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(8,10,24,0.82)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(-380, -300, 760, 560, 34); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-320, -250); ctx.lineTo(-320, 220); ctx.lineTo(330, 220); ctx.stroke();
  const u = eo(st(T.coffin - 0.4, T.coffin + 0.8, t));
  ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.strokeStyle = '#4cc9f0'; ctx.beginPath(); ctx.moveTo(-280, 200); ctx.quadraticCurveTo(-150, 20, lerp(-280, 10, u), lerp(200, -200, u)); ctx.stroke();
  ctx.strokeStyle = '#ff3b4a'; ctx.beginPath(); ctx.moveTo(290, 200); ctx.quadraticCurveTo(170, 20, lerp(290, 30, u), lerp(200, -200, u)); ctx.stroke();
  ctx.fillStyle = 'rgba(46,232,138,0.18)'; ctx.beginPath(); ctx.moveTo(-280, 200); ctx.quadraticCurveTo(-150, 20, 10, -200); ctx.lineTo(30, -200); ctx.quadraticCurveTo(170, 20, 290, 200); ctx.closePath(); ctx.globalAlpha = u; ctx.fill(); ctx.globalAlpha = 1;
  const jy = lerp(150, -170, eo(st(T.coffin, T.coffin + 1.0, t)));
  ctx.save(); ctx.translate(20, jy); ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-20, -12); ctx.lineTo(-14, 0); ctx.lineTo(-20, 12); ctx.closePath(); ctx.fill(); ctx.restore();
  if (u > 0.9) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(20, -200, 40 + Math.sin(t * 8) * 6, 0, 7); ctx.stroke(); }
  ctx.restore();
}
function iconIce(x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = 'rgba(12,30,60,0.9)'; ctx.strokeStyle = '#9fe0ff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-80, -80, 160, 160, 26); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#dff4ff'; ctx.lineWidth = 9; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * -50, Math.sin(a) * -50); ctx.lineTo(Math.cos(a) * 50, Math.sin(a) * 50); ctx.stroke(); } ctx.restore(); }
function iconTurb(x, y, s, t) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = 'rgba(40,20,60,0.9)'; ctx.strokeStyle = '#c59bff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-80, -80, 160, 160, 26); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#e8d8ff'; ctx.lineWidth = 8; ctx.beginPath(); for (let a = 0; a < 12; a += 0.1) { const r = a * 4.5; ctx.lineTo(Math.cos(a + t * 3) * r, Math.sin(a + t * 3) * r); } ctx.stroke(); ctx.restore(); }
function iconWindow(x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = 'rgba(60,12,20,0.9)'; ctx.strokeStyle = '#ff6b7a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-80, -80, 160, 160, 26); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff3b4a'; ctx.fillRect(-60, -55, 22, 110); ctx.fillRect(38, -55, 22, 110); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(-20, -12); ctx.lineTo(-14, 0); ctx.lineTo(-20, 12); ctx.fill(); ctx.restore(); }
function arrowUp(x, y, len, col, w = 18) { ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - len); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - w * 2, y - len + 10); ctx.lineTo(x + w * 2, y - len + 10); ctx.lineTo(x, y - len - w * 2.4); ctx.fill(); ctx.restore(); }
function bolt2D(x, y, t) { ctx.save(); ctx.strokeStyle = 'rgba(230,240,255,0.95)'; ctx.shadowColor = '#cfe0ff'; ctx.shadowBlur = 30; ctx.lineWidth = 7; const r = rng(Math.floor(t * 4)); let xx = x, yy = y; ctx.beginPath(); ctx.moveTo(xx, yy); for (let i = 0; i < 9; i++) { xx += (r() - 0.5) * 120; yy += 60 + r() * 40; ctx.lineTo(xx, yy); } ctx.stroke(); ctx.restore(); }
function check(x, y, s) { if (s <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#2ec27e'; ctx.strokeStyle = '#0b2a1a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 70, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-32, 2); ctx.lineTo(-8, 26); ctx.lineTo(36, -24); ctx.stroke(); ctx.restore(); }
function shareIcons(t, s) { if (s <= 0) return; ctx.save(); ctx.translate(W / 2, 450); ctx.scale(s, s); for (const [dx, kind] of [[-110, 'plus'], [110, 'send']]) { ctx.save(); ctx.translate(dx, 0); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 80, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#ff3b4a'; ctx.fillStyle = '#ff3b4a'; ctx.lineWidth = 16; ctx.lineCap = 'round'; if (kind === 'plus') { ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.moveTo(0, -34); ctx.lineTo(0, 34); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, -32); ctx.lineTo(14, 40); ctx.lineTo(4, 10); ctx.closePath(); ctx.fill(); } ctx.restore(); } ctx.restore(); }

function overlay(t) {
  // cinematic vignette + letterbox feel
  const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.22, W / 2, H * 0.5, H * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // HOOK: altitude tag, radar, blip vanish
  if (t > 0.3 && t < T.seventy - 0.1) altTag(W / 2, 300, 35000, '#ffffff', pop(t - 0.4, 0.35));
  if (t > T.seventy - 0.1 && t < T.no - 0.05) radar(t, pop(t - T.seventy + 0.1, 0.2));
  if (t > T.gone - 0.05 && t < T.gone + 0.12) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (t - T.gone + 0.05) / 0.17)})`; ctx.fillRect(0, 0, W, H); }
  // no explosion / no engine failure: crossed icons
  if (t > T.no - 0.05 && t < T.up - 0.05) { for (const [t0, x] of [[T.no, W / 2 - 170], [T.engine - 0.3, W / 2 + 170]]) { const s = pop(t - t0, 0.2); if (s > 0) { ctx.save(); ctx.translate(x, 380); ctx.scale(s, s); ctx.fillStyle = 'rgba(8,10,24,0.85)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 95, 0, 7); ctx.fill(); ctx.stroke(); if (x < W / 2) { ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 30 : 62; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); } else { ctx.strokeStyle = '#cfd6e0'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 50, 0, 7); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t * 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); ctx.stroke(); } } ctx.strokeStyle = '#ff3b4a'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-65, -65); ctx.lineTo(65, 65); ctx.stroke(); ctx.restore(); } } }
  if (t > T.what - 0.1 && t < T.up - 0.05) txt('?', W / 2, 640, 220 * pop(t - T.what + 0.1), '#ffd23f', '#000', 0.1);
  // speed window: slow / fast gauges over the walls
  if (t > T.window - 0.1 && t < T.slow - 0.05) { gauge(W / 2 - 250, 1400, pop(t - T.window) * 0.8, 0.12, [[0, 0.25, '#4cc9f0']]); gauge(W / 2 + 250, 1400, pop(t - T.window - 0.15) * 0.8, 0.9, [[0.75, 1, '#ff3b4a']]); }
  // LAB: lift label arrows
  if (t > T.slow - 0.05 && t < T.pilots - 0.05) { gauge(W / 2, 1450, 0.7, t < T.fast - 0.1 ? lerp(0.5, 0.12, st(T.slow, T.lifting, t)) : lerp(0.3, 0.95, st(T.fast - 0.1, T.fast + 0.5, t)), [[0, 0.25, '#4cc9f0'], [0.75, 1, '#ff3b4a']]); }
  // coffin corner chart
  if (t > T.coffin - 0.5 && t < T.now - 0.05) cornerChart(t, pop(t - T.coffin + 0.5, 0.3));
  // ice icon / lift stolen
  if (t > T.ice - 0.1 && t < T.window2 - 0.05) { iconIce(W - 170, 300, pop(t - T.ice + 0.1) * 0.9); }
  if (t > T.steal - 0.2 && t < T.window2 - 0.05) { const l = lerp(260, 120, eo(st(T.steal, T.steal + 0.8, t))); arrowUp(170, 560, l, l < 200 ? '#ff5a5a' : '#4ef0a0'); }
  // window shrinks: speed gauge zones squeeze
  if (t > T.window2 - 0.05 && t < T.then - 0.05) { const k = eo(st(T.shrinks - 0.3, T.shrinks + 0.6, t)); gauge(W / 2, 1420, 0.85, 0.55, [[0, lerp(0.25, 0.45, k), '#4cc9f0'], [lerp(0.75, 0.62, k), 1, '#ff3b4a']]); }
  // turbulence: lightning bolts + stall warning
  const fl = flashAmt(t); if (fl > 0.5) bolt2D(150 + (Math.floor(t * 4) % 3) * 360, 80, t);
  if (t > T.stalls - 0.1 && t < T.pilots2 - 0.05) { const on = Math.floor(t * 5) % 2; if (on) { ctx.save(); ctx.fillStyle = 'rgba(255,30,30,0.22)'; ctx.fillRect(0, 0, W, 30); ctx.fillRect(0, H - 30, W, 30); ctx.fillRect(0, 0, 30, H); ctx.fillRect(W - 30, 0, 30, H); ctx.restore(); } }
  // dive: altitude unwinding
  if (t > T.nose - 0.05 && t < T.rare - 0.05) { altTag(W / 2, 300, altitude(t), '#ff5a5a', 1); const vs = Math.min(1, st(T.nose, T.thousands + 1, t)); gauge(W / 2, 1420, 0.85, lerp(0.5, 0.97, vs), [[0.8, 1, '#ff3b4a']]); }
  // rare: safety checks
  if (t > T.warnings - 0.2 && t < T.but - 0.05) { [0, 1, 2].forEach((i) => check(W / 2 - 220 + i * 220, 420, pop(t - (T.warnings - 0.2 + i * 0.35)) * 0.9)); }
  // line up: three icons align
  if (t > T.but - 0.05 && t < T.follow - 0.05) {
    const a = st(T.but, T.but + 0.6, t), al = eio(st(T.line - 0.3, T.line + 0.4, t));
    const ys = [lerp(330, 430, al), lerp(520, 430, al), lerp(380, 430, al)];
    iconIce(W / 2 - 230, ys[0], pop(t - T.but) * 0.8); iconTurb(W / 2, ys[1], pop(t - T.but - 0.2) * 0.8, t); iconWindow(W / 2 + 230, ys[2], pop(t - T.but - 0.4) * 0.8);
    if (al > 0.95) { ctx.save(); ctx.strokeStyle = '#ff3b4a'; ctx.lineWidth = 8; ctx.shadowColor = '#ff3b4a'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.roundRect(W / 2 - 340, 330, 680, 200, 30); ctx.stroke(); ctx.restore(); }
  }
  if (t > T.follow - 0.1) shareIcons(t, pop(t - T.follow + 0.1, 0.3));
  const fade = Math.max(1 - st(0, 0.3, t), st(DUR - 0.6, DUR, t)); if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  for (const tc of [T.no, T.slow, T.nose, T.rare]) { const u = (t - tc) / 0.14; if (u >= 0 && u < 1) { ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - u)})`; ctx.fillRect(0, 0, W, H); } }
}

window.renderFrame = (t, q = 0.92) => {
  placeSky(t);
  // hook 3: jet drops into the cloud deck
  const hd = hookDive(t); if (hd > 0 && t < T.no) { jet.position.y -= ei(hd) * 22; jet.rotation.z = -0.5 * eio(hd); }
  placeLab(t); placeCockpit(t); placeCamera(t);
  composer.render();
  ctx.clearRect(0, 0, W, H); ctx.drawImage(glCanvas, 0, 0); overlay(t);
  return out.toDataURL('image/jpeg', q);
};
document.fonts.load('96px "Luckiest Guy"').then(() => { window.READY = true; });

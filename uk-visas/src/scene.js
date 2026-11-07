// UK work visas 2027: cinematic 3D globe explainer (visuals only, no audio).
// Every frame is a pure function of time t, so render workers can split the timeline.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const DURATION = 60;
const GEO = await (await fetch('/data/geo.json')).json();
for (const [file, w] of [['mukta-devanagari-800-normal', '800'], ['mukta-latin-800-normal', '800']]) {
  const f = new FontFace('Mukta', `url(/node_modules/@fontsource/mukta/files/${file}.woff2)`, { weight: w });
  document.fonts.add(await f.load());
}

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const backOut = (x) => { x = clamp(x, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const D = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function ll(lat, lon, r = 1) { const a = lat * D, o = lon * D; return V(r * Math.cos(a) * Math.cos(o), r * Math.sin(a), -r * Math.cos(a) * Math.sin(o)); }
// window in/out envelope for overlays and pop-ins
const win = (t, t0, t1, fi = 0.35, fo = 0.3) => smooth(t0, t0 + fi, t) * (1 - smooth(t1 - fo, t1, t));

// ---------------------------------------------------------------- renderer
const W = window.__W || 1080, H = window.__H || 1920;
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.0005, 100);
const loader = new THREE.TextureLoader();
const loadTex = (u) => new Promise((res) => loader.load(u, res));
const [dayTex, topoTex, waterImgTex, cloudTex, skyTex] = await Promise.all(['/assets/earth-blue-marble.jpg', '/assets/earth-topology.png', '/assets/earth-water.png', '/assets/clouds.png', '/assets/night-sky.png'].map(loadTex));
dayTex.colorSpace = THREE.SRGBColorSpace; dayTex.anisotropy = 16;
skyTex.colorSpace = THREE.SRGBColorSpace; skyTex.mapping = THREE.EquirectangularReflectionMapping;
scene.background = skyTex; scene.backgroundIntensity = 0.55;
// shiny oceans: roughness map = inverted water mask
const roughTex = (() => {
  const img = waterImgTex.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) { const v = 255 - d.data[i] * 0.75; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; }
  g.putImageData(d, 0, 0); return new THREE.CanvasTexture(c);
})();

// ---------------------------------------------------------------- globe
const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 256), new THREE.MeshStandardMaterial({ map: dayTex, bumpMap: topoTex, bumpScale: 0.006, roughnessMap: roughTex, roughness: 1, metalness: 0.05 }));
earth.receiveShadow = true; scene.add(earth);
const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 128, 128), new THREE.MeshStandardMaterial({ alphaMap: cloudTex, color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
scene.add(clouds);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 96), new THREE.ShaderMaterial({
  side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float i = pow(clamp(0.72 + dot(vN, vV), 0.0, 1.0), 4.0); gl_FragColor = vec4(0.35,0.62,1.0,1.0)*i*1.4; }',
}));
scene.add(atmo);
const sun = new THREE.DirectionalLight(0xfff4e6, 3.0); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0002;
scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x223344, 0.55));

// world borders and coastlines as thin lines on the surface
function linesGeo(lines, r) {
  const pos = [];
  for (const l of lines) for (let i = 1; i < l.length; i++) { const a = ll(l[i - 1][1], l[i - 1][0], r), b = ll(l[i][1], l[i][0], r); pos.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
}
const borderLines = new THREE.LineSegments(linesGeo(GEO.borders, 1.0012), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
const coastLines = new THREE.LineSegments(linesGeo(GEO.coasts, 1.0011), new THREE.LineBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.3 }));
scene.add(borderLines, coastLines);

// high-res UK highlight patch (sharp borders even when zoomed right in)
const PATCH = { lon0: -11, lon1: 7, lat0: 49, lat1: 62, ppd: 210 };
function ukCanvas(fill, glow) {
  const w = Math.round((PATCH.lon1 - PATCH.lon0) * PATCH.ppd), h = Math.round((PATCH.lat1 - PATCH.lat0) * PATCH.ppd);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const X = (lon) => (lon - PATCH.lon0) * PATCH.ppd, Y = (lat) => (PATCH.lat1 - lat) * PATCH.ppd;
  const path = () => { g.beginPath(); for (const poly of GEO.uk) for (const ring of poly) { ring.forEach(([lon, lat], i) => (i ? g.lineTo(X(lon), Y(lat)) : g.moveTo(X(lon), Y(lat)))); g.closePath(); } };
  path(); g.fillStyle = fill; g.fill('evenodd');
  g.lineJoin = 'round'; g.shadowColor = glow; g.shadowBlur = 40; g.lineWidth = 14; g.strokeStyle = glow; path(); g.stroke();
  g.shadowBlur = 0; g.lineWidth = 4; g.strokeStyle = '#ffffff'; path(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t;
}
function patchMesh(tex) {
  const g = new THREE.SphereGeometry(1.0016, 96, 96, (PATCH.lon0 + 180) * D, (PATCH.lon1 - PATCH.lon0) * D, (90 - PATCH.lat1) * D, (PATCH.lat1 - PATCH.lat0) * D);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  m.renderOrder = 2; scene.add(m); return m;
}
const ukGold = patchMesh(ukCanvas('rgba(255,196,0,0.30)', '#ffc400'));
const ukRed = patchMesh(ukCanvas('rgba(255,40,40,0.30)', '#ff3030'));
const ukGreen = patchMesh(ukCanvas('rgba(40,255,120,0.32)', '#2bff7a'));

// ---------------------------------------------------------------- placing things on the globe
const _f = new THREE.Vector3(), _m4 = new THREE.Matrix4();
function placeOn(obj, lat, lon, faceTo = null, heading = 0, lift = 0) {
  const n = ll(lat, lon).normalize();
  obj.position.copy(n).multiplyScalar(1.0014 + lift);
  let fwd;
  if (faceTo) { fwd = faceTo.clone().sub(obj.position); fwd.sub(n.clone().multiplyScalar(fwd.dot(n))).normalize(); }
  else { const north = V(-Math.sin(lat * D) * Math.cos(lon * D), Math.cos(lat * D), Math.sin(lat * D) * Math.sin(lon * D)); const east = V(-Math.sin(lon * D), 0, -Math.cos(lon * D)); fwd = north.multiplyScalar(Math.cos(heading)).add(east.multiplyScalar(Math.sin(heading))).normalize(); }
  const right = new THREE.Vector3().crossVectors(n, fwd).normalize();
  _m4.makeBasis(right, n, fwd); obj.quaternion.setFromRotationMatrix(_m4);
}

// ---------------------------------------------------------------- 3D people
const mat = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
function makeHuman(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = mat(o.skin || '#c58b65', 0.55), shirt = mat(o.shirt), pants = mat(o.pants || '#2c3440'), shoe = mat('#1d1d1d', 0.5);
  const cap = (r, h, m) => { const me = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, 14), m); me.castShadow = true; return me; };
  const hips = new THREE.Group(); hips.position.y = 0.93; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = cap(0.17, 0.34, shirt); chest.scale.set(1.22, 1, 0.72); chest.position.y = 0.3; torso.add(chest);
  if (o.vest) { const v = cap(0.175, 0.3, mat(o.vest, 0.5)); v.scale.set(1.24, 0.92, 0.75); v.position.y = 0.3; torso.add(v); for (const y of [0.22, 0.38]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.03, 20, 1, true), mat('#d8d8d8', 0.2, 0.6)); s.scale.set(1.0, 1, 0.62); s.position.y = y; torso.add(s); } }
  if (o.tie) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.02), mat(o.tie, 0.5)); t.position.set(0, 0.4, 0.125); torso.add(t); const sh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.02), mat('#f2f2f2', 0.6)); sh.position.set(0, 0.42, 0.118); torso.add(sh); }
  if (o.backpack) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.16), mat(o.backpack, 0.8)); b.position.set(0, 0.32, -0.19); b.castShadow = true; torso.add(b); }
  const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck);
  const nk = cap(0.05, 0.06, skin); nk.position.y = 0.02; neck.add(nk);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 18), skin); head.position.y = 0.15; head.scale.set(0.9, 1.08, 0.97); head.castShadow = true; neck.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), mat('#ffffff', 0.3)); eye.position.set(s * 0.04, 0.17, 0.098); neck.add(eye);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mat('#1a120c', 0.2)); pu.position.set(s * 0.04, 0.17, 0.112); neck.add(pu);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.01), mat(o.hair || '#20160f')); brow.position.set(s * 0.04, 0.198, 0.105); neck.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), skin); ear.position.set(s * 0.105, 0.15, 0); ear.scale.set(0.5, 1, 0.8); neck.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 8), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.14, 0.115); neck.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.007, 0.01), mat('#7a3b33')); mouth.position.set(0, 0.095, 0.105); neck.add(mouth);
  if (o.hair) { const hr = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(o.hair, 0.9)); hr.position.y = 0.165; hr.rotation.x = -0.3; neck.add(hr); }
  if (o.beard) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), mat(o.hair || '#1a1410', 0.95)); b.position.set(0, 0.15, 0.012); neck.add(b); }
  if (o.hardhat) { const hm = mat(o.hardhat, 0.35); const d = new THREE.Mesh(new THREE.SphereGeometry(0.136, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm); d.position.y = 0.2; d.castShadow = true; neck.add(d); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.015, 24), hm); br.position.set(0, 0.2, 0.03); neck.add(br); }
  if (o.capHat) { const hm = mat(o.capHat, 0.6); const d = new THREE.Mesh(new THREE.SphereGeometry(0.128, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm); d.position.y = 0.19; neck.add(d); const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.11), hm); v.position.set(0, 0.19, 0.15); neck.add(v); }
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.215, 0.5, 0); torso.add(sh);
    const up = cap(0.055, 0.24, shirt); up.position.y = -0.15; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const fo = cap(0.048, 0.22, o.short ? skin : shirt); fo.position.y = -0.13; el.add(fo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), skin); hand.position.y = -0.29; el.add(hand);
    return { sh, el, hand };
  };
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(s * 0.1, 0, 0); hips.add(hp);
    const th = cap(0.075, 0.32, pants); th.position.y = -0.22; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
    const sn = cap(0.062, 0.32, pants); sn.position.y = -0.21; kn.add(sn);
    const sho = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.25), shoe); sho.position.set(0, -0.44, 0.05); sho.castShadow = true; kn.add(sho);
    return { hp, kn };
  };
  const A = [arm(-1), arm(1)], L = [leg(-1), leg(1)];
  const pel = cap(0.13, 0.08, pants); pel.scale.set(1.3, 1, 0.8); pel.position.y = 0.02; hips.add(pel);
  if (o.suitcase) { const sc = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.18), mat(o.suitcase, 0.4, 0.2)); b.position.y = -0.24; b.castShadow = true; sc.add(b); const hd = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), mat('#222')); hd.position.y = 0.02; sc.add(hd); sc.position.y = -0.33; A[1].hand.add(sc); }
  if (o.box) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.3), mat('#b9894f', 0.85)); b.position.set(-0.21, -0.28, 0.12); b.castShadow = true; A[1].hand.add(b); }
  if (o.paper) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.01), mat('#ffffff', 0.6)); p.position.set(0, -0.08, 0.06); A[1].hand.add(p); }
  return { root, body, hips, torso, neck, A, L };
}
function pose(h, kind, ph = 0) {
  const sn = Math.sin(ph), cs = Math.cos(ph);
  for (const a of h.A) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
  for (const l of h.L) { l.hp.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); }
  h.torso.rotation.set(0, 0, 0); h.neck.rotation.set(0, 0, 0); h.hips.position.y = 0.93;
  if (kind === 'stand') { h.A[0].sh.rotation.z = -0.1; h.A[1].sh.rotation.z = 0.1; h.A[0].el.rotation.x = -0.12; h.A[1].el.rotation.x = -0.12; h.torso.rotation.y = 0.05 * Math.sin(ph * 0.4); }
  else if (kind === 'talk') { h.A[0].sh.rotation.z = -0.1; h.A[1].sh.rotation.x = -0.6 - 0.2 * Math.sin(ph * 1.7); h.A[1].el.rotation.x = -1.1 + 0.25 * Math.sin(ph * 2.3); h.A[1].sh.rotation.z = 0.25; h.neck.rotation.y = 0.15 * Math.sin(ph * 0.7); }
  else if (kind === 'walk' || kind === 'run') {
    const run = kind === 'run', a = run ? 0.85 : 0.45;
    h.torso.rotation.x = run ? 0.25 : 0.04;
    h.L[0].hp.rotation.x = a * sn; h.L[1].hp.rotation.x = -a * sn;
    h.L[0].kn.rotation.x = -Math.max(0, -cs) * (run ? 1.3 : 0.7) - 0.08; h.L[1].kn.rotation.x = -Math.max(0, cs) * (run ? 1.3 : 0.7) - 0.08;
    h.A[0].sh.rotation.x = -a * sn * 0.8; h.A[1].sh.rotation.x = a * sn * 0.8 * (h.carry ? 0.15 : 1);
    h.A[0].el.rotation.x = run ? -1.2 : -0.25; h.A[1].el.rotation.x = h.carry ? -0.1 : run ? -1.2 : -0.25;
    h.hips.position.y = 0.93 + Math.abs(sn) * 0.03;
  } else if (kind === 'cheer') { h.A[0].sh.rotation.x = -2.9 - 0.2 * Math.abs(sn); h.A[1].sh.rotation.x = -2.9 - 0.2 * Math.abs(cs); h.A[0].sh.rotation.z = -0.3; h.A[1].sh.rotation.z = 0.3; h.hips.position.y = 0.93 + 0.05 * Math.abs(sn); }
  else if (kind === 'wave') { h.A[1].sh.rotation.x = -2.6; h.A[1].sh.rotation.z = 0.35 + 0.35 * Math.sin(ph * 3); h.A[0].sh.rotation.z = -0.1; }
  else if (kind === 'carry') { h.A[0].sh.rotation.x = -1.0; h.A[1].sh.rotation.x = -1.0; h.A[0].el.rotation.x = -0.6; h.A[1].el.rotation.x = -0.6; }
}
const SCALE = 0.016; // 1.8 m figure -> ~0.029 globe units
function person(o) { const h = makeHuman(o); h.root.scale.setScalar(SCALE * (o.size || 1)); h.root.visible = false; scene.add(h.root); return h; }
const official = person({ shirt: '#22293a', pants: '#22293a', tie: '#9b1b2a', hair: '#8f8a84', skin: '#e2b49a', paper: true, size: 1.0 });
const travelers = [
  person({ shirt: '#3b6fb6', pants: '#2b2f38', hair: '#1b130d', suitcase: '#c0392b', skin: '#a9714b', beard: true }),
  person({ shirt: '#e8e2d4', pants: '#4a5568', hair: '#120c08', suitcase: '#2c3e50', skin: '#8d5a3b' }),
  person({ shirt: '#2e8b57', pants: '#2b2f38', hair: '#24170f', suitcase: '#f39c12', skin: '#c18a62', backpack: '#3d3d3d' }),
  person({ shirt: '#8e44ad', pants: '#333', hair: '#0d0806', suitcase: '#16a085', skin: '#6b4430' }),
];
const student = person({ shirt: '#d35400', pants: '#34495e', hair: '#1a110b', backpack: '#2c3e50', skin: '#b37a52' });
const leaver = person({ shirt: '#5d6d7e', pants: '#2b2f38', hair: '#1a110b', vest: '#f4d03f', hardhat: '#f1c40f', skin: '#a26b47', beard: true });
const workers = [
  person({ shirt: '#c0392b', pants: '#2b2f38', capHat: '#c0392b', box: true, skin: '#a9714b', hair: '#1a110b' }),            // delivery rider
  person({ shirt: '#566573', pants: '#2b2f38', vest: '#ff8c1a', hardhat: '#ffffff', skin: '#8d5a3b', hair: '#120c08' }),      // warehouse
  person({ shirt: '#4e7d3a', pants: '#5b4636', capHat: '#d4ac0d', skin: '#b37a52', hair: '#1a110b', beard: true }),          // farm
  person({ shirt: '#2471a3', pants: '#2b2f38', skin: '#c18a62', hair: '#24170f' }),                                           // market
  person({ shirt: '#566573', pants: '#2b2f38', vest: '#c6ff1a', hardhat: '#f1c40f', skin: '#6b4430', hair: '#0d0806' }),
  person({ shirt: '#a04000', pants: '#34495e', skin: '#a26b47', hair: '#1a110b', capHat: '#1f618d' }),
];

// ---------------------------------------------------------------- 3D icons (jobs), flag, gates, pins
function iconGroup() { const g = new THREE.Group(); g.visible = false; scene.add(g); return g; }
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me; };
const deliveryIcon = iconGroup(); {
  const g = deliveryIcon, white = mat('#f5f5f5', 0.35, 0.2), red = mat('#d32f2f', 0.4);
  g.add(box(1.6, 1.0, 0.95, white, -0.25, 0.75, 0)); g.add(box(0.75, 0.75, 0.95, red, 0.9, 0.62, 0)); g.add(box(0.05, 0.35, 0.8, mat('#203040', 0.1, 0.5), 1.28, 0.8, 0));
  g.add(box(1.62, 0.12, 0.97, red, -0.25, 0.5, 0));
  for (const x of [-0.65, 0.85]) for (const z of [-0.48, 0.48]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 18).rotateX(Math.PI / 2), mat('#1b1b1b', 0.8)); w.position.set(x, 0.22, z); g.add(w); }
  for (let k = 0; k < 3; k++) g.add(box(0.36, 0.3, 0.36, mat('#b9894f', 0.85), -1.3 - k * 0.05, 0.15 + k * 0.3, 0.55));
}
const warehouseIcon = iconGroup(); {
  const g = warehouseIcon; g.add(box(2.2, 1.1, 1.6, mat('#9aa6b2', 0.6, 0.3), 0, 0.55, 0));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.24, 24, 1, false, -Math.PI / 2, Math.PI), mat('#5d6d7e', 0.5, 0.4)); roof.rotation.z = Math.PI / 2; roof.position.y = 1.1; roof.scale.set(1, 1, 0.45); roof.castShadow = true; g.add(roof);
  for (const x of [-0.6, 0.0, 0.6]) g.add(box(0.42, 0.6, 0.04, mat('#e67e22', 0.5), x, 0.32, 0.81));
  for (let k = 0; k < 4; k++) g.add(box(0.3, 0.3, 0.3, mat('#b9894f', 0.85), -0.9 + k * 0.32, 0.15, 1.15));
}
const farmIcon = iconGroup(); {
  const g = farmIcon; g.add(box(2.6, 0.06, 2.0, mat('#6d4c2f', 1), 0, 0.03, 0));
  for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), mat('#3f9b2e', 0.9)); p.position.set(-1.1 + k * 0.36, 0.23, -0.8 + r * 0.32); g.add(p); }
  const barn = new THREE.Group(); barn.add(box(0.9, 0.7, 0.8, mat('#b03a2e', 0.7), 0, 0.35, 0)); const rf = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.45, 4), mat('#7b241c', 0.7)); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.8); rf.position.y = 0.92; barn.add(rf); barn.position.set(1.6, 0, -0.4); g.add(barn);
}
const marketIcon = iconGroup(); {
  const g = marketIcon; g.add(box(1.8, 0.7, 0.8, mat('#8d6e63', 0.8), 0, 0.35, 0));
  for (let k = 0; k < 6; k++) g.add(box(0.3, 0.06, 0.94, mat(k % 2 ? '#ffffff' : '#e74c3c', 0.6), -0.75 + k * 0.3, 1.55, 0.05));
  for (const x of [-0.85, 0.85]) g.add(box(0.06, 0.9, 0.06, mat('#5d4037'), x, 1.1, 0.4));
  const fruit = ['#e74c3c', '#f1c40f', '#27ae60', '#e67e22'];
  for (let k = 0; k < 12; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(fruit[k % 4], 0.5)); f.position.set(-0.7 + (k % 6) * 0.28, 0.78, -0.15 + Math.floor(k / 6) * 0.3); g.add(f); }
}
const ICONS = [
  { g: deliveryIcon, lat: 52.75, lon: -3.0, label: 'DELIVERY', t: 33.2, dx: -230, dy: -40 },
  { g: warehouseIcon, lat: 54.3, lon: -2.2, label: 'WAREHOUSES', t: 34.5, dx: -150, dy: -230 },
  { g: farmIcon, lat: 52.75, lon: 0.9, label: 'FARM WORK', t: 35.8, dx: 200, dy: -230 },
  { g: marketIcon, lat: 51.35, lon: -0.6, label: 'MARKET JOBS', t: 37.1, dx: 210, dy: 110 },
];
for (const ic of ICONS) ic.g.scale.setScalar(0.014);

function unionJack() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 600; const g = c.getContext('2d');
  g.fillStyle = '#012169'; g.fillRect(0, 0, 1200, 600);
  g.strokeStyle = '#ffffff'; g.lineWidth = 120; g.beginPath(); g.moveTo(0, 0); g.lineTo(1200, 600); g.moveTo(1200, 0); g.lineTo(0, 600); g.stroke();
  g.save(); g.beginPath(); g.rect(0, 0, 1200, 600); g.clip(); g.strokeStyle = '#C8102E'; g.lineWidth = 40;
  // counterchanged red saltire
  const seg = (x0, y0, x1, y1, off) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * off, ny = dx / L * off; g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.lineTo((x0 + x1) / 2 + nx, (y0 + y1) / 2 + ny); g.stroke(); };
  seg(0, 0, 1200, 600, 20); seg(1200, 600, 0, 0, 20); seg(1200, 0, 0, 600, 20); seg(0, 600, 1200, 0, 20); g.restore();
  g.fillStyle = '#ffffff'; g.fillRect(500, 0, 200, 600); g.fillRect(0, 200, 1200, 200);
  g.fillStyle = '#C8102E'; g.fillRect(540, 0, 120, 600); g.fillRect(0, 240, 1200, 120);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { tex: t, canvas: c };
}
const UJ = unionJack();
const flag = new THREE.Group(); flag.visible = false; scene.add(flag);
const flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(2, 1, 40, 20), new THREE.MeshStandardMaterial({ map: UJ.tex, side: THREE.DoubleSide, roughness: 0.8 }));
flagCloth.position.set(1.0, 3.2, 0); flagCloth.castShadow = true; flag.add(flagCloth);
const fp0 = flagCloth.geometry.attributes.position.array.slice();
{ const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 3.8, 12), mat('#d0d4d8', 0.3, 0.9)); pole.position.y = 1.9; pole.castShadow = true; flag.add(pole); const k = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), mat('#f1c40f', 0.3, 0.9)); k.position.y = 3.82; flag.add(k); }
flag.scale.setScalar(0.017);
function waveFlag(t) { const p = flagCloth.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = fp0[i * 3], y = fp0[i * 3 + 1]; const u = (x + 1) / 2; p.setZ(i, Math.sin(u * 5 - t * 6) * 0.14 * u + Math.sin(y * 3 + t * 3) * 0.03 * u); } p.needsUpdate = true; flagCloth.geometry.computeVertexNormals(); }

// gates of England (finale)
const gates = new THREE.Group(); gates.visible = false; scene.add(gates);
const doors = [];
{
  const frameM = mat('#c9a227', 0.3, 0.9), doorM = mat('#0d2a5c', 0.45, 0.3), trimM = mat('#e8c547', 0.3, 0.9);
  gates.add(box(0.35, 4.4, 0.35, frameM, -2.15, 2.2, 0)); gates.add(box(0.35, 4.4, 0.35, frameM, 2.15, 2.2, 0)); gates.add(box(4.65, 0.4, 0.4, frameM, 0, 4.4, 0));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0), new THREE.MeshBasicMaterial({ color: '#ffcf4d', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(0, 2.1, -0.05); gates.add(glow); gates.userData.glow = glow;
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(s * 2.0, 0, 0); gates.add(hinge);
    const d = box(2.0, 4.0, 0.15, doorM, -s * 1.0, 2.05, 0); hinge.add(d);
    for (const y of [1.1, 2.9]) hinge.add(box(1.6, 1.3, 0.04, trimM, -s * 1.0, y, 0.09));
    hinge.add(box(1.4, 1.1, 0.05, doorM, -s * 1.0, 1.1, 0.1)); hinge.add(box(1.4, 1.1, 0.05, doorM, -s * 1.0, 2.9, 0.1));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), trimM); knob.position.set(-s * 1.8, 2.0, 0.15); hinge.add(knob);
    doors.push({ hinge, s });
  }
  gates.scale.setScalar(0.014);
}
// location pin (London)
const pin = new THREE.Group(); pin.visible = false; scene.add(pin);
{ const red = new THREE.MeshStandardMaterial({ color: '#e53935', roughness: 0.3, emissive: '#5a0000', emissiveIntensity: 0.4 }); const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), red); head.position.y = 2.0; const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 24), red); cone.rotation.x = Math.PI; cone.position.y = 1.05; const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat('#ffffff', 0.3)); dot.position.set(0, 2.0, 0.42); pin.add(head, cone, dot); pin.traverse((o) => { o.castShadow = true; }); pin.scale.setScalar(0.012); }
const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 64), new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
ring.visible = false; scene.add(ring);

// ---------------------------------------------------------------- arcs (great circles)
function arc(a, b, color, lift = 0.12) {
  const A = ll(a[0], a[1]).normalize(), B = ll(b[0], b[1]).normalize(), ang = A.angleTo(B), pts = [];
  for (let i = 0; i <= 80; i++) { const u = i / 80; const p = new THREE.Vector3().copy(A).multiplyScalar(Math.sin((1 - u) * ang)).add(B.clone().multiplyScalar(Math.sin(u * ang))).divideScalar(Math.sin(ang)); pts.push(p.normalize().multiplyScalar(1.002 + lift * ang * Math.sin(Math.PI * u))); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.0035, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const glowSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glowSp.scale.setScalar(0.07);
  tube.visible = head.visible = glowSp.visible = false; scene.add(tube, head, glowSp);
  return { curve, tube, head, glowSp, total: tube.geometry.index.count };
}
let _glow = null;
function glowTex() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); _glow = new THREE.CanvasTexture(c); return _glow; }
function showArc(A, u, alpha = 1) {
  const on = u > 0 && alpha > 0; A.tube.visible = A.head.visible = A.glowSp.visible = on; if (!on) return;
  const k = Math.floor(clamp(u, 0, 1) * A.total / 3) * 3; A.tube.geometry.setDrawRange(0, k); A.tube.material.opacity = 0.95 * alpha;
  const p = A.curve.getPointAt(clamp(u, 0, 1)); A.head.position.copy(p); A.glowSp.position.copy(p); A.glowSp.material.opacity = alpha;
  A.head.visible = A.glowSp.visible = u < 1;
}
const LONDON = [51.51, -0.13], UKC = [54.0, -2.5];
// people coming to the UK from around the world (no specific countries are named in the script)
const ARCS_IN = [[24, 70], [8, 4], [23, 90], [30, 31], [14, 101], [-1, 37], [46, 25], [19, 73]].map((o) => arc(o, LONDON, '#ffd21a'));
// students and workers leaving
const ARCS_OUT = [[40, 30], [20, 55], [35, 75], [5, 10], [45, -40]].map((o) => arc(LONDON, o, '#ff4040', 0.1));

// ---------------------------------------------------------------- camera keyframes
// [t, lat, lon, distance above surface, tilt deg, heading deg]
const KF = [
  [0.0, 28, 52, 5.2, 0, 0],
  [2.4, 54.0, -2.4, 0.62, 28, 0],
  [4.6, 53.6, -2.0, 0.5, 40, 18],
  [6.8, 40, 22, 2.3, 8, 0],          // pull out: the world, arcs converge on the UK
  [11.4, 44, 8, 1.9, 14, -12],
  [13.6, 53.8, -2.2, 0.6, 34, 0],
  [16.8, 53.6, -2.4, 0.5, 46, 55],   // orbit the UK (questions)
  [20.0, 51.5, -0.05, 0.26, 50, 75],  // dive to London
  [24.5, 51.5, -0.02, 0.22, 56, 100],
  [27.4, 49, 6, 1.15, 22, 40],       // pull back: people leaving
  [31.8, 53.4, -1.6, 0.5, 42, 15],
  [36.2, 52.9, -1.1, 0.4, 48, -20],  // jobs (left to right sweep)
  [40.6, 52.9, -1.0, 0.4, 48, 22],
  [44.0, 52.7, -1.1, 0.33, 58, 50],  // workers
  [46.8, 53.0, -1.4, 0.38, 54, 20],
  [50.4, 52, 3, 0.95, 26, -5],       // shortage: zoom out
  [53.0, 53.8, -2.2, 0.55, 38, -30], // visas open: UK turns green
  [55.8, 53.6, -2.0, 0.5, 44, -5],
  [57.6, 52.9, -1.5, 0.3, 58, 0],    // gates
  [60.0, 53.4, -1.8, 0.62, 42, 22],
];
function camAt(t) {
  let i = 0; while (i < KF.length - 2 && t > KF[i + 1][0]) i++;
  const a = KF[i], b = KF[i + 1], u = easeIO((t - a[0]) / (b[0] - a[0]));
  let dlon = b[2] - a[2]; if (dlon > 180) dlon -= 360; if (dlon < -180) dlon += 360;
  const lat = lerp(a[1], b[1], u), lon = a[2] + dlon * u;
  const travel = Math.hypot(b[1] - a[1], dlon) / 60;
  const dist = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u)) * (1 + 0.8 * travel * Math.sin(Math.PI * u));
  return { lat, lon, dist, tilt: lerp(a[4], b[4], u) * D, head: lerp(a[5], b[5], u) * D };
}
function setCamera(t) {
  const c = camAt(t);
  const P = ll(c.lat, c.lon), n = P.clone().normalize();
  const north = V(-Math.sin(c.lat * D) * Math.cos(c.lon * D), Math.cos(c.lat * D), Math.sin(c.lat * D) * Math.sin(c.lon * D));
  const east = V(-Math.sin(c.lon * D), 0, -Math.cos(c.lon * D));
  const fwd = north.clone().multiplyScalar(Math.cos(c.head)).add(east.clone().multiplyScalar(Math.sin(c.head)));
  camera.position.copy(P).addScaledVector(n, c.dist * Math.cos(c.tilt)).addScaledVector(fwd, -c.dist * Math.sin(c.tilt));
  camera.up.copy(n); camera.lookAt(P.clone().addScaledVector(n, 0.0));
  camera.fov = 50; camera.near = Math.max(0.0005, c.dist * 0.02); camera.updateProjectionMatrix();
  // sun from over the camera's left shoulder: the visible side is always in daylight
  const right = new THREE.Vector3().crossVectors(fwd, n);
  sun.position.copy(P).addScaledVector(n, 3).addScaledVector(right, -1.6).addScaledVector(fwd, -1.2);
  sun.target.position.copy(P);
  const s = Math.max(0.05, c.dist * 0.9); Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 6 }); sun.shadow.camera.updateProjectionMatrix();
  return c;
}

// ---------------------------------------------------------------- story state
function popScale(t, t0, dur = 0.45) { return t < t0 ? 0 : backOut((t - t0) / dur); }
function setState(t, cam) {
  clouds.rotation.y = t * 0.004;
  clouds.material.opacity = 0.55 * smooth(0.45, 1.4, cam.dist);
  // UK highlight colours
  const gold = Math.max(smooth(1.6, 2.6, t) * (1 - smooth(21.5, 22.5, t)), smooth(30.5, 31.5, t) * (1 - smooth(52.2, 53.0, t)));
  const red = smooth(22.0, 22.8, t) * (1 - smooth(30.5, 31.5, t));
  const green = smooth(52.4, 53.2, t);
  const pulse = 0.82 + 0.18 * Math.sin(t * 4);
  ukGold.material.opacity = gold * pulse; ukRed.material.opacity = red * pulse; ukGreen.material.opacity = green * pulse;
  borderLines.material.opacity = 0.35 + 0.25 * smooth(2.5, 0.6, cam.dist);

  // flag: opening and finale
  const flagOn = (t > 2.0 && t < 13.8) || t > 56.0;
  flag.visible = flagOn; if (flagOn) { const s0 = t < 14 ? 2.3 : 56.2; flag.scale.setScalar(0.017 * popScale(t, s0, 0.6) * (t < 14 ? 1 - smooth(13.2, 13.8, t) : 1)); placeOn(flag, 55.6, -3.6, camera.position); waveFlag(t); }

  // arcs: people heading to the UK (scene 2), people leaving (scene 4)
  ARCS_IN.forEach((A, k) => showArc(A, smooth(6.6 + k * 0.35, 9.4 + k * 0.35, t), 1 - smooth(13.0, 13.6, t)));
  ARCS_OUT.forEach((A, k) => showArc(A, smooth(26.8 + k * 0.3, 29.6 + k * 0.3, t), 1 - smooth(31.4, 32.0, t)));

  // travellers with suitcases arriving (end of scene 2 / scene 3)
  travelers.forEach((h, k) => {
    const on = t > 11.6 && t < 20.2; h.root.visible = on; if (!on) return;
    const s = popScale(t, 11.8 + k * 0.18) * (1 - smooth(19.6, 20.2, t));
    h.root.scale.setScalar(SCALE * 1.15 * s);
    const lat = 51.9 + (k % 2) * 0.45, lon = -1.6 + k * 0.62;
    placeOn(h.root, lat, lon, camera.position); pose(h, k % 2 ? 'wave' : 'stand', t * 2 + k);
  });
  // London pin + official (scene 4)
  pin.visible = t > 20.0 && t < 27.5; if (pin.visible) { pin.scale.setScalar(0.0065 * popScale(t, 20.1) * (1 - smooth(27.0, 27.5, t)) * (0.35 + 0.65 * smooth(0.5, 0.15, cam.dist))); placeOn(pin, LONDON[0], LONDON[1], camera.position, 0, 0.004 * Math.abs(Math.sin(t * 3)) * 0.4); }
  ring.visible = pin.visible; if (ring.visible) { const rp = ((t - 20) % 1.6) / 1.6; ring.scale.setScalar(0.01 + 0.035 * rp); ring.material.opacity = 0.8 * (1 - rp); ring.position.copy(ll(LONDON[0], LONDON[1], 1.0016)); ring.lookAt(ring.position.clone().multiplyScalar(2)); }
  official.root.visible = t > 21.0 && t < 27.4;
  if (official.root.visible) { official.root.scale.setScalar(SCALE * 1.15 * popScale(t, 21.1) * (1 - smooth(26.8, 27.4, t))); placeOn(official.root, 51.15, 1.0, camera.position); pose(official, 'talk', t * 2); }
  // a student and a worker walking out (scene 4b)
  for (const [h, k] of [[student, 0], [leaver, 1]]) {
    const on = t > 27.0 && t < 31.8; h.root.visible = on; if (!on) continue;
    const u = smooth(27.0, 31.8, t);
    h.root.scale.setScalar(SCALE * 1.6 * popScale(t, 27.1 + k * 0.2) * (1 - smooth(31.3, 31.8, t)));
    const lat = 52.2 + k * 0.9 - u * 0.4, lon = -1.2 + k * 0.8 + u * 2.6;
    placeOn(h.root, lat, lon, null, 1.75); pose(h, 'walk', t * 7 + k);
  }
  // jobs (scene 5) and the foreign workers who do them (scene 6)
  ICONS.forEach((ic) => {
    const on = t > ic.t && t < 47.2; ic.g.visible = on; if (!on) return;
    ic.g.scale.setScalar(0.014 * popScale(t, ic.t, 0.55) * (1 - smooth(46.6, 47.2, t)));
    placeOn(ic.g, ic.lat, ic.lon, camera.position, 0, 0.0004 * Math.sin(t * 2 + ic.lat));
  });
  const WK = [[52.45, -2.25, 'carry'], [53.38, -2.0, 'stand'], [52.35, 0.25, 'stand'], [51.35, -0.65, 'wave'], [53.0, -0.9, 'cheer'], [52.0, -1.2, 'walk']];
  workers.forEach((h, k) => {
    const on = t > 41.2 && t < 47.2; h.root.visible = on; if (!on) return;
    h.carry = k === 0;
    h.root.scale.setScalar(SCALE * 1.05 * popScale(t, 41.3 + k * 0.22) * (1 - smooth(46.6, 47.2, t)));
    const [lat, lon, p] = WK[k]; placeOn(h.root, lat, lon, camera.position); pose(h, p, t * 3 + k);
  });
  // finale gates
  gates.visible = t > 56.2; if (gates.visible) {
    gates.scale.setScalar(0.017 * popScale(t, 56.3, 0.6)); placeOn(gates, 52.7, -1.5, camera.position);
    const open = easeIO(smooth(57.4, 59.0, t)); doors.forEach((d) => { d.hinge.rotation.y = d.s * open * 1.25; });
    gates.userData.glow.material.opacity = 0.55 * open;
  }
}

// ---------------------------------------------------------------- 2D overlay: headlines, labels, numbers
const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
const cg = comp.getContext('2d'); document.body.appendChild(comp);
const HI = (s) => `800 ${s}px Mukta, sans-serif`, EN = (s) => `900 ${s}px Inter, "Inter Display", sans-serif`;
function text(str, x, y, size, fill, font = HI, stroke = '#000', lw = 0.16, align = 'center') {
  cg.font = font(size); cg.textAlign = align; cg.textBaseline = 'middle'; cg.lineJoin = 'round';
  if (stroke) { cg.lineWidth = size * lw; cg.strokeStyle = stroke; cg.strokeText(str, x, y); }
  cg.fillStyle = fill; cg.fillText(str, x, y);
}
function fitSize(str, size, maxW, font = HI) { cg.font = font(size); const w = cg.measureText(str).width; return w > maxW ? size * maxW / w : size; }
function headline(lines, t, t0, t1, y = H * 0.16) {
  const a = win(t, t0, t1); if (a <= 0) return;
  cg.save(); cg.globalAlpha = a;
  lines.forEach((l, i) => {
    const li = win(t, t0 + i * 0.25, t1), sc = 0.7 + 0.3 * backOut((t - t0 - i * 0.25) / 0.4);
    const size = fitSize(l.s, l.size || 100, W - 90, EN);
    cg.save(); cg.globalAlpha = a * li; cg.translate(W / 2, y + i * (l.gap || 120)); cg.scale(sc, sc);
    cg.shadowColor = 'rgba(0,0,0,0.6)'; cg.shadowBlur = 24;
    text(l.s, 0, 0, size, l.c || '#ffffff', EN, '#0b0f17', 0.14);
    cg.restore();
  });
  cg.restore();
}
function pill(str, x, y, a, bg = '#d81e1e', size = 50, font = EN, fg = '#fff') {
  if (a <= 0) return; cg.save(); cg.globalAlpha = a; cg.font = font(size); const w = cg.measureText(str).width + 70, h = size * 1.6;
  const sc = 0.8 + 0.2 * backOut(a); cg.translate(x, y); cg.scale(sc, sc);
  cg.shadowColor = 'rgba(0,0,0,0.45)'; cg.shadowBlur = 20; cg.fillStyle = bg; cg.beginPath(); cg.roundRect(-w / 2, -h / 2, w, h, h / 2); cg.fill(); cg.shadowBlur = 0;
  text(str, 0, size * 0.05, size, fg, font, null); cg.restore();
}
function proj(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, ok: p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 }; }
function geoLabel(str, lat, lon, a, dy = -90, color = '#ffd21a', sub = null, dx = 0) {
  if (a <= 0) return; const p0 = proj(ll(lat, lon, 1.002)); if (!p0.ok) return;
  cg.save(); cg.globalAlpha = a; const y = p0.y + dy;
  cg.strokeStyle = 'rgba(255,255,255,0.9)'; cg.lineWidth = 4; cg.beginPath(); cg.moveTo(p0.x, p0.y); cg.lineTo(p0.x + dx, y + 34); cg.stroke();
  const p = { x: p0.x + dx, y: p0.y };
  cg.fillStyle = color; cg.beginPath(); cg.arc(p0.x, p0.y, 9, 0, 6.3); cg.fill();
  cg.font = EN(46); const w = cg.measureText(str).width + 50;
  cg.fillStyle = 'rgba(8,14,24,0.85)'; cg.beginPath(); cg.roundRect(p.x - w / 2, y - 36, w, sub ? 118 : 72, 14); cg.fill();
  cg.fillStyle = color; cg.fillRect(p.x - w / 2, y - 36, w, 6);
  text(str, p.x, y + 2, 46, '#ffffff', EN, null);
  if (sub) text(sub, p.x, y + 52, 40, color, HI, null);
  cg.restore();
}
function bigNumber(str, sub, y, a, color = '#ffd21a', size = 230) {
  if (a <= 0) return; cg.save(); cg.globalAlpha = Math.min(1, a * 1.4); const sc = 0.6 + 0.4 * backOut(a); cg.translate(W / 2, y); cg.scale(sc, sc);
  cg.shadowColor = 'rgba(0,0,0,0.6)'; cg.shadowBlur = 30; text(str, 0, 0, fitSize(str, size, W - 80, EN), color, EN, '#0b0f17', 0.1);
  if (sub) text(sub, 0, size * 0.62, size * 0.28, '#ffffff', EN, '#0b0f17', 0.16); cg.restore();
}
function flagBadge(x, y, w, a) { if (a <= 0) return; cg.save(); cg.globalAlpha = a; const h = w / 2; cg.shadowColor = 'rgba(0,0,0,0.5)'; cg.shadowBlur = 18; cg.beginPath(); cg.roundRect(x - w / 2, y - h / 2, w, h, 12); cg.clip(); cg.drawImage(UJ.canvas, x - w / 2, y - h / 2, w, h); cg.restore(); }
function stamp(str, sub, x, y, a, color) {
  if (a <= 0) return; cg.save(); cg.globalAlpha = Math.min(1, a * 1.5); const sc = 1.6 - 0.6 * easeOut(a); cg.translate(x, y); cg.rotate(-0.12); cg.scale(sc, sc);
  cg.font = EN(70); const w = cg.measureText(str).width + 80; cg.strokeStyle = color; cg.lineWidth = 10; cg.strokeRect(-w / 2, -70, w, sub ? 175 : 140);
  text(str, 0, -2, 70, color, EN, '#ffffff', 0.06); if (sub) text(sub, 0, 70, 52, color, HI, '#ffffff', 0.06); cg.restore();
}
function overlay(t) {
  // English only, short, and only where it matters
  // 1 hook
  headline([{ s: 'UK VISAS', size: 150 }, { s: 'OPENING!', size: 150, c: '#ffd21a', gap: 150 }], t, 0.5, 4.4, H * 0.12);
  flagBadge(W / 2, H * 0.35, 220, win(t, 2.4, 4.4));
  geoLabel('UNITED KINGDOM', UKC[0], UKC[1], win(t, 2.6, 4.5), -160);
  // 2 good news, 2027 work visas
  headline([{ s: 'BIG GOOD NEWS!', size: 110, c: '#7dff6a' }], t, 4.7, 8.0, H * 0.12);
  bigNumber('2027', 'UK WORK VISAS', H * 0.2, win(t, 8.0, 13.5));
  // 3 which visas, who benefits
  headline([{ s: 'WHICH VISAS?', size: 120 }, { s: 'WHO BENEFITS?', size: 120, c: '#ffd21a', gap: 135 }], t, 13.8, 17.6, H * 0.12);
  pill('WATCH TILL THE END', W / 2, H * 0.84, win(t, 17.6, 20.0), '#d81e1e', 60);
  // 4 the official's statement, strict rules, people left
  geoLabel('LONDON', LONDON[0], LONDON[1], win(t, 20.2, 26.6), -250, '#ff5a5a');
  if (t > 21.4 && t < 26.8) {
    const a = win(t, 21.4, 26.8); cg.save(); cg.globalAlpha = a; const y = H * 0.1, sc = 0.85 + 0.15 * backOut((t - 21.4) / 0.4);
    cg.translate(W / 2, y + 95); cg.scale(sc, sc); cg.fillStyle = 'rgba(8,14,24,0.88)'; cg.beginPath(); cg.roundRect(-480, -95, 960, 210, 26); cg.fill(); cg.fillStyle = '#ffd21a'; cg.fillRect(-480, -95, 14, 210);
    text('FORMER FOREIGN OFFICE', 10, -38, fitSize('FORMER FOREIGN OFFICE', 64, 880, EN), '#ffffff', EN, null); text('OFFICIAL SPEAKS OUT', 10, 48, fitSize('OFFICIAL SPEAKS OUT', 64, 880, EN), '#ffd21a', EN, null); cg.restore();
  }
  stamp('STRICT VISA RULES', null, W / 2, H * 0.78, win(t, 23.6, 26.8, 0.2), '#e02424');
  headline([{ s: 'STUDENTS & WORKERS', size: 104 }, { s: 'LEFT THE UK', size: 130, c: '#ff5a5a', gap: 135 }], t, 27.2, 31.6, H * 0.12);
  // 5 jobs locals don't do
  ICONS.forEach((ic) => geoLabel(ic.label, ic.lat, ic.lon, win(t, ic.t + 0.3, 41.0), ic.dy + 25, '#ffd21a', null, ic.dx));
  headline([{ s: "LOCALS DON'T DO", size: 110 }, { s: 'THESE JOBS', size: 120, c: '#ff5a5a', gap: 130 }], t, 38.2, 41.0, H * 0.11);
  // 6 run by foreign workers
  headline([{ s: 'RUN BY', size: 110 }, { s: 'FOREIGN WORKERS', size: 120, c: '#ffd21a', gap: 130 }], t, 41.3, 47.0, H * 0.11);
  // 7 shortage, all categories open
  bigNumber('6 MONTHS – 1 YEAR', null, H * 0.14, win(t, 47.3, 52.2), '#ffffff', 120);
  if (t > 48.4 && t < 52.4) {
    const a = win(t, 48.4, 52.4); const lvl = 1 - 0.85 * easeOut((t - 48.6) / 2.6);
    cg.save(); cg.globalAlpha = a; const x = W / 2, y = H * 0.8;
    text('WORKERS & LABOUR', x, y - 95, 50, '#ffffff', EN, '#000', 0.14);
    cg.fillStyle = 'rgba(0,0,0,0.6)'; cg.beginPath(); cg.roundRect(x - 380, y - 40, 760, 80, 40); cg.fill();
    cg.fillStyle = lvl > 0.5 ? '#ffb02e' : '#ff2a2a'; cg.beginPath(); cg.roundRect(x - 372, y - 32, 744 * lvl, 64, 32); cg.fill();
    text('SEVERE SHORTAGE', x, y + 100, 70, '#ff4a4a', EN, '#000', 0.14); cg.restore();
  }
  headline([{ s: 'ALL VISA CATEGORIES', size: 104 }, { s: 'TO OPEN', size: 130, c: '#7dff6a', gap: 135 }], t, 52.5, 56.0, H * 0.11);
  stamp('VISAS OPEN', null, W / 2, H * 0.8, win(t, 53.3, 56.0, 0.2), '#16a34a');
  // 8 get ready, doors open again
  headline([{ s: 'GET READY!', size: 140, c: '#ffd21a' }], t, 56.2, 60.2, H * 0.12);
  headline([{ s: "UK'S DOORS", size: 110 }, { s: 'OPEN AGAIN', size: 130, c: '#7dff6a', gap: 135 }], t, 57.3, 60.2, H * 0.78);
  // quick white flashes on the big transitions
  for (const ft of [2.3, 6.7, 13.6, 20.0, 27.3, 32.0, 41.2, 47.3, 52.5, 56.2]) { const d = t - ft; if (d >= 0 && d < 0.14) { cg.fillStyle = `rgba(255,255,255,${0.32 * (1 - d / 0.14)})`; cg.fillRect(0, 0, W, H); } }
  // subtle cinematic vignette
  const vg = cg.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); cg.fillStyle = vg; cg.fillRect(0, 0, W, H);
}

function renderFrame(t) {
  const cam = setCamera(t);
  setState(t, cam);
  renderer.render(scene, camera);
  cg.drawImage(glCanvas, 0, 0);
  overlay(t);
  return comp.toDataURL('image/jpeg', 0.93);
}
window.SIM = { frameAt: (t) => renderFrame(t), duration: DURATION };
window.SIM_READY = true;

// Renders src/scene.html frame-by-frame in headless Chromium (WebGL via SwiftShader) and encodes the video.
// usage: node src/render.js            -> full render + mux
//        node src/render.js --stills 1,6.5,20   -> PNG/JPEG previews in output/stills
const http = require('http'), fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const FPS = 30, DUR = +(process.env.DUR || 65.5), NFR = Math.round(FPS * DUR);
const FRAMES = process.env.FRAMES_DIR || path.join(ROOT, 'output', 'frames');
const WORKERS = +(process.env.WORKERS || 4);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}
async function openPage(port) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  const seg = fs.readFileSync(path.join(ROOT, 'audio/voice/segments.json'), 'utf8');
  await p.addInitScript(`window.SEGMENTS = ${seg}; window.DUR = ${DUR};`);
  await p.goto(`http://127.0.0.1:${port}/src/scene.html`);
  await p.waitForFunction('window.READY === true', null, { timeout: 120000 });
  return { b, p };
}
const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));

(async () => {
  const srv = await serve(); const port = srv.address().port;
  const si = process.argv.indexOf('--stills');
  if (si > 0) {
    const ts = process.argv[si + 1].split(',').map(Number);
    const dir = path.join(ROOT, 'output', 'stills'); fs.mkdirSync(dir, { recursive: true });
    const { b, p } = await openPage(port);
    for (const t of ts) { const t0 = Date.now(); const u = await p.evaluate((t) => window.renderFrame(t, 0.85), t); save(path.join(dir, `s_${t.toFixed(2)}.jpg`), u); console.log('still', t, Date.now() - t0, 'ms'); }
    await b.close(); srv.close(); return;
  }
  fs.mkdirSync(FRAMES, { recursive: true });
  const todo = []; for (let i = 0; i < NFR; i++) if (!fs.existsSync(path.join(FRAMES, `f${String(i).padStart(5, '0')}.jpg`))) todo.push(i);
  console.log(`frames to render: ${todo.length}/${NFR}`);
  let next = 0, done = 0; const t0 = Date.now();
  await Promise.all([...Array(WORKERS)].map(async () => {
    const { b, p } = await openPage(port);
    while (next < todo.length) {
      const i = todo[next++];
      const u = await p.evaluate((t) => window.renderFrame(t, 0.93), i / FPS);
      save(path.join(FRAMES, `f${String(i).padStart(5, '0')}.jpg`), u);
      if (++done % 60 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${todo.length}  ${(el / done).toFixed(2)} s/frame  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`); }
    }
    await b.close();
  }));
  srv.close();
  const audio = path.join(ROOT, 'audio', 'final_mix.wav');
  const outF = path.join(ROOT, 'output', 'CPR_Your_Hands_3D_vertical.mp4');
  const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%05d.jpg')];
  if (fs.existsSync(audio)) args.push('-i', audio);
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart');
  if (fs.existsSync(audio)) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push(outF);
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  console.log('encoded', outF, r.status);
})();

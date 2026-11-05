// usage: node src/render.mjs [--stills 1,5,9] ; renders frames to ffmpeg
import { createRequire } from 'module'; const { chromium } = createRequire('/root/')('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const wi = process.argv.indexOf('--size'); const [VW, VH] = wi > 0 ? process.argv[wi + 1].split('x').map(Number) : [1920, 1080];
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
page.on('console', m => console.log('[page]', m.text())); page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`http://localhost:${srv.address().port}/src/scene.html?w=${VW}&h=${VH}`); await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
const si = process.argv.indexOf('--stills');
const fps = 30;
if (si > 0) {
  fs.mkdirSync(path.join(root, 'output/stills'), { recursive: true });
  for (const s of process.argv[si + 1].split(',').map(Number)) {
    const d = await page.evaluate(t => { renderAt(t); return grab(); }, s);
    fs.writeFileSync(path.join(root, `output/stills/${VW}x${VH}_t${s}.jpg`), Buffer.from(d.split(',')[1], 'base64')); console.log('still', s);
  }
} else {
  const dur = await page.evaluate('DUR'); const N = Math.round(dur * fps);
  const fi = process.argv.indexOf('--range'); const [from, to] = fi > 0 ? process.argv[fi + 1].split('-').map(Number) : [0, N];
  const dir = path.join(root, VW === 1920 ? 'output/frames' : `output/frames_${VW}x${VH}`); fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  for (let i = from; i < Math.min(to, N); i++) {
    const f = path.join(dir, `f${String(i).padStart(5, '0')}.jpg`); if (fs.existsSync(f)) continue;
    const d = await page.evaluate(t => { renderAt(t); return grab(); }, i / fps);
    fs.writeFileSync(f + '.tmp', Buffer.from(d.split(',')[1], 'base64')); fs.renameSync(f + '.tmp', f);
    if (i % 30 === 0) console.log(`frame ${i}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
await browser.close(); srv.close();

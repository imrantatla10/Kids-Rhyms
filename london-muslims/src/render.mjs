// usage: node src/render.mjs [--stills 1,5,9] ; renders frames to ffmpeg
import { createRequire } from 'module'; const { chromium } = createRequire('/root/')('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(8765);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => console.log('[page]', m.text())); page.on('pageerror', e => console.log('[err]', e.message));
await page.goto('http://localhost:8765/src/scene.html'); await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
const si = process.argv.indexOf('--stills');
const fps = 30;
if (si > 0) {
  fs.mkdirSync(path.join(root, 'output/stills'), { recursive: true });
  for (const s of process.argv[si + 1].split(',').map(Number)) {
    const d = await page.evaluate(t => { renderAt(t); return grab(); }, s);
    fs.writeFileSync(path.join(root, `output/stills/t${s}.jpg`), Buffer.from(d.split(',')[1], 'base64')); console.log('still', s);
  }
} else {
  const dur = await page.evaluate('DUR'); const N = Math.round(dur * fps);
  const out = path.join(root, 'output/video_noaudio.mp4');
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const d = await page.evaluate(t => { renderAt(t); return grab(); }, i / fps);
    if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close(); srv.close();

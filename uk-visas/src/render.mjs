// Drives the WebGL scene in headless Chromium and encodes frames with ffmpeg.
//   node src/render.mjs --stills 3,27,60     quick JPEG previews (output seconds)
//   node src/render.mjs [--workers 4] [--scale 1]   full 60 s render -> output/video_silent.mp4
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SCALE = parseFloat(opt('--scale', '1'));
const [BW, BH] = opt('--size', '1080x1080').split('x').map(Number);   // default: square 1080x1080
const W = Math.round(BW * SCALE), H = Math.round(BH * SCALE);
const FPS = 30;
let FRAMES = 0;

const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.route('http://app.local/**', (route) => {
    const u = new URL(route.request().url());
    let file;
    if (u.pathname.startsWith('/three/')) file = path.join(ROOT, 'node_modules', u.pathname.slice(1));
    else file = path.join(ROOT, u.pathname === '/' ? 'src/index.html' : u.pathname.slice(1));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.addInitScript(([w, h]) => { window.__W = w; window.__H = h; }, [W, H]);
  await page.goto('http://app.local/src/index.html');
  await page.waitForFunction(() => window.SIM_READY === true, null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function frame(page, t) {
  let data = await page.evaluate((t) => window.SIM.frameAt(t), t);
  if (data === 'RESET') {
    await page.reload();
    await page.waitForFunction(() => window.SIM_READY === true, null, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    data = await page.evaluate((t) => window.SIM.frameAt(t), t);
  }
  return data;
}
const launch = () => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });

async function stills(list) {
  const browser = await launch(); const page = await openPage(browser);
  fs.mkdirSync(path.join(ROOT, 'output/stills'), { recursive: true });
  for (const t of list.sort((a, b) => a - b)) {
    const t0 = Date.now();
    const data = await frame(page, t);
    const f = path.join(ROOT, `output/stills/t${String(t).padStart(5, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
    console.log('still', t, 's', ((Date.now() - t0) / 1000).toFixed(2) + 's', f);
  }
  await browser.close();
}

async function events() {
  const browser = await launch(); const page = await openPage(browser);
  const ev = await page.evaluate(() => { window.SIM.simTo(window.SIM.outToSim(60)); const e = window.SIM.events();
    e.vehicles.forEach((v) => { v.spawnOut = window.SIM.simToOut(v.spawn); v.contactOut = window.SIM.simToOut(v.contact); });
    e.clatter.forEach((c) => { c.tOut = window.SIM.simToOut(c.t); });
    e.splashes.forEach((c) => { c.tOut = window.SIM.simToOut(c.t); });
    return e; });
  fs.writeFileSync(path.join(ROOT, 'audio/events.json'), JSON.stringify(ev));
  console.log(ev.vehicles.map((v) => `${v.name}: launch ${v.launch?.toFixed(2)} contact sim ${v.contact?.toFixed(2)} out ${v.contactOut?.toFixed(2)} land ${v.land?.toFixed(2)}`).join('\n'));
  await browser.close();
}

async function worker(id, f0, f1) {
  const out = path.join(ROOT, `output/seg_${id}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', SCALE !== 1 ? `scale=${BW}:${BH}:flags=lanczos` : 'null', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const browser = await launch(); const page = await openPage(browser);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const data = await frame(page, f / FPS);
    const buf = Buffer.from(data.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) console.log(`[w${id}] frame ${f}/${f1} ${((Date.now() - t0) / 1000 / Math.max(1, f - f0)).toFixed(2)} s/frame`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  return out;
}

async function full() {
  { const b = await launch(); const p = await openPage(b); FRAMES = Math.round(await p.evaluate(() => window.SIM.duration) * FPS); await b.close(); console.log('frames', FRAMES); }
  const N = parseInt(opt('--workers', '4'), 10);
  const per = Math.ceil(FRAMES / N), jobs = [];
  for (let i = 0; i < N; i++) jobs.push(worker(i, i * per, Math.min(FRAMES, (i + 1) * per)));
  const segs = await Promise.all(jobs);
  const list = path.join(ROOT, 'output/segs.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
  await new Promise((r) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(ROOT, 'output/video_silent.mp4')], { stdio: 'inherit' }).on('close', r));
  for (const s of segs) fs.unlinkSync(s); fs.unlinkSync(list);
  console.log('wrote output/video_silent.mp4');
}

if (args.includes('--stills')) await stills(opt('--stills', '3').split(',').map(Number));
else await full();

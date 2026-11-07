// Output-time <-> simulation-time mapping (slow motion windows).
// Shared by the renderer (browser) and mirrored in build_audio.py via events.json.
export const TIMELINE = {
  fps: 30,
  outDuration: 64,
  slowFactor: 0.25,
  // [simStart, simEnd] windows played at slowFactor speed (bus hit, box-truck hit)
  slow: [[26.2, 28.2], [43.2, 45.2]],
};

function segments() {
  const segs = []; let s = 0, o = 0;
  for (const [a, b] of TIMELINE.slow) {
    segs.push({ s0: s, s1: a, o0: o, rate: 1 }); o += a - s;
    segs.push({ s0: a, s1: b, o0: o, rate: TIMELINE.slowFactor }); o += (b - a) / TIMELINE.slowFactor;
    s = b;
  }
  segs.push({ s0: s, s1: Infinity, o0: o, rate: 1 });
  return segs;
}
const SEGS = segments();

export function simToOut(ts) {
  for (const g of SEGS) if (ts <= g.s1) return g.o0 + (ts - g.s0) / g.rate;
  return 0;
}
export function outToSim(to) {
  let best = SEGS[0];
  for (const g of SEGS) if (to >= g.o0) best = g;
  return best.s0 + (to - best.o0) * best.rate;
}
export function slowWindowsOut() { return TIMELINE.slow.map(([a, b]) => [simToOut(a), simToOut(b)]); }
export function slowAmountAtOut(to) {
  let amount = 0, flash = 0;
  for (const [a, b] of slowWindowsOut()) {
    if (to >= a && to <= b) amount = Math.max(amount, Math.min(1, (to - a) / 0.4, (b - to) / 0.4));
    if (to >= a && to < a + 0.45) flash = Math.max(flash, 0.85 * (1 - (to - a) / 0.45));
    if (to >= b && to < b + 0.3) flash = Math.max(flash, 0.55 * (1 - (to - b) / 0.3));
  }
  return { amount, flash };
}

// Output-time <-> simulation-time mapping (slow motion on every crash).
// Shared by the renderer (browser) and mirrored in build_audio.py via events.json.

// planned contact time (simulation seconds) of each vehicle, in crash order
export const CRASH_TIMES = [3.4, 7.6, 11.8, 16.0, 20.8, 25.8, 29.9, 34.0];
export const HEAVY = [false, false, false, false, true, false, false, true]; // school bus, box truck

export const TIMELINE = {
  fps: 30,
  outDuration: 64,
  crashTimes: CRASH_TIMES,
  heavy: HEAVY,
  // [simStart, simEnd, speed] windows: cars at 0.3x for 3 s, bus and truck at 0.25x for 8 s
  slow: CRASH_TIMES.map((t, i) => (HEAVY[i] ? [t - 0.3, t + 1.7, 0.25] : [t - 0.25, t + 0.65, 0.3])),
};

function segments() {
  const segs = []; let s = 0, o = 0;
  for (const [a, b, f] of TIMELINE.slow) {
    segs.push({ s0: s, s1: a, o0: o, rate: 1 }); o += a - s;
    segs.push({ s0: a, s1: b, o0: o, rate: f }); o += (b - a) / f;
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
  slowWindowsOut().forEach(([a, b], i) => {
    const big = HEAVY[i] ? 0.85 : 0.45;
    if (to >= a && to <= b) amount = Math.max(amount, Math.min(1, (to - a) / 0.3, (b - to) / 0.3));
    if (to >= a && to < a + 0.35) flash = Math.max(flash, big * (1 - (to - a) / 0.35));
  });
  return { amount, flash };
}

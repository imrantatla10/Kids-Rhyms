// Output edit: a 6 s flash-forward hook (the school bus hit), then the full run
// with slow motion on every crash. Shared by the renderer and (via events.json) the audio.

export const FPS = 30;
export const HOOK_LEN = 6.0;
export const OUT_DURATION = 60.0;
export const MAIN_LEN = OUT_DURATION - HOOK_LEN;

// planned impact time (simulation seconds) of each vehicle, in crash order
export const CRASH_TIMES = [3.6, 7.6, 11.6, 15.6, 20.2, 24.6, 28.4, 32.2];
export const HEAVY = [false, false, false, false, true, false, false, true];
// [simStart, simEnd, speed]: cars 0.33x, school bus and semi 0.3x
export const SLOW = CRASH_TIMES.map((t, i) => (HEAVY[i] ? [t - 0.25, t + 1.35, 0.3] : [t - 0.2, t + 0.6, 0.33]));

// hook replays the bus impact: from just before it, at 0.27x
export const HOOK_SIM0 = CRASH_TIMES[4] - 0.55;
export const HOOK_RATE = 0.27;

function segments() {
  const segs = []; let s = 0, o = 0;
  for (const [a, b, f] of SLOW) {
    segs.push({ s0: s, s1: a, o0: o, rate: 1 }); o += a - s;
    segs.push({ s0: a, s1: b, o0: o, rate: f }); o += (b - a) / f;
    s = b;
  }
  segs.push({ s0: s, s1: Infinity, o0: o, rate: 1 });
  return segs;
}
const SEGS = segments();

export function simToMainOut(ts) {
  for (const g of SEGS) if (ts <= g.s1) return g.o0 + (ts - g.s0) / g.rate;
  return 0;
}
export function mainOutToSim(tm) {
  let best = SEGS[0];
  for (const g of SEGS) if (tm >= g.o0) best = g;
  return best.s0 + (tm - best.o0) * best.rate;
}
// full output time <-> simulation time
export function outToSim(to) { return to < HOOK_LEN ? HOOK_SIM0 + to * HOOK_RATE : mainOutToSim(to - HOOK_LEN); }
export function simToOut(ts) { return HOOK_LEN + simToMainOut(ts); }
export function slowAt(to) {
  if (to < HOOK_LEN) return true;
  const ts = outToSim(to);
  return SLOW.some(([a, b]) => ts >= a && ts <= b);
}

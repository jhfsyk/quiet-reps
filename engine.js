// Pure logic: dates, session building, progression and weight math. No DOM here,
// so tests/engine.test.mjs can run it under Node.
import { EXERCISES, DAYS, PHASES, SWITCH_SEC, SHORT_REST_SEC, TEST_DEFAULTS } from './data.js';

// ---- dates (local calendar days as 'YYYY-MM-DD') ----
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function daysBetween(a, b) {
  return Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
}
export function weekNumber(startDate, date) {
  return Math.max(1, Math.floor(daysBetween(startDate, date) / 7) + 1);
}
export function phaseFor(week) {
  return PHASES.find(p => week >= p.from && week <= p.to) || { name: '維持期' };
}

// ---- progression ----
const itemSpec = it => (typeof it === 'string' ? { ex: it } : it);

export function slotState(progress, slot) {
  return progress[slot] || { ex: slot.split(':')[1], level: 0, target: null, streak: 0 };
}

function slotRange(spec, st) {
  return st.ex === spec.ex && spec.range ? spec.range : EXERCISES[st.ex].range;
}

export function tempoText(level) {
  return level >= 1 ? '下ろす4秒・1秒停止' : '下ろす3秒・上げる1秒';
}

export function levelText(level) {
  return ['基本', 'スローテンポ', 'スローテンポ＋1セット'][level] || '基本';
}

// The next step up the ladder: slower tempo, then an extra set, then the harder variant.
export function nextStep(st) {
  if (st.level === 0) return { kind: 'tempo', label: 'テンポを遅く：4秒で下ろして1秒停止' };
  if (st.level === 1) return { kind: 'set', label: '1セット追加' };
  const harder = EXERCISES[st.ex].harder;
  return harder ? { kind: 'harder', ex: harder, label: `「${EXERCISES[harder].name}」に変更` } : null;
}

export function acceptStep(st, next) {
  if (next.kind === 'tempo') return { ...st, level: 1, streak: 0 };
  if (next.kind === 'set') return { ...st, level: 2, streak: 0 };
  return { ex: next.ex, level: 0, target: null, streak: 0 };
}

// ---- sessions ----
// Flattens a day into an ordered list of sets. `after` is the countdown that follows
// each set: a short switch inside a superset/circuit round, full rest after the round.
export function buildSession(dayKey, { week, progress = {}, tests = {} }) {
  const day = DAYS[dayKey];
  const phase = phaseFor(week);
  const steps = [];

  day.blocks.forEach(block => {
    const items = block.items.map(raw => {
      const spec = itemSpec(raw);
      if (block.type === 'warmup') return { ex: spec.ex, slot: null, target: spec.reps, sets: 1 };
      if (block.type === 'test') {
        return { ex: spec.ex, slot: null, test: true, sets: 1, target: tests[spec.ex]?.best ?? TEST_DEFAULTS[spec.ex] };
      }
      const slot = `${dayKey}:${spec.ex}`;
      const st = slotState(progress, slot);
      const range = slotRange(spec, st);
      const sets = phase.deload ? 2 : block.sets + (st.level >= 2 ? 1 : 0);
      return { ex: st.ex, slot, range, level: st.level, sets, target: st.target ?? range[0] };
    });

    const rest = phase.shortRest && (block.type === 'superset' || block.type === 'finisher') ? SHORT_REST_SEC : block.rest;
    const rounds = Math.max(...items.map(i => i.sets));
    for (let round = 1; round <= rounds; round++) {
      const active = items.filter(i => i.sets >= round);
      active.forEach((it, k) => {
        const last = k === active.length - 1;
        const after = last ? rest : block.type === 'warmup' ? 0 : SWITCH_SEC;
        steps.push({
          block: block.label, blockType: block.type, round, rounds,
          ex: it.ex, slot: it.slot, target: it.target, range: it.range || null,
          level: it.level ?? null, test: !!it.test, after, afterKind: last ? 'rest' : 'switch',
        });
      });
    }
  });

  steps[steps.length - 1].after = 0;
  return { day: dayKey, week, steps };
}

// Planned set count per slot, for "did every set hit the target" checks.
function plannedSets(steps) {
  const n = {};
  for (const s of steps) if (s.slot) n[s.slot] = (n[s.slot] || 0) + 1;
  return n;
}

// Applies a finished (or ended-early) session. `logs` maps step index -> array of reps
// (one value, or [left, right] for one-side exercises; the weaker side counts).
export function applySession(progress, tests, steps, logs, date) {
  progress = { ...progress };
  tests = { ...tests };
  const planned = plannedSets(steps);
  const bySlot = {};
  const sets = [];
  const testResults = [];

  steps.forEach((step, i) => {
    const reps = logs[i];
    if (!reps) return;
    sets.push({ slot: step.slot, ex: step.ex, block: step.block, reps, target: step.target });
    if (step.slot) (bySlot[step.slot] ||= { step, reps: [] }).reps.push(reps);
    if (step.test) {
      const prev = tests[step.ex]?.best ?? 0;
      const value = Math.min(...reps);
      tests[step.ex] = { best: Math.max(prev, value), history: [...(tests[step.ex]?.history || []), { date, reps: value }] };
      testResults.push({ ex: step.ex, reps: value, prev, isBest: value > prev });
    }
  });

  const results = [];
  const suggestions = [];
  for (const [slot, { step, reps }] of Object.entries(bySlot)) {
    const st = { ...slotState(progress, slot) };
    const counts = reps.map(r => Math.min(...r));
    const complete = counts.length >= planned[slot];
    const hitTarget = complete && counts.every(c => c >= step.target);
    const hitTop = complete && counts.every(c => c >= step.range[1]);
    st.target = hitTarget ? Math.min(step.range[1], Math.max(step.target + 1, Math.min(...counts))) : step.target;
    st.streak = hitTop ? (st.streak || 0) + 1 : 0;
    progress[slot] = st;
    results.push({ slot, ex: step.ex, reps, target: step.target, hitTarget, newTarget: st.target });

    const next = nextStep(st);
    if (st.streak >= 2 && next) suggestions.push({ slot, ex: st.ex, next });
  }

  return { progress, tests, sets, results, suggestions, testResults };
}

// ---- weight ----
function windowAvg(weights, date, days = 7) {
  const from = addDays(date, -(days - 1));
  const xs = weights.filter(w => w.date >= from && w.date <= date);
  return { n: xs.length, avg: xs.length ? xs.reduce((s, w) => s + w.kg, 0) / xs.length : null };
}

export function avg7(weights, date) {
  return windowAvg(weights, date).avg;
}

// Straight line from the start weight to the target weight.
export function targetOn(settings, date) {
  const total = daysBetween(settings.startDate, settings.targetDate);
  const t = Math.min(1, Math.max(0, daysBetween(settings.startDate, date) / total));
  return settings.startWeight + (settings.targetWeight - settings.startWeight) * t;
}

// Compares this week's 7-day average with the one from two weeks ago.
export function weeklyCheck(weights, date) {
  const now = windowAvg(weights, date);
  const past = windowAvg(weights, addDays(date, -14));
  if (now.n < 3 || past.n < 3) return null;
  const rate = (past.avg - now.avg) / 2;
  return { rate, delta: rate < 0.4 ? -150 : rate > 0.9 ? 150 : 0 };
}

export const MIN_KCAL = 1600;

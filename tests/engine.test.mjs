// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.js';
import { EXERCISES, DAYS } from '../data.js';

const settings = { startDate: '2026-11-02', targetDate: '2027-02-28', startWeight: 79, targetWeight: 70 };

test('every plan item points at a real exercise with a rep range and cues', () => {
  for (const day of Object.values(DAYS)) {
    for (const block of day.blocks) {
      for (const it of block.items) {
        const ex = EXERCISES[typeof it === 'string' ? it : it.ex];
        assert.ok(ex, JSON.stringify(it));
        assert.equal(ex.cues.length, 3);
      }
    }
  }
  for (const [id, ex] of Object.entries(EXERCISES)) {
    assert.ok(ex.range[0] <= ex.range[1], id);
    if (ex.harder) assert.ok(EXERCISES[ex.harder], `${id} -> ${ex.harder}`);
  }
});

test('weeks and phases follow the 17-week plan', () => {
  assert.equal(E.weekNumber('2026-11-02', '2026-11-02'), 1);
  assert.equal(E.weekNumber('2026-11-02', '2026-11-08'), 1);
  assert.equal(E.weekNumber('2026-11-02', '2026-12-28'), 9);
  assert.equal(E.weekNumber('2026-11-02', '2027-02-28'), 17);
  assert.equal(E.phaseFor(9).name, 'Deload');
  assert.ok(E.phaseFor(12).shortRest);
});

test('Day A: supersets alternate exercises with a switch, then rest', () => {
  const { steps } = E.buildSession('A', { week: 1 });
  // warm-up 3 + (2 supersets × 3 rounds × 2) + finisher 2 rounds × 2
  assert.equal(steps.length, 3 + 12 + 4);
  const ss1 = steps.slice(3, 5);
  assert.deepEqual(ss1.map(s => s.ex), ['goblet_squat', 'pushup']);
  assert.deepEqual(ss1.map(s => [s.after, s.afterKind]), [[10, 'switch'], [60, 'rest']]);
  assert.equal(steps[0].after, 0);
  assert.equal(steps.at(-1).after, 0);
  assert.equal(steps[3].target, 12);
});

test('deload week uses 2 sets; push phase uses 45 s rest except the circuit', () => {
  const deload = E.buildSession('A', { week: 9 }).steps;
  assert.equal(deload.filter(s => s.slot === 'A:pushup').length, 2);
  const push = E.buildSession('A', { week: 12 }).steps;
  assert.equal(push.find(s => s.slot === 'A:pushup').after, 45);
  const circuit = E.buildSession('C', { week: 12 }).steps;
  assert.equal(circuit.filter(s => s.afterKind === 'rest' && s.after).at(0).after, 90);
});

test('an extra set adds a round with only that exercise', () => {
  const progress = { 'A:pushup': { ex: 'pushup', level: 2, target: 12, streak: 0 } };
  const { steps } = E.buildSession('A', { week: 2, progress });
  const ss1 = steps.filter(s => s.block === 'Superset 1');
  assert.equal(ss1.length, 7);
  assert.deepEqual([ss1.at(-1).ex, ss1.at(-1).round], ['pushup', 4]);
  assert.equal(ss1.at(-2).afterKind, 'rest');
});

function run(dayKey, progress, repsFor) {
  const { steps } = E.buildSession(dayKey, { week: 2, progress });
  const logs = {};
  steps.forEach((s, i) => { logs[i] = repsFor(s); });
  return E.applySession(progress, {}, steps, logs, '2026-11-10');
}

test('double progression: target climbs, then two sessions at the top suggest a level up', () => {
  let progress = {};
  let r = run('A', progress, s => (EXERCISES[s.ex].perSide ? [s.target, s.target] : [s.target]));
  assert.equal(r.progress['A:pushup'].target, 11);
  assert.equal(r.suggestions.length, 0);

  const top = s => (s.range ? (EXERCISES[s.ex].perSide ? [s.range[1], s.range[1]] : [s.range[1]]) : [10]);
  r = run('A', r.progress, top);
  assert.equal(r.progress['A:pushup'].target, 12);
  r = run('A', r.progress, top);
  const sug = r.suggestions.find(s => s.slot === 'A:pushup');
  assert.equal(sug.next.kind, 'tempo');

  let st = E.acceptStep(r.progress['A:pushup'], sug.next);
  st = E.acceptStep(st, E.nextStep(st));
  const harder = E.nextStep(st);
  assert.equal(harder.ex, 'decline_pushup');
  assert.deepEqual(E.acceptStep(st, harder), { ex: 'decline_pushup', level: 0, target: null, streak: 0 });
});

test('the weaker side counts and a missed set holds the target', () => {
  const r = run('A', {}, s => (s.slot === 'A:db_row' ? [15, 11] : EXERCISES[s.ex].perSide ? [s.target, s.target] : [s.target]));
  assert.equal(r.progress['A:db_row'].target, 12);
  assert.equal(r.progress['A:db_row'].streak, 0);
});

test('skipped sets never count as hitting the top', () => {
  const { steps } = E.buildSession('A', { week: 2 });
  const logs = {};
  steps.forEach((s, i) => { if (s.slot === 'A:pushup' && s.round === 1) logs[i] = [20]; });
  const r = E.applySession({ 'A:pushup': { ex: 'pushup', level: 0, target: 12, streak: 1 } }, {}, steps, logs, '2026-11-10');
  assert.equal(r.progress['A:pushup'].streak, 0);
});

test('max test records a best and flags improvements', () => {
  const { steps } = E.buildSession('T', { week: 1, tests: {} });
  assert.equal(steps.find(s => s.test && s.ex === 'pushup').target, 15);
  const logs = {};
  steps.forEach((s, i) => { logs[i] = s.test ? [s.ex === 'pushup' ? 17 : 30] : [s.target]; });
  const r = E.applySession({}, { pushup: { best: 15, history: [] } }, steps, logs, '2026-11-03');
  assert.equal(r.tests.pushup.best, 17);
  assert.ok(r.testResults.find(t => t.ex === 'pushup').isBest);
  assert.equal(r.tests.squat_bw.best, 30);
});

test('weight: target line and weekly check', () => {
  assert.equal(E.targetOn(settings, '2026-11-02'), 79);
  assert.equal(E.targetOn(settings, '2027-02-28'), 70);
  assert.equal(E.targetOn(settings, '2027-06-01'), 70);

  const slow = [];
  for (let d = 0; d < 21; d++) slow.push({ date: E.addDays('2026-11-02', d), kg: 79 - d * 0.02 });
  assert.equal(E.weeklyCheck(slow, '2026-11-22').delta, -150);
  const fast = slow.map((w, d) => ({ ...w, kg: 79 - d * 0.2 }));
  assert.equal(E.weeklyCheck(fast, '2026-11-22').delta, 150);
  const onPace = slow.map((w, d) => ({ ...w, kg: 79 - d * 0.08 }));
  assert.equal(E.weeklyCheck(onPace, '2026-11-22').delta, 0);
  assert.equal(E.weeklyCheck(slow.slice(-3), '2026-11-22'), null);
});

import { EXERCISES, DAYS, SCHEDULE } from './data.js';
import * as E from './engine.js';
import { load, save, normalize, defaultState } from './store.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');

let S = load();
let view = S.active ? 'workout' : 'home';
let summary = null;      // last finished session, shown once
let picker = false;      // "choose a workout" sheet
let weightDraft = null;  // value in the weigh-in stepper
let wakeLock = null;
let audioCtx = null;
let lastCue = null;      // last countdown second we buzzed for

const RING = 2 * Math.PI * 90;
const today = () => E.ymd(new Date());
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kg = n => (n == null ? '–' : n.toFixed(1));
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const repsText = r => r.join('/');

function commit() {
  save(S);
  render();
}

// ---------- feedback (quiet by default: vibration + screen flash, sound opt-in) ----------
function buzz(pattern) {
  if (S.settings.vibrate && navigator.vibrate) navigator.vibrate(pattern);
}
function beep(freq = 880, ms = 120) {
  if (!S.settings.sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.06;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* no audio */ }
}
function flash() {
  document.body.classList.remove('flash');
  void document.body.offsetWidth;
  document.body.classList.add('flash');
}
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { /* not allowed right now */ }
}

// ---------- workout flow ----------
function startWorkout(day) {
  const week = E.weekNumber(S.settings.startDate, today());
  const { steps } = E.buildSession(day, { week, progress: S.progress, tests: S.tests });
  S.active = { day, week, steps, idx: 0, logs: {}, phase: 'set', cur: initialReps(steps[0]), startedAt: Date.now() };
  picker = false;
  view = 'workout';
  if (S.settings.sound) beep(0, 1); // unlock audio inside the tap
  keepAwake(true);
  commit();
}

function initialReps(step) {
  return EXERCISES[step.ex].perSide ? [step.target, step.target] : [step.target];
}

function afterSet() {
  const a = S.active;
  const step = a.steps[a.idx];
  if (step.after > 0 && a.idx < a.steps.length - 1) {
    a.phase = 'rest';
    a.restKind = step.afterKind;
    a.restTotal = step.after;
    a.restEndsAt = Date.now() + step.after * 1000;
    lastCue = null;
  } else {
    nextStep();
  }
}

function nextStep() {
  const a = S.active;
  a.idx++;
  if (a.idx >= a.steps.length) return finish();
  a.phase = 'set';
  a.restEndsAt = null;
  a.cur = initialReps(a.steps[a.idx]);
}

function finish() {
  const a = S.active;
  S.active = null;
  keepAwake(false);
  if (!Object.keys(a.logs).length) {
    view = 'home';
    return;
  }
  const date = E.ymd(new Date(a.startedAt));
  const res = E.applySession(S.progress, S.tests, a.steps, a.logs, date);
  S.progress = res.progress;
  S.tests = res.tests;
  const session = { date, day: a.day, week: a.week, startedAt: a.startedAt, finishedAt: Date.now(), sets: res.sets };
  S.sessions.push(session);
  summary = { session, results: res.results, testResults: res.testResults,
    suggestions: res.suggestions.map(s => ({ ...s, state: 'open' })) };
  view = 'summary';
}

// Runs whether or not the workout screen is showing, so rest still ends on time.
function tick() {
  const a = S.active;
  if (!a || a.phase !== 'rest') return;
  const left = a.restEndsAt - Date.now();
  const secs = Math.ceil(left / 1000);
  if (left <= 0) {
    buzz([250, 80, 250]);
    beep(1320, 220);
    flash();
    nextStep();
    commit();
    return;
  }
  if (secs <= 3 && secs !== lastCue) {
    lastCue = secs;
    buzz(80);
    beep(880, 90);
  }
  const num = document.getElementById('rest-num');
  const ring = document.getElementById('ring-fg');
  if (num) num.textContent = mmss(secs);
  if (ring) ring.style.strokeDashoffset = String(RING * (1 - left / (a.restTotal * 1000)));
}
setInterval(tick, 200);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (S.active) keepAwake(true);
  tick();
});

// ---------- views ----------
function render() {
  const inWorkout = view === 'workout' && S.active;
  if (view === 'workout' && !S.active) view = 'home';
  nav.hidden = inWorkout || view === 'summary';
  nav.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === view));
  app.innerHTML = ({ home, workout, summary: summaryView, weight, progress, settings }[view])();
  if (inWorkout) tick();
}

function home() {
  const t = today();
  const st = S.settings;
  const week = E.weekNumber(st.startDate, t);
  const phase = E.phaseFor(week);
  const now = new Date();
  const scheduled = SCHEDULE[now.getDay()];
  const doneToday = S.sessions.some(s => s.date === t && s.day !== 'T');
  const monday = E.addDays(t, -((now.getDay() + 6) % 7));
  const weekDates = [...Array(7)].map((_, i) => E.addDays(monday, i));
  const doneCount = new Set(S.sessions.filter(s => s.date >= monday && s.date <= weekDates[6] && s.day !== 'T').map(s => s.date)).size;

  let todayCard;
  if (S.active) {
    todayCard = card('In progress', `<h2>${esc(DAYS[S.active.day].name)} · step ${S.active.idx + 1}/${S.active.steps.length}</h2>
      <button class="primary big" data-act="resume">Resume workout</button>`);
  } else if (doneToday) {
    todayCard = card('Today', `<h2>Done for today ✓</h2><p class="muted">Eat well and sleep. See you next session.</p>
      <button class="text-btn" data-act="pick">Do another workout</button>`);
  } else if (scheduled) {
    const d = DAYS[scheduled];
    todayCard = card('Today', `<h2>${d.name} <span class="muted">· ${d.subtitle}</span></h2>
      <p class="muted">About ${d.minutes} min · quiet mode${phase.deload ? ' · deload: 2 sets each' : ''}${phase.shortRest ? ' · 45 s rest' : ''}</p>
      <button class="primary big" data-act="start" data-day="${scheduled}">Start</button>
      <button class="text-btn" data-act="pick">Choose a different workout</button>`);
  } else {
    todayCard = card('Today', `<h2>Rest day</h2><p class="muted">Walk, stretch, sleep. Muscles grow on rest days.</p>
      <button class="text-btn" data-act="pick">Train anyway</button>`);
  }

  const strip = weekDates.map((d, i) => {
    const planned = SCHEDULE[(i + 1) % 7];
    const done = S.sessions.some(s => s.date === d && s.day !== 'T');
    return `<div class="day ${done ? 'done' : ''} ${planned ? '' : 'off'} ${d === t ? 'today' : ''}">
      <span>${'MTWTFSS'[i]}</span><i>${done ? '✓' : planned || '·'}</i></div>`;
  }).join('');

  const avg = E.avg7(S.weights, t);
  const target = E.targetOn(st, t);
  const todays = S.weights.find(w => w.date === t);
  const weeksLeft = Math.max(0, Math.ceil(E.daysBetween(t, st.targetDate) / 7));
  const pace = avg == null ? 'Log a few mornings to see your trend'
    : avg <= target ? `${kg(target - avg)} kg ahead of pace` : `${kg(avg - target)} kg behind pace`;

  const n = S.nutrition[t] || {};
  const hints = [];
  if (week === 1 && !S.tests.pushup) hints.push(card('Baseline', `<p>Do the Max test once this week to record your starting push-ups and squats.</p>
    <button class="text-btn" data-act="start" data-day="T">Start max test</button>`));
  if (week === 17) hints.push(card('Test week', `<p>Re-test your max push-ups and squats and compare with week 1.</p>
    <button class="text-btn" data-act="start" data-day="T">Start max test</button>`));

  return `
  <header class="top">
    <p class="eyebrow">Week ${week} · ${esc(phase.name)}</p>
    <h1>${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h1>
  </header>
  ${todayCard}
  ${card(`This week · ${doneCount}/5`, `<div class="strip">${strip}</div>`)}
  ${weeklyCheckCard(week, t)}
  ${hints.join('')}
  ${card('Weight', `
    <div class="stats">
      <div><b>${kg(avg)}</b><span>7-day avg</span></div>
      <div><b>${kg(target)}</b><span>target today</span></div>
      <div><b>${weeksLeft}</b><span>weeks left</span></div>
    </div>
    <p class="muted">${pace}</p>
    <button class="secondary" data-nav="weight">${todays ? `Today: ${kg(todays.kg)} kg · edit` : 'Weigh in'}</button>`)}
  ${card('Food today', `
    <div class="toggles">
      <button class="toggle ${n.kcal ? 'on' : ''}" data-act="food" data-k="kcal"><b>${st.kcal.toLocaleString()} kcal</b><span>${n.kcal ? 'On target ✓' : 'Tap when on target'}</span></button>
      <button class="toggle ${n.protein ? 'on' : ''}" data-act="food" data-k="protein"><b>${st.protein} g protein</b><span>${n.protein ? 'Hit ✓' : 'Tap when hit'}</span></button>
    </div>`)}
  ${picker ? pickerSheet() : ''}`;
}

function weeklyCheckCard(week, t) {
  const dow = new Date().getDay();
  if ((dow !== 6 && dow !== 0) || S.checks[week]) return '';
  const res = E.weeklyCheck(S.weights, t);
  if (!res) return '';
  const rate = `${res.rate >= 0 ? 'losing' : 'gaining'} ${kg(Math.abs(res.rate))} kg/week`;
  if (res.delta === 0) {
    return card('Weekly check', `<p>You're ${rate}, right on pace. Keep ${S.settings.kcal.toLocaleString()} kcal.</p>
      <button class="secondary" data-act="check" data-d="0">OK</button>`);
  }
  const next = Math.max(E.MIN_KCAL, S.settings.kcal + res.delta);
  const why = res.delta < 0 ? 'slower than the 0.5 kg/week you need' : 'fast enough to risk losing muscle';
  return card('Weekly check', `<p>You're ${rate}, ${why}. Change your target from ${S.settings.kcal.toLocaleString()} to <b>${next.toLocaleString()} kcal</b>?</p>
    <div class="row"><button class="primary" data-act="check" data-d="${next - S.settings.kcal}">Apply</button>
    <button class="secondary" data-act="check" data-d="0">Not now</button></div>`);
}

function pickerSheet() {
  return `<div class="sheet-bg" data-act="unpick"></div>
  <div class="sheet" role="dialog" aria-label="Choose a workout">
    <p class="eyebrow">Choose a workout</p>
    ${Object.entries(DAYS).map(([k, d]) => `<button class="pick" data-act="start" data-day="${k}">
      <b>${d.name}</b><span>${d.subtitle} · ~${d.minutes} min</span></button>`).join('')}
    <button class="text-btn" data-act="unpick">Cancel</button>
  </div>`;
}

function card(title, body) {
  return `<section class="card"><p class="eyebrow">${esc(title)}</p>${body}</section>`;
}

function playerHeader(a) {
  const pct = (a.idx / a.steps.length) * 100;
  return `<header class="player-top">
      <button class="icon-btn" data-act="leave" aria-label="Back to home">←</button>
      <span class="muted">${esc(DAYS[a.day].name)} · ${a.idx + 1}/${a.steps.length}</span>
      <button class="text-btn" data-act="end">End</button>
    </header>
    <div class="bar"><span style="width:${pct}%"></span></div>`;
}

function stepMeta(step) {
  return `${esc(step.block)}${step.rounds > 1 ? ` · Round ${step.round}/${step.rounds}` : ''}`;
}

function workout() {
  const a = S.active;
  if (a.phase === 'rest') return restView(a);
  const step = a.steps[a.idx];
  const ex = EXERCISES[step.ex];
  const sides = ex.perSide ? ex.sideLabels || ['Left', 'Right'] : [null];
  const chips = [
    `<span class="chip">${esc(ex.load)}</span>`,
    step.slot ? `<span class="chip">${E.tempoText(step.level)}</span>` : '',
    step.range ? `<span class="chip">${step.range[0]}–${step.range[1]} reps</span>` : '',
    step.test ? '<span class="chip warn">Max reps, stop before form breaks</span>' : '',
  ].join('');
  return `<section class="player">
    ${playerHeader(a)}
    <p class="eyebrow">${stepMeta(step)}</p>
    <h1 class="ex-name">${esc(ex.name)}</h1>
    <div class="chips">${chips}</div>
    <ol class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ol>
    <div class="steppers ${sides.length > 1 ? 'two' : ''}">
      ${sides.map((label, i) => `<div class="stepper">
        ${label ? `<span class="side">${esc(label)}</span>` : ''}
        <div class="stepper-row">
          <button class="round" data-act="rep" data-i="${i}" data-d="-1" aria-label="One less">−</button>
          <output class="reps">${a.cur[i]}</output>
          <button class="round" data-act="rep" data-i="${i}" data-d="1" aria-label="One more">+</button>
        </div></div>`).join('')}
    </div>
    <p class="muted center">${step.test ? `Best so far: ${S.tests[step.ex]?.best ?? '–'}` : `Target ${step.target}${ex.perSide ? ' per side' : ''}`}</p>
    <button class="primary big" data-act="done">Done</button>
    <button class="text-btn center" data-act="skip">Skip this set</button>
  </section>`;
}

function restView(a) {
  const next = a.steps[a.idx + 1];
  const nx = EXERCISES[next.ex];
  return `<section class="player rest">
    ${playerHeader(a)}
    <p class="eyebrow center">${a.restKind === 'switch' ? 'Switch to the next exercise' : 'Rest'}</p>
    <div class="ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle class="ring-bg" cx="100" cy="100" r="90"/>
        <circle id="ring-fg" class="ring-fg" cx="100" cy="100" r="90" stroke-dasharray="${RING}" stroke-dashoffset="0"/>
      </svg>
      <div id="rest-num" class="ring-num" role="timer">${mmss(a.restTotal)}</div>
    </div>
    <div class="row three">
      <button class="secondary" data-act="rest" data-d="-15">−15 s</button>
      <button class="primary" data-act="skiprest">Skip</button>
      <button class="secondary" data-act="rest" data-d="15">+15 s</button>
    </div>
    <div class="card next">
      <p class="eyebrow">Next · ${stepMeta(next)}</p>
      <h2>${esc(nx.name)}</h2>
      <p class="muted">${next.test ? 'Max reps' : `${next.target}${nx.perSide ? ' per side' : ''} reps`} · ${esc(nx.load)}</p>
    </div>
  </section>`;
}

function summaryView() {
  if (!summary) return home();
  const { session, results, suggestions, testResults } = summary;
  const minutes = Math.max(1, Math.round((session.finishedAt - session.startedAt) / 60000));
  const totalReps = session.sets.reduce((s, x) => s + x.reps.reduce((a, b) => a + b, 0), 0);
  return `<header class="top"><p class="eyebrow">${esc(DAYS[session.day].name)} · week ${session.week}</p><h1>Workout complete</h1></header>
  <div class="card"><div class="stats">
    <div><b>${minutes}</b><span>minutes</span></div>
    <div><b>${session.sets.length}</b><span>sets</span></div>
    <div><b>${totalReps}</b><span>reps</span></div>
  </div></div>
  ${testResults.map(r => card(EXERCISES[r.ex].name, `<h2>${r.reps} reps ${r.isBest ? '<span class="good">new best</span>' : ''}</h2>
    ${r.prev ? `<p class="muted">Previous best ${r.prev}</p>` : ''}`)).join('')}
  ${suggestions.map((s, i) => card('Level up', `<p><b>${esc(EXERCISES[s.ex].name)}</b>: you hit the top of the range in two sessions in a row.</p>
    <p>Next: <b>${esc(s.next.label)}</b></p>
    ${s.state === 'open' ? `<div class="row"><button class="primary" data-act="accept" data-i="${i}">Accept</button>
      <button class="secondary" data-act="decline" data-i="${i}">Not now</button></div>`
      : `<p class="muted">${s.state === 'accepted' ? 'Applied from next session ✓' : 'Skipped. Asked again after two more sessions.'}</p>`}`)).join('')}
  ${results.length ? card('Sets', `<ul class="results">${results.map(r => `<li>
    <span>${esc(EXERCISES[r.ex].name)}</span>
    <span class="${r.hitTarget ? 'good' : 'muted'}">${r.reps.map(repsText).join(' · ')}${r.hitTarget ? ' ✓' : ''}</span></li>`).join('')}</ul>
    <p class="muted">Next target reps update automatically.</p>`) : ''}
  <button class="primary big" data-act="home">Back to home</button>`;
}

function weight() {
  const t = today();
  const sorted = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.at(-1);
  if (weightDraft == null) weightDraft = S.weights.find(w => w.date === t)?.kg ?? last?.kg ?? S.settings.startWeight;
  return `<header class="top"><p class="eyebrow">Weigh in</p><h1>Weight</h1></header>
  ${card('Today · morning, before breakfast', `
    <div class="stepper-row weight">
      <button class="round small" data-act="w" data-d="-1">−1</button>
      <button class="round small" data-act="w" data-d="-0.1">−.1</button>
      <output class="reps">${kg(weightDraft)}</output>
      <button class="round small" data-act="w" data-d="0.1">+.1</button>
      <button class="round small" data-act="w" data-d="1">+1</button>
    </div>
    <button class="primary big" data-act="wsave">Save ${kg(weightDraft)} kg</button>`)}
  ${card('Trend', `${chart(sorted)}
    <div class="legend"><span><i class="lg-dot"></i>Daily</span><span><i class="lg-avg"></i>7-day average</span><span><i class="lg-target"></i>Target pace</span></div>`)}
  ${card('Recent', sorted.length ? `<ul class="results">${sorted.slice(-14).reverse().map(w => `<li>
    <span>${esc(w.date)}</span><span>${kg(w.kg)} kg <button class="icon-btn small" data-act="wdel" data-date="${esc(w.date)}" aria-label="Delete">✕</button></span></li>`).join('')}</ul>`
    : '<p class="muted">No entries yet.</p>')}`;
}

function chart(ws) {
  const st = S.settings;
  const x0 = st.startDate;
  const x1 = ws.length && ws.at(-1).date > st.targetDate ? ws.at(-1).date : st.targetDate;
  const span = Math.max(1, E.daysBetween(x0, x1));
  const pts = ws.filter(w => w.date >= x0);
  const vals = pts.map(w => w.kg).concat([st.startWeight, st.targetWeight]);
  const yMin = Math.floor(Math.min(...vals) - 1);
  const yMax = Math.ceil(Math.max(...vals) + 1);
  const W = 340, H = 200, L = 30, R = 8, T = 10, B = 22;
  const X = d => L + (E.daysBetween(x0, d) / span) * (W - L - R);
  const Y = v => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const stepKg = yMax - yMin > 8 ? 2 : 1;

  let grid = '';
  for (let v = Math.ceil(yMin / stepKg) * stepKg; v <= yMax; v += stepKg) {
    grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`;
  }
  const d0 = E.parseYmd(x0);
  for (let m = new Date(d0.getFullYear(), d0.getMonth() + 1, 1); E.ymd(m) <= x1; m.setMonth(m.getMonth() + 1)) {
    const x = X(E.ymd(m));
    grid += `<line class="grid" x1="${x}" x2="${x}" y1="${T}" y2="${H - B}"/><text class="axis" x="${x}" y="${H - 6}" text-anchor="middle">${m.toLocaleDateString('en-US', { month: 'short' })}</text>`;
  }
  const target = `<line class="target" x1="${X(x0)}" y1="${Y(st.startWeight)}" x2="${X(st.targetDate)}" y2="${Y(st.targetWeight)}"/>`;
  const dots = pts.map(w => `<circle class="dot" cx="${X(w.date)}" cy="${Y(w.kg)}" r="2.5"/>`).join('');
  const avg = pts.map(w => `${X(w.date)},${Y(E.avg7(ws, w.date))}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend against target pace">
    ${grid}${target}${dots}${pts.length > 1 ? `<polyline class="avg" points="${avg}"/>` : ''}</svg>`;
}

function progress() {
  const t = today();
  const totalReps = S.sessions.reduce((s, x) => s + x.sets.reduce((a, y) => a + y.reps.reduce((p, q) => p + q, 0), 0), 0);
  const slotsFor = k => DAYS[k].blocks.filter(b => b.type !== 'warmup').flatMap(b => b.items.map(it => `${k}:${typeof it === 'string' ? it : it.ex}`));
  const test = ex => {
    const h = S.tests[ex]?.history || [];
    return `<div><b>${S.tests[ex]?.best ?? '–'}</b><span>${ex === 'pushup' ? 'push-ups' : 'squats'}${h.length > 1 ? ` (first ${h[0].reps})` : ''}</span></div>`;
  };
  return `<header class="top"><p class="eyebrow">Week ${E.weekNumber(S.settings.startDate, t)}</p><h1>Progress</h1></header>
  ${card('All time', `<div class="stats">
    <div><b>${S.sessions.filter(s => s.day !== 'T').length}</b><span>workouts</span></div>
    <div><b>${totalReps.toLocaleString()}</b><span>reps</span></div>
  </div>`)}
  ${card('Max test', `<div class="stats">${test('pushup')}${test('squat_bw')}</div>`)}
  ${['A', 'B', 'C'].map(k => card(`${DAYS[k].name} · ${DAYS[k].subtitle}`, `<ul class="results">${slotsFor(k).map(slot => {
    const st = E.slotState(S.progress, slot);
    const ex = EXERCISES[st.ex];
    return `<li><span>${esc(ex.name)}<small>${E.levelText(st.level)}${st.streak ? ` · at top ${st.streak}/2` : ''}</small></span>
      <span>${st.target ?? ex.range[0]} reps</span></li>`;
  }).join('')}</ul>`)).join('')}
  ${card('Recent workouts', S.sessions.length ? `<ul class="results">${S.sessions.slice(-10).reverse().map(s => `<li>
    <span>${esc(s.date)} · ${esc(DAYS[s.day].name)}</span><span class="muted">${Math.max(1, Math.round((s.finishedAt - s.startedAt) / 60000))} min · ${s.sets.length} sets</span></li>`).join('')}</ul>`
    : '<p class="muted">Your finished workouts appear here.</p>')}`;
}

function settings() {
  const st = S.settings;
  const num = (k, label, step = 1) => `<label class="field"><span>${label}</span>
    <input type="number" inputmode="decimal" step="${step}" value="${st[k]}" data-set="${k}"></label>`;
  const date = (k, label) => `<label class="field"><span>${label}</span><input type="date" value="${st[k]}" data-set="${k}"></label>`;
  const sw = (k, label, note) => `<label class="field switch"><span>${label}<small>${note}</small></span>
    <input type="checkbox" ${st[k] ? 'checked' : ''} data-set="${k}"></label>`;
  return `<header class="top"><p class="eyebrow">Settings</p><h1>Settings</h1></header>
  ${card('Goal', num('startWeight', 'Start weight (kg)', 0.1) + num('targetWeight', 'Target weight (kg)', 0.1)
    + date('startDate', 'Plan start (week 1)') + date('targetDate', 'Target date'))}
  ${card('Food', num('kcal', 'Daily calories', 50) + num('protein', 'Daily protein (g)', 5))}
  ${card('Rest timer', sw('vibrate', 'Vibration', 'Buzz at 3-2-1 and when rest ends')
    + sw('sound', 'Sound', 'Off keeps it silent for neighbours'))}
  ${card('Your data', `<p class="muted">Everything is stored only on this phone. Export a backup now and then.</p>
    <div class="row"><button class="secondary" data-act="export">Export backup</button>
    <button class="secondary" data-act="import">Import backup</button></div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
    <button class="text-btn danger" data-act="reset">Delete all data</button>`)}
  ${card('Quiet rules', `<ul class="plain"><li>Lower every rep over 3 seconds.</li><li>Train barefoot on a folded blanket.</li>
    <li>Set dumbbells down on a towel. Never drop them.</li><li>Put the chair against a wall for dips and decline push-ups.</li></ul>`)}`;
}

// ---------- events ----------
const actions = {
  start: d => startWorkout(d.day),
  pick: () => { picker = true; render(); },
  unpick: () => { picker = false; render(); },
  resume: () => { view = 'workout'; keepAwake(true); render(); },
  leave: () => { view = 'home'; render(); },
  home: () => { summary = null; view = 'home'; render(); },
  rep: d => {
    const a = S.active;
    a.cur[d.i] = Math.max(0, a.cur[d.i] + Number(d.d));
    commit();
  },
  done: () => {
    const a = S.active;
    a.logs[a.idx] = a.cur.slice();
    buzz(40);
    afterSet();
    commit();
  },
  skip: () => { nextStep(); commit(); },
  end: () => {
    const logged = Object.keys(S.active.logs).length;
    if (!confirm(logged ? 'End the workout now? Logged sets are saved.' : 'End the workout? Nothing was logged.')) return;
    finish();
    commit();
  },
  rest: d => {
    const a = S.active;
    a.restEndsAt = Math.max(Date.now() + 1000, a.restEndsAt + Number(d.d) * 1000);
    a.restTotal = Math.max(1, a.restTotal + Number(d.d));
    lastCue = null;
    commit();
  },
  skiprest: () => { nextStep(); commit(); },
  accept: d => {
    const s = summary.suggestions[d.i];
    S.progress[s.slot] = E.acceptStep(E.slotState(S.progress, s.slot), s.next);
    s.state = 'accepted';
    commit();
  },
  decline: d => {
    const s = summary.suggestions[d.i];
    S.progress[s.slot] = { ...E.slotState(S.progress, s.slot), streak: 0 };
    s.state = 'declined';
    commit();
  },
  food: d => {
    const t = today();
    S.nutrition[t] = { ...S.nutrition[t], [d.k]: !S.nutrition[t]?.[d.k] };
    commit();
  },
  check: d => {
    S.settings.kcal = Math.max(E.MIN_KCAL, S.settings.kcal + Number(d.d));
    S.checks[E.weekNumber(S.settings.startDate, today())] = true;
    commit();
  },
  w: d => { weightDraft = Math.round((weightDraft + Number(d.d)) * 10) / 10; render(); },
  wsave: () => {
    const t = today();
    S.weights = S.weights.filter(w => w.date !== t).concat({ date: t, kg: weightDraft });
    view = 'home';
    commit();
  },
  wdel: d => {
    if (!confirm(`Delete the entry for ${d.date}?`)) return;
    S.weights = S.weights.filter(w => w.date !== d.date);
    weightDraft = null;
    commit();
  },
  export: () => {
    const blob = new Blob([JSON.stringify({ ...S, active: null }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `quiet-reps-backup-${today()}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => document.getElementById('import-file').click(),
  reset: () => {
    if (!confirm('Delete all workouts, weights and settings on this phone?')) return;
    if (!confirm('This cannot be undone. Delete everything?')) return;
    S = defaultState();
    view = 'home';
    commit();
  },
};

document.addEventListener('click', e => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    view = navBtn.dataset.nav;
    weightDraft = null;
    picker = false;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el.dataset);
});

app.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'import-file' && el.files[0]) {
    try {
      const next = normalize(JSON.parse(await el.files[0].text()));
      if (!confirm('Replace the data on this phone with this backup?')) return;
      S = { ...next, active: null };
      commit();
    } catch (err) {
      alert(`Could not import: ${err.message}`);
    }
    return;
  }
  const k = el.dataset.set;
  if (!k) return;
  if (el.type === 'checkbox') S.settings[k] = el.checked;
  else if (el.type === 'date') { if (el.value) S.settings[k] = el.value; }
  else if (el.value !== '' && Number.isFinite(Number(el.value))) S.settings[k] = Number(el.value);
  if (k === 'sound' && el.checked) beep(660, 80);
  commit();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});

if (S.active) keepAwake(true);
render();

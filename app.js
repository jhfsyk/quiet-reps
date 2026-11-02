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
const perSideNote = ex => (ex.perSide ? '（片側）' : '');

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
    todayCard = card('途中のワークアウト', `<h2>${esc(DAYS[S.active.day].name)}・ステップ ${S.active.idx + 1}/${S.active.steps.length}</h2>
      <button class="primary big" data-act="resume">再開する</button>`);
  } else if (doneToday) {
    todayCard = card('今日', `<h2>今日は完了 ✓</h2><p class="muted">しっかり食べて、よく寝よう。次のトレーニングで。</p>
      <button class="text-btn" data-act="pick">別のワークアウトをする</button>`);
  } else if (scheduled) {
    const d = DAYS[scheduled];
    todayCard = card('今日', `<h2>${d.name} <span class="muted">・${d.subtitle}</span></h2>
      <p class="muted">約${d.minutes}分・静音モード${phase.deload ? '・ディロード：各2セット' : ''}${phase.shortRest ? '・休憩45秒' : ''}</p>
      <button class="primary big" data-act="start" data-day="${scheduled}">スタート</button>
      <button class="text-btn" data-act="pick">別のワークアウトを選ぶ</button>`);
  } else {
    todayCard = card('今日', `<h2>休養日</h2><p class="muted">散歩・ストレッチ・睡眠。筋肉は休んでいる間に育ちます。</p>
      <button class="text-btn" data-act="pick">それでもトレーニングする</button>`);
  }

  const strip = weekDates.map((d, i) => {
    const planned = SCHEDULE[(i + 1) % 7];
    const done = S.sessions.some(s => s.date === d && s.day !== 'T');
    return `<div class="day ${done ? 'done' : ''} ${planned ? '' : 'off'} ${d === t ? 'today' : ''}">
      <span>${'月火水木金土日'[i]}</span><i>${done ? '✓' : planned || '·'}</i></div>`;
  }).join('');

  const avg = E.avg7(S.weights, t);
  const target = E.targetOn(st, t);
  const todays = S.weights.find(w => w.date === t);
  const weeksLeft = Math.max(0, Math.ceil(E.daysBetween(t, st.targetDate) / 7));
  const pace = avg == null ? '数日分、朝の体重を記録すると推移が見えます'
    : avg <= target ? `目標ペースより ${kg(target - avg)} kg 先行` : `目標ペースより ${kg(avg - target)} kg 遅れ`;

  const n = S.nutrition[t] || {};
  const hints = [];
  if (week === 1 && !S.tests.pushup) hints.push(card('ベースライン', `<p>今週中にMAXテストを1回行い、腕立て伏せとスクワットの開始時の回数を記録しましょう。</p>
    <button class="text-btn" data-act="start" data-day="T">MAXテストを始める</button>`));
  if (week === 17) hints.push(card('テスト週', `<p>腕立て伏せとスクワットのMAXを再測定して、第1週と比べましょう。</p>
    <button class="text-btn" data-act="start" data-day="T">MAXテストを始める</button>`));

  return `
  <header class="top">
    <p class="eyebrow">第${week}週・${esc(phase.name)}</p>
    <h1>${now.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</h1>
  </header>
  ${todayCard}
  ${card(`今週・${doneCount}/5`, `<div class="strip">${strip}</div>`)}
  ${weeklyCheckCard(week, t)}
  ${hints.join('')}
  ${card('体重', `
    <div class="stats">
      <div><b>${kg(avg)}</b><span>7日平均</span></div>
      <div><b>${kg(target)}</b><span>今日の目標</span></div>
      <div><b>${weeksLeft}</b><span>残り週数</span></div>
    </div>
    <p class="muted">${pace}</p>
    <button class="secondary" data-nav="weight">${todays ? `今日：${kg(todays.kg)} kg・編集` : '体重を記録'}</button>`)}
  ${card('今日の食事', `
    <div class="toggles">
      <button class="toggle ${n.kcal ? 'on' : ''}" data-act="food" data-k="kcal"><b>${st.kcal.toLocaleString()} kcal</b><span>${n.kcal ? '達成 ✓' : '守れたらタップ'}</span></button>
      <button class="toggle ${n.protein ? 'on' : ''}" data-act="food" data-k="protein"><b>たんぱく質 ${st.protein} g</b><span>${n.protein ? '達成 ✓' : '摂れたらタップ'}</span></button>
    </div>`)}
  ${picker ? pickerSheet() : ''}`;
}

function weeklyCheckCard(week, t) {
  const dow = new Date().getDay();
  if ((dow !== 6 && dow !== 0) || S.checks[week]) return '';
  const res = E.weeklyCheck(S.weights, t);
  if (!res) return '';
  const rate = `週 ${kg(Math.abs(res.rate))} kg のペースで${res.rate >= 0 ? '減っています' : '増えています'}`;
  if (res.delta === 0) {
    return card('週次チェック', `<p>現在、${rate}。ペース通りです。${S.settings.kcal.toLocaleString()} kcal を続けましょう。</p>
      <button class="secondary" data-act="check" data-d="0">OK</button>`);
  }
  const next = Math.max(E.MIN_KCAL, S.settings.kcal + res.delta);
  const why = res.delta < 0 ? '必要な週0.5 kgより遅いペースです' : '筋肉が落ちるおそれのある速さです';
  return card('週次チェック', `<p>現在、${rate}。${why}。目標を ${S.settings.kcal.toLocaleString()} から <b>${next.toLocaleString()} kcal</b> に変更しますか？</p>
    <div class="row"><button class="primary" data-act="check" data-d="${next - S.settings.kcal}">変更する</button>
    <button class="secondary" data-act="check" data-d="0">今はしない</button></div>`);
}

function pickerSheet() {
  return `<div class="sheet-bg" data-act="unpick"></div>
  <div class="sheet" role="dialog" aria-label="ワークアウトを選ぶ">
    <p class="eyebrow">ワークアウトを選ぶ</p>
    ${Object.entries(DAYS).map(([k, d]) => `<button class="pick" data-act="start" data-day="${k}">
      <b>${d.name}</b><span>${d.subtitle}・約${d.minutes}分</span></button>`).join('')}
    <button class="text-btn" data-act="unpick">キャンセル</button>
  </div>`;
}

function card(title, body) {
  return `<section class="card"><p class="eyebrow">${esc(title)}</p>${body}</section>`;
}

function playerHeader(a) {
  const pct = (a.idx / a.steps.length) * 100;
  return `<header class="player-top">
      <button class="icon-btn" data-act="leave" aria-label="ホームに戻る">←</button>
      <span class="muted">${esc(DAYS[a.day].name)}・${a.idx + 1}/${a.steps.length}</span>
      <button class="text-btn" data-act="end">終了</button>
    </header>
    <div class="bar"><span style="width:${pct}%"></span></div>`;
}

function stepMeta(step) {
  return `${esc(step.block)}${step.rounds > 1 ? `・ラウンド ${step.round}/${step.rounds}` : ''}`;
}

function workout() {
  const a = S.active;
  if (a.phase === 'rest') return restView(a);
  const step = a.steps[a.idx];
  const ex = EXERCISES[step.ex];
  const sides = ex.perSide ? ex.sideLabels || ['左', '右'] : [null];
  const chips = [
    `<span class="chip">${esc(ex.load)}</span>`,
    step.slot ? `<span class="chip">${E.tempoText(step.level)}</span>` : '',
    step.range ? `<span class="chip">${step.range[0]}〜${step.range[1]}回</span>` : '',
    step.test ? '<span class="chip warn">最大回数（フォームが崩れる前に止める）</span>' : '',
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
          <button class="round" data-act="rep" data-i="${i}" data-d="-1" aria-label="1回減らす">−</button>
          <output class="reps">${a.cur[i]}</output>
          <button class="round" data-act="rep" data-i="${i}" data-d="1" aria-label="1回増やす">+</button>
        </div></div>`).join('')}
    </div>
    <p class="muted center">${step.test ? `自己ベスト：${S.tests[step.ex]?.best ?? '–'}回` : `目標 ${step.target}回${perSideNote(ex)}`}</p>
    <button class="primary big" data-act="done">完了</button>
    <button class="text-btn center" data-act="skip">このセットをスキップ</button>
  </section>`;
}

function restView(a) {
  const next = a.steps[a.idx + 1];
  const nx = EXERCISES[next.ex];
  return `<section class="player rest">
    ${playerHeader(a)}
    <p class="eyebrow center">${a.restKind === 'switch' ? '次の種目へ移動' : '休憩'}</p>
    <div class="ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle class="ring-bg" cx="100" cy="100" r="90"/>
        <circle id="ring-fg" class="ring-fg" cx="100" cy="100" r="90" stroke-dasharray="${RING}" stroke-dashoffset="0"/>
      </svg>
      <div id="rest-num" class="ring-num" role="timer">${mmss(a.restTotal)}</div>
    </div>
    <div class="row three">
      <button class="secondary" data-act="rest" data-d="-15">−15秒</button>
      <button class="primary" data-act="skiprest">スキップ</button>
      <button class="secondary" data-act="rest" data-d="15">+15秒</button>
    </div>
    <div class="card next">
      <p class="eyebrow">次・${stepMeta(next)}</p>
      <h2>${esc(nx.name)}</h2>
      <p class="muted">${next.test ? '最大回数' : `${next.target}回${perSideNote(nx)}`}・${esc(nx.load)}</p>
    </div>
  </section>`;
}

function summaryView() {
  if (!summary) return home();
  const { session, results, suggestions, testResults } = summary;
  const minutes = Math.max(1, Math.round((session.finishedAt - session.startedAt) / 60000));
  const totalReps = session.sets.reduce((s, x) => s + x.reps.reduce((a, b) => a + b, 0), 0);
  return `<header class="top"><p class="eyebrow">${esc(DAYS[session.day].name)}・第${session.week}週</p><h1>ワークアウト完了</h1></header>
  <div class="card"><div class="stats">
    <div><b>${minutes}</b><span>分</span></div>
    <div><b>${session.sets.length}</b><span>セット</span></div>
    <div><b>${totalReps}</b><span>回</span></div>
  </div></div>
  ${testResults.map(r => card(EXERCISES[r.ex].name, `<h2>${r.reps}回 ${r.isBest ? '<span class="good">自己ベスト更新</span>' : ''}</h2>
    ${r.prev ? `<p class="muted">これまでのベスト ${r.prev}回</p>` : ''}`)).join('')}
  ${suggestions.map((s, i) => card('レベルアップ', `<p><b>${esc(EXERCISES[s.ex].name)}</b>：2回続けて回数レンジの上限を達成しました。</p>
    <p>次のステップ：<b>${esc(s.next.label)}</b></p>
    ${s.state === 'open' ? `<div class="row"><button class="primary" data-act="accept" data-i="${i}">適用する</button>
      <button class="secondary" data-act="decline" data-i="${i}">今はしない</button></div>`
      : `<p class="muted">${s.state === 'accepted' ? '次回から適用されます ✓' : 'スキップしました。あと2回達成すると再度提案します。'}</p>`}`)).join('')}
  ${results.length ? card('セット', `<ul class="results">${results.map(r => `<li>
    <span>${esc(EXERCISES[r.ex].name)}</span>
    <span class="${r.hitTarget ? 'good' : 'muted'}">${r.reps.map(repsText).join('・')}${r.hitTarget ? ' ✓' : ''}</span></li>`).join('')}</ul>
    <p class="muted">次回の目標回数は自動で更新されます。</p>`) : ''}
  <button class="primary big" data-act="home">ホームに戻る</button>`;
}

function weight() {
  const t = today();
  const sorted = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.at(-1);
  if (weightDraft == null) weightDraft = S.weights.find(w => w.date === t)?.kg ?? last?.kg ?? S.settings.startWeight;
  return `<header class="top"><p class="eyebrow">体重記録</p><h1>体重</h1></header>
  ${card('今日・朝、朝食前に', `
    <div class="stepper-row weight">
      <button class="round small" data-act="w" data-d="-1">−1</button>
      <button class="round small" data-act="w" data-d="-0.1">−.1</button>
      <output class="reps">${kg(weightDraft)}</output>
      <button class="round small" data-act="w" data-d="0.1">+.1</button>
      <button class="round small" data-act="w" data-d="1">+1</button>
    </div>
    <button class="primary big" data-act="wsave">${kg(weightDraft)} kg で保存</button>`)}
  ${card('推移', `${chart(sorted)}
    <div class="legend"><span><i class="lg-dot"></i>毎日の体重</span><span><i class="lg-avg"></i>7日平均</span><span><i class="lg-target"></i>目標ペース</span></div>`)}
  ${card('最近の記録', sorted.length ? `<ul class="results">${sorted.slice(-14).reverse().map(w => `<li>
    <span>${esc(w.date)}</span><span>${kg(w.kg)} kg <button class="icon-btn small" data-act="wdel" data-date="${esc(w.date)}" aria-label="削除">✕</button></span></li>`).join('')}</ul>`
    : '<p class="muted">記録はまだありません。</p>')}`;
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
    grid += `<line class="grid" x1="${x}" x2="${x}" y1="${T}" y2="${H - B}"/><text class="axis" x="${x}" y="${H - 6}" text-anchor="middle">${m.getMonth() + 1}月</text>`;
  }
  const target = `<line class="target" x1="${X(x0)}" y1="${Y(st.startWeight)}" x2="${X(st.targetDate)}" y2="${Y(st.targetWeight)}"/>`;
  const dots = pts.map(w => `<circle class="dot" cx="${X(w.date)}" cy="${Y(w.kg)}" r="2.5"/>`).join('');
  const avg = pts.map(w => `${X(w.date)},${Y(E.avg7(ws, w.date))}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重の推移と目標ペース">
    ${grid}${target}${dots}${pts.length > 1 ? `<polyline class="avg" points="${avg}"/>` : ''}</svg>`;
}

function progress() {
  const t = today();
  const totalReps = S.sessions.reduce((s, x) => s + x.sets.reduce((a, y) => a + y.reps.reduce((p, q) => p + q, 0), 0), 0);
  const slotsFor = k => DAYS[k].blocks.filter(b => b.type !== 'warmup').flatMap(b => b.items.map(it => `${k}:${typeof it === 'string' ? it : it.ex}`));
  const test = ex => {
    const h = S.tests[ex]?.history || [];
    return `<div><b>${S.tests[ex]?.best ?? '–'}</b><span>${ex === 'pushup' ? '腕立て伏せ' : 'スクワット'}${h.length > 1 ? `（初回 ${h[0].reps}）` : ''}</span></div>`;
  };
  return `<header class="top"><p class="eyebrow">第${E.weekNumber(S.settings.startDate, t)}週</p><h1>進捗</h1></header>
  ${card('累計', `<div class="stats">
    <div><b>${S.sessions.filter(s => s.day !== 'T').length}</b><span>ワークアウト</span></div>
    <div><b>${totalReps.toLocaleString()}</b><span>回</span></div>
  </div>`)}
  ${card('MAXテスト', `<div class="stats">${test('pushup')}${test('squat_bw')}</div>`)}
  ${['A', 'B', 'C'].map(k => card(`${DAYS[k].name}・${DAYS[k].subtitle}`, `<ul class="results">${slotsFor(k).map(slot => {
    const st = E.slotState(S.progress, slot);
    const ex = EXERCISES[st.ex];
    return `<li><span>${esc(ex.name)}<small>${E.levelText(st.level)}${st.streak ? `・上限達成 ${st.streak}/2` : ''}</small></span>
      <span>${st.target ?? ex.range[0]}回</span></li>`;
  }).join('')}</ul>`)).join('')}
  ${card('最近のワークアウト', S.sessions.length ? `<ul class="results">${S.sessions.slice(-10).reverse().map(s => `<li>
    <span>${esc(s.date)}・${esc(DAYS[s.day].name)}</span><span class="muted">${Math.max(1, Math.round((s.finishedAt - s.startedAt) / 60000))}分・${s.sets.length}セット</span></li>`).join('')}</ul>`
    : '<p class="muted">完了したワークアウトがここに表示されます。</p>')}`;
}

function settings() {
  const st = S.settings;
  const num = (k, label, step = 1) => `<label class="field"><span>${label}</span>
    <input type="number" inputmode="decimal" step="${step}" value="${st[k]}" data-set="${k}"></label>`;
  const date = (k, label) => `<label class="field"><span>${label}</span><input type="date" value="${st[k]}" data-set="${k}"></label>`;
  const sw = (k, label, note) => `<label class="field switch"><span>${label}<small>${note}</small></span>
    <input type="checkbox" ${st[k] ? 'checked' : ''} data-set="${k}"></label>`;
  return `<header class="top"><p class="eyebrow">設定</p><h1>設定</h1></header>
  ${card('目標', num('startWeight', '開始時の体重（kg）', 0.1) + num('targetWeight', '目標体重（kg）', 0.1)
    + date('startDate', 'プラン開始日（第1週）') + date('targetDate', '目標日'))}
  ${card('食事', num('kcal', '1日のカロリー（kcal）', 50) + num('protein', '1日のたんぱく質（g）', 5))}
  ${card('休憩タイマー', sw('vibrate', 'バイブレーション', '残り3・2・1秒と休憩終了時に振動')
    + sw('sound', 'サウンド', 'オフにすると音が出ず、ご近所にも静か'))}
  ${card('データ', `<p class="muted">データはすべてこのスマホの中だけに保存されます。ときどきバックアップを書き出してください。</p>
    <div class="row"><button class="secondary" data-act="export">バックアップを書き出す</button>
    <button class="secondary" data-act="import">バックアップを読み込む</button></div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
    <button class="text-btn danger" data-act="reset">すべてのデータを削除</button>`)}
  ${card('静音のルール', `<ul class="plain"><li>毎回3秒かけて下ろす。</li><li>たたんだ毛布の上で、裸足でトレーニングする。</li>
    <li>ダンベルはタオルの上に置く。絶対に落とさない。</li><li>ディップスとデクライン腕立て伏せでは椅子を壁につける。</li></ul>`)}`;
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
    if (!confirm(logged ? 'ワークアウトを終了しますか？記録したセットは保存されます。' : 'ワークアウトを終了しますか？まだ何も記録されていません。')) return;
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
    if (!confirm(`${d.date} の記録を削除しますか？`)) return;
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
    if (!confirm('このスマホのワークアウト・体重・設定をすべて削除しますか？')) return;
    if (!confirm('この操作は取り消せません。本当にすべて削除しますか？')) return;
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
      if (!confirm('このバックアップでスマホのデータを置き換えますか？')) return;
      S = { ...next, active: null };
      commit();
    } catch (err) {
      alert(`読み込めませんでした：${err.message}`);
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

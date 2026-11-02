// All data lives in this browser's localStorage. Export/import in Settings is the backup.
const KEY = 'quietreps.v1';

export function defaultState() {
  return {
    v: 1,
    settings: {
      startDate: '2026-11-02', targetDate: '2027-02-28',
      startWeight: 79, targetWeight: 70,
      kcal: 1900, protein: 140,
      vibrate: true, sound: false,
    },
    progress: {},   // 'A:pushup' -> { ex, level, target, streak }
    tests: {},      // 'pushup' -> { best, history: [{ date, reps }] }
    sessions: [],   // finished workouts
    weights: [],    // [{ date, kg }], one per day
    nutrition: {},  // 'YYYY-MM-DD' -> { kcal: bool, protein: bool }
    checks: {},     // weekly calorie check handled, by week number
    active: null,   // in-progress workout, so a reload or screen lock can resume it
  };
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object' || !raw.settings) throw new Error('Quiet Reps のバックアップではありません');
  return { ...base, ...raw, settings: { ...base.settings, ...raw.settings } };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* storage blocked or corrupt: start fresh */ }
  return defaultState();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* nothing else we can do */ }
}

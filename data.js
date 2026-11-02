// Exercise catalog and weekly plan. Everything is rep-based and floor-quiet:
// no jumps, slow lowering, dumbbells are set down on a towel, never dropped.

export const EXERCISES = {
  // Warm-up / test
  squat_bw: { name: 'Bodyweight squat', load: 'Bodyweight', range: [10, 10],
    cues: ['Feet shoulder-width, toes slightly out', 'Sit down between your heels, chest up', 'Stand up smoothly, no bounce'] },
  arm_circles: { name: 'Arm circles', load: 'Bodyweight', perSide: true, sideLabels: ['Forward', 'Backward'], range: [10, 10],
    cues: ['Arms straight out to the sides', 'Start small, make the circles bigger', 'Shoulders down, away from your ears'] },
  inchworm: { name: 'Inchworm', load: 'Bodyweight', range: [5, 5],
    cues: ['Fold forward, hands to the blanket', 'Walk the hands out to a push-up position', 'Walk them back and stand up slowly'] },

  // Day A
  goblet_squat: { name: 'Goblet squat', load: '10 kg', range: [12, 15], harder: 'bss_10',
    cues: ['Hold the 10 kg dumbbell upright at your chest', 'Elbows inside the knees at the bottom', 'Push through the whole foot to stand'] },
  pushup: { name: 'Push-up', load: 'Bodyweight', range: [10, 12], harder: 'decline_pushup',
    cues: ['Hands under shoulders on the folded blanket', 'Body in one straight line, glutes tight', 'Lower until your chest is a fist from the floor'] },
  decline_pushup: { name: 'Decline push-up', load: 'Feet on chair', range: [8, 12], harder: 'archer_pushup',
    cues: ['Chair against a wall so it cannot slide', 'Feet on the seat, hands on the blanket', 'Keep hips level with shoulders'] },
  archer_pushup: { name: 'Archer push-up', load: 'Bodyweight', perSide: true, range: [5, 8],
    cues: ['Hands wide, one arm stays straight', 'Shift your weight onto the bending arm', 'Alternate sides, count each side'] },
  db_row: { name: 'One-arm row', load: '10 kg', perSide: true, range: [12, 15], harder: 'db_row_pause',
    cues: ['Hand and knee braced on a chair', 'Pull the elbow back toward your hip', 'Lower slowly; set the weight down on a towel'] },
  db_row_pause: { name: 'One-arm row, 2 s pause', load: '10 kg', perSide: true, range: [12, 20],
    cues: ['Same setup as the one-arm row', 'Hold 2 s at the top, squeeze the shoulder blade', 'Lower over 3 s'] },
  sl_glute_bridge: { name: 'Single-leg glute bridge', load: 'Bodyweight', perSide: true, range: [10, 12], harder: 'sl_hip_thrust',
    cues: ['Lie on the blanket, one foot flat, other leg up', 'Drive the hips up through the heel', 'Squeeze 1 s at the top'] },
  sl_hip_thrust: { name: 'Single-leg hip thrust', load: 'Shoulders on couch', perSide: true, range: [10, 15],
    cues: ['Upper back on the couch edge', 'One foot flat, other knee up', 'Hips to a straight line, pause 1 s'] },
  walkout_burpee: { name: 'Walk-out burpee (no jump)', load: 'Bodyweight', range: [8, 10],
    cues: ['Squat down, hands on the blanket', 'Step back one foot at a time, do 1 push-up', 'Step in and stand up tall: no jump'] },
  dead_bug: { name: 'Dead bug', load: 'Bodyweight', perSide: true, range: [10, 12],
    cues: ['Lower back pressed into the floor', 'Extend opposite arm and leg slowly', 'Breathe out as you reach'] },

  // Day B
  sl_rdl: { name: 'Single-leg Romanian deadlift', load: '10 kg', perSide: true, range: [8, 10],
    cues: ['Hold the dumbbell in the hand opposite the standing leg', 'Hinge at the hip, back leg reaches behind', 'Soft standing knee, flat back'] },
  ohp: { name: 'Overhead press (standing)', load: '5 kg × 2', range: [10, 15], harder: 'pike_pushup',
    cues: ['Dumbbells at shoulder height, palms forward', 'Ribs down, glutes tight', 'Press straight up, lower over 3 s'] },
  pike_pushup: { name: 'Pike push-up', load: 'Bodyweight', range: [8, 12], harder: 'pike_pushup_elev',
    cues: ['Hips high, body in an upside-down V', 'Lower the top of your head toward the floor', 'Press back up through the shoulders'] },
  pike_pushup_elev: { name: 'Elevated pike push-up', load: 'Feet on chair', range: [6, 10],
    cues: ['Chair against a wall, feet on the seat', 'Hips stacked over the shoulders', 'Lower slowly, head forward of the hands'] },
  reverse_lunge: { name: 'Reverse lunge', load: '5 kg × 2', perSide: true, range: [10, 12], harder: 'deficit_lunge',
    cues: ['Step back and place the foot down softly', 'Back knee lowers toward the floor', 'Push through the front heel to return'] },
  deficit_lunge: { name: 'Deficit reverse lunge', load: '5 kg × 2', perSide: true, range: [10, 12],
    cues: ['Front foot on a stable, low step', 'Step back softly, sink deeper than usual', 'Torso tall, front heel down'] },
  reverse_fly: { name: 'Bent-over reverse fly', load: '5 kg × 2', range: [12, 15],
    cues: ['Hinge forward, flat back', 'Raise the arms out wide, slight bend in the elbows', 'Squeeze the shoulder blades, lower over 3 s'] },
  chair_dip: { name: 'Chair dip', load: 'Bodyweight', range: [12, 15], harder: 'chair_dip_straight',
    cues: ['Chair against a wall so it cannot slide', 'Knees bent, elbows point straight back', 'Lower until upper arms are level'] },
  chair_dip_straight: { name: 'Chair dip, legs straight', load: 'Bodyweight', range: [10, 15],
    cues: ['Chair against a wall', 'Legs straight, heels on the floor', 'Elbows back, lower over 3 s'] },
  calf_raise: { name: 'Slow calf raise', load: 'Bodyweight', range: [15, 20], harder: 'sl_calf_raise',
    cues: ['Light fingertip support on the wall', 'Rise to the top and hold 1 s', 'Lower over 3 s, heels touch down softly'] },
  sl_calf_raise: { name: 'Single-leg calf raise', load: 'Bodyweight', perSide: true, range: [12, 15],
    cues: ['Fingertips on the wall for balance', 'Full rise, 1 s hold', 'Lower over 3 s'] },

  // Day C
  bss_bw: { name: 'Bulgarian split squat', load: 'Bodyweight', perSide: true, range: [8, 10], harder: 'bss_10',
    cues: ['Back foot laces-down on the couch', 'Front shin stays fairly upright', 'Lower until the back knee nearly touches the blanket'] },
  bss_10: { name: 'Bulgarian split squat (10 kg)', load: '10 kg', perSide: true, range: [8, 12],
    cues: ['Hold the dumbbell at your chest', 'Back foot on the couch', 'Lower over 3 s, drive up through the front heel'] },
  db_rdl: { name: 'Dumbbell Romanian deadlift', load: '5 kg × 2', range: [15, 20],
    cues: ['Dumbbells in front of the thighs', 'Push the hips back, flat back', 'Stand up by squeezing the glutes'] },
  reverse_crunch: { name: 'Reverse crunch', load: 'Bodyweight', range: [12, 15],
    cues: ['Lie on the blanket, knees bent at 90°', 'Curl the hips off the floor toward your chest', 'Lower slowly, feet do not touch down'] },
};

const WARMUP = { type: 'warmup', label: 'Warm-up', sets: 1, rest: 0,
  items: [{ ex: 'squat_bw', reps: 10 }, { ex: 'arm_circles', reps: 10 }, { ex: 'inchworm', reps: 5 }] };

// Items are an exercise id, or { ex, range } when a slot uses its own rep range.
export const DAYS = {
  A: { name: 'Day A', subtitle: 'Squat · Push · Row', minutes: 18, blocks: [
    WARMUP,
    { type: 'superset', label: 'Superset 1', sets: 3, rest: 60, items: ['goblet_squat', 'pushup'] },
    { type: 'superset', label: 'Superset 2', sets: 3, rest: 60, items: ['db_row', 'sl_glute_bridge'] },
    { type: 'finisher', label: 'Finisher', sets: 2, rest: 60, items: ['walkout_burpee', 'dead_bug'] },
  ] },
  B: { name: 'Day B', subtitle: 'Hinge · Shoulders · Upper back', minutes: 18, blocks: [
    WARMUP,
    { type: 'superset', label: 'Superset 1', sets: 3, rest: 60, items: ['sl_rdl', 'ohp'] },
    { type: 'superset', label: 'Superset 2', sets: 3, rest: 60, items: ['reverse_lunge', 'reverse_fly'] },
    { type: 'finisher', label: 'Finisher', sets: 2, rest: 60, items: ['chair_dip', 'calf_raise'] },
  ] },
  C: { name: 'Day C', subtitle: 'Full-body circuit', minutes: 18, blocks: [
    WARMUP,
    { type: 'circuit', label: 'Circuit', sets: 4, rest: 90, items: [
      'bss_bw', { ex: 'pushup', range: [10, 15] }, { ex: 'db_row', range: [12, 15] }, 'db_rdl', 'reverse_crunch'] },
  ] },
  T: { name: 'Max test', subtitle: 'Max push-ups and squats', minutes: 8, blocks: [
    WARMUP,
    { type: 'test', label: 'Max push-ups', sets: 1, rest: 120, items: ['pushup'] },
    { type: 'test', label: 'Max squats', sets: 1, rest: 0, items: ['squat_bw'] },
  ] },
};

// getDay(): 0 = Sunday. Wednesday and Sunday are rest days.
export const SCHEDULE = { 1: 'A', 2: 'B', 4: 'A', 5: 'B', 6: 'C' };

export const PHASES = [
  { from: 1, to: 4, name: 'Foundation' },
  { from: 5, to: 8, name: 'Build' },
  { from: 9, to: 9, name: 'Deload', deload: true },
  { from: 10, to: 16, name: 'Push', shortRest: true },
  { from: 17, to: 17, name: 'Test week' },
];

export const SWITCH_SEC = 10;
export const SHORT_REST_SEC = 45;
export const TEST_DEFAULTS = { pushup: 15, squat_bw: 25 };

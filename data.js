// Exercise catalog and weekly plan. Everything is rep-based and floor-quiet:
// no jumps, slow lowering, dumbbells are set down on a towel, never dropped.

export const EXERCISES = {
  // Warm-up / test
  squat_bw: { name: '自重スクワット', load: '自重', range: [10, 10],
    cues: ['足は肩幅、つま先はやや外向き', 'かかとの間にお尻を下ろし、胸を張る', '反動を使わずなめらかに立ち上がる'] },
  arm_circles: { name: 'アームサークル', load: '自重', perSide: true, sideLabels: ['前回し', '後ろ回し'], range: [10, 10],
    cues: ['腕を真横にまっすぐ伸ばす', '小さな円から始めて徐々に大きく', '肩をすくめず、耳から離す'] },
  inchworm: { name: 'インチワーム', load: '自重', range: [5, 5],
    cues: ['前屈して手を毛布につく', '手を前に歩かせて腕立ての姿勢へ', '手を戻してゆっくり立ち上がる'] },

  // Day A
  goblet_squat: { name: 'ゴブレットスクワット', load: '10 kg', range: [12, 15], harder: 'bss_10',
    cues: ['10 kgのダンベルを縦にして胸の前で持つ', '一番下で肘が膝の内側に入るまで下ろす', '足裏全体で床を押して立つ'] },
  pushup: { name: '腕立て伏せ', load: '自重', range: [10, 12], harder: 'decline_pushup',
    cues: ['たたんだ毛布の上、肩の真下に手をつく', '体を一直線に保ち、お尻を締める', '胸が床から拳ひとつ分まで下ろす'] },
  decline_pushup: { name: 'デクライン腕立て伏せ', load: '足を椅子に', range: [8, 12], harder: 'archer_pushup',
    cues: ['椅子は壁につけて滑らないようにする', '足を座面に、手は毛布の上', '腰を肩と同じ高さに保つ'] },
  archer_pushup: { name: 'アーチャー腕立て伏せ', load: '自重', perSide: true, range: [5, 8],
    cues: ['手を広くつき、片腕は伸ばしたまま', '曲げる腕の側に体重を移す', '左右交互に、片側ずつ数える'] },
  db_row: { name: 'ワンアームロウ', load: '10 kg', perSide: true, range: [12, 15], harder: 'db_row_pause',
    cues: ['片手と片膝を椅子について体を支える', '肘を腰の方へ引き上げる', 'ゆっくり下ろし、最後はタオルの上に置く'] },
  db_row_pause: { name: 'ワンアームロウ（2秒停止）', load: '10 kg', perSide: true, range: [12, 20],
    cues: ['ワンアームロウと同じ構え', '上で2秒止めて肩甲骨を寄せる', '3秒かけて下ろす'] },
  sl_glute_bridge: { name: '片脚グルートブリッジ', load: '自重', perSide: true, range: [10, 12], harder: 'sl_hip_thrust',
    cues: ['毛布に仰向け、片足は床、もう片脚は上げる', 'かかとで押してお尻を持ち上げる', '上で1秒お尻を締める'] },
  sl_hip_thrust: { name: '片脚ヒップスラスト', load: '肩をソファに', perSide: true, range: [10, 15],
    cues: ['背中の上部をソファの縁に乗せる', '片足は床、反対の膝は上げる', '腰が一直線になるまで上げて1秒停止'] },
  walkout_burpee: { name: 'ジャンプなしバーピー', load: '自重', range: [8, 10],
    cues: ['しゃがんで手を毛布につく', '片足ずつ後ろに下げ、腕立てを1回', '片足ずつ戻して立つ（ジャンプしない）'] },
  dead_bug: { name: 'デッドバグ', load: '自重', perSide: true, range: [10, 12],
    cues: ['腰を床に押しつけたまま', '対角の腕と脚をゆっくり伸ばす', '伸ばすときに息を吐く'] },

  // Day B
  sl_rdl: { name: '片脚ルーマニアンデッドリフト', load: '10 kg', perSide: true, range: [8, 10],
    cues: ['軸足と反対の手でダンベルを持つ', '股関節から前に倒し、後ろ脚を伸ばす', '軸足の膝は軽く曲げ、背中はまっすぐ'] },
  ohp: { name: 'ショルダープレス（立位）', load: '5 kg × 2', range: [10, 15], harder: 'pike_pushup',
    cues: ['ダンベルを肩の高さ、手のひらは前向き', '肋骨を締め、お尻に力を入れる', '真上に押し上げ、3秒かけて下ろす'] },
  pike_pushup: { name: 'パイク腕立て伏せ', load: '自重', range: [8, 12], harder: 'pike_pushup_elev',
    cues: ['お尻を高く上げ、体を逆V字にする', '頭頂部を床に近づけるように下ろす', '肩の力で押し戻す'] },
  pike_pushup_elev: { name: '足上げパイク腕立て伏せ', load: '足を椅子に', range: [6, 10],
    cues: ['椅子は壁につけ、足を座面に乗せる', 'お尻を肩の真上に重ねる', 'ゆっくり下ろし、頭は手より前へ'] },
  reverse_lunge: { name: 'リバースランジ', load: '5 kg × 2', perSide: true, range: [10, 12], harder: 'deficit_lunge',
    cues: ['後ろに一歩下げ、足はそっと置く', '後ろの膝を床に向けて下ろす', '前足のかかとで押して戻る'] },
  deficit_lunge: { name: 'デフィシット・リバースランジ', load: '5 kg × 2', perSide: true, range: [10, 12],
    cues: ['前足を安定した低い台に乗せる', 'そっと後ろに下げ、いつもより深く沈む', '上体を立て、前足のかかとは浮かせない'] },
  reverse_fly: { name: 'ベントオーバー・リアレイズ', load: '5 kg × 2', range: [12, 15],
    cues: ['背中をまっすぐにして前傾する', '肘を軽く曲げ、腕を横に大きく開く', '肩甲骨を寄せ、3秒かけて下ろす'] },
  chair_dip: { name: 'チェアディップス', load: '自重', range: [12, 15], harder: 'chair_dip_straight',
    cues: ['椅子は壁につけて滑らないようにする', '膝は曲げ、肘はまっすぐ後ろへ', '二の腕が床と平行になるまで下ろす'] },
  chair_dip_straight: { name: 'チェアディップス（脚伸ばし）', load: '自重', range: [10, 15],
    cues: ['椅子は壁につける', '脚を伸ばしてかかとを床につく', '肘を後ろへ引き、3秒かけて下ろす'] },
  calf_raise: { name: 'スローカーフレイズ', load: '自重', range: [15, 20], harder: 'sl_calf_raise',
    cues: ['指先を軽く壁に添える', 'つま先立ちで1秒キープ', '3秒かけて下ろし、かかとはそっと着地'] },
  sl_calf_raise: { name: '片脚カーフレイズ', load: '自重', perSide: true, range: [12, 15],
    cues: ['指先を壁に添えてバランスを取る', '一番上まで上がって1秒キープ', '3秒かけて下ろす'] },

  // Day C
  bss_bw: { name: 'ブルガリアンスクワット', load: '自重', perSide: true, range: [8, 10], harder: 'bss_10',
    cues: ['後ろ足の甲をソファに乗せる', '前足のすねはなるべく垂直に', '後ろの膝が毛布に触れる手前まで下ろす'] },
  bss_10: { name: 'ブルガリアンスクワット（10 kg）', load: '10 kg', perSide: true, range: [8, 12],
    cues: ['ダンベルを胸の前で持つ', '後ろ足はソファに乗せる', '3秒かけて下ろし、前足のかかとで押し上げる'] },
  db_rdl: { name: 'ダンベル・ルーマニアンデッドリフト', load: '5 kg × 2', range: [15, 20],
    cues: ['ダンベルを太ももの前で持つ', 'お尻を後ろに引き、背中はまっすぐ', 'お尻を締めて立ち上がる'] },
  reverse_crunch: { name: 'リバースクランチ', load: '自重', range: [12, 15],
    cues: ['毛布に仰向け、膝を90°に曲げる', 'お尻を床から浮かせて胸の方へ丸める', 'ゆっくり戻し、足は床につけない'] },
};

const WARMUP = { type: 'warmup', label: 'ウォームアップ', sets: 1, rest: 0,
  items: [{ ex: 'squat_bw', reps: 10 }, { ex: 'arm_circles', reps: 10 }, { ex: 'inchworm', reps: 5 }] };

// Items are an exercise id, or { ex, range } when a slot uses its own rep range.
export const DAYS = {
  A: { name: 'メニューA', subtitle: 'スクワット・プッシュ・ロウ', minutes: 18, blocks: [
    WARMUP,
    { type: 'superset', label: 'スーパーセット1', sets: 3, rest: 60, items: ['goblet_squat', 'pushup'] },
    { type: 'superset', label: 'スーパーセット2', sets: 3, rest: 60, items: ['db_row', 'sl_glute_bridge'] },
    { type: 'finisher', label: 'フィニッシャー', sets: 2, rest: 60, items: ['walkout_burpee', 'dead_bug'] },
  ] },
  B: { name: 'メニューB', subtitle: 'ヒンジ・肩・背中上部', minutes: 18, blocks: [
    WARMUP,
    { type: 'superset', label: 'スーパーセット1', sets: 3, rest: 60, items: ['sl_rdl', 'ohp'] },
    { type: 'superset', label: 'スーパーセット2', sets: 3, rest: 60, items: ['reverse_lunge', 'reverse_fly'] },
    { type: 'finisher', label: 'フィニッシャー', sets: 2, rest: 60, items: ['chair_dip', 'calf_raise'] },
  ] },
  C: { name: 'メニューC', subtitle: '全身サーキット', minutes: 18, blocks: [
    WARMUP,
    { type: 'circuit', label: 'サーキット', sets: 4, rest: 90, items: [
      'bss_bw', { ex: 'pushup', range: [10, 15] }, { ex: 'db_row', range: [12, 15] }, 'db_rdl', 'reverse_crunch'] },
  ] },
  T: { name: 'MAXテスト', subtitle: '腕立て伏せとスクワットの最大回数', minutes: 8, blocks: [
    WARMUP,
    { type: 'test', label: '腕立て伏せMAX', sets: 1, rest: 120, items: ['pushup'] },
    { type: 'test', label: 'スクワットMAX', sets: 1, rest: 0, items: ['squat_bw'] },
  ] },
};

// getDay(): 0 = Sunday. Wednesday and Sunday are rest days.
export const SCHEDULE = { 1: 'A', 2: 'B', 4: 'A', 5: 'B', 6: 'C' };

export const PHASES = [
  { from: 1, to: 4, name: '基礎期' },
  { from: 5, to: 8, name: '強化期' },
  { from: 9, to: 9, name: 'ディロード', deload: true },
  { from: 10, to: 16, name: '追い込み期', shortRest: true },
  { from: 17, to: 17, name: 'テスト週' },
];

export const SWITCH_SEC = 10;
export const SHORT_REST_SEC = 45;
export const TEST_DEFAULTS = { pushup: 15, squat_bw: 25 };

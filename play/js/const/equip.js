// 상수·수식 5: 장비(등급·옵션·재설정·드롭·소환·신화·장비 조합)
(function (g) {
  const C = g.RPG.C;
  const T = g.TUNE || {};
  // ---------- 장비 (랜덤 옵션) ----------
  // 입수: 스테이지 보스 처치 시 30% 확률 드롭(높은 스테이지일수록 고등급 확률↑) + 보석 장비 소환(소환 Lv↑일수록 고등급↑).
  // 등급 5종: 옵션 수 = 등급 + 1 (노말 1 ~ 레전드 5). 옵션 종류 20개 중 중복 없이 무작위, 옵션 등급(D~S)은 완전 무작위(균등).
  // 부위 3종(파티 공용 장착): 주 능력치(무기 공격력·갑옷 체력·장신구 치명타 피해)는 아이템 등급으로 정해진다.
  // 부위 강화(강화석): 그 부위에 장착한 장비의 주 능력치·옵션 수치 전체 × (1 + Lv × 2%). 장비를 바꿔도 강화는 유지.
  C.EQ_PARTS = ['wpn', 'arm', 'acc'];
  C.EQ_PART = {
    wpn: { kr: '무기', main: 'atk', bases: ['장검', '대검', '창', '도끼', '지팡이', '활'] },
    arm: { kr: '갑옷', main: 'hp', bases: ['가죽 갑옷', '사슬 갑옷', '판금 갑옷', '로브', '비늘 갑옷'] },
    acc: { kr: '장신구', main: 'cdmg', bases: ['반지', '목걸이', '부적', '귀걸이'] },
  };
  C.EQ_GRADES = ['노말', '매직', '레어', '유니크', '레전드', '신화'];   // 신화(5)는 소환·드롭으로 나오지 않음 — 같은 레전드 3개로 등급업
  C.EQ_MAIN = { atk: [0.08, 0.14, 0.22, 0.32, 0.45, 1.35], hp: [0.08, 0.14, 0.22, 0.32, 0.45, 1.35], cdmg: [0.10, 0.18, 0.28, 0.40, 0.56, 1.68] };   // 등급별 주 능력치 (신화 = 레전드 ×3)
  C.EQ_OPT_TIERS = ['D', 'C', 'B', 'A', 'S', 'L'];   // L = 고유 장비 속성 줄(고정 수치) 또는 신화 무작위 줄의 최고 등급
  C.EQ_L_RATE = T.lr != null ? T.lr : 0.02;   // 2026-11-24 사용자 'L은 신화에만' — 신화 무작위 줄(신화 등급업 추가 줄·재설정 포함) 한 줄당 L 확률 2%, 나머지 D~S 균등. L 수치 = S(기본값×3) × C.mythMult(k)(보통 ×3 → 기본값×9, 흡혈·공속 ×1.5), 신화 돌파 +20%/단계 적용
  C.EQ_TIER_MULT = [1, 1.4, 1.8, 2.3, 3.0];       // 옵션 등급 배율 (기본값 × 배율 × 0.9~1.1)
  // 옵션 20종: 기본값은 D등급 평균. pct = 표시 단위(% 또는 %p)
  C.EQ_OPTS = {
    atk: { kr: '공격력', base: 0.10, u: '%' }, hp: { kr: '체력', base: 0.10, u: '%' }, def: { kr: '방어력', base: 0.12, u: '%' },
    crit: { kr: '치명타 확률', base: 0.02, u: '%p' }, cdmg: { kr: '치명타 피해', base: 0.15, u: '%p' }, aspd: { kr: '공격 속도', base: 0.04, u: '%' },
    cdr: { kr: '스킬 쿨타임 감소', base: 0.02, u: '%' }, boss: { kr: '보스 피해', base: 0.10, u: '%' }, dr: { kr: '받는 피해 감소', base: 0.015, u: '%' },
    heal: { kr: '치유량', base: 0.10, u: '%' }, gold: { kr: '골드 획득', base: 0.10, u: '%' }, skill: { kr: '스킬 피해', base: 0.10, u: '%' },
    basic: { kr: '일반 공격 피해', base: 0.12, u: '%' }, ult: { kr: '궁극기 피해', base: 0.12, u: '%' }, ls: { kr: '흡혈', base: 0.01, u: '%' },
    e_fire: { kr: '화염 영웅 공격력', base: 0.15, u: '%' }, e_water: { kr: '서리 영웅 공격력', base: 0.15, u: '%' }, e_wind: { kr: '질풍 영웅 공격력', base: 0.15, u: '%' },
    e_light: { kr: '빛 영웅 공격력', base: 0.15, u: '%' }, e_dark: { kr: '어둠 영웅 공격력', base: 0.15, u: '%' },
  };
  C.CAPPED_OPTS = ['crit', 'cdr', 'dr'];   // 2026-10-25: 상한 있는 옵션은 장비·전용장비 옵션에서 삭제(종류 정의는 표시·이전용으로 남김)
  C.ELEM_OPT = { e_fire: 'atk', e_water: 'skill', e_wind: 'basic', e_light: 'ult', e_dark: 'cdmg' };   // 2026-11-15: 속성 영웅 공격력 옵션 삭제. 이전 대상 둘째 후보(첫째는 공격력) · 유니크 고유 장비의 대체 종류
  C.OPT_SWAP = { crit: 'cdmg', cdr: 'skill', dr: 'hp', e_fire: 'atk', e_water: 'atk', e_wind: 'atk', e_light: 'atk', e_dark: 'atk' };   // 삭제된 옵션의 이전 대상. 속성 옵션은 공격력(이미 공격력 줄이 있으면 C.ELEM_OPT)
  C.OPT_FALLBACK = ['atk', 'boss', 'skill', 'ult', 'cdmg', 'basic', 'hp', 'def', 'aspd', 'heal', 'ls', 'gold'];   // 교체 옵션이 이미 있을 때 고르는 순서   // 기존 장비의 해당 줄 → 이 옵션(등급·굴림 유지), 이미 있으면 다른 옵션
  C.ELEM_LEG = { e_fire: ['atk', 0.67], e_wind: ['basic', 0.69], e_water: ['skill', 1.58], e_light: ['ult', 3.0], e_dark: ['cdmg', 3.5] };   // 전설 줄 환산(옛 수치 × 배율) — 공격력과 같은 효율이 되는 값(측정). 실제 수치는 data/uniques.js에 적혀 있고 이 표는 기록·점수 가중치용
  // 비교 점수 가중치(G.eqScore): 옵션 수치 ÷ 기본값에 곱함 = 공격력 옵션 대비 실제 효율. 스킬·궁극기·치명타 피해는 같은 '기본값 대비 수치'라도 효과가 작고, 그만큼 전설 줄 수치를 키워 놓았으므로 점수에서는 되돌려 맞춤
  C.OPT_W = { gold: 0.5, basic: +(0.67 / 0.69 * 0.12 / 0.10).toFixed(2), skill: +(0.67 / 1.58).toFixed(2), ult: +(0.67 / 3.0 * 0.12 / 0.10).toFixed(2), cdmg: +(0.67 / 3.5 * 0.15 / 0.10).toFixed(2) };
  C.optGone = function (k) { return C.CAPPED_OPTS.includes(k); };   // 2026-11-20 속성 영웅 공격력 옵션 복원(ELEM_OPT는 기록용)   // 더는 나오지 않는 옵션
  C.EQ_OPT_KEYS = Object.keys(C.EQ_OPTS).filter(k => !C.optGone(k));
  // 상한 초과분 전환(2026-10-25): 상한을 넘긴 만큼을 상한 없는 능력치로 바꿔 줌. r = 초과 1당 전환량(옵션 기본값 비율 × 배율 — 아래 측정으로 결정)
  C.OVERFLOW = {
    crit: { cap: 0.95, to: 'cdmg', r: T.ofc != null ? T.ofc : 3.75 },   // 치명타 확률 1%p 초과 → 치명타 피해 +3.75%p (기본값 비 7.5의 절반)
    cdr: { cap: 0.6, to: 'skill', r: T.ofs != null ? T.ofs : 2.5 },    // 쿨타임 감소 1%p 초과 → 스킬 피해 +2.5% (기본값 비 5의 절반)
    dr: { cap: 0.6, to: 'hp', r: T.ofh != null ? T.ofh : 3.33 },       // 받는 피해 감소 1%p 초과 → 체력 +3.33% (기본값 비 6.67의 절반)
  };
  C.EQ_LV_STEP = 0.02;          // 부위 강화 Lv당 +2%
  C.EQ_BAG = 100;               // 가방 칸 (장착 중 제외)
  // 옵션 재설정(보석): 등급별 기본 비용 × 잠근 옵션 수 배율. 잠글수록 급격히 비싸진다
  C.REROLL_COST = (T.rrc || [20, 40, 80, 150, 300, 500]);
  C.REROLL_LOCK = (T.rrl || [1, 1.25, 1.5, 1.75, 2]);   // 2026-11-24 ×1/5/25/100/300 → ×1/2/4/8/16 → ×1/1.25/1.5/1.75/2(사용자 '100a면 신화 5줄 전부 L'). 신화(500)·L 2%, L 나오는 대로 잠금: 5줄 L 평균 9.6만(중앙 8.4만·90% 16.9만), 5줄 S 이상 평균 8천 (scratchpad lcost2.js)
  C.rerollCost = function (grade, locks) { return Math.round(C.REROLL_COST[grade] * C.REROLL_LOCK[Math.min(locks, C.REROLL_LOCK.length - 1)]); };
  C.EQ_SALVAGE = [1, 3, 8, 20, 50, 0];
  C.EQ_FUSE = { need: 3, rate: 0.5 };   // 장비 조합: 같은 부위 유니크 3개 → 그 부위 레전드 무작위, 성공 50%, 실패하면 재료 중 1개(점수 최고)만 남음
  C.MYTH_NEED = T.myn || 3;      // 신화 등급업: 같은 레전드(본체 포함) 개수 → 재료 MYTH_NEED-1개 소모
  C.MYTH_RATE = T.myr || 0.3;     // 신화 등급업 성공 확률. 실패하면 재료(같은 레전드 2개)만 사라지고 본체는 레전드로 남음
  C.MYTH_COST = T.myc || 10000;   // 시도마다 보석
  C.MYTH_LEG_MULT = 3;           // 신화: 전설 옵션 수치 ×3 + 3번째 전설 옵션(uniques.js myth)
  C.MYTH_RATE_KEYS = ['crit', 'cdr', 'dr', 'ls', 'aspd'];   // 상한이 있거나 비율로 바로 터지는 옵션은 ×1.5만 (×3이면 장비 한 칸으로 상한 도달)
  C.mythMult = function (k) { return C.MYTH_RATE_KEYS.includes(k) ? 1.5 : C.MYTH_LEG_MULT; };
  C.MYTH_LB = { max: 5, step: 0.2, cost: 10000 };   // 신화 돌파: 같은 신화 1개 + 보석 1만 → +1(최대 +5), 단계마다 주 능력치·전설 옵션(L) +20% (2026-10-24 사용자 결정)
  C.EQ_DEX_BONUS = { leg: 0.03, myth: 0.05 };   // 장비 도감: 레전드 1종 · 신화 1종당 원정대 공격력·체력 +%   // 분해 시 강화석 (등급별)
  C.EQ_DROP = 0.30;             // 스테이지 보스 드롭 확률
  C.EQ_COST = 100;
  C.EQ_PITY = 150;   // 장비 소환 천장: 레전드 없이 150회째면 레전드 확정(무작위), 레전드가 나오면 0으로 (2026-10-24)              // 장비 소환 1회 보석
  C.eqUpCost = function (lv) { return Math.round(10 * Math.pow(1.08, lv)); };   // 부위 강화 비용(강화석)
  // 스테이지별 드롭 등급 확률(%) — 구간 사이는 선형 보간
  C.EQ_DROP_RATE = [[1, [80, 17, 2.7, 0.3, 0]], [100, [55, 30, 12, 2.7, 0.3]], [300, [35, 33, 21, 9, 2]], [600, [20, 32, 28, 15, 5]], [1000, [10, 28, 32, 22, 8]]];
  C.eqDropRate = function (stage) {
    const T = C.EQ_DROP_RATE; if (stage <= T[0][0]) return T[0][1].slice(); if (stage >= T[T.length - 1][0]) return T[T.length - 1][1].slice();
    for (let i = 0; i < T.length - 1; i++) { const [a, ra] = T[i], [b, rb] = T[i + 1]; if (stage <= b) { const f = (stage - a) / (b - a); return ra.map((x, k) => Math.round((x + (rb[k] - x) * f) * 100) / 100); } }
  };
  // 소환 레벨: 누적 장비 소환 횟수로 상승
  C.EQ_SLV = [0, 50, 200, 500, 1000, 2000, 4000, 8000, 15000, 30000];   // Lv1~10 도달 누적 횟수
  C.EQ_RATE = [   // 소환 Lv별 등급 확률(%) — 노말, 매직, 레어, 유니크, 레전드
    [62, 28, 8.5, 1.4, 0.1], [56, 30, 11, 2.7, 0.3], [50, 31, 14, 4.4, 0.6], [45, 31, 17, 6, 1.0], [40, 31, 20, 7.6, 1.4],
    [35, 31, 23, 9.2, 1.8], [30, 31, 26, 10.8, 2.2], [25, 31, 29, 12.4, 2.6], [20, 31, 32, 14, 3.0], [15, 31, 35, 15.5, 3.5],
  ];
  C.eqSummonLv = function (pulls) { let lv = 1; C.EQ_SLV.forEach((t, i) => { if (pulls >= t) lv = i + 1; }); return lv; };
  C.eqDungeonStone = function (lv) { return 20 + 5 * lv; };
  C.eqOptTxt = function (k, v) { const o = C.EQ_OPTS[k] || { kr: k, u: '%' }; const n = Math.round(v * 1000) / 10; return o.kr + ' +' + n + o.u; };
  C.eqMainTxt = function (part, v) { const k = C.EQ_PART[part].main; return ({ atk: '공격력', hp: '체력', cdmg: '치명타 피해' })[k] + ' +' + Math.round(v * 1000) / 10 + (k === 'cdmg' ? '%p' : '%'); };
})(typeof window !== 'undefined' ? window : globalThis);

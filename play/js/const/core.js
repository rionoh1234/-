// 상수·수식 1: 속성·역할·강화·공명·도감·실제 스탯·스킬 템플릿·사거리·슬롯 (C 객체 생성)
(function (g) {
  const C = {};

  C.ELEMS = ['fire', 'water', 'wind', 'light', 'dark'];
  C.ELEM_KR = { fire: '화', water: '수', wind: '풍', light: '광', dark: '암' };
  C.ELEM_NAME = { fire: '화염', water: '서리', wind: '질풍', light: '빛', dark: '어둠' };
  C.ELEM_COLOR = { fire: '#ff6a3d', water: '#4fa8ff', wind: '#4fd37a', light: '#ffd34f', dark: '#b06cff' };
  C.ROLE_KR = { tank: '수호', dps: '공격', heal: '치유', sup: '지원' };
  C.ROLES = ['tank', 'dps', 'heal', 'sup'];

  // 상성: fire>wind>water>fire, light<->dark
  C.ADV = 1.3; C.DIS = 0.75; C.ADV_LD = 1.1;   // 빛↔어둠 상호 배율(불리 상대 없음) — 2026-11-23 1.3 → 1.1(사용자 '게임 전체 1.1')
  C.elemMult = function (a, d) {
    if ((a === 'fire' && d === 'wind') || (a === 'wind' && d === 'water') || (a === 'water' && d === 'fire')) return C.ADV;
    if ((d === 'fire' && a === 'wind') || (d === 'wind' && a === 'water') || (d === 'water' && a === 'fire')) return C.DIS;
    if ((a === 'light' && d === 'dark') || (a === 'dark' && d === 'light')) return C.ADV_LD;
    return 1;
  };

  // 역할 기본 스탯 (★1 Lv1)
  const T0 = g.TUNE || {};
  C.ROLE_BASE = {   // 역할 격차: 수호는 단단하지만 딜이 약하고, 공격은 몸이 약하지만 딜이 강하다
    tank: { hp: Math.round(2600 * (+(T0.thm) || 0.8)), atk: 45, def: Math.round(170 * (+(T0.tdm) || 0.5)), spd: 86 },   // 2026-10-29 V2(사용자 결정 '수호 너무 단단·힐러 무쓸모'): 체력 ×0.8·방어 ×0.5 (2600/170 → 2080/85)
    dps: { hp: 620, atk: 150, def: 38, spd: 106 },
    heal: { hp: 950, atk: 95, def: 60, spd: 98 },
    sup: { hp: 1000, atk: 100, def: 62, spd: 110 },
  };
  C.STAR_MULT = { 1: 1.0, 2: 1.35, 3: 1.8 };
  C.HEAL_BASIC = 1.5;     // 치유 평타 → 체력 비율이 가장 낮은 아군 회복(공격력 ×1.5 × 치유량), 다친 아군이 없으면 공격 (2026-10-29 V2)
  C.TANK_AURA = T0.tau != null ? +T0.tau : 0; C.TANK_COVER = 0; C.TANK_COVER_DR = 0; C.TANK_ENRAGE = T0.ten != null ? +T0.ten : 1;   // 2026-10-30 수호 존재 의의: 살아 있는 수호가 있으면 보스 격노 진행 ×0.5(격노 기본 주기 15→12초와 짝). 아군 피해 감소(TANK_AURA)·대신 맞기(TANK_COVER)는 시험만 — 감소 15%는 진행 폭주, 대신 맞기는 효과 없음   // 수호의 보호(field.js cover) — 값은 아래에서 확정
  // 보스 성격(2026-10-30, 사용자 '보스가 수호 아닌 캐릭터는 평타만으로 죽일 수 있게'): 평타 ×10 · 포효(광역) ×0.4 · 체력 ×0.6 — 수호가 보스를 붙잡지 못하면 공격형이 평타에 쓰러짐. 30→100스테이지에 걸쳐 서서히 적용(C.bossStyle, 초반 1인 파티 보호)
  // 2026-10-31 보스전 길이(사용자 '최전선 보스전 ×3 배속 30초·간신히 잡거나 피 조금 남기고 전멸'): 보스 체력 ×S · 공격력 ÷S(STRETCH) — 승패 한계는 거의 그대로, 결판까지 걸리는 시간만 늘림.
  //   S는 30→100스테이지에 걸쳐 적용, 고층(300→1000)에서 5 → 15(고층일수록 서로 한 방이라 결판이 짧아짐). 결과 체력 계수 0.36×S, 평타 10 → 30(공격 ÷S와 짝 — 수호 없으면 공격형이 평타에 쓰러지는 구조 유지)
  C.BOSS_BASIC = T0.bba != null ? +T0.bba : 30; C.BOSS_ROAR = T0.bro != null ? +T0.bro : 0.4; C.BOSS_HP_K = T0.bhk != null ? +T0.bhk : 0.36;
  C.BOSS_STRETCH = T0.bst != null ? +T0.bst : 5; C.BOSS_STRETCH_HI = T0.bsh != null ? +T0.bsh : 15; C.BOSS_STRETCH_AT = [300, 1000];
  C.bossStyle = function (k, stage) { k = Math.max(0, Math.min(1, k)); const a = C.BOSS_STRETCH_AT, h = Math.max(0, Math.min(1, ((stage || 0) - a[0]) / (a[1] - a[0]))); const S = 1 + (C.BOSS_STRETCH + (C.BOSS_STRETCH_HI - C.BOSS_STRETCH) * h - 1) * k; return { basic: 1 + (C.BOSS_BASIC - 1) * k, roar: 1 + (C.BOSS_ROAR - 1) * k, hp: (1 + (C.BOSS_HP_K - 1) * k) * S, atk: 1 / S }; };
  C.GUARD_TEAM_DR = T0.gdr != null ? +T0.gdr : 0.3; C.GUARD_TEAM_DUR = T0.gdd != null ? +T0.gdd : 8;   // 수호 1번 스킬(방벽·포효·인내)이 다른 아군에게 주는 받는 피해 감소·지속
  C.REGEN_FIGHT = 0;      // 전투 중 자연 회복(초당 최대 체력 비율) 0.4% → 0 (비전투 1.5%는 유지) — 회복은 힐러 몫
  const T = g.TUNE || {};
  // 골드 스탯 강화 (전 영웅 공통). 후반 구간(공·체 Lv300↑, 방 Lv280↑)은 비용 증가율 9%(방 9.5%) — 100스테이지 이후 무한 상승 방지(A안, 2026-10-22)
  C.UP = {
    atk: { kr: '공격력', base: T.cb || 20, g: T.cg || 1.07, step: 2.5, comp: T.ug || 1.025, unit: '%', costSoft: { lv: 300, g: 1.09 } },
    hp: { kr: '체력', base: T.cb || 20, g: T.cg || 1.07, step: 2.5, comp: T.ug || 1.025, unit: '%', costSoft: { lv: 300, g: 1.09 } },
    def: { kr: '방어력', base: (T.cb || 20) * 1.5, g: (T.cg || 1.07) + 0.005, step: 2, comp: T.dc || 1.03, unit: '%', costSoft: { lv: 280, g: 1.095 } },
    crit: { kr: '치명타 확률', base: 150, g: 1.12, step: 0.5, max: 90, unit: '%p' },
    cdmg: { kr: '치명타 피해', base: 120, g: 1.09, step: 4, max: 80, unit: '%p' },
    aspd: { kr: '공격 속도', base: 200, g: 1.1, step: 1, max: 100, unit: '%p' },
  };
  C.UP_KEYS = ['atk', 'hp', 'def', 'crit', 'cdmg', 'aspd'];
  // 강화 배율. soft = { lv, comp }: lv 이후 레벨당 효율이 comp로 줄어든다(구간제 체감)
  C.upMult = function (k, lv) {
    const u = C.UP[k]; if (!u.comp) return 1 + u.step * lv;
    if (u.soft && lv > u.soft.lv) return Math.pow(u.comp, u.soft.lv) * Math.pow(u.soft.comp, lv - u.soft.lv);
    return Math.pow(u.comp, lv);
  };
  // costSoft = { lv, g }: lv 이후 비용 증가율을 g로 올린다(후반 구간 비용 가속)
  C.upCost = function (key, lv) { const u = C.UP[key], cs = u.costSoft; if (cs && lv > cs.lv) return Math.round(u.base * Math.pow(u.g, cs.lv) * Math.pow(cs.g, lv - cs.lv)); return Math.round(u.base * Math.pow(u.g, lv)); };
  C.LB_STEP = +(T.lbs) || 0.30;   // 돌파 1~5단계: 단계당 +30%(2026-11-18 사용자 '12% 말고 30%' — 돌파 한 번에 확 세지는 맛, 예전 0.12)
  C.TR_MULT = +(T.trm) || 1.5;   // 초월(6~10단계): 단계마다 ×1.5 곱(2026-11-25 사용자 '초월은 한 단계 한 단계 차이 더 커야' → 곱 1.5). 돌파5 ×2.5 → 초월5 ×18.98. 예전: 단계당 +30% 더하기(초월5 ×4.0)
  C.LB_MAX = 10;               // 1~5 돌파, 6~10 초월. 초월 5(=10단계)에서 고유 스킬 진각성
  C.LB_COST = { 1: [10, 15, 20, 25, 30, 120, 150, 180, 210, 240], 2: [15, 25, 35, 45, 60, 240, 300, 360, 450, 540], 3: [20, 35, 50, 70, 100, 420, 540, 690, 870, 1080] };   // 초월(6~10) 비용 = 예전 ×3(2026-11-25 사용자, ★3 초월 합 1,200 → 3,600). ★1·★2는 돌파 불가라 안 씀
  C.lbMult = function (lb) { lb = lb || 0; return (1 + C.LB_STEP * Math.min(lb, 5)) * Math.pow(C.TR_MULT, Math.max(0, lb - 5)); };
  C.lbLabel = function (lb) { lb = lb || 0; return lb <= 5 ? `돌파 ${lb}/5` : `초월 ${lb - 5}/5`; };
  C.DUPE_SHARDS = { 1: 10, 2: 15, 3: 25 };   // ★3 중복 → 그 영웅의 조각(돌파용). ★1·★2는 돌파 불가
  C.DUPE_USHARD = { 1: 0, 2: 0 };            // ★1·★2 중복 → 승급석(조합용)
  C.LB_STAR_MIN = 3;                         // 돌파·초월은 ★3만
  C.SKILL_LV_MAX = 20;
  C.SKILL_LB_STEP = 5;        // 돌파·초월 1단계마다 스킬 레벨 상한 +5(2026-11-19, 사용자 '돌파하면 스킬렙도 더 찍을 수 있게' → 단계당 +5, 최대 70)
  C.skillLvMax = function (lb) { return C.SKILL_LV_MAX + C.SKILL_LB_STEP * (lb || 0); };
  C.SKILL_BUFF_R = 0.5;     // 버프·보호막 세기는 스킬 레벨 계수 증가분의 절반(레벨당 +3%, 2026-11-22 사용자 결정)
  C.SKILL_STEP = 0.06;        // 스킬 레벨당 스킬 계수 +6%
  C.skillLvCost = function (slv, star) { return Math.round(1500 * Math.pow(1.6, slv - 1) * C.STAR_MULT[star]); };
  C.skillMult = function (slv) { return 1 + C.SKILL_STEP * ((slv || 1) - 1); };
  // 속성 공명은 삭제(2026-11-15): 한 속성 5명이면 1.4~1.6배 강한 보스를 이겨(13~20스테이지분) 편성이 한 속성으로 굳었다. 속성의 의미는 상성·속성 시련·보스 기믹으로 남는다
  // 도감 인연(2026-11-15): 인연은 출전 보너스가 아니라 수집 보너스 — 구성원을 한 번이라도 모두 얻으면 그 인연의 능력치(data/sets.js eff)가 원정대 전원에게 영구 적용
  C.BOND_KR = { atk: ['공격력', '%'], hp: ['체력', '%'], def: ['방어력', '%'], aspd: ['공격 속도', '%'], crit: ['치명타 확률', '%p'], cdmg: ['치명타 피해', '%p'], heal: ['치유량', '%'], cdr: ['쿨타임', '%'], dr: ['받는 피해', '%'] };
  C.BOND_MULT = +(T.bdm) || 1;   // 도감 인연 효과 배율(data/sets.js eff × 이 값)
  C.bondEff = function (eff) { const o = {}; for (const k in (eff || {})) o[k] = eff[k] * C.BOND_MULT; return o; };
  C.bondText = function (eff) { return Object.keys(eff || {}).map(k => { const [nm, u] = C.BOND_KR[k] || [k, '%']; return `${nm} ${k === 'cdr' || k === 'dr' ? '-' : '+'}${+(eff[k] * 100).toFixed(1)}${u}`; }).join(' · '); };
  C.PASSIVE = { tank: { hp: 0.15 }, dps: { atk: 0.12 }, heal: { heal: 0.2 }, sup: { spd: 0.1 } };

  // 도감 보너스 (전체 스탯 %)
  C.codexBonus = function (n1, n2, n3) {
    return Math.min(0.5, 0.003 * n1 + 0.005 * n2 + 0.008 * n3);
  };

  // 캐릭터 실제 스탯: 역할 기본 × 등급 × 돌파 × 도감 × 골드 강화
  // 영웅별 공격력 보정(2026-11-17, 사용자 '파훼 없는 순수 딜러가 딜이 더 세야 — 딜러끼리 5%, 파훼끼리 5%, 딜러가 평균 5% 위'): 공격력에 곱함
  // 측정(scratchpad bal/dpsX.js·iterAdj.js): 편성 [수호 102·치유 62·지원 105·★2 공격 21] + X, 기믹·상성 없는 보스 90초 팀 피해. 순수 딜러(기믹 답 0: 55·67·69) = 100, 파훼 영웅 = 95 목표로 맞춤(오차 ±1.1%)
  C.HERO_ATK = Object.assign({ 47: 0.987, 55: 0.945, 57: 1.038, 61: 0.847, 63: 0.95, 65: 1.118, 67: 1.076, 68: 1.013, 69: 0.965, 71: 1.086, 73: 1.073, 75: 0.901, 78: 1.026, 103: 0.974 }, T.hatk || {});   // 맞춘 값 × 0.9454(평균 1로 — 7일 시뮬 스테이지 284 → 318로 올라서, 사용자 '문제 있으면 전체적으로 같은 폭으로 줄여')
  C.charStats = function (ch, up, lb, codex, sb, rm) {
    sb = sb || {}; rm = rm || {};
    up = up || {};
    const b = C.ROLE_BASE[ch.role];
    const sm = C.STAR_MULT[ch.star];
    const lbm = C.lbMult(lb);
    const cm = 1 + (codex || 0);
    const s = ch.seed || 0;
    const v = (k) => 0.96 + ((s * k) % 80) / 1000; // 0.96~1.04 개체 편차
    const p = C.PASSIVE[ch.role];
    const um = (k) => C.upMult(k, up[k] || 0);
    return {
      hp: Math.round(b.hp * sm * lbm * cm * v(7) * (1 + (p.hp || 0) + (sb.hp || 0)) * um('hp') * (rm.hp || 1)),
      atk: Math.round(b.atk * sm * lbm * cm * v(13) * (1 + (p.atk || 0) + (sb.atk || 0)) * um('atk') * (rm.atk || 1)),
      def: Math.round(b.def * sm * lbm * cm * v(17) * (1 + (sb.def || 0)) * um('def')),
      spd: Math.round(b.spd * v(23) * (1 + (p.spd || 0))),
      crit: Math.min(0.95, 0.05 + 0.005 * (up.crit || 0) + (sb.crit || 0)),
      cdmg: 1.5 + 0.04 * (up.cdmg || 0) + (sb.cdmg || 0),
      aspd: 1 + 0.01 * (up.aspd || 0) + (sb.aspd || 0),
      healBonus: (p.heal || 0) + (sb.heal || 0), cdr: sb.cdr || 0, dr: Math.min(0.6, sb.dr || 0),
    };
  };
  // 전투력 = 공격(공격력×치명 기대값×공속)과 생존(체력+방어력×8)의 기하평균 ×3 — 덧셈이면 치명타 피해가 커질수록 공격 항만 커져 수호·치유가 ★1 공격형보다 낮게 나왔음(2026-10-24)
  // 2026-11-23 사용자 '전투력이 보스 피해·궁극기·스킬 피해에 반응해야지' → amp(G.heroAmps: 일반 공격·스킬·궁극기·보스 피해)를 공격 항에 곱함.
  //   역할별 피해 출처 비중(C.POW_W = [일반 공격, 스킬, 궁극기], 옵션 효과를 뺀 기본 비중) — 사용자 저장 13650 5개 편성 시뮬 실측(scratchpad srcshare.js). 궁극기 타격엔 스킬 피해도 같이 붙음(field.js hit)
  //   보스 피해는 전부 반영(진행을 막는 건 보스전)
  C.POW_W = { tank: [0.9, 0.04, 0.06], dps: [0.6, 0.19, 0.21], heal: [1, 0, 0], sup: [0.97, 0, 0.03] };
  C.power = function (st, a, role) {
    let off = st.atk * (1 + (st.crit - 0.05) * (st.cdmg - 1)) * (st.aspd || 1); const dur = st.hp + st.def * 8;
    if (a) { const w = C.POW_W[role] || C.POW_W.dps; off *= (w[0] * (1 + (a.basic || 0)) + w[1] * (1 + (a.skill || 0)) + w[2] * (1 + (a.skill || 0) + (a.ult || 0))) * (1 + (a.boss || 0)); }
    return Math.round(3 * Math.sqrt(off * dur)); };
  // 역할 보정: 역할 기본치(ROLE_BASE)의 공격×생존 곱이 공격형과 같아지도록 → 같은 등급·성장이면 역할이 달라도 전투력이 비슷(★1 수호가 ★2보다 높게 나오지 않게)
  C.rolePowF = function (role) { const b = C.ROLE_BASE[role], d = C.ROLE_BASE.dps; if (!b || !d) return 1; return Math.sqrt((d.atk * (d.hp + 8 * d.def)) / (b.atk * (b.hp + 8 * b.def))); };

  // 스킬 2개 (역할×속성 템플릿) — 모두 자동 시전
  C.SKILL_CD_MULT = 3;   // 영웅 스킬 쿨타임 배율 (배속 ×3이 기본이라 실제 시간 체감이 원래 설계와 같도록)
  // 버프·디버프: 지속 ×3 · 세기 ÷3 (2026-11-15 사용자 '지금보다 3배씩 길어지게 — 너무 순식간에 사라진다' → '시간을 3배 했으니 효과를 1/3로')
  //   쿨타임만 ×3이고 지속 시간은 그대로라 ×3 배속에서 5초짜리가 실제 1.7초였음. 총량(세기 × 시간)은 그대로 두고 길고 옅게.
  //   스킬 정의의 수치(dur · 3초 · mult 등)는 그대로 두고 엔진이 바꿔 읽음(field.js): 타이머는 1/BUFF_DUR 속도로 줄고(tickBuffs), 세기는 읽는 곳에서 × BUFF_STR
  //     대상: 공격·방어·공속 증감, 둔화, 표식(받는 피해), 수호 보호(받는 피해 감소), 흡혈 강화, 화상·지속 회복(틱당)
  //     예외: 기절·동결은 세기가 없어 지속도 그대로(×1). 보호막은 양이 한 번 쓰면 끝나는 총량이라 양은 그대로, 지속만 ×3
  //   화면: 설명 글은 C.durTxt가 실제 값으로(지속 ×3, 'N%↑·↓'와 매초 수치 ÷3), 상태 아이콘의 남은 초는 타이머 × 배율. **데이터 파일의 설명·수치는 배율 전 값** — 증감 수치에는 반드시 ↑·↓를 붙일 것(변환 기준)
  C.BUFF_DUR = T0.bdu != null ? +T0.bdu : 3;
  C.BUFF_STR = T0.bsr != null ? +T0.bsr : 1 / C.BUFF_DUR;
  C.durTxt = function (s) {
    const k = C.BUFF_DUR, w = C.BUFF_STR; if (!s || (k === 1 && w === 1)) return s;
    const up = (x) => String(Math.round(parseFloat(x) * k * 10) / 10), dn = (x) => String(Math.round(parseFloat(x) * w * 10) / 10);
    return String(s).split(/( · | \+ |, )/).map(seg => {
      if (/쿨/.test(seg)) return seg;
      if (!/기절|동결|묶음/.test(seg)) seg = seg.replace(/(\d+(?:\.\d+)?)(\s*→\s*)(\d+(?:\.\d+)?)초|(\d+(?:\.\d+)?)초/g, (m, a, ar, b, c) => c != null ? up(c) + '초' : up(a) + ar + up(b) + '초');
      const re = /매초|\/초/.test(seg) ? /(\d+(?:\.\d+)?)(\s*→\s*)(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)%/g : /(\d+(?:\.\d+)?)(\s*→\s*)(\d+(?:\.\d+)?)%(?=p?[↑↓])|(\d+(?:\.\d+)?)%(?=p?[↑↓]|·[^·]*?%[↑↓])/g;
      return seg.replace(re, (m, a, ar, b, c) => c != null ? dn(c) + '%' : dn(a) + ar + dn(b) + '%');
    }).join('');
  };
  C.ELEM_FX = { haste: +(T0.efh) || 0.3, radiance: +(T0.efr) || 1.3, might: +(T0.efm) || 0.45, slow: +(T0.efs) || 2.6, focus: +(T0.efc) || 0.2 };   // 1번 스킬 속성 부가 효과(아군 버프) 세기, 4초(화면은 ÷3·×3). 측정(scratchpad bal/fxE.js, 섞은 편성에서 한 명만 켬/끔, 보스 90초 준 피해) 질풍 0.3 +7.0% 기준 — 화염 0.3 +3.7 / 0.6 +9.8 · 서리 1 +2.7 / 2 +5.3(둔화는 받는 피해 -3.3%) · 빛 1.5 +8.2 · 어둠 0.3 +10.8 / 0.6 +22.9 → 각 +7% 안팎
  C.ELEM_FX.frost = C.ELEM_FX.slow; delete C.ELEM_FX.slow;   // 서리 버프형 = 아군 스킬 피해(디버프형 둔화와 분리)
  C.ELEM_TEAM = { might: 'atk', frost: 'skl', haste: 'aspd', radiance: 'cdm', focus: 'crt' };   // 버프형 부가 효과 → 버프 칸(field.js u.b)
  C.ELEM_DEB = {   // 2026-11-25 사용자 '세 도트 모두 동일해야지': 화상·출혈·중독 1틱 = 공격력 × 3.5 × BUFF_STR × (스킬 피해·치명 기대값·상성·보스 피해, field.js dotV). 출혈 예전 0.3
    burn: +(T0.edb) || 3.5, combo: +(T0.edc) || 0.23, blind: +(T0.edl) || 0.5, bleed: +(T0.edd) || 3.5, bleedVuln: +(T0.edv) || 0.32 };   // 디버프형 세기(세기 ÷3·지속 ×3 규칙 적용 — 화상·출혈의 매초 피해, 연타 추가타 비율, 실명 빗나감 확률, 출혈 받는 피해)
  C.ELEM_DEBUFFS = ['burn', 'freeze', 'combo', 'blind', 'bleed'];   // 2026-11-20 서리 디버프 둔화 → 빙결(둔화 + 폭주 기믹의 답)
  C.GRANT = { p: +(T0.grp) || 0.5, dur: 7 };   // 2026-11-20 파훼 지원 버프: 아군 공격 1회당 p 확률로 지원의 속성 디버프(일반 스킬 = 시전 시 100% — 사용자 '그 반의 비율'), 7초(다른 궁극기 버프와 같음)
  C.CNT_CD = T0.cnc != null ? +T0.cnc : 8;     // 파훼 1번 스킬 기본 쿨(★3 실제 약 20초 = 8 × 0.85 × 3)
  C.SUP_CLASS = { 109: 'buff', 59: 'buff', 105: 'buff', 123: 'buff', 127: 'buff', 110: 'debuff', 74: 'debuff', 118: 'debuff', 72: 'debuff', 64: 'debuff' };   // ★3 지원: 아군 버프형 · 상대 디버프형(속성마다 1명씩)
  C.GRANT_CD = T0.gcd != null ? +T0.gcd : 8;   // 파훼 지원 궁극기 기본 쿨 상한(원래 13~15)
  C.STACK = Object.assign({ on: ['burnT', 'blindT', 'comboT', 'frzT'], max: 10, base: 0, icd: 1, dot: 0.1, eatLock: 3, vuln: 0.065, vulnFrom: 0, smite: 35, iceT: 3, iceAmp: 0.3, iceLock: 12 }, T0.stk || {});   // 속성 디버프 중첩(field.js stackAdd). on = 켜 둔 속성(출혈 bleedT·빙결 frzT는 꺼 둠). 2026-11-25 사용자 '전부 1중첩부터 효과, 대신 쌓는 캐릭을 넣어야 5~7중첩': base·vulnFrom 0, 중첩을 올리는 건 디버프 지원의 부여 효과뿐(그 밖의 디버프는 1중첩만). 수치 = '디버프 지원 편성이 지금 같은 속성 프리셋의 1.2배' 시뮬
  C.GROGGY = Object.assign({ max: 150, strong: 100, freeze: 30, slow: 15, sIcd: 3, wIcd: 10, decay: 6, cdRef: 15, dur: 5, vuln: 2 }, T0.grg || {});   // 보스 그로기 게이지(2026-11-25): field.js grog. 목표 = CC 영웅 1명은 거의 불가·2명 약 20초(게임 시간)마다, 그로기 5초·받는 피해 +200%
  C.GIM_LOCK = T0.gml != null ? +T0.gml : 16;   // 같은 영웅의 파훼는 이 초에 한 번만 인정(field.js lock) — 혼자면 빈틈, 둘이 번갈아 쓰면 메움
  C.GIM_DEB = { armor: 'burn', rampage: 'freeze', barrier: 'combo', frenzy: 'blind', regen: 'bleed' };   // 기믹 ↔ 답 디버프(속성 1:1)
  C.SUP_A = { fire: +(T0.saf) || 1, water: +(T0.saw) || 1, wind: +(T0.san) || 1, light: +(T0.sal) || 1, dark: +(T0.sad) || 1 };   // 지원 1번 스킬 세기 배율(측정용 손잡이, 2026-11-16). 확정값은 정의에 직접 반영
  C.A_ICON = [['강타', 'strike'], ['화살', 'arrow'], ['난무', 'flurry'], ['폭풍', 'storm'], ['방벽', 'wall'], ['포효', 'roar'], ['인내', 'endure'], ['치유', 'heal'], ['숨결', 'breath'], ['은총', 'grace'], ['가호', 'bless'], ['속박', 'bind'], ['저주', 'curse'], ['노래', 'song'], ['낙인', 'brand']];
  C.B_ICON = ['방패 붕격', '대지 분쇄', '불굴의 맹세', '수호의 장벽', '천검 난무', '필살 관통', '폭풍 회전', '급소 일격', '대치유의 빛', '생명의 축복', '수호의 기도', '기적의 손길', '전군 돌격', '약점 폭로', '광속의 노래', '철벽의 외침'];   // 궁극기 아이콘 시트 순서(img/eq_src/sheet_ult.png, 4×4)
  C.SIG1_IDS = [47, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 102, 103, 104, 105];
  C.skIcoBg = (icon) => {   // 스킬 아이콘 배경 스타일. 신규 ★3(108~127)은 매니페스트 한도(512) 때문에 한 장 묶음 img/skill/sig2.png(5×4, 96px)에서 잘라 씀 (2026-11-20)
  const n = +icon, V = (typeof window !== 'undefined' && window.IMGV) || '', S1 = C.SIG1_IDS.indexOf(n);
  if (S1 >= 0) return `background-image:url(img/skill/sig1.png${V});background-size:600% 500%;background-position:${(S1 % 6) * 20}% ${Math.floor(S1 / 6) * 25}%`;   // 기존 ★3 30명 묶음 6×5 (2026-11-20, 파일 512 한도)
  if (n >= 108 && n <= 127) { const k = n - 108; return `background-image:url(img/skill/sig2.png${(typeof window !== 'undefined' && window.IMGV) || ''});background-size:500% 400%;background-position:${(k % 5) * 25}% ${Math.floor(k / 5) * 100 / 3}%`; }
  return `background-image:url(img/skill/${icon}.png)`;
};
C.skillsOf = function (ch) {
    const s3 = ch.star === 3, seed = ch.seed || 0, el = ch.elem, EN = C.ELEM_NAME[el];
    // 1번 스킬 속성 부가 효과(2026-11-17 사용자 '직군별로 아군 버프 캐릭 하나, 디버프 전용 캐릭 하나 — 속성별로'): 같은 역할·속성 묶음 안에서 순번 짝수 = 아군 버프형, 홀수 = 디버프형
    //   버프형: 화염 공격력 · 서리 스킬 피해 · 질풍 공속 · 빛 치명타 피해 · 어둠 치명타 확률 / 디버프형(보스 기믹의 답): 화염 화상(철갑) · 서리 둔화(신속) · 질풍 연타(장벽) · 빛 실명(격분) · 어둠 출혈(재생)
    const grp0 = C._grp || (C._grp = {}), gk0 = ch.role + ':' + el; if (!grp0[gk0]) grp0[gk0] = (g.CHARS || []).filter(c => c.role === ch.role && c.elem === el).sort((x, y) => x.id - y.id).map(c => c.id);
    const debuffer = Math.max(0, grp0[gk0].indexOf(ch.id)) % 2 === 1;
    const fx = debuffer ? { fire: 'burn', water: 'freeze', wind: 'combo', light: 'blind', dark: 'bleed' }[el] : { fire: 'might', water: 'frost', wind: 'haste', light: 'radiance', dark: 'focus' }[el];   // 어둠: 흡혈 → 표식(2026-11-16 사용자 '흡혈은 의미 없다' — 측정 효과 0, 표식 +1.3스테이지분·철갑 답)
    const pc = (k) => Math.round(C.ELEM_FX[k] * 100);
    const D = C.ELEM_DEB;
    const FXD = { might: `아군 전체 공격력 ${pc('might')}%↑(4초)`, frost: `아군 전체 스킬 피해 ${pc('frost')}%↑(4초)`, haste: `아군 전체 공격속도 ${pc('haste')}%↑(4초)`, radiance: `광휘: 아군 전체 치명타 피해 ${pc('radiance')}%p↑(4초)`, focus: `아군 전체 치명타 확률 ${pc('focus')}%p↑(4초)`,
      burn: `화상: 매초 공격력 ${Math.round(D.burn * 100)}%(3초)`, freeze: '빙결: 둔화 · 폭주 해제(3초)', combo: `연타: 아군 타격마다 추가타 ${Math.round(D.combo * C.BUFF_STR * 100)}%(3초)`, blind: `실명: 적 공격 ${Math.round(D.blind * C.BUFF_STR * 100)}% 빗나감(3초) · 힘 모으기 끊음`, bleed: `출혈: 매초 공격력 ${Math.round(D.bleed * 100)}% · 받는 피해 ${Math.round(D.bleedVuln * 100)}%↑(3초)` };
    let a, b;
    // 같은 역할·속성 그룹 안에서 순번을 매겨 A/B 조합이 겹치지 않게 배정 (A 풀 × B 풀 = 최대 12가지)
    const grp = C._grp || (C._grp = {});
    const gk = ch.role + ':' + el;
    if (!grp[gk]) grp[gk] = (g.CHARS || []).filter(c => c.role === ch.role && c.elem === el).sort((x, y) => x.id - y.id).map(c => c.id);
    const idx = Math.max(0, grp[gk].indexOf(ch.id));
    const pickAB = (poolA, poolB) => { const na = poolA.length, nb = poolB.length; return [poolA[(idx + Math.floor(idx / nb)) % na], poolB[idx % nb]]; }; // 연속 순번끼리 A·B가 모두 달라지는 배정
    if (ch.role === 'tank') {
      [a, b] = pickAB([
        { name: EN + '의 방벽', type: 'guard', mult: 0, defUp: 0.6, dur: 6, cd: 9, desc: '자신 방어력 60%↑ 6초 · 아군 받는 피해 30%↓ 8초' },
        { name: EN + '의 포효', type: 'guard', mult: 0.6, defUp: 0.3, dur: 6, cd: 9, desc: '주변 적에 60% 피해 + 자신 방어력 30%↑ 6초 · 아군 받는 피해 30%↓ 8초' },
        { name: EN + '의 인내', type: 'guard', mult: 0, defUp: 0.3, dur: 6, selfHeal: 0.12, cd: 10, desc: '자신 최대 체력 12% 회복 + 방어력 30%↑ 6초 · 아군 받는 피해 30%↓ 8초' },
      ], [
        { name: '방패 붕격', type: 'bash', mult: 3.2, stun: 2, cd: 12 },
        { name: '대지 분쇄', type: 'aoe', mult: 2.4, stun: 1, cd: 13 },
        { name: '불굴의 맹세', type: 'guardall', mult: 0.5, dur: 7, cd: 15 },
        { name: '수호의 장벽', type: 'shield', pct: 0.3, mult: 0, cd: 16 },
      ]);
    } else if (ch.role === 'dps') {
      [a, b] = pickAB([
        { name: EN + ' 강타', type: 'single', mult: 1.8, cd: 6, desc: '적 하나에 180% 피해' },
        { name: EN + ' 폭풍', type: 'aoe', mult: 1.0, cd: 7, desc: '사거리 안 적 전체에 100% 피해' },
        { name: EN + ' 화살', type: 'single', mult: 1.3, cd: 4, desc: '적 하나에 130% 피해 (짧은 쿨)' },
        { name: EN + ' 난무', type: 'multi', mult: 0.6, hits: 3, cd: 8, desc: '60% 피해 3연타' },
      ], [
        { name: '천검 난무', type: 'multi', mult: 1.2, hits: 5, cd: 13 },
        { name: '필살 관통', type: 'single', mult: 6.0, cd: 14 },
        { name: '폭풍 회전', type: 'whirl', mult: 1.0, hits: 4, r: 70, cd: 14 },
        { name: '급소 일격', type: 'bash', mult: 4.5, stun: 2, cd: 13 },
      ]);
    } else if (ch.role === 'heal') {
      [a, b] = pickAB([
        { name: EN + '의 치유', type: 'heal', mult: 1.8, cd: 6, desc: '체력이 가장 낮은 아군 회복(공격력 180%)' },
        { name: EN + '의 은총', type: 'healall', mult: 0.6, cd: 11, desc: '아군 전체 회복(공격력 60%)' },
        { name: EN + '의 숨결', type: 'sanctuary', mult: 0.15, def: 0.2, cd: 14, desc: '5초간 아군 전체 지속 회복(공격력 15%/초) + 방어력 20%↑' },
      ], [
        { name: '대치유의 빛', type: 'healall', mult: 1.8, cd: 15 },
        { name: '생명의 축복', type: 'bless', mult: 1.2, buff: 0.3, dur: 7, cd: 16 },
        { name: '수호의 기도', type: 'shield', pct: 0.28, mult: 0, cd: 16 },
        { name: '기적의 손길', type: 'heal', mult: 6.0, cd: 12 },
      ]);
    } else { // 지원: A = 속성 고유 지원기(고정), B = 보편 지원기(그룹 순번으로 서로 다르게)
      a = {
        fire: { name: '화염의 낙인', type: 'vulnall', mult: 0.65, cd: 12, desc: '사거리 안 적 받는 피해 65%↑ 5초' },   // 2026-11-16: 방어력 20%↓ → 받는 피해↑(방어력 감소는 ×5로 올려도 보스 한계 +0.75 — 피해 공식에서 방어력 비중이 작음)
        water: { name: '서리의 속박', type: 'slowall', mult: 0, cd: 14, team: ['skl', +(T0.tvw) || 2.2, 5], desc: '사거리 안 적 둔화 4초 · 아군 전체 스킬 피해 100%↑ 5초' },   // 2026-11-16: 둔화·공격력↓·회복은 수치를 올려도 보스 한계가 거의 안 올라(딜 경쟁) 아군 공격 효과를 붙임 — 세기는 공격형 1번과 같은 값이 되게 측정
        wind: { name: '질풍의 노래', type: 'buffaspd', mult: 1.2, cd: 15, desc: '아군 전체 공격속도 120%↑ 5초' },   // 2026-11-17 0.8 → 1.2(속성 부가 효과가 없는 대신 — 1번만으로 준 피해 +18.5%, 다른 지원의 1번 +14% + 부가 효과 +7%와 비슷)   // 2026-11-16: 20 → 80%(공격형 1번 스킬과 같은 값 — 보스 90초 준 피해 +14.7% vs 공격형 +13.9~15.5%)
        light: { name: '빛의 가호', type: 'healall', mult: 0.5, cd: 13, team: ['atk', +(T0.tvl) || 0.6, 5], desc: '아군 전체 회복(공격력 50%) · 아군 전체 공격력 100%↑ 5초' },
        dark: { name: '어둠의 저주', type: 'debuffatk', mult: 0.2, cd: 12, team: ['cdm', +(T0.tvd) || 4, 5], desc: '사거리 안 적 공격력 20%↓ 5초 · 아군 전체 치명타 피해 100%p↑ 5초' },
      }[el];
      { const k = C.SUP_A[el] || 1; a = Object.assign({}, a); if (a.type === 'slowall') a.slow = 0.3 * k; else a.mult = Math.round(a.mult * k * 1000) / 1000; }   // 지원 1번 세기 배율(C.SUP_A) — 측정으로 공격형 1번 스킬 값에 맞춤
      const cls = s3 && C.SUP_CLASS[ch.id];   // 2026-11-21 사용자 '속성별로 아군 버프 지원 1명 · 상대 디버프 지원 1명': ★3 지원 1번을 역할 분류로 정함
      if (cls === 'buff') a = Object.assign({}, a, {
        fire: { name: '화염의 노래', type: 'buffatk', mult: +(T0.sbf) || 0.6, dur: 5, cd: 12, team: null, desc: '아군 전체 공격력 60%↑ 5초' },
        water: { name: '서리의 가호', type: 'buffatk', mult: 0, cd: 14, team: ['skl', +(T0.sbw) || 2.2, 5], desc: '아군 전체 스킬 피해↑ 5초' },
        wind: {},
        light: { name: '빛의 가호', type: 'buffatk', mult: +(T0.sbl) || 0.6, dur: 5, cd: 13, team: null, desc: '아군 전체 공격력 60%↑ 5초' },
        dark: { name: '어둠의 가호', type: 'buffatk', mult: 0, cd: 12, team: ['cdm', +(T0.sbd) || 4, 5], desc: '아군 전체 치명타 피해↑ 5초' },
      }[el]);
      else if (cls === 'debuff') a = Object.assign({}, a, {
        fire: {}, water: {}, dark: {},
        wind: { name: '질풍의 낙인', type: 'vulnall', mult: +(T0.sdw) || 0.65, cd: 12, team: null, desc: '사거리 안 적 받는 피해 65%↑ 5초' },
        light: { name: '빛의 낙인', type: 'vulnall', mult: +(T0.sdl) || 0.65, cd: 12, team: null, desc: '사거리 안 적 받는 피해 65%↑ 5초' },
      }[el]);
      if (a.team === null) delete a.team;
      const poolB = [
        { name: '전군 돌격', type: 'buffatk', mult: 0.5, dur: 7, cd: 16 },
        { name: '약점 폭로', type: 'debuffdef', mult: 0.45, dur: 7, cd: 16 },
        { name: '광속의 노래', type: 'buffaspd', mult: 0.5, dur: 7, cd: 16 },
        { name: '철벽의 외침', type: 'guardall', mult: 0.5, dur: 7, cd: 16 },
        { name: '전장의 기적', type: 'healall', mult: 1.4, cd: 16 },
      ].filter(x => x.type !== a.type);
      b = poolB[idx % poolB.length];
    }
    a = Object.assign({}, a); b = Object.assign({}, b, { ult: true }); // 두 번째 스킬 = 궁극기
    { const bi = C.B_ICON.indexOf(b.name); if (bi >= 0) b.icon = 'b' + String(bi + 1).padStart(2, '0'); }   // ★1·★2 궁극기 아이콘 img/skill/bNN.png (2026-10-25, 전장의 기적은 아직 없음)
    if (ch.star === 2 && a.team) a.team = [a.team[0], a.team[1] * 1.1, a.team[2]];
    if (s3 && a.team) a.team = [a.team[0], a.team[1] * 1.25, a.team[2]];   // 지원 1번 아군 효과도 ★2 +10% · ★3 +25%(계수와 같은 비율)
    if (ch.star === 2) for (const k of [a, b]) { if (k.mult) k.mult = Math.round(k.mult * 1.1 * 100) / 100; k.cd = Math.round(k.cd * 0.92 * 10) / 10; } // ★2: 계수 +10%, 쿨 -8%
    // 1번 스킬 자체 효과와 겹치는 속성 부가 효과는 반대쪽(버프형 ↔ 디버프형)으로, 둘 다 겹치면 없음(2026-11-17 사용자 '아군 전체 스킬 피해가 덕지덕지' — 서리 지원 = 아군 스킬 피해 + 둔화를 이미 가짐, 질풍 지원 = 아군 공속)
    const dupOf = (f) => { const k = C.ELEM_TEAM[f]; return (k && a.team && a.team[0] === k) || (k === 'aspd' && a.type === 'buffaspd') || (k === 'atk' && a.type === 'buffatk') || (f === 'freeze' && a.type === 'slowall') || (f === 'bleed' && a.type === 'vulnall'); };
    const alt = { might: 'burn', frost: 'freeze', haste: 'combo', radiance: 'blind', focus: 'bleed', burn: 'might', freeze: 'frost', combo: 'haste', blind: 'radiance', bleed: 'focus' };
    let fx1 = fx; if (dupOf(fx1)) fx1 = dupOf(alt[fx]) ? null : alt[fx]; if (ch.role === 'sup' && el === 'wind') fx1 = null;   // 질풍 지원: 연타는 시전 끝 한 번만 걸려 약함(준 피해 +2.7% vs 공격형 +6.6%) → 없애고 1번 공속을 키움(사용자 결정)
    if (s3 && ch.role === 'sup' && C.SUP_CLASS[ch.id]) { fx1 = (C.SUP_CLASS[ch.id] === 'buff' ? { fire: 'might', water: 'frost', wind: 'haste', light: 'radiance', dark: 'focus' } : { fire: 'burn', water: 'freeze', wind: 'combo', light: 'blind', dark: 'bleed' })[el]; if (dupOf(fx1)) fx1 = null; }   // 버프 지원 = 아군 버프 부가 효과만, 디버프 지원 = 속성 파훼 디버프(겹치면 없음)
    a.fx = fx1; a.fxDesc = fx1 ? FXD[fx1] : null;
    if (C.CNT_CD && (C.ELEM_DEBUFFS.includes(fx1) || (el === 'water' && a.type === 'slowall'))) { const r = C.CNT_CD / a.cd; if (a.mult) { const m0 = a.mult; a.mult = Math.round(a.mult * r * 1000) / 1000; if (a.desc) a.desc = a.desc.replace(Math.round(m0 * 100) + '%', Math.round(a.mult * 100) + '%'); } if (a.team) a.team = [a.team[0], a.team[1] * r, a.team[2]]; a.cd = C.CNT_CD; }   // 2026-11-20 사용자 '파훼 캐 1명이면 빈틈, 2명이 번갈아 쓰면 빈틈 없이': 파훼(속성 디버프) 1번 스킬의 쿨을 한 값으로 맞춤 — 짧던 영웅은 늘고 길던 영웅은 줄며, 계수·아군 효과는 쿨 비율만큼 바꿔 초당 위력 유지
    { const sh = C.A_ICON.find(([w]) => a.name.endsWith(w)); if (sh) a.icon = 'a_' + sh[1] + '_' + el; }   // 1번 스킬 아이콘: 모양 15종 × 속성 색 (img/skill/a_모양_속성.png)
    if (s3) for (const k of [a, b]) { k.mult = Math.round(k.mult * 1.25 * 100) / 100; k.cd = Math.round(k.cd * 0.85 * 10) / 10; k.name = '각성·' + k.name; }
    const sig = (g.SIG || {})[ch.id];
    if (sig) b = Object.assign({}, sig, { sig: true, ult: true, bm: sig.mult, bp: sig.pct, icon: ch.id });
    if (sig && sig.grant && C.GRANT_CD && sig.cd > C.GRANT_CD) { const r = C.GRANT_CD / sig.cd, durOnly = b.dur && ['mark', 'debuffatk', 'debuffdef', 'vulnall'].includes(b.type); /* 지속형 약화는 지속만 줄여 켜진 비율 유지(세기까지 줄이면 이중 감소 — 2026-11-21 수정) */ if (b.mult && !durOnly) b.mult = Math.round(b.mult * r * 1000) / 1000; if (b.pct && !durOnly) b.pct = Math.round(b.pct * r * 1000) / 1000; if (b.heal) { const h0 = b.heal; b.heal = Math.round(b.heal * r * 1000) / 1000; if (b.desc) b.desc = b.desc.replace('공격력 ' + Math.round(h0 * 100) + '%', '공격력 ' + Math.round(b.heal * 100) + '%'); } if (b.type === 'shield') b.sdur = Math.round(8 * r * 10) / 10; if (b.dur) { const d0 = b.dur; b.dur = Math.round(b.dur * r * 10) / 10; if (b.desc) b.desc = b.desc.replace(new RegExp('(^|[^\\d.])' + d0 + '초(?!간 아군 공격)'), '$1' + b.dur + '초'); } b.gdur = Math.round(C.GRANT.dur * r * 10) / 10; if (b.desc) b.desc = b.desc.replace(C.GRANT.dur + '초간 아군 공격', b.gdur + '초간 아군 공격'); b.cd = C.GRANT_CD; }   /* 지속(보호막·버프·파훼 버프)도 같은 비율 — 켜져 있는 시간 비율 유지 */   // 2026-11-20 파훼 지원 궁극기(grant)도 쿨을 맞춤 — 계수는 쿨 비율만큼(초당 위력 유지)   // icon: img/skill/{id}.png   // bm·bp: 설명문 숫자 치환용 원래 계수
    for (const k of [a, b]) k.cd = Math.round(k.cd * C.SKILL_CD_MULT * 10) / 10;   // 배속 ×3 기본 기준으로 쿨타임 ×3
    if (ch.role === 'sup' && a.mult && /%[↑↓]/.test(a.desc || '')) a.desc = a.desc.replace(/\d+(?:\.\d+)?%(?=[↑↓])/, Math.round(a.mult * 100) + '%');   // 지원 1번 설명의 수치 = 실제 계수(★2·★3 배율 포함)
    if (a.team) a.desc = a.desc.replace(/(아군 전체 [^·]*? )\d+(?:\.\d+)?(%p?↑)/, (m, p1, p2) => p1 + Math.round(a.team[1] * 100) + p2);
    return [a, b];
  };
  C.skillOf = function (ch) { return C.skillsOf(ch)[0]; };
  C.DMG_TYPES = ['single', 'aoe', 'heal', 'healall', 'bash', 'multi', 'whirl', 'chain', 'meteor', 'execute', 'line', 'nova', 'dive', 'timestop', 'vortex', 'plague', 'bless', 'sanctuary', 'resurrect'];  // 스킬 레벨이 계수에 100% 반영되는 유형
  // 사거리·대기 위치
  C.MELEE_SIG = ['whirl', 'nova', 'multi', 'berserk', 'execute', 'dive'];
  C.heroRange = function (ch) { const sg = (g.SIG || {})[ch.id]; if (sg && sg.ranged) return 38; if (sg) return C.MELEE_SIG.includes(sg.type) ? 7 : (['line', 'chain', 'meteor', 'vortex', 'mark', 'plague', 'timestop'].includes(sg.type) && ch.role === 'dps' ? 38 : (ch.role === 'tank' ? 7 : 38)); if (ch.role === 'tank') return 7; if (ch.role === 'dps') return (ch.seed || 0) % 2 === 0 ? 7 : 38; return 38; };
  C.heroHome = function (ch) { if (ch.role === 'tank') return 36; if (ch.role === 'dps') return (ch.seed || 0) % 2 === 0 ? 32 : 24; if (ch.role === 'heal') return 18; return 13; };
  // 파티 슬롯 개방 (최고 클리어 스테이지 기준)
  C.SLOT_UNLOCK = [0, 50, 150, 300, 500];   // 2026-11-18 새 단위(×10)
  C.partySlots = function (maxClear) { return C.SLOT_UNLOCK.filter(t => maxClear >= t).length; };
  C.enemyCount = function (stage) { return stage < 5 ? 1 : stage < 15 ? 2 : stage < 30 ? 3 : stage < 50 ? 4 : 5; };
  g.RPG = g.RPG || {};
  g.RPG.C = C;
})(typeof window !== 'undefined' ? window : globalThis);

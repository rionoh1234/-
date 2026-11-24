// 상수·수식 2: 적·스테이지·지역·보스·격노
(function (g) {
  const C = g.RPG.C;
  const T = g.TUNE || {};
  // ---------- 적/스테이지 (필드 사냥) ----------
  C.STAGE_MAX = 1e9;              // 스테이지 무한 (100 이후 10장 지역이 '심화'로 반복)
  C.STAGE_G2 = T.sg2 || 1.025;      // 100스테이지 이후 적 성장률 (2026-10-29 시즌 2: 1.02 → 1.025 — ★3 하나로 등반이 확 뛰지 않게)
  C.GOLD_G2 = T.ig2 || 1.05;      // 100스테이지 이후 골드 성장률
  C.STAGE_G = T.sg || 1.06;            // 스테이지당 적 능력치 배율
  C.MOB_BASE = { hp: T.mhp || 260, atk: T.matk || 34, def: 26, spd: 80 };
  C.MOB_TYPES = {
    slime: { hp: 1.0, atk: 0.8, def: 0.8, spd: 0.9, elem: 'water' },
    bat: { hp: 0.7, atk: 1.0, def: 0.6, spd: 1.3, elem: 'dark' },
    goblin: { hp: 0.9, atk: 1.1, def: 0.8, spd: 1.1, elem: 'wind' },
    skeleton: { hp: 0.9, atk: 1.0, def: 1.1, spd: 0.95, elem: 'dark' },
    wolf: { hp: 1.0, atk: 1.2, def: 0.8, spd: 1.25, elem: 'wind' },
    spider: { hp: 0.8, atk: 1.1, def: 0.9, spd: 1.15, elem: 'dark' },
    mushroom: { hp: 1.3, atk: 0.8, def: 1.0, spd: 0.8, elem: 'wind' },
    ghost: { hp: 0.8, atk: 1.1, def: 0.7, spd: 1.2, elem: 'light', ranged: true },
    golem: { hp: 1.8, atk: 0.9, def: 1.6, spd: 0.7, elem: 'fire' },
    orc: { hp: 1.4, atk: 1.3, def: 1.0, spd: 0.9, elem: 'fire' },
    darkmage: { hp: 0.8, atk: 1.4, def: 0.7, spd: 1.0, elem: 'dark', ranged: true },
    eye: { hp: 1.0, atk: 1.2, def: 1.0, spd: 1.0, elem: 'light', ranged: true },
    // 추가 몹 (GPT 도트 2차)
    fallen_priest: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'light', ranged: true },
    hell_knight: { hp: 1.4, atk: 1.2, def: 1.1, spd: 0.9, elem: 'fire' },
    druid: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'wind', ranged: true },
    old_mage: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'water', ranged: true },
    bandit: { hp: 0.9, atk: 1.1, def: 0.8, spd: 1.25, elem: 'wind' },
    assassin: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.3, elem: 'dark' },
    shaman: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'wind', ranged: true },
    barbarian: { hp: 1.4, atk: 1.2, def: 1.1, spd: 0.9, elem: 'fire' },
    dancer: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.3, elem: 'fire' },
    ice_golem: { hp: 1.8, atk: 0.9, def: 1.6, spd: 0.7, elem: 'water' },
    wraith: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'dark', ranged: true },
    gob_archer: { hp: 0.85, atk: 1.15, def: 0.8, spd: 1.05, elem: 'wind', ranged: true },
    iron_skel: { hp: 1.8, atk: 0.9, def: 1.6, spd: 0.7, elem: 'dark' },
    imp: { hp: 0.9, atk: 1.1, def: 0.8, spd: 1.25, elem: 'fire' },
    frost_wolf: { hp: 0.9, atk: 1.1, def: 0.8, spd: 1.25, elem: 'water' },
    abyss_eye: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'dark', ranged: true },
    reaper: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.3, elem: 'dark' },
    jelly: { hp: 0.85, atk: 1.15, def: 0.8, spd: 1.05, elem: 'water', ranged: true },
    man_plant: { hp: 1.4, atk: 1.2, def: 1.1, spd: 0.9, elem: 'wind' },
    hill_orc: { hp: 1.4, atk: 1.2, def: 1.1, spd: 0.9, elem: 'fire' },
    red_spider: { hp: 0.9, atk: 1.1, def: 0.8, spd: 1.25, elem: 'dark' },
    gob_spear: { hp: 1.0, atk: 1.0, def: 1.0, spd: 1.0, elem: 'wind' },
    skel_archer: { hp: 0.85, atk: 1.15, def: 0.8, spd: 1.05, elem: 'dark', ranged: true },
    dark_priest: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'dark', ranged: true },
    vine: { hp: 1.0, atk: 1.0, def: 1.0, spd: 1.0, elem: 'wind' },
    crystal_golem: { hp: 1.8, atk: 0.9, def: 1.6, spd: 0.7, elem: 'light' },
    demon_slime: { hp: 1.8, atk: 0.9, def: 1.6, spd: 0.7, elem: 'dark' },
    scorpion: { hp: 0.9, atk: 1.1, def: 0.8, spd: 1.25, elem: 'fire' },
    mercenary: { hp: 1.0, atk: 1.0, def: 1.0, spd: 1.0, elem: 'fire' },
    gargoyle: { hp: 1.8, atk: 0.9, def: 1.6, spd: 0.7, elem: 'dark' },
    ice_spirit: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'water', ranged: true },
    red_mush: { hp: 1.0, atk: 1.0, def: 1.0, spd: 1.0, elem: 'fire' },
    shadow: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.3, elem: 'dark' },
    skel_knight: { hp: 1.4, atk: 1.2, def: 1.1, spd: 0.9, elem: 'dark' },
    treant: { hp: 1.8, atk: 0.9, def: 1.6, spd: 0.7, elem: 'wind' },
    viper: { hp: 0.9, atk: 1.1, def: 0.8, spd: 1.25, elem: 'dark' },
    skel_mage: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'water', ranged: true },
    fire_spirit: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'fire', ranged: true },
    blade: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.3, elem: 'fire' },
    dark_bishop: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'dark', ranged: true },
    seraph: { hp: 1.4, atk: 1.2, def: 1.1, spd: 0.9, elem: 'light' },
    sage: { hp: 0.8, atk: 1.35, def: 0.7, spd: 1.0, elem: 'wind', ranged: true },
    shade_beast: { hp: 1.4, atk: 1.2, def: 1.1, spd: 0.9, elem: 'dark' },
    mecha: { hp: 0.85, atk: 1.15, def: 0.8, spd: 1.05, elem: 'light', ranged: true },
  };
  C.BOSS_TYPES = {
    dragon: { hp: 1.0, atk: 1.0, def: 1.2, spd: 1.0, elem: 'fire' },
    titan: { hp: 1.35, atk: 0.85, def: 1.7, spd: 0.8, elem: 'wind' },
    lich: { hp: 0.8, atk: 1.2, def: 1.0, spd: 1.1, elem: 'dark', ranged: true },
    demonlord: { hp: 1.2, atk: 1.1, def: 1.3, spd: 1.0, elem: 'light' },
    lava_giant: { hp: 1.4, atk: 1.0, def: 1.5, spd: 0.8, elem: 'fire' },
    troll: { hp: 1.5, atk: 1.0, def: 1.4, spd: 0.85, elem: 'wind' },
    archmage: { hp: 0.85, atk: 1.25, def: 0.9, spd: 1.05, elem: 'dark', ranged: true },
    hive_eye: { hp: 0.9, atk: 1.2, def: 1.0, spd: 1.0, elem: 'dark', ranged: true },
    ice_dragon: { hp: 1.05, atk: 1.0, def: 1.2, spd: 1.0, elem: 'water' },
    tree_giant: { hp: 1.5, atk: 0.9, def: 1.5, spd: 0.8, elem: 'wind' },
    hell_lord: { hp: 1.2, atk: 1.2, def: 1.2, spd: 1.0, elem: 'fire' },
    frost_queen: { hp: 0.9, atk: 1.2, def: 1.0, spd: 1.05, elem: 'water', ranged: true },
    war_angel: { hp: 1.15, atk: 1.15, def: 1.25, spd: 1.0, elem: 'light' },
    fallen_angel: { hp: 1.2, atk: 1.15, def: 1.2, spd: 1.0, elem: 'dark' },
    judge: { hp: 1.25, atk: 1.1, def: 1.3, spd: 0.95, elem: 'light' },
    abyss_lord: { hp: 1.0, atk: 1.25, def: 1.1, spd: 1.0, elem: 'dark', ranged: true },
  };
  // 보스 배율: 초반엔 몹의 7배, 100스테이지엔 22배
  C.bossHpMult = function (stage) { return 7 + 0.15 * Math.min(100, stage); };
  C.bossAtkMult = function (stage) { return 1.4 + 0.008 * Math.min(100, stage); };
  C.CHAPTER_NAME = ['초원의 들판', '고블린 숲', '잊혀진 묘지', '늑대 협곡', '거미 동굴', '독버섯 습지', '유령 저택', '바위 요새', '오크 전장', '마왕의 성'];
  C.CHAPTER_MOBS = [   // 지역별 몹 풀(5~8종)
    ['slime', 'goblin', 'bat', 'bandit', 'gob_archer', 'jelly'],
    ['goblin', 'wolf', 'mushroom', 'gob_spear', 'shaman', 'man_plant', 'druid'],
    ['skeleton', 'bat', 'ghost', 'skel_archer', 'reaper', 'wraith', 'skel_mage', 'skel_knight'],
    ['wolf', 'goblin', 'spider', 'frost_wolf', 'barbarian', 'scorpion', 'assassin'],
    ['spider', 'bat', 'skeleton', 'red_spider', 'viper', 'gargoyle'],
    ['mushroom', 'slime', 'spider', 'jelly', 'vine', 'red_mush', 'treant', 'sage'],
    ['ghost', 'darkmage', 'skeleton', 'wraith', 'dark_priest', 'shadow', 'fallen_priest', 'ice_spirit'],
    ['golem', 'orc', 'eye', 'ice_golem', 'crystal_golem', 'iron_skel', 'mecha', 'seraph'],
    ['orc', 'wolf', 'darkmage', 'hill_orc', 'barbarian', 'mercenary', 'imp', 'dancer', 'blade'],
    ['darkmage', 'eye', 'golem', 'hell_knight', 'demon_slime', 'abyss_eye', 'dark_bishop', 'shade_beast', 'fire_spirit', 'old_mage'],
  ];
  // 지역 보스: 심화 단계마다 돌아가며 등장
  C.CHAPTER_BOSS = [['dragon', 'tree_giant'], ['titan', 'troll'], ['lich', 'archmage'], ['ice_dragon', 'troll'], ['abyss_lord', 'hive_eye'], ['tree_giant', 'titan'], ['frost_queen', 'lich'], ['judge', 'war_angel'], ['lava_giant', 'dragon'], ['demonlord', 'hell_lord', 'fallen_angel']];
  C.chapterBoss = function (ch, loop) { const b = C.CHAPTER_BOSS[ch]; return Array.isArray(b) ? b[(loop || 0) % b.length] : b; };
  C.CHAPTER_HUE = [0, 40, 200, 100, 280, 320, 180, 60, 140, 240];
  C.CHAPTER_GROUND = ['#2f4a2a', '#2a4030', '#3a3a46', '#4a3e30', '#2e2a3e', '#2f3d2a', '#33304a', '#4a4440', '#4a3a2a', '#3a2a3e'];
  // 고층 적 성장(2026-10-29): STAGE_S3 스테이지부터 STAGE_G3로 완만하게 — 고층에서 골드 강화 비용(레벨당 9%)이 적 성장을 못 따라가 등반이 멈추던 문제
  C.STAGE_S3 = +(T.ss3) || 400; C.STAGE_G3 = +(T.sg3) || 1.0155;   // 시뮬(9주, 하루 60분, 3시드): 1.0155 → 3~9주차 주당 82~389(최소 하루 11.7), 1.016 → 9주차 주당 40까지 하락, 1.0125 이하 → 하루 60(시간 상한)으로 폭주
  C.stageMult = function (s) { if (s <= 100) return Math.pow(C.STAGE_G, s - 1); const a = Math.min(s, C.STAGE_S3) - 100, b = Math.max(0, s - C.STAGE_S3); return Math.pow(C.STAGE_G, 99) * Math.pow(C.STAGE_G2, a) * Math.pow(C.STAGE_G3, b); };
  // 영웅 레벨 보정(2026-10-30): 레벨 시스템으로 늘어난 능력치만큼 적도 강화 — 스테이지 s에서 기대 레벨 = 1 + s/LV_ENEMY_DIV(★3 상한 50에서 멈춤). 초월로 상한을 넘긴 만큼은 영웅 이득
  C.LV_ENEMY_DIV = +(T.led) || 8;
  C.lvEnemy = function (s) { return C.lvMult ? C.lvMult(Math.min(C.LV_CAP ? C.LV_CAP[3] : 1, 1 + s / C.LV_ENEMY_DIV)) : 1; };
  const _sm = C.stageMult; C.stageMult = function (s) { return _sm(s) * C.lvEnemy(s); };
  C.stageChapter = function (s) { return Math.floor((s - 1) / 10) % 10; };   // 지역(몹·보스·배경) 인덱스 0~9
  C.stageLoop = function (s) { return Math.floor((s - 1) / 100); };          // 심화 단계 0,1,2…
  // 스테이지 ×10(2026-11-18, 사용자 '스테이지를 1000·2000개씩 올라가게', '물리적으로 쭉쭉', '무조건 한 층에 보스 하나 · 모두 지금 크기 보스'):
  // 저장값 S.stage·S.maxClear는 새 단위(예전의 10배). 난이도·보상 공식은 예전 단위 C.sOld(D) = D/10(소수)로 계산 → 스테이지당 적 성장이 1/10.
  // 스테이지마다 잡몹 2마리 + 보스(예전 크기), 보스 보상은 1/10(보스가 10배 자주 나옴), 관문·인장·개방 조건은 새 단위로 ×10
  C.STAGE_DISP = 10;
  C.sOld = function (D) { return Math.max(1, (D || 0) / C.STAGE_DISP); };
  C.sOldI = function (D) { return Math.max(1, Math.ceil((D || 0) / C.STAGE_DISP)); };
  C.dStage = function (s) { return s; };
  C.dMax = function (m) { return m || 0; };
  C.stageTitle = function (D) { const s = C.sOldI(D); const ch = C.stageChapter(s), lp = C.stageLoop(s); return `${Math.floor((s - 1) / 10) + 1}장 ${C.CHAPTER_NAME[ch]}${lp ? ' · 심화 ' + lp : ''}`; };
  C.isBossStage = function (s) { return s % 10 === 0; };   // 예전 단위(지역 보스 — 새 단위로는 100스테이지마다)
  C.KILL_QUOTA = 50;   // 2026-11-24 사용자 '스테이지 잡몹 50마리'(탑 12·던전 8은 그대로). 이전:  일반 몹 20마리 → 보스. 2026-11-18 스테이지 ×10 때 2로 줄였다가 2026-11-19 사용자 '원래대로 다시 늘려'로 20 복구
  C.RUSH_KILLS = 2;    // 빠른 진격으로 건너뛴 스테이지 1개당 처치 보상 마릿수 — 진격 1회(100스테이지) = 200마리분으로 예전 양 유지(20으로 하면 진격 보상이 7배)
  // 관문(시즌 3): GATE.every 스테이지마다 관문 보스 — 체력·공격 배율 + 기믹, 빠른 진격으로 건너뛸 수 없음, 첫 클리어 시 별의 인장 1개
  C.GATE = { every: +(T.gte) || 500, k: +(T.gtk) || 1.4, from: 1000, seal: +(T.gts) || 1000 };   // 2026-11-18 새 단위(×10)   // seal = 별의 인장을 주는 관문 간격(2026-11-17 50 → 100, 소환 ★3 확률 상향과 짝)   // k = 관문 보스 체력·공격 배율(from 스테이지 초과부터 — 50·100 관문은 기믹만: 100 전후는 원래 가파른 구간이라 배율까지 얹으면 벽이 1.5일까지 늘어남)
  C.isGate = function (s) { return s >= C.GATE.every && s % C.GATE.every === 0; };
  // 보스 기믹(관문·탑 10층마다) — 기믹마다 답이 되는 영웅 종류가 다르다(수집 폭이 곧 돌파력)
  //   장벽 = 타격 횟수로만 깨지는 보호막(깨지면 잠시 무방비) → 연타·공격 속도
  //   철갑 = 받는 피해 대폭 감소, 화상·방어력 감소·표식이 걸려 있는 동안(+open초) 벗겨짐 → 화염·약화 지원
  //   격분 = 주기적으로 힘을 모아 전체 공격 + 공격력 누적 증가, 모으는 동안 기절 스킬로 저지 → 기절
  //   신속 = 공격 속도 k배, 둔화가 걸려 있는 동안(+open초) 정상 → 서리·둔화
  C.GIMS = ['barrier', 'frenzy', 'armor', 'rampage', 'regen'];   // 2026-11-20 신속 → 폭주(사용자 '신속은 못 깨게 하는 영향력이 작다')   // 2026-11-17 재생 추가(어둠 출혈의 답) — 관문 50 장벽 → 100 격분 → 150 철갑 → 200 신속 → 250 재생 → 300 장벽 …   // 관문 50 장벽 → 100 격분 → 150 철갑 → 200 신속 → 250 장벽 … (100 근처는 원래 가파른 구간이라 답이 흔한 격분을 둠)
  C.GIM_KR = { barrier: '장벽', armor: '철갑', frenzy: '격분', rampage: '폭주', regen: '재생' };
  // 2026-11-20 기믹 개편(사용자 '답 없이 딜로 찍어누를 수는 있지만 엄청 힘들게 · 장벽과 철갑은 분명히 다르게'):
  //   장벽 = 보호막 체력(최대 체력 pct). 있는 동안 본체 피해 0·지속 피해 막힘, 깨지면 every초 뒤 다시 생김. 연타(질풍) 걸린 동안 보호막에 comboMul배 → 질풍은 순식간에 벗기고, 없으면 보호막을 통째로 깎아야 함
  //   철갑 = 받는 피해 leak배(상시). 화상(화염)이 걸린 동안과 그 뒤 open초는 벗겨짐 → 장벽(주기적으로 생기는 체력 덩어리)과 달리 '항상 단단함'
  //   격분 = every초마다 cast초 모아 전체 공격(평타 mult배) + 공격력 amp 누적, 모으는 동안 실명(빛)으로만 끊음
  //   폭주 = 등장 first초 뒤 '폭주!' → every초마다 공격력 amp·공속 spd 누적(상한 없음), 빙결(서리)이 들어가면 누적 0 + stagger초 동안 폭주 안 함(격분과 같은 흐름 — 사용자 '부드럽게 파훼')
  //   재생 = 매초 최대 체력 rate 회복, 출혈(어둠) 동안과 그 뒤 open초는 회복 못 함
  C.GIM = { barrier: { pct: +(T.gbp) || 1.5, every: +(T.gbe) || 13, comboMul: +(T.gbc) || 40 }, armor: { leak: +(T.gal) || 0.2, open: +(T.gao) || 11 }, frenzy: { first: +(T.gff) || 2, every: +(T.gfe) || 4, cast: 2, mult: +(T.gfm) || 0.7, amp: +(T.gfa) || 1, max: +(T.gfx) || 4, stagger: T.gfs != null ? +T.gfs : 11 }, rampage: { first: +(T.grf) || 1, every: +(T.grv) || 1, amp: +(T.gra) || 0.4, spd: +(T.grs) || 0.2, max: +(T.grx) || 6, stagger: T.grz != null ? +T.grz : 11 }, regen: { keep: +(T.ggk) || 0.98, rate: +(T.ggr) || 0.8, open: +(T.ggo) || 8 } };   // 시뮬(사용자 저장 3800, 일반 보스 = 파티 공격력 ×1.25에서 승): 답 있으면 ×1.25~1.5, 답 없으면 ×2.5~3.5 (scratchpad/bal2/gb.js·runall.sh)
  // 기믹의 답이 되는 스킬을 가졌는지(sks = 실제 스킬 목록 — 전용장비로 붙은 효과 포함). 화상·둔화는 그 효과를 실제로 거는 스킬 종류만 센다
  C.GIM_FX_TYPES = ['single', 'multi', 'aoe', 'bash', 'taunt', 'guard'];
  C.gimAnswer = function (g, sks, elem) {   // 2026-11-20: 기믹의 답 = 속성 디버프 1종만(철갑 화상 · 폭주 빙결(서리 영웅의 둔화) · 장벽 연타 · 격분 실명 · 재생 출혈)
    const k0 = C.GIM_DEB[g]; if (!k0) return false;
    return (sks || []).some(k => k.fx === k0 || k.grant === k0 || (k.postNova && k.postNova[k0]) ||
      (k0 === 'burn' && (k.burn || k.hBurn)) || (k0 === 'bleed' && (k.hBleed || k.bleed)) || (k0 === 'blind' && k.blind) ||
      (k0 === 'freeze' && elem === 'water' && (k.type === 'timestop' || k.hSlow || k.postSlow || k.type === 'slowall' || (k.type === 'vortex' && !k.noSlow))));
  };
  // 역속성 관문(2026-11-23 사용자 '1000의 배수 보스는 파훼 속성이 역속성 걸리게'): 기믹을 푸는 속성이 불리한 속성의 보스로 바꿈
  //   화염(철갑) → 서리 보스 · 서리(폭주) → 질풍 보스 · 질풍(장벽) → 화염 보스 · 빛(격분) ↔ 어둠(재생)은 반대 속성 보스(서로 ×C.ADV_LD)
  //   체력·공격·방어·속도는 원래 지역 보스 수치 그대로, 모습·이름·속성·사거리만 바꿈(난이도는 상성만큼만 달라짐)
  C.REV_GATE = 1000;
  C.GIM_ELEM = { armor: 'fire', rampage: 'water', barrier: 'wind', frenzy: 'light', regen: 'dark' };
  C.REV_ELEM = { fire: 'water', water: 'wind', wind: 'fire', light: 'dark', dark: 'light' };
  C.revBoss = function (boss, D) {
    const want = C.REV_ELEM[C.GIM_ELEM[boss.gim]]; if (!want || boss.elem === want) return boss;
    const ids = Object.keys(C.BOSS_TYPES).filter(k => C.BOSS_TYPES[k].elem === want); if (!ids.length) return boss;
    const id = ids[Math.floor(D / C.REV_GATE) % ids.length], t = C.BOSS_TYPES[id], mob = (g.MOBS || []).find(x => x.id === id);
    boss.id = id; boss.elem = want; boss.range = t.ranged ? 100 : 34; if (mob) boss.name = mob.name; return boss;
  };
  C.gimOf = function (i) { return C.GIMS[((i % C.GIMS.length) + C.GIMS.length) % C.GIMS.length]; };
  C.RUSH = { sec: 15, n: 100, min: 1000, dgMin: 10, tw: 10 };   // tw = 탑 빠른 돌파 층수(2026-11-24 사용자 '10층')   // 2026-11-18 n·min 새 단위(×10)   // 빠른 진격(2026-10-31 사용자): 최전선 보스를 게임 시간 15초(×3 배속 실제 5초) 안에 잡으면 다음 10스테이지를 즉시 클리어 — 잡몹 20마리·보스·첫 클리어·장비 드롭 보상 전부 지급. 100스테이지부터(초반 보스는 원래 약해서 제외)
  C.REVIVE_SEC = 12;          // 개별 영웅 부활 대기(초)
  C.maxMobs = function (slots) { return 2 + slots; };
  C.makeMob = function (type, mult, boss, stage) {
    const t = boss ? C.BOSS_TYPES[type] : C.MOB_TYPES[type];
    const b = C.MOB_BASE;
    const hm = boss ? C.bossHpMult(stage || 1) : 1, am = boss ? C.bossAtkMult(stage || 1) : 1;
    return {
      id: type, boss: !!boss, elem: t.elem,
      hp: Math.round(b.hp * t.hp * mult * hm), atk: Math.round(b.atk * t.atk * mult * am), def: Math.round(b.def * t.def * mult), spd: Math.round(b.spd * t.spd),
      name: (g.MOBS || []).find(x => x.id === type) ? g.MOBS.find(x => x.id === type).name : type,
      range: t.ranged ? 100 : (boss ? 34 : 24),
      skills: boss ? [{ name: '포효', type: 'roar', mult: 1.3, cd: 8 }] : [],
    };
  };
  // 스테이지 필드 파라미터
  // 스테이지 전용 난이도 배분: 일반 몹은 약하게(쉽게 쓸어 담기), 보스는 체력을 크게 늘려 긴 전투 + 격노로 딜 체크
  //   격노: 보스 등장 후 at초(게임 시간, 배속 ×3이면 실시간 1/3)부터 per초마다 공격력 +100%
  C.STAGE_MOB = { hp: T.smh || 0.6, atk: T.sma || 0.5 };
  C.STAGE_MOB_UP = { hp: T.smu || 20, atk: T.smua || 2, ramp: T.smur || 400 };   // 2026-11-24 사용자 '잡몹 50마리·버티고 아프게' — 잡몹 체력 ×20·공격 ×2, 보스와 같은 ramp(예전 단위 400 = 4000스테이지)까지 선형으로(새 계정 초반 보호)
  C.STAGE_BOSS = { hp: T.sbh || 60, atk: T.sba || 0.5, ramp: T.sbr || 400 };
  C.BOSS_ENRAGE = { at: T.bea || 90, per: T.bep || 12 };   // 2026-10-31 90/15 → 90/12(보스전 길이 조정과 짝)
  C.stageParams = function (D, slots, autoBoss) {
    const stage = C.sOld(D), si = C.sOldI(D);   // 예전 단위(소수)
    const ch = C.stageChapter(si); const m = C.stageMult(stage); const hue = C.CHAPTER_HUE[ch];
    const mu = Math.min(1, stage / C.STAGE_MOB_UP.ramp), mh = C.STAGE_MOB.hp * (1 + (C.STAGE_MOB_UP.hp - 1) * mu), ma = C.STAGE_MOB.atk * (1 + (C.STAGE_MOB_UP.atk - 1) * mu);
    const mobs = C.CHAPTER_MOBS[ch].map(t => { const mm = C.makeMob(t, m, false); mm.hue = hue; mm.hp = Math.round(mm.hp * mh); mm.atk = Math.round(mm.atk * ma); return mm; });
    const boss = C.makeMob(C.chapterBoss(ch, C.stageLoop(si)), m * (D % (10 * C.STAGE_DISP) === 0 ? 1.15 : 1), true, stage); boss.hue = hue;
    const rp = Math.min(1, stage / C.STAGE_BOSS.ramp);   // 초반(동료 슬롯이 적을 때)은 완만하게, ramp 스테이지에서 최대
    boss.hp = Math.round(boss.hp * (1 + (C.STAGE_BOSS.hp - 1) * rp)); boss.atk = Math.round(boss.atk * (1 + (C.STAGE_BOSS.atk - 1) * rp));
    { const bs = C.bossStyle((stage - 30) / 70, stage); boss.hp = Math.round(boss.hp * bs.hp); boss.atk = Math.round(boss.atk * bs.atk); boss.basic = bs.basic; boss.roar = bs.roar; }
    const gate = C.isGate(D); if (gate) { const k = D > C.GATE.from ? C.GATE.k : 1; boss.hp = Math.round(boss.hp * k); boss.atk = Math.round(boss.atk * k); boss.gim = C.gimOf(D / C.GATE.every - 1);
      if (D % C.REV_GATE === 0) C.revBoss(boss, D); }
    return { mode: 'stage', stage: D, mobs, boss, quota: C.KILL_QUOTA, maxMobs: C.maxMobs(slots), autoBoss: autoBoss !== false, chapter: ch, enrage: C.BOSS_ENRAGE, gate };
  };
})(typeof window !== 'undefined' ? window : globalThis);

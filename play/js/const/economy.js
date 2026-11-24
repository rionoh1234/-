// 상수·수식 3: 소환·골드·보석·방치·조합·탑·승급석·레이드 보상
(function (g) {
  const C = g.RPG.C;
  const T = g.TUNE || {};
  // ---------- 경제 ----------
  // 보석 수입 배율(2026-10-29 시즌 2, 사용자 결정 '7일 ★3 14명'): 모든 보석 출처(스테이지·첫 클리어·방치·접속·던전·레이드·탑·임무·업적)에 곱함.
  // 시뮬레이션(tools/pace — 임무·탑 포함, 하루 60분 접속, 6시드): 1.0 → 7일 ★3 30명(5일차에 전부), 0.17 + 적 성장 1.025 → 평균 14.3명(13~16), 7일 스테이지 약 350
  C.GEM_MULT = +(T.gm) || 0.10;   // 2026-10-30 D안: 0.17 → 0.13(첫 클리어를 따로 올린 만큼) → 2026-10-31 0.09(던전 상한 + 하루 2.5시간 접속 기준 재시뮬, 7일 ★3 평균 13.5) → 2026-11-01 0.10(던전 도전 보상 20%로 줄인 만큼, 7일 ★3 평균 14.3)
  C.FIRST_GEM_MULT = +(T.fgm) || 0.5;   // 첫 클리어 보석 배율 — 2026-10-30 D안(사용자 '클리어하는 맛'): 일반 45·보스 150(소환 1.5회). 시뮬 7일 ★3 평균 14.5
  C.gem = (v) => (v > 0 ? Math.max(1, Math.round(v * C.GEM_MULT)) : 0);
  // 방치(오프라인·접속 중) 보석 배율: 스테이지 IDLE_GEM.s0까지 GEM_MULT, s1까지 직선으로 올라 to에서 고정 — 중후반 보석 수요(장비·신화·소환) 대비, 초반 ★3 속도는 유지
  C.IDLE_GEM = { s0: +(T.ig0) || 300, s1: +(T.ig1) || 600, to: +(T.igt) || 1.0 };   // 300스테이지부터 올라 600에서 원래 수준(배율 1.0)
  C.idleGemMult = function (s) { const I = C.IDLE_GEM, m = C.GEM_MULT; if (!I.to || s <= I.s0) return m; return m + (Math.max(m, I.to) - m) * Math.min(1, (s - I.s0) / (I.s1 - I.s0)); };
  C.SEASON = 3;   // 시즌 3(2026-11-15): 결핍 재설계 — ★3 희소화(별의 인장·지정 소환)·관문·기믹 보스·속성 시련 전용 편성·승급   // 저장 데이터 시즌 — 이보다 낮으면 접속 시 백업 후 새로 시작(ui/boot.js seasonCheck)
  C.GACHA_COST = 100;
  C.GACHA_COST_ELEM = 150;
  C.PICKUP_MULT = 2;          // 픽업 영웅(일러스트 보유 ★3, 매일 교체) ★3 안에서 출현 가중치 ×2
  C.PICKUP_MS = 24 * 3600 * 1000;    // 속성 소환: 1회 150 (풀을 한 속성으로 제한)
  C.GACHA_RATE = { 1: 0.785, 2: 0.20, 3: 0.015 };
  // 영웅 소환 레벨: 누적 영웅 소환 횟수(s.pulls)로 상승, ★3·★2 확률↑ (Lv1 = 기본 확률)
  C.GACHA_SLV = [0, 50, 200, 500, 1000, 2000, 4000, 8000, 15000, 30000];
  // 시즌 3: ★3 직접 출현은 '대박' 수준으로만(시즌 2: 0.3~0.5%). ★3의 주 획득 경로 = 별의 인장 조합(관문) + 지정 소환
  const J3 = +(T.j3) || 1;   // 시뮬용 배율
  C.GACHA_LV_RATE = [   // [★3, ★2] 확률
    [0.005, 0.20], [0.005, 0.205], [0.0058, 0.21], [0.0058, 0.22], [0.0067, 0.23], [0.0067, 0.24], [0.0075, 0.25], [0.0075, 0.26], [0.0083, 0.27], [0.0083, 0.28],   // 2026-11-17 사용자 결정: 0.06~0.10% → 0.5~0.83% · 관문 인장 100스테이지마다(C.GATE.seal) · 탑 인장 200층마다(C.TOWER_SEAL). 7일 시뮬 8시드 ★3 5.38(4~6)
  ].map(([a, b]) => [a * J3, b]);
  C.gachaLv = function (pulls) { let lv = 1; C.GACHA_SLV.forEach((t, i) => { if (pulls >= t) lv = i + 1; }); return lv; };
  C.gachaRate = function (pulls) { const [r3, r2] = C.GACHA_LV_RATE[C.gachaLv(pulls) - 1]; return { 3: r3, 2: r2, 1: Math.round((1 - r3 - r2) * 10000) / 10000 }; };
  C.DUPE_PITY = { 1: T.dp1 != null ? +T.dp1 : 3, 2: T.dp2 != null ? +T.dp2 : 1 };   // 2026-11-17 ★1·★2 중복 → 지정 소환 게이지 추가(예전 승급석 1·3 — 승급석은 남아돌아 의미가 없었음, 사용자 'A안')
  C.PITY = +(T.wn) || 400;   // 지정 소환 게이지(시즌 3): 소환 PITY회마다 지정한 ★3 확정(미보유면 획득, 보유면 조각). 지정 안 하면 무작위 ★3. 대박 ★3이 나와도 게이지는 유지
  C.OFFLINE_CAP_MIN = 24 * 60;   // 오프라인 보상 상한 24시간
  C.OFFLINE_EFF = 1.0;           // 배속 ×3 접속 플레이(분당 3판) 기준 100%
  C.stageGold = function (s) { const g1 = T.ig || 1.06; return Math.round(60 * (s <= 100 ? Math.pow(g1, s - 1) : Math.pow(g1, 99) * Math.pow(C.GOLD_G2, s - 100))); };   // 스테이지 1회(처치 20 + 보스) 기준 총 골드
  C.killGold = function (s) { return Math.max(1, Math.round(C.stageGold(s) / 30)); };
  C.bossGold = function (s) { return Math.round(C.stageGold(s) / 3); };
  C.stageCrystalRaw = function (s) { return s <= 240 ? 8 + Math.floor(s / 12) : 28 * Math.sqrt(s / 240); };
  C.stageCrystal = function (s) { return C.gem(C.stageCrystalRaw(s)); };   // 240까지 직선(28), 이후 제곱근 성장(1229 → 63, 2000 → 81) — 등반할수록 보석↑ (2026-10-24)               // 보스 처치 시
  C.firstClearBonus = function (s) { const c = Math.max(C.stageCrystalRaw(s), 28); const fg = (v) => Math.max(1, Math.round(v * C.FIRST_GEM_MULT)); return C.isBossStage(s) ? { gold: C.stageGold(s) * 6, crystal: fg(c * 10.7) } : { gold: C.stageGold(s) * 2, crystal: fg(c * 3.2) }; };   // 첫 클리어 보석도 스테이지 보석(stageCrystal)에 비례 — 240까지는 이전과 같은 90/300, 이후 함께 증가 (2026-10-24)
  // 분당 방치 수익 (최고 스테이지 기준, 1판 ≈ 40초 가정)
  C.ONLINE_GEM = { kpm: 460, bonus: 1.0 };   // 접속 중 보석 = 방치 비율(시간) + 일반몹 처치 보너스(실시간 1분 460마리 처치 시 방치 비율 ×bonus 추가) → 최고 스테이지 ×3배속에서 오프라인의 약 2배
  C.idleRate = function (maxStage) {
    const s = Math.max(1, maxStage);
    const perMin = 3.0 * C.OFFLINE_EFF;
    return { gold: C.stageGold(s) * perMin, crystal: C.stageCrystalRaw(s) * C.idleGemMult(s) * perMin * 0.32 };
  };

  // 조합
  C.FUSION_N = { 1: 5, 2: 3 };   // 조합 재료 수: ★1 5명 → ★2, ★2 3명 → ★3 (같은 속성)
  C.FUSION_USHARD = { 1: 10, 2: 50 };  // 조합에 드는 승급석(영혼의 제단·탑·레이드 재화). 돌파·초월에는 쓰지 않음
  C.FUSION_RATE = { 1: T.fr1 || 0.75, 2: T.fr2 || 1 };   // 2026-10-29 ★1→★2 50% → 75%(사용자 결정)   // 조합 성공 확률. 실패하면 재료 중 1명만 남는다(같은 등급 유지). 시즌 3: ★2→★3은 별의 인장 1개를 쓰는 대신 확정
  C.FUSION_SEAL = { 2: 1 };             // ★2→★3 조합에 드는 별의 인장(관문 보스·탑에서만 획득) — ★3 획득 수의 상한
  C.FUSION_STEP = +(T.fst) || 25;       // ★2→★3 승급석 비용: 그 속성에서 조합할 때마다 +25 (50, 75, 100 …)
  C.fusionUshard = function (star, n) { return (C.FUSION_USHARD[star] || 0) + (star === 2 ? C.FUSION_STEP * (n || 0) : 0); };
  C.fusionN = function (star) { return C.FUSION_N[star] || 0; };
  // 무한의 탑
  C.TOWER_G = 1.03;   // 층당 적 강화 (2026-10-24 6% → 3%, 사용자 결정: 1층부터 전부)
  C.TOWER_BOSS = { hp: +(T.tbh) || 60, atk: +(T.tba) || 0.25, mobHp: 0.6, mobAtk: +(T.tma) || 0.25 };   // 탑도 스테이지처럼 일반 몹은 약하게, 보스는 단단하게 + 격노(BOSS_ENRAGE) — 이전엔 몹 공격이 최고 스테이지의 3배·보스 체력 1/45라 양쪽 다 순삭 (2026-10-24)
  C.TOWER_EASE = { k: +(T.twk) || 0.02, n: +(T.twn) || 20 };   // 초반 층 완화(2026-11-15, 사용자 '탑 1층 보스 난이도가 이게 맞나'): 탑은 30스테이지에 열리는데 1층이 60스테이지 기준(보스 체력 1,558만 = 30스테이지 보스의 173배)이라 60~65스테이지 전에는 1층도 못 깼음(계정 8개 실측). 1층 ×k에서 n층 ×1까지 로그 직선 — n층부터는 예전과 같음
  C.towerEase = function (floor) { const e = C.TOWER_EASE; return floor < e.n ? Math.pow(e.k, (e.n - floor) / (e.n - 1)) : 1; };
  C.towerMult = function (floor) { return C.stageMult(60) / C.lvEnemy(60) * C.lvEnemy(floor) * Math.pow(C.TOWER_G, floor - 1) * C.towerEase(floor); };   // 레벨 보정은 층 번호 기준
  // 승급석은 속성별 5종(u_fire …): 그 속성 영웅 조합에만 쓴다
  C.U_KEYS = ['u_fire', 'u_water', 'u_wind', 'u_light', 'u_dark'];
  C.TOWER_SEAL = +(T.tse) || 200;   // 2026-11-17 300 → 200(사용자 '300층은 너무 높다' — 대신 소환 ★3 0.65 → 0.5%)   // 탑 이 층수마다 별의 인장 1개(첫 클리어). 10층마다 기믹 보스(C.gimOf)
  C.towerGoldStage = function (floor) { const n = C.TOWER_EASE.n, top = 60 + Math.floor(n / 2); return floor < n ? Math.round(30 + (top - 30) * (floor - 1) / (n - 1)) : 60 + Math.floor(floor / 2); };   // 골드 기준 스테이지: 완화한 층(1~n-1)은 난이도에 맞춰 30스테이지 → n층 기준까지 직선(안 그러면 30스테이지에 60스테이지분 골드가 한꺼번에 들어옴)
  C.towerReward = function (floor) { const r = { crystal: C.gem(100 + floor * 5), gold: C.stageGold(C.towerGoldStage(floor)) * 6, sshard: 3 + Math.floor(floor / 6) }; r['u_' + C.ELEMS[(floor - 1) % 5]] = 2 + Math.floor(floor / 10); if (floor % C.TOWER_SEAL === 0) r.seal = 1; return r; };   // 증가율을 절반(3%)으로 낮추면서 같은 난이도에 층 번호가 약 2배가 되므로 층당 보상 기울기도 절반   // 층마다 속성 순환
  C.towerParams = function (floor, slots) {
    const ch = (floor - 1) % 10; const m = C.towerMult(floor); const hue = C.CHAPTER_HUE[ch];
    const B = C.TOWER_BOSS || C.STAGE_BOSS;
    const mobs = C.CHAPTER_MOBS[ch].map(t => { const mm = C.makeMob(t, m, false); mm.hue = hue; mm.hp = Math.round(mm.hp * B.mobHp); mm.atk = Math.round(mm.atk * B.mobAtk); return mm; });
    const boss = C.makeMob(C.chapterBoss(ch, Math.floor((floor - 1) / 10)), m * 1.1, true, 60 + floor); boss.hue = hue; boss.hp = Math.round(boss.hp * B.hp); boss.atk = Math.round(boss.atk * B.atk);
    { const bs = C.bossStyle(1, floor * 1.4); boss.hp = Math.round(boss.hp * bs.hp); boss.atk = Math.round(boss.atk * bs.atk); boss.basic = bs.basic; boss.roar = bs.roar; }
    if (floor % 10 === 0) boss.gim = C.gimOf(floor / 10 - 1);   // 10층마다 기믹 보스(장벽 → 철갑 → 격분)
    return { mode: 'tower', stage: floor, mobs, boss, quota: 12, maxMobs: C.maxMobs(slots) + 1, autoBoss: true, chapter: ch, enrage: C.BOSS_ENRAGE };
  };
  // 레이드
})(typeof window !== 'undefined' ? window : globalThis);

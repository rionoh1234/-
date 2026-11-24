// 상수·수식 9: 영웅 레벨 (2026-10-30, 사용자 설계)
// 상한: ★1 30 · ★2 40 · ★3 50, 초월(돌파 6~10) 1단계마다 +10 → ★3 최대 100. 레벨당 공격력·체력·방어력 +3%(선형).
// 경험치: 출전 영웅이 몬스터 처치마다 + 방치(분당) + 경험치 물약(던전 '수련의 숲'). 레벨 공유: 보유 영웅 중 5번째로 높은 레벨을 모두가 공유(그 이상은 개별 육성).
(function (g) {
  const C = g.RPG.C;
  const T = g.TUNE || {};
  C.LV_CAP = { 1: 30, 2: 40, 3: 50 };
  C.LV_TR = 10;                         // 초월 1단계당 상한 +10
  C.LV_STEP = T.lvs != null && T.lvs !== '' && !isNaN(+T.lvs) ? +T.lvs : 0.03;
  C.LV_LB = 5;                          // 돌파 1단계당 상한 +5 (2026-10-31 사용자) — 돌파 5 = 75, 초월 5 = 125
  // 승급(시즌 3): 레벨 10단위 관문 — 그 영웅 속성의 승급석을 내고 다음 10레벨을 연다(공유 레벨도 자기 승급 단계까지만). ★1 2회·★2 3회·★3 4회
  C.ASC_STEP = 10; C.ASC_COST = (T.acs || '10,40,150,500').split(',').map(Number); C.ASC_MULT = +(T.acm) || 1;
  C.ascMax = function (star) { return C.LV_CAP[star] / C.ASC_STEP - 1; };
  C.ascCost = function (k) { return Math.max(1, Math.round((C.ASC_COST[k] || C.ASC_COST[C.ASC_COST.length - 1]) * C.ASC_MULT)); };   // 승급 k → k+1
  C.lvCap = function (star, lb, asc) { lb = lb || 0; const full = C.LV_CAP[star] + (star >= 3 ? C.LV_LB * Math.min(lb, 5) + C.LV_TR * Math.max(0, lb - 5) : 0); return asc != null && asc < C.ascMax(star) ? Math.min(full, C.ASC_STEP * (asc + 1)) : full; };
  C.lvMult = function (lv) { return 1 + C.LV_STEP * ((lv || 1) - 1); };
  C.LV_EXP_A = +(T.lva) || 80;   // 시뮬: 출전 영웅 Lv48~49 / 21일
  C.expNeed = function (lv) { return Math.round(C.LV_EXP_A * lv * lv); };   // lv → lv+1 필요 경험치
  C.KILL_EXP = +(T.kxp) || 1;           // 몬스터 1마리 처치당(출전 영웅 각자)
  C.IDLE_EXP = +(T.ixp) || 60;          // 방치 1분당(출전 영웅 각자)
  C.XPOT_EXP = 1000;                    // 경험치 물약 1개
  C.SYNC_N = 5;                         // 레벨 공유 기준: 5번째로 높은 레벨
})(typeof window !== 'undefined' ? window : globalThis);

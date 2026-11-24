// 상태 8: 전투 보상·방치 보상
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  // 전투 보상
  G.goldMult = function (s) { return Math.pow(1.04, Math.min(C.RELICS.hand.max || 1e9, G.relicLv(s, 'hand'))) * (1 + (G.eqBonus(s).gold || 0)); };
  // 2026-11-18 스테이지 ×10: 공식은 예전 단위, 보스 보상은 1/10(작은 값은 소수를 이월 — s._fr)
  G.frac = function (s, k, v) { s._fr = s._fr || {}; const t = (s._fr[k] || 0) + v; const n = Math.floor(t); s._fr[k] = t - n; return n; };
  G.applyKill = function (s, stage) { const gd = Math.round(C.killGold(C.sOld(stage)) * G.goldMult(s)); s.gold += gd; s.stats.kills++; if (G.partyExp && G.partyExp(s, C.KILL_EXP)) s._lvup = 1; return gd; };   // 출전 영웅 경험치(2026-10-30)
  // 빠른 진격: 다음 n스테이지를 직접 깬 것과 같은 보상으로 즉시 클리어(잡몹 KILL_QUOTA마리 골드·경험치·접속 보석 + 보스 골드·보석·첫 클리어·별의 파편 + 장비 드롭)
  G.rush = function (s, n, rng) {
    const t = { from: s.maxClear + 1, to: s.maxClear, gold: 0, crystal: 0, sshard: 0, drops: [], stone: 0 };
    for (let i = 0; i < n && s.maxClear < C.STAGE_MAX; i++) {
      const st = s.maxClear + 1;
      if (C.isGate && C.isGate(st)) break;   // 관문은 건너뛸 수 없음 — 직접 싸워야 함(시즌 3)
      for (let k = 0; k < C.RUSH_KILLS; k++) t.gold += G.applyKill(s, st);
      const g = G.frac(s, 'oc', C.idleRate(C.sOld(s.maxClear)).crystal * C.ONLINE_GEM.bonus / C.ONLINE_GEM.kpm * C.RUSH_KILLS); s.crystal += g; t.crystal += g;
      const r = G.applyBossClear(s, st); t.gold += r.gold; t.crystal += r.crystal; t.sshard += r.sshard || 0;
      const d = G.eqDrop(s, st, rng); if (d) { if (d.kept) t.drops.push(d); else t.stone += d.stone || 0; }
      t.to = st;
    }
    return t;
  };
  G.applyBossClear = function (s, stage) {
    const first = stage > s.maxClear, K = C.STAGE_DISP, so = C.sOld(stage), si = C.sOldI(stage);
    const r = { gold: Math.round(C.bossGold(so) * G.goldMult(s) / K), crystal: G.frac(s, 'bc', C.stageCrystalRaw(so) * C.GEM_MULT / K), first };
    if (first) { const b = C.firstClearBonus(si); r.gold += Math.round(b.gold / K); r.crystal += G.frac(s, 'fc', b.crystal / K); if (stage >= 100 * K && stage % (10 * K) === 0) { r.sshard = C.SSHARD_STAGE; s.sshard = (s.sshard || 0) + r.sshard; }
      if (C.isGate && C.isGate(stage) && stage % (C.GATE.seal || C.GATE.every) === 0) { r.seal = 1; s.seal = (s.seal || 0) + 1; } }   // 관문 첫 클리어: 별의 인장
    s.gold += r.gold; s.crystal += r.crystal; s.stats.clears++;
    if (stage > s.maxClear) s.maxClear = stage;
    return r;
  };

  // 방치 보상
  G.idleReward = function (s, now) {
    const mins = Math.min(C.OFFLINE_CAP_MIN, Math.max(0, (now - s.lastTs) / 60000));
    const rate = C.idleRate(C.sOld(Math.max(1, s.maxClear)));
    return { mins, gold: Math.floor(rate.gold * mins * G.goldMult(s)), crystal: Math.floor(rate.crystal * mins), exp: Math.floor(C.IDLE_EXP * mins) };
  };
  G.applyIdle = function (s, now) {
    const r = G.idleReward(s, now); s.gold += r.gold; s.crystal += r.crystal; if (G.partyExp && r.exp) r.lv = G.partyExp(s, r.exp); s.lastTs = now; return r;
  };

  G.weekKey = function (now) { return Math.floor((now + 4 * 86400000) / (7 * 86400000)); };
})(typeof window !== 'undefined' ? window : globalThis);

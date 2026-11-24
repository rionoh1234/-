// 상태 11: 일일 임무·업적. s.daily = { day, c: {id: 횟수}, got: {id: 1}, bonus: 0|1 }, s.ach = { id: 받은 단계 수 }
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  G.dailyEnsure = function (s, now) {
    const day = G.dayKey(now || Date.now());
    if (!s.daily || s.daily.day !== day) s.daily = { day, c: {}, got: {}, bonus: 0 };
    if (!s.ach) s.ach = {};
    return s.daily;
  };
  G.mark = function (s, key, n) { if (!s || !n) return; const d = G.dailyEnsure(s); d.c[key] = (d.c[key] || 0) + n; };
  // 기존 동작은 그대로 두고 결과만 세는 감싸기 — 이 파일만 고치면 집계가 바뀜
  const wrap = (name, key, count) => { const f = G[name]; if (!f) return; G[name] = function () { const r = f.apply(this, arguments); const n = count(r, arguments); if (n) G.mark(arguments[0], key, n); return r; }; };
  wrap('applyBossClear', 'boss', () => 1);
  wrap('applyKill', 'kill', () => 1);
  wrap('sweep', 'dg', (r) => (r ? 1 : 0));
  wrap('sweepRaid', 'dg', (r) => (r ? 1 : 0));
  wrap('applyDungeonClear', 'dg', () => 1);
  wrap('pull', 'pull', (r, a) => (r ? a[1] : 0));
  wrap('eqPull', 'eqpull', (r, a) => (r ? a[1] : 0));
  wrap('upgrade', 'up', (r) => r || 0);

  G.dailyList = function (s) { const d = G.dailyEnsure(s); return C.DAILY.map(m => ({ m, v: Math.min(m.n, d.c[m.id] || 0), done: (d.c[m.id] || 0) >= m.n, got: !!d.got[m.id] })); };
  G.dailyClaim = function (s, id) { const d = G.dailyEnsure(s); const m = C.DAILY.find(x => x.id === id); if (!m || d.got[id] || (d.c[id] || 0) < m.n) return 0; d.got[id] = 1; s.crystal += C.DAILY_GEM; return C.DAILY_GEM; };
  G.dailyBonusReady = function (s) { const d = G.dailyEnsure(s); return !d.bonus && C.DAILY.every(m => d.got[m.id]); };
  G.dailyBonusClaim = function (s) { if (!G.dailyBonusReady(s)) return 0; s.daily.bonus = 1; s.crystal += C.DAILY_BONUS; return C.DAILY_BONUS; };

  const achVal = {
    stage: (s) => s.maxClear || 0,
    tower: (s) => (s.tower && s.tower.floor) || 0,
    myth: (s) => Object.keys((s.eq && s.eq.mdex) || {}).length,
    star3: (s) => Object.keys(s.heroes || {}).filter(id => { const c = (g.CHARS || []).find(x => x.id === +id); return c && c.star === 3; }).length,
    pulls: (s) => s.pulls || 0,
    eqpulls: (s) => (s.eq && s.eq.pulls) || 0,
    kills: (s) => (s.stats && s.stats.kills) || 0,
  };
  G.achList = function (s) {
    G.dailyEnsure(s);
    return C.ACH.map(a => { const got = s.ach[a.id] || 0, v = achVal[a.id](s), next = a.t[got]; return { a, v, got, next, ready: next != null && v >= next, max: next == null }; });
  };
  G.achClaim = function (s, id) { const x = G.achList(s).find(y => y.a.id === id); if (!x || !x.ready) return 0; s.ach[id] = x.got + 1; s.crystal += C.ACH_GEM; return C.ACH_GEM; };
  G.questReady = function (s) { return G.dailyList(s).filter(x => x.done && !x.got).length + (G.dailyBonusReady(s) ? 1 : 0) + G.achList(s).filter(x => x.ready).length; };
  G.questClaimAll = function (s) {
    let gem = 0; for (const m of C.DAILY) gem += G.dailyClaim(s, m.id); gem += G.dailyBonusClaim(s);
    let k; do { k = 0; for (const a of C.ACH) { const r = G.achClaim(s, a.id); gem += r; k += r; } } while (k);
    return gem;
  };
})(typeof window !== 'undefined' ? window : globalThis);

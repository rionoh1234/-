// 상태 9: 던전 티켓 리필·소탕·레이드·직렬화
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  // ---------- 티켓 (시간 리필) ----------
  G.ensureTickets = function (s, now) {
    if (!s.dg) s.dg = {};
    for (const k of C.DG_KINDS) if (!s.dg[k]) s.dg[k] = { lv: 0, t: C.TICKET_MAX, ts: now };
    if (s.dg.elem) delete s.dg.elem;   // 단일 '속성의 시련'은 속성별 5종으로 교체   // 새 던전(장비)도 기존 세이브에 추가
    if (!s.gift1) { for (const k of ['crys', 'soul', 'equip']) if (s.dg[k]) s.dg[k].t = Math.min(C.TICKET_MAX, s.dg[k].t + 1); s.gift1 = 1; }   // 2026-10-22 이용권 1장씩 지급(1회)
    G.ensureEq(s); G.ensureEx(s); G.ensureUsh(s);
    if (s.raid.t == null) { s.raid.t = Math.max(0, C.TICKET_MAX - (s.raid.tries || 0)); s.raid.ts = now; }
  };
  G.refillOne = function (tk, now, interval) {
    if (tk.t >= C.TICKET_MAX) { tk.ts = now; return; }
    const n = Math.floor((now - tk.ts) / interval);
    if (n > 0) { tk.t = Math.min(C.TICKET_MAX, tk.t + n); tk.ts = tk.t >= C.TICKET_MAX ? now : tk.ts + n * interval; }
  };
  G.refill = function (s, now) {
    G.ensureTickets(s, now);
    for (const k of C.DG_KINDS) G.refillOne(s.dg[k], now, C.TICKET_REFILL_MS);
    G.refillOne(s.raid, now, C.RAID_REFILL_MS);
    const wk = G.weekKey(now); if (s.raid.week !== wk) { s.raid.week = wk; s.raid.best = 0; }
  };
  G.nextRefillMs = function (tk, now, interval) { return tk.t >= C.TICKET_MAX ? 0 : Math.max(0, tk.ts + interval - now); };
  G.useTicket = function (tk, now) { if (tk.t <= 0) return false; if (tk.t >= C.TICKET_MAX) tk.ts = now || Date.now(); tk.t--; return true; };
  G.refundTicket = function (tk) { tk.t = Math.min(C.TICKET_MAX, tk.t + 1); };
  G.dgUnlocked = function (s) { return s.maxClear >= C.DG_UNLOCK; };
  // 소탕: 최고 클리어 레벨 보상을 즉시 지급
  G.sweep = function (s, kind, now) {
    const d = s.dg[kind]; if (d.lv < 1 || d.t < 1) return null;
    G.useTicket(d, now); const r = C.dungeonReward(kind, d.lv); if (r.gold) r.gold = Math.round(r.gold * G.goldMult(s));
    s.gold += r.gold || 0; s.crystal += r.crystal || 0; G.giveUsh(s, r); s.estone = (s.estone || 0) + (r.estone || 0); s.xstone = (s.xstone || 0) + (r.xstone || 0); s.xpot = (s.xpot || 0) + (r.xpot || 0); return r;
  };
  G.sweepRaid = function (s, now) {
    if (s.raid.t < 1 || !s.raid.best) return null;
    G.useTicket(s.raid, now); const boss = C.raidBoss(s.raid.week || 0, C.sOld(s.maxClear)); const r = C.raidReward(s.raid.best, boss.hp, boss.elem);
    s.crystal += r.crystal; G.giveUsh(s, r); s.sshard = (s.sshard || 0) + (r.sshard || 0); return r;
  };
  G.sweepAll = function (s, now) {
    const tot = { gold: 0, crystal: 0, sshard: 0, estone: 0, xstone: 0, n: 0 }; const addU = (r) => { for (const k of C.U_KEYS) if (r[k]) tot[k] = (tot[k] || 0) + r[k]; };
    for (const k of C.DG_KINDS) { let r; while ((r = G.sweep(s, k, now))) { tot.gold += r.gold || 0; tot.crystal += r.crystal || 0; addU(r); tot.estone += r.estone || 0; tot.xstone += r.xstone || 0; tot.xpot = (tot.xpot || 0) + (r.xpot || 0); tot.n++; } }
    let r; while ((r = G.sweepRaid(s, now))) { tot.crystal += r.crystal; addU(r); tot.sshard += r.sshard || 0; tot.n++; }
    return tot;
  };
  G.sweepable = function (s) { let n = 0; for (const k of C.DG_KINDS) if (s.dg[k].lv >= 1) n += s.dg[k].t; if (s.raid.best) n += s.raid.t; return n; };
  G.ticketsTotal = function (s) { let n = 0; for (const k of C.DG_KINDS) n += s.dg[k].t; return n + s.raid.t; };
  G.applyDungeonClear = function (s, kind, lv) {
    const d = s.dg[kind]; const first = lv > d.lv; if (first) d.lv = lv;
    const r = C.dungeonReward(kind, lv); for (const k in r) if (typeof r[k] === 'number') r[k] = k === 'gold' ? r[k] * C.DG_CLIMB : Math.round(r[k] * C.DG_CLIMB); if (first) r.sshard = C.SSHARD_DG(lv); s.gold += Math.round((r.gold || 0) * G.goldMult(s)); s.crystal += r.crystal || 0; G.giveUsh(s, r); s.sshard = (s.sshard || 0) + (r.sshard || 0); s.estone = (s.estone || 0) + (r.estone || 0); s.xstone = (s.xstone || 0) + (r.xstone || 0); s.xpot = (s.xpot || 0) + (r.xpot || 0); return r;
  };
  G.dayKey = function (now) { const d = new Date(now); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  G.raidCheck = function (s, now) { G.refill(s, now); };

  G.serialize = (s) => JSON.stringify(s);
  G.deserialize = (str) => { const s = JSON.parse(str); if (!s || !s.heroes || !s.party) throw new Error('bad save'); G.stageMigrate(s); return s; };
  // 2026-11-18 스테이지 ×10: 예전 저장의 스테이지를 새 단위로(330 → 3300). s.stV = 2면 새 단위
  G.stageMigrate = function (s) { if (s.stV >= 2) return s; const K = C.STAGE_DISP || 10, om = s.maxClear || 0; s.maxClear = om * K; s.stage = (s.stage || 1) > om ? s.maxClear + 1 : Math.max(1, (s.stage || 1) * K); s.stV = 2; return s; };
})(typeof window !== 'undefined' ? window : globalThis);

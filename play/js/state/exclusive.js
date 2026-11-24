// 상태 3: 전용장비
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  // ---------- 전용장비 (★3 전용 슬롯 1칸, 영혼석 소환) ----------
  // s.ex = { items: [{ id, h, g, o: [[key, tier, value]], L: 'a'|'b' }], on: { heroId: itemId }, pulls, seq, salv }
  G.ensureEx = function (s) {
    if (!s.ex) s.ex = { items: [], on: {}, pulls: 0, seq: 1, salv: 0 };
    if (s.xstone == null) s.xstone = 0;
    if (s.ex.up) { let r = 0; for (const h in s.ex.up) for (let l = 0; l < s.ex.up[h]; l++) r += C.exUpCost(l); s.xstone += r; delete s.ex.up; }   // 2026-11-01 전용장비 강화 폐지 → 쓴 영혼석 환급
    if (!s.ex.capV) { for (const it of s.ex.items) { const c = byId(it.h); if (c) G.capFix(it, C.EX_ROLE[c.role].pool, C.EX_OPT_MULT, null); } s.ex.capV = 1; }   // 2026-10-25 상한 옵션 삭제 이전
    return s.ex;
  };
  G.exOk = function (id) { const c = byId(id); return !!c && c.star === 3; };
  G.exMake = function (s, hid, grade, rng) {
    const ex = G.ensureEx(s); const role = byId(hid).role; const R = C.EX_ROLE[role];
    const roll = (k) => { const t = Math.floor(rng() * 5); return [k, t, Math.round(C.EQ_OPTS[k].base * C.EQ_TIER_MULT[t] * (0.9 + rng() * 0.2) * C.EX_OPT_MULT * 10000) / 10000]; };
    const keys = R.pool.slice(); const o = []; const n = grade >= 4 ? 4 : grade + 1;
    for (let i = 0; i < n && keys.length; i++) o.push(roll(keys.splice(Math.floor(rng() * keys.length), 1)[0]));
    const it = { id: ex.seq++, h: hid, g: grade, o };
    if (grade >= 4) it.L = rng() < 0.5 ? 'a' : 'b';
    return it;
  };
  G.exLeg = function (it) { return it && it.L ? (((g.EXCLUSIVE || {})[it.h] || {})[it.L] || null) : null; };
  G.exName = function (it) { const L = G.exLeg(it); return L ? L.name : C.EQ_GRADES[it.g] + ' 전용'; };
  G.exLbMult = function (it) { return it && it.L ? 1 + C.EX_LB.step * (it.lb || 0) : 1; };
  G.exMain = function (it) { const R = C.EX_ROLE[byId(it.h).role]; return { k: R.main, v: R.mainV[it.g] * G.exLbMult(it) }; };
  G.exScore = function (s, it) {
    if (!it) return 0; const R = C.EX_ROLE[byId(it.h).role]; const lm = G.exLbMult(it); let v = R.mainV[it.g] * lm / R.mainV[0];
    for (const [k, , val] of it.o) v += val * lm / (C.EQ_OPTS[k].base * C.EX_OPT_MULT);
    return v + (it.L ? 8 : 0);
  };
  G.exItem = function (s, id) { return id ? G.ensureEx(s).items.find(x => x.id === id) || null : null; };
  G.exOn = function (s, hid) { return G.exItem(s, G.ensureEx(s).on[hid]); };
  G.exIsOn = function (s, it) { return G.ensureEx(s).on[it.h] === it.id; };
  G.exBetter = function (s, it) { return !G.exIsOn(s, it) && G.exScore(s, it) > G.exScore(s, G.exOn(s, it.h)) + 1e-9; };
  G.exEquip = function (s, id) { const it = G.exItem(s, id); if (!it) return false; s.ex.on[it.h] = it.id; return true; };
  G.exSalvage = function (s, it) { const ex = G.ensureEx(s); if (G.exIsOn(s, it) || it.lk) return 0; ex.items = ex.items.filter(x => x !== it); const v = C.EX_SALVAGE[it.g]; s.xstone += v; return v; };
  G.exAdd = function (s, it) {
    const ex = G.ensureEx(s);
    if (!ex.on[it.h]) { ex.items.push(it); ex.on[it.h] = it.id; return { it, kept: true, equipped: true }; }
    const better = G.exScore(s, it) > G.exScore(s, G.exOn(s, it.h));
    if (it.g < 4 && it.g <= ex.salv && !better) { const v = C.EX_SALVAGE[it.g]; s.xstone += v; return { it, kept: false, stone: v }; }
    ex.items.push(it);
    if (ex.items.length > 200) { const worst = ex.items.filter(x => !G.exIsOn(s, x) && x.g < 4 && !x.lk).sort((a, b) => G.exScore(s, a) - G.exScore(s, b))[0]; if (worst) { const v = G.exSalvage(s, worst); if (worst === it) return { it, kept: false, stone: v }; } }
    return { it, kept: true, better };
  };
  G.exSummonLv = function (s) { return C.exSummonLv(G.ensureEx(s).pulls); };
  G.exPull = function (s, n, rng) { // 장비 소환처럼 무작위: 보유한 ★3 영웅 중 한 명의 전용장비가 나온다
    rng = rng || Math.random; const ex = G.ensureEx(s); const pool = Object.keys(s.heroes).map(Number).filter(G.exOk); if (!pool.length) return null;
    const cost = C.EX_COST * n; if ((s.xstone || 0) < cost) return null;
    s.xstone -= cost; const res = [];
    for (let i = 0; i < n; i++) { const lv = C.exSummonLv(ex.pulls); ex.pulls++; const hid = pool[Math.floor(rng() * pool.length)]; res.push(G.exAdd(s, G.exMake(s, hid, pickW(C.EX_RATE[lv - 1], rng), rng))); }
    return res;
  };
  G.exSalvageWorse = function (s, hid) { const ex = G.ensureEx(s); let n = 0, stone = 0; for (const it of ex.items.slice()) if ((!hid || it.h === hid) && !G.exIsOn(s, it) && it.g < 4 && !it.lk && G.exScore(s, it) <= G.exScore(s, G.exOn(s, it.h))) { stone += G.exSalvage(s, it); n++; } return { n, stone }; };
  G.exWorseCount = function (s) { const ex = G.ensureEx(s); let n = 0; for (const it of ex.items) if (!G.exIsOn(s, it) && it.g < 4 && !it.lk && G.exScore(s, it) <= G.exScore(s, G.exOn(s, it.h))) n++; return n; };
  G.exAutoEquip = function (s, hid) { const ex = G.ensureEx(s); let best = G.exOn(s, hid), bs = G.exScore(s, best); for (const it of ex.items) if (it.h === hid && G.exScore(s, it) > bs + 1e-9) { best = it; bs = G.exScore(s, it); } if (best && ex.on[hid] !== best.id) { ex.on[hid] = best.id; return true; } return false; };
  // 전용 레전드 돌파·중복 정리
  G.exLbMats = function (s, it) { const ex = G.ensureEx(s); return ex.items.filter(x => x !== it && x.h === it.h && x.L === it.L && x.g === 4 && !G.exIsOn(s, x) && !x.lk).sort((a, b) => (a.lb || 0) - (b.lb || 0) || G.exScore(s, a) - G.exScore(s, b)); };
  G.exLbCost = function (it) { return C.EX_LB.cost[Math.min(it.lb || 0, C.EX_LB.cost.length - 1)]; };
  G.exLb = function (s, it) {
    if (!it || !it.L) return { err: '전용 레전드가 아닙니다' }; if ((it.lb || 0) >= C.EX_LB.max) return { err: '최대 돌파입니다' };
    const mat = G.exLbMats(s, it)[0]; if (!mat) return { err: '같은 전용장비가 부족합니다' };
    const cost = G.exLbCost(it); if ((s.xstone || 0) < cost) return { err: '영혼석이 부족합니다' };
    const ex = G.ensureEx(s); ex.items = ex.items.filter(x => x !== mat); s.xstone -= cost; it.lb = (it.lb || 0) + 1; return { ok: true, lb: it.lb, cost };
  };
  // 종류(영웅·a/b)마다 본체(장착 중 > 돌파 높은 것 > 점수) 하나를 최대 돌파까지 올리고, 남는 중복은 분해
  G.exTidy = function (s) {
    const ex = G.ensureEx(s); const groups = {}; let lb = 0, n = 0, stone = 0;
    for (const it of ex.items) if (it.L && it.g === 4) (groups[it.h + it.L] = groups[it.h + it.L] || []).push(it);
    for (const l of Object.values(groups)) {
      if (l.length < 2) continue;
      const base = l.slice().sort((a, b) => (G.exIsOn(s, b) - G.exIsOn(s, a)) || ((b.lb || 0) - (a.lb || 0)) || (G.exScore(s, b) - G.exScore(s, a)))[0];
      while ((base.lb || 0) < C.EX_LB.max && G.exLbMats(s, base).length && (s.xstone || 0) >= G.exLbCost(base)) { G.exLb(s, base); lb++; }
      if ((base.lb || 0) >= C.EX_LB.max) for (const x of G.exLbMats(s, base)) { const v = G.exSalvage(s, x); if (v) { n++; stone += v; } }   // 영혼석이 모자라 돌파를 못 한 재료는 남겨 둠
    }
    return { lb, n, stone };
  };
  G.exDupCount = function (s) { const ex = G.ensureEx(s); const g = {}; for (const it of ex.items) if (it.L && it.g === 4) { const k = it.h + it.L, o = g[k] = g[k] || { m: 0, fix: 0 }; if (it.lk || G.exIsOn(s, it)) o.fix = 1; else o.m++; } let d = 0; for (const o of Object.values(g)) d += Math.max(0, o.m - (o.fix ? 0 : 1)); return d; };
  G.exBonus = function (s, hid) { // 그 영웅에게만 붙는 효과
    const it = s.ex ? G.exOn(s, hid) : null; const b = {}; if (!it) return b;
    const m = G.exMain(it); const lm = G.exLbMult(it); b[m.k] = (b[m.k] || 0) + m.v; for (const [k, , v] of it.o) b[k] = (b[k] || 0) + v * lm; return b;
  };
  G.applyMod = function (sk, L) {
    const mod = L.mod || {};
    for (const k in (mod.mul || {})) if (typeof sk[k] === 'number') sk[k] = Math.round(sk[k] * mod.mul[k] * 1000) / 1000;
    for (const k in (mod.add || {})) sk[k] = (sk[k] || 0) + mod.add[k];
    Object.assign(sk, mod.set || {}); sk.exName = L.name; sk.exDesc = L.desc; return sk;
  };

})(typeof window !== 'undefined' ? window : globalThis);

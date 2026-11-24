// 상태 1: 새 게임·영웅 보유·승급석·인연·공명·유물 배율 (G 객체 생성)
(function (g) {
  const C = g.RPG.C;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);

  const G = {};

  G.newState = function (now) {
    const s = {
      v: 3, gold: 300, crystal: 300, ushard: 0, sshard: 0, relics: {},
      heroes: {}, party: [], stage: 1, maxClear: 0, autoBoss: true, speed: 1,
      up: { atk: 0, hp: 0, def: 0, crit: 0, cdmg: 0, aspd: 0 },
      pity: 0, pulls: 0, tower: { floor: 0 }, raid: { day: '', tries: 0, best: 0, total: 0 },
      lastTs: now || Date.now(), created: now || Date.now(), stats: { clears: 0, fusions: 0, kills: 0 },
      seen: {}, estone: 0, xstone: 0, season: C.SEASON, seal: 0, wish: 0, fz: {}, stV: 2,   // seal = 별의 인장, wish = 지정 소환 대상(★3 id), fz = 속성별 ★3 조합 횟수
    };
    G.ensureEq(s); G.ensureUsh(s);
    G.addHero(s, 1);
    s.party = [1];
    return s;
  };

  // 속성별 승급석: s.ush = { fire, water, wind, light, dark }. 이전 공용 승급석(ushard)은 5속성에 똑같이 나눠 옮긴다
  G.ensureUsh = function (s) {
    if (!s.ush) { const n = s.ushard || 0, per = Math.floor(n / 5); s.ush = {}; C.ELEMS.forEach((e, i) => { s.ush[e] = per + (i < n - per * 5 ? 1 : 0); }); s.ushard = 0; }
    return s.ush;
  };
  G.ushOf = function (s, e) { return G.ensureUsh(s)[e] || 0; };
  G.ushTotal = function (s) { const u = G.ensureUsh(s); return C.ELEMS.reduce((a, e) => a + (u[e] || 0), 0); };
  G.giveUsh = function (s, r) { const u = G.ensureUsh(s); for (const e of C.ELEMS) if (r['u_' + e]) u[e] += r['u_' + e]; };
  G.addHero = function (s, id) {
    s.seen[id] = 1;
    if (s.heroes[id]) { const st = byId(id).star; if (st >= C.LB_STAR_MIN) s.heroes[id].shards += C.DUPE_SHARDS[st]; else { G.ensureUsh(s)[byId(id).elem] += (C.DUPE_USHARD[st] || 0); s.pity = (s.pity || 0) + ((C.DUPE_PITY && C.DUPE_PITY[st]) || 0); } return false; }
    s.heroes[id] = { lb: 0, shards: 0, slv: 1 };
    return true;
  };
  G.dexIds = function (s) { const o = {}; for (const id in (s.seen || {})) o[id] = 1; for (const id in s.heroes) o[id] = 1; return Object.keys(o).map(Number).filter(id => byId(id)); };
  G.ownedCounts = function (s) {
    const n = { 1: 0, 2: 0, 3: 0 };
    for (const id of G.dexIds(s)) n[byId(id).star]++;   // 도감 = 한 번이라도 얻은 영웅(조합 재료로 써도 유지, 2026-10-30)
    return n;
  };
  G.codex = function (s) { const n = G.ownedCounts(s); return C.codexBonus(n[1], n[2], n[3]); };   // 도감(영웅 수) — 전 능력치 배율
  // 도감 인연(2026-11-15): 구성원을 한 번이라도 모두 얻으면 완성 → 그 인연의 능력치(eff)가 원정대 전원에게 영구 적용(출전과 무관). 예전의 출전 인연·속성 공명은 삭제
  G.setHave = function (s, set) { return set.members.filter(id => s.heroes[id] || (s.seen || {})[id]).length; };
  G.setOwned = G.setHave;
  G.setActive = function (s, set) { return G.setHave(s, set) === set.members.length; };
  G.setBonus = function (s) { const b = {}; for (const set of (g.SETS || [])) if (G.setActive(s, set)) { const e = C.bondEff(set.eff); for (const k in e) b[k] = (b[k] || 0) + e[k]; } return b; };
  G.heroBonus = function (s) { return G.setBonus(s); };   // 모든 영웅 공통(매번 새 객체)
  // 유물 보너스
  G.relicLv = function (s, k) { return (s.relics && s.relics[k]) || 0; };
  G.relicMult = function (s) { return { atk: Math.pow(1.03, G.relicLv(s, 'crown')), hp: Math.pow(1.03, G.relicLv(s, 'aegis')) }; };
  G.relicCost = function (s, k) { const r = C.RELICS[k]; const lv = G.relicLv(s, k); return r.max && lv >= r.max ? null : C.relicCost(k, lv); };
  G.relicUp = function (s, k) { const c = G.relicCost(s, k); if (c == null || (s.sshard || 0) < c) return false; s.sshard -= c; s.relics = s.relics || {}; s.relics[k] = G.relicLv(s, k) + 1; return true; };
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  g.RPG.G = G;
})(typeof window !== 'undefined' ? window : globalThis);

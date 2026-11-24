// 상태 5: 골드 스탯 강화·스킬 강화·돌파
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  // 골드 스탯 강화
  G.upCost = function (s, key, times) {
    let cost = 0, n = 0, lv = s.up[key] || 0; const max = C.UP[key].max;
    while (n < times && (!max || lv * C.UP[key].step < max)) { cost += C.upCost(key, lv); lv++; n++; }
    return { cost, n };
  };
  G.upgrade = function (s, key, times) {
    let done = 0; const max = C.UP[key].max;
    while (done < times) {
      const lv = s.up[key] || 0; if (max && lv * C.UP[key].step >= max) break;
      const c = C.upCost(key, lv); if (s.gold < c) break; s.gold -= c; s.up[key] = lv + 1; done++;
    }
    return done;
  };
  G.skillUpCost = function (s, id) { const h = s.heroes[id]; return (h.slv || 1) >= C.skillLvMax(h.lb) ? null : C.skillLvCost(h.slv || 1, byId(id).star); };
  G.skillUp = function (s, id) {
    const h = s.heroes[id]; const c = G.skillUpCost(s, id); if (c == null || s.gold < c) return false;
    s.gold -= c; h.slv = (h.slv || 1) + 1; return true;
  };
  G.lbCost = function (s, id) { const h = s.heroes[id]; const ch = byId(id); if (ch.star < C.LB_STAR_MIN) return null; return h.lb >= C.LB_MAX ? null : C.LB_COST[ch.star][h.lb]; };
  G.canLB = function (s, id) { const h = s.heroes[id]; if (!h) return false; const need = G.lbCost(s, id); return need != null && h.shards >= need; };
  G.limitBreak = function (s, id) { // 돌파·초월은 그 영웅의 조각(중복 획득)만 사용
    const h = s.heroes[id]; const need = G.lbCost(s, id); if (need == null) return false;
    if (h.shards < need) return false;
    h.shards -= need; h.lb++; return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);

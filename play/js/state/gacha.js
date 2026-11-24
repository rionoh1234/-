// 상태 6: 픽업·영웅 소환
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  // 픽업: 일러스트가 있는 ★3 중 하루 한 명씩 로테이션
  G.pickupList = function () { const IL = (typeof window !== 'undefined' ? window : globalThis).ILLUST || {}; return Object.keys(IL).map(Number).filter(id => { const c = byId(id); return c && c.star === 3; }).sort((a, b) => a - b); };
  G.pickup = function (now) { const l = G.pickupList(); if (!l.length) return null; const i = Math.floor((now || Date.now()) / C.PICKUP_MS) % l.length; return { id: l[i], until: (Math.floor((now || Date.now()) / C.PICKUP_MS) + 1) * C.PICKUP_MS }; };
  G.setWish = function (s, id) { const c = byId(id); if (!c || c.star !== 3) return false; s.wish = id; return true; };
  // 소환
  G.pull = function (s, n, rng, elem, now) {
    rng = rng || Math.random;
    const cost = (elem ? C.GACHA_COST_ELEM : C.GACHA_COST) * n; if (s.crystal < cost) return null;
    s.crystal -= cost; const res = [];
    for (let i = 0; i < n; i++) {
      s.pulls++; s.pity++;
      let star; const r = rng();
      const RT = C.gachaRate(s.pulls - 1);   // 소환 레벨별 확률
      let wished = null;   // 지정 소환(시즌 3): 게이지가 차면 지정한 ★3 확정(지정 안 했으면 무작위 ★3). 대박 ★3은 게이지를 초기화하지 않음
      if (s.pity >= C.PITY) { star = 3; s.pity -= C.PITY; const w = s.wish && byId(s.wish); if (w && w.star === 3) wished = w; }
      else if (r < RT[3]) star = 3; else if (r < RT[3] + RT[2]) star = 2; else star = 1;
      const pool = CH().filter(c => c.star === star && (!elem || c.elem === elem));
      const pk = star === 3 ? G.pickup(now) : null; const pid = pk && pool.some(c => c.id === pk.id) ? pk.id : null;
      let ch;
      if (wished) ch = wished;
      else if (pid) { const w = pool.map(c => c.id === pid ? C.PICKUP_MULT : 1); let r2 = rng() * w.reduce((a, b) => a + b, 0); ch = pool[pool.length - 1]; for (let i = 0; i < pool.length; i++) { r2 -= w[i]; if (r2 <= 0) { ch = pool[i]; break; } } }
      else ch = pool[Math.floor(rng() * pool.length)];
      const isNew = G.addHero(s, ch.id);
      res.push({ id: ch.id, star, isNew, wish: !!wished });
    }
    return res;
  };
})(typeof window !== 'undefined' ? window : globalThis);

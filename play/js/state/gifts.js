// 상태 10: 운영 보상(계정 지정 1회 지급). 지급 기록은 s.gifts[id] = 1 — 같은 보상은 두 번 들어오지 않음.
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  // acct: 받을 계정 아이디(없으면 전원) · eq: 장비 [p, g, u, o(옵션 [키, 등급, 수치]), lb?]
  G.GIFTS = [
    { id: '20261025_fire_myth_arm', acct: 'knight082', name: '화염 갑옷 누락 보상', eq: ['arm', 5, 34, [['atk', 5, 1.59], ['hp', 5, 2.4], ['cdmg', 5, 0.6], ['ls', 4, 0.03], ['def', 4, 0.36], ['boss', 4, 0.30]]] },   // 2026-11-15: 화염 영웅 공격력 줄 → 공격력(속성 옵션 삭제)
    // 2026-10-25: 염룡의 비늘 갑주가 옛 캐시 때문에 안 나오던 동안 대신 쌓인 속성 갑옷 레전드 2개씩(빛·질풍·서리·어둠, 장착·잠금 제외 점수 낮은 것부터) → 같은 수의 염룡의 비늘 갑주 레전드로 교환
    { id: '20261030_idle_bug', acct: 'knight082', name: '오프라인 보상 누락 보상 (10시간)', gold: 151000000, crystal: 1670 },   // 2026-10-30: 부팅 순서 버그로 받지 못한 10시간분(109스테이지 기준)
    { id: '20261025_fire_arm_swap', acct: 'knight082', name: '염룡의 비늘 갑주 교환', swap: { remove: [[17, 2], [19, 2], [32, 2], [20, 2]], add: 34 } },
  ];
  G.applyGifts = function (s, acctId) {
    s.gifts = s.gifts || {}; const got = [];
    for (const gf of G.GIFTS) {
      if (s.gifts[gf.id] || (gf.acct && gf.acct !== acctId)) continue;
      s.gifts[gf.id] = 1; const r = { gift: gf };
      if (gf.eq) { const eq = G.ensureEq(s); const [p, gr, u, o, lb] = gf.eq; const it = { id: eq.seq++, p, g: gr, b: 0, u, o: o.map(x => x.slice()) }; if (gr === 5) { it.mv = 2; if (lb) it.lb = lb; eq.mdex = eq.mdex || {}; eq.mdex[u] = 1; } eq.dex[u] = 1; eq.items.push(it); it.lk = 1; r.item = it; }
      if (gf.swap) { const eq = G.ensureEq(s); let n = 0; r.removed = [];
        for (const [u, k] of gf.swap.remove) { const cand = eq.items.filter(x => x.u === u && x.g === 4 && !x.lk && !G.eqIsOn(s, x)).sort((a, b) => G.eqScore(s, a) - G.eqScore(s, b)).slice(0, k);
          eq.items = eq.items.filter(x => !cand.includes(x)); n += cand.length; if (cand.length) r.removed.push([G.eqUnique(u).name, cand.length]); }
        r.items = []; for (let i = 0; i < n; i++) { const it = G.eqMakeU(s, gf.swap.add, Math.random); eq.items.push(it); r.items.push(it); } }
      if (gf.crystal) s.crystal += gf.crystal;
      if (gf.gold) s.gold += gf.gold;
      got.push(r);
    }
    return got;
  };
})(typeof window !== 'undefined' ? window : globalThis);

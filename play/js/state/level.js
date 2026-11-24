// 상태 12: 영웅 레벨·경험치·레벨 공유 (2026-10-30). h.lv = 개별 레벨, h.exp = 다음 레벨까지 쌓인 경험치. 실제 레벨 = min(상한, max(개별, 공유))
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const byId = (id) => g.CHARS.find(c => c.id === id);
  G.lvCapOf = function (s, id) { const h = s.heroes[id]; return C.lvCap(byId(id).star, h ? h.lb : 0, h ? h.asc || 0 : 0); };
  // 승급: 레벨이 승급 상한(10·20·30·40)에 닿으면 그 속성 승급석으로 다음 10레벨을 연다
  G.ascLv = function (s, id) { const h = s.heroes[id]; return h ? h.asc || 0 : 0; };
  G.ascInfo = function (s, id) {   // 승급할 수 있는 상태면 { cost, elem, have }, 아니면 null
    const h = s.heroes[id], ch = byId(id); if (!h || !ch) return null; const a = h.asc || 0;
    if (a >= C.ascMax(ch.star) || G.heroLv(s, id) < C.ASC_STEP * (a + 1)) return null;
    return { cost: C.ascCost(a), elem: ch.elem, have: G.ushOf(s, ch.elem) };
  };
  G.ascend = function (s, id) { const i = G.ascInfo(s, id); if (!i || i.have < i.cost) return false; G.ensureUsh(s)[i.elem] -= i.cost; s.heroes[id].asc = (s.heroes[id].asc || 0) + 1; return true; };
  G.lvOwn = function (s, id) { const h = s.heroes[id]; return Math.min((h && h.lv) || 1, G.lvCapOf(s, id)); };
  G.syncLv = function (s) {
    const L = Object.keys(s.heroes).map(id => G.lvOwn(s, +id)).sort((a, b) => b - a);
    return L.length >= C.SYNC_N ? L[C.SYNC_N - 1] : 1;
  };
  G.heroLv = function (s, id, sync) { if (!s.heroes[id]) return 1; return Math.min(G.lvCapOf(s, id), Math.max(G.lvOwn(s, id), sync == null ? G.syncLv(s) : sync)); };
  G.isSynced = function (s, id, sync) { sync = sync == null ? G.syncLv(s) : sync; return G.lvOwn(s, id) < sync && G.heroLv(s, id, sync) > G.lvOwn(s, id); };
  // 경험치 주기: 공유 레벨보다 낮던 영웅은 공유 레벨에서 개별 육성을 시작. 돌려주는 값 = 오른 레벨 수
  G.giveExp = function (s, id, amt, sync) {
    const h = s.heroes[id]; if (!h || !(amt > 0)) return 0;
    h.lv = h.lv || 1;
    const cap = G.lvCapOf(s, id), cur = G.heroLv(s, id, sync);
    if (cur >= cap) { h.lv = Math.max(h.lv || 1, cap); h.exp = 0; return 0; }
    if ((h.lv || 1) < cur) { h.lv = cur; h.exp = 0; }
    h.exp = (h.exp || 0) + amt; let n = 0;
    while (h.lv < cap && h.exp >= C.expNeed(h.lv)) { h.exp -= C.expNeed(h.lv); h.lv++; n++; }
    if (h.lv >= cap) h.exp = 0;
    return n;
  };
  G.partyExp = function (s, amt) { const sync = G.syncLv(s); let n = 0; for (const id of G.activeParty(s)) n += G.giveExp(s, id, amt, sync); return n; };
  // 경험치 물약: n개까지 쓰되 상한에서 멈춤. 돌려주는 값 = 쓴 물약 수
  G.xpotNeedToNext = function (s, id) { const h = s.heroes[id]; const lv = G.heroLv(s, id); if (lv >= G.lvCapOf(s, id)) return 0; const have = (h.lv || 1) >= lv ? (h.exp || 0) : 0; return Math.max(1, Math.ceil((C.expNeed(lv) - have) / C.XPOT_EXP)); };
  G.useXpot = function (s, id, n) {
    let used = 0; const have = () => s.xpot || 0;
    while (used < n && have() > 0 && G.heroLv(s, id) < G.lvCapOf(s, id)) { s.xpot--; used++; G.giveExp(s, id, C.XPOT_EXP); }
    return used;
  };
})(typeof window !== 'undefined' ? window : globalThis);

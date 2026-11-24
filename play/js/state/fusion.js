// 상태 7: 영웅 조합·레시피
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  // 조합
  G.fuseCost = function (s, star, elem) { return C.fusionUshard(star, star === 2 ? (s.fz || {})[elem] || 0 : 0); };   // ★2→★3은 그 속성에서 조합할 때마다 비용↑
  G.canFuse = function (s, ids) {
    if (!ids.length) return '재료를 선택하세요';
    const cs = ids.map(byId); if (cs.some(c => !s.heroes[c.id])) return '보유하지 않은 영웅';
    if (new Set(ids).size !== ids.length) return '같은 영웅을 중복 선택';
    if (cs.some(c => c.star !== cs[0].star || c.elem !== cs[0].elem)) return '같은 등급·같은 속성이어야 합니다';
    const need = C.fusionN(cs[0].star); if (!need) return '★3는 조합 재료로 쓸 수 없습니다';
    if (ids.length !== need) return `★${cs[0].star} ${need}명이 필요합니다`;
    if (ids.some(id => s.party.includes(id))) return '파티에 편성된 영웅은 재료로 쓸 수 없습니다';
    const u = G.fuseCost(s, cs[0].star, cs[0].elem); const have = G.ushOf(s, cs[0].elem); if (have < u) return `${C.ELEM_NAME[cs[0].elem]} 승급석 ${u}개 필요 (보유 ${have})`;
    const sl = (C.FUSION_SEAL || {})[cs[0].star] || 0; if (sl && (s.seal || 0) < sl) return `별의 인장 ${sl}개 필요`;
    return null;
  };
  G.fuse = function (s, ids, rng) {
    rng = rng || Math.random;
    const err = G.canFuse(s, ids); if (err) return { err };
    const base = byId(ids[0]);
    let pool = CH().filter(c => c.star === base.star + 1 && c.elem === base.elem);
    if ((C.FUSION_SEAL || {})[base.star]) { const miss = pool.filter(c => !s.heroes[c.id]); if (miss.length) pool = miss; }   // 인장을 쓰는 조합은 미보유 우선 확정(시즌 3)
    const w = pool.map(c => s.heroes[c.id] ? 1 : 2); const tot = w.reduce((a, b) => a + b, 0);
    let r = rng() * tot, pick = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { pick = pool[i]; break; } }
    const keep = ids[Math.floor(rng() * ids.length)], ok = rng() < (C.FUSION_RATE[base.star] || 1);
    const kept = ok ? null : { lb: s.heroes[keep].lb, shards: s.heroes[keep].shards, slv: s.heroes[keep].slv };
    ids.forEach(id => { delete s.heroes[id]; });
    G.ensureUsh(s)[base.elem] -= G.fuseCost(s, base.star, base.elem); s.stats.fusions++;
    if (ok) { const sl = (C.FUSION_SEAL || {})[base.star] || 0; if (sl) { s.seal = (s.seal || 0) - sl; s.fz = s.fz || {}; s.fz[base.elem] = (s.fz[base.elem] || 0) + 1; } }   // 인장은 성공했을 때만 소모
    if (!ok) { s.heroes[keep] = kept; s.stats.fuseFail = (s.stats.fuseFail || 0) + 1; return { id: keep, fail: true }; }   // 실패: 재료 하나만 남음
    const isNew = G.addHero(s, pick.id);
    return { id: pick.id, isNew };
  };
  // 지정 레시피: ★3마다 같은 속성 ★2 두 명(속성 안에서 조합이 겹치지 않게 배정) + 같은 속성 ★2 아무나 1명
  G.recipes = function () {
    if (G._rec) return G._rec;
    const rec = [];
    for (const elem of C.ELEMS) {
      const targets = CH().filter(c => c.star === 3 && c.elem === elem);
      const pool = CH().filter(c => c.star === 2 && c.elem === elem);
      const pairs = []; for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i].id, pool[j].id]);
      const used = new Set();
      for (const t of targets) {
        let k = t.seed % pairs.length, guard = 0;
        while (used.has(k) && guard++ < pairs.length) k = (k + 1) % pairs.length;
        used.add(k); rec.push({ target: t.id, need: pairs[k].slice(), elem });
      }
    }
    G._rec = rec; return rec;
  };
  G.fuseRecipe = function (s, targetId, thirdId) {
    const r = G.recipes().find(x => x.target === targetId); if (!r) return { err: '레시피 없음' };
    const ids = [r.need[0], r.need[1], thirdId];
    if (new Set(ids).size !== 3) return { err: '재료가 중복됩니다' };
    const third = byId(thirdId); if (!third || third.star !== 2 || third.elem !== r.elem) return { err: '세 번째 재료는 같은 속성 ★2' };
    if (ids.some(id => !s.heroes[id])) return { err: '재료 영웅을 보유하고 있지 않습니다' };
    if (ids.includes(s.party[0])) return { err: '대표 영웅은 재료로 쓸 수 없습니다' };
    ids.forEach(id => { delete s.heroes[id]; });
    s.party = s.party.filter(id => !ids.includes(id)); // 동료로 편성돼 있던 재료는 자동 해제
    const isNew = G.addHero(s, targetId); s.stats.fusions++;
    return { id: targetId, isNew };
  };
})(typeof window !== 'undefined' ? window : globalThis);

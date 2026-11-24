// 상태 2: 장비(생성·재설정·점수·획득·분해·소환·신화·장비 조합·도감 효과)
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  // ---------- 장비 (랜덤 옵션) ----------
  // s.eq = { items: [{ id, p, g, b, o: [[key, tier, value]] }], on: { wpn: id|0 }, lv: { wpn: n }, pulls, seq, salv }
  // 2026-10-25 상한 옵션 삭제 이전: 장비 한 개의 옵션을 새 규칙으로 고침
  // 전설 옵션(L)은 uniques.js 정의로 다시 만들고(신화는 배율·3번째 줄 포함), 일반 줄의 치확·쿨감·피감과 겹치는 줄은 다른 옵션으로(등급·굴림 비율 유지)
  // 2026-11-15 속성 영웅 공격력 옵션 삭제도 같은 함수로 이전(C.optGone): 일반 줄은 C.ELEM_OPT 대응 종류로, 고유 장비는 uniques.js의 새 구성으로
  G.capFix = function (it, pool, mult, sigKey) {
    const u = it.u && !it.h && G.eqUnique(it.u); mult = mult || 1;
    let L = it.o.filter(x => x[1] === 5); const N = it.o.filter(x => x[1] !== 5);
    if (u && u.leg && L.length) { const my = it.g === 5; L = u.leg.map(([k, v]) => [k, 5, my ? Math.round(v * C.mythMult(k) * 10000) / 10000 : v]); if (my && Array.isArray(u.myth)) L.push([u.myth[0], 5, u.myth[1]]); }
    const lk = new Set(L.map(x => x[0])); const isBad = (x) => C.optGone(x[0]) || lk.has(x[0]);
    const used = new Set([...lk, ...N.filter(x => !isBad(x)).map(x => x[0])]);   // 바꾸지 않는 줄의 종류는 먼저 확보
    const out = N.map((x, i) => {
      let [k, t, v] = x; const bad = isBad(x);
      if (!bad) return [k, t, v];
      if (bad) { const old = k;   // 후보 순서: (유니크 첫 줄) 대표 옵션 → 고유 장비는 그 장비의 현재 구성(uniques.js), 일반 장비는 C.OPT_SWAP · C.ELEM_OPT → 공용 후보
        const cand = [(i === 0 && sigKey) || null].concat(u ? u.k : [C.OPT_SWAP[old], C.ELEM_OPT[old]]);
        const nk = cand.concat(C.OPT_FALLBACK).filter(c => c && pool.includes(c)).concat(pool).find(c => !used.has(c));
        const f = C.EQ_OPTS[old] ? v / (C.EQ_OPTS[old].base * C.EQ_TIER_MULT[t] * mult) : 1;   // 굴림 비율(0.9~1.1) 유지
        k = nk; v = Math.round(C.EQ_OPTS[k].base * C.EQ_TIER_MULT[t] * mult * f * 10000) / 10000; }
      used.add(k); return [k, t, v];
    });
    const nL = L.length; it.o = L.concat(out);
    if (it.ol) it.ol = it.ol.filter(i => i >= nL && i < it.o.length);
  };
  G.ensureEq = function (s) {
    if (!s.eq || !Array.isArray(s.eq.items)) s.eq = { items: [], on: {}, lv: (s.eq && s.eq.lv) || {}, pulls: (s.eq && s.eq.pulls) || 0, seq: 1, salv: 0 };
    for (const p of C.EQ_PARTS) { if (s.eq.on[p] == null) s.eq.on[p] = 0; if (s.eq.lv[p] == null) s.eq.lv[p] = 0; }
    if (s.eq.salv == null) s.eq.salv = 0;
    if (!s.eq.dex) s.eq.dex = {};   // 고유 장비 도감 (id → 1)
    if (!s.eq.m28) {   // 2026-11-23 마왕의 심장(28) 삭제 → 별무리의 인장(27)으로: 전설 줄은 27 정의로(신화면 신화 배율·3번째 줄), 일반 줄·등급·돌파·잠금은 유지(전설 줄과 겹치는 줄만 다른 종류로), 도감·획득 기록도 27로
      for (const it of s.eq.items) if (it.u === 28) { it.u = 27; G.capFix(it, C.EQ_OPT_KEYS, 1, null); }
      if (s.eq.dex[28]) { s.eq.dex[27] = 1; delete s.eq.dex[28]; }
      if (s.eq.mdex && s.eq.mdex[28]) { s.eq.mdex[27] = 1; delete s.eq.mdex[28]; }
      if (s.eq.got && s.eq.got[28]) { s.eq.got[27] = (s.eq.got[27] || 0) + s.eq.got[28]; delete s.eq.got[28]; }
      s.eq.m28 = 1;
    }
    for (const it of s.eq.items) { if (it.g !== 5 || it.mv === 2) continue; const u = it.u && (g.EQ_UNIQUES || []).find(x => x.id === it.u); if (!u || !u.leg) continue;   // 신화 ×1.5 시절 장비 → 현재 배율로
      u.leg.forEach(([k, v], i) => { if (it.o[i] && it.o[i][1] === 5 && it.o[i][0] === k) it.o[i] = [k, 5, Math.round(v * C.mythMult(k) * 10000) / 10000]; }); it.mv = 2; }
    if (!s.eq.legV) { // 전설 옵션 도입 전에 얻은 레전드: 전설 옵션 2줄 + 남은 3줄(같은 종류면 기존 등급·수치 유지)로 갱신
      for (const it of s.eq.items) { const u = it.u && (g.EQ_UNIQUES || []).find(x => x.id === it.u); if (!u || !u.leg || it.o.some(x => x[1] === 5)) continue;
        it.o = u.leg.map(([k, v]) => [k, 5, v]).concat(u.k.map(k => { const old = it.o.find(x => x[0] === k); if (old) return old; const t = Math.floor(Math.random() * 5); return [k, t, Math.round(C.EQ_OPTS[k].base * C.EQ_TIER_MULT[t] * 10000) / 10000]; })); }
      s.eq.legV = 1;
    }   // 자동 분해 기준: 이 등급 이하(0=노말)는 얻자마자 분해. -1 = 끔
    if ((s.eq.capV || 0) < 3) { for (const it of s.eq.items) { const u = it.u && G.eqUnique(it.u); G.capFix(it, C.EQ_OPT_KEYS, 1, u && u.g === 3 ? u.k[0] : null); } s.eq.capV = 3; }
    if ((s.eq.capV || 0) < 4) { for (const it of s.eq.items) if (it.u && it.o.some(x => x[1] === 5)) { const u = G.eqUnique(it.u); G.capFix(it, C.EQ_OPT_KEYS, 1, u && u.g === 3 ? u.k[0] : null); } s.eq.capV = 4; }   // 4 = 속성 영웅 공격력 복원(2026-11-20): 전설 줄을 uniques.js 정의로 다시 만듦   // 1 = 상한 옵션 삭제(2026-10-25), 2 = 속성 영웅 공격력 옵션 삭제(2026-11-15, 전설 줄 전부 공격력), 3 = 전설 줄을 속성별 능력치로(같은 날)
    if ((s.eq.capV || 0) < 5) { for (const it of s.eq.items) if (it.u && it.o.some(x => x[1] === 5)) G.capFix(it, C.EQ_OPT_KEYS, 1, null); s.eq.capV = 5; }   // 5 = 속성 레전드 보조 줄 통일(2026-11-23)
    if ((s.eq.capV || 0) < 6) {   // 6 = 속성 공격력 말고 전부 무작위(2026-11-24): 레전드·신화의 고정 줄을 속성 줄(L) 하나로, 빠진 줄은 무작위 종류·등급으로 채움(레전드 5줄·신화 6줄). 남은 일반 줄·등급·돌파는 유지, 잠금 해제
      for (const it of s.eq.items) { if (!it.u || it.g < 4) continue; const u = G.eqUnique(it.u); if (!u) continue; const my = it.g === 5;
        const L = (u.leg || []).map(([k, v]) => [k, 5, my ? Math.round(v * C.mythMult(k) * 10000) / 10000 : v]), want = my ? 6 : 5;
        const N = []; for (const x of it.o) if (x[1] !== 5 && !L.some(l => l[0] === x[0]) && !N.some(n => n[0] === x[0])) N.push(x);
        const used = new Set(L.concat(N).map(x => x[0])), pool = C.EQ_OPT_KEYS.filter(k => !used.has(k));
        while (L.length + N.length < want && pool.length) N.push(G.eqRoll(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], my, Math.random));
        it.o = L.concat(N.slice(0, want - L.length)); delete it.ol; }
      s.eq.capV = 6; }
    if ((s.eq.capV || 0) < 7) {   // 7 = 무속성 레전드(37·18·27)에 고정 보스 피해 줄(2026-11-24): 맨 앞에 넣고, 무작위 줄 중 가장 약한 것(낮은 등급 → 기본값 대비 수치 낮은 순, L 제외) 1개를 뺌. 줄 수·나머지 줄·돌파 유지
      for (const it of s.eq.items) { if (!it.u || it.g < 4) continue; const u = G.eqUnique(it.u); if (!u || !(u.leg || []).length || G.eqFixed(it, 0)) continue; const my = it.g === 5;
        const L = u.leg.map(([k, v]) => [k, 5, my ? Math.round(v * C.mythMult(k) * 10000) / 10000 : v]); let o = it.o.slice();
        for (let n = 0; n < L.length && o.length; n++) { let wi = -1, wv = Infinity; o.forEach((x, i) => { if (x[1] === 5) return; const sc = x[1] * 100 + x[2] / C.EQ_OPTS[x[0]].base; if (sc <= wv) { wv = sc; wi = i; } }); if (wi < 0) wi = o.length - 1; o.splice(wi, 1); }
        it.o = L.concat(o); delete it.ol; }
      s.eq.capV = 7; }
    if ((s.eq.capV || 0) < 8) {   // 8 = 무속성 고정 줄 보스 피해 → 공격력(속성 줄의 85%, 2026-11-25): 맨 앞 고정 줄만 새 정의로 바꿈(신화 ×3, 돌파는 optVal에서)
      for (const it of s.eq.items) { if (!it.u || it.g < 4) continue; const u = G.eqUnique(it.u); const l = u && (u.leg || [])[0]; const x = it.o && it.o[0]; if (!l || !x || x[1] !== 5 || x[0] === l[0] || x[0] !== 'boss') continue;
        it.o[0] = [l[0], 5, it.g === 5 ? Math.round(l[1] * C.mythMult(l[0]) * 10000) / 10000 : l[1]]; }
      s.eq.capV = 8; }
    if (s.estone == null) s.estone = 0;
    return s.eq;
  };
  // 옵션 한 줄 굴림: 등급 D~S 균등, 신화(myth)면 L 확률 C.EQ_L_RATE(L 수치 = S × 신화 배율). mult = 전용장비 배율
  G.eqRoll = function (k, myth, rng, mult) {
    let r = rng(), t; if (myth && r < C.EQ_L_RATE) t = 5; else { if (myth) r = (r - C.EQ_L_RATE) / (1 - C.EQ_L_RATE); t = Math.min(4, Math.floor(r * 5)); }
    const tm = t === 5 ? C.EQ_TIER_MULT[4] * C.mythMult(k) : C.EQ_TIER_MULT[t];
    return [k, t, Math.round(C.EQ_OPTS[k].base * tm * (0.9 + rng() * 0.2) * (mult || 1) * 10000) / 10000];
  };
  // 고정 줄 = 고유 장비 정의(u.leg)의 속성 줄(L). 신화 무작위 줄의 L은 고정 줄이 아님(재설정·잠금 대상)
  G.eqFixed = function (it, i) { const x = it && it.o && it.o[i]; if (!x || x[1] !== 5 || !it.u) return false; const u = G.eqUnique(it.u); const l = u && (u.leg || [])[i]; return !!(l && l[0] === x[0]); };   // 고정 줄은 맨 앞 u.leg 순서 그대로(eqUOpts·capV 6·mythUp) — 종류 중복 허용 뒤 같은 종류 무작위 L 줄과 구분
  // 고유 장비 무작위 줄(2026-11-24 '전부 주사위로'): 고정 줄(L)을 뺀 나머지 = 겹치지 않는 무작위 종류·등급. 유니크 4줄 · 레전드 5줄(L 포함)
  G.eqUOpts = function (u, grade, rng) {
    const roll = (k) => { const t = Math.floor(rng() * 5); return [k, t, Math.round(C.EQ_OPTS[k].base * C.EQ_TIER_MULT[t] * (0.9 + rng() * 0.2) * 10000) / 10000]; };
    const L = (u.leg || []).map(([k, v]) => [k, 5, v]), n = (grade >= 4 ? 5 : 4) - L.length;
    const keys = C.EQ_OPT_KEYS, o = [];   // 2026-11-24 사용자 '한 옵션만 5개도 나오게' — 종류 중복 허용(고정 줄 종류 포함)
    for (let i = 0; i < n; i++) o.push(roll(keys[Math.floor(rng() * keys.length)]));
    return L.concat(o);
  };
  G.eqMakeU = function (s, uid, rng) {   // 지정한 고유 장비 1개 생성(운영 보상용) — 옵션 등급·수치는 소환과 같은 방식
    const eq = G.ensureEq(s), u = G.eqUnique(uid); const roll = (k) => { const t = Math.floor(rng() * 5); return [k, t, Math.round(C.EQ_OPTS[k].base * C.EQ_TIER_MULT[t] * (0.9 + rng() * 0.2) * 10000) / 10000]; };
    eq.dex[u.id] = 1; return { id: eq.seq++, p: u.p, g: u.g, b: 0, u: u.id, o: G.eqUOpts(u, u.g, rng) };
  };
  G.eqMake = function (s, grade, rng, part) {
    const eq = G.ensureEq(s); part = part || C.EQ_PARTS[Math.floor(rng() * C.EQ_PARTS.length)];
    const roll = (k) => { const t = Math.floor(rng() * 5); return [k, t, Math.round(C.EQ_OPTS[k].base * C.EQ_TIER_MULT[t] * (0.9 + rng() * 0.2) * 10000) / 10000]; };   // 옵션 등급 D~S 균등
    if (grade >= 3) { // 유니크·레전드 = 고유 장비: 옵션 종류 고정, 등급·수치만 무작위. 도감에 기록
      const pool = (g.EQ_UNIQUES || []).filter(u => u.g === grade && u.p === part);
      if (pool.length) { const u = pool[Math.floor(rng() * pool.length)]; eq.dex[u.id] = 1; eq.got = eq.got || {}; eq.got[u.id] = (eq.got[u.id] || 0) + 1;   // got: 고유 장비 종류별 누적 획득 수(2026-10-25, 확률 점검용)
      return { id: eq.seq++, p: part, g: grade, b: 0, u: u.id, o: G.eqUOpts(u, grade, rng) }; }   // 전설 옵션은 등급 5(L)
    }
    const keys = C.EQ_OPT_KEYS.slice(); const o = [];
    for (let i = 0; i < grade + 1; i++) o.push(roll(keys[Math.floor(rng() * keys.length)]));   // 종류 중복 허용(2026-11-24)
    return { id: eq.seq++, p: part, g: grade, b: Math.floor(rng() * C.EQ_PART[part].bases.length), o };
  };
  // 옵션 재설정: kind 'eq'|'ex'. 잠근 옵션(it.ol, 인덱스)은 유지, 나머지는 새로 굴림. 전설 옵션(L)은 대상 아님.
  // 일반 장비·레전드(L 제외)·유니크(고유 옵션 첫 줄 제외) = 종류·등급·수치 모두 / 유니크 고유 옵션 = 종류 고정, 등급·수치만 / 전용장비 = 역할 옵션 풀에서 종류·등급·수치
  G.rerollSig = function (it) { return -1; };   // 2026-11-24 유니크 첫 줄도 종류까지 굴림(고유 옵션 폐지)
  G.rerollIdx = function (it) { return it.o.map((x, i) => G.eqFixed(it, i) ? -1 : i).filter(i => i >= 0); };
  G.rerollLocks = function (it) { const ok = G.rerollIdx(it); return (it.ol || []).filter(i => ok.includes(i)); };
  G.rerollPrice = function (it) { const c = C.rerollCost(it.g, G.rerollLocks(it).length); return it.h ? Math.max(1, Math.round(c * C.EX_RR_XS)) : c; };   // 전용장비(it.h)는 영혼석
  G.rerollCur = function (it) { return it.h ? 'xstone' : 'crystal'; };
  G.optReroll = function (s, kind, it, rng) {
    rng = rng || Math.random; const idx = G.rerollIdx(it), locks = G.rerollLocks(it);
    if (!idx.length || locks.length >= idx.length) return { err: '잠그지 않은 옵션이 없습니다' };
    const cost = G.rerollPrice(it), cur = G.rerollCur(it); if ((s[cur] || 0) < cost) return { err: cur === 'xstone' ? '영혼석이 부족합니다' : '보석이 부족합니다' };
    const ex = kind === 'ex', R = ex ? C.EX_ROLE[byId(it.h).role] : null, mult = ex ? C.EX_OPT_MULT : 1;
    const myth = !ex && it.g === 5, roll = (k) => G.eqRoll(k, myth, rng, mult);
    const sig = G.rerollSig(it);   // 유니크 첫 줄 = 고유 옵션(종류 고정, 등급·수치만)
    const pool = ex ? R.pool.filter(k => !it.o.some((x, i) => x[0] === k && (locks.includes(i) || i === sig))) : C.EQ_OPT_KEYS.slice();   // 장비는 종류 중복 허용(2026-11-24), 전용장비는 그대로 중복 없음
    for (const i of idx) { if (locks.includes(i)) continue; const k = i === sig ? it.o[i][0] : ex ? pool.splice(Math.floor(rng() * pool.length), 1)[0] : pool[Math.floor(rng() * pool.length)]; if (k) it.o[i] = roll(k); }
    s[cur] -= cost; s.stats = s.stats || {}; s.stats.rerolls = (s.stats.rerolls || 0) + 1;
    return { ok: true, cost };
  };
  G.eqUnique = function (id) { return (g.EQ_UNIQUES || []).find(u => u.id === id) || null; };
  G.eqName = function (it) { if (it.u) { const u = G.eqUnique(it.u); if (u) return u.name; } return C.EQ_GRADES[it.g] + ' ' + C.EQ_PART[it.p].bases[it.b % C.EQ_PART[it.p].bases.length]; };
  G.eqLbMult = function (it) { return it && it.g === 5 ? 1 + C.MYTH_LB.step * (it.lb || 0) : 1; };   // 신화 돌파 배율(주 능력치·전설 옵션)
  G.optVal = function (it, t, v) { return t === 5 ? v * G.eqLbMult(it) : v; };
  G.eqMain = function (it) { return C.EQ_MAIN[C.EQ_PART[it.p].main][it.g] * G.eqLbMult(it); };
  // 비교용 점수: 주 능력치·옵션을 각 기본값으로 나눈 합 × 종류별 효율(C.OPT_W — 스킬·궁극기·치명타 피해는 공격력보다 효과가 작아 낮게 침)
  G.eqScore = function (s, it) {
    if (!it) return 0; const mainBase = C.EQ_MAIN[C.EQ_PART[it.p].main][0]; let v = G.eqMain(it) / mainBase;
    for (const [k, tt, v0] of it.o) { const val = G.optVal(it, tt, v0); v += val / C.EQ_OPTS[k].base * (C.OPT_W[k] != null ? C.OPT_W[k] : 1); }
    return v;
  };
  G.eqItem = function (s, id) { return id ? G.ensureEq(s).items.find(x => x.id === id) || null : null; };
  G.eqOn = function (s, part) { return G.eqItem(s, G.ensureEq(s).on[part]); };
  G.eqIsOn = function (s, it) { return G.ensureEq(s).on[it.p] === it.id; };
  G.eqBagCount = function (s) { const eq = G.ensureEq(s); return eq.items.filter(x => eq.on[x.p] !== x.id).length; };
  G.eqBetter = function (s, it) { return !G.eqIsOn(s, it) && G.eqScore(s, it) > G.eqScore(s, G.eqOn(s, it.p)) + 1e-9; };
  G.eqSalvageOne = function (s, it) { const eq = G.ensureEq(s); if (G.eqIsOn(s, it) || it.lk || it.g >= 5) return 0; eq.items = eq.items.filter(x => x !== it); const v = C.EQ_SALVAGE[it.g]; s.estone += v; return v; };
  // 획득: 장착 부위가 비었으면 자동 장착, 자동 분해 기준 이하면 즉시 분해(단 장착 장비보다 좋으면 보관), 가방이 차면 점수 낮은 쪽을 분해
  G.eqAdd = function (s, it) {
    const eq = G.ensureEq(s);
    if (!eq.on[it.p]) { eq.items.push(it); eq.on[it.p] = it.id; return { it, kept: true, equipped: true }; }
    const better = G.eqScore(s, it) > G.eqScore(s, G.eqOn(s, it.p));
    if (it.g <= eq.salv && !better) { const v = C.EQ_SALVAGE[it.g]; s.estone += v; return { it, kept: false, stone: v }; }
    eq.items.push(it);
    if (G.eqBagCount(s) > C.EQ_BAG) { const bag = eq.items.filter(x => !G.eqIsOn(s, x) && !x.lk && x.g < 4).sort((a, b) => G.eqScore(s, a) - G.eqScore(s, b)); const worst = bag[0]; const v = worst ? G.eqSalvageOne(s, worst) : 0; if (worst && worst === it) return { it, kept: false, stone: v }; }
    return { it, kept: true, better };
  };
  G.eqEquip = function (s, id) { const it = G.eqItem(s, id); if (!it) return false; s.eq.on[it.p] = it.id; return true; };
  G.eqAutoEquip = function (s) { // 부위마다 점수 최고 장비 장착
    const eq = G.ensureEq(s); let n = 0;
    for (const p of C.EQ_PARTS) { let best = G.eqOn(s, p), bs = G.eqScore(s, best); for (const it of eq.items) if (it.p === p && G.eqScore(s, it) > bs + 1e-9) { best = it; bs = G.eqScore(s, it); } if (best && eq.on[p] !== best.id) { eq.on[p] = best.id; n++; } }
    return n;
  };
  G.eqSalvageWorse = function (s) { // 장착 장비보다 점수 낮은 가방 장비 일괄 분해(잠금·레전드 제외)
    const eq = G.ensureEq(s); let n = 0, stone = 0;
    for (const it of eq.items.slice()) if (!G.eqIsOn(s, it) && !it.lk && it.g < 4 && G.eqScore(s, it) <= G.eqScore(s, G.eqOn(s, it.p))) { stone += G.eqSalvageOne(s, it); n++; }
    return { n, stone };
  };
  G.eqDrop = function (s, stage, rng) { // 스테이지 보스 처치 시
    rng = rng || Math.random; if (rng() >= C.EQ_DROP / (C.STAGE_DISP || 1)) return null;   // 2026-11-18 보스가 10배 자주 → 드롭 1/10
    return G.eqAdd(s, G.eqMake(s, pickW(C.eqDropRate(C.sOld ? C.sOld(stage) : stage), rng), rng));
  };
  G.eqSummonLv = function (s) { return C.eqSummonLv(G.ensureEq(s).pulls); };
  G.eqPull = function (s, n, rng) {
    rng = rng || Math.random; const eq = G.ensureEq(s);
    const cost = C.EQ_COST * n; if (s.crystal < cost) return null;
    s.crystal -= cost; const res = [];
    for (let i = 0; i < n; i++) {
      const lv = C.eqSummonLv(eq.pulls); eq.pulls++; eq.pity = (eq.pity || 0) + 1;
      let g = pickW(C.EQ_RATE[lv - 1], rng); if (eq.pity >= C.EQ_PITY) g = 4; if (g === 4) eq.pity = 0;
      res.push(G.eqAdd(s, G.eqMake(s, g, rng)));
    }
    eq.last = res.map(x => ({ id: x.it.id, g: x.it.g, p: x.it.p, u: x.it.u, k: x.kept ? 1 : 0, st: x.stone || 0 }));   // 마지막 소환 결과(다시 접속해도 표시)
    return res;
  };
  // 장착 장비 합산 효과 (부위 강화 반영)
  // 신화 등급업: 같은 이름 레전드 MYTH_NEED-1개(장착·잠금 제외)를 소모해 레전드 → 신화
  G.mythMats = function (s, it) { const eq = G.ensureEq(s); return eq.items.filter(x => x !== it && x.u === it.u && x.g === 4 && !G.eqIsOn(s, x) && !x.lk).sort((a, b) => G.eqScore(s, a) - G.eqScore(s, b)); };
  G.mythUp = function (s, it, rng) {
    rng = rng || Math.random;
    const u = it && it.u && G.eqUnique(it.u); if (!u || it.g !== 4 || !u.myth) return { err: '신화로 올릴 수 없는 장비입니다' };
    const mats = G.mythMats(s, it); if (mats.length < C.MYTH_NEED - 1) return { err: '같은 레전드가 부족합니다' };
    if ((s.crystal || 0) < C.MYTH_COST) return { err: '보석이 부족합니다' };
    const eq = G.ensureEq(s); const use = mats.slice(0, C.MYTH_NEED - 1); eq.items = eq.items.filter(x => !use.includes(x)); s.crystal -= C.MYTH_COST;
    s.stats = s.stats || {}; s.stats.mythTry = (s.stats.mythTry || 0) + 1;
    if (rng() >= C.MYTH_RATE) return { fail: true, used: use.length };   // 실패: 재료만 소모, 본체는 레전드 그대로
    it.o = it.o.map((x, i) => G.eqFixed(it, i) ? [x[0], 5, Math.round(x[2] * C.mythMult(x[0]) * 10000) / 10000] : x); it.g = 5; it.mv = 2;
    { const pool = C.EQ_OPT_KEYS, k = pool[Math.floor(rng() * pool.length)];   // 종류 중복 허용   // 신화 추가 줄 = 무작위 종류·등급(L 2% 포함, 2026-11-24)
      it.o.push(G.eqRoll(k, true, rng)); }
    eq.mdex = eq.mdex || {}; eq.mdex[u.id] = 1; delete it.ol;
    return { ok: true, used: use.length };
  };
  // 신화 돌파: 같은 신화(장착·잠금 제외, 돌파 낮은 것부터) 1개 + 보석 → 본체 +1
  G.mythLbMats = function (s, it) { const eq = G.ensureEq(s); return eq.items.filter(x => x !== it && x.u === it.u && x.g === 5 && !G.eqIsOn(s, x) && !x.lk).sort((a, b) => (a.lb || 0) - (b.lb || 0) || G.eqScore(s, a) - G.eqScore(s, b)); };
  G.mythLb = function (s, it) {
    if (!it || it.g !== 5) return { err: '신화 장비가 아닙니다' }; if ((it.lb || 0) >= C.MYTH_LB.max) return { err: '최대 돌파입니다' };
    const mat = G.mythLbMats(s, it)[0]; if (!mat) return { err: '같은 신화가 부족합니다' }; if ((s.crystal || 0) < C.MYTH_LB.cost) return { err: '보석이 부족합니다' };
    const eq = G.ensureEq(s); eq.items = eq.items.filter(x => x !== mat); s.crystal -= C.MYTH_LB.cost; it.lb = (it.lb || 0) + 1; return { ok: true, lb: it.lb };
  };
  // 장비 조합(유니크 → 레전드)
  G.eqFuseMats = function (s, part) { const eq = G.ensureEq(s); return eq.items.filter(x => x.g === 3 && x.p === part && !x.lk && !G.eqIsOn(s, x)).sort((a, b) => G.eqScore(s, a) - G.eqScore(s, b)); };
  G.eqFuse = function (s, ids, rng) {
    rng = rng || Math.random; const eq = G.ensureEq(s); const N = C.EQ_FUSE.need;
    const mats = ids.map(id => G.eqItem(s, id)); if (mats.length !== N || mats.some(x => !x)) return { err: '재료가 부족합니다' };
    const part = mats[0].p; if (mats.some(x => x.g !== 3 || x.p !== part || x.lk || G.eqIsOn(s, x)) || new Set(ids).size !== N) return { err: '같은 부위 유니크 ' + N + '개가 필요합니다' };
    eq.items = eq.items.filter(x => !mats.includes(x)); s.stats = s.stats || {}; s.stats.eqFuse = (s.stats.eqFuse || 0) + 1;
    if (rng() >= C.EQ_FUSE.rate) { const keep = mats.slice().sort((a, b) => G.eqScore(s, b) - G.eqScore(s, a))[0]; eq.items.push(keep); return { fail: true, kept: keep }; }
    const it = G.eqMake(s, 4, rng, part); G.eqAdd(s, it); return { ok: true, it };
  };
  G.eqDexBonus = function (s) { const eq = G.ensureEq(s); const nl = Object.keys(eq.dex).filter(id => (G.eqUnique(+id) || {}).g === 4).length, nm = Object.keys(eq.mdex || {}).length; const v = C.EQ_DEX_BONUS.leg * nl + C.EQ_DEX_BONUS.myth * nm; return { nl, nm, v }; };
  G.eqBonus = function (s) {
    const b = {}; if (!s.eq || !Array.isArray(s.eq.items)) return b;
    { const d = G.eqDexBonus(s); if (d.v) { b.atk = (b.atk || 0) + d.v; b.hp = (b.hp || 0) + d.v; } }   // 장비 도감 효과(원정대 전체)
    for (const p of C.EQ_PARTS) {
      const it = G.eqOn(s, p); if (!it) continue; const m = 1 + C.EQ_LV_STEP * (s.eq.lv[p] || 0);
      const mk = C.EQ_PART[p].main; b[mk] = (b[mk] || 0) + G.eqMain(it) * m;
      for (const [k, t, v] of it.o) b[k] = (b[k] || 0) + G.optVal(it, t, v) * m;
    }
    return b;
  };
  G.eqUpCost = function (s, part) { return C.eqUpCost(G.ensureEq(s).lv[part] || 0); };
  G.eqUp = function (s, part, times) {
    let done = 0; times = times || 1;
    while (done < times) { const c = G.eqUpCost(s, part); if ((s.estone || 0) < c) break; s.estone -= c; s.eq.lv[part]++; done++; }
    return done;
  };
  G.eqUpMax = function (s, part) {
    let lv = G.ensureEq(s).lv[part] || 0, have = s.estone || 0, n = 0, cost = 0;
    while (n < 999) { const c = C.eqUpCost(lv); if (have < c) break; have -= c; cost += c; lv++; n++; }
    return { n, cost };
  };
})(typeof window !== 'undefined' ? window : globalThis);

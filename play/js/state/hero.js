// 상태 4: 영웅 실제 능력치·전투력·편성·전투 유닛
(function (g) {
  const C = g.RPG.C;
  const G = g.RPG.G;
  const CH = () => g.CHARS;
  const byId = (id) => CH().find(c => c.id === id);
  const pickW = (w, rng) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
  G.heroStats = function (s, id) {
    const h = s.heroes[id]; const ch = byId(id);
    const sb = G.heroBonus(s, id); const eb = Object.assign({}, G.eqBonus(s)); const xb = G.exBonus(s, id); for (const k in xb) eb[k] = (eb[k] || 0) + xb[k];
    sb.cdmg = (sb.cdmg || 0) + 0.10 * G.relicLv(s, 'eye') + (eb.cdmg || 0); sb.cdr = (sb.cdr || 0) + 0.01 * G.relicLv(s, 'sand') + (eb.cdr || 0);
    for (const k of ['def', 'crit', 'aspd', 'heal', 'dr']) if (eb[k]) sb[k] = (sb[k] || 0) + eb[k];
    // 상한 초과분 전환 (C.OVERFLOW): 치명타 확률 → 치명타 피해, 쿨타임 감소 → 스킬 피해, 받는 피해 감소 → 체력
    const O = C.OVERFLOW, up = s.up || {};
    const over = { crit: Math.max(0, 0.05 + 0.005 * (up.crit || 0) + (sb.crit || 0) - O.crit.cap), cdr: Math.max(0, sb.cdr - O.cdr.cap), dr: Math.max(0, (sb.dr || 0) - O.dr.cap) };
    sb.cdr = Math.min(O.cdr.cap, sb.cdr); sb.cdmg += over.crit * O.crit.r;
    const rm = G.relicMult(s); rm.atk *= 1 + (eb.atk || 0) + (eb['e_' + ch.elem] || 0);   // 속성 영웅 공격력(장비, 2026-11-20 복원)
    rm.hp *= 1 + (eb.hp || 0) + over.dr * O.dr.r;
    const st = C.charStats(ch, s.up, h ? h.lb : 0, G.codex(s), sb, rm); if (G.heroLv) { const lm = C.lvMult(G.heroLv(s, id)); st.hp = Math.round(st.hp * lm); st.atk = Math.round(st.atk * lm); st.def = Math.round(st.def * lm); }
    if (C.HERO_ATK && C.HERO_ATK[id]) st.atk = Math.round(st.atk * C.HERO_ATK[id]);   // 영웅 레벨(2026-10-30)
    st.skillOver = over.cdr * O.cdr.r; st.over = over; return st;
  };
  G.heroAmps = function (s, id, st) {   // 전투력용 피해 증폭(유닛의 basicAmp·skillAmp·ultAmp·bossDmg와 같은 출처)
    const EB = Object.assign({}, G.eqBonus(s)); { const xb = G.exBonus(s, id); for (const k in xb) EB[k] = (EB[k] || 0) + xb[k]; }
    return { basic: EB.basic || 0, skill: (EB.skill || 0) + ((st && st.skillOver) || 0), ult: EB.ult || 0, boss: 0.05 * G.relicLv(s, 'scythe') + (EB.boss || 0) };
  };
  G.heroPower = function (s, id) { const st = G.heroStats(s, id), role = byId(id).role; return Math.round(C.power(st, G.heroAmps(s, id, st), role) * C.rolePowF(role)); };
  G.slots = function (s) { return C.partySlots(s.maxClear); };
  // 출전 원정대. G.withParty로 잠시 다른 편성(속성 시련 전용 편성 등)을 쓰는 동안은 그 편성이 기준(공명·인연·능력치 모두)
  G.activeParty = function (s) { return (G._ovr || s.party).filter(id => s.heroes[id]).slice(0, G.slots(s)); };
  // 프리셋 장비로 계산(2026-11-22 속성의 시련): 공용 장비·전용장비를 잠깐 바꿔 끼우고 계산이 끝나면 원래대로. 분해된 장비는 건너뜀
  G.withLoadout = function (s, p, fn) {
    if (!p || !s.eq || !s.ex) return fn(); const e0 = s.eq.on, x0 = s.ex.on; s.eq.on = Object.assign({}, e0); s.ex.on = Object.assign({}, x0);
    for (const k in p.eq || {}) if (p.eq[k] && G.eqItem(s, p.eq[k])) s.eq.on[k] = p.eq[k];
    for (const h in p.ex || {}) { const it = G.exItem(s, p.ex[h]); if (it && it.h === +h) s.ex.on[h] = it.id; }
    try { return fn(); } finally { s.eq.on = e0; s.ex.on = x0; }
  };
  G.withParty = function (s, ids, fn) { const p = G._ovr; G._ovr = ids; try { return fn(); } finally { G._ovr = p; } };
  // 속성 시련 전용 편성(시즌 3): 그 속성 보유 영웅 중 자동 선발 — 수호 1·치유 1을 먼저 채우고 나머지는 강한 순. 첫 자리는 가장 강한 영웅
  G.trialTeam = function (s, elem) {
    const own = Object.keys(s.heroes).map(Number).filter(id => byId(id).elem === elem); if (!own.length) return [];
    const sc = (id) => C.STAR_MULT[byId(id).star] * C.lbMult(s.heroes[id].lb || 0) * C.lvMult(G.heroLv ? G.heroLv(s, id) : 1);
    const sorted = own.sort((a, b) => sc(b) - sc(a) || a - b), n = G.slots(s), team = [];
    const ps = s.epresets && s.epresets[elem];   // 2026-11-22 저장한 속성별 프리셋이 있으면 그 속성 영웅을 프리셋 순서 그대로, 빈 칸만 자동 선발로 채움
    if (ps) { for (const id of ps.party) if (team.length < n && s.heroes[id] && byId(id).elem === elem && !team.includes(id)) team.push(id); for (const id of sorted) { if (team.length >= n) break; if (!team.includes(id)) team.push(id); } return team; }
    if (n >= 3) for (const r of ['tank', 'heal']) { const x = sorted.find(id => byId(id).role === r); if (x) team.push(x); }
    for (const id of sorted) { if (team.length >= n) break; if (!team.includes(id)) team.push(id); }
    return team.sort((a, b) => sc(b) - sc(a) || a - b);
  };
  G.partyPower = function (s) { return G.activeParty(s).reduce((a, id) => a + G.heroPower(s, id), 0); };

  G.unitOf = function (s, id) {
    const ch = byId(id); const st = G.heroStats(s, id);
    const EB = Object.assign({}, G.eqBonus(s)); { const xb = G.exBonus(s, id); for (const k in xb) EB[k] = (EB[k] || 0) + xb[k]; }
    const h = s.heroes[id]; const sm = C.skillMult(h ? h.slv : 1);
    const cdr = st.cdr || 0;
    const awakened = h && h.lb >= C.LB_MAX;   // 초월 5: 고유 스킬 진각성
    const skills = C.skillsOf(ch).map(sk => { const k = Object.assign({}, sk); k.cd = Math.round(k.cd * (1 - cdr) * 10) / 10; if (C.DMG_TYPES.includes(k.type)) k.mult = Math.round(k.mult * sm * 100) / 100; else if (k.mult) k.mult = Math.round(k.mult * (1 + (sm - 1) * 0.5) * 100) / 100;
      if (k.sig && awakened) { k.name = '진·' + k.name; if (k.mult) k.mult = Math.round(k.mult * 1.3 * 100) / 100; if (k.pct) k.pct = Math.round(k.pct * 1.3 * 100) / 100; k.cd = Math.round(k.cd * 0.85 * 10) / 10; k.awakened = true; }
      if (k.sig && s.ex) { const L = G.exLeg(G.exOn(s, id)); if (L) G.applyMod(k, L); }
      G.buffLv(k, sm); return k; });
    return { uid: 'h' + id, id, name: ch.name, elem: ch.elem, role: ch.role, star: ch.star, img: 'img/char/h' + String(id).padStart(3, '0') + '.png' + (g.IMGV || '') + (ch.star === 3 && g.IMGV ? '&hd' : ''),
      hp: st.hp, atk: st.atk, def: st.def, spd: st.spd, crit: st.crit, cdmg: st.cdmg, aspd: st.aspd, healBonus: st.healBonus, dr: st.dr || 0, bossDmg: 0.05 * G.relicLv(s, 'scythe') + (EB.boss || 0), skillAmp: (EB.skill || 0) + (st.skillOver || 0), basicAmp: EB.basic || 0, ultAmp: EB.ult || 0, ls: EB.ls || 0, skills, range: C.heroRange(ch) > 15 ? 105 : 26 };
  };
  // 버프·보호막·약화 세기도 스킬 레벨 반영(2026-11-22 사용자 '제피라 같은 2번 스킬도 스킬 레벨 영향 받게', 레벨당 +3% = 비피해 계수와 같은 비율 C.SKILL_BUFF_R)
  // 시간(지속·쿨 감소 초)·둔화 비율·받는 피해 감소(postDr)·부활 체력·흡혈은 그대로. 설명 글의 숫자도 같이 바꿈
  G.BUFF_LV_KEYS = ['atk', 'aspd', 'skl', 'cdm', 'heal', 'buff', 'def', 'defUp', 'selfDef', 'selfHeal', 'pct', 'reflect', 'postAtk', 'postAspd', 'postShield', 'lsBuff'];
  G.buffLv = function (k, sm) {
    const f = 1 + (sm - 1) * (C.SKILL_BUFF_R != null ? C.SKILL_BUFF_R : 0.5); if (f === 1) return k;
    const pc = (v) => Math.round(v * 100) + '%';
    for (const key of G.BUFF_LV_KEYS) { const v = k[key]; if (typeof v !== 'number' || !v) continue; const nv = Math.round(v * f * 1000) / 1000;
      const re = new RegExp('(?<![\\d.])' + Math.round(v * 100) + '%'); if (k.desc && key !== 'pct') k.desc = k.desc.replace(re, pc(nv)); if (k.exDesc) k.exDesc = k.exDesc.replace(re, pc(nv)); k[key] = nv; }   // pct는 설명에서 bp 기준으로 바뀜(skillDesc)
    if (Array.isArray(k.team)) k.team = [k.team[0], Math.round(k.team[1] * f * 1000) / 1000, k.team[2]];
    return k;
  };
  G.partyUnits = function (s) { return G.activeParty(s).map(id => G.unitOf(s, id)); };
})(typeof window !== 'undefined' ? window : globalThis);

// 정보 탭: 영웅 목록·상세·편성·인연·공명
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- 영웅 ----------
let heroFE = '', heroFS = 0;   // 정보 탭 영웅 필터: 속성('' = 전체), 등급(0 = 전체). 정렬은 전투력 고정(편성 영웅 우선)
let heroView = 'hero';
function renderHeroes(m) {
  if (heroView === 'equip') { renderEquip(m); bindViewSeg(m, 'hv', v => heroView = v); return; }
  const owned = Object.keys(S.heroes).map(Number);
  owned.sort((a, b) => G.heroPower(S, b) - G.heroPower(S, a));
  const slots = G.slots(S);
  const ap = G.activeParty(S); owned.sort((a, b) => (ap.includes(a) ? ap.indexOf(a) : 99) - (ap.includes(b) ? ap.indexOf(b) : 99)); // 편성 영웅 먼저(대표→동료 순)
  const shown = owned.filter(id => (!heroFE || byId(id).elem === heroFE) && (!heroFS || byId(id).star === heroFS));
  const n3 = owned.filter(id => byId(id).star === 3).length;
  const nLB = owned.filter(id => G.canLB(S, id)).length;
  m.innerHTML = `${viewSeg('hero', ['hero', '영웅'], ['equip', '장비'], 'hv')}
    <div class="pcard"><div class="ph"><div>출전 중 <b>${ap.length}</b> / ${slots}</div></div>
    <div class="party">${[0, 1, 2, 3, 4].map(i => { if (i >= slots) return `<div class="slot locked">잠김<br>${C.SLOT_UNLOCK[i]}스테이지</div>`; const id = S.party[i]; return id && S.heroes[id] ? `<div class="slot filled ${i === 0 ? 'main' : ''} ${G.canLB(S, id) ? 'lbready' : ''}" data-slot="${i}"><span class="tag">${i + 1}</span><img src="${imgOf(id)}" alt="${byId(id).name}"><em class="snm">${byId(id).name.split(' ').pop()}</em><em class="sinf num">${slotInfo(id)}</em></div>` : `<div class="slot" data-slot="${i}"><span class="tag">${i + 1}</span>빈 자리</div>`; }).join('')}</div></div>
    <h3 style="margin:12px 0 6px">보유 영웅 <span class="muted num">${shown.length}</span></h3>
    <div class="hfilt"><button class="fchip ${!heroFE ? 'on' : ''}" data-fe="">전체</button>${C.ELEMS.map(e => `<button class="fchip ${heroFE === e ? 'on' : ''}" data-fe="${e}">${elemDot(e)}${C.ELEM_NAME[e]}</button>`).join('')}</div>
    <div class="hfilt"><button class="fchip ${!heroFS ? 'on' : ''}" data-fs="0">전체</button>${[3, 2, 1].map(n => `<button class="fchip ${heroFS === n ? 'on' : ''}" data-fs="${n}">★${n}</button>`).join('')}</div>
    <div class="hgrid">${shown.map(id => heroCard(id)).join('')}</div>`;
  bindViewSeg(m, 'hv', v => heroView = v);
  m.querySelectorAll('.fchip[data-fe]').forEach(b => b.onclick = () => { heroFE = b.dataset.fe; render(); });
  m.querySelectorAll('.fchip[data-fs]').forEach(b => b.onclick = () => { heroFS = +b.dataset.fs; render(); });
  m.querySelectorAll('.hgrid .hcard').forEach(c => c.onclick = () => openHero(+c.dataset.id));
  m.querySelectorAll('.party .slot:not(.locked)').forEach(sl => sl.onclick = () => openSlotPicker(+sl.dataset.slot));
}
function partyChanged() { save(); if (BC.st) BC.rebuild(true); }
function openSlotPicker(slot) {
  const cur = S.party[slot];
  const cands = Object.keys(S.heroes).map(Number).filter(id => !S.party.includes(id)).sort((a, b) => G.heroPower(S, b) - G.heroPower(S, a));
  modal(`<h2>${slot === 0 ? '대표' : slot + '번 동료'} ${cur ? '교체' : '편성'}</h2>
    ${cur && slot > 0 ? `<button class="btn s" id="slot-clear">현재 동료(${byId(cur).name}) 해제</button>` : ''}
    <h3>편성 가능한 영웅</h3><div class="hgrid">${cands.map(id => heroCard(id, { noParty: true })).join('') || '<div class="muted">편성할 영웅이 없습니다</div>'}</div>`);
  const sc = $('#slot-clear'); if (sc) sc.onclick = () => { S.party.splice(slot, 1); S.party = S.party.filter(Boolean); partyChanged(); closeModal(); render(); };
  document.querySelectorAll('#modal .hcard').forEach(c => c.onclick = () => { const id = +c.dataset.id; if (cur) S.party[slot] = id; else { S.party = S.party.filter(Boolean); if (S.party.length < G.slots(S)) S.party.push(id); } partyChanged(); closeModal(); render(); });
}
function openHero(id) {
  const ch = byId(id); const h = S.heroes[id]; const st = G.heroStats(S, id); const sks = G.unitOf(S, id).skills;
  const lb = G.lbCost(S, id); const skc = G.skillUpCost(S, id); const inParty = S.party.includes(id); const isMain = S.party[0] === id;
  const hasIll = !!illOf(id);
  const sig = sigOf(id);
  const lbcol = ch.star >= C.LB_STAR_MIN ? `<div class="lbcol">${lbTag(h.lb, true) || '<span class="lbtag big" style="opacity:.6">돌파 <small>0 / ' + C.LB_MAX + '</small></span>'}</div>` : '';
  const tags = `<div class="tags"><span class="role">${elemDot(ch.elem)}${C.ELEM_NAME[ch.elem]} · ${C.ROLE_KR[ch.role]}</span><span class="role">${C.heroRange(ch) > 15 ? '원거리' : '근접'}</span><span class="role num">전투력 ${fmt(G.heroPower(S, id))}</span>${isMain ? '<span class="role gold">대표</span>' : inParty ? '<span class="role gold">출전</span>' : ''}${hasIll ? '' : `<span class="role">패시브 ${passiveDesc(ch.role)}</span>`}</div>`;
  // 일러스트가 있으면 속성·역할 태그와 돌파 표시는 일러스트 위쪽에 겹쳐 둔다(아래 패널을 줄여 그림이 더 보이게)
  const ill = hasIll ? illustBlock(id).replace('<span class="il-hint">', `<div class="iltop">${tags}</div><span class="il-hint">`) : illustBlock(id);
  modal(`${ill}<div class="detail ${hasIll ? 'compact' : ''}"><img src="${imgOf(id)}" alt="${ch.name}"><div class="info">
      <div class="hd"><div>${stars(ch.star)}<div class="name dnm"><span class="nmt">${ch.name}</span>${hasIll && lbcol ? lbcol : ''}</div>${sig ? `<div class="quote">“${sig.line}”</div>` : ''}</div>
        ${hasIll ? `<div class="psv"><span>패시브</span>${passiveDesc(ch.role)}</div>` : lbcol}</div>
      ${hasIll ? '' : tags}
    </div></div>
    ${lvRow(id)}
    <div class="statgrid"><div><span>공격력</span><b>${fmt(st.atk)}</b></div><div><span>체력</span><b>${fmt(st.hp)}</b></div><div><span>방어력</span><b>${fmt(st.def)}</b></div><div><span>치명 ${(st.crit * 100).toFixed(0)}%</span><b>${Math.round(st.cdmg * 100)}%</b></div></div>
    <div class="skrow">${sks.map(sk => skillCard(sk, '', h.slv || 1)).join('')}</div>
    ${G.exOk(id) ? (G.exOn(S, id) ? `<div class="exslot"><div class="sh"><b>전용장비</b><button class="btn s" id="exopen">변경</button></div>${exCard(G.exOn(S, id), { on: true, noCmp: true })}</div>` : `<div class="exslot empty"><div class="sh"><b>전용장비</b><span class="tiny">비어 있음</span><button class="btn s" id="exopen">장착</button></div></div>`) : ''}
    <div class="actions">
      <button class="btn p" id="skup" ${skc == null || S.gold < skc ? 'disabled' : ''}>스킬 강화<span class="cost">${skc == null ? '최대 ' + C.skillLvMax(h.lb) : fmt(skc) + ico('gold')}</span></button>
      ${ch.star >= C.LB_STAR_MIN ? `<button class="btn ${h.lb >= 5 && lb != null ? 'tr' : ''} ${lb != null && h.shards >= lb ? 'lbgo' : ''}" id="lbup" ${lb == null || h.shards < lb ? 'disabled' : ''}>${h.lb >= 5 ? '초월' : '돌파'}<span class="cost num">${lb == null ? '최대' : '조각 ' + h.shards + '/' + lb}</span></button>` : ''}
      <button class="btn" id="setmain" ${isMain ? 'disabled' : ''}>대표 지정<span class="cost">${isMain ? '현재 대표' : '앞장서기'}</span></button>
      <button class="btn" id="pty" ${isMain ? 'disabled' : ''}>${inParty ? '출전 해제' : '출전'}<span class="cost">${inParty ? '' : G.slots(S) <= 1 ? `${5 * C.STAGE_DISP}스테이지~` : (S.party.filter(Boolean).length >= G.slots(S) ? '자리 교체' : '빈 자리')}</span></button>
    </div>
    ${setChips(id)}${sig ? `<div class="lore">${sig.intro}</div>` : ''}
    `);
  bindIllust($('#modal-box'));
  { const bx = $('#modal-box'), il = bx.querySelector('.illust'); const over = bx.scrollHeight - bx.clientHeight; if (il && over > 0) il.style.height = Math.max(300, il.offsetHeight - over) + 'px'; }   // 한 화면에 들어가게: 넘치는 만큼 일러스트 높이를 줄임(2026-10-30)
  document.querySelectorAll('#modal .setchip').forEach(b => b.onclick = () => { closeModal(); codexF.view = 'sets'; codexF.focus = b.dataset.set; setTab('codex'); });
  const re = () => { const sc = $('#modal-box').scrollTop; partyChanged(); renderTop(); openHero(id); $('#modal-box').scrollTop = sc; };
  $('#skup').onclick = () => { G.skillUp(S, id); re(); };
  if ($('#xp1')) $('#xp1').onclick = () => { const n = G.useXpot(S, id, G.xpotNeedToNext(S, id)); if (n) { BC._rb = true; re(); } };
  if ($('#xpmax')) $('#xpmax').onclick = () => { const n = G.useXpot(S, id, 1e9); if (n) { BC._rb = true; re(); } };
  if ($('#ascup')) $('#ascup').onclick = () => { if (G.ascend(S, id)) { BC._rb = true; save(); re(); const lr = document.querySelector('#modal .lvrow'); if (lr) lr.classList.add('ascfx'); } };
  bindSrc($('#modal-box'), () => openHero(id));   // 승급석 숫자 → 획득처(닫으면 이 영웅으로 돌아옴)
  if ($('#exopen')) { $('#exopen').onclick = () => openExList(id); const ec = document.querySelector('.exslot .eqcard[data-exid]'); if (ec) ec.onclick = () => openExList(id); }
  if ($('#lbup')) $('#lbup').onclick = () => { if (G.limitBreak(S, id)) { const now = S.heroes[id].lb; toast(now > 5 ? (now === C.LB_MAX ? `초월 완성! ${ch.name}의 고유 스킬이 진각성했습니다` : `초월 ${now - 5}단계! 전 능력치 ×${C.TR_MULT}`) : `돌파 성공! 전 능력치 +${Math.round(C.LB_STEP * 100)}%`, now === C.LB_MAX ? 3200 : 1800); } re(); };
  $('#setmain').onclick = () => { S.party = [id].concat(S.party.filter(x => x !== id)).slice(0, 5); partyChanged(); closeModal(); render(); toast(`${ch.name}이(가) 대표가 되었습니다`); };
  $('#pty').onclick = () => {
    if (inParty) { S.party = S.party.filter(x => x !== id); partyChanged(); closeModal(); render(); return; }
    if (G.slots(S) <= 1) { toast(`${5 * C.STAGE_DISP}스테이지 개방`); return; }
    S.party = S.party.filter(Boolean);
    if (S.party.length < G.slots(S)) { S.party.push(id); partyChanged(); closeModal(); render(); return; }
    modal(`<h2>누구와 교체할까요?</h2><div class="hgrid" style="margin-top:8px">${S.party.slice(1).map(pid => heroCard(pid, { noParty: true })).join('')}</div>`);
    document.querySelectorAll('#modal .hcard').forEach(c => c.onclick = () => { const i = S.party.indexOf(+c.dataset.id); S.party[i] = id; partyChanged(); closeModal(); render(); });
  };
}
const TEAM_KR = { skl: ['스킬 피해', '%'], cdm: ['치명타 피해', '%p'], atk: ['공격력', '%'] };
function skillDesc(sk) { let d = skillDesc0(sk); if (sk.team) { const [k, v, dur] = sk.team, [nm, u] = TEAM_KR[k] || [k, '%']; d += `${d ? ' · ' : ''}아군 전체 ${nm} ${Math.round(v * 100)}${u}↑ ${dur}초`; } return C.durTxt(d); }   // 지속·세기는 실제 값으로(C.durTxt), 지원 1번의 아군 효과(sk.team) 포함   // 지속 시간은 실제 값(× C.BUFF_DUR)으로 표시
function skillDesc0(sk) {
  if (sk.sig) { let d = sk.desc; if (sk.bm && sk.mult) d = d.replace(Math.round(sk.bm * 100) + '%', Math.round(sk.mult * 100) + '%'); if (sk.bp && sk.pct) d = d.replace(Math.round(sk.bp * 100) + '%', Math.round(sk.pct * 100) + '%'); return d; }
  const p = Math.round(sk.mult * 100), D = sk.dur || 5;
  switch (sk.type) {
    case 'single': return `적 하나에 ${p}% 피해`;
    case 'multi': return `${p}% 피해 ${sk.hits}연타`;
    case 'aoe': return `주변 적 전체에 ${p}% 피해${sk.stun ? ` + ${sk.stun}초 기절` : ''}`;
    case 'bash': return `적 하나에 ${p}% 피해 + ${sk.stun || 1.2}초 기절`;
    case 'taunt': case 'guard': return sk.desc;
    case 'heal': return `체력이 가장 낮은 아군 회복(공격력 ${p}%)`;
    case 'healall': return `아군 전체 회복(공격력 ${p}%)`;
    case 'buffatk': return sk.mult ? `아군 전체 공격력 ${p}%↑ ${D}초` : '';
    case 'buffaspd': return `아군 전체 공격속도 ${p}%↑ ${D}초`;
    case 'debuffdef': return `주변 적 방어력 ${p}%↓ ${D}초`;
    case 'vulnall': return `주변 적 받는 피해 ${p}%↑ ${D}초`;
    case 'debuffatk': return `주변 적 공격력 ${p}%↓ ${D}초`;
    case 'slowall': return `주변 적 둔화 ${sk.dur || 4}초`;
    case 'guardall': return `아군 전체 방어력 ${p}%↑ ${D}초`;
    case 'whirl': return `주변 적에 ${p}% 피해 ${sk.hits}회`;
    case 'bless': return `아군 전체 회복(공격력 ${p}%) + 공격력 ${Math.round(sk.buff * 100)}%↑ ${D}초`;
    case 'sanctuary': return `5초간 아군 전체 지속 회복(공격력 ${p}%/초) + 방어력 ${Math.round((sk.def || 0.3) * 100)}%↑`;
    case 'shield': return `아군 전체에 최대 체력 ${Math.round(sk.pct * 100)}% 보호막 8초`;
  }
  return sk.desc;
}
const sigOf = (id) => (window.SIG || {})[id] || null;
function skillCard(sk, passive, slv) {
  return `<div class="skill ${sk.sig ? 'sig' : ''}"><div class="sic"><svg width="22" height="22"><use href="#i-${sk.sig ? 'sig' : 'skill'}"/></svg></div><div class="sb"><b>${sk.icon ? `<i class="skico" style="${C.skIcoBg(sk.icon)}"></i>` : ''}${sk.sig ? '<span class="sigtag">고유</span>' : sk.ult ? '<span class="sigtag">궁극기</span>' : ''}${sk.name}</b><br>${skillDesc(sk)} · 쿨 ${sk.cd}초${sk.exDesc ? `<br><span class="tiny" style="color:var(--q4)">${sk.exName} · ${C.durTxt(sk.exDesc)}</span>` : ''}${sk.fxDesc && !sk.sig && (C.ELEM_TEAM[sk.fx] || C.ELEM_DEBUFFS.includes(sk.fx) || (C.GIM_FX_TYPES.includes(sk.type) && sk.type !== 'taunt')) ? ` <span class="tiny">+ ${C.durTxt(sk.fxDesc)}</span>` : ''}${passive ? `<br><span class="tiny">패시브: ${passive}</span>` : ''}</div>${slv ? `<span class="slv num">Lv.${slv}</span>` : ''}</div>`;
}
function setChips(id) {   // 이 영웅이 속한 도감 인연(구성원을 한 번이라도 모두 얻으면 완성 → 전 능력치 영구 상승). 누르면 도감의 그 인연으로
  const sets = (window.SETS || []).filter(t => t.members.includes(id)); if (!sets.length) return '';
  return `<div class="setchips"><span class="lbl">도감 인연</span>${sets.map(t => { const n = G.setHave(S, t), on = n === t.members.length; return `<button class="setchip ${on ? 'on' : ''} ${t.five ? 'five' : ''}" data-set="${t.id}">${t.name} <span class="num">${on ? '완성' : n + '/' + t.members.length}</span></button>`; }).join('')}</div>`;
}
// 출전 칸 아래 정보: 레벨 · 돌파/초월 단계(2026-10-30)
function slotInfo(id) { const h = S.heroes[id], lb = (h && h.lb) || 0; const t = lb >= C.LB_MAX ? '진각성' : lb > 5 ? '초월' + (lb - 5) : lb ? '돌파' + lb : ''; return `${G.heroLv ? 'Lv.' + G.heroLv(S, id) : ''}${t ? ' · ' + t : ''}`; }
// 영웅 레벨 줄(2026-10-30): Lv·상한·공유 표시·경험치 바·물약 버튼
function lvRow(id) {
  const h = S.heroes[id]; if (!h || !G.heroLv) return '';
  const sync = G.syncLv(S), lv = G.heroLv(S, id, sync), cap = G.lvCapOf(S, id), sy = G.isSynced(S, id, sync);
  const exp = !sy && (h.lv || 1) >= lv ? (h.exp || 0) : 0, need = C.expNeed(lv), pct = lv >= cap ? 100 : Math.min(100, exp / need * 100);
  const n1 = G.xpotNeedToNext(S, id), have = S.xpot || 0;
  const asc = G.ascInfo(S, id);   // 승급 상한에 닿음: 물약 대신 승급 버튼
  if (asc) return `<div class="lvrow asc"><b class="num">Lv.${lv}</b><span class="cap num">/${cap}</span><div class="xpbar"><i style="width:100%"></i></div><button class="pot num srcb" data-src="u_${asc.elem}">${ico('ush', 'u-' + asc.elem)} ${fmt(asc.have)}<i></i></button>
    <button class="btn s ${asc.have >= asc.cost ? 'p' : ''}" id="ascup" ${asc.have >= asc.cost ? '' : 'disabled'}>승급<span class="cost num">${ico('ush', 'u-' + asc.elem)}${asc.cost}</span></button></div>`;
  return `<div class="lvrow"><b class="num">Lv.${lv}</b><span class="cap num">/${cap}</span>${sy ? '<span class="sync">공유</span>' : ''}
    <div class="xpbar"><i style="width:${pct.toFixed(1)}%"></i></div><span class="pot num">${ico('book')} ${fmt(have)}</span>
    <button class="btn s" id="xp1" ${lv >= cap || have < 1 ? 'disabled' : ''}>+1<span class="cost num">${lv >= cap ? '최대' : '×' + fmt(n1)}</span></button>
    <button class="btn s" id="xpmax" ${lv >= cap || have < 1 ? 'disabled' : ''}>모두</button></div>`;
}
function passiveDesc(role) { return { tank: '체력 +15%', dps: '공격력 +12%', heal: '치유량 +20%', sup: '속도 +10%' }[role]; }


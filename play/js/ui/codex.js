// 도감 탭: 영웅·인연·장비 도감
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- 도감 ----------
let codexF = { star: 0, elem: '', view: 'heroes', focus: null };
function renderCodex(m) {
  const n = G.ownedCounts(S); const bonus = G.codex(S);
  const sets = window.SETS || []; const act = sets.filter(t => G.setActive(S, t)).length; // 완성한 도감 인연
  const head = `<h2>도감 <span class="muted num">${G.dexIds(S).length}/${CHARS.length}</span></h2>
    <div class="chips"><button class="chip ${codexF.view === 'heroes' ? 'on' : ''}" data-view="heroes">영웅</button><button class="chip ${codexF.view === 'sets' ? 'on' : ''}" data-view="sets">인연 ${act}/${sets.length}</button><button class="chip ${codexF.view === 'equip' ? 'on' : ''}" data-view="equip">장비 ${Object.keys(G.ensureEq(S).dex).length}/${(window.EQ_UNIQUES || []).length}</button></div>`;
  if (codexF.view === 'equip') {
    const dex = S.eq.dex; const U = window.EQ_UNIQUES || [];
    const md = S.eq.mdex || {}; const dxb = G.eqDexBonus(S);
    const card = (u) => dex[u.id] ? `<div class="dexc g${md[u.id] ? 5 : u.g}"><b>${eqIco({ u: u.id }, 'dico')}${u.name}${md[u.id] ? ' <span class="mtag">신화</span>' : ''}</b>${(u.leg || []).map(([k, v]) => `<div class="lg">${C.eqOptTxt(k, md[u.id] ? v * C.mythMult(k) : v)}</div>`).join('')}${md[u.id] && Array.isArray(u.myth) ? `<div class="lg">${C.eqOptTxt(u.myth[0], u.myth[1])}</div>` : ''}<div class="k">${C.EQ_GRADES[u.g]} ${C.EQ_PART[u.p].kr}${u.k.length ? ' · ' + u.k.map(k => C.EQ_OPTS[k].kr).join(' · ') : ''}</div></div>`
      : `<div class="dexc no"><b>???</b><div class="k">${C.EQ_GRADES[u.g]} ${C.EQ_PART[u.p].kr}</div></div>`;
    m.innerHTML = head.replace(`<span class="muted num">${G.dexIds(S).length}/${CHARS.length}</span>`, `<span class="muted num">${Object.keys(dex).length}/${U.length}</span>`) + `<div class="dexsum num">레전드 ${dxb.nl}/${U.filter(u => u.g === 4).length} · 신화 ${dxb.nm}/${U.filter(u => u.myth).length} · 원정대 공격력·체력 <b>+${Math.round(dxb.v * 100)}%</b></div>` + C.EQ_PARTS.map(p => `<h3>${C.EQ_PART[p].kr}</h3><div class="dexgrid">${U.filter(u => u.p === p).sort((a, b) => a.g - b.g || a.id - b.id).map(card).join('')}</div>`).join('');
    m.querySelectorAll('.chip[data-view]').forEach(b => b.onclick = () => { codexF.view = b.dataset.view; codexF.focus = null; render(); });
    return;
  }
  if (codexF.view === 'sets') {   // 도감 인연: 구성원을 한 번이라도 모두 얻으면 완성(출전과 무관)
    const card = (t) => { const have = G.setHave(S, t), on = have === t.members.length;
        return `<div class="setcard ${on ? 'on' : ''} ${t.five ? 'five' : ''} ${codexF.focus === t.id ? 'focus' : ''}" id="set-${t.id}"><div class="row" style="justify-content:space-between"><b>${t.five ? '<span class="lbtag" style="margin-right:6px;vertical-align:2px">5인</span>' : ''}${t.name}</b><span class="num ${on ? 'ok' : ''}">${on ? '완성' : `${have}/${t.members.length}`}</span></div>
          <div class="seteff">${C.bondText(C.bondEff(t.eff))}</div><div class="tiny" style="margin:-4px 0 6px">${t.story || ''}</div>
          <div class="setmem">${t.members.map(id => { const c = byId(id), has = !!S.heroes[id], seen = has || S.seen[id]; return `<div class="sm ${seen ? 'has' : ''}" data-id="${id}"><img src="${imgOf(id)}" alt="" style="${seen ? '' : 'filter:brightness(0) opacity(.35)'}"><span>${seen ? c.name.split(' ').slice(-1)[0] : '???'}</span><i class="stars s${c.star}">${starStr(c.star)}</i></div>`; }).join('')}</div></div>`; };
    const ord = (l) => l.slice().sort((a, b) => (G.setActive(S, b) - G.setActive(S, a)) || (G.setHave(S, b) / b.members.length - G.setHave(S, a) / a.members.length));   // 완성 → 가까운 순
    m.innerHTML = head + `<div class="dexsum num">완성 ${act}/${sets.length}${act ? ' · ' + C.bondText(G.setBonus(S)) : ''}</div><h3>5인 인연</h3>${ord(sets.filter(t => t.five)).map(card).join('')}<h3>2~3인 인연</h3>${ord(sets.filter(t => !t.five)).map(card).join('')}`;
    m.querySelectorAll('.chip[data-view]').forEach(b => b.onclick = () => { codexF.view = b.dataset.view; codexF.focus = null; render(); });
    m.querySelectorAll('.sm').forEach(c => c.onclick = () => { const id = +c.dataset.id; if (S.heroes[id]) openHero(id); else openCodexInfo(id); });
    if (codexF.focus) { const el = $('#set-' + codexF.focus); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
    return;
  }
  const list = CHARS.filter(c => (!codexF.star || c.star === codexF.star) && (!codexF.elem || c.elem === codexF.elem));
  m.innerHTML = head + `
    <div class="card"><div class="kv"><span>★1 ${n[1]}/${CHARS.filter(c => c.star === 1).length} · ★2 ${n[2]}/${CHARS.filter(c => c.star === 2).length} · ★3 ${n[3]}/${CHARS.filter(c => c.star === 3).length}</span><span class="num" style="color:var(--gold)">전 능력치 +${(bonus * 100).toFixed(1)}%</span></div></div>
    <div class="chips"><button class="chip ${!codexF.star ? 'on' : ''}" data-star="0">전체</button>${[1, 2, 3].map(s => `<button class="chip ${codexF.star === s ? 'on' : ''}" data-star="${s}">${starStr(s)}</button>`).join('')}</div>
    <div class="chips"><button class="chip ${!codexF.elem ? 'on' : ''}" data-elem="">전체</button>${C.ELEMS.map(e => `<button class="chip ${codexF.elem === e ? 'on' : ''}" data-elem="${e}">${C.ELEM_NAME[e]}</button>`).join('')}</div>
    <div class="hgrid">${list.map(c => codexCard(c)).join('')}</div>`;
  m.querySelectorAll('.chip[data-view]').forEach(b => b.onclick = () => { codexF.view = b.dataset.view; render(); });
  m.querySelectorAll('.chip[data-star]').forEach(b => b.onclick = () => { codexF.star = +b.dataset.star; render(); });
  m.querySelectorAll('.chip[data-elem]').forEach(b => b.onclick = () => { codexF.elem = b.dataset.elem; render(); });
  m.querySelectorAll('.hcard').forEach(c => c.onclick = () => { const id = +c.dataset.id; if (S.heroes[id]) openHero(id); else openCodexInfo(id); });
}
function codexCard(c) {
  const seen = S.heroes[c.id] || S.seen[c.id];
  return `<div class="hcard s${c.star} e-${c.elem} ${seen ? '' : 'unowned'}" data-id="${c.id}"><div class="port"><img src="${imgOf(c.id)}" alt="" loading="lazy">${stars(c.star)}${S.heroes[c.id] ? lbTag(S.heroes[c.id].lb) : ''}</div><div class="meta"><div class="nm">${seen ? c.name : '???'}</div><div class="lv">${elemDot(c.elem)}${C.ROLE_KR[c.role]} · ${C.ELEM_NAME[c.elem]}</div></div></div>`;
}
function openCodexInfo(id) {
  const c = byId(id); const sks = C.skillsOf(c);
  modal(`${S.seen[id] ? illustBlock(id) : ''}<div class="detail ${S.seen[id] && illOf(id) ? 'compact' : ''}"><img src="${imgOf(id)}" alt="" style="${S.seen[id] ? '' : 'filter:brightness(0) opacity(.35)'}"><div class="info"><div class="hd"><div>${stars(c.star)}<div class="name">${S.seen[id] ? c.name : '???'}</div></div></div><div class="tags"><span class="role">${elemDot(c.elem)}${C.ELEM_NAME[c.elem]} · ${C.ROLE_KR[c.role]}</span><span class="role">미보유</span></div></div></div>
    ${sks.map(sk => skillCard(sk, '', 0)).join('')}${setChips(id)}${S.seen[id] && sigOf(id) ? `<div class="lore">${sigOf(id).intro}</div>` : ''}
    `);
  bindIllust($('#modal-box')); document.querySelectorAll('#modal .setchip').forEach(b => b.onclick = () => { closeModal(); codexF.view = 'sets'; codexF.focus = b.dataset.set; setTab('codex'); });
}

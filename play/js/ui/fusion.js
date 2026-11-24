// 조합 탭: 영웅 조합·장비 조합(유니크→레전드, 레전드→신화)
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- 조합 (★1 5명 → ★2 · ★2 3명 → ★3, 같은 속성) ----------
let fuse = { elem: 'fire', star: 1, sel: [], view: 'hero', part: 'wpn', esel: [], emode: 'leg', mbase: 0 };
function renderFusion(m) {
  if (fuse.view === 'equip') { renderEqFusion(m); bindViewSeg(m, 'fv', v => fuse.view = v); return; }
  const E = fuse.elem, ST = fuse.star, N = C.fusionN(ST);
  const matOf = (e, st) => Object.keys(S.heroes).map(Number).filter(id => { const c = byId(id); return c.elem === e && c.star === st && !S.party.includes(id); });
  const cands = matOf(E, ST).sort((a, b) => S.heroes[a].lb - S.heroes[b].lb || G.heroPower(S, a) - G.heroPower(S, b));
  fuse.sel = fuse.sel.filter(id => cands.includes(id));
  const err = G.canFuse(S, fuse.sel); const ready = fuse.sel.length === N && !err; const U = G.fuseCost(S, ST, E); const SL = (C.FUSION_SEAL || {})[ST] || 0, seal = S.seal || 0;
  const outs = CHARS.filter(c => c.star === ST + 1 && c.elem === E); const own2 = outs.filter(c => S.heroes[c.id]).length;
  const slot = (i) => { const id = fuse.sel[i]; return id ? `<div class="fslot filled e-${E}" data-id="${id}"><img src="${imgOf(id)}" alt="${byId(id).name}"><span class="n">${i + 1}</span></div>` : `<div class="fslot"><span class="n">${i + 1}</span>★${ST}</div>`; };
  const perElem = C.ELEMS.map(e => matOf(e, ST).length);
  m.innerHTML = `${viewSeg('hero', ['hero', '영웅 조합'], ['equip', '장비 조합'], 'fv')}<h2><button class="eyebrow srcb" data-src="seal">별의 인장 ${ico('seal')} ${S.seal || 0}<i></i></button>영웅 조합</h2>
    <div class="seg" style="margin-bottom:8px"><button class="${ST === 1 ? 'on' : ''}" data-fstar="1">★1 ${C.fusionN(1)}명 → ★2</button><button class="${ST === 2 ? 'on' : ''}" data-fstar="2">★2 ${C.fusionN(2)}명 → ★3</button></div>
    <div class="hfilt even5" style="margin-bottom:10px">${C.ELEMS.map((e, i) => `<button class="fchip ${E === e ? 'on' : ''}" data-elem="${e}">${elemDot(e)}${C.ELEM_NAME[e]} <span class="tiny num">${perElem[i]}</span></button>`).join('')}</div>
    <div class="fcard">
      <div class="fslots ${N > 3 ? 'five' : ''}">${Array.from({ length: N }, (_, i) => slot(i)).join('')}<svg class="farrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <div class="fout e-${E} ${ST === 2 ? 'gold' : ''}"><span class="q">?</span>${stars(ST + 1)}</div></div>
      <div class="fnote"><b>${C.ELEM_NAME[E]} ★${ST + 1}</b> <span class="num">${own2}/${outs.length}</span> · <b class="num">${Math.round((C.FUSION_RATE[ST] || 1) * 100)}%</b> · <button class="srcb" data-src="u_${E}"><b style="color:${G.ushOf(S, E) >= U ? `var(--e-${E})` : 'var(--bad)'}">${ico('ush', 'u-' + E)} ${U}</b> <span class="num">/ ${fmt(G.ushOf(S, E))}</span><i></i></button>${SL ? ` · <b style="color:${seal >= SL ? 'var(--gold3)' : 'var(--bad)'}">${ico('seal')} ${SL}</b> <span class="num">/ ${seal}</span>` : ''}</div>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn" id="fuse-auto" ${cands.length < N ? 'disabled' : ''} style="flex:1">자동 선택</button><button class="btn p" id="fuse-go" ${ready ? '' : 'disabled'} style="flex:1.4">조합하기<span class="cost">${ready ? '승급석 ' + U + (SL ? ' · 인장 ' + SL : '') : '선택 ' + fuse.sel.length + '/' + N}</span></button></div>
      ${err && fuse.sel.length === N ? `<div class="tiny" style="color:var(--bad);margin-top:6px">${err}</div>` : ''}</div>
    <h3>재료 영웅 <span class="muted num">${cands.length}</span></h3>
    <div class="hgrid">${cands.map(id => heroCard(id, { noParty: true, sel: fuse.sel.includes(id) })).join('')}</div>`;
  m.querySelectorAll('.seg button[data-fstar]').forEach(b => b.onclick = () => { fuse.star = +b.dataset.fstar; fuse.sel = []; render(); });
  m.querySelectorAll('.fchip[data-elem]').forEach(b => b.onclick = () => { fuse.elem = b.dataset.elem; fuse.sel = []; render(); });
  m.querySelectorAll('.hgrid .hcard').forEach(c => c.onclick = () => { const id = +c.dataset.id; if (fuse.sel.includes(id)) fuse.sel = fuse.sel.filter(x => x !== id); else if (fuse.sel.length < N) fuse.sel.push(id); render(); });
  m.querySelectorAll('.fslot.filled').forEach(c => c.onclick = () => { fuse.sel = fuse.sel.filter(x => x !== +c.dataset.id); render(); });
  bindSrc(m);
  $('#fuse-auto').onclick = () => { fuse.sel = cands.slice(0, N); render(); };
  $('#fuse-go').onclick = () => { const r = G.fuse(S, fuse.sel); if (r.err) { toast(r.err); return; } fuse.sel = []; save(true); afterFuse(r); };
  bindViewSeg(m, 'fv', v => fuse.view = v);
}
function renderEqFusion(m) {
  if (fuse.emode === 'myth') { renderMythFusion(m); return; }
  if (fuse.emode === 'mlb') { renderMythLb(m); return; }
  const P = fuse.part, N = C.EQ_FUSE.need; const cands = G.eqFuseMats(S, P);
  fuse.esel = fuse.esel.filter(id => cands.some(x => x.id === id)); const ready = fuse.esel.length === N;
  const per = C.EQ_PARTS.map(p => G.eqFuseMats(S, p).length);
  const legs = (window.EQ_UNIQUES || []).filter(u => u.g === 4 && u.p === P); const own = legs.filter(u => G.ensureEq(S).dex[u.id]).length;
  const slot = (i) => { const it = G.eqItem(S, fuse.esel[i]); return it ? `<div class="fslot filled eqf" data-eqid="${it.id}">${eqIco(it, 'fico') || `<svg class="fpi"><use href="#i-${it.p}"/></svg>`}<span class="n">${i + 1}</span></div>` : `<div class="fslot"><span class="n">${i + 1}</span><span class="eqg3">유니크</span></div>`; };
  m.innerHTML = `${viewSeg('equip', ['hero', '영웅 조합'], ['equip', '장비 조합'], 'fv')}<h2>장비 조합</h2>${emodeSeg()}
    <div class="hfilt" style="margin-bottom:10px">${C.EQ_PARTS.map((p, i) => `<button class="fchip ${P === p ? 'on' : ''}" data-epart="${p}">${C.EQ_PART[p].kr} <span class="tiny num">${per[i]}</span></button>`).join('')}</div>
    <div class="fcard">
      <div class="fslots">${Array.from({ length: N }, (_, i) => slot(i)).join('')}<svg class="farrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <div class="fout eqleg"><span class="q">?</span><span class="eqg4" style="font-size:11px;font-weight:800">레전드</span></div></div>
      <div class="fnote"><b class="eqg4">${C.EQ_PART[P].kr} 레전드</b> <span class="num">${own}/${legs.length}</span> · <b class="num">${Math.round(C.EQ_FUSE.rate * 100)}%</b></div>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn" id="efuse-auto" ${cands.length < N ? 'disabled' : ''} style="flex:1">자동 선택</button><button class="btn p" id="efuse-go" ${ready ? '' : 'disabled'} style="flex:1.4">조합하기<span class="cost">선택 ${fuse.esel.length}/${N}</span></button></div></div>
    <h3>재료 유니크 <span class="muted num">${cands.length}</span></h3>
    <div class="eqbag">${cands.map(it => eqCard(it, { small: true, noCmp: true }).replace('class="eqcard', `class="eqcard ${fuse.esel.includes(it.id) ? 'fsel' : ''}`)).join('')}</div>`;
  m.querySelectorAll('.fchip[data-epart]').forEach(b => b.onclick = () => { fuse.part = b.dataset.epart; fuse.esel = []; render(); });
  bindEmode(m);
  m.querySelectorAll('.eqbag .eqcard[data-eqid]').forEach(c => c.onclick = () => { const id = +c.dataset.eqid; if (fuse.esel.includes(id)) fuse.esel = fuse.esel.filter(x => x !== id); else if (fuse.esel.length < N) fuse.esel.push(id); render(); });
  m.querySelectorAll('.fslot.filled[data-eqid]').forEach(c => c.onclick = () => { fuse.esel = fuse.esel.filter(x => x !== +c.dataset.eqid); render(); });
  $('#efuse-auto').onclick = () => { fuse.esel = cands.slice(0, N).map(x => x.id); render(); };
  $('#efuse-go').onclick = () => { const r = G.eqFuse(S, fuse.esel); if (r.err) { toast(r.err); return; } fuse.esel = []; save(true); renderTop();
    if (r.fail) modal(`<h2>조합 실패</h2>${eqCard(r.kept, { noCmp: true })}`);
    else { modal(`<h2>조합 결과</h2>${eqCard(r.it, { isNew: true, noCmp: true })}`); const c = document.querySelector('#modal-box .eqcard'); if (c) c.classList.add('mythup'); if (G.eqIsOn(S, r.it)) partyChanged(true); }
    render(); };
}
const emodeSeg = () => `<div class="seg" style="margin-bottom:8px"><button class="${fuse.emode === 'leg' ? 'on' : ''}" data-emode="leg">유니크 → 레전드</button><button class="${fuse.emode === 'myth' ? 'on' : ''}" data-emode="myth">레전드 → 신화</button><button class="${fuse.emode === 'mlb' ? 'on' : ''}" data-emode="mlb">신화 돌파</button></div>`;
function bindEmode(m) { m.querySelectorAll('.seg button[data-emode]').forEach(b => b.onclick = () => { fuse.emode = b.dataset.emode; render(); }); }
function renderMythFusion(m) {
  const eq = G.ensureEq(S); const N = C.MYTH_NEED;
  const groups = {}; for (const it of eq.items) { if (it.g !== 4 || !(G.eqUnique(it.u) || {}).myth) continue; (groups[it.u] = groups[it.u] || []).push(it); }
  const bases = Object.values(groups).map(l => l.slice().sort((a, b) => (G.eqIsOn(S, b) - G.eqIsOn(S, a)) || (G.eqScore(S, b) - G.eqScore(S, a)))[0])
    .map(it => ({ it, n: G.mythMats(S, it).length + 1 })).sort((a, b) => (b.n >= N) - (a.n >= N) || b.n - a.n || b.it.p.localeCompare(a.it.p));
  if (!bases.some(x => x.it.id === fuse.mbase)) fuse.mbase = (bases.find(x => x.n >= N) || bases[0] || { it: {} }).it.id || 0;
  const base = G.eqItem(S, fuse.mbase); const mats = base ? G.mythMats(S, base).slice(0, N - 1) : [];
  const ok = base && mats.length >= N - 1 && S.crystal >= C.MYTH_COST;
  const icoOf = (it) => eqIco(it, 'fico') || `<svg class="fpi"><use href="#i-${it.p}"/></svg>`;
  const slots = [base].concat(Array.from({ length: N - 1 }, (_, i) => mats[i])).map((it, i) => it ? `<div class="fslot filled eqf leg">${icoOf(it)}<span class="n">${i + 1}</span></div>` : `<div class="fslot"><span class="n">${i + 1}</span><span class="eqg4">레전드</span></div>`).join('');
  m.innerHTML = `${viewSeg('equip', ['hero', '영웅 조합'], ['equip', '장비 조합'], 'fv')}<h2>장비 조합</h2>${emodeSeg()}
    <div class="fcard">
      <div class="fslots">${slots}<svg class="farrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <div class="fout eqmyth"><span class="q">?</span><span class="eqg5" style="font-size:11px;font-weight:800">신화</span></div></div>
      <div class="fnote">${base ? `<b class="eqg4">${G.eqName(base)}</b> <span class="num">${Math.min(N, mats.length + 1)}/${N}</span> · ` : ''}<b class="num">${Math.round(C.MYTH_RATE * 100)}%</b> · <b style="color:${S.crystal >= C.MYTH_COST ? 'var(--crys2)' : 'var(--bad)'}">${ico('crys')} ${fmt(C.MYTH_COST)}</b></div>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn myth ${ok ? 'p' : ''}" id="mfuse-go" ${ok ? '' : 'disabled'} style="flex:1">신화 등급업</button></div></div>
    <h3>레전드 <span class="muted num">${bases.length}</span></h3>
    <div class="eqbag">${bases.map(({ it, n }) => eqCard(it, { small: true, noCmp: true, on: G.eqIsOn(S, it) }).replace('class="eqcard', `class="eqcard ${it.id === fuse.mbase ? 'fsel' : ''} ${n >= N ? '' : 'dim'}`).replace('<div class="emain">', `<div class="emain"><span class="mcnt num ${n >= N ? 'ok' : ''}">${n}/${N}</span>`)).join('')}</div>`;
  bindEmode(m);
  m.querySelectorAll('.eqbag .eqcard[data-eqid]').forEach(c => c.onclick = () => { fuse.mbase = +c.dataset.eqid; render(); });
  const go = $('#mfuse-go'); if (go) go.onclick = () => { const it = G.eqItem(S, fuse.mbase); const r = G.mythUp(S, it); if (r.err) { toast(r.err); return; } save(true); renderTop();
    if (r.fail) modal(`<h2>등급업 실패</h2>${eqCard(it, { noCmp: true, on: G.eqIsOn(S, it) })}`);
    else { if (G.eqIsOn(S, it)) partyChanged(true); modal(`<h2>신화 등급업</h2>${eqCard(it, { noCmp: true, on: G.eqIsOn(S, it) })}`); const c = document.querySelector('#modal-box .eqcard'); if (c) c.classList.add('mythup'); }
    render(); };
}
function afterFuse(r) {
  const ch = byId(r.id);
  if (r.fail) { modal(`<h2>조합 실패</h2><div style="display:flex;justify-content:center">${heroCard(r.id, { noParty: true })}</div>`); render(); return; }
  if (ch.star === 3) { render(); renderTop(); summonFx([{ id: r.id, star: 3, isNew: r.isNew }]); return; }   // ★3 조합은 소환과 같은 연출(시즌 3: 인장을 쓰는 드문 사건)
  if (r.isNew && illOf(r.id)) { render(); reveal(r.id); return; }
  modal(`<h2>조합 결과</h2><div style="display:flex;justify-content:center">${heroCard(r.id, { isNew: r.isNew, noParty: true })}</div><div style="text-align:center;margin-top:8px" class="muted">${ch.name} ${r.isNew ? '새 영웅 획득!' : (ch.star >= C.LB_STAR_MIN ? '중복 → 조각 +' + C.DUPE_SHARDS[ch.star] : '중복 → 승급석 +' + C.DUPE_USHARD[ch.star])}</div>`);
  render();
}
function renderMythLb(m) {
  const eq = G.ensureEq(S); const groups = {};
  for (const it of eq.items) if (it.g === 5) (groups[it.u] = groups[it.u] || []).push(it);
  const bases = Object.values(groups).map(l => l.slice().sort((a, b) => (G.eqIsOn(S, b) - G.eqIsOn(S, a)) || ((b.lb || 0) - (a.lb || 0)) || (G.eqScore(S, b) - G.eqScore(S, a)))[0])
    .map(it => ({ it, n: G.mythLbMats(S, it).length })).sort((a, b) => ((b.n > 0 && (b.it.lb || 0) < C.MYTH_LB.max) - (a.n > 0 && (a.it.lb || 0) < C.MYTH_LB.max)) || b.n - a.n);
  if (!bases.some(x => x.it.id === fuse.mlbBase)) fuse.mlbBase = (bases.find(x => x.n > 0) || bases[0] || { it: {} }).it.id || 0;
  const base = G.eqItem(S, fuse.mlbBase); const mat = base ? G.mythLbMats(S, base)[0] : null; const lb = base ? base.lb || 0 : 0; const mx = lb >= C.MYTH_LB.max;
  const ok = base && mat && !mx && S.crystal >= C.MYTH_LB.cost;
  const icoOf = (it) => eqIco(it, 'fico') || `<svg class="fpi"><use href="#i-${it.p}"/></svg>`;
  const slot = (it, i) => it ? `<div class="fslot filled eqf myth">${icoOf(it)}<span class="n">${i + 1}</span>${it.lb ? `<span class="mlb num">+${it.lb}</span>` : ''}</div>` : `<div class="fslot"><span class="n">${i + 1}</span><span class="eqg5">신화</span></div>`;
  m.innerHTML = `${viewSeg('equip', ['hero', '영웅 조합'], ['equip', '장비 조합'], 'fv')}<h2>장비 조합</h2>${emodeSeg()}
    <div class="fcard">
      <div class="fslots">${slot(base, 0)}${slot(mat, 1)}<svg class="farrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <div class="fout eqmyth"><span class="q num">${mx ? 'MAX' : '+' + (lb + 1)}</span><span class="eqg5" style="font-size:11px;font-weight:800">${mx ? '' : '+' + Math.round(C.MYTH_LB.step * 100) + '%'}</span></div></div>
      <div class="fnote">${base ? `<b class="eqg5">${G.eqName(base)}</b> <span class="num">+${lb}/${C.MYTH_LB.max}</span> · ` : ''}<b style="color:${S.crystal >= C.MYTH_LB.cost ? 'var(--crys2)' : 'var(--bad)'}">${ico('crys')} ${fmt(C.MYTH_LB.cost)}</b></div>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn myth ${ok ? 'p' : ''}" id="mlb-go" ${ok ? '' : 'disabled'} style="flex:1">신화 돌파</button></div></div>
    <h3>신화 <span class="muted num">${bases.length}</span></h3>
    <div class="eqbag">${bases.map(({ it, n }) => eqCard(it, { small: true, noCmp: true, on: G.eqIsOn(S, it) }).replace('class="eqcard', `class="eqcard ${it.id === fuse.mlbBase ? 'fsel' : ''} ${n > 0 && (it.lb || 0) < C.MYTH_LB.max ? '' : 'dim'}`).replace('<div class="emain">', `<div class="emain"><span class="mcnt num ${n > 0 ? 'ok' : ''}">재료 ${n}</span>`)).join('')}</div>`;
  bindEmode(m);
  m.querySelectorAll('.eqbag .eqcard[data-eqid]').forEach(c => c.onclick = () => { fuse.mlbBase = +c.dataset.eqid; render(); });
  const go = $('#mlb-go'); if (go) go.onclick = () => { const it = G.eqItem(S, fuse.mlbBase); const r = G.mythLb(S, it); if (r.err) { toast(r.err); return; } save(); renderTop(); if (G.eqIsOn(S, it)) partyChanged(true);
    modal(`<h2>신화 돌파 +${r.lb}</h2>${eqCard(it, { noCmp: true, on: G.eqIsOn(S, it) })}`); const c = document.querySelector('#modal-box .eqcard'); if (c) c.classList.add('mythup'); render(); };
}

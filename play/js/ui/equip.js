// 장비·전용장비: 카드·상세·옵션 재설정·장비 소환·전용 소환
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- 장비 (랜덤 옵션) ----------
const optLine = (k, t, v, m) => `<div class="eopt ${t === 5 ? 'leg' : ''}"><span class="ot t${t}">${C.EQ_OPT_TIERS[t]}</span>${C.eqOptTxt(k, v * (m || 1))}</div>`;
// 옵션 재설정 패널: 옵션 줄의 자물쇠로 잠금, 보석으로 나머지를 다시 굴림
function rerollPanel(it, m) {
  const idx = G.rerollIdx(it); if (!idx.length) return '';
  const locks = G.rerollLocks(it), cost = G.rerollPrice(it), full = locks.length >= idx.length;
  return `<div class="rr"><div class="rrh"><b>옵션 재설정</b><span class="tiny">잠금 ${locks.length}/${idx.length - 1}</span></div>
    ${idx.map(i => { const [k, t, v] = it.o[i]; const on = locks.includes(i); return `<button class="rrl ${on ? 'on' : ''}" data-oi="${i}"><svg class="pi" width="15" height="15"><use href="#i-lock"/></svg>${optLine(k, t, G.optVal(it, t, v), m)}${i === G.rerollSig(it) ? '<span class="rsig">고유</span>' : ''}</button>`; }).join('')}
    <button class="btn p" id="rr-go" ${full || (S[G.rerollCur(it)] || 0) < cost ? 'disabled' : ''}>다시 굴리기<span class="cost">${ico(it.h ? 'xst' : 'crys')}${fmt(cost)}</span></button></div>`;
}
function bindReroll(kind, it, reopen) {
  document.querySelectorAll('#modal .rrl').forEach(b => b.onclick = () => { const i = +b.dataset.oi, idx = G.rerollIdx(it); let ol = G.rerollLocks(it); if (ol.includes(i)) ol = ol.filter(x => x !== i); else if (ol.length < idx.length - 1) ol = ol.concat(i); else return; if (ol.length) it.ol = ol; else delete it.ol; save(); reopen(); });
  const go = $('#rr-go'); if (go) go.onclick = () => { const r = G.optReroll(S, kind, it); if (r.err) { toast(r.err); return; } save(true); renderTop(); if (kind === 'eq' && G.eqIsOn(S, it) || kind === 'ex' && G.exIsOn(S, it)) partyChanged(true); reopen(); };
}
// 고유 장비 속성 칩: 전설·고유 옵션의 속성 키(e_*) 기준, 레전드 이상은 없으면 '무속성'
function eqElemChips(it) { const els = [...new Set((it.o || []).filter((x, i) => G.eqFixed(it, i) && /^e_/.test(x[0])).map(x => x[0].slice(2)))]; return els.map(e => `<span class="elchip e-${e}">${elemDot(e)}${C.ELEM_NAME[e]}</span>`).join(''); }   // 2026-11-20 속성 장비 복원 — 전설 줄 속성만 표시(무속성 꼬리표는 붙이지 않음)   // 2026-11-15: 장비에 속성이 없어져(속성 영웅 공격력 옵션 삭제) 속성 꼬리표를 표시하지 않음 — 남겨 두면 레전드 전부에 '무속성'이 붙음
function eqCard(it, o) {
  o = o || {}; if (!it) return `<div class="eqcard empty"><span class="tiny">비어 있음</span></div>`;
  const m = o.mult || 1; const better = !o.noCmp && G.eqBetter(S, it);
  return `<div class="eqcard eg${it.g} ${o.on ? 'on' : ''} ${o.small ? 'sm' : ''}" data-eqid="${it.id}">
    <div class="eh">${eqIco(it) || `<svg class="pi"><use href="#i-${it.p}"/></svg>`}<b>${G.eqName(it)}</b>${it.u ? `<span class="gt ${it.g === 5 && it.lb ? 'lbon' : ''}">${C.EQ_GRADES[it.g]}${it.g === 5 ? ` <span class="num">${it.lb || 0}/${C.MYTH_LB.max}</span>` : ''}</span>` : ''}${it.lk ? '<svg class="lk"><use href="#i-lock"/></svg>' : ''}${o.on ? '<span class="eqon">장착</span>' : better ? '<span class="up">▲</span>' : ''}${o.isNew ? '<span class="new">NEW</span>' : ''}</div>
    ${!o.small && eqElemChips(it) ? `<div class="eels full">${eqElemChips(it)}</div>` : ''}<div class="emain">${C.eqMainTxt(it.p, G.eqMain(it) * m)}</div>
    ${o.small ? `<div class="eopts sm">${it.o.map(([k, t]) => `<span class="ot t${t}">${C.EQ_OPT_TIERS[t]}</span>`).join('')}<span class="eels">${eqElemChips(it)}</span></div>` : `<div class="eopts">${it.o.map(([k, t, v]) => optLine(k, t, G.optVal(it, t, v), m)).join('')}</div>`}</div>`;
}
function openEqItem(id) {
  const it = G.eqItem(S, id); if (!it) return; const on = G.eqIsOn(S, it); const cur = G.eqOn(S, it.p); const m = 1 + C.EQ_LV_STEP * (S.eq.lv[it.p] || 0);
  modal(`<h2>${C.EQ_PART[it.p].kr}</h2>${eqCard(it, { on, mult: m, noCmp: true })}
    ${!on && cur ? `<div class="tiny" style="margin:10px 0 4px">현재 장착</div>${eqCard(cur, { on: true, mult: m, noCmp: true })}` : ''}
    <div class="tiny" style="margin-top:8px">점수 ${G.eqScore(S, it).toFixed(1)}${!on && cur ? ' · 장착 ' + G.eqScore(S, cur).toFixed(1) : ''}</div>
    ${rerollPanel(it, m)}
    ${it.g === 4 && (G.eqUnique(it.u) || {}).myth ? (() => { const n = G.mythMats(S, it).length + 1, ok = n >= C.MYTH_NEED && S.crystal >= C.MYTH_COST; return `<button class="btn myth ${ok ? 'p' : ''}" id="eqi-myth" ${ok ? '' : 'disabled'}>신화 등급업 <b class="num">${Math.round(C.MYTH_RATE * 100)}%</b><span class="cost num">${G.eqName(it)} ${Math.min(n, C.MYTH_NEED)}/${C.MYTH_NEED} · ${ico('crys')}${fmt(C.MYTH_COST)}</span></button>`; })() : ''}
    ${it.g === 5 ? (() => { const n = G.mythLbMats(S, it).length, lb = it.lb || 0, mx = lb >= C.MYTH_LB.max, ok = !mx && n >= 1 && S.crystal >= C.MYTH_LB.cost; return `<button class="btn myth ${ok ? 'p' : ''}" id="eqi-mlb" ${ok ? '' : 'disabled'}>${mx ? '신화 돌파 MAX' : `신화 돌파 +${lb + 1}`}<span class="cost num">${mx ? '' : `${G.eqName(it)} ${Math.min(n, 1)}/1 · ${ico('crys')}${fmt(C.MYTH_LB.cost)}`}</span></button>`; })() : ''}
    <div class="actions" style="margin-top:12px"><button class="btn lkbtn ${it.lk ? 'on' : ''}" id="eqi-lk"><svg class="pi" width="18" height="18"><use href="#i-lock"/></svg>${it.lk ? '잠금 해제' : '잠금'}</button><button class="btn" id="eqi-salv" ${on || it.lk || it.g >= 5 ? 'disabled' : ''}>분해<span class="cost">+${C.EQ_SALVAGE[it.g]}${ico('est')}</span></button><button class="btn p" id="eqi-eq" ${on ? 'disabled' : ''}>${on ? '장착 중' : '장착'}</button></div>`);
  $('#eqi-lk').onclick = () => { if (it.lk) delete it.lk; else it.lk = 1; save(); openEqItem(id); };
  bindReroll('eq', it, () => openEqItem(id));
  const lbb = $('#eqi-mlb'); if (lbb) lbb.onclick = () => { const r = G.mythLb(S, it); if (r.err) { toast(r.err); return; } save(); renderTop(); if (G.eqIsOn(S, it)) partyChanged(true); toast(`${G.eqName(it)} +${r.lb}`, 2000); openEqItem(id); const c = document.querySelector('#modal-box .eqcard'); if (c) c.classList.add('mythup'); };
  const mb = $('#eqi-myth'); if (mb) mb.onclick = () => { const r = G.mythUp(S, it); if (r.err) { toast(r.err); return; } save(); renderTop(); if (r.fail) { toast(`신화 등급업 실패 · 레전드 ${r.used}개 소모`, 2400); openEqItem(id); return; } if (G.eqIsOn(S, it)) partyChanged(true); toast(`${G.eqName(it)} 신화 등급업!`, 2400); openEqItem(id); const c = document.querySelector('#modal-box .eqcard'); if (c) c.classList.add('mythup'); };
  $('#eqi-eq').onclick = () => { G.eqEquip(S, it.id); save(); partyChanged(true); closeModal(); render(); };
  $('#eqi-salv').onclick = () => { G.eqSalvageOne(S, it); save(); closeModal(); render(); };
}
let eqPart = '';
function renderEquip(m) {
  const eq = G.ensureEq(S); const b = G.eqBonus(S);
  const slot = (p) => { const it = G.eqOn(S, p), lv = eq.lv[p] || 0, c = G.eqUpCost(S, p), mx = G.eqUpMax(S, p), mul = 1 + C.EQ_LV_STEP * lv;
    return `<div class="eqslot"><div class="sh"><b>${C.EQ_PART[p].kr}</b><span class="lvl num">강화 Lv.${lv} · ×${mul.toFixed(2)}</span>
      <button class="btn s ${(S.estone || 0) >= c ? 'p' : ''}" data-equp="${p}" data-n="1" ${(S.estone || 0) >= c ? '' : 'disabled'}>강화<span class="cost">${ico('est')}${fmt(c)}</span></button><button class="btn s" data-equp="${p}" data-n="${mx.n}" ${mx.n > 1 ? '' : 'disabled'}>최대<span class="cost">+${mx.n}</span></button></div>
      ${eqCard(it, { on: true, mult: mul, noCmp: true })}</div>`; };
  const bag = eq.items.filter(x => !G.eqIsOn(S, x) && (!eqPart || x.p === eqPart)).sort((a, x) => (G.eqBetter(S, x) - G.eqBetter(S, a)) || x.g - a.g || G.eqScore(S, x) - G.eqScore(S, a));
  const nBetter = eq.items.filter(x => G.eqBetter(S, x)).length;
  const sumKeys = Object.keys(b).sort((a, x) => (C.EQ_OPT_KEYS.indexOf(a)) - (C.EQ_OPT_KEYS.indexOf(x)));
  m.innerHTML = `${viewSeg('equip', ['hero', '영웅'], ['equip', '장비'], 'hv')}
    <div class="eqslots">${C.EQ_PARTS.map(slot).join('')}</div>
    ${sumKeys.length ? `<div class="eqsum"><span>장착 효과 합계</span><div>${sumKeys.map(k => `<em>${C.eqOptTxt(k, b[k])}</em>`).join('')}</div></div>` : ''}
    <div class="row" style="gap:8px;margin:12px 0 6px;align-items:center"><span class="tiny" style="flex:1">자동 분해</span><div class="seg">${[-1, 0, 1, 2].map(g => `<button class="${eq.salv === g ? 'on' : ''}" data-salv="${g}">${g < 0 ? '끔' : C.EQ_GRADES[g] + (g ? ' 이하' : '')}</button>`).join('')}</div></div>
    <div class="eqbtns"><button class="btn s" id="eq-auto">추천 장착</button><button class="btn s" id="eq-salvw">하위 장비 분해</button></div>
    <div class="hfilt">${[['', '전체'], ...C.EQ_PARTS.map(p => [p, C.EQ_PART[p].kr])].map(([p, n]) => `<button class="fchip ${eqPart === p ? 'on' : ''}" data-eqp="${p}">${n}</button>`).join('')}</div>
    <div class="eqbag">${bag.map(it => eqCard(it, { small: true })).join('') || '<div class="card muted" style="grid-column:1/-1">비어 있음</div>'}</div>`;
  m.querySelectorAll('.fchip[data-eqp]').forEach(x => x.onclick = () => { eqPart = x.dataset.eqp; render(); });
  m.querySelectorAll('button[data-salv]').forEach(x => x.onclick = () => { eq.salv = +x.dataset.salv; save(); render(); });
  m.querySelectorAll('button[data-equp]').forEach(x => x.onclick = () => { if (G.eqUp(S, x.dataset.equp, +x.dataset.n)) { save(); partyChanged(true); render(); } });
  m.querySelectorAll('.eqbag .eqcard, .eqslot .eqcard[data-eqid]').forEach(x => x.onclick = () => openEqItem(+x.dataset.eqid));
  $('#eq-auto').onclick = () => { const n = G.eqAutoEquip(S); if (!n) { toast('이미 점수가 가장 높은 장비를 장착 중입니다'); return; } save(); partyChanged(true); render(); toast(`${n}개 부위 교체`); };
  $('#eq-salvw').onclick = () => { const r = G.eqSalvageWorse(S); if (!r.n) { toast('분해할 장비가 없습니다'); return; } save(); render(); toast(`${r.n}개 분해 +${fmt(r.stone)}${ico('est')}`); };
}
let lastEqPull = null;
function renderEqGacha(m) {
  const eq = G.ensureEq(S); const lv = G.eqSummonLv(S); const next = C.EQ_SLV[lv];
  const prev = C.EQ_SLV[lv - 1]; const prog = next ? (eq.pulls - prev) / (next - prev) : 1;
  const rate = C.EQ_RATE[lv - 1]; const cost = C.EQ_COST;
  const btn = (n, cls) => `<button class="btn ${cls || ''}" data-eqpull="${n}" ${S.crystal < cost * n ? 'disabled' : ''}>${n}회<span class="cost">${ico('crys')}${(cost * n).toLocaleString()}</span></button>`;
  m.innerHTML = `${viewSeg('equip', ['hero', '영웅 소환'], ['equip', '장비 소환'], 'gv', ['ex', '전용 소환'])}
    <div class="card eqsl"><div class="lbl"><b>소환 Lv.${lv}</b><span class="num">${next ? `${eq.pulls - prev} / ${next - prev}` : 'MAX'}</span></div><div class="bar"><i style="width:${Math.min(100, prog * 100)}%"></i></div>
      <div class="eqrate">${C.EQ_GRADES.slice(0, rate.length).map((g, i) => `<span class="eqg${i}">${g} ${rate[i]}%</span>`).join('')}</div></div>
    <div class="pullbtns three">${btn(1)}${btn(10, 'p')}${btn(100)}</div>
    <div class="card" style="margin-top:10px"><div class="pity"><div class="lbl"><b>천장 게이지</b><span><em>${C.EQ_PITY - (eq.pity || 0)}회</em> 남음 · ${eq.pity || 0} / ${C.EQ_PITY}</span></div><div class="bar"><i style="width:${(eq.pity || 0) / C.EQ_PITY * 100}%"></i></div></div></div>
    <div id="eqres"></div>
    ${legDex()}`;
  m.querySelectorAll('button[data-eqpull]').forEach(x => x.onclick = () => { const r = G.eqPull(S, +x.dataset.eqpull); if (!r) return; lastEqPull = r; save(true); if (r.some(z => z.equipped)) partyChanged(true); renderTop(); render(); });
  if (!lastEqPull && eq.last && eq.last.length) lastEqPull = eq.last.map(x => ({ it: G.eqItem(S, x.id) || { id: x.id, g: x.g, p: x.p, u: x.u }, kept: !!x.k, stone: x.st }));
  if (lastEqPull) showEqPull(lastEqPull);
  m.querySelectorAll('.legdex .ld[data-u]').forEach(c => c.onclick = () => { const it = G.ensureEq(S).items.filter(x => x.u === +c.dataset.u).sort((a, b) => b.g - a.g || G.eqScore(S, b) - G.eqScore(S, a))[0]; if (it) openEqItem(it.id); });
}
// 레전드 도감 미리보기: 부위별 5종, 보유 수 n/3(신화 재료), 신화는 분홍 테두리, 미보유는 어둡게
function legDex() {
  const eq = G.ensureEq(S); const L = (window.EQ_UNIQUES || []).filter(u => u.g === 4);
  const cell = (u) => { const n = eq.items.filter(x => x.u === u.id && x.g === 4).length, my = eq.items.some(x => x.u === u.id && x.g === 5), seen = eq.dex[u.id];
    return `<div class="ld ${my ? 'my' : ''} ${seen ? '' : 'no'}" data-u="${u.id}">${eqIco({ u: u.id }, 'ldi') || `<svg class="ldp"><use href="#i-${u.p}"/></svg>`}<b>${seen ? u.name : '???'}</b><span class="num ${n >= C.MYTH_NEED ? 'ok' : ''}">${my ? '신화' : n + '/' + C.MYTH_NEED}</span></div>`; };
  return `<div class="card legdex" style="margin-top:10px"><h3 style="margin:0 0 8px">레전드 <span class="muted num">${L.filter(u => eq.dex[u.id]).length}/${L.length}</span></h3><div class="ldrow">${C.EQ_PARTS.map(p => L.filter(u => u.p === p).map(cell).join('')).join('')}</div></div>`;
}
function showEqPull(r) {
  const kept = r.filter(x => x.kept && G.eqItem(S, x.it.id)); const salv = r.filter(x => !x.kept); const stone = salv.reduce((a, x) => a + (x.stone || 0), 0);
  const list = kept.slice().sort((a, b) => b.it.g - a.it.g).slice(0, 30);
  const cnt = C.EQ_GRADES.map((g, i) => r.filter(x => x.it.g === i).length);
  $('#eqres').innerHTML = `<div class="card" style="margin-top:10px"><h3 style="margin:0 0 6px">소환 결과 <span class="tiny">${r.length}개</span></h3>
    <div class="eqrate" style="margin:0 0 8px">${cnt.map((n, i) => n ? `<span class="eqg${i}">${C.EQ_GRADES[i]} ${n}</span>` : '').join('')}${salv.length ? `<span>자동 분해 ${salv.length} · +${stone}${ico('est')}</span>` : ''}</div>
    <div class="eqbag">${list.map(x => eqCard(x.it, { small: true, isNew: true })).join('')}</div></div>`;
  document.querySelectorAll('#eqres .eqcard').forEach(x => x.onclick = () => openEqItem(+x.dataset.eqid));
}

// ---------- 전용장비 ----------
const exMainTxt = (it) => { const m = G.exMain(it); return (m.k === 'heal' ? '치유량' : m.k === 'hp' ? '체력' : '공격력') + ' +' + Math.round(m.v * 1000) / 10 + '%'; };
const EX_NOICO = new Set([108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127]);   // 레전드 전용장비 아이콘 미수령 영웅 id(받으면 제거)
const EQ_ICO = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35, 36, 37]);   // img/eq/u{고유 장비 id}.png 가 있는 유니크·레전드 (128px) — 그림을 넣으면 id 추가
const eqIco = (it, cls) => it.u && EQ_ICO.has(it.u) ? `<img class="${cls || 'exico'}" src="img/eq/u${it.u}.png" alt="">` : '';
function exCard(it, o) {
  o = o || {}; if (!it) return `<div class="eqcard empty"><span class="tiny">비어 있음</span></div>`;
  const L = G.exLeg(it); const better = !o.noCmp && G.exBetter(S, it);
  return `<div class="eqcard eg${it.g} ${o.small ? 'sm' : ''}" data-exid="${it.id}">
    <div class="eh">${L && !EX_NOICO.has(it.h) ? `<img class="exico" src="img/exitem/${it.h}${it.L}.png" alt="">` : '<svg class="pi"><use href="#i-spark"/></svg>'}<b>${G.exName(it)}${it.lb ? ` <span class="mlb num">+${it.lb}</span>` : ''}</b>${L && !o.small ? `<span class="gt">${L === (EXCLUSIVE[it.h] || {}).a ? '강화' : '변화'}</span>` : ''}${it.lk ? '<svg class="lk"><use href="#i-lock"/></svg>' : ''}${o.on ? '<span class="eqon">장착</span>' : better ? '<span class="up">▲</span>' : ''}${o.isNew ? '<span class="new">NEW</span>' : ''}</div>
    ${o.who ? `<div class="tiny" style="margin-top:1px">${byId(it.h).name}</div>` : ''}
    <div class="emain">${exMainTxt(it)}</div>
    ${o.small ? `<div class="eopts sm">${L ? '<span class="ot t5">L</span>' : ''}${it.o.map(([k, t]) => `<span class="ot t${t}">${C.EQ_OPT_TIERS[t]}</span>`).join('')}</div>`
      : `<div class="eopts">${L ? `<div class="eopt leg"><span class="ot t5">L</span>${C.durTxt(L.desc)}</div>` : ''}${it.o.map(([k, t, v]) => optLine(k, t, v, G.exLbMult(it))).join('')}</div>`}</div>`;
}
function openExItem(id, back) {
  const it = G.exItem(S, id); if (!it) return; const on = G.exIsOn(S, it); const cur = G.exOn(S, it.h);
  modal(`<h2>${byId(it.h).name} 전용장비</h2>${exCard(it, { on, noCmp: true })}
    ${!on && cur ? `<div class="tiny" style="margin:10px 0 4px">현재 장착</div>${exCard(cur, { on: true, noCmp: true })}` : ''}
    ${rerollPanel(it, 1)}
    <div class="actions" style="margin-top:12px">${`<button class="btn lkbtn ${it.lk ? 'on' : ''}" id="exi-lk"><svg class="pi" width="18" height="18"><use href="#i-lock"/></svg>${it.lk ? '잠금 해제' : '잠금'}</button>`}${it.L ? (() => { const n = G.exLbMats(S, it).length, lb = it.lb || 0, mx = lb >= C.EX_LB.max; const c = mx ? 0 : G.exLbCost(it), ok = !mx && n && (S.xstone || 0) >= c; return `<button class="btn ${ok ? 'p' : ''}" id="exi-lb" ${ok ? '' : 'disabled'}>${mx ? '돌파 MAX' : '돌파 +' + (lb + 1)}<span class="cost num">${mx ? '' : '재료 ' + n + ' · ' + ico('xst') + fmt(c)}</span></button>`; })() : ''}<button class="btn" id="exi-salv" ${on || it.lk ? 'disabled' : ''}>분해<span class="cost">${'+' + C.EX_SALVAGE[it.g] + ico('xst')}</span></button><button class="btn p" id="exi-eq" ${on ? 'disabled' : ''}>${on ? '장착 중' : '장착'}</button></div>`);
  $('#exi-eq').onclick = () => { G.exEquip(S, it.id); save(); partyChanged(true); back ? back() : (closeModal(), render()); };
  $('#exi-salv').onclick = () => { G.exSalvage(S, it); save(); back ? back() : (closeModal(), render()); };
  const lbb = $('#exi-lb'); if (lbb) lbb.onclick = () => { const r = G.exLb(S, it); if (r.err) { toast(r.err); return; } save(); if (G.exIsOn(S, it)) partyChanged(true); toast(`${G.exName(it)} +${r.lb}`); renderTop(); openExItem(id, back); };
  const lkb = $('#exi-lk'); if (lkb) lkb.onclick = () => { if (it.lk) delete it.lk; else it.lk = 1; save(); openExItem(id, back); };
  bindReroll('ex', it, () => openExItem(id, back));
}
function openExList(hid) {
  const items = G.ensureEx(S).items.filter(x => x.h === hid).sort((a, b) => G.exIsOn(S, b) - G.exIsOn(S, a) || b.g - a.g || G.exScore(S, b) - G.exScore(S, a));
  modal(`<h2>${byId(hid).name} 전용장비 <span class="muted num">${items.length}</span></h2>
    <div class="row" style="gap:6px;margin-bottom:8px"><button class="btn s" id="exl-auto">추천 장착</button><button class="btn s" id="exl-salv">하위 분해</button><button class="btn s p" id="exl-pull">전용 소환</button></div>
    <div class="eqbag">${items.map(it => exCard(it, { small: true, on: G.exIsOn(S, it) })).join('') || '<div class="card muted" style="grid-column:1/-1">보유한 전용장비가 없습니다</div>'}</div>`);
  document.querySelectorAll('#modal .eqcard[data-exid]').forEach(x => x.onclick = () => openExItem(+x.dataset.exid, () => openExList(hid)));
  $('#exl-auto').onclick = () => { if (G.exAutoEquip(S, hid)) { save(); partyChanged(true); } openExList(hid); };
  $('#exl-salv').onclick = () => { const r = G.exSalvageWorse(S, hid); if (r.n) { save(); toast(`${r.n}개 분해 +${r.stone}${ico('xst')}`); } openExList(hid); };
  $('#exl-pull').onclick = () => { gachaView = 'ex'; closeModal(); setTab('gacha'); };
}
let lastExPull = null;
function renderExGacha(m) {
  const ex = G.ensureEx(S); const n3 = Object.keys(S.heroes).map(Number).filter(G.exOk).length;
  const lv = G.exSummonLv(S); const next = C.EX_SLV[lv], prev = C.EX_SLV[lv - 1]; const prog = next ? (ex.pulls - prev) / (next - prev) : 1; const rate = C.EX_RATE[lv - 1];
  const btn = (n, cls) => `<button class="btn ${cls || ''}" data-expull="${n}" ${!n3 || (S.xstone || 0) < C.EX_COST * n ? 'disabled' : ''}>${n}회<span class="cost">${ico('xst')}${(C.EX_COST * n).toLocaleString()}</span></button>`;
  m.innerHTML = `${viewSeg('ex', ['hero', '영웅 소환'], ['equip', '장비 소환'], 'gv', ['ex', '전용 소환'])}
    <div class="card eqsl"><div class="lbl"><b>소환 Lv.${lv}</b><span class="num">${next ? `${ex.pulls - prev} / ${next - prev}` : 'MAX'}</span></div><div class="bar"><i style="width:${Math.min(100, prog * 100)}%"></i></div>
      <div class="eqrate">${C.EQ_GRADES.slice(0, rate.length).map((g, i) => `<span class="eqg${i}">${g} ${rate[i]}%</span>`).join('')}</div></div>
    <div class="pullbtns three">${btn(1)}${btn(10, 'p')}${btn(50)}</div>
    <div class="row" style="gap:8px;margin:10px 0 6px;align-items:center"><span class="tiny" style="flex:1">자동 분해</span><div class="seg">${[-1, 0, 1, 2, 3].map(g => `<button class="${ex.salv === g ? 'on' : ''}" data-xsalv="${g}">${g < 0 ? '끔' : C.EQ_GRADES[g] + (g ? ' 이하' : '')}</button>`).join('')}</div></div>
    ${(() => { const d = G.exDupCount(S), w = G.exWorseCount(S); return `<div class="row" style="gap:6px"><button class="btn s" id="ex-salvall" style="flex:1" ${w ? '' : 'disabled'}>일괄 분해<span class="cost num">${w}</span></button><button class="btn s" id="ex-tidy" style="flex:1" ${d ? '' : 'disabled'}>중복 정리<span class="cost num">${d}</span></button></div>`; })()}
    <div id="exres"></div>`;
  m.querySelectorAll('button[data-xsalv]').forEach(x => x.onclick = () => { ex.salv = +x.dataset.xsalv; save(); render(); });
  $('#ex-salvall').onclick = () => { const r = G.exSalvageWorse(S); if (!r.n) return; save(); toast(`${r.n}개 분해 +${fmt(r.stone)}${ico('xst')}`); renderTop(); render(); };
  $('#ex-tidy').onclick = () => { const r = G.exTidy(S); if (!r.lb && !r.n) return; save(); partyChanged(true); toast(`돌파 ${r.lb} · 분해 ${r.n} +${r.stone}${ico('xst')}`); renderTop(); render(); };
  m.querySelectorAll('button[data-expull]').forEach(x => x.onclick = () => { const r = G.exPull(S, +x.dataset.expull); if (!r) return; lastExPull = r; save(true); if (r.some(z => z.equipped)) partyChanged(true); renderTop(); render(); });
  if (lastExPull) { const r = lastExPull; const kept = r.filter(x => x.kept && G.exItem(S, x.it.id)); const salv = r.filter(x => !x.kept); const stone = salv.reduce((a, x) => a + (x.stone || 0), 0);
    $('#exres').innerHTML = `<div class="card" style="margin-top:10px"><h3 style="margin:0 0 6px">소환 결과 <span class="tiny">${r.length}개</span></h3><div class="eqrate" style="margin:0 0 8px">${C.EQ_GRADES.map((g, i) => { const n = r.filter(x => x.it.g === i).length; return n ? `<span class="eqg${i}">${g} ${n}</span>` : ''; }).join('')}${salv.length ? `<span>자동 분해 ${salv.length} · +${stone}${ico('xst')}</span>` : ''}</div>
      <div class="eqbag">${kept.slice().sort((a, b) => b.it.g - a.it.g).slice(0, 30).map(x => exCard(x.it, { small: true, isNew: true, who: true, on: G.exIsOn(S, x.it) })).join('')}</div></div>`;
    document.querySelectorAll('#exres .eqcard[data-exid]').forEach(x => x.onclick = () => openExItem(+x.dataset.exid)); }
}

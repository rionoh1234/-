// 던전 탭: 레이드·탑 배너, 자원 던전·속성의 시련
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- 도전 (탑 · 레이드) ----------
function msLeft(ms) { if (ms <= 0) return '<span class="ok">충전 완료</span>'; const m = Math.ceil(ms / 60000); return `다음 충전 <b>${m >= 60 ? Math.floor(m / 60) + '시간 ' + (m % 60) + '분' : m + '분'}</b>`; }
function ticketPips(t) { return `<span class="pips">${[0, 1, 2].map(i => `<i class="${i < t ? 'on' : ''}"></i>`).join('')}</span>`; }
function rewardTxt(r) { return (r.gold ? `+${fmt(r.gold)}${ico('gold')} ` : '') + (r.crystal ? `+${r.crystal}${ico('crys')} ` : '') + (r.ushard ? `+${r.ushard}${ico('ush')} ` : '') + C.ELEMS.map(e => r['u_' + e] ? `+${r['u_' + e]}${ico('ush', 'u-' + e)} ` : '').join('') + (r.sshard ? `+${r.sshard}${ico('ssh')} ` : '') + (r.estone ? `+${fmt(r.estone)}${ico('est')} ` : '') + (r.xpot ? `+${fmt(r.xpot)}${ico('book')} ` : '') + (r.xstone ? `+${fmt(r.xstone)}${ico('xst')}` : '') + (r.seal ? ` +${r.seal}${ico('seal')}` : ''); }
function renderChallenge(m) {
  const now = Date.now(); G.refill(S, now);
  const dgOn = G.dgUnlocked(S); const endOn = S.maxClear >= 30 * C.STAGE_DISP;
  const f = S.tower.floor + 1; const tr = C.towerReward(f);
  const boss = C.raidBoss(S.raid.week || 0, C.sOld(S.maxClear)); const bossName = (MOBS.find(x => x.id === boss.id) || {}).name;
  const sw = G.sweepable(S);
  const DI = { gold: 'pick', crys: 'crys', xp: 'book', soul: 'altar', equip: 'est', t_fire: 'flame', t_water: 'spark', t_wind: 'spark', t_light: 'spark', t_dark: 'spark' };
  const msS = (ms) => { const mm = Math.ceil(ms / 60000); return mm >= 60 ? Math.floor(mm / 60) + '시간 ' + (mm % 60) + '분' : mm + '분'; };
  const row = (k) => {
    const d = C.DG[k], t = S.dg[k]; const next = t.lv + 1; const rwNext = C.dungeonReward(k, next); const left = G.nextRefillMs(t, now, C.TICKET_REFILL_MS);
    const nm = d.el ? C.ELEM_NAME[d.el] : d.name; const tn = d.el ? G.trialTeam(S, d.el).length : -1;   // 속성 시련은 그 속성 영웅만 출전(시즌 3)
    const ok = dgOn && t.t > 0 && next <= C.dgCap(S) && tn !== 0;
    return `<div class="dgr dg ${k}"><div class="dic"><svg width="18" height="18"><use href="#i-${DI[k]}"/></svg></div>
      <div class="dt"><div><b>${nm}</b> <span class="sub num">Lv.${t.lv}</span>${d.el ? ` <span class="sub num tn${tn < G.slots(S) ? ' low' : ''}">${tn}/${G.slots(S)}</span>` : ''}</div><div class="tk num">${ticketPips(t.t)}${t.t < C.TICKET_MAX && left > 0 ? `<span>${msS(left)}</span>` : ''}</div></div>
      <button class="btn s ${ok ? 'p' : ''}" data-dg="${k}" ${ok ? '' : 'disabled'}>Lv.${next}<span class="cost">${next <= C.dgCap(S) ? rewardTxt(rwNext) : next * 10 * C.STAGE_DISP + '스테이지'}</span></button>
      <button class="btn s ${t.lv && t.t ? 'on' : ''}" data-sweepall="${k}" ${t.lv && t.t ? '' : 'disabled'}>소탕<span class="cost">×${t.t}</span></button></div>`;
  };
  const RES = ['gold', 'crys', 'xp', 'soul', 'equip'], TRI = C.DG_KINDS.filter(k => k.startsWith('t_'));
  const grp = (id, title, ks) => { const n = ks.reduce((a, k) => a + (S.dg[k].lv ? S.dg[k].t : 0), 0); return `<div class="dgg"><div class="dggh"><b>${title}</b><button class="btn s ${n ? 'on' : ''}" data-gsweep="${id}" ${n ? '' : 'disabled'}>소탕 ×${n}</button></div>${ks.map(row).join('')}</div>`; };
  const est = C.DG_KINDS.reduce((a, k) => { const t = S.dg[k]; if (t.lv && t.t) { const r = C.dungeonReward(k, t.lv); a.gold += (r.gold || 0) * t.t; a.crystal += (r.crystal || 0) * t.t; a.estone += (r.estone || 0) * t.t; a.xstone += (r.xstone || 0) * t.t; for (const u of C.U_KEYS) if (r[u]) a[u] = (a[u] || 0) + r[u] * t.t; } return a; }, { gold: 0, crystal: 0, estone: 0, xstone: 0 });
  if (S.raid.best && S.raid.t) { const r = C.raidReward(S.raid.best, boss.hp, boss.elem); est.crystal += r.crystal * S.raid.t; for (const u of C.U_KEYS) if (r[u]) est[u] = (est[u] || 0) + r[u] * S.raid.t; }
  const anim = dgAnim ? 'anim' : ''; dgAnim = false;
  m.innerHTML = `<h2>던전 · 도전</h2>
    <div class="dgban raid ${anim} ${endOn ? '' : 'locked'}"><div class="art" style="background-image:url(img/dg/raid.jpg)"></div><img class="boss" src="img/mob/${boss.id}.png" alt="">
      <div class="info"><span class="ttl">주간 레이드</span><b>${bossName}</b><div class="tk num">${ticketPips(S.raid.t)}<span>${S.raid.best ? '최고 ' + fmt(S.raid.best) : ''}</span></div></div>
      <div class="acts">${endOn ? `<button class="btn s ${S.raid.t > 0 ? 'p' : ''}" id="raid-go" ${S.raid.t > 0 ? '' : 'disabled'}>도전<span class="cost">${C.RAID_TIME}초</span></button><button class="btn s ${S.raid.best && S.raid.t ? 'on' : ''}" id="raid-sweep" ${S.raid.best && S.raid.t ? '' : 'disabled'}>소탕<span class="cost">${S.raid.best ? rewardTxt(C.raidReward(S.raid.best, boss.hp, boss.elem)) : '-'}</span></button>` : `<span class="lk num">${30 * C.STAGE_DISP}스테이지</span>`}</div></div>
    <div class="dgban tower ${anim} ${endOn ? '' : 'locked'}"><div class="art" style="background-image:url(img/dg/tower.jpg)"></div><svg class="tico"><use href="#i-tower"/></svg>
      <div class="info"><span class="ttl">무한의 탑</span><b class="num">${S.tower.floor}층</b><div class="tk num"><span>${f}층 ${rewardTxt(tr)}</span>${f % 10 === 0 ? ` <button class="lbtag gim ${C.gimOf(f / 10 - 1)}" data-gim="${C.gimOf(f / 10 - 1)}">${C.GIM_KR[C.gimOf(f / 10 - 1)]}<i></i></button>` : ''}</div></div>
      <div class="acts">${endOn ? `<button class="btn s p" id="tower-go">${f}층 도전</button>` : `<span class="lk num">${30 * C.STAGE_DISP}스테이지</span>`}</div></div>
    ${dgOn ? '' : `<div class="card muted" style="margin-bottom:10px">${C.DG_UNLOCK}스테이지 개방</div>`}
    ${grp('res', '자원 던전', RES)}${grp('tri', '속성의 시련', TRI)}${dummyBlock()}`;
  bindDummy(m);
  m.querySelectorAll('button[data-gsweep]').forEach(b => b.onclick = () => { const ks = b.dataset.gsweep === 'res' ? RES : TRI; const tot = { gold: 0, crystal: 0, estone: 0, xstone: 0 }; let n = 0; for (const k of ks) { let r; while ((r = G.sweep(S, k))) { tot.gold += r.gold || 0; tot.crystal += r.crystal || 0; for (const u of C.U_KEYS) if (r[u]) tot[u] = (tot[u] || 0) + r[u]; tot.estone += r.estone || 0; tot.xstone += r.xstone || 0; tot.xpot = (tot.xpot || 0) + (r.xpot || 0); n++; } } if (n) { toast(`${n}장 소탕 ${rewardTxt(tot)}`, 2600); save(); render(); } });
  m.querySelectorAll('button[data-dg]').forEach(b => b.onclick = () => { const k = b.dataset.dg; if (S.dg[k].t < 1 || S.dg[k].lv + 1 > C.dgCap(S)) return; if (C.DG[k].el && !G.trialTeam(S, C.DG[k].el).length) return; /* 입장엔 이용권 1장 보유가 필요하지만 새 레벨 도전은 성공·실패 모두 소모하지 않음 */ BC.ctx = { kind: 'dungeon', dkind: k, level: S.dg[k].lv + 1 }; BC.st = null; BC.rebuild(false); save(); setTab('battle'); });
  m.querySelectorAll('button[data-sweep]').forEach(b => b.onclick = () => { const r = G.sweep(S, b.dataset.sweep); if (r) { toast(`${C.DG[b.dataset.sweep].name} 소탕 ${rewardTxt(r)}`); save(); render(); } });
  // 줄마다 소탕은 한 번 누를 때 1장씩(2026-11-19, 사용자 '꼭 한 번에 3번 다 해야 되나, 끊어서 하게') — 한꺼번에는 묶음 제목의 '소탕 ×n'
  m.querySelectorAll('button[data-sweepall]').forEach(b => b.onclick = () => { const k = b.dataset.sweepall; const r = G.sweep(S, k); if (r) { toast(`${C.DG[k].name} 소탕 ${rewardTxt(r)}`, 2200); save(); render(); } });
  if ($('#sweep-all')) $('#sweep-all').onclick = () => { const t = G.sweepAll(S); if (t.n) { toast(`${t.n}장 소탕 ${rewardTxt(t)}`, 3000); save(); render(); } };
  if ($('#raid-sweep')) $('#raid-sweep').onclick = () => { const r = G.sweepRaid(S); if (r) { toast(`레이드 소탕 ${rewardTxt(r)}`); save(); render(); } };
  m.querySelectorAll('[data-gim]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openGim(b.dataset.gim); });
  if ($('#tower-go')) $('#tower-go').onclick = () => { BC.ctx = { kind: 'tower', floor: S.tower.floor + 1 }; BC.st = null; BC.rebuild(false); BC.bossBanner = 1.6; setTab('battle'); };   // 진입 배너 'BOSS / 무한의 탑 n층'(사용자 2026-11-19)
  if ($('#raid-go')) $('#raid-go').onclick = () => { if (!G.useTicket(S.raid)) return; BC.ctx = { kind: 'raid' }; BC.st = null; BC.rebuild(false); save(); setTab('battle'); };
}
// 자원 획득처(2026-11-15, 사용자 '승급석은 어디서 나오나 · 도움말을 만들어야 하나'): 도움말 화면을 따로 두지 않고, 자원 숫자를 누르면 얻는 곳과 지금 받을 양을 보여 주고 바로 그 화면으로 이동
// key: 'u_속성'(승급석) · 'seal'(별의 인장). back = 닫을 때 돌아갈 화면을 다시 여는 함수(영웅 상세 등)
function srcRows(key) {
  const dgOn = G.dgUnlocked(S), endOn = S.maxClear >= 30 * C.STAGE_DISP; const rows = [];
  if (key === 'seal') {
    const gS = C.GATE.seal || C.GATE.every, gs = (Math.floor(S.maxClear / gS) + 1) * gS; rows.push({ name: '관문 돌파', val: `${gs}스테이지 +1`, go: 'battle' });
    const tf = (Math.floor(S.tower.floor / C.TOWER_SEAL) + 1) * C.TOWER_SEAL; rows.push({ name: '무한의 탑', val: endOn ? `${tf}층 +1` : `${30 * C.STAGE_DISP}스테이지 개방`, off: !endOn, go: 'challenge' });
    return { title: `${ico('seal')} 별의 인장`, have: S.seal || 0, rows, use: '★3 영웅 조합' };
  }
  const E = key.slice(2), EN = C.ELEM_NAME[E], uk = 'u_' + E;
  const t = S.dg['t_' + E], tn = G.trialTeam(S, E).length;
  rows.push({ name: `속성의 시련 · ${EN}`, val: !dgOn ? `${C.DG_UNLOCK}스테이지 개방` : !tn ? `${EN} 영웅 없음` : t.lv ? `Lv.${t.lv} 소탕 +${C.dungeonReward('t_' + E, t.lv)[uk]}` : `Lv.1 +${C.dungeonReward('t_' + E, 1)[uk]}`, off: !dgOn || !tn, go: 'challenge' });
  let f = S.tower.floor + 1; while (C.ELEMS[(f - 1) % 5] !== E) f++;
  rows.push({ name: '무한의 탑', val: endOn ? `${f}층 +${C.towerReward(f)[uk]}` : `${30 * C.STAGE_DISP}스테이지 개방`, off: !endOn, go: 'challenge' });
  const boss = C.raidBoss(S.raid.week || 0, C.sOld(S.maxClear)); const mine = boss.elem === E;
  rows.push({ name: '주간 레이드', val: !endOn ? `${30 * C.STAGE_DISP}스테이지 개방` : !mine ? `이번 주는 ${C.ELEM_NAME[boss.elem]}` : S.raid.best ? `소탕 +${C.raidReward(S.raid.best, boss.hp, boss.elem)[uk]}` : `이번 주 ${EN}`, off: !endOn || !mine, go: 'challenge' });
  rows.push({ name: `${EN} ★1 · ★2 중복 소환`, val: `+${C.DUPE_USHARD[1]} · +${C.DUPE_USHARD[2]}`, go: 'gacha' });
  return { title: `${ico('ush', 'u-' + E)} ${EN} 승급석`, have: G.ushOf(S, E), rows, use: '승급 · 영웅 조합' };
}
function openSrc(key, back) {
  const d = srcRows(key);
  modal(`<h2><span class="eyebrow num">보유 ${fmt(d.have)}</span>${d.title}</h2>
    <div class="srcl">${d.rows.map(r => `<button class="srcr" data-go="${r.go}" ${r.off ? 'disabled' : ''}><b>${r.name}</b><span class="v num">${r.val}</span><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>`).join('')}</div>
    <div class="srcuse">쓰는 곳 <b>${d.use}</b></div>`);
  document.querySelectorAll('#modal .srcr').forEach(b => b.onclick = () => { closeModal(); setTab(b.dataset.go); });
  if (back) $('#modal .close').onclick = back;
}
function bindSrc(root, back) { root.querySelectorAll('[data-src]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openSrc(b.dataset.src, back); }); }
function updateBadge() {
  if (!S || !S.dg) return; G.refill(S, Date.now());
  const n = G.sweepable(S) + (G.dgUnlocked(S) ? C.DG_KINDS.reduce((a, k) => a + (S.dg[k].lv ? 0 : S.dg[k].t), 0) : 0);
  const b = $('#tabs button[data-tab="challenge"] .badge'); if (b) { b.textContent = n; b.hidden = n === 0; }
}
setInterval(() => { updateBadge(); if (tab === 'challenge' && !document.hidden && $('#modal').hidden) render(); }, 30000);

// ---------- 허수아비(2026-11-23 사용자 '편성끼리 전투력 비교') ----------
// 편성(지금 편성 또는 저장한 속성 프리셋) × 허수아비 속성(무·5속성)을 골라 C.DUMMY_TIME초 동안 준 피해를 잼. 보상·이용권 없음. 기록은 S.dummy.log(최근 12)
function dmTeamName(t) { return t ? C.ELEM_NAME[t] + ' 프리셋' : '지금 편성'; }
function dmElName(e) { return e ? C.ELEM_NAME[e] : '무속성'; }
function dummyBlock() {
  const D = S.dummy || (S.dummy = { team: '', el: '', log: [] }), P = S.epresets || {};
  const tchip = (t, on, dis) => `<button class="fchip ${on ? 'on' : ''}" data-dmt="${t}" ${dis ? 'disabled' : ''}>${t ? elemDot(t) + C.ELEM_NAME[t] : '지금'}</button>`;
  const echip = (e, on) => `<button class="fchip ${on ? 'on' : ''}" data-dme="${e}">${e ? elemDot(e) + C.ELEM_NAME[e] : '무속성'}</button>`;
  return `<div class="dgg dmy"><div class="dggh"><b>허수아비</b><button class="btn s" id="dm-log" ${D.log.length ? '' : 'disabled'}>기록 ${D.log.length || ''}</button></div>
    <div class="dmrow"><span class="lb">편성</span>${tchip('', !D.team)}${C.ELEMS.map(e => tchip(e, D.team === e, !P[e])).join('')}</div>
    <div class="dmrow"><span class="lb">속성</span>${echip('', !D.el)}${C.ELEMS.map(e => echip(e, D.el === e)).join('')}</div>
    <button class="btn p dmgo" id="dm-go"><img src="img/mob/dummy.png" alt="">시작<span class="cost num">${C.DUMMY_TIME}초</span></button></div>`;
}
function bindDummy(m) {
  const D = S.dummy;
  m.querySelectorAll('[data-dmt]').forEach(b => b.onclick = () => { D.team = b.dataset.dmt; save(); const sc = $('#main').scrollTop; render(); $('#main').scrollTop = sc; });
  m.querySelectorAll('[data-dme]').forEach(b => b.onclick = () => { D.el = b.dataset.dme; save(); const sc = $('#main').scrollTop; render(); $('#main').scrollTop = sc; });
  if ($('#dm-go')) $('#dm-go').onclick = () => { if (D.team && !(S.epresets || {})[D.team]) D.team = ''; BC.ctx = { kind: 'dummy', team: D.team, el: D.el }; BC.st = null; BC.rebuild(false); setTab('battle'); };
  if ($('#dm-log')) $('#dm-log').onclick = () => openDummyResult(0);
}
function openDummyResult(i) {
  const L = (S.dummy && S.dummy.log) || [], r = L[i]; if (!r) return;
  const best = Math.max(...L.map(x => x.dmg)), tot = r.dmg || 1, ps = (x) => fmt(Math.round(x.dmg / (x.t || C.DUMMY_TIME)));
  const rows = r.h.slice().sort((a, b) => b[1] - a[1]).map(([id, v]) => { const c = byId(id), pc = v / tot * 100; return `<div class="dmh e-${c.elem}"><img src="${imgOf(id)}" alt=""><b>${c.name.split(' ').pop()}</b><div class="bar"><i style="width:${pc.toFixed(1)}%"></i></div><span class="num">${fmt(v)}</span><em class="num">${pc.toFixed(0)}%</em></div>`; }).join('');
  const hist = L.map((x, j) => `<button class="dml ${j === i ? 'on' : ''} ${x.dmg === best ? 'best' : ''}" data-dml="${j}"><span>${dmTeamName(x.team)}</span><span>${x.el ? elemDot(x.el) : ''}${dmElName(x.el)}</span><b class="num">${ps(x)}</b></button>`).join('');
  modal(`<h2><span class="eyebrow">허수아비 · ${r.t || C.DUMMY_TIME}초</span>${dmTeamName(r.team)} <small>${dmElName(r.el)}</small></h2>
    <div class="dmtot"><div><span>총 피해</span><b class="num">${fmt(r.dmg)}</b></div><div><span>초당</span><b class="num">${ps(r)}</b></div></div>
    <div class="dmhs">${rows}</div>
    <h3 style="margin:12px 0 6px">기록 <span class="muted num">초당 피해</span></h3><div class="dmls">${hist}</div>
    <div class="dmact"><button class="btn p" id="dm-again">다시<span class="cost">${dmTeamName(r.team)} · ${dmElName(r.el)}</span></button></div>`);
  document.querySelectorAll('#modal [data-dml]').forEach(b => b.onclick = () => openDummyResult(+b.dataset.dml));
  $('#dm-again').onclick = () => { const P = S.epresets || {}; closeModal(); BC.ctx = { kind: 'dummy', team: r.team && P[r.team] ? r.team : '', el: r.el }; BC.st = null; BC.rebuild(false); setTab('battle'); };
}

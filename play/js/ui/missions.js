// 일일 임무·업적 창 (상단 버튼 #btn-quest)
let questView = 'daily';
function updateQuestBadge() { const b = document.querySelector('#btn-quest .badge'); if (!b || !S) return; const n = G.questReady(S); b.hidden = !n; b.textContent = n; }
function openQuests() {
  const bar = (v, n) => `<div class="qbar"><i style="width:${Math.min(100, v / n * 100)}%"></i></div>`;
  const gem = (v) => `<span class="qgem">${ico('crys')}${v.toLocaleString()}</span>`;
  let body = '';
  if (questView === 'daily') {
    const L = G.dailyList(S), all = L.filter(x => x.got).length, br = G.dailyBonusReady(S), bg = S.daily.bonus;
    body = L.map(({ m, v, done, got }) => `<div class="qrow ${got ? 'got' : ''}"><div class="qt"><b>${m.name}</b><span class="num">${fmt(v)} / ${fmt(m.n)}</span>${bar(v, m.n)}</div>
      <button class="btn ${done && !got ? 'p' : ''}" data-qd="${m.id}" ${done && !got ? '' : 'disabled'}>${got ? '완료' : gem(C.DAILY_GEM)}</button></div>`).join('')
      + `<div class="qrow bonus ${bg ? 'got' : ''}"><div class="qt"><b>전체 완료</b><span class="num">${all} / ${C.DAILY.length}</span>${bar(all, C.DAILY.length)}</div>
      <button class="btn ${br ? 'p' : ''}" id="q-bonus" ${br ? '' : 'disabled'}>${bg ? '완료' : gem(C.DAILY_BONUS)}</button></div>`;
  } else {
    body = G.achList(S).map(({ a, v, got, next, ready, max }) => `<div class="qrow ${max ? 'got' : ''}"><div class="qt"><b>${a.name} <span class="tiny num">${got}/${a.t.length}</span></b><span class="num">${fmt(v)}${max ? '' : ' / ' + fmt(next)}</span>${bar(max ? 1 : v, max ? 1 : next)}</div>
      <button class="btn ${ready ? 'p' : ''}" data-qa="${a.id}" ${ready ? '' : 'disabled'}>${max ? '완료' : gem(C.ACH_GEM)}</button></div>`).join('');
  }
  const n = G.questReady(S);
  modal(`<h2>임무</h2><div class="seg qseg"><button class="${questView === 'daily' ? 'on' : ''}" data-qv="daily">일일</button><button class="${questView === 'ach' ? 'on' : ''}" data-qv="ach">업적</button></div>
    <div class="qlist">${body}</div><button class="btn p" id="q-all" style="width:100%;margin-top:10px" ${n ? '' : 'disabled'}>모두 받기</button>`);
  const done = (v) => { if (v) { save(); renderTop(); toast(`+${v.toLocaleString()} ${ico('crys')}`); } openQuests(); };
  document.querySelectorAll('#modal [data-qv]').forEach(b => b.onclick = () => { questView = b.dataset.qv; openQuests(); });
  document.querySelectorAll('#modal [data-qd]').forEach(b => b.onclick = () => done(G.dailyClaim(S, b.dataset.qd)));
  document.querySelectorAll('#modal [data-qa]').forEach(b => b.onclick = () => done(G.achClaim(S, b.dataset.qa)));
  const qb = $('#q-bonus'); if (qb) qb.onclick = () => done(G.dailyBonusClaim(S));
  $('#q-all').onclick = () => done(G.questClaimAll(S));
}
$('#btn-quest').onclick = () => openQuests();

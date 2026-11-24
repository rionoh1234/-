// 설정·백업, 방치 보상
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- 설정 ----------
function openSettings() {
  const days = ((Date.now() - (S.created || Date.now())) / 86400000).toFixed(1);
  modal(`<h2>설정 · 백업</h2>
    <div class="card" style="margin-bottom:10px"><div class="kv"><span>플레이 일수</span><span class="num">${days}일</span></div><div class="kv"><span>처치 / 보스 클리어</span><span class="num">${fmt(S.stats.kills || 0)} / ${S.stats.clears}회</span></div><div class="kv"><span>소환 / 조합</span><span class="num">${S.pulls} / ${S.stats.fusions}</span></div></div>
    <h3>계정</h3><div class="card"><div class="kv"><span>아이디</span><b>${ACCT ? ACCT.id : '로그인 안 됨'}</b></div>${ACCT ? '<div class="row" style="margin-top:6px"><button class="btn s" id="logout">로그아웃</button></div>' : ''}</div>
    <h3>저장</h3><div class="card"><div class="kv"><span>클라우드 저장</span><b>${CLOUD.doc ? (CLOUD.err ? '오류 (' + CLOUD.err + ')' : '연결됨') : '이 창에서는 사용 불가 (로컬만)'}</b></div><div class="kv"><span>마지막 클라우드 저장</span><span class="num">${CLOUD.lastOk ? Math.round((Date.now() - CLOUD.lastOk) / 1000) + '초 전' : '-'}</span></div></div>
    <details style="margin-top:10px"><summary class="tiny" style="cursor:pointer">백업 JSON (비상용)</summary><textarea id="exp" readonly>${G.serialize(S)}</textarea><div class="row" style="margin:6px 0"><button class="btn s" id="copy">복사</button></div><textarea id="imp" placeholder="백업 JSON 붙여넣기"></textarea><div class="row" style="margin:6px 0"><button class="btn s" id="import">가져오기</button></div></details>
    <h3>초기화</h3><div class="row"><button class="btn s" id="reset1">전체 초기화</button><span id="reset-confirm" hidden><button class="btn s" id="reset2" style="border-color:var(--bad);color:var(--bad)">정말 삭제</button></span></div>`);
  if ($('#logout')) $('#logout').onclick = () => logout();
  $('#copy').onclick = () => { const t = $('#exp'); navigator.clipboard.writeText(t.value).then(() => toast('복사했습니다')).catch(() => { t.focus(); t.select(); toast('길게 눌러 복사하세요'); }); };
  $('#import').onclick = () => { try { const s = G.deserialize($('#imp').value.trim()); BC.pause(); S = s; BC.st = null; S.lastTs = Date.now(); save(); cloudSave(true); closeModal(); render(); toast('불러왔습니다'); } catch (e) { toast('올바른 저장 데이터가 아닙니다'); } };
  $('#reset1').onclick = () => { $('#reset-confirm').hidden = false; $('#reset2').onclick = () => { BC.pause(); S = G.newState(Date.now()); BC.st = null; BC.ctx = { kind: 'stage' }; save(); closeModal(); render(); toast('초기화했습니다'); }; };
}

// ---------- 방치 보상 ----------
function checkIdle() {
  const now = Date.now(); G.refill(S, now);
  const r = G.idleReward(S, now);
  if (r.mins >= 1 && (r.gold > 0 || r.crystal > 0)) {
    G.applyIdle(S, now); save(); renderTop();
    const h = Math.floor(r.mins / 60), mm = Math.floor(r.mins % 60);
    modal(`<div class="idle"><h2>돌아오셨군요</h2><div class="muted num">${h}시간 ${mm}분</div><div class="big"><span>+${fmt(r.gold)} ${ico('gold')}</span><span>+${fmt(r.crystal)} ${ico('crys')}</span></div>${r.exp ? `<div class="muted num" style="margin-top:6px">출전 영웅 경험치 +${fmt(r.exp)}${r.lv ? ` · 레벨 +${r.lv}` : ''}</div>` : ''}</div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn p" id="idle-ok" style="min-width:140px">확인</button></div>`);
    $('#idle-ok').onclick = closeModal;
  } else { S.lastTs = now; }
  updateBadge();
}

// 도감 인연 완성 알림(구성원을 모두 얻은 순간 한 번)
let lastSets = null, lastSetsOf = null;
function checkSets() {
  const now = (window.SETS || []).filter(t => G.setActive(S, t)).map(t => t.id);
  if (lastSets && lastSetsOf === S) { let hit = false; for (const id of now) if (!lastSets.includes(id)) { const t = SETS.find(x => x.id === id); toast(`도감 인연 완성 · <b>${t.name}</b> ${C.bondText(C.bondEff(t.eff))}`, 3200); hit = true; } if (hit && BC.st) BC.rebuild(true); }
  lastSets = now; lastSetsOf = S;
}
setInterval(() => { if (S) checkSets(); }, 700);

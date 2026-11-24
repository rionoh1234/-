// 부팅: 로그인 → 불러오기 → 첫 화면
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- 부팅 ----------
// 시즌 초기화(2026-10-29): 예전 시즌 저장 데이터는 클라우드 backup/season{n}_{아이디}와 이 기기 localStorage에 보관하고 새로 시작. 운영 보상 지급 기록(gifts)은 이어받아 다시 지급되지 않게 함
function seasonCheck(old) {
  const sn = old.season || 1, json = G.serialize(old), id = ACCT ? ACCT.id : 'local';
  try { localStorage.setItem(SAVE_KEY + ':season' + sn + ':' + id, json); } catch (e) { }
  try { if (CLOUD.db && ACCT) CLOUD.db.doc('backup/season' + sn + '_' + id).set({ json, ts: Date.now(), maxClear: old.maxClear || 0 }).catch(() => { }); } catch (e) { }
  const s = G.newState(Date.now()); s.gifts = Object.assign({}, old.gifts || {}); return s;
}
async function boot() {
  $('#main').innerHTML = '<div class="card muted" style="margin-top:20px;text-align:center">불러오는 중…</div>';
  if (await dbConnect()) { const a = await autoLogin(); S = a === undefined ? await loginScreen() : a; }
  else S = load();   // 클라우드에 연결할 수 없는 창(권한 없음 등): 이 기기에만 저장
  let reset = false; if (S && (S.season || 1) < C.SEASON) { S = seasonCheck(S); reset = true; }
  const fresh = !S;
  if (fresh) { S = G.newState(Date.now()); }
  if (!fresh && !reset) checkIdle();   // 오프라인 보상은 저장(save가 lastTs를 지금으로 덮어씀)보다 먼저 — 2026-10-30 버그 수정: 새로 열면 보상이 0이던 문제
  save(); cloudSave(true);
  for (const id in S.heroes) S.seen[id] = 1;
  if (S.sshard == null) S.sshard = 0; if (!S.relics) S.relics = {};
  G.refill(S, Date.now()); updateBadge();
  { const gifts = G.applyGifts(S, ACCT ? ACCT.id : ''); if (gifts.length) { save(); cloudSave(true); setTimeout(() => modal(`<h2>보상 도착</h2>${gifts.map(x => `<div class="tiny" style="margin:6px 0 4px">${x.gift.name}</div>${x.item ? eqCard(x.item, { noCmp: true }) : ''}${x.removed && x.removed.length ? `<div class="tiny" style="margin:0 0 6px">${x.removed.map(([nm, n]) => `${nm} −${n}`).join(' · ')}</div>` : ''}${x.items && x.items.length ? `<div class="eqbag">${x.items.map(it => eqCard(it, { small: true, noCmp: true })).join('')}</div>` : ''}${x.gift.gold || x.gift.crystal ? `<div class="big">${x.gift.gold ? `<span>+${fmt(x.gift.gold)} ${ico('gold')}</span>` : ''}${x.gift.crystal ? `<span>+${fmt(x.gift.crystal)} ${ico('crys')}</span>` : ''}</div>` : ''}`).join('')}`), 600); } }
  setTab('battle');
  if (fresh) setTimeout(() => toast(migrated ? '새로 시작' : '사냥 시작!', 3600), 400);
  if (reset) setTimeout(() => toast('시즌 ' + C.SEASON + ' 시작 — 이전 기록은 보관됨', 4200), 400);
  setInterval(() => { if (!document.hidden) save(); }, 15000);
  window.addEventListener('resize', () => { if (tab === 'battle') BC.resize(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { BC.pause(); save(); cloudSave(true); }
    else { const gap = (Date.now() - S.lastTs) / 60000; if (gap >= 1) checkIdle(); else S.lastTs = Date.now(); if (tab === 'battle') BC.start(); }
  });
}
const start = () => boot();
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start();

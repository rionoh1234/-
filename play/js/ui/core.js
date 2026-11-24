// 공용: 상수·저장·계정·클라우드·공용 위젯(모달·토스트·카드)·탭 전환·이미지 캐시
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
const C = RPG.C, G = RPG.G, F = RPG.Field;
const SAVE_KEY = 'starband_save_v1';
const $ = (s, el) => (el || document).querySelector(s);
const byId = (id) => CHARS.find(c => c.id === id);
const IMGV = '?v=1120d'; window.IMGV = IMGV;   // 도트 그림을 바꿀 때 올림 — 폰 브라우저가 옛 그림을 캐시해 두는 것 방지(2026-10-27)
const imgOf = (id) => 'img/char/h' + String(id).padStart(3, '0') + '.png' + IMGV + ((byId(id) || {}).star === 3 ? '&hd' : '');   // &hd = ★3 고화질 그림(격자 없는 원화형 도트, 330×440) → CSS에서 부드럽게 축소, ★1·★2는 또렷하게(픽셀) (2026-11-20)
const fmt = (n) => C.fmt(n);
const starStr = (n) => '★'.repeat(n);
const stars = (n) => `<span class="stars s${n}">${starStr(n)}</span>`;
const elemDot = (e) => `<span class="elem ${e}" title="${C.ELEM_NAME[e]}"></span>`;
const ico = (k, cls) => `<svg class="ico ${k} ${cls || ''}" aria-hidden="true"><use href="#i-${k}"/></svg>`;
const RES_ICO = { gold: ico('gold'), crystal: ico('crys'), ushard: ico('ush'), sshard: ico('ssh'), estone: ico('est'), xstone: ico('xst') };
// 돌파 핍: 금 5(돌파 1~5) + 보라 5(초월 6~10)
function lbPips(lb, big) {
  lb = lb || 0;
  return `<span class="lbpips ${big ? 'big' : ''}" title="${C.lbLabel(lb)}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => `<i class="${i > 5 ? 't' : ''} ${lb >= i ? 'on' : ''}"></i>`).join('')}</span>`;
}
function lbTag(lb, big) {
  lb = lb || 0; if (!lb) return '';
  const txt = big ? (lb >= C.LB_MAX ? '진각성' : lb > 5 ? '초월' : '돌파') : (lb >= C.LB_MAX ? '진각성' : lb > 5 ? '초월 ' + (lb - 5) : '돌파 ' + lb);   // 큰 배지는 단계 숫자를 lb/10으로만 표시(중복 제거)
  return `<span class="lbtag ${lb > 5 ? 'tr' : ''} ${big ? 'big' : ''}">${txt}${big ? ` <small>${lb} / ${C.LB_MAX}</small>` : ''}</span>`;
}
const illCfg = (id) => { const v = (window.ILLUST || {})[id]; if (!v) return null; return typeof v === 'string' ? { src: v, zoom: 1.25, y: 15 } : v; };
const illOf = (id) => { const c = illCfg(id); return c ? c.src : null; };
function illustBlock(id, locked) {
  const c = illCfg(id); if (!c) return '';
  return `<div class="illust ${locked ? 'locked' : ''}" data-ill="${c.src}" role="button" tabindex="0" aria-label="일러스트 크게 보기"><img src="${c.src}" alt="${byId(id).name} 일러스트" style="transform:scale(${c.zoom || 1});transform-origin:50% ${c.y == null ? 15 : c.y}%"><span class="il-hint">⤢ 전체 보기</span></div>`;
}
function bindIllust(root) {
  (root || document).querySelectorAll('.illust').forEach(el => {
    const nx = el.nextElementSibling; // 바로 다음 정보 블록을 일러스트 하단에 겹쳐 올림
    if (nx && nx.classList.contains('ilinfo-src')) { nx.classList.add('ilinfo'); el.appendChild(nx); } // 상세창의 .compact 블록은 CSS로 겹침 처리
    if (el.classList.contains('locked')) return;
    el.onclick = (e) => { if (e.target.closest('.ilinfo')) return; openViewer(el.dataset.ill); };
    el.onkeydown = (e) => { if (e.key === 'Enter') openViewer(el.dataset.ill); };
  });
}
function openViewer(src) {
  const v = $('#viewer'); $('#viewer-img').src = src; v.classList.remove('zoom'); v.hidden = false; v.scrollTop = 0;
}

let S = null;
let tab = 'battle';
let migrated = false;

// ---------- 저장 ----------
// ---------- 저장: 클라우드(아티팩트 db) 한 곳을 모든 기기가 공유. localStorage는 캐시 ----------
const CLOUD = { db: null, doc: null, busy: false, pending: false, lastOk: 0, err: '', timer: null };
function save(now) {   // now: 뽑기·조합·옵션 굴리기처럼 결과가 무작위인 행동 — 클라우드에도 바로 올림(강제 종료로 되돌리기 방지)
  try { S.lastTs = Date.now(); localStorage.setItem(localKey(), G.serialize(S)); } catch (e) { }
  cloudSave(now);
}
function cloudSave(now) {
  if (!CLOUD.doc) return;
  if (CLOUD.timer) clearTimeout(CLOUD.timer);
  CLOUD.timer = setTimeout(cloudFlush, now ? 0 : 1500); // 연속 저장은 1.5초로 묶음
}
function cloudFlush() {
  CLOUD.timer = null; if (!CLOUD.doc) return;
  if (CLOUD.busy) { CLOUD.pending = true; return; }
  CLOUD.busy = true; CLOUD.pending = false;
  const body = { json: G.serialize(S), lastTs: S.lastTs || Date.now(), v: S.v || 3 };
  CLOUD.doc.update(body).then(() => { CLOUD.lastOk = Date.now(); CLOUD.err = ''; }).catch(e => { CLOUD.err = (e && e.code) || 'error'; })
    .finally(() => { CLOUD.busy = false; if (CLOUD.pending) cloudFlush(); });
}
// ---------- 계정: 아이디·비밀번호로 클라우드(아티팩트 db) 문서 accounts/{아이디}에 저장. 기기와 무관 ----------
// 비밀번호는 해시만 저장(친구끼리 쓰는 용도의 간단한 보호 — 중요한 비밀번호 재사용 금지). 이 기기의 localStorage는 계정별 캐시 + 자동 로그인 정보.
const ACCT_KEY = 'starband_acct';
let ACCT = null;   // { id }
const localKey = () => ACCT ? SAVE_KEY + ':' + ACCT.id : SAVE_KEY;
const idKey = (id) => String(id || '').trim().toLowerCase().replace(/[^a-z0-9가-힣_.-]/g, '');
async function pwHash(id, pw) {
  const str = id + ':' + pw + ':starband';
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return 'd' + (h >>> 0).toString(16); }
}
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
async function dbConnect() {
  try { if (!window.claude || typeof window.claude.use !== 'function') return false; const db = await withTimeout(window.claude.use('db'), 4000); if (!db) return false; CLOUD.db = db; return true; }
  catch (e) { CLOUD.err = (e && e.code) || 'error'; return false; }
}
function localOf(id) { try { const raw = localStorage.getItem(SAVE_KEY + ':' + id); if (raw) { const s = G.deserialize(raw); if ((s.v || 1) >= 3) return s; } } catch (e) { } return null; }
async function openAccount(id, d) { // 클라우드와 이 기기 캐시 중 더 최근 것
  ACCT = { id }; CLOUD.doc = CLOUD.db.doc('accounts/' + id);
  let s = d && d.json ? G.deserialize(d.json) : null; const ts = d ? d.lastTs || 0 : 0;
  const loc = localOf(id); if (loc && (loc.lastTs || 0) > ts) { s = loc; }
  return s;
}
function loginScreen() {
  return new Promise((resolve) => {
    const m = $('#main'); $('#tabs').style.display = 'none'; $('#top').style.visibility = 'hidden';
    m.innerHTML = `<div class="login"><div class="lt">별무리 원정대</div>
      <input id="lg-id" placeholder="아이디" autocomplete="username" maxlength="20"><input id="lg-pw" type="password" placeholder="비밀번호" autocomplete="current-password" maxlength="40">
      <label class="lg-legacy" id="lg-lw" hidden><input type="checkbox" id="lg-legacy" checked><span id="lg-lt"></span></label>
      <button class="btn p" id="lg-in">로그인</button><button class="btn" id="lg-new">새 계정 만들기</button><div class="lg-msg" id="lg-msg"></div></div>`;
    const msg = (t) => { $('#lg-msg').textContent = t; };
    let legacy = null; // 계정 도입 전 공용 세이브(save/main)
    withTimeout(CLOUD.db.doc('save/main').get(), 4000).then(sn => { if (sn && sn.exists) { const d = sn.data(); if (d && d.json && !d.claimed) { try { legacy = G.deserialize(d.json); $('#lg-lt').textContent = `새 계정을 기존 진행 데이터(최고 ${legacy.maxClear}스테이지)로 시작`; $('#lg-lw').hidden = false; } catch (e) { } } } }).catch(() => { });
    const busy = (b) => { $('#lg-in').disabled = b; $('#lg-new').disabled = b; };
    const done = async (id, h, s) => { try { localStorage.setItem(ACCT_KEY, JSON.stringify({ id, h })); } catch (e) { } $('#tabs').style.display = ''; $('#top').style.visibility = ''; resolve(s); };
    $('#lg-in').onclick = async () => {
      const id = idKey($('#lg-id').value), pw = $('#lg-pw').value; if (!id || !pw) { msg('아이디와 비밀번호를 입력하세요'); return; }
      busy(true); msg('');
      try { const sn = await withTimeout(CLOUD.db.doc('accounts/' + id).get(), 6000); if (!sn) { msg('연결이 느립니다. 다시 시도하세요'); busy(false); return; }
        if (!sn.exists) { msg('없는 아이디입니다'); busy(false); return; }
        const d = sn.data(); const h = await pwHash(id, pw); if (d.h !== h) { msg('비밀번호가 다릅니다'); busy(false); return; }
        done(id, h, await openAccount(id, d));
      } catch (e) { msg('로그인 실패 (' + ((e && e.code) || 'error') + ')'); busy(false); }
    };
    $('#lg-new').onclick = async () => {
      const id = idKey($('#lg-id').value), pw = $('#lg-pw').value;
      if (id.length < 2) { msg('아이디는 2자 이상 (영문·숫자·한글)'); return; } if (pw.length < 4) { msg('비밀번호는 4자 이상'); return; }
      busy(true); msg('');
      try { const sn = await withTimeout(CLOUD.db.doc('accounts/' + id).get(), 6000); if (!sn) { msg('연결이 느립니다. 다시 시도하세요'); busy(false); return; }
        if (sn.exists) { msg('이미 있는 아이디입니다'); busy(false); return; }
        const h = await pwHash(id, pw); const useLegacy = legacy && $('#lg-legacy').checked;
        const st = useLegacy ? legacy : G.newState(Date.now()); st.lastTs = Date.now();
        await CLOUD.db.doc('accounts/' + id).set({ h, json: G.serialize(st), lastTs: st.lastTs, v: st.v || 3, created: Date.now() });
        if (useLegacy) { try { await CLOUD.db.doc('save/main').update({ claimed: id }); } catch (e) { } }
        ACCT = { id }; CLOUD.doc = CLOUD.db.doc('accounts/' + id); done(id, h, st);
      } catch (e) { msg('만들기 실패 (' + ((e && e.code) || 'error') + ')'); busy(false); }
    };
    $('#lg-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#lg-in').click(); });
  });
}
async function autoLogin() {
  let a = null; try { a = JSON.parse(localStorage.getItem(ACCT_KEY) || 'null'); } catch (e) { }
  if (!a || !a.id || !a.h) return undefined;
  try { const sn = await withTimeout(CLOUD.db.doc('accounts/' + a.id).get(), 5000); if (!sn || !sn.exists) return undefined; const d = sn.data(); if (d.h !== a.h) return undefined; return await openAccount(a.id, d); }
  catch (e) { return undefined; }
}
function logout() { try { cloudFlush(); localStorage.removeItem(ACCT_KEY); } catch (e) { } setTimeout(() => location.reload(), 600); }
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const s = G.deserialize(raw); if ((s.v || 1) < 3) { migrated = true; return null; } return s; } } catch (e) { }
  return null;
}

// ---------- 공용 ----------
function toast(msg, ms) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms || 1800);
}
function modal(html) { $('#modal-box').classList.toggle('ill', html.includes('class="illust')); $('#modal-box').innerHTML = `<div class="closebar"><button class="close" aria-label="닫기">✕</button></div>` + html; $('#modal').hidden = false; $('#modal .close').onclick = closeModal; fitName(); }
// 긴 영웅 이름(2026-11-20 신규 ★3 — '성벽의 수녀기사 세실리아' 등)이 두 줄로 꺾이지 않게 상세 창 이름 글자를 줄임(24 → 최소 15px)
function fitName() { const t = document.querySelector('#modal-box .name.dnm .nmt'); if (!t) return; const row = t.parentElement; let fs = 24; t.style.fontSize = fs + 'px'; const other = [...row.children].filter(c => c !== t).reduce((w, c) => w + c.getBoundingClientRect().width + 7, 0); const max = Math.max(60, row.clientWidth - other); while (t.getBoundingClientRect().width > max && fs > 15) { fs--; t.style.fontSize = fs + 'px'; } }
function closeModal() {
  $('#modal').hidden = true; $('#modal-box').innerHTML = '';
  // 모달 안에서 돌파·강화·편성이 바뀌면 뒤의 목록(돌파 가능 표시 등)이 낡으므로 다시 그림 (스크롤 유지)
  if (S && tab !== 'battle') { const m = $('#main'); const sc = m.scrollTop; render(); m.scrollTop = sc; }
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
$('#viewer-close').onclick = () => { $('#viewer').hidden = true; };
$('#viewer-img').onclick = () => { $('#viewer').classList.toggle('zoom'); };
function renderTop() { if (!S) return; $('#r-gold').textContent = fmt(S.gold); $('#r-crys').textContent = fmt(S.crystal);  const xe = $('#r-xst'); if (xe) xe.textContent = fmt(S.xstone || 0); $('#r-ssh').textContent = fmt(S.sshard || 0); if (typeof updateQuestBadge === 'function') updateQuestBadge(); { const fb = $('#tabs button[data-tab="fusion"] .badge'); if (fb) { fb.textContent = S.seal || 0; fb.hidden = !(S.seal > 0); } } { const hb = $('#tabs button[data-tab="heroes"] .badge'); if (hb && S.heroes) { const n = Object.keys(S.heroes).filter(id => G.canLB(S, +id)).length; hb.textContent = n; hb.hidden = !n; } } powerCheck(); }
// 전투력 변화 알림(2026-11-02 사용자): 출전 원정대 전투력이 바뀌면 화면 가운데에 잠깐 표시. 연속 변화(골드 올인 등)는 0.35초 안에 묶어 한 번만
let powS = null, powShown = null, powFrom = null, powTimer = 0;
function powerCheck() {
  if (!S || !G.partyPower) return; const p = G.partyPower(S);
  if (powS !== S || powShown == null) { powS = S; powShown = p; return; }
  if (Math.abs(p - powShown) <= Math.max(1, powShown * 0.0005)) return;
  if (powFrom == null) powFrom = powShown; powShown = p;
  clearTimeout(powTimer); powTimer = setTimeout(() => { const a = powFrom, b = powShown; powFrom = null; if (Math.abs(b - a) > Math.max(1, a * 0.0005)) showPow(a, b); }, 350);
}
function showPow(a, b) {
  let el = document.getElementById('powpop'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'powpop'; el.className = 'powpop ' + (b > a ? 'up' : 'down');
  el.innerHTML = `<span>전투력</span><b class="num">${fmt(b)}</b><em class="num">${b > a ? '▲' : '▼'} ${fmt(Math.abs(b - a))}</em>`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1700);
}
function heroCard(id, opts) {
  opts = opts || {}; const ch = byId(id); const h = S.heroes[id];
  const owned = !!h; const pi = S.party.indexOf(id); const inParty = pi >= 0 && !opts.noParty;
  const can = owned && G.canLB(S, id); const ai = owned && !can && G.ascInfo ? G.ascInfo(S, id) : null, asc = ai && ai.have >= ai.cost;   // 승급 가능(재료까지 있을 때만 표시)
  return `<div class="hcard s${ch.star} e-${ch.elem} ${owned ? '' : 'unowned'} ${inParty ? (pi === 0 ? 'ismain' : 'inparty') : ''} ${opts.sel ? 'sel' : ''} ${can ? 'canlb lbready' + (h.lb >= 5 ? ' trready' : '') : asc ? 'canlb' : ''}" data-id="${id}">
    <div class="port"><img src="${imgOf(id)}" alt="${ch.name}" loading="lazy">
      ${stars(ch.star)}${can ? `<span class="lbtag can lbr">${h.lb >= 5 ? '초월' : '돌파'} 가능</span>` : asc ? '<span class="lbtag can">승급 가능</span>' : owned ? lbTag(h.lb) : ''}
      ${inParty ? `<span class="dep">${pi === 0 ? '대표' : '출전 ' + (pi + 1)}</span>` : ''}${opts.isNew ? '<span class="new">NEW</span>' : ''}${illOf(id) ? '<span class="ilbadge" title="일러스트">✦</span>' : ''}</div>
    <div class="meta"><div class="nm">${ch.name}</div>
    <div class="lv">${elemDot(ch.elem)}${owned && G.heroLv ? `<b class="hlv">Lv.${G.heroLv(S, id)}</b> ` : ''}${C.ROLE_KR[ch.role]} · ${C.ELEM_NAME[ch.elem]}${owned && (h.slv || 1) > 1 ? `<span class="s">S${h.slv}</span>` : ''}</div></div>
  </div>`;
}

// ---------- 탭 ----------
let dgAnim = false;
function setTab(t) {
  if (t === 'challenge' && tab !== 'challenge') dgAnim = true;
  tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  render();
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
// 폰 뒤로 가기(2026-11-24 사용자 '뒤로 가기 누르면 계속 꺼짐'): 방문 기록 한 칸을 걸어 두고, 뒤로 가면 ★3 연출 건너뛰기 → 일러스트 뷰어 → 창 닫기 → 전투 탭 순, 그 뒤엔 아무 일도 없음(꺼지지 않음).
// 크롬은 사용자 조작 없이 넣은 기록을 뒤로 가기에서 건너뛰므로, 다시 걸어 둔 칸은 다음 터치 때부터 유효(터치마다 비어 있으면 다시 검)
(function backGuard() {
  const arm = () => { try { if (!(history.state && history.state.sbg)) history.pushState({ sbg: 1 }, ''); } catch (e) {} };
  addEventListener('popstate', () => {
    const sk = document.querySelector('#sfx .sfx-skip'), vw = $('#viewer'), md = $('#modal');
    if (sk) sk.click();
    else if (vw && !vw.hidden) vw.hidden = true;
    else if (md && !md.hidden) { const c = md.querySelector('.close'); if (c) c.click(); }
    else if (tab !== 'battle') setTab('battle');
    arm();
  });
  arm(); addEventListener('pointerdown', arm, { capture: true, passive: true });
})();
$('#btn-settings').onclick = () => openSettings();

function render() {
  renderTop(); if (S && S.dg) updateBadge();
  const m = $('#main'); m.scrollTop = 0;
  if (tab === 'battle') renderBattle(m);
  else if (tab === 'heroes') renderHeroes(m);
  else if (tab === 'gacha') renderGacha(m);
  else if (tab === 'fusion') renderFusion(m);
  else if (tab === 'codex') renderCodex(m);
  else if (tab === 'challenge') renderChallenge(m);
}

// ---------- 이미지 캐시 ----------
const IMG = {};
function img(src) { let i = IMG[src]; if (!i) { i = new Image(); i.src = src; IMG[src] = i; } return i; }
const TINT = {};
const MOB_TINT = false;
function mobImg(id, hue) {
  const src = 'img/mob/' + id + '.png'; const base = img(src);
  if (!MOB_TINT || !hue || !base.complete || !base.naturalWidth) return base;   // A안: 지역별 색 바꾸기 끔 — 원화 색(속성 색) 그대로
  const key = id + ':' + hue; if (TINT[key]) return TINT[key];
  try {
    const c = document.createElement('canvas'); c.width = base.naturalWidth; c.height = base.naturalHeight; const x = c.getContext('2d');
    if ('filter' in x) { x.filter = 'hue-rotate(' + hue + 'deg)'; x.drawImage(base, 0, 0); TINT[key] = c; return c; }
  } catch (e) { }
  TINT[key] = base; return base;
}

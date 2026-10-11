'use strict';
/* =========================================================
 * 화면 (Engine 상태를 그려 주고, 버튼 입력을 Engine 액션으로 전달)
 * ========================================================= */
const SAVE_KEY = 'footballlife_save_v1';
const HOF_KEY = 'footballlife_hof_v1';
const THEME_KEY = 'footballlife_theme';
const GAME_TITLE = '풋볼 라이프';

const ui = { screen: 'home', tab: 'play', draft: null, create: null, shown: 0, matchKey: '', confirmNew: false };
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const E = Engine;
const st = () => E.S;

/* ---------- 저장 ----------
 * 1차: 이 브라우저(localStorage)  2차: claude.ai 계정 저장소(Artifact db, 기기 간 유지)
 */
const cloud = { db: null, uid: null, state: 'off', busy: false, dirty: false, hofDirty: false, timer: null };
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } }
function save() {
  const S = st();
  if (!S) return;
  S.savedAt = Date.now();
  lsSet(SAVE_KEY, JSON.stringify(S));
  queueCloud();
}
function loadSave() { try { const s = lsGet(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearSave() { lsSet(SAVE_KEY, null); lsSet(SAVE_KEY + '_clearedAt', String(Date.now())); queueCloud(); }
function getHof() { try { return JSON.parse(lsGet(HOF_KEY) || '[]'); } catch (e) { return []; } }
function sortHof(h) { return h.sort((a, b) => (b.ballon - a.ballon) || (b.peak - a.peak) || (b.indiv - a.indiv) || ((b.g + b.a) - (a.g + a.a))).slice(0, 100); }
function addHof(c) {
  const h = getHof();
  h.push({ ...c, savedAt: Date.now() });
  lsSet(HOF_KEY, JSON.stringify(sortHof(h)));
  cloud.hofDirty = true; queueCloud();
}
/* 레거시 (다회차): { lp, levels, runs, earned, ts } */
const LEGACY_KEY = 'footballlife_legacy_v1';
function getLegacy() { try { return Object.assign({ lp: 0, levels: {}, runs: 0, earned: 0, ts: 0 }, JSON.parse(lsGet(LEGACY_KEY) || '{}')); } catch (e) { return { lp: 0, levels: {}, runs: 0, earned: 0, ts: 0 }; } }
// 1회성 조정: 스카우트 업그레이드 폐지(사용 LP 환급), 300 LP 지급
function migrateLegacy() {
  const L = getLegacy();
  L.grants = L.grants || [];
  const msgs = [];
  if (L.levels.scout) {
    const refund = [30, 120].slice(0, L.levels.scout).reduce((a, b) => a + b, 0);
    L.lp += refund; delete L.levels.scout; msgs.push(`스카우트 네트워크 폐지 · ${refund} LP 환급`);
  }
  if (!L.grants.includes('gift300_v1')) { L.lp += 300; L.grants.push('gift300_v1'); msgs.push('보너스 300 LP 지급'); }
  if (msgs.length) { setLegacy(L); setTimeout(() => toast('🏅 ' + msgs.join(' · ')), 300); }
}
function setLegacy(L) { L.ts = Date.now(); lsSet(LEGACY_KEY, JSON.stringify(L)); cloud.legDirty = true; queueCloud(); }
const cloudRef = k => cloud.db.collection('data/users/' + cloud.uid).doc(k);
function queueCloud() {
  if (!cloud.db) return;
  cloud.dirty = true;
  clearTimeout(cloud.timer);
  cloud.timer = setTimeout(pushCloud, 1500);
}
async function pushCloud() {
  if (!cloud.db || cloud.busy || (!cloud.dirty && !cloud.hofDirty && !cloud.legDirty)) return;
  cloud.busy = true;
  const doSave = cloud.dirty, doHof = cloud.hofDirty, doLeg = cloud.legDirty;
  cloud.dirty = false; cloud.hofDirty = false; cloud.legDirty = false;
  try {
    if (doSave) {
      const S = st(), raw = lsGet(SAVE_KEY);
      await cloudRef('save').set({ ts: S && raw ? S.savedAt : Date.now(), data: raw || null });
    }
    if (doHof) await cloudRef('hof').set({ ts: Date.now(), list: lsGet(HOF_KEY) || '[]' });
    if (doLeg) await cloudRef('legacy').set({ ts: getLegacy().ts, data: lsGet(LEGACY_KEY) || '{}' });
    cloud.state = 'on';
  } catch (e) {
    cloud.state = 'err';
    if (doSave) cloud.dirty = true;
    if (doHof) cloud.hofDirty = true;
    if (doLeg) cloud.legDirty = true;
    if (e && e.code === 'unavailable') setTimeout(pushCloud, 2000 + Math.random() * 2000);
  } finally {
    cloud.busy = false;
    paintCloud();
    if (cloud.state === 'on' && (cloud.dirty || cloud.hofDirty || cloud.legDirty)) cloud.timer = setTimeout(pushCloud, 1500);
  }
}
async function initCloud() {
  if (!(window.claude && typeof window.claude.use === 'function')) return;
  cloud.state = 'connecting'; paintCloud();
  try {
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    const uid = user ? await user.id() : null;
    if (!db || !uid) { cloud.state = 'off'; paintCloud(); return; }
    cloud.db = db; cloud.uid = uid;
    const [sv, hf, lg] = await Promise.all([cloudRef('save').get(), cloudRef('hof').get(), cloudRef('legacy').get()]);
    // 레거시: 더 최근 것을 사용
    const ld = lg.exists ? lg.data() : null, myLeg = getLegacy();
    if (ld && (ld.ts || 0) > (myLeg.ts || 0)) { lsSet(LEGACY_KEY, ld.data || '{}'); migrateLegacy(); render(); }
    else if ((myLeg.ts || 0) > (ld ? ld.ts || 0 : 0)) cloud.legDirty = true;
    // 저장 데이터: 더 최근 것을 사용
    const local = loadSave();
    const localTs = Math.max(local ? local.savedAt || 0 : 0, +(lsGet(SAVE_KEY + '_clearedAt') || 0));
    const d = sv.exists ? sv.data() : null;
    if (d && (d.ts || 0) > localTs) {
      lsSet(SAVE_KEY, d.data || null);
      if (ui.screen === 'game' && d.data) { E.load(JSON.parse(d.data)); ui.draft = null; }
      if (!d.data && ui.screen === 'game') ui.screen = 'home';
      render();
    } else if (localTs > (d ? d.ts || 0 : 0)) cloud.dirty = true;
    // 명예의 전당: 합치기
    const remote = hf.exists ? JSON.parse(hf.data().list || '[]') : [];
    const mine = getHof(), seen = new Set(mine.map(c => c.name + '|' + c.savedAt));
    const merged = mine.concat(remote.filter(c => !seen.has(c.name + '|' + c.savedAt)));
    if (merged.length !== mine.length) { lsSet(HOF_KEY, JSON.stringify(sortHof(merged))); render(); }
    if (merged.length !== remote.length) cloud.hofDirty = true;
    cloud.state = 'on';
    paintCloud();
    if (cloud.dirty || cloud.hofDirty || cloud.legDirty) pushCloud();
  } catch (e) { cloud.state = 'err'; paintCloud(); }
}
function cloudText() {
  return { on: '☁️ 계정에 자동 저장 중 (다른 기기에서도 이어하기 가능)', connecting: '☁️ 계정 저장소 연결 중…', err: '⚠️ 계정 저장 실패 — 이 브라우저에만 저장됨', off: '💾 이 브라우저에만 저장됩니다' }[cloud.state];
}
function paintCloud() { document.querySelectorAll('.cloud-st').forEach(el => { el.textContent = cloudText(); }); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(cloud.timer); pushCloud(); } });

function applyTheme() {
  let t = 'system';
  try { t = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { /* noop */ }
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}

/* ---------- 공통 조각 ---------- */
const posName = p => POSITIONS[p].name;
const pct = x => Math.round(x * 100);
function bar(v, max, cls) { return `<div class="bar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%"></i></div>`; }
function condCls(v) { return v >= 65 ? '' : v >= 40 ? 'warn' : 'bad'; }
function sign(x, d) { const v = Math.round(x * (d ? 10 : 1)) / (d ? 10 : 1); return v > 0 ? `<span class="up">+${v}</span>` : v < 0 ? `<span class="down">${v}</span>` : '<span class="muted">0</span>'; }
function stars(n) { return '★'.repeat(Math.floor(n)) + (n % 1 ? '☆' : ''); }
const money = m => E.fmtMoney(m);
function roleTag(r) { return `<span class="tag ${r === '핵심 선수' ? 'y' : r === '주전' ? 'g' : r === '로테이션' ? 'b' : r === '유망주' ? 'r' : ''}">${r === '핵심 선수' ? '⭐ ' : ''}${esc(r)}</span>`; }
function statusTag(s) {
  const m = { start: ['선발', 'g'], sub: ['교체', 'b'], bench: ['벤치', ''], out: ['명단 제외', 'r'], injured: ['부상', 'r'], susp: ['출전 정지', 'r'] };
  const [t, c] = m[s] || [s, ''];
  return `<span class="tag ${c}">${t}</span>`;
}
function resultTxt(l) {
  const r = l.gf > l.ga ? '승' : l.gf < l.ga ? '패' : '무';
  return `${l.gf}:${l.ga} ${r}${l.pens != null ? (l.pens ? ' (PK승)' : ' (PK패)') : ''}`;
}

/* ---------- 엠블럼 · 국기 ---------- */
const HAS_LOGOS = typeof LOGOS !== 'undefined';
const COMP_KEY = { 'FA컵': 'FA', '코파 델 레이': 'CDR', 'DFB 포칼': 'DFB', '코파 이탈리아': 'CIT', '쿠프 드 프랑스': 'CDF',
  'FIFA 월드컵': 'WC', 'UEFA 유로': 'EURO', '코파 아메리카': 'COPA', 'AFC 아시안컵': 'ASIAN' };
for (const k in LEAGUES) COMP_KEY[LEAGUES[k].name] = k;
for (const k in CONTINENTAL) COMP_KEY[CONTINENTAL[k].name] = k;
// 내장 이미지(LOGO_DATA, Artifact 빌드)가 있으면 사용, 없으면 인터넷 주소
const EMBED = typeof LOGO_DATA !== 'undefined' ? LOGO_DATA : null;
function logoSrc(kind, key, big) {
  if (EMBED) return EMBED[kind][key] || null;
  const u = HAS_LOGOS ? LOGOS[kind][key] : null;
  return u ? `${u}/${big ? 'small' : 'tiny'}` : null;
}
function badge(src, name, sz) {
  const ini = esc(String(name || '?').replace(/^(FC|AC|AS|RC|SC|VfB|VfL|RB|OGC|NEC|PSV|AZ|SV)\s+/, '').charAt(0));
  return `<span class="lg" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * 0.45)}px">${ini}${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
}
function clubLogo(id, sz, big) {
  const c = E.CLUBS[id];
  if (!c) return '';
  return badge(logoSrc('clubs', c.youth ? c.parent : id, big), c.name, sz || 20);
}
function compLogo(name, sz) {
  const k = COMP_KEY[String(name || '').replace(/ \(유스\)$/, '')];
  const src = k ? logoSrc('leagues', k) : null;
  return src ? badge(src, name, sz || 18) : '';
}
function flag(x, sz) {
  const code = NATIONS[x] ? FLAG_CODE[NATIONS[x].name] : FLAG_CODE[x];
  const src = code ? (EMBED ? EMBED.flags[code] : `https://flagcdn.com/w80/${code}.png`) : null;
  return src ? `<img class="fl" src="${src}" style="height:${Math.round((sz || 16) * 0.72)}px" alt="" onerror="this.remove()">` : '';
}

/* ---------- 상단 헤더 ---------- */
function header() {
  const S = st(), p = S.p;
  const se = S.season;
  const c = E.cond();
  return `<div class="top"><div class="top-row">
    <div class="ovr">${E.ovr()}<small>${p.pos}</small></div>
    <div class="who"><b>${esc(p.name)}</b> <span class="muted small">${p.age}세 · ${flag(p.nat, 14)} ${NATIONS[p.nat].name}</span>
      <div class="sub">${clubLogo(p.club, 16)} ${esc(E.clubName(p.club))} · ${roleTag(p.contract.role)}${p.injury > 0 ? ' <span class="tag r">🚑 부상 ' + p.injury + '경기</span>' : ''}${p.captain ? ' <span class="tag y">©</span>' : ''}</div></div>
    <div class="when"><b>${MONTHS[S.month] || ''}</b>${se ? se.label : ''}</div>
  </div>
  <div class="meters">
    <button class="meter" data-act="info" data-arg="cond">컨디션 ${Math.round(c)}${bar(c, 100, condCls(c))}</button>
    <button class="meter" data-act="info" data-arg="trust">감독 신뢰 ${Math.round(p.trust)}${bar(p.trust, 100)}</button>
    <button class="meter" data-act="info" data-arg="morale">사기 ${Math.round(p.morale)}${bar(p.morale, 100)}</button>
    <button class="meter" data-act="info" data-arg="rep">명성 ${Math.round(p.rep)}${bar(p.rep, 100)}</button>
  </div></div>`;
}

function tabs() {
  const T = [['play', '⚽', '진행'], ['player', '👤', '선수'], ['shop', '💼', '투자'], ['record', '📊', '기록'], ['table', '🏆', '순위'], ['menu', '☰', '메뉴']];
  return `<nav class="tabs"><div class="tabs-in">${T.map(([id, ic, nm]) => `<button data-act="tab" data-arg="${id}" class="${ui.tab === id ? 'on' : ''}"><span>${ic}</span>${nm}</button>`).join('')}</div></nav>`;
}

/* ---------- 홈 ---------- */
function renderHome() {
  const has = !!loadSave();
  return `<div class="hero"><div class="logo">⚽</div><h1>${GAME_TITLE}</h1><p>유스 벤치에서 발롱도르까지, 매달의 선택으로 만드는 축구 인생</p></div>
  <div class="wrap">
    ${has ? '<button class="btn" data-act="continue">▶ 이어하기</button>' : ''}
    <button class="btn ${has ? 'sec' : ''}" data-act="new">새 커리어 시작</button>
    <button class="btn sec" data-act="legacy">🏅 레거시 업그레이드 <span class="tag y">${getLegacy().lp} LP</span></button>
    <button class="btn sec" data-act="hof">🏛️ 명예의 전당</button>
    <button class="btn sec" data-act="guide">📖 게임 방법</button>
    <p class="note center">지금까지 ${getLegacy().runs}회차 은퇴 · 은퇴할 때마다 레거시 포인트(LP)를 받아 다음 선수를 강화할 수 있습니다.</p>
    <p class="note center cloud-st">${cloudText()}</p>
    <p class="note center"> 구단·대회 명칭은 식별 목적으로만 사용하며 각 권리자와 무관한 비공식 팬 게임입니다.</p>
  </div>`;
}

/* ---------- 선수 생성 ---------- */
function youthOptions(nat) { return Object.keys(E.CLUBS).filter(id => E.CLUBS[id].lg === 'Y_' + nat); }
function renderCreate() {
  const c = ui.create;
  const yo = youthOptions(c.nat);
  if (!yo.includes(c.youth)) c.youth = yo[0];
  const L = getLegacy(), pk = E.perksFrom(L.levels);
  const grp = POSITIONS[c.pos].group, styles = STYLES[grp];
  if (!styles.find(s => s.id === c.style)) c.style = styles[0].id;
  if (!c.seed) c.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const cd = E.genPlayer(c.pos, c.style, c.seed, pk, pk.chooseType ? c.gtype : null);
  if (pk.startSkill && !cd.rec.includes(c.sskill)) c.sskill = cd.rec[0];
  const keys = grp === 'GK' ? ATTRS_GK : ATTRS_OUT;
  const potTxt = '??? <span class="small muted">(만 18세에 스카우트 리포트로 공개)</span>';
  const active = LEGACY.filter(x => (L.levels[x.id] || 0) > 0);
  let h = `<div class="wrap"><div class="card"><h2>👤 새 선수 만들기 <span class="tag">${L.runs + 1}회차</span></h2>
    <label class="f">선수 이름 (실명 대신 닉네임 권장)</label>
    <input type="text" id="cName" maxlength="12" value="${esc(c.name)}" placeholder="예: 김루키">
    <label class="f">국적 ${flag(c.nat, 18)}</label>
    <select id="cNat">${Object.keys(NATIONS).map(k => `<option value="${k}" ${k === c.nat ? 'selected' : ''}>${NATIONS[k].name}</option>`).join('')}</select>
    <label class="f">포지션</label>
    <div>${Object.keys(POSITIONS).map(k => `<button class="chip ${k === c.pos ? 'on' : ''}" data-act="cpos" data-arg="${k}">${k} · ${POSITIONS[k].name}</button>`).join('')}</div>
    <label class="f">플레이 스타일</label>
    ${styles.map(s => `<button class="opt ${s.id === c.style ? 'on' : ''}" data-act="cstyle" data-arg="${s.id}"><b>${esc(s.name)}</b><span class="small">${esc(s.desc)} · 추천 스킬: ${s.rec.map(k => SKILLS[k].name).join(', ')}</span></button>`).join('')}
    ${pk.chooseType ? `<label class="f">성장 유형 (레거시)</label><div>${['early', 'normal', 'late'].map(g => `<button class="chip ${(c.gtype || '') === g ? 'on' : ''}" data-act="cgtype" data-arg="${g}">${GROWTH_NAME[g]}</button>`).join('')}<button class="chip ${!c.gtype ? 'on' : ''}" data-act="cgtype" data-arg="">무작위</button></div>` : ''}
    ${pk.startSkill ? `<label class="f">유스 시절 특기 (레거시)</label><div>${cd.rec.map(k => `<button class="chip ${c.sskill === k ? 'on' : ''}" data-act="csskill" data-arg="${k}">${SKILLS[k].icon} ${SKILLS[k].name} Lv1</button>`).join('')}</div>` : ''}
    <label class="f">유스팀 ${c.nat === 'KOR' ? '(K리그 산하 고교)' : ''} ${clubLogo(c.youth, 22)}</label>
    <select id="cYouth">${yo.map(id => `<option value="${id}" ${id === c.youth ? 'selected' : ''}>${esc(E.CLUBS[id].name)}</option>`).join('')}</select></div>
  <div class="card hl"><div class="row between"><h2 style="margin:0">🔍 스카우트 리포트</h2><span class="big" style="font-size:24px">${Math.round(E.overallOf(cd.attrs, c.pos))}</span></div>
    <p class="small">잠재력: ${potTxt} · 약발 ${cd.weakFoot ? '★'.repeat(cd.weakFoot) : '-'}</p>
    <p class="small muted">잠재력과 숨은 특성은 무작위로 정해지며, 선수를 만든 뒤에 바꿀 수 없습니다.</p>
    <div class="grid3" style="margin-top:6px">${keys.map(k => `<div class="small">${ATTR_NAME[k]} <b>${Math.round(cd.attrs[k])}</b></div>`).join('')}</div>
    ${active.length ? `<h3>🏅 적용 중인 레거시</h3><p class="small">${active.map(x => `${x.icon} ${x.name} Lv${L.levels[x.id]}`).join(' · ')}</p>` : '<p class="note">은퇴하면 레거시 포인트를 받아 다음 회차 선수를 강화할 수 있습니다.</p>'}
    <button class="btn" data-act="cstart">이 선수로 시작 ▶</button></div>
  <button class="btn sec" data-act="legacy">🏅 레거시 업그레이드 (${L.lp} LP)</button>
  <button class="btn sec" data-act="home">← 처음으로</button></div>`;
  return h;
}

/* ---------- 레거시 화면 ---------- */
function renderLegacy() {
  const L = getLegacy();
  const spent = LEGACY.reduce((s, x) => s + x.cost.slice(0, L.levels[x.id] || 0).reduce((a, b) => a + b, 0), 0);
  return `<div class="wrap"><div class="card hl"><h2>🏅 레거시 업그레이드</h2>
    <div class="grid3"><div class="stat"><b>${L.lp}</b><span>보유 LP</span></div><div class="stat"><b>${L.runs}</b><span>은퇴한 회차</span></div><div class="stat"><b>${spent}</b><span>사용한 LP</span></div></div>
    <p class="small muted" style="margin-top:8px">업그레이드는 영구적이며 다음에 만드는 선수부터 적용됩니다. LP는 은퇴할 때 시즌 수·최고 오버롤·발롱도르·개인상·우승·A매치로 계산합니다.</p></div>
    ${LEGACY.map(x => {
      const lv = L.levels[x.id] || 0, maxed = lv >= x.max, cost = maxed ? 0 : x.cost[lv];
      return `<div class="card"><div class="row between"><b>${x.icon} ${x.name}</b><span class="tag ${lv ? 'g' : ''}">Lv${lv}/${x.max}</span></div>
        <p class="small">${lv ? `현재: ${x.desc(lv)}` : '미보유'}${maxed ? '' : `<br>다음: <b>${x.desc(lv + 1)}</b>`}</p>
        ${maxed ? '<span class="tag g">최고 레벨</span>' : `<button class="btn ${L.lp >= cost ? '' : 'sec'}" data-act="legbuy" data-arg="${x.id}" ${L.lp >= cost ? '' : 'disabled'}>${cost} LP로 강화</button>`}</div>`;
    }).join('')}
    <button class="btn sec" data-act="back">← 돌아가기</button></div>`;
}

/* ---------- 용어 설명 (누르면 아래에서 설명 창) ---------- */
const GROWTH_NAME = { early: '조기 성장형', normal: '표준 성장형', late: '대기만성형' };
const ATTR_DESC = {
  pac: '역습, 침투 타이밍, 최후방 커버, 상대 추적 같은 상황의 성공률에 쓰입니다. 30세 이후 가장 빨리 떨어지는 능력치입니다.',
  sho: '경기 중 득점 확률과 슈팅·PK·발리 선택지의 성공률을 정합니다.',
  pas: '도움 확률과 침투 패스·크로스·전환 패스 선택지의 성공률을 정합니다.',
  dri: '드리블 돌파, 개인기, 접어서 슈팅, 탈압박 선택지의 성공률을 정합니다.',
  def: '태클, 지연 수비, 패스 차단, 마크 선택지의 성공률을 정합니다.',
  phy: '헤더, 몸싸움, 블록, 공중볼 경합의 성공률을 정합니다. 30세 이후 빨리 떨어집니다.',
  ref: '근거리 슈팅 선방과 PK 방어에 쓰입니다.', div: '구석으로 오는 슈팅 선방과 1대1 다이빙에 쓰입니다.',
  han: '공을 잡아내는 선방과 크로스 처리에 쓰입니다.', gpo: '1대1 각도 좁히기, 스위핑, 수비 지휘에 쓰입니다.',
  kic: '롱킥, 빌드업 선택지의 성공률을 정합니다.',
};
function pctx(v) { return `${Math.round(v * 100)}%`; }
const INFO = {
  ovr: () => {
    const w = OVR_WEIGHTS[POSITIONS[st().p.pos].group];
    const list = Object.keys(w).filter(k => w[k] > 0).sort((a, b) => w[b] - w[a]).map(k => `${ATTR_NAME[k]} ${pctx(w[k])}`).join(', ');
    return ['오버롤', `<p>포지션에 맞게 능력치를 가중 평균한 종합 점수입니다. 출전 경쟁, 이적 제안, 연봉, 발롱도르 평가의 기준이 됩니다.</p>
      <p><b>현재 포지션(${st().p.pos}) 가중치</b><br>${list}</p><p class="small muted">비중이 큰 능력치를 집중 훈련하면 오버롤이 빨리 오릅니다.</p>`];
  },
  pot: () => ['잠재력', `<p>선수가 성장할 수 있는 <b>한계</b>입니다. 선수를 만들 때 무작위로 정해지고, 만 18세 시즌이 끝나면 스카우트 리포트로 별점이 공개됩니다. 별점은 추정치라 실제 값과 조금 다를 수 있습니다.</p>
    <ul><li>오버롤이 잠재력에 가까워질수록 성장이 느려지고, 넘어서지는 못합니다.</li><li>만 22세까지는 시즌 평점과 출전 비율에 따라 매년 조금씩 오르거나 내려갑니다.</li></ul>`],
  weak: () => { const w = st().p.weakFoot || 0; return ['약발', `<p>주로 쓰지 않는 발의 숙련도(★1~5)입니다. 경기 중 「약발로 바로 슈팅」 같은 선택지의 성공률을 정합니다.</p>
    <p>현재 ★${w}: 약발 선택지는 능력치의 <b>${Math.round((0.6 + 0.08 * w) * 100)}%</b>만 발휘됩니다. (★5면 100%)</p><p class="small muted">「약발 강화」 스킬 한 레벨마다 ★1씩 오릅니다.</p>`]; },
  value: () => ['시장 가치', '<p>오버롤, 나이, 잠재력으로 계산한 몸값입니다. 계약 기간이 남은 상태로 이적하면 이 금액이 이적료가 됩니다. 어리고 잠재력이 높을수록 비싸고, 30세가 넘으면 빠르게 떨어집니다.</p>'],
  style: () => { const p = st().p; const s = Object.values(STYLES).flat().find(x => x.name === p.style); return [p.style, `<p>${s ? esc(s.desc) : ''}</p><p>선수를 만들 때 정한 플레이 스타일로, 시작 능력치 분포를 결정했습니다.</p>${p.rec ? `<p><b>추천 스킬</b>: ${p.rec.map(k => SKILLS[k].name).join(', ')}</p>` : ''}`]; },
  growth: () => {
    const p = st().p, mine = p.revealed.growth ? p.traits.growth : null;
    const row = (k, a, b, c) => `<tr class="${mine === k ? 'me' : ''}"><td>${GROWTH_NAME[k]}${mine === k ? ' (나)' : ''}</td><td>${a}</td><td>${b}</td><td>${c}</td></tr>`;
    return ['성장 유형', `<p>나이대별로 언제 빨리 크고 언제 기량이 떨어지는지 정하는 숨은 특성입니다. ${mine ? '' : '<b>만 18세 시즌이 끝나면 공개됩니다.</b>'}</p>
      <div class="scroll-x"><table class="tb"><tr><th>유형</th><th>~20세 성장</th><th>21~27세 성장</th><th>하락 시작</th></tr>
      ${row('early', '×1.3', '×0.9~1.0', '약 29세')}${row('normal', '×1.0', '×1.0', '약 30세')}${row('late', '×0.8', '×1.25', '약 31세')}</table></div>
      <p class="small muted">어느 유형이든 잠재력이 성장 한계입니다. 조기 성장형은 같은 한계에 더 일찍 도달하는 유형입니다.</p>`];
  },
  prof: () => { const p = st().p; return ['프로 의식', `<p>훈련을 얼마나 성실하게 소화하는지를 나타냅니다. 능력치 성장과 스킬 수련 속도에 <b>×0.85~1.15</b>로 곱해지고, 30세 이후에는 높을수록 기량이 천천히 떨어집니다.</p>
    <p>${p.revealed.prof ? `내 선수: <b>${p.traits.prof >= 1.05 ? '매우 높음' : p.traits.prof >= 0.95 ? '보통' : '낮음'}</b> (×${p.traits.prof})` : '만 19세 시즌이 끝나면 공개됩니다.'}</p>`]; },
  injury: () => { const p = st().p; return ['부상 체질', `<p>부상 확률에 <b>×0.7~1.5</b>로 곱해지는 숨은 특성입니다. 약한 체질이라면 피로 관리, 영양 관리, 「부상 방지 루틴」 스킬이 더 중요합니다.</p>
    <p>${p.revealed.injury ? `내 선수: <b>${p.traits.injury <= 0.9 ? '강함' : p.traits.injury <= 1.2 ? '보통' : '약함'}</b> (×${p.traits.injury})` : '만 20세 시즌이 끝나면 공개됩니다.'}</p>`]; },
  cond: () => ['컨디션', `<p>100에서 피로를 뺀 값입니다. 경기 출전과 강한 훈련으로 떨어지고, 「회복 위주」 훈련이나 휴식으로 회복합니다.</p>
    <ul><li>선발 경쟁, 경기 평점, 결정적 순간의 성공률에 영향을 줍니다.</li><li>피로가 40을 넘으면 경기 중 부상 위험이, 60을 넘으면 훈련 중 부상 위험이 크게 오릅니다.</li></ul>`],
  trust: () => ['감독 신뢰', `<p>감독이 나를 얼마나 믿는지입니다. 높을수록 선발 경쟁에서 유리합니다.</p>
    <ul><li>경기 평점이 6.6보다 높으면 오르고, 낮으면 내려갑니다.</li><li>결정적 순간의 성공·실패, 면담·기자회견 같은 이벤트 선택, 영상 분석 활동으로도 바뀝니다.</li><li>매달 50 쪽으로 조금씩 되돌아갑니다.</li></ul>`],
  morale: () => ['사기', '<p>선수의 기분과 자신감입니다. 경기 평점과 결정적 순간의 성공률에 조금 영향을 줍니다. 승리, 좋은 평점, 휴식, 멘탈 코칭, 가족 이벤트 등으로 오르고 매달 60 쪽으로 되돌아갑니다.</p>'],
  rep: () => ['명성', '<p>세상이 나를 얼마나 아는지입니다. 이적 제안의 수와 수준, 스폰서·광고 이벤트, 발롱도르 평가에 영향을 줍니다. 활약, 우승, 국가대표 경기로 오르고 매 시즌 8%씩 줄어듭니다.</p>'],
  facility: () => {
    const lvl = E.facLevel();
    return ['구단 시설', `<p>소속 구단의 훈련장·의료 시설 수준입니다. 구단 전력이 높을수록 등급이 높고, 유스팀은 성인팀보다 한 단계 낮습니다.</p>
      <div class="scroll-x"><table class="tb"><tr><th>등급</th><th>구단 전력</th><th>성장</th><th>스킬</th><th>부상</th><th>회복</th></tr>
      ${FACILITY.slice(1).map((f, i) => `<tr class="${i + 1 === lvl ? 'me' : ''}"><td>${f.name}</td><td>${i === 0 ? '~55' : i === 4 ? '82~' : `${FACILITY[i].max + 1}~${f.max}`}</td><td>×${f.growth}</td><td>×${f.skill}</td><td>×${f.injury}</td><td>+${f.recovery}</td></tr>`).join('')}</table></div>`];
  },
  role: () => { const r = st().p.contract.role; return ['계약 역할', `<p>계약할 때 구단이 약속한 역할입니다. 선발 경쟁 점수에 보정이 붙습니다.</p>
    <ul><li><b>⭐ 핵심 선수</b>: +3.5 (연봉 ×1.3)</li><li><b>주전</b>: +2.5 (연봉 ×1.1)</li><li><b>로테이션</b>: +1</li><li><b>유망주</b>: −1 (연봉 ×0.7)</li><li><b>유스</b>: 보정 없음</li></ul>
    <p><b>시즌이 끝나면 구단이 역할을 재평가합니다.</b> 선발 비율 70% 이상·평균 평점 7.2 이상이면 핵심 선수, 50% 이상이면 주전, 25% 이상이면 로테이션입니다. 역할이 오르면 계약이 남아 있어도 연봉 인상 재계약 제안이 오고, 출전이 거의 없으면 역할이 내려갑니다.</p><p>현재 역할: <b>${esc(r)}</b>${st().p.captain ? ' · 주장 +3' : ''}</p>`]; },
};
function attrInfo(k) { return [ATTR_NAME[k], `<p>${ATTR_DESC[k] || ''}</p><p>현재 <b>${Math.floor(st().p.attrs[k])}</b> · 최대 99</p>`]; }
function skillInfo(k) {
  const s = SKILLS[k], x = E.skillStatus(k);
  const req = Object.keys(s.req).map(r => `${r === 'age' ? '나이' : r === 'rep' ? '명성' : ATTR_NAME[r] || r} ${s.req[r]}`).join(', ') || '없음';
  return [`${s.icon} ${s.name}`, `<p>${s.desc}</p>
    <ul><li>현재 레벨: <b>${x.lvl ? 'Lv' + x.lvl : '미습득'}</b>${x.maxed ? ' (MAX)' : ` · 다음 레벨까지 ${x.prog}/${x.next}`}</li><li>습득 조건: ${req}</li>
    <li>레벨이 오를수록 관련 상황의 성공률 보너스가 커집니다.</li></ul>`];
}
function openInfo(key) {
  let r = null;
  if (key.startsWith('attr:')) r = attrInfo(key.slice(5));
  else if (key.startsWith('skill:')) r = skillInfo(key.slice(6));
  else if (INFO[key]) r = INFO[key]();
  if (!r) return;
  let bg = $('#sheet');
  if (!bg) { bg = document.createElement('div'); bg.id = 'sheet'; bg.className = 'sheet-bg'; document.body.appendChild(bg); }
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetT"><div class="row between"><h2 id="sheetT">${esc(r[0])}</h2><button class="sheet-x" data-act="infoclose" aria-label="닫기">✕</button></div><div class="sheet-body">${r[1]}</div><button class="btn sec" data-act="infoclose">확인</button></div>`;
  bg.hidden = false;
}
function closeInfo() { const bg = $('#sheet'); if (bg) bg.hidden = true; }
const ib = (key, label) => `<button class="ib" data-act="info" data-arg="${key}">${label}<i>ⓘ</i></button>`;

/* ---------- 자동 진행 요약 ---------- */
function autoCard() {
  const L = st().pending.autoLog;
  if (!L || !L.length) return '';
  const tg = L.reduce((s, x) => s + x.g, 0), ta = L.reduce((s, x) => s + x.a, 0), td = Math.round(L.reduce((s, x) => s + x.d, 0) * 10) / 10;
  return `<div class="card hl"><h2>⏩ 자동 진행 결과 (${L.length}개월)</h2>
    <p class="small">골 ${tg} · 도움 ${ta} · 오버롤 ${sign(td, true)}</p>
    <ul class="list">${L.map(x => `<li><b>${esc(x.label)}</b> <span class="small muted">${x.apps}경기 · ⚽${x.g} 🅰️${x.a}${x.avg != null ? ' · 평점 ' + x.avg.toFixed(1) : ''} · OVR ${sign(x.d, true)}</span>
      ${x.notes.concat(x.evs).map(n => `<div class="small">${esc(n)}</div>`).join('')}</li>`).join('')}</ul></div>`;
}

/* ---------- 투자 탭 ---------- */
function fxText(fx) {
  const out = [];
  if (fx.growth) out.push(`성장 ×${fx.growth}`);
  if (fx.skill) out.push(`스킬 수련 ×${fx.skill}`);
  if (fx.injury) out.push(`부상 위험 ${Math.round((1 - fx.injury) * 100)}%↓`);
  if (fx.recovery) out.push(`월 피로 회복 +${fx.recovery}`);
  if (fx.dec) out.push(`경기 판단 +${fx.dec}%p`);
  if (fx.morale) out.push(`사기 기준 +${fx.morale}`);
  return out.join(' · ') || '효과 없음';
}
function renderShop() {
  const S = st(), p = S.p;
  const eq = p.equip || {}, sf = p.staff || {};
  const f = E.fac(), lvl = E.facLevel(), B = E.bonuses();
  let h = `<div class="card hl"><h2>💼 투자</h2><div class="grid2"><div class="stat"><b>${money(p.money)}</b><span>보유 자금</span></div><div class="stat"><b>${money(E.staffCost())}</b><span>월 고정 지출 (스태프·주거)</span></div></div>
    <p class="small muted" style="margin-top:8px">월 수입 ${money(E.monthlySalary() + (E.CLUBS[p.club].youth ? 80 : 0))} · 장비는 한 번 사면 계속 유지되고, 스태프·주거는 매달 비용이 나갑니다. 자금이 모자라면 비싼 계약부터 자동 해지됩니다.</p></div>`;
  h += `<div class="card"><h2>${clubLogo(p.club, 22)} ${ib('facility', '구단 시설')} <span class="tag y">${'★'.repeat(lvl)}${'☆'.repeat(5 - lvl)}</span></h2>
    <p class="small">${esc(E.clubName(p.club))}: 성장 ×${f.growth} · 스킬 수련 ×${f.skill} · 부상 위험 ×${f.injury} · 월 피로 회복 +${f.recovery}</p>
    <p class="small muted">더 좋은 구단으로 이적하면 시설 등급이 올라갑니다.</p>
    <h3>현재 총 효과 (시설 + 장비 + 스태프)</h3><p class="small"><b>성장 ×${B.growth.toFixed(2)} · 스킬 수련 ×${B.skill.toFixed(2)} · 부상 위험 ×${B.injury.toFixed(2)} · 피로 회복 +${B.recovery} · 판단 +${B.dec}%p · 사기 기준 +${B.morale}</b></p></div>`;
  h += `<div class="card"><h2>🛒 장비 <span class="small muted">(일시 구매 · 영구 효과)</span></h2>`;
  for (const k in EQUIPMENT) {
    const Q = EQUIPMENT[k], cur = eq[k] || 0;
    h += `<h3>${Q.icon} ${Q.name} — 현재: ${esc(Q.tiers[cur].name)}</h3>${Q.tiers.map((x, i) => i === 0 ? '' : `<div class="opt ${i <= cur ? 'on' : ''}"><div class="row between"><b>${esc(x.name)}</b>${i <= cur ? '<span class="tag g">보유</span>' : `<button class="chip" data-act="buy" data-arg="${k}:${i}" ${p.money < x.cost ? 'disabled' : ''}>${money(x.cost)} 구매</button>`}</div><span class="small">${fxText(x.fx)}</span></div>`).join('')}`;
  }
  h += `</div><div class="card"><h2>🧑‍💼 스태프 · 주거 <span class="small muted">(월 비용)</span></h2>`;
  for (const k in STAFF) {
    const Q = STAFF[k], cur = sf[k] || 0;
    h += `<h3>${Q.icon} ${Q.name} — 현재: ${esc(Q.tiers[cur].name)}${k === 'trainer' && p.trainerMonths > 0 ? ` <span class="tag g">패키지 ${p.trainerMonths}개월</span>` : ''}</h3>${Q.tiers.map((x, i) => `<div class="opt ${i === cur ? 'on' : ''}"><div class="row between"><b>${esc(x.name)}</b>${i === cur ? '<span class="tag g">계약 중</span>' : `<button class="chip" data-act="hire" data-arg="${k}:${i}" ${i > 0 && p.money < x.cost ? 'disabled' : ''}>${i === 0 ? '해지' : `월 ${money(x.cost)} ${i > cur ? '계약' : '변경'}`}</button>`}</div><span class="small">${fxText(x.fx)}</span></div>`).join('')}`;
  }
  return h + '</div>';
}

/* ---------- 내 능력치 표 ---------- */
function skillChips(p) {
  const ids = Object.keys(p.skills).filter(k => p.skills[k] > 0);
  if (!ids.length) return '<span class="small muted">아직 습득한 스킬이 없습니다.</span>';
  return ids.map(k => {
    const max = p.skills[k] >= SKILL_MAX_LV || (k === 'weakfoot' && p.weakFoot >= 5);
    return `<button class="chip" data-act="info" data-arg="skill:${k}">${SKILLS[k].icon} ${SKILLS[k].name} <b>Lv${p.skills[k]}</b>${max ? ' <span class="tag g">MAX</span>' : ''}</button>`;
  }).join('');
}
function potView(p) {
  if (p.potKnown) return `<b>${Math.round(p.pot)}</b>`;
  const shown = p.revealed.stars || !st().run; // 이전 버전 저장 데이터는 별점 표시
  return shown ? `<span style="color:var(--gold)">${stars(p.stars)}</span> <span class="small muted">${p.stars}/5</span>` : '<span class="muted">??? (만 18세 공개)</span>';
}
function statCard() {
  const S = st(), p = S.p, se = S.season, keys = E.attrKeys();
  const rows = [];
  for (let i = 0; i < keys.length; i += 2) rows.push(keys.slice(i, i + 2));
  const cell = k => `<td>${ib('attr:' + k, ATTR_NAME[k])}</td><td class="sv"><b>${Math.floor(p.attrs[k])}</b></td><td class="sd">${se ? sign(p.attrs[k] - se.startAttrs[k], true) : ''}</td>`;
  const G = { early: '조기 성장형', normal: '표준 성장형', late: '대기만성형' };
  return `<div class="card statcard"><h2>📊 내 능력치</h2>
    <table class="st-tb"><tr><th>${ib('ovr', '오버롤')}</th><td><b class="up">${E.ovr()}</b> <span class="small muted">(최고 ${p.peak})</span></td><th>${ib('style', '포지션')}</th><td>${p.pos} · ${esc(p.style)}</td></tr>
      <tr><th>${ib('pot', '잠재력')}</th><td>${potView(p)}</td><th>${ib('weak', '약발')}</th><td>${p.weakFoot ? '★'.repeat(p.weakFoot) + '☆'.repeat(5 - p.weakFoot) : '-'}</td></tr>
      <tr><th>${ib('value', '시장 가치')}</th><td>${E.fmtFee(E.marketValue())}</td><th>${ib('growth', '성장 유형')}</th><td>${p.revealed.growth ? G[p.traits.growth] : '???'}</td></tr>
      <tr><th>${ib('facility', '구단 시설')}</th><td colspan="3"><span style="color:var(--gold)">${'★'.repeat(E.facLevel())}${'☆'.repeat(5 - E.facLevel())}</span> <span class="small muted">성장 ×${E.fac().growth} · 부상 ×${E.fac().injury}</span></td></tr></table>
    <table class="st-tb attrs">${rows.map(r => `<tr>${r.map(cell).join('')}</tr>`).join('')}</table>
    <p class="note" style="margin-top:4px">능력치 옆 숫자는 이번 시즌 시작 대비 변화 · ⓘ 항목을 누르면 설명이 나옵니다</p>
    <h3 style="margin-top:10px">🎓 보유 스킬 ${Object.keys(p.skills).filter(k => p.skills[k] > 0 && k !== 'weakfoot').length}/${SKILL_SLOTS}</h3>
    <div>${skillChips(p)}</div></div>`;
}

/* ---------- 월간 계획 ---------- */
function reportCard(r) {
  if (!r) return '';
  const d = Object.keys(r.delta).filter(k => Math.abs(r.delta[k]) >= 0.05);
  return `<div class="card"><h2>📋 ${esc(r.label)} 리포트</h2>
    <div class="grid3">
      <div class="stat"><b>${r.apps}</b><span>출전</span></div>
      <div class="stat"><b>${r.g} / ${r.a}</b><span>골 / 도움</span></div>
      <div class="stat"><b>${r.avg != null ? r.avg.toFixed(1) : '-'}</b><span>평균 평점</span></div>
    </div>
    <p class="small">오버롤 ${r.ovrBefore} → <b>${r.ovrAfter}</b> (${sign(r.ovrDelta, true)}) · 출전 비율 ${r.share}% · 수입 ${r.money >= 0 ? '+' : ''}${money(r.money)}</p>
    ${d.length ? `<div>${d.map(k => `<span class="chip static">${ATTR_NAME[k]} ${sign(r.delta[k], true)}</span>`).join('')}</div>` : ''}
    ${r.skill ? `<p class="small">🎓 ${SKILLS[r.skill.id].icon} ${SKILLS[r.skill.id].name}: ${r.skill.maxed ? '최고 레벨 달성' : `Lv${r.skill.lvl} → 다음 레벨 ${r.skill.prog}/${r.skill.next}`}</p>` : ''}
    ${r.notes.map(n => `<p class="small">${esc(n)}</p>`).join('')}
    ${r.lines.length ? `<details><summary class="small muted">경기 결과 ${r.lines.length}경기</summary><ul class="list">${r.lines.map(l => `<li class="row between"><span>${compLogo(l.comp, 14)} ${esc(l.comp)}${l.stage ? ' ' + esc(l.stage) : ''} · ${l.home ? 'vs' : '@'} ${l.type === 'intl' ? flag(l.opp, 14) : l.oppId ? clubLogo(l.oppId, 14) : ''} ${esc(l.opp)}<br><span class="small muted">${resultTxt(l)} ${l.mins ? `· ${l.mins}분${l.g ? ` · ⚽${l.g}` : ''}${l.a ? ` · 🅰️${l.a}` : ''}` : ''}</span></span><span>${statusTag(l.status)} ${l.rating != null ? `<b>${l.rating.toFixed(1)}</b>` : ''}</span></li>`).join('')}</ul></details>` : ''}
  </div>`;
}

function renderPlan() {
  const S = st(), p = S.p;
  if (!ui.draft) ui.draft = Object.assign(E.defaultPlan(), S.lastPlan || {});
  const d = ui.draft;
  const keys = E.attrKeys();
  d.focus = d.focus.filter(k => keys.includes(k));
  const fx = S.monthFx || [];
  let h = autoCard() + statCard() + reportCard(S.pending.report);
  // 일정
  h += `<div class="card hl"><h2>📅 ${MONTHS[S.month]} 일정</h2>`;
  if (S.month === 0) h += `<p class="small">☀️ 프리시즌 훈련 캠프 — 이번 달 성장 효과 ×1.4</p>`;
  if (!fx.length) h += '<p class="small muted">공식 경기가 없습니다.</p>';
  h += `<ul class="list">${fx.map((f, i) => `<li class="row between"><span class="row" style="align-items:flex-start">${clubLogo(f.opp, 30)}<span>${i === S.featuredIdx ? '⭐ ' : ''}${compLogo(f.comp, 14)} ${esc(f.comp)}${f.stage ? ' · ' + esc(f.stage) : ''}<br><span class="small muted">${f.neutral ? '중립' : f.home ? '홈' : '원정'} vs ${esc(E.clubName(f.opp))} (전력 ${Math.round(f.oppStr)})</span></span></span>${i === S.featuredIdx ? '<span class="tag y">주요 경기</span>' : ''}</li>`).join('')}</ul>`;
  if (S.intlThisMonth) h += `<p class="small">${flag(p.nat, 16)} ${NATIONS[p.nat].name} 국가대표 소집 예정 (A매치 2경기)</p>`;
  h += `<p class="small muted">⭐ 주요 경기는 직접 플레이하며 결정적인 순간에 선택합니다. 나머지 경기는 자동 진행됩니다.</p></div>`;
  // 집중 훈련
  h += `<div class="card"><h2>🎯 집중 훈련 <span class="small muted">(최대 2개)</span></h2>
    <div>${keys.map(k => `<button class="chip ${d.focus.includes(k) ? 'on' : ''}" data-act="focus" data-arg="${k}">${ATTR_NAME[k]} ${Math.round(p.attrs[k])}</button>`).join('')}</div>
    <p class="small muted">선택한 능력치에 성장의 45%가 집중됩니다. 오버롤보다 지나치게 높은 능력치는 성장이 둔화됩니다.</p>
    <h3>훈련 강도</h3><div class="opts4">${INTENSITY.map(I => `<button class="opt ${d.intensity === I.id ? 'on' : ''}" data-act="int" data-arg="${I.id}"><b>${I.icon} ${I.name}</b><span class="small">${I.desc}</span></button>`).join('')}</div>
  </div>`;
  // 스킬 수련
  const all = E.skillList();
  const sl = all.filter(x => !x.maxed);
  const mastered = all.filter(x => x.maxed && x.lvl > 0);
  h += `<div class="card"><h2>🎓 스킬 수련 <span class="small muted">(수련 중에는 능력치 성장 ×0.75)</span></h2>
    <button class="opt ${!d.skill ? 'on' : ''}" data-act="skill" data-arg=""><b>수련하지 않음</b><span class="small">능력치 성장에 전념</span></button>
    ${[sl.filter(x => x.can || x.lvl), sl.filter(x => !x.can && !x.lvl)].map((grp, gi) => (gi && grp.length ? `<details><summary class="small muted" style="margin-top:10px">🔒 조건 미달 스킬 ${grp.length}개 보기</summary>` : '') + grp.map(x => {
      const s = SKILLS[x.id];
      const lvTxt = x.lvl ? `Lv${x.lvl}` : '미습득';
      const info = x.maxed ? '최고 레벨' : x.unmet.length ? `🔒 조건: ${x.unmet.join(', ')}` : !x.slotOk ? `🔒 스킬 슬롯 가득 (최대 ${SKILL_SLOTS}개)` : `다음 레벨 ${x.prog}/${x.next}`;
      return `<button class="opt ${d.skill === x.id ? 'on' : ''}" data-act="skill" data-arg="${x.id}" ${x.can ? '' : 'disabled'}>
        <div class="row between"><b>${s.icon} ${s.name}</b><span class="tag ${x.lvl ? 'g' : ''}">${lvTxt}</span></div>
        <span class="small">${s.desc}</span>${!x.maxed && x.can ? bar(x.prog, x.next) : ''}<span class="small">${info}</span></button>`;
    }).join('') + (gi && grp.length ? '</details>' : '')).join('')}
    ${mastered.length ? `<p class="small muted">최고 레벨 달성 ${mastered.length}개 (${mastered.map(x => SKILLS[x.id].name).join(', ')})는 내 능력치 표에 표시됩니다.</p>` : ''}
    <p class="small muted">보유 스킬 ${all.filter(x => x.lvl > 0 && x.id !== 'weakfoot').length}/${SKILL_SLOTS} · 약발 ${'★'.repeat(p.weakFoot || 0) || '-'}</p></div>`;
  // 보조 활동
  h += `<div class="card"><h2>🗓️ 보조 활동</h2>${Object.keys(ACTIVITIES).map(k => {
    const A = ACTIVITIES[k], cost = E.actCost(k);
    const free = k === 'trainer' && p.trainerMonths > 0;
    return `<button class="opt ${d.act === k ? 'on' : ''}" data-act="act" data-arg="${k}" ${cost > p.money ? 'disabled' : ''}><div class="row between"><b>${A.icon} ${A.name}</b>${cost ? `<span class="tag y">${money(cost)}</span>` : free ? `<span class="tag g">패키지 ${p.trainerMonths}개월 남음</span>` : ''}</div><span class="small">${A.desc}</span></button>`;
  }).join('')}<p class="small muted">보유 자금 ${money(p.money)} · 장비·트레이너·영양사·주거는 💼 투자 탭에서 관리합니다.</p></div>`;
  const toWin = S.month < 6 ? '1월' : '시즌 종료';
  h += `<button class="btn" data-act="submit">▶ ${MONTHS[S.month]} 시작 (주요 경기 직접 플레이)</button>
    <div class="btn-row"><button class="btn sec" data-act="auto" data-arg="month">⏩ ${MONTHS[S.month]} 자동 진행</button><button class="btn sec" data-act="auto" data-arg="window">⏭️ ${toWin}까지 자동</button></div>
    <p class="note">자동 진행은 위 계획을 그대로 반복합니다. 주요 경기는 자동으로 치르고, 이벤트는 무난한 선택지를 고릅니다.</p>`;
  return h;
}

/* ---------- 경기 ---------- */
function evText(e, M) {
  const p = st().p, min = Math.floor(e.min);
  switch (e.k) {
    case 'goal': return e.by === 'me' ? [`⚽ ${min}' ${esc(p.name)} 골!`, 'goal'] : e.ast === 'me' ? [`⚽ ${min}' ${esc(M.myName)} 득점 — ${esc(p.name)}의 도움 🅰️`, 'goal'] : [`⚽ ${min}' ${esc(M.myName)} 득점`, 'goal'];
    case 'opp': return [`🥅 ${min}' ${esc(M.oppName)} 득점`, 'opp'];
    case 'flavor': return [`${min}' ${esc(e.text)}`, ''];
    case 'subin': return [`🔄 ${min}' 교체 투입!`, ''];
    case 'subout': return [`🔄 ${min}' 교체 아웃`, ''];
    case 'ht': return ['— 전반 종료 —', 'ht'];
    case 'moment': {
      const m = M.moments[e.mi];
      if (!m.res) return null;
      return [`⭐ ${min}' ${esc(m.text)}<br>→ <b>${esc(m.opts[m.res.choice].label)}</b>: ${esc(m.res.text)}`, 'mom'];
    }
    default: return null;
  }
}

function optHint(o) {
  if (o.out === 'safe') return '안전한 선택 · 득점 없음';
  if (o.out === 'foul') return '확실히 끊지만 경고 위험';
  if (o.attrLabel) return `예상 성공률 약 ${pct(o.p)}% · ${esc(o.attrLabel)}${o.off ? ' · 오프사이드 위험' : ''}${o.cr ? ' · 실패 시 역습 위험' : ''}${o.red ? ' · 퇴장 위험' : ''}`;
  const N = { morale: '사기', rep: '명성', trust: '감독 신뢰', fatigue: '피로', dec: '남은 경기 판단력' };
  const parts = [];
  for (const k in (o.e || {})) { const v = o.e[k]; parts.push(`${N[k]} ${v > 0 ? '+' : '−'}`); }
  if (o.yp) parts.push(o.yp >= 1 ? '경고 확정' : `경고 위험 ${pct(o.yp)}%`);
  if (o.injp) parts.push('부상 위험');
  if (o.out === 'tactic') parts.unshift(o.tac === 'att' ? '후반 공격 장면 증가' : o.tac === 'def' ? '후반 수비 장면 증가' : '전술 유지');
  if (o.out === 'subreq') parts.unshift('경기에서 빠짐');
  if (o.out === 'givepk') parts.unshift('동료가 키커');
  if (o.out === 'takepk') parts.unshift('직접 PK 키커');
  if (o.luck) parts.push('상대 경고 가능성');
  return parts.join(' · ') || '선택';
}

function renderMatch() {
  const S = st(), M = S.pending.match, p = S.p;
  const key = `${S.year}-${S.month}-${M.fx.comp}-${M.oppName}`;
  if (ui.matchKey !== key) { ui.matchKey = key; ui.shown = 0; }
  const cur = M.moments[M.mi];
  const limit = M.done ? 999 : cur ? cur.min + 0.5 : 999;
  const vis = M.ev.filter(e => e.min <= limit && !(e.k === 'moment' && !M.moments[e.mi].res));
  let gf = 0, ga = 0;
  vis.forEach(e => { if (e.k === 'goal') gf++; if (e.k === 'opp') ga++; });
  const lines = vis.map(e => evText(e, M)).filter(Boolean);
  const startNew = ui.shown;
  ui.shown = lines.length;
  const myL = M.fx.home || M.fx.neutral;
  const left = myL ? M.myName : M.oppName, right = myL ? M.oppName : M.myName;
  const sl = myL ? gf : ga, sr = myL ? ga : gf;
  const intl = M.fx.type === 'intl';
  const mySide = intl ? flag(p.nat, 44) : clubLogo(p.club, 44, true);
  const oppSide = intl ? flag(M.oppName, 44) : M.fx.opp ? clubLogo(M.fx.opp, 44, true) : badge(null, M.oppName, 44);
  const compBadge = compLogo(M.fx.comp, 18);
  let h = `<div class="card"><div class="small muted center">${compBadge} ${esc(M.fx.comp)}${M.fx.stage ? ' · ' + esc(M.fx.stage) : ''} ${M.fx.neutral ? '(중립)' : ''}</div>
    <div class="score" style="margin-top:6px"><div class="t">${myL ? mySide : oppSide}<br>${esc(left)}</div><div class="n">${sl} : ${sr}</div><div class="t">${myL ? oppSide : mySide}<br>${esc(right)}</div></div>
    <div class="center" style="margin-top:6px">${statusTag(M.part.status)} ${M.part.status === 'sub' ? `<span class="small muted">${M.part.entry}분 투입</span>` : ''}</div>
    ${M.reserveNote ? `<p class="small">${esc(M.reserveNote)}</p>` : ''}
    <div class="log">${lines.map(([t, c], i) => `<div class="ln ${c} ${i >= startNew ? 'new' : ''}" style="animation-delay:${Math.max(0, i - startNew) * 110}ms">${t}</div>`).join('')}</div></div>`;
  if (!M.done && cur) {
    h += `<div class="card moment"><div class="small muted">${Math.floor(cur.min)}분 · 결정적 순간 (${M.mi + 1}/${M.moments.length + M.slots.length + M.queue.length})</div><p class="q">⭐ ${esc(cur.text)}</p>
      ${cur.opts.map((o, i) => o.locked
        ? `<button class="opt" disabled><b>🔒 ${esc(o.label)}</b><span class="small">${esc(o.lockReason)}</span></button>`
        : `<button class="opt" data-act="mom" data-arg="${i}"><b>${esc(o.label)}</b><span class="small">${optHint(o)}</span></button>`).join('')}
    </div>`;
  }
  if (M.done) {
    const r = M.result;
    h += `<div class="card hl"><h2>🏁 경기 종료 ${r.gf}:${r.ga}${r.pens != null ? (r.pens ? ' · 승부차기 승' : ' · 승부차기 패') : ''}</h2>
      ${M.part.mins > 0 && !M.moments.length ? '<p class="small muted">이번 경기에서는 결정적인 순간이 찾아오지 않았습니다.</p>' : ''}
      ${M.part.mins > 0 ? `<div class="grid3"><div class="stat"><b>${r.rating.toFixed(1)}</b><span>평점</span></div><div class="stat"><b>${r.g}</b><span>골</span></div><div class="stat"><b>${r.a}</b><span>도움</span></div></div>` : `<p class="small muted">${M.part.status === 'injured' ? '부상으로 결장했습니다.' : M.part.status === 'susp' ? '출전 정지로 결장했습니다.' : '벤치에서 경기를 지켜봤습니다. 출전 기회를 얻으려면 감독 신뢰와 컨디션을 끌어올리세요.'}</p>`}
      <button class="btn" data-act="mdone">계속 ▶</button></div>`;
  }
  return h;
}

/* ---------- 이벤트 ---------- */
function renderEvent() {
  const S = st(), ev = S.pending.events[0], r = S.pending.evResult;
  let h = reportCard(S.pending.report);
  if (r) return h + `<div class="card hl"><h2>${esc(r.title)}</h2><p class="small muted">선택: ${esc(r.choice)}</p><p>${esc(r.text)}</p><button class="btn" data-act="evok">확인 ▶</button></div>`;
  return h + `<div class="card moment"><h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>${ev.opts.map((o, i) => `<button class="opt" data-act="ev" data-arg="${i}" ${o.dis ? 'disabled' : ''}><b>${esc(o.label)}</b>${o.hint ? `<span class="small">${esc(o.hint)}</span>` : ''}</button>`).join('')}</div>`;
}

/* ---------- 이적시장 ---------- */
function renderWindow() {
  const S = st(), W = S.pending.window, p = S.p;
  const pre = autoCard();
  const kindName = { transfer: '이적', pro: '프로 계약', loan: '임대', renew: '재계약', return: '원소속팀 복귀' };
  let h = pre + `<div class="card hl"><h2>${W.kind === 'summer' ? '☀️ 여름 이적시장' : '❄️ 겨울 이적시장'}</h2>
    ${W.note ? `<p>${esc(W.note)}</p>` : ''}
    <p class="small">현재: ${clubLogo(p.club, 16)} ${esc(E.clubName(p.club))} · ${roleTag(p.contract.role)} · 계약 ${Math.max(0, p.contract.years)}년 남음 · 연봉 ${money(p.contract.salary)}</p>
    <p class="small muted">시장 가치 약 ${E.fmtFee(E.marketValue())} · 오버롤 ${E.ovr()} · 소속팀 전력 ${Math.round(E.cs(p.club))}</p>
    ${W.mustChoose ? '<p class="small"><b>⚠️ 계약이 끝났습니다. 아래 제안 중 하나를 선택해야 합니다.</b></p>' : ''}</div>`;
  if (!W.offers.length) h += '<div class="card"><p class="muted">받은 제안이 없습니다.</p></div>';
  W.offers.forEach((o, i) => {
    const L = E.leagueOf(o.lg);
    h += `<div class="card"><div class="row between"><span class="row">${clubLogo(o.club, 40, true)}<b>${esc(E.clubName(o.club))}</b></span><span class="tag b">${kindName[o.kind]}</span></div>
      <div class="small muted" style="margin-top:4px">${compLogo(L.name, 14)} ${esc(L.name)} · 팀 전력 ${Math.round(E.cs(o.club))} · 시설 <span style="color:var(--gold)">${'★'.repeat(E.facLevel(o.club))}</span></div>
      <div class="small" style="margin-top:6px">${o.early ? '<span class="tag y">🔼 활약 보상 조기 재계약</span> ' : ''}${roleTag(o.role)} · ${o.kind === 'loan' ? '1시즌 임대' : `${o.years}년 계약`} · 연봉 ${money(o.salary)}${o.fee > 0 ? ` · 이적료 ${E.fmtFee(o.fee)}` : o.kind === 'transfer' ? ' · 자유 계약' : ''}</div>
      <button class="btn" data-act="win" data-arg="${i}">선택</button></div>`;
  });
  if (!W.mustChoose) h += `<button class="btn sec" data-act="win" data-arg="-1">현 소속팀 잔류</button>`;
  return h;
}

/* ---------- 시즌 결산 ---------- */
function renderSeasonEnd() {
  const S = st(), s = S.pending.summary;
  const t = s.totals;
  return autoCard() + `<div class="card gold"><h2>📜 ${s.label} 시즌 결산</h2>
    <p>${clubLogo(s.club, 22)} ${esc(E.clubName(s.club))} · ${compLogo(s.lg, 16)} ${esc(s.lg)} <b>${s.pos}위</b> / ${s.teams}팀</p>
    <div class="grid3"><div class="stat"><b>${t.apps}</b><span>출전</span></div><div class="stat"><b>${t.g} / ${t.a}</b><span>골 / 도움</span></div><div class="stat"><b>${t.apps ? (t.rs / t.apps).toFixed(2) : '-'}</b><span>평균 평점</span></div></div>
    <p class="small">${esc(s.cupName)}: ${esc(s.cup)}${s.cont ? `<br>${esc(s.cont)}` : ''}</p>
    <p class="small">오버롤 ${s.ovrStart} → <b>${s.ovrEnd}</b> ${sign(s.ovrEnd - s.ovrStart)}${s.caps ? ` · A매치 ${s.caps}경기` : ''}</p>
    ${s.trophies.length ? `<h3>🏆 우승</h3>${s.trophies.map(x => `<span class="chip static">${compLogo(x, 16)} ${esc(x)}</span>`).join('')}` : ''}
    ${s.awards.length ? `<h3>🏅 개인상</h3>${s.awards.map(x => `<span class="chip static">${esc(x)}</span>`).join('')}` : ''}
    <button class="btn" data-act="sack">다음 ▶</button></div>`;
}

/* ---------- 대표팀 대회 ---------- */
function renderTour() {
  const S = st(), tr = S.pending.tour, p = S.p;
  const stage = tr.alive ? (tr.bronze ? '3·4위전' : E.TOURS[tr.id].ko[tr.si]) : '';
  return `<div class="card gold"><h2>${compLogo(tr.name, 22) || '🌍'} ${esc(tr.name)}</h2><p class="small">${flag(p.nat, 16)} ${NATIONS[p.nat].name}${tr.u23 ? ' U-23' : ''} 대표팀에 발탁됐습니다!</p>
    <ul class="list">${tr.games.map(l => `<li class="row between"><span>${esc(l.stage)} vs ${flag(l.opp, 14)} ${esc(l.opp)}<br><span class="small muted">${resultTxt(l)}${l.mins ? ` · ${l.mins}분${l.g ? ` · ⚽${l.g}` : ''}${l.a ? ` · 🅰️${l.a}` : ''}` : ''}</span></span><span>${statusTag(l.status)} ${l.rating != null ? `<b>${l.rating.toFixed(1)}</b>` : ''}</span></li>`).join('')}</ul>
    ${tr.alive ? `<p class="small">조별리그 ${tr.pts}점 — 토너먼트 진행 중</p><button class="btn" data-act="tnext">⭐ ${stage} 경기 ▶</button>`
      : `<p><b>최종 성적: ${esc(tr.result)}</b></p>${tr.exempt ? '<p class="small">🎖️ 병역 특례 대상이 됐습니다! (예술·체육요원 편입)</p>' : ''}<button class="btn" data-act="tack">계속 ▶</button>`}</div>`;
}

/* ---------- 오프시즌 ---------- */
function renderOff() {
  const S = st(), off = S.pending.off;
  const b = off.ballon;
  let h = `<div class="card gold"><h2>🌟 ${off.label} 발롱도르 시상식</h2>`;
  if (!b) h += '<p class="muted">이번 시즌에는 후보에 오르지 못했습니다.</p>';
  else if (b.rank === 1) h += `<p class="big center">🏆</p><p class="center"><b>${esc(S.p.name)}, 발롱도르 수상!</b><br>세계 최고의 선수로 선정됐습니다.</p>`;
  else if (b.rank) h += `<p class="center"><b>최종 ${b.rank}위</b></p>`;
  else h += '<p class="muted">30인 후보 명단에 들지 못했습니다.</p>';
  if (b && b.extra.length) h += b.extra.map(x => `<p class="center">🏅 ${esc(x)} 수상</p>`).join('');
  h += '</div>';
  h += `<div class="card"><h2>🗓️ 오프시즌</h2>${off.notes.length ? off.notes.map(n => `<p class="small">${esc(n)}</p>`).join('') : '<p class="small muted">특별한 소식은 없습니다.</p>'}
    ${off.forced ? `<p><b>${esc(off.forced)}</b></p><button class="btn" data-act="off" data-arg="retire">은퇴식으로 ▶</button>`
      : `<button class="btn" data-act="off" data-arg="continue">새 시즌 준비 ▶</button>${off.canRetire ? '<button class="btn danger" data-act="off" data-arg="retire">은퇴를 선언한다</button>' : ''}`}</div>`;
  return h;
}

/* ---------- 은퇴 ---------- */
function careerCard(c) {
  return `<div class="card gold"><h2>🏛️ ${esc(c.name)}</h2><p class="small">${flag(c.nat, 14)} ${NATIONS[c.nat].name} · ${posName(c.pos)} · 만 ${c.age}세 은퇴 · ${c.seasons}시즌</p>
    <p><span class="tag y">${esc(c.type)}</span></p>
    <div class="grid3"><div class="stat"><b>${c.ballon}</b><span>발롱도르</span></div><div class="stat"><b>${c.peak}</b><span>최고 오버롤 (${c.peakAge}세)</span></div><div class="stat"><b>${c.indiv}</b><span>개인상</span></div>
    <div class="stat"><b>${c.apps}</b><span>출전</span></div><div class="stat"><b>${c.g} / ${c.a}</b><span>골 / 도움</span></div><div class="stat"><b>${c.caps}</b><span>A매치 (${c.intlGoals}골)</span></div></div>
    <p class="small">우승 ${c.trophies}회 · 대표 구단 ${esc(c.topClub)}</p><p class="small muted">거쳐 간 구단: ${c.clubs.map(esc).join(' → ') || '-'}</p></div>`;
}
function renderRetired() {
  const S = st(), c = S.pending.career;
  if (!S.hofSaved) { addHof(c); S.hofSaved = true; save(); }
  if (!S.lpAwarded && c.lp) { const L = getLegacy(); L.lp += c.lp.total; L.earned += c.lp.total; L.runs += 1; setLegacy(L); S.lpAwarded = true; save(); }
  const lpCard = c.lp ? `<div class="card hl"><h2>🏅 레거시 포인트 +${c.lp.total} LP</h2><ul class="list">${c.lp.parts.map(([k, v]) => `<li class="row between"><span>${esc(k)}</span><b>+${v}</b></li>`).join('')}</ul>
    <p class="small">보유 LP: <b>${getLegacy().lp}</b> — 다음 회차 선수를 강화하세요.</p><button class="btn" data-act="legacy">🏅 레거시 업그레이드</button></div>` : '';
  return `${S.pending.reason ? `<div class="card"><p>${esc(S.pending.reason)}</p></div>` : ''}${careerCard(c)}${lpCard}
    <div class="card"><h3>우승 기록</h3><ul class="list">${c.trophyList.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">없음</li>'}</ul>
    <h3>개인상</h3><ul class="list">${c.awardList.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">없음</li>'}</ul></div>
    <button class="btn" data-act="hof">🏛️ 명예의 전당</button><button class="btn sec" data-act="newconfirm">새 커리어 시작</button>`;
}

/* ---------- 선수 탭 ---------- */
function renderPlayer() {
  const S = st(), p = S.p, keys = E.attrKeys(), se = S.season;
  const G = { early: '조기 성장형', normal: '표준 성장형', late: '대기만성형' };
  let h = `<div class="card"><div class="row between"><div><h2 style="margin:0">${esc(p.name)}</h2><div class="small muted">${posName(p.pos)} · ${esc(p.style)} · ${flag(p.nat, 14)} ${NATIONS[p.nat].name}</div></div><div class="ovr" style="min-width:60px;height:60px;font-size:26px">${E.ovr()}<small>OVR</small></div></div>
    <p class="small">${ib('pot', '잠재력')} ${potView(p)} · ${ib('weak', '약발')} ${p.weakFoot ? '★'.repeat(p.weakFoot) : '-'} · ${ib('ovr', '최고 오버롤')} ${p.peak}</p>
    ${keys.map(k => `<div class="attr"><span>${ib('attr:' + k, ATTR_NAME[k])}</span>${bar(p.attrs[k], 99)}<span class="v">${Math.floor(p.attrs[k])}</span><span class="d">${se ? sign(p.attrs[k] - se.startAttrs[k], true) : ''}</span></div>`).join('')}
    <p class="note">오른쪽 숫자는 이번 시즌 시작 대비 변화입니다.</p></div>`;
  h += `<div class="card"><h2>🧬 숨은 특성</h2>
    <p class="small">${ib('growth', '성장 유형')}: <b>${p.revealed.growth ? G[p.traits.growth] : '??? (만 18세에 공개)'}</b></p>
    <p class="small">${ib('prof', '프로 의식')}: <b>${p.revealed.prof ? (p.traits.prof >= 1.05 ? '매우 높음' : p.traits.prof >= 0.95 ? '보통' : '낮음') : '??? (만 19세에 공개)'}</b></p>
    <p class="small">${ib('injury', '부상 체질')}: <b>${p.revealed.injury ? (p.traits.injury <= 0.9 ? '강함' : p.traits.injury <= 1.2 ? '보통' : '약함') : '??? (만 20세에 공개)'}</b></p></div>`;
  const sk = Object.keys(p.skills).filter(k => p.skills[k] > 0);
  h += `<div class="card"><h2>🎓 보유 스킬</h2>${sk.length ? sk.map(k => `<div class="row between" style="margin:6px 0"><span>${ib('skill:' + k, `${SKILLS[k].icon} <b>${SKILLS[k].name}</b>`)}<br><span class="small muted">${SKILLS[k].desc}</span></span><span class="tag g">Lv${p.skills[k]}${p.skills[k] >= SKILL_MAX_LV || (k === 'weakfoot' && p.weakFoot >= 5) ? ' MAX' : ''}</span></div>`).join('') : '<p class="small muted">아직 습득한 스킬이 없습니다. 월간 계획에서 스킬 수련을 선택하세요.</p>'}
    ${p.rec ? `<p class="small muted">추천 스킬: ${p.rec.map(k => SKILLS[k].name).join(', ')}</p>` : ''}</div>`;
  const mil = p.nat === 'KOR' ? (p.mil.exempt ? '병역 특례 (예술·체육요원)' : p.mil.done ? '군필' : p.mil.serving ? '김천 상무 복무 중' : p.mil.planned ? '시즌 후 입대 예정' : '미필 (만 28세 전 입대 필요)') : null;
  h += `<div class="card"><h2>📄 계약 · 상태</h2><ul class="list">
    <li class="row between"><span>소속</span><b>${clubLogo(p.club, 18)} ${esc(E.clubName(p.club))}</b></li>
    <li class="row between"><span>${ib('role', '역할')}</span>${roleTag(p.contract.role)}</li>
    <li class="row between"><span>계약 기간</span><b>${Math.max(0, p.contract.years)}년 남음${p.contract.type === 'loan' ? ' (임대)' : ''}</b></li>
    <li class="row between"><span>연봉</span><b>${money(p.contract.salary)}</b></li>
    <li class="row between"><span>보유 자금</span><b>${money(p.money)}</b></li>
    <li class="row between"><span>${ib('value', '시장 가치')}</span><b>${E.fmtFee(E.marketValue())}</b></li>
    <li class="row between"><span>에이전트</span><b>${p.agent === 'big' ? '대형 에이전시' : p.agent === 'small' ? '소형 에이전시' : '없음'}</b></li>
    <li class="row between"><span>A매치</span><b>${p.intl.caps}경기 ${p.intl.goals}골</b></li>
    ${mil ? `<li class="row between"><span>병역</span><b>${mil}</b></li>` : ''}
  </ul></div>`;
  return h;
}

/* ---------- 기록 탭 ---------- */
function renderRecord() {
  const S = st(), se = S.season;
  let h = `<div class="card"><h2>📈 ${se.label} 시즌 기록</h2><div class="scroll-x"><table class="tb"><tr><th>대회</th><th></th><th>경기</th><th>골</th><th>도움</th><th>${E.group() === 'GK' ? '무실점' : 'MOM'}</th><th>평점</th></tr>
    ${Object.keys(se.stats).map(k => { const s = se.stats[k]; return `<tr><td>${esc(k)}</td><td></td><td>${s.apps}</td><td>${s.g}</td><td>${s.a}</td><td>${E.group() === 'GK' ? s.cs : s.motm}</td><td>${(s.rs / s.apps).toFixed(2)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">아직 출전 기록이 없습니다.</td></tr>'}
    </table></div></div>`;
  h += `<div class="card"><h2>📰 뉴스</h2><ul class="list">${S.news.slice(0, 15).map(n => `<li>${esc(n.t)} <span class="small muted">${esc(n.when)}</span></li>`).join('')}</ul></div>`;
  if (S.history.length) {
    h += `<div class="card"><h2>🗂️ 커리어</h2><div class="scroll-x"><table class="tb"><tr><th>시즌</th><th>구단</th><th>OVR</th><th>경기</th><th>골</th><th>도움</th><th>평점</th></tr>
      ${S.history.map(x => `<tr><td>${x.label}</td><td>${x.clubs.map(esc).join('/')}</td><td>${x.ovr}</td><td>${x.apps}</td><td>${x.g}</td><td>${x.a}</td><td>${x.avg != null ? x.avg.toFixed(1) : '-'}</td></tr>`).join('')}
      </table></div></div>`;
    const tro = S.trophies, aw = S.awards;
    h += `<div class="card"><h2>🏆 우승 ${tro.length}회</h2>${tro.map(t => `<span class="chip static">${esc(t.y)} ${esc(t.t)}</span>`).join('') || '<p class="small muted">없음</p>'}
      <h3>🏅 개인상 ${aw.length}회</h3>${aw.map(t => `<span class="chip static">${esc(t.y)} ${esc(t.t)}</span>`).join('') || '<p class="small muted">없음</p>'}</div>`;
  }
  return h;
}

/* ---------- 순위 탭 ---------- */
function renderTable() {
  const S = st(), se = S.season, L = se.league, order = E.sortedTable(L);
  let h = `<div class="card"><h2>${compLogo(L.name, 22) || '🏆'} ${esc(L.name)}</h2><div class="scroll-x"><table class="tb"><tr><th>#</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
    ${order.map((id, i) => { const t = L.table[id]; return `<tr class="${id === S.p.club ? 'me' : ''}"><td>${i + 1}</td><td>${clubLogo(id, 16)} ${esc(E.clubName(id))}</td><td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf - t.ga}</td><td>${t.pts}</td></tr>`; }).join('')}
    </table></div></div>`;
  h += `<div class="card"><h2>🎫 컵 · 대륙대회</h2><p class="small">${esc(se.cup.name)}: ${se.cup.alive ? '진행 중' : ''} ${esc(se.cup.result || '')}</p>
    ${se.cont ? `<p class="small">${esc(se.cont.name)}: ${se.cont.alive ? (se.cont.stage === 'league' ? `리그 페이즈 ${se.cont.played}경기 ${se.cont.pts}점` : '토너먼트 진행 중') : ''} ${esc(se.cont.result || '')}</p>` : '<p class="small muted">대륙대회 출전권 없음</p>'}</div>`;
  return h;
}

/* ---------- 메뉴 ---------- */
function renderMenu() {
  let theme = 'system';
  try { theme = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { /* noop */ }
  return `<div class="card"><h2>☰ 메뉴</h2>
    <h3>화면 모드</h3><div>${[['system', '시스템'], ['light', '라이트'], ['dark', '다크']].map(([k, n]) => `<button class="chip ${theme === k ? 'on' : ''}" data-act="theme" data-arg="${k}">${n}</button>`).join('')}</div>
    <h3>저장</h3><p class="small cloud-st">${cloudText()}</p><p class="small muted">진행 내용은 선택할 때마다 자동 저장됩니다. 백업이 필요하면 파일로 내보내세요.</p>
    <button class="btn sec" data-act="export">💾 저장 파일 내보내기</button>
    <button class="btn sec" data-act="import">📂 저장 파일 가져오기</button><input type="file" id="importFile" accept=".json,application/json" style="display:none">
    <h3>기타</h3>
    <button class="btn sec" data-act="hof">🏛️ 명예의 전당</button>
    <button class="btn sec" data-act="guide">📖 게임 방법</button>
    <button class="btn sec" data-act="home">🏠 처음 화면</button>
    <button class="btn danger" data-act="newconfirm">현재 커리어를 버리고 새로 시작</button></div>`;
}

function renderHof() {
  const h = getHof();
  return `<div class="wrap"><div class="card"><h2>🏛️ 명예의 전당</h2><p class="small muted">이 기기에서 은퇴한 선수 기록입니다. 발롱도르 → 최고 오버롤 → 개인상 → 공격포인트 순으로 정렬합니다.</p></div>
    ${h.length ? h.map((c, i) => `<div class="small muted" style="margin-top:14px">#${i + 1}</div>${careerCard(c)}`).join('') : '<div class="card"><p class="muted">아직 은퇴한 선수가 없습니다.</p></div>'}
    <button class="btn sec" data-act="back">← 돌아가기</button></div>`;
}

function renderGuide() {
  return `<div class="wrap"><div class="card"><h2>📖 게임 방법</h2>
    <h3>1. 한 시즌 = 12개월</h3><p class="small">7월 프리시즌 → 8월~5월 매달 진행 → 6월 시즌 결산. 1월과 시즌 종료 후에는 이적시장이 열립니다.</p>
    <h3>2. 매달 정하는 것</h3><p class="small">🎯 집중 훈련(능력치 최대 2개) · 훈련 강도(4단계) · 🎓 스킬 수련 · 🗓️ 보조 활동(휴식·영상 분석 등). 빠르게 넘기고 싶으면 ⏩ 자동 진행 버튼을 쓰세요.</p>
    <h3>2-1. 💼 투자</h3><p class="small">번 돈으로 장비(영구)·트레이너·영양사·주거(월 비용)에 투자하면 성장 속도, 부상 위험, 피로 회복, 경기 판단이 좋아집니다. 좋은 구단일수록 시설 등급이 높아 같은 훈련도 효과가 큽니다.</p>
    <h3>3. 주요 경기</h3><p class="small">매달 가장 중요한 경기 하나를 직접 플레이합니다. 결정적 순간마다 선택지가 나오며, 성공률은 능력치·스킬·컨디션·상대 전력으로 정해집니다. 스킬을 배우면 새 선택지가 열립니다.</p>
    <h3>4. 출전 기회</h3><p class="small">오버롤, 감독 신뢰, 컨디션이 소속팀 전력과 비교되어 선발·교체·명단 제외가 정해집니다. 명단에서 제외되면 2군 경기에서 어필할 수 있습니다.</p>
    <h3>5. 성장</h3><p class="small">나이가 어릴수록, 출전 시간이 많을수록, 훈련 강도가 높을수록 빠르게 성장합니다. 잠재력에 가까워질수록 성장이 느려지고, 만 30세 무렵부터 능력치가 떨어집니다. 강훈련은 피로와 부상 위험을 키웁니다.</p>
    <h3>6. 병역 (대한민국 국적)</h3><p class="small">만 28세 전에 김천 상무에서 약 18개월간 복무해야 합니다. 아시안게임 금메달 또는 올림픽 메달을 따면 병역 특례 대상이 됩니다.</p>
    <h3>7. 은퇴 · 다회차</h3><p class="small">만 32세부터 은퇴할 수 있으며, 은퇴한 선수는 명예의 전당에 기록됩니다. 은퇴하면 커리어 성적에 따라 <b>레거시 포인트(LP)</b>를 받고, 🏅 레거시 업그레이드에서 잠재력 하한·시작 오버롤·성장 효율·스킬 수련·시작 자금·부상 내성·약발·성장 유형 선택·시작 스킬을 영구 강화할 수 있습니다. 회차를 거듭할수록 더 좋은 선수로 시작합니다.</p>
    <p class="note">본 게임의 경기 결과·능력치·계약·이적료는 가상 기록이며 실제 선수·구단 평가와 무관합니다.</p></div>
    <button class="btn sec" data-act="back">← 돌아가기</button></div>`;
}

/* ---------- 렌더 ---------- */
function render() {
  const app = $('#app');
  const S = st();
  if (ui.screen === 'home') { app.innerHTML = renderHome(); return; }
  if (ui.screen === 'create') { app.innerHTML = renderCreate(); return; }
  if (ui.screen === 'hof') { app.innerHTML = renderHof(); return; }
  if (ui.screen === 'guide') { app.innerHTML = renderGuide(); return; }
  if (ui.screen === 'legacy') { app.innerHTML = renderLegacy(); return; }
  if (!S) { ui.screen = 'home'; return render(); }
  let body = '';
  if (ui.tab === 'play') {
    const ph = S.phase;
    body = ph === 'plan' ? renderPlan() : ph === 'match' ? renderMatch() : ph === 'event' ? renderEvent() : ph === 'window' ? renderWindow()
      : ph === 'seasonEnd' ? renderSeasonEnd() : ph === 'tournament' ? renderTour() : ph === 'offseason' ? renderOff() : ph === 'retired' ? renderRetired() : '';
  } else if (ui.tab === 'player') body = renderPlayer();
  else if (ui.tab === 'shop') body = renderShop();
  else if (ui.tab === 'record') body = renderRecord();
  else if (ui.tab === 'table') body = renderTable();
  else body = renderMenu();
  if (ui.confirmNew) body = `<div class="card moment"><h2>⚠️ 새 커리어</h2><p>현재 진행 중인 커리어가 삭제됩니다. 필요하면 먼저 저장 파일을 내보내세요.</p><div class="btn-row"><button class="btn sec" data-act="newcancel">취소</button><button class="btn danger" data-act="newgo">삭제하고 새로 시작</button></div></div>` + body;
  app.innerHTML = header() + `<div class="wrap">${body}</div>` + tabs();
}

function act(fn) { fn(); save(); render(); }
function scrollTop() { window.scrollTo(0, 0); }

/* ---------- 입력 처리 ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const a = b.dataset.act, arg = b.dataset.arg;
  const S = st();
  switch (a) {
    case 'info': openInfo(arg); break;
    case 'infoclose': closeInfo(); break;
    case 'tab': ui.tab = arg; render(); scrollTop(); break;
    case 'continue': { const s = loadSave(); if (s) { E.load(s); ui.screen = 'game'; ui.tab = 'play'; ui.draft = null; render(); } break; }
    case 'new':
      if (loadSave()) { ui.screen = 'game'; E.load(loadSave()); ui.confirmNew = true; ui.tab = 'menu'; render(); break; }
      ui.create = { name: '', nat: 'KOR', pos: 'ST', youth: null, style: null, gtype: null, sskill: null, seed: 0 }; ui.screen = 'create'; render(); break;
    case 'newconfirm': ui.confirmNew = true; ui.screen = 'game'; render(); scrollTop(); break;
    case 'newcancel': ui.confirmNew = false; render(); break;
    case 'newgo': clearSave(); ui.confirmNew = false; ui.create = { name: '', nat: 'KOR', pos: 'ST', youth: null, style: null, gtype: null, sskill: null, seed: 0 }; ui.screen = 'create'; render(); scrollTop(); break;
    case 'home': ui.screen = 'home'; render(); scrollTop(); break;
    case 'hof': ui.prev = ui.screen; ui.screen = 'hof'; render(); scrollTop(); break;
    case 'guide': ui.prev = ui.screen; ui.screen = 'guide'; render(); scrollTop(); break;
    case 'back': ui.screen = ['home', 'create', 'game'].includes(ui.prev) ? ui.prev : (st() ? 'game' : 'home'); render(); scrollTop(); break;
    case 'cpos': readCreate(); ui.create.pos = arg; render(); break;
    case 'cstyle': readCreate(); ui.create.style = arg; render(); break;
    case 'cgtype': readCreate(); ui.create.gtype = arg || null; render(); break;
    case 'csskill': readCreate(); ui.create.sskill = arg; render(); break;
    case 'cstart': {
      readCreate();
      const c = ui.create, L = getLegacy(), pk = E.perksFrom(L.levels);
      const cand = E.genPlayer(c.pos, c.style, c.seed, pk, pk.chooseType ? c.gtype : null);
      const name = (c.name || '').trim() || '루키';
      E.newCareer({ name, nat: c.nat, pos: c.pos, cand, youthClub: c.youth, seed: (c.seed * 7 + 13) >>> 0, perks: pk, startSkill: c.sskill, run: L.runs + 1 });
      ui.screen = 'game'; ui.tab = 'play'; ui.draft = null; save(); render(); scrollTop(); break;
    }
    case 'legacy': ui.prev = ui.screen; ui.screen = 'legacy'; render(); scrollTop(); break;
    case 'legbuy': {
      const L = getLegacy(), x = LEGACY.find(y => y.id === arg), lv = L.levels[arg] || 0;
      if (x && lv < x.max && L.lp >= x.cost[lv]) { L.lp -= x.cost[lv]; L.levels[arg] = lv + 1; setLegacy(L); toast(`${x.name} Lv${lv + 1} 강화 완료`); }
      render(); break;
    }
    case 'focus': {
      const f = ui.draft.focus, i = f.indexOf(arg);
      if (i >= 0) f.splice(i, 1); else { f.push(arg); if (f.length > 2) f.shift(); }
      render(); break;
    }
    case 'int': ui.draft.intensity = +arg; render(); break;
    case 'skill': ui.draft.skill = arg || null; render(); break;
    case 'act': ui.draft.act = arg; render(); break;
    case 'submit': act(() => { E.submitPlan(ui.draft); ui.draft = null; }); scrollTop(); break;
    case 'auto': act(() => { const d = ui.draft; E.autoRun(d, arg); ui.draft = null; }); scrollTop(); break;
    case 'buy': { const [k, i] = arg.split(':'); const err = E.buyEquip(k, +i); act(() => {}); toast(err || `${EQUIPMENT[k].tiers[+i].name} 구입 완료`); break; }
    case 'hire': { const [k, i] = arg.split(':'); const err = E.setStaff(k, +i); act(() => {}); toast(err || (+i ? `${STAFF[k].tiers[+i].name} 계약 (이번 달 진행분부터 효과·비용 적용)` : `${STAFF[k].name} 계약 해지`)); break; }
    case 'mom': act(() => E.resolveMoment(+arg)); break;
    case 'mdone': act(() => E.matchDone()); scrollTop(); break;
    case 'ev': act(() => E.eventChoice(+arg)); break;
    case 'evok': act(() => E.eventAck()); scrollTop(); break;
    case 'win': act(() => E.windowChoice(+arg)); scrollTop(); break;
    case 'sack': act(() => E.seasonAck()); scrollTop(); break;
    case 'tnext': act(() => E.tourNext()); scrollTop(); break;
    case 'tack': act(() => E.tourAck()); scrollTop(); break;
    case 'off': act(() => E.offAction(arg)); scrollTop(); break;
    case 'theme': try { localStorage.setItem(THEME_KEY, arg); } catch (err) { /* noop */ } applyTheme(); render(); break;
    case 'export': exportSave(); break;
    case 'import': $('#importFile').click(); break;
    default: break;
  }
});
document.addEventListener('click', e => { if (e.target.id === 'sheet') closeInfo(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfo(); });
document.addEventListener('change', e => {
  if (e.target.id === 'cYouth') { readCreate(); render(); }
  if (e.target.id === 'cNat') { readCreate(); ui.create.youth = null; render(); }
  if (e.target.id === 'importFile') importSave(e.target.files[0]);
});
function readCreate() {
  const n = $('#cName'), nat = $('#cNat'), y = $('#cYouth');
  if (n) ui.create.name = n.value;
  if (nat) ui.create.nat = nat.value;
  if (y) ui.create.youth = y.value;
}
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600);
}
async function exportSave() {
  const S = st();
  if (!S) return;
  const filename = `football-life-${S.p.name}-${S.season ? S.season.label : ''}.json`;
  const data = JSON.stringify(S);
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if (dl) {
    try { await dl.save({ filename, data }); toast('저장 파일을 내보냈습니다.'); }
    catch (e) { toast(e && e.code === 'declined' ? '내보내기를 취소했습니다.' : '이 화면에서는 파일로 내보낼 수 없습니다.'); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importSave(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const s = JSON.parse(rd.result);
      if (!s || !s.p || !s.phase) throw new Error('형식 오류');
      E.load(s); save(); ui.screen = 'game'; ui.tab = 'play'; ui.draft = null; render();
      toast('저장 파일을 불러왔습니다.');
    } catch (err) { toast('저장 파일을 읽을 수 없습니다. 이 게임에서 내보낸 .json 파일인지 확인해 주세요.'); }
  };
  rd.readAsText(file);
}

applyTheme();
migrateLegacy();
render();
initCloud();

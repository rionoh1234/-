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

/* ---------- 저장 ---------- */
function save() { try { if (st()) localStorage.setItem(SAVE_KEY, JSON.stringify(st())); } catch (e) { /* 저장 불가 환경 */ } }
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ } }
function getHof() { try { return JSON.parse(localStorage.getItem(HOF_KEY) || '[]'); } catch (e) { return []; } }
function addHof(c) {
  try {
    const h = getHof();
    h.push({ ...c, savedAt: Date.now() });
    h.sort((a, b) => (b.ballon - a.ballon) || (b.peak - a.peak) || (b.indiv - a.indiv) || ((b.g + b.a) - (a.g + a.a)));
    localStorage.setItem(HOF_KEY, JSON.stringify(h.slice(0, 100)));
  } catch (e) { /* noop */ }
}
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
function roleTag(r) { return `<span class="tag ${r === '주전' ? 'g' : r === '로테이션' ? 'b' : r === '유망주' ? 'y' : ''}">${esc(r)}</span>`; }
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
function badge(url, name, sz, big) {
  const ini = esc(String(name || '?').replace(/^(FC|AC|AS|RC|SC|VfB|VfL|RB|OGC|NEC|PSV|AZ|SV)\s+/, '').charAt(0));
  return `<span class="lg" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * 0.45)}px">${ini}${url ? `<img src="${esc(url)}/${big ? 'small' : 'tiny'}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
}
function clubLogo(id, sz, big) {
  const c = E.CLUBS[id];
  if (!c) return '';
  const pid = c.youth ? c.parent : id;
  return badge(HAS_LOGOS ? LOGOS.clubs[pid] : null, c.name, sz || 20, big);
}
function compLogo(name, sz) {
  const k = COMP_KEY[String(name || '').replace(/ \(유스\)$/, '')];
  const u = HAS_LOGOS && k ? LOGOS.leagues[k] : null;
  return u ? badge(u, name, sz || 18) : '';
}
function flag(x, sz) {
  const code = NATIONS[x] ? FLAG_CODE[NATIONS[x].name] : FLAG_CODE[x];
  return code ? `<img class="fl" src="https://flagcdn.com/w80/${code}.png" style="height:${Math.round((sz || 16) * 0.72)}px" alt="" onerror="this.remove()">` : '';
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
    <div class="meter">컨디션 ${Math.round(c)}${bar(c, 100, condCls(c))}</div>
    <div class="meter">감독 신뢰 ${Math.round(p.trust)}${bar(p.trust, 100)}</div>
    <div class="meter">사기 ${Math.round(p.morale)}${bar(p.morale, 100)}</div>
    <div class="meter">명성 ${Math.round(p.rep)}${bar(p.rep, 100)}</div>
  </div></div>`;
}

function tabs() {
  const T = [['play', '⚽', '진행'], ['player', '👤', '선수'], ['record', '📊', '기록'], ['table', '🏆', '순위'], ['menu', '☰', '메뉴']];
  return `<nav class="tabs"><div class="tabs-in">${T.map(([id, ic, nm]) => `<button data-act="tab" data-arg="${id}" class="${ui.tab === id ? 'on' : ''}"><span>${ic}</span>${nm}</button>`).join('')}</div></nav>`;
}

/* ---------- 홈 ---------- */
function renderHome() {
  const has = !!loadSave();
  return `<div class="hero"><div class="logo">⚽</div><h1>${GAME_TITLE}</h1><p>유스 벤치에서 발롱도르까지, 매달의 선택으로 만드는 축구 인생</p></div>
  <div class="wrap">
    ${has ? '<button class="btn" data-act="continue">▶ 이어하기</button>' : ''}
    <button class="btn ${has ? 'sec' : ''}" data-act="new">새 커리어 시작</button>
    <button class="btn sec" data-act="hof">🏛️ 명예의 전당</button>
    <button class="btn sec" data-act="guide">📖 게임 방법</button>
    <p class="note center">회원가입 없이 브라우저에 저장됩니다. 구단·대회 명칭은 식별 목적으로만 사용하며 각 권리자와 무관한 비공식 팬 게임입니다.</p>
  </div>`;
}

/* ---------- 선수 생성 ---------- */
function youthOptions(nat) { return Object.keys(E.CLUBS).filter(id => E.CLUBS[id].lg === 'Y_' + nat); }
function renderCreate() {
  const c = ui.create;
  const yo = youthOptions(c.nat);
  if (!yo.includes(c.youth)) c.youth = yo[0];
  let h = `<div class="wrap"><div class="card"><h2>👤 새 선수 만들기</h2>
    <label class="f">선수 이름 (실명 대신 닉네임 권장)</label>
    <input type="text" id="cName" maxlength="12" value="${esc(c.name)}" placeholder="예: 김루키">
    <label class="f">국적 ${flag(c.nat, 18)}</label>
    <select id="cNat">${Object.keys(NATIONS).map(k => `<option value="${k}" ${k === c.nat ? 'selected' : ''}>${NATIONS[k].name}</option>`).join('')}</select>
    <label class="f">포지션</label>
    <div>${Object.keys(POSITIONS).map(k => `<button class="chip ${k === c.pos ? 'on' : ''}" data-act="cpos" data-arg="${k}">${k} · ${POSITIONS[k].name}</button>`).join('')}</div>
    <label class="f">유스팀 ${c.nat === 'KOR' ? '(K리그 산하 고교)' : ''} ${clubLogo(c.youth, 22)}</label>
    <select id="cYouth">${yo.map(id => `<option value="${id}" ${id === c.youth ? 'selected' : ''}>${esc(E.CLUBS[id].name)}</option>`).join('')}</select>
    <button class="btn" data-act="cgen">스카우트 후보 보기 🔍</button></div>`;
  if (c.cands) {
    h += `<div class="card"><h2>🔍 스카우트 후보</h2><p class="small muted">잠재력은 스카우트의 추정치이며 실제와 다를 수 있습니다.</p>`;
    c.cands.forEach((cd, i) => {
      const keys = POSITIONS[c.pos].group === 'GK' ? ATTRS_GK : ATTRS_OUT;
      const o = Math.round(E.overallOf(cd.attrs, c.pos));
      h += `<div class="opt ${c.pick === i ? 'on' : ''}" data-act="cpick" data-arg="${i}">
        <div class="row between"><b>${esc(cd.styleName)} <span class="tag">${cd.tag}</span></b><span class="big" style="font-size:22px">${o}</span></div>
        <div class="small muted">${esc(cd.styleDesc)}</div>
        <div class="small">잠재력 <b style="color:var(--gold)">${stars(cd.stars)}</b> · 약발 ${cd.weakFoot ? '★'.repeat(cd.weakFoot) : '-'}</div>
        <div class="grid3" style="margin-top:6px">${keys.map(k => `<div class="small">${ATTR_NAME[k]} <b>${Math.round(cd.attrs[k])}</b></div>`).join('')}</div>
      </div>`;
    });
    h += `<button class="btn" data-act="cstart" ${c.pick == null ? 'disabled' : ''}>이 선수로 시작 ▶</button>
      <button class="btn sec" data-act="cgen">후보 다시 받기</button></div>`;
  }
  h += `<button class="btn sec" data-act="home">← 처음으로</button></div>`;
  return h;
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
  let h = reportCard(S.pending.report);
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
  const sl = E.skillList();
  const owned = sl.filter(x => x.lvl > 0);
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
    <p class="small muted">보유 스킬 ${owned.filter(x => x.id !== 'weakfoot').length}/${SKILL_SLOTS} · 약발 ${'★'.repeat(p.weakFoot || 0) || '-'}</p></div>`;
  // 보조 활동
  h += `<div class="card"><h2>🗓️ 보조 활동</h2>${Object.keys(ACTIVITIES).map(k => {
    const A = ACTIVITIES[k], cost = E.actCost(k);
    const free = k === 'trainer' && p.trainerMonths > 0;
    return `<button class="opt ${d.act === k ? 'on' : ''}" data-act="act" data-arg="${k}" ${cost > p.money ? 'disabled' : ''}><div class="row between"><b>${A.icon} ${A.name}</b>${cost ? `<span class="tag y">${money(cost)}</span>` : free ? `<span class="tag g">패키지 ${p.trainerMonths}개월 남음</span>` : ''}</div><span class="small">${A.desc}</span></button>`;
  }).join('')}<p class="small muted">보유 자금 ${money(p.money)}</p></div>`;
  h += `<button class="btn" data-act="submit">▶ ${MONTHS[S.month]} 시작</button>`;
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
    h += `<div class="card moment"><div class="small muted">${Math.floor(cur.min)}분 · 결정적 순간 (${M.mi + 1}/${M.moments.length})</div><p class="q">⭐ ${esc(cur.text)}</p>
      ${cur.opts.map((o, i) => o.locked
        ? `<button class="opt" disabled><b>🔒 ${esc(o.label)}</b><span class="small">${esc(o.lockReason)}</span></button>`
        : `<button class="opt" data-act="mom" data-arg="${i}"><b>${esc(o.label)}</b><span class="small">${o.out === 'safe' ? '안전한 선택 · 득점 없음' : o.out === 'foul' ? '확실히 끊지만 경고 위험' : `예상 성공률 약 ${pct(o.p)}%${o.attrLabel ? ' · ' + esc(o.attrLabel) : ''}`}</span></button>`).join('')}
    </div>`;
  }
  if (M.done) {
    const r = M.result;
    h += `<div class="card hl"><h2>🏁 경기 종료 ${r.gf}:${r.ga}${r.pens != null ? (r.pens ? ' · 승부차기 승' : ' · 승부차기 패') : ''}</h2>
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
  const kindName = { transfer: '이적', pro: '프로 계약', loan: '임대', renew: '재계약', return: '원소속팀 복귀' };
  let h = `<div class="card hl"><h2>${W.kind === 'summer' ? '☀️ 여름 이적시장' : '❄️ 겨울 이적시장'}</h2>
    ${W.note ? `<p>${esc(W.note)}</p>` : ''}
    <p class="small">현재: ${clubLogo(p.club, 16)} ${esc(E.clubName(p.club))} · ${roleTag(p.contract.role)} · 계약 ${Math.max(0, p.contract.years)}년 남음 · 연봉 ${money(p.contract.salary)}</p>
    <p class="small muted">시장 가치 약 ${E.fmtFee(E.marketValue())} · 오버롤 ${E.ovr()} · 소속팀 전력 ${Math.round(E.cs(p.club))}</p>
    ${W.mustChoose ? '<p class="small"><b>⚠️ 계약이 끝났습니다. 아래 제안 중 하나를 선택해야 합니다.</b></p>' : ''}</div>`;
  if (!W.offers.length) h += '<div class="card"><p class="muted">받은 제안이 없습니다.</p></div>';
  W.offers.forEach((o, i) => {
    const L = E.leagueOf(o.lg);
    h += `<div class="card"><div class="row between"><span class="row">${clubLogo(o.club, 40, true)}<b>${esc(E.clubName(o.club))}</b></span><span class="tag b">${kindName[o.kind]}</span></div>
      <div class="small muted" style="margin-top:4px">${compLogo(L.name, 14)} ${esc(L.name)} · 팀 전력 ${Math.round(E.cs(o.club))}</div>
      <div class="small" style="margin-top:6px">${roleTag(o.role)} · ${o.kind === 'loan' ? '1시즌 임대' : `${o.years}년 계약`} · 연봉 ${money(o.salary)}${o.fee > 0 ? ` · 이적료 ${E.fmtFee(o.fee)}` : o.kind === 'transfer' ? ' · 자유 계약' : ''}</div>
      <button class="btn" data-act="win" data-arg="${i}">선택</button></div>`;
  });
  if (!W.mustChoose) h += `<button class="btn sec" data-act="win" data-arg="-1">현 소속팀 잔류</button>`;
  return h;
}

/* ---------- 시즌 결산 ---------- */
function renderSeasonEnd() {
  const S = st(), s = S.pending.summary;
  const t = s.totals;
  return `<div class="card gold"><h2>📜 ${s.label} 시즌 결산</h2>
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
  return `${S.pending.reason ? `<div class="card"><p>${esc(S.pending.reason)}</p></div>` : ''}${careerCard(c)}
    <div class="card"><h3>우승 기록</h3><ul class="list">${c.trophyList.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">없음</li>'}</ul>
    <h3>개인상</h3><ul class="list">${c.awardList.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">없음</li>'}</ul></div>
    <button class="btn" data-act="hof">🏛️ 명예의 전당</button><button class="btn sec" data-act="newconfirm">새 커리어 시작</button>`;
}

/* ---------- 선수 탭 ---------- */
function renderPlayer() {
  const S = st(), p = S.p, keys = E.attrKeys(), se = S.season;
  const G = { early: '조기 성장형', normal: '표준 성장형', late: '대기만성형' };
  let h = `<div class="card"><div class="row between"><div><h2 style="margin:0">${esc(p.name)}</h2><div class="small muted">${posName(p.pos)} · ${esc(p.style)} · ${flag(p.nat, 14)} ${NATIONS[p.nat].name}</div></div><div class="ovr" style="min-width:60px;height:60px;font-size:26px">${E.ovr()}<small>OVR</small></div></div>
    <p class="small">잠재력 (스카우트 추정) <b style="color:var(--gold)">${stars(p.stars)}</b> · 약발 ${p.weakFoot ? '★'.repeat(p.weakFoot) : '-'} · 최고 오버롤 ${p.peak}</p>
    ${keys.map(k => `<div class="attr"><span>${ATTR_NAME[k]}</span>${bar(p.attrs[k], 99)}<span class="v">${Math.floor(p.attrs[k])}</span><span class="d">${se ? sign(p.attrs[k] - se.startAttrs[k], true) : ''}</span></div>`).join('')}
    <p class="note">오른쪽 숫자는 이번 시즌 시작 대비 변화입니다.</p></div>`;
  h += `<div class="card"><h2>🧬 숨은 특성</h2>
    <p class="small">성장 유형: <b>${p.revealed.growth ? G[p.traits.growth] : '??? (만 18세에 공개)'}</b></p>
    <p class="small">프로 의식: <b>${p.revealed.prof ? (p.traits.prof >= 1.05 ? '매우 높음' : p.traits.prof >= 0.95 ? '보통' : '낮음') : '??? (만 19세에 공개)'}</b></p>
    <p class="small">부상 체질: <b>${p.revealed.injury ? (p.traits.injury <= 0.9 ? '강함' : p.traits.injury <= 1.2 ? '보통' : '약함') : '??? (만 20세에 공개)'}</b></p></div>`;
  const sk = Object.keys(p.skills).filter(k => p.skills[k] > 0);
  h += `<div class="card"><h2>🎓 보유 스킬</h2>${sk.length ? sk.map(k => `<div class="row between" style="margin:6px 0"><span>${SKILLS[k].icon} <b>${SKILLS[k].name}</b><br><span class="small muted">${SKILLS[k].desc}</span></span><span class="tag g">Lv${p.skills[k]}</span></div>`).join('') : '<p class="small muted">아직 습득한 스킬이 없습니다. 월간 계획에서 스킬 수련을 선택하세요.</p>'}
    ${p.rec ? `<p class="small muted">추천 스킬: ${p.rec.map(k => SKILLS[k].name).join(', ')}</p>` : ''}</div>`;
  const mil = p.nat === 'KOR' ? (p.mil.exempt ? '병역 특례 (예술·체육요원)' : p.mil.done ? '군필' : p.mil.serving ? '김천 상무 복무 중' : p.mil.planned ? '시즌 후 입대 예정' : '미필 (만 28세 전 입대 필요)') : null;
  h += `<div class="card"><h2>📄 계약 · 상태</h2><ul class="list">
    <li class="row between"><span>소속</span><b>${clubLogo(p.club, 18)} ${esc(E.clubName(p.club))}</b></li>
    <li class="row between"><span>역할</span>${roleTag(p.contract.role)}</li>
    <li class="row between"><span>계약 기간</span><b>${Math.max(0, p.contract.years)}년 남음${p.contract.type === 'loan' ? ' (임대)' : ''}</b></li>
    <li class="row between"><span>연봉</span><b>${money(p.contract.salary)}</b></li>
    <li class="row between"><span>보유 자금</span><b>${money(p.money)}</b></li>
    <li class="row between"><span>시장 가치</span><b>${E.fmtFee(E.marketValue())}</b></li>
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
    <h3>저장 파일</h3><p class="small muted">진행 내용은 이 브라우저에 자동 저장됩니다. 다른 기기로 옮기거나 백업하려면 파일로 내보내세요.</p>
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
    <h3>2. 매달 정하는 것</h3><p class="small">🎯 집중 훈련(능력치 최대 2개) · 훈련 강도(4단계) · 🎓 스킬 수련 · 🗓️ 보조 활동(휴식·영상 분석·개인 트레이너 등)</p>
    <h3>3. 주요 경기</h3><p class="small">매달 가장 중요한 경기 하나를 직접 플레이합니다. 결정적 순간마다 선택지가 나오며, 성공률은 능력치·스킬·컨디션·상대 전력으로 정해집니다. 스킬을 배우면 새 선택지가 열립니다.</p>
    <h3>4. 출전 기회</h3><p class="small">오버롤, 감독 신뢰, 컨디션이 소속팀 전력과 비교되어 선발·교체·명단 제외가 정해집니다. 명단에서 제외되면 2군 경기에서 어필할 수 있습니다.</p>
    <h3>5. 성장</h3><p class="small">나이가 어릴수록, 출전 시간이 많을수록, 훈련 강도가 높을수록 빠르게 성장합니다. 잠재력에 가까워질수록 성장이 느려지고, 만 30세 무렵부터 능력치가 떨어집니다. 강훈련은 피로와 부상 위험을 키웁니다.</p>
    <h3>6. 병역 (대한민국 국적)</h3><p class="small">만 28세 전에 김천 상무에서 약 18개월간 복무해야 합니다. 아시안게임 금메달 또는 올림픽 메달을 따면 병역 특례 대상이 됩니다.</p>
    <h3>7. 은퇴</h3><p class="small">만 32세부터 은퇴할 수 있으며, 은퇴한 선수는 명예의 전당에 기록됩니다.</p>
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
  if (!S) { ui.screen = 'home'; return render(); }
  let body = '';
  if (ui.tab === 'play') {
    const ph = S.phase;
    body = ph === 'plan' ? renderPlan() : ph === 'match' ? renderMatch() : ph === 'event' ? renderEvent() : ph === 'window' ? renderWindow()
      : ph === 'seasonEnd' ? renderSeasonEnd() : ph === 'tournament' ? renderTour() : ph === 'offseason' ? renderOff() : ph === 'retired' ? renderRetired() : '';
  } else if (ui.tab === 'player') body = renderPlayer();
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
    case 'tab': ui.tab = arg; render(); scrollTop(); break;
    case 'continue': { const s = loadSave(); if (s) { E.load(s); ui.screen = 'game'; ui.tab = 'play'; ui.draft = null; render(); } break; }
    case 'new':
      if (loadSave()) { ui.screen = 'game'; E.load(loadSave()); ui.confirmNew = true; ui.tab = 'menu'; render(); break; }
      ui.create = { name: '', nat: 'KOR', pos: 'ST', youth: null, cands: null, pick: null }; ui.screen = 'create'; render(); break;
    case 'newconfirm': ui.confirmNew = true; ui.screen = 'game'; render(); scrollTop(); break;
    case 'newcancel': ui.confirmNew = false; render(); break;
    case 'newgo': clearSave(); ui.confirmNew = false; ui.create = { name: '', nat: 'KOR', pos: 'ST', youth: null, cands: null, pick: null }; ui.screen = 'create'; render(); scrollTop(); break;
    case 'home': ui.screen = 'home'; render(); scrollTop(); break;
    case 'hof': ui.prev = ui.screen; ui.screen = 'hof'; render(); scrollTop(); break;
    case 'guide': ui.prev = ui.screen; ui.screen = 'guide'; render(); scrollTop(); break;
    case 'back': ui.screen = ui.prev && ui.prev !== 'hof' && ui.prev !== 'guide' ? ui.prev : (S ? 'game' : 'home'); render(); scrollTop(); break;
    case 'cpos': readCreate(); ui.create.pos = arg; ui.create.cands = null; ui.create.pick = null; render(); break;
    case 'cgen': readCreate(); ui.create.cands = E.genCandidates(ui.create.pos, ui.create.nat, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0); ui.create.pick = null; render(); break;
    case 'cpick': readCreate(); ui.create.pick = +arg; render(); break;
    case 'cstart': {
      readCreate();
      const c = ui.create;
      const name = (c.name || '').trim() || '루키';
      E.newCareer({ name, nat: c.nat, pos: c.pos, cand: c.cands[c.pick], youthClub: c.youth, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
      ui.screen = 'game'; ui.tab = 'play'; ui.draft = null; save(); render(); scrollTop(); break;
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
document.addEventListener('change', e => {
  if (e.target.id === 'cYouth') { readCreate(); render(); }
  if (e.target.id === 'cNat') { readCreate(); ui.create.cands = null; ui.create.pick = null; ui.create.youth = null; render(); }
  if (e.target.id === 'importFile') importSave(e.target.files[0]);
});
function readCreate() {
  const n = $('#cName'), nat = $('#cNat'), y = $('#cYouth');
  if (n) ui.create.name = n.value;
  if (nat) ui.create.nat = nat.value;
  if (y) ui.create.youth = y.value;
}
function exportSave() {
  const S = st();
  if (!S) return;
  const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `football-life-${S.p.name}-${S.season ? S.season.label : ''}.json`;
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
      alert('저장 파일을 불러왔습니다.');
    } catch (err) { alert('저장 파일을 읽을 수 없습니다.'); }
  };
  rd.readAsText(file);
}

applyTheme();
render();

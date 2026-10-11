'use strict';
/* =========================================================
 * 게임 엔진 (DOM 미사용 — 브라우저/Node 공용)
 * 상태(S)는 JSON 직렬화 가능해야 함 (저장/불러오기)
 * ========================================================= */

let S = null;

/* ===================== RNG & 유틸 ===================== */
function rnd() {
  S.rng = (S.rng + 0x6D2B79F5) >>> 0;
  let t = S.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sigmoid = x => 1 / (1 + Math.exp(-x));
const r1 = x => Math.round(x * 10) / 10;
// 0~100 지표: 높을수록 오르기 어렵고 낮을수록 내려가기 어렵게
const soft = (v, d) => clamp(v + (d > 0 ? d * (1 - v / 110) : d * (0.3 + v / 140)), 0, 100);
function wpick(arr, wf) {
  let tot = 0;
  const ws = arr.map(x => { const w = Math.max(0, wf(x)); tot += w; return w; });
  if (tot <= 0) return pick(arr);
  let r = rnd() * tot;
  for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
function normal() {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}
function poisson(l) {
  const L = Math.exp(-l); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L && k < 15);
  return k - 1;
}
function binom(n, p) { let k = 0; for (let i = 0; i < n; i++) if (rnd() < p) k++; return k; }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// 한국어 조사
function josa(word, a, b) {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xAC00 || ch > 0xD7A3) return word + b;
  return word + (((ch - 0xAC00) % 28) ? a : b);
}

/* ===================== 구단 ===================== */
const CLUBS = {};
for (const lg in CLUB_LIST) for (const [id, name, str] of CLUB_LIST[lg]) CLUBS[id] = { id, name, str, lg, youth: false };
const YOUTH_LEAGUES = {};
for (const nat in NATIONS) {
  const N = NATIONS[nat];
  const lgId = 'Y_' + nat;
  const parents = nat === 'KOR' ? KOR_YOUTH : CLUB_LIST[N.lg].slice(0, 12).map(c => [c[0], null]);
  const suffix = ['ENG', 'JPN', 'BRA', 'ARG'].includes(nat) ? ' U18' : ' U19';
  for (const [pid, school] of parents) {
    const par = CLUBS[pid];
    const id = 'Y_' + pid;
    CLUBS[id] = { id, name: school || (par.name + suffix), str: Math.round(40 + (par.str - 50) * 0.35), lg: lgId, youth: true, parent: pid };
  }
  YOUTH_LEAGUES[lgId] = { name: N.youthComp, nat, cup: N.youthCup, tier: 0, prestige: 0.4, wealth: 0, cont: null, slots: 0 };
}
const leagueOf = id => LEAGUES[id] || YOUTH_LEAGUES[id];
const clubsIn = lg => Object.keys(CLUBS).filter(id => CLUBS[id].lg === lg);
const cs = id => (S.cs[id] != null ? S.cs[id] : CLUBS[id].str);
const clubName = id => CLUBS[id].name;
const proClubs = () => Object.values(CLUBS).filter(c => !c.youth && c.id !== 'gimcheon');

/* ===================== 선수 ===================== */
const P = () => S.p;
const group = (pos) => POSITIONS[pos || S.p.pos].group;
const isGK = () => group() === 'GK';
const attrKeys = (pos) => (POSITIONS[pos || S.p.pos].group === 'GK' ? ATTRS_GK : ATTRS_OUT);
function overallOf(attrs, pos) {
  const w = OVR_WEIGHTS[POSITIONS[pos].group];
  let s = 0;
  for (const k in w) s += (attrs[k] || 0) * w[k];
  return s;
}
const ovrF = () => overallOf(S.p.attrs, S.p.pos);
const ovr = () => Math.round(ovrF());
const lv = id => (S.p.skills[id] || 0);
const cond = () => 100 - S.p.fatigue;
const curClub = () => CLUBS[S.p.club];
const isPro = () => !curClub().youth;

function marketValue() { // 억 원
  const p = S.p, o = ovrF();
  const ageF = p.age <= 21 ? 1.6 : p.age <= 24 ? 1.35 : p.age <= 27 ? 1.0 : p.age <= 30 ? 0.65 : 0.35;
  const potF = p.age <= 23 ? 1 + Math.max(0, p.pot - o) / 40 : 1;
  return Math.max(0.1, 0.15 * Math.exp((o - 40) / 6.5) * ageF * potF);
}
function salaryFor(o, lg) { // 만 원 / 년
  const L = LEAGUES[lg];
  return Math.round(1500 * Math.exp((o - 50) / 9) * (L ? L.wealth : 0.3) / 10) * 10;
}

/* ---------- 후보 생성 ---------- */
function genCandidates(pos, nat, seed) {
  const prev = S;
  S = { rng: seed >>> 0 };
  try { return genCandidatesInner(pos, nat); } finally { S = prev; }
}
function genCandidatesInner(pos, nat) {
  const grp = POSITIONS[pos].group;
  const keys = grp === 'GK' ? ATTRS_GK : ATTRS_OUT;
  const w = OVR_WEIGHTS[grp];
  const plans = shuffle([
    { tag: '즉시 전력형', ovr: 48, pot: [63, 80] },
    { tag: '균형형', ovr: 45, pot: [68, 88] },
    { tag: '원석형', ovr: 42, pot: [74, 95] },
  ]);
  const styles = shuffle(STYLES[grp].slice());
  return plans.map((pl, i) => {
    const st = styles[i % styles.length];
    const attrs = {};
    for (const k of keys) attrs[k] = pl.ovr + (w[k] - 1 / 6) * 45 + (st.bias[k] || 0) + normal() * 3;
    const shift = pl.ovr - overallOf(attrs, pos);
    for (const k of keys) attrs[k] = clamp(r1(attrs[k] + shift), 20, 72);
    const pot = ri(pl.pot[0], pl.pot[1]);
    const est = pot + normal() * 4;
    const stars = clamp(Math.round((est - 52) / 8.5 * 2) / 2, 1, 5);
    return {
      tag: pl.tag, style: st.id, styleName: st.name, styleDesc: st.desc, rec: st.rec, attrs, pot, stars,
      traits: {
        growth: pick(['early', 'normal', 'normal', 'late']),
        prof: Math.round((0.85 + rnd() * 0.3) * 100) / 100,
        injury: Math.round((0.7 + rnd() * 0.8) * 100) / 100,
        temper: Math.round((rnd() * 2 - 1) * 100) / 100,
      },
      weakFoot: grp === 'GK' ? 0 : ri(1, 3),
    };
  });
}

function newCareer(o) {
  // o: {name, nat, pos, cand, youthClub, seed}
  S = {
    v: 1, rng: (o.seed >>> 0) || 12345, year: 2026, month: 0, phase: 'plan', cs: {},
    p: null, season: null, history: [], trophies: [], awards: [], news: [], pending: {}, lastPlan: null,
    lastTables: {}, lastShare: 1, ballon: [], created: Date.now(), hofSaved: false,
  };
  const c = o.cand;
  const yc = o.youthClub;
  S.p = {
    name: o.name, nat: o.nat, pos: o.pos, age: 16, attrs: Object.assign({}, c.attrs), pot: c.pot, stars: c.stars,
    style: c.styleName, rec: c.rec, traits: c.traits, revealed: {}, skills: {}, skillProg: {}, weakFoot: c.weakFoot,
    trust: 50, morale: 62, fatigue: 10, rep: 2, money: 300, injury: 0, susp: 0, yellow: 0,
    club: yc, contract: { club: yc, years: 3, salary: 0, role: '유스', type: 'youth' },
    mil: { done: false, exempt: false, serving: false, planned: false },
    intl: { caps: 0, goals: 0, youthCaps: 0 }, peak: Math.round(overallOf(c.attrs, o.pos)), peakAge: 16,
    wantsMove: false, agent: null, captain: false, trainerMonths: 0, buff: {}, clubs: [yc], seasonsAtClub: 0,
    loan: null,
  };
  addNews(`${CLUBS[yc].name}에 ${o.name} 입단 — ${POSITIONS[o.pos].name}`);
  setupSeason();
  prepareMonth();
  S.phase = 'plan';
  S.pending = { report: null };
  return S;
}

function addNews(t) {
  S.news.unshift({ t, when: `${S.year}-${MONTHS[S.month] || ''}` });
  if (S.news.length > 60) S.news.length = 60;
}

/* ===================== 시즌 구성 ===================== */
function makeRounds(ids, cycles) {
  const t = ids.slice();
  if (t.length % 2) t.push(null);
  const n = t.length, base = [];
  for (let r = 0; r < n - 1; r++) {
    const rd = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) rd.push(r % 2 ? [a, b] : [b, a]);
    }
    base.push(rd);
    t.splice(1, 0, t.pop());
  }
  const rounds = [];
  for (let c = 0; c < cycles; c++) for (const rd of base) rounds.push(rd.map(([a, b]) => (c % 2 ? [b, a] : [a, b])));
  return rounds;
}

function qualifies(clubId) {
  const c = CLUBS[clubId], L = LEAGUES[c.lg];
  if (!L || !L.cont) return false;
  const last = S.lastTables[c.lg];
  if (last) { const pos = last.indexOf(clubId) + 1; if (pos > 0) return pos <= L.slots; }
  return clubsIn(c.lg).sort((a, b) => cs(b) - cs(a)).indexOf(clubId) < L.slots;
}

function buildLeague(lg, fromMonth) {
  const ids = shuffle(clubsIn(lg));
  const rounds = makeRounds(ids, ids.length <= 10 ? 3 : 2);
  const roundMonth = rounds.map((_, i) => 1 + Math.floor(i * 10 / rounds.length));
  const table = {};
  for (const id of ids) table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  const lgObj = { lg, name: leagueOf(lg).name, rounds, roundMonth, table, played: rounds.map(() => false) };
  // 시즌 도중 합류 시 이전 라운드는 즉시 시뮬레이션
  for (let r = 0; r < rounds.length; r++) if (roundMonth[r] < fromMonth) simRound(lgObj, r, null);
  return lgObj;
}

function setupSeason() {
  const p = S.p, club = curClub(), L = leagueOf(club.lg);
  S.season = {
    year: S.year, label: `${S.year}-${String((S.year + 1) % 100).padStart(2, '0')}`,
    league: buildLeague(club.lg, 1),
    cup: { name: L.cup, alive: true, result: '', youth: club.youth },
    cont: (!club.youth && L.cont && qualifies(p.club))
      ? { id: L.cont, name: CONTINENTAL[L.cont].name, pts: 0, played: 0, alive: true, stage: 'league', ko: 0, result: '' } : null,
    stats: {}, matches: [], trophies: [], awards: [], clubs: [p.club],
    startAttrs: Object.assign({}, p.attrs), startOvr: ovr(), mins: 0, possible: 0, intlCaps: 0, intlGoals: 0,
    notes: [],
  };
  p.seasonsAtClub = (p.seasonsAtClub || 0) + 1;
}

function sortedTable(lgObj) {
  const t = lgObj.table;
  return Object.keys(t).sort((a, b) => (t[b].pts - t[a].pts) || ((t[b].gf - t[b].ga) - (t[a].gf - t[a].ga)) || (t[b].gf - t[a].gf));
}
function tablePos(clubId) { return sortedTable(S.season.league).indexOf(clubId) + 1; }

function recordTable(t, h, a, hg, ag) {
  const H = t[h], A = t[a];
  if (!H || !A) return;
  H.p++; A.p++; H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
  if (hg > ag) { H.w++; A.l++; H.pts += 3; } else if (hg < ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
}

function simScore(my, opp, home, neutral, reduce) {
  const adv = neutral ? 0 : (home ? 2.5 : -2.5);
  const diff = my - opp + adv;
  const lf = clamp(1.3 * Math.exp(diff / 20) - (reduce || 0), 0.12, 4.2);
  const la = clamp(1.3 * Math.exp(-diff / 20) - (reduce || 0), 0.12, 4.2);
  return [poisson(lf), poisson(la)];
}

function simRound(lgObj, r, skipClub) {
  if (lgObj.played[r]) return;
  for (const [h, a] of lgObj.rounds[r]) {
    if (h === skipClub || a === skipClub) continue;
    const [hg, ag] = simScore(cs(h), cs(a), true, false);
    recordTable(lgObj.table, h, a, hg, ag);
  }
  lgObj.played[r] = true;
}

/* ===================== 월간 일정 ===================== */
function friendlyOpp() {
  const club = curClub();
  const pool = club.youth ? clubsIn(club.lg).filter(id => id !== club.id)
    : proClubs().filter(c => c.id !== club.id && Math.abs(c.str - cs(club.id)) < 10).map(c => c.id);
  return pick(pool.length ? pool : proClubs().map(c => c.id));
}

function cupOpp(stageIdx) {
  const club = curClub();
  let pool;
  if (club.youth) pool = clubsIn(club.lg).filter(id => id !== club.id);
  else {
    const nat = leagueOf(club.lg).nat;
    pool = proClubs().filter(c => c.id !== club.id && LEAGUES[c.lg].nat === nat).map(c => c.id);
  }
  return wpick(pool, id => Math.exp((cs(id) - 60) / 12 * (stageIdx / 2)));
}

function contOpp() {
  const se = S.season, club = curClub();
  const pool = proClubs().filter(c => c.id !== club.id && LEAGUES[c.lg].cont === se.cont.id).map(c => c.id);
  const ko = se.cont.stage === 'ko';
  return wpick(pool, id => Math.exp((cs(id) - 70) / (ko ? 5 : 8)));
}

function prepareMonth() {
  const m = S.month, se = S.season, club = curClub(), fx = [];
  const myStr = cs(club.id);
  if (m === 0) {
    const opp = friendlyOpp();
    fx.push({ type: 'friendly', comp: '프리시즌 친선경기', opp, home: rnd() < 0.5, imp: 1 });
  } else if (m >= 1 && m <= 10) {
    const L = se.league;
    L.roundMonth.forEach((mm, r) => {
      if (mm !== m) return;
      const pr = L.rounds[r].find(([h, a]) => h === club.id || a === club.id);
      if (!pr) return;
      const home = pr[0] === club.id, opp = home ? pr[1] : pr[0];
      const late = m >= 9 ? 1 : 0;
      fx.push({ type: 'league', r, comp: L.name, opp, home, imp: 2 + (cs(opp) - myStr) / 8 + late });
    });
    const cr = CUP_ROUNDS.findIndex(c => c.m === m);
    if (se.cup.alive && cr >= 0) {
      const fin = CUP_ROUNDS[cr].name === '결승';
      fx.push({ type: 'cup', comp: se.cup.name, stage: CUP_ROUNDS[cr].name, stageIdx: cr, opp: cupOpp(cr), home: rnd() < 0.5, neutral: fin, imp: fin ? 9 : 3 + cr * 1.2 });
    }
    if (se.cont && se.cont.alive) {
      if (se.cont.stage === 'league' && CONT_LEAGUE_MONTHS.includes(m)) {
        fx.push({ type: 'cont', comp: se.cont.name, stage: `리그 페이즈 ${se.cont.played + 1}차전`, opp: contOpp(), home: se.cont.played % 2 === 0, imp: 5 + CONTINENTAL[se.cont.id].prestige * 0.3 });
      } else if (se.cont.stage === 'ko' && CONT_KO[se.cont.ko] && CONT_KO[se.cont.ko].m === m) {
        const k = CONT_KO[se.cont.ko];
        fx.push({ type: 'cont', comp: se.cont.name, stage: k.name, opp: contOpp(), home: rnd() < 0.5, neutral: k.name === '결승', imp: 7 + se.cont.ko * 1.5 });
      }
    }
  }
  fx.forEach(f => { f.day = ri(1, 28); f.oppStr = cs(f.opp); });
  fx.sort((a, b) => a.day - b.day);
  let fi = -1, best = -1e9;
  fx.forEach((f, i) => { const sc = f.imp + f.oppStr / 100; if (sc > best) { best = sc; fi = i; } });
  S.monthFx = fx;
  S.featuredIdx = fi;
  S.intlThisMonth = INTL_BREAKS.includes(m) && seniorCallupCheck();
}

function seniorCallupCheck() {
  const p = S.p, N = NATIONS[p.nat];
  if (p.age < 18 || p.injury > 2 || p.mil.serving && false) return false;
  const score = ovrF() + p.rep * 0.05 + normal() * 1.2;
  return score >= N.thr;
}

/* ===================== 경기 참여 ===================== */
function roleBonus() {
  const r = S.p.contract.role;
  return (r === '주전' ? 2.5 : r === '로테이션' ? 1 : r === '유망주' ? -1 : 0) + (S.p.captain ? 3 : 0);
}

function participation(fx) {
  const p = S.p;
  if (p.injury > 0) { p.injury--; return { status: 'injured', mins: 0, entry: 0 }; }
  if (fx.type !== 'intl' && p.susp > 0) { p.susp--; return { status: 'susp', mins: 0, entry: 0 }; }
  let lvl;
  if (fx.type === 'intl') lvl = fx.teamBase - 3;
  else lvl = cs(p.club) - (fx.type === 'friendly' ? 6 : fx.type === 'cup' && fx.stageIdx < 2 ? 3 : 0);
  const score = ovrF() + (p.trust - 50) * 0.12 + (cond() - 75) * 0.06 + roleBonus() + (p.buff.sel || 0) + normal() * 2.2;
  if (score >= lvl - 1.5) {
    const subOff = rnd() < 0.2 + Math.max(0, 50 - cond()) / 100;
    return { status: 'start', mins: subOff ? ri(60, 85) : 90, entry: 0 };
  }
  if (score >= lvl - 7) {
    if (rnd() < 0.62) { const entry = ri(55, 80); return { status: 'sub', mins: 90 - entry, entry }; }
    return { status: 'bench', mins: 0, entry: 0 };
  }
  return { status: 'out', mins: 0, entry: 0 };
}

const GROWTH_K = 0.9;   // 월간 성장 계수 (밸런스 핵심값)
const FOCUS_SHARE = 0.45; // 집중 훈련 능력치에 배분되는 비율
const GOAL_SH = { ST: 0.21, W: 0.17, AM: 0.16, CM: 0.08, DM: 0.04, FB: 0.03, CB: 0.045, GK: 0 };
const AST_SH = { ST: 0.2, W: 0.17, AM: 0.21, CM: 0.14, DM: 0.07, FB: 0.10, CB: 0.03, GK: 0.01 };

function contribution(gf, mins, teamStr) {
  const g = group(), a = S.p.attrs, f = mins / 90;
  if (g === 'GK') return { g: 0, a: binom(gf, 0.01 * f) };
  const gs = GOAL_SH[g] * (a.sho / Math.max(40, teamStr)) * (1 + 0.06 * lv('finisher') + 0.04 * lv('header'));
  const goals = binom(gf, clamp(gs * f, 0, 0.36));
  const as = AST_SH[g] * Math.pow(a.pas / Math.max(40, teamStr), 1.2) * (1 + 0.06 * lv('through') + 0.05 * lv('cross'));
  return { g: goals, a: binom(gf - goals, clamp(as * f, 0, 0.35)) };
}

function matchRating(o) {
  // o: {g, a, gf, ga, mins, oppStr, saves, bonus}
  if (o.mins <= 0) return null;
  const grp = group();
  let r = 6.25;
  r += [0, 0.8, 1.4, 1.9, 2.3, 2.6][Math.min(5, o.g)];
  r += o.a * 0.55;
  r += o.gf > o.ga ? 0.35 : o.gf < o.ga ? -0.3 : 0;
  r += (ovrF() - o.oppStr) * 0.025;
  r += (cond() - 70) / 100 + (S.p.morale - 60) / 150;
  r += normal() * 0.55 * (lv('press') ? 0.85 : 1);
  if (['CB', 'FB', 'DM', 'GK'].includes(grp)) {
    if (o.ga === 0 && o.mins >= 60) r += grp === 'GK' ? 0.7 : 0.5;
    r -= o.ga * (grp === 'GK' ? 0.25 : 0.15);
  }
  if (grp === 'GK') r += (o.saves || 0) * 0.15;
  r += o.bonus || 0;
  if (o.mins < 60) r = 6.4 + (r - 6.4) * clamp(o.mins / 60, 0.4, 1);
  return clamp(r1(r), 4.5, 10);
}

function compKey(fx) {
  if (fx.type === 'friendly') return '친선경기';
  if (fx.type === 'reserve') return '2군 경기';
  return fx.comp;
}

function penaltyWin(myStr, oppStr) {
  let pr = 0.5 + (myStr - oppStr) * 0.01;
  if (isGK()) pr += (S.p.attrs.ref - 70) * 0.005 + lv('pkstopper') * 0.04;
  return rnd() < clamp(pr, 0.25, 0.75);
}

// 경기 결과를 상태에 반영 (일반 경기·주요 경기 공용)
function applyResult(fx, res) {
  // res: {gf, ga, part, g, a, saves, rating, pens, moments}
  const p = S.p, se = S.season, mc = S.mctx;
  const won = res.gf > res.ga || (res.gf === res.ga && res.pens === true);
  // 리그 테이블
  if (fx.type === 'league') {
    const L = se.league;
    simRound(L, fx.r, p.club);
    if (fx.home) recordTable(L.table, p.club, fx.opp, res.gf, res.ga); else recordTable(L.table, fx.opp, p.club, res.ga, res.gf);
  }
  if (fx.type === 'cup') {
    if (!won) { se.cup.alive = false; se.cup.result = `${fx.stage} 탈락`; }
    else if (fx.stage === '결승') { se.cup.alive = false; se.cup.result = '우승'; se.trophies.push(se.cup.name + (se.cup.youth ? ' (유스)' : '')); addNews(`🏆 ${clubName(p.club)}, ${se.cup.name} 우승!`); }
    else se.cup.result = `${fx.stage} 통과`;
  }
  if (fx.type === 'cont') {
    const c = se.cont;
    if (c.stage === 'league') { c.played++; c.pts += res.gf > res.ga ? 3 : res.gf === res.ga ? 1 : 0; }
    else if (!won) { c.alive = false; c.result = `${CONT_KO[c.ko].name} 탈락`; }
    else if (CONT_KO[c.ko].name === '결승') { c.alive = false; c.result = '우승'; se.trophies.push(c.name); addNews(`🏆 ${clubName(p.club)}, ${c.name} 정상!`); }
    else { c.result = `${CONT_KO[c.ko].name} 통과`; c.ko++; }
  }
  // 선수 기록
  const part = res.part, played = part.mins > 0;
  if (fx.type !== 'reserve' && fx.type !== 'intl') { if (mc) mc.possible += 90; se.possible += 90; }
  if (played) {
    const k = compKey(fx);
    const st = se.stats[k] || (se.stats[k] = { apps: 0, starts: 0, mins: 0, g: 0, a: 0, cs: 0, saves: 0, rs: 0, motm: 0 });
    st.apps++; if (part.status === 'start') st.starts++;
    st.mins += part.mins; st.g += res.g; st.a += res.a; st.rs += res.rating;
    if (res.ga === 0 && part.mins >= 60 && ['CB', 'FB', 'DM', 'GK'].includes(group())) st.cs++;
    st.saves += res.saves || 0;
    if (res.rating >= 8.0) st.motm++;
    if (fx.type !== 'reserve' && fx.type !== 'friendly' && fx.type !== 'intl') se.mins += part.mins;
    const pres = fx.type === 'intl' ? 1.6 : fx.type === 'cont' ? CONTINENTAL[se.cont ? se.cont.id : 'ACL'].prestige / 3 + 0.4
      : fx.type === 'reserve' || fx.type === 'friendly' ? 0.1 : leagueOf(curClub().lg).prestige / 3.5;
    p.trust = soft(p.trust, (res.rating - 6.6) * (fx.type === 'reserve' ? 3.2 : 2.2) * (1 + 0.15 * lv('leader')));
    p.rep = clamp(p.rep + ((res.rating - 6.7) * 0.18 + res.g * 0.12 + res.a * 0.06) * pres, 0, 100);
    p.morale = soft(p.morale, (res.gf > res.ga ? 1.5 : res.gf < res.ga ? -1.5 : 0) + (res.rating - 6.6) * 1.5);
    p.fatigue = clamp(p.fatigue + part.mins / 90 * 5.5 * (1 - 0.15 * lv('stamina')), 0, 100);
    if (mc) {
      if (fx.type === 'reserve') mc.reserveMins += part.mins; else mc.mins += part.mins;
      mc.ratings.push(res.rating); mc.g += res.g; mc.a += res.a;
    }
    // 경기 중 부상
    const inj = 0.007 * (1 + Math.max(0, p.fatigue - 40) / 25) * p.traits.injury * (1 - 0.2 * lv('iron'))
      * (mc && mc.nutrition ? 0.6 : 1) * Math.sqrt(mc ? INTENSITY[mc.intensity].injury : 1);
    if (rnd() < inj) injure('경기 중');
  } else if (mc && part.status === 'out') {
    mc.reserveMins += 45; // 2군 경기 출전으로 간주 (성장 계산용)
  }
  const line = {
    m: S.month, comp: fx.comp, stage: fx.stage || '', opp: fx.oppName || clubName(fx.opp), oppId: fx.opp || null, home: !!fx.home, neutral: !!fx.neutral,
    gf: res.gf, ga: res.ga, pens: res.pens, status: part.status, mins: part.mins, g: res.g, a: res.a, rating: res.rating, type: fx.type,
  };
  se.matches.push(line);
  if (mc) mc.lines.push(line);
  return line;
}

function injure(where) {
  const p = S.p;
  const roll = rnd();
  const n = roll < 0.68 ? ri(1, 3) : roll < 0.94 ? ri(4, 8) : ri(10, 20);
  p.injury = Math.max(p.injury, n);
  if (S.mctx) S.mctx.injuredNew = { n, where };
}

function fxTeamStr(fx, part) {
  const base = fx.type === 'intl' ? fx.teamBase : fx.type === 'reserve' ? cs(S.p.club) - 8 : cs(S.p.club);
  return base + (part.mins > 0 ? (ovrF() - base) * 0.1 * part.mins / 90 + lv('leader') * 0.4 : 0);
}

// 일반(비주요) 경기 시뮬레이션
function simFixture(fx, givenPart) {
  const part = givenPart || participation(fx);
  const teamStr = fxTeamStr(fx, part);
  const [gf, ga] = simScore(teamStr, fx.oppStr, fx.home, fx.neutral);
  const c = part.mins > 0 ? contribution(gf, part.mins, teamStr) : { g: 0, a: 0 };
  const saves = isGK() && part.mins > 0 ? poisson(2.2 * Math.exp((fx.oppStr - teamStr) / 25) * part.mins / 90) : 0;
  const rating = matchRating({ g: c.g, a: c.a, gf, ga, mins: part.mins, oppStr: fx.oppStr, saves });
  let pens;
  if (gf === ga && isKO(fx)) pens = penaltyWin(teamStr, fx.oppStr);
  return applyResult(fx, { gf, ga, part, g: c.g, a: c.a, saves, rating, pens });
}
const isKO = fx => fx.type === 'cup' || (fx.type === 'cont' && fx.stage && !fx.stage.startsWith('리그')) || (fx.type === 'intl' && fx.ko);

/* ===================== 주요 경기 · 결정적 순간 ===================== */
// side: att(득점 기회) / def(실점 위기) / gk
// out: goal | assist | goa(골 또는 도움) | prevent | safe | foul | save | intercept | buildup | pk
const MOMENTS = {
  oneonone: {
    side: 'att', texts: ['수비 뒷공간을 파고들어 골키퍼와 1대1!', '동료의 스루패스가 발밑에 정확히 떨어졌다. 앞에는 골키퍼뿐!', '상대 수비의 실수! 공을 가로채 골문으로 돌진한다!'],
    opts: [
      { label: '강하게 낮게 슈팅', attr: ['sho'], d: 0, out: 'goal', sk: { finisher: 4 } },
      { label: '골키퍼를 제치고 마무리', attr: ['dri'], d: 4, out: 'goal', sk: { elastico: 3, finisher: 2 }, rb: 0.25 },
      { label: '칩슛으로 넘긴다', attr: ['sho', 'dri'], d: -3, out: 'goal', need: 'chip', sk: { chip: 4 }, rb: 0.2 },
      { label: '쇄도하는 동료에게 내준다', attr: ['pas'], d: -2, out: 'assist', sk: { through: 3 } },
    ],
  },
  edge: {
    side: 'att', texts: ['페널티 박스 바깥, 슈팅 각이 열렸다.', '세컨드 볼이 아크 정면으로 흘러나왔다.', '수비가 물러서며 중거리 공간을 내줬다.'],
    opts: [
      { label: '감아차기', attr: ['sho', 'pas'], d: 3, out: 'goal', need: 'finesse', sk: { finesse: 4 }, rb: 0.2 },
      { label: '중거리 강슛', attr: ['sho', 'phy'], d: 4, out: 'goal', need: 'power', sk: { power: 4 }, rb: 0.2 },
      { label: '그냥 때린다', attr: ['sho'], d: 10, out: 'goal' },
      { label: '침투 패스', attr: ['pas'], d: 3, out: 'assist', sk: { through: 4 } },
      { label: '드리블로 박스 안 돌파', attr: ['dri'], d: 6, out: 'goa', sk: { elastico: 4 } },
    ],
  },
  weakfoot: {
    side: 'att', texts: ['공이 약발 쪽으로 흘렀다. 골문까지 열 걸음!', '크로스가 반대발 쪽으로 떨어진다!'],
    opts: [
      { label: '약발로 바로 슈팅', attr: ['sho'], d: 1, out: 'goal', wf: true, sk: { finisher: 2 } },
      { label: '주발로 접어서 슈팅', attr: ['dri'], d: 7, out: 'goal', sk: { elastico: 3 } },
      { label: '컷백 패스', attr: ['pas'], d: 4, out: 'assist', sk: { through: 2 } },
    ],
  },
  counter: {
    side: 'att', texts: ['역습 기회! 앞에 넓은 공간이 열렸다.', '상대 코너킥을 막아내고 순식간에 역습!'],
    opts: [
      { label: '직접 치고 나간다', attr: ['pac', 'dri'], d: 5, out: 'goa', sk: { sprint: 4, elastico: 2 } },
      { label: '롱패스로 단번에 전환', attr: ['pas'], d: 4, out: 'assist', sk: { longball: 4, through: 2 } },
      { label: '템포를 늦추고 볼 소유', attr: ['pas'], d: -20, out: 'safe', sk: { press: 2 } },
    ],
  },
  cross: {
    side: 'att', texts: ['측면을 허물었다. 크로스 타이밍!', '오버래핑으로 엔드라인까지 파고들었다!'],
    opts: [
      { label: '얼리 크로스', attr: ['pas'], d: 3, out: 'assist', sk: { cross: 5 } },
      { label: '낮은 컷백', attr: ['pas'], d: 2, out: 'assist', sk: { cross: 2, through: 2 } },
      { label: '직접 안으로 파고들어 슈팅', attr: ['dri', 'sho'], d: 8, out: 'goal', sk: { elastico: 3, finisher: 2 } },
    ],
  },
  head: {
    side: 'att', texts: ['코너킥! 문전으로 높게 날아온다.', '프리킥 크로스가 박스 안으로 휘어 들어온다.'],
    opts: [
      { label: '높이 뛰어 헤더', attr: ['phy'], d: 5, out: 'goal', sk: { header: 5, aerial: 2 } },
      { label: '발리 슈팅', attr: ['sho'], d: 8, out: 'goal', sk: { power: 2 } },
      { label: '동료에게 떨궈준다', attr: ['pas', 'phy'], d: 3, out: 'assist', sk: { header: 2 } },
    ],
  },
  freekick: {
    side: 'att', need: 'freekick', texts: ['아크 정면, 직접 프리킥 찬스!', '골문 25m 지점 프리킥. 키커로 나섰다.'],
    opts: [
      { label: '벽을 넘겨 직접 감아차기', attr: ['sho', 'pas'], d: 8, out: 'goal', sk: { freekick: 5, finesse: 2 }, rb: 0.3 },
      { label: '문전으로 크로스', attr: ['pas'], d: 4, out: 'assist', sk: { freekick: 2, cross: 2 } },
    ],
  },
  penalty: {
    side: 'att', texts: ['페널티킥 선언! 키커로 나섰다.', '동료가 박스 안에서 넘어졌다. 페널티킥! 공을 집어 든다.'],
    opts: [
      { label: '왼쪽 구석', attr: ['sho'], d: -11, out: 'goal', sk: { penalty: 4 } },
      { label: '오른쪽 구석', attr: ['sho'], d: -11, out: 'goal', sk: { penalty: 4 } },
      { label: '파넨카', attr: ['sho'], d: -3, out: 'goal', sk: { penalty: 5 }, rb: 0.3, rep: 2 },
    ],
  },
  def1v1: {
    side: 'def', texts: ['상대 공격수가 수비 라인을 뚫고 들어온다!', '상대 윙어가 정면으로 드리블 돌파를 시도한다!'],
    opts: [
      { label: '과감하게 태클', attr: ['def'], d: 3, out: 'prevent', sk: { tackle: 5 } },
      { label: '거리를 두고 지연 수비', attr: ['def', 'pac'], d: 1, out: 'prevent', sk: { marking: 4 }, fg: 0.55 },
      { label: '전술적 파울로 끊는다', attr: ['def'], d: -99, out: 'foul' },
    ],
  },
  aerial: {
    side: 'def', texts: ['상대 크로스가 문전으로 날아온다!', '상대 롱볼, 장신 공격수와 공중볼 경합!'],
    opts: [
      { label: '먼저 뛰어 헤더 클리어', attr: ['phy'], d: 2, out: 'prevent', sk: { aerial: 5, header: 2 } },
      { label: '몸을 붙여 견제', attr: ['def'], d: 3, out: 'prevent', sk: { marking: 3 }, fg: 0.5 },
    ],
  },
  intercept: {
    side: 'def', texts: ['상대 빌드업, 패스 길목이 보인다.', '상대 미드필더가 전진 패스를 노린다.'],
    opts: [
      { label: '앞으로 튀어나가 차단', attr: ['def'], d: 4, out: 'intercept', sk: { intercept: 5 } },
      { label: '자리를 지키며 공간 커버', attr: ['def'], d: -20, out: 'safe', sk: { marking: 2 } },
    ],
  },
  buildup: {
    side: 'def', texts: ['상대가 강하게 전방 압박을 걸어온다.', '후방에서 공을 잡았다. 상대 공격수 둘이 달려든다.'],
    opts: [
      { label: '짧은 패스로 압박 탈출', attr: ['pas', 'dri'], d: 3, out: 'buildup', sk: { press: 4 } },
      { label: '롱패스로 전방 전환', attr: ['pas'], d: 5, out: 'buildup', sk: { longball: 5 }, as: 0.3 },
      { label: '안전하게 걷어낸다', attr: ['def'], d: -20, out: 'safe' },
    ],
  },
  gk1v1: {
    side: 'gk', texts: ['상대 공격수와 1대1!', '수비 라인이 뚫렸다. 상대가 골문으로 돌진한다!'],
    opts: [
      { label: '각도를 좁히며 전진', attr: ['gpo'], d: 3, out: 'save', sk: { oneonone: 5, sweeper: 2 } },
      { label: '끝까지 서서 버틴다', attr: ['ref'], d: 4, out: 'save', sk: { reflexes: 3, oneonone: 2 } },
      { label: '먼저 몸을 던진다', attr: ['div'], d: 3, out: 'save', sk: { oneonone: 3 } },
    ],
  },
  gkshot: {
    side: 'gk', texts: ['중거리 슈팅이 골문 구석으로 날아온다!', '문전 혼전 중 근거리 슈팅!'],
    opts: [
      { label: '손끝으로 쳐낸다', attr: ['ref', 'div'], d: 3, out: 'save', sk: { reflexes: 5 } },
      { label: '잡아낸다', attr: ['han'], d: 7, out: 'save', sk: { reflexes: 2 }, rb: 0.2 },
    ],
  },
  gkpk: { side: 'gk', texts: ['페널티킥 선언. 키커와 마주 섰다.'], opts: [] },
  gkbuild: {
    side: 'gk', texts: ['백패스를 받았다. 상대가 전방 압박을 걸어온다.', '공을 잡았다. 역습을 시작할 수 있다.'],
    opts: [
      { label: '짧은 패스로 빌드업', attr: ['kic', 'gpo'], d: 4, out: 'buildup', sk: { sweeper: 4 } },
      { label: '정확한 롱킥', attr: ['kic'], d: 3, out: 'buildup', sk: { longball: 4 }, as: 0.25 },
      { label: '멀리 걷어낸다', attr: ['kic'], d: -20, out: 'safe' },
    ],
  },
  gkcross: {
    side: 'gk', texts: ['상대 코너킥, 공이 골 지역으로 떨어진다!'],
    opts: [
      { label: '튀어나가 펀칭', attr: ['han', 'phy'], d: 3, out: 'save', sk: { sweeper: 2 } },
      { label: '골라인을 지킨다', attr: ['ref'], d: 5, out: 'save', sk: { reflexes: 3 } },
    ],
  },
};

const MOMENT_W = {
  ST: { oneonone: 3, edge: 2, weakfoot: 2, head: 2, counter: 1, penalty: 0.6, freekick: 1.5 },
  W:  { oneonone: 2, edge: 2, weakfoot: 2, cross: 2, counter: 2, penalty: 0.4, freekick: 1.5 },
  AM: { oneonone: 1.5, edge: 3, weakfoot: 1.5, counter: 2, penalty: 0.5, freekick: 2 },
  CM: { edge: 2, counter: 3, intercept: 1.5, def1v1: 1, buildup: 1, freekick: 1.5, penalty: 0.3 },
  DM: { intercept: 3, def1v1: 2, buildup: 2, counter: 1, aerial: 1, edge: 0.6 },
  FB: { def1v1: 3, cross: 2.5, counter: 1.5, aerial: 1 },
  CB: { def1v1: 3, aerial: 3, buildup: 1.5, head: 1.5, intercept: 1 },
  GK: { gk1v1: 3, gkshot: 3, gkpk: 0.8, gkbuild: 1.5, gkcross: 1.5 },
};

function optChance(o, oppStr, big) {
  const a = S.p.attrs, mc = S.mctx || {};
  let val = o.attr.reduce((s, k) => s + (a[k] || 0), 0) / o.attr.length;
  if (o.wf) val *= 0.6 + 0.08 * S.p.weakFoot;
  let bonus = 0;
  for (const k in (o.sk || {})) bonus += lv(k) * o.sk[k];
  bonus += (mc.decision || 0) + (S.p.buff.decision || 0);
  if (big) bonus += (mc.big || 0) + 3 * lv('biggame') + S.p.traits.temper * 2;
  bonus += 3 + (cond() - 70) * 0.06 + (S.p.morale - 60) * 0.03;
  return clamp(sigmoid((val + bonus - (oppStr + o.d)) / 7), 0.05, 0.93);
}

function makeMoment(kind, min, oppStr, big) {
  const M = MOMENTS[kind];
  const m = { kind, min, side: M.side, text: pick(M.texts), opts: [], res: null };
  if (kind === 'gkpk') {
    const hintP = 0.25 + 0.18 * lv('pkstopper') + (S.p.attrs.ref - 60) * 0.005;
    const side = rnd() < 0.5 ? 0 : 1;
    m.hint = rnd() < hintP ? side : -1;
    if (m.hint >= 0) m.text += ` 키커의 시선이 ${side === 0 ? '왼쪽' : '오른쪽'}을 향하는 것 같다…`;
    const pSide = i => (m.hint < 0 ? 0.3 : (i === side ? 0.55 : 0.18));
    m.opts = [
      { label: '왼쪽으로 몸을 날린다', p: pSide(0), out: 'save', attrLabel: '반사신경·예측' },
      { label: '오른쪽으로 몸을 날린다', p: pSide(1), out: 'save', attrLabel: '반사신경·예측' },
      { label: '가운데서 끝까지 기다린다', p: 0.14, out: 'save', attrLabel: '배짱', rb: 0.2 },
    ];
    return m;
  }
  for (const o of M.opts) {
    if (o.need && !lv(o.need)) { m.opts.push({ label: o.label, locked: true, lockReason: `${SKILLS[o.need].name} 스킬 필요` }); continue; }
    let pr = o.out === 'safe' || o.out === 'foul' ? 1 : optChance(o, oppStr, big);
    if (o.out === 'goal' && kind !== 'penalty') pr *= 0.75; // 결정적 기회의 현실적인 성공률
    m.opts.push({
      label: o.label, out: o.out, p: Math.round(pr * 100) / 100,
      attrLabel: o.attr.map(k => ATTR_NAME[k]).join('·'), rb: o.rb || 0, fg: o.fg, as: o.as, rep: o.rep || 0,
    });
  }
  return m;
}

function pickMomentKinds(n) {
  const w = Object.assign({}, MOMENT_W[group()]);
  if (!lv('freekick')) delete w.freekick;
  if (lv('penalty')) w.penalty = (w.penalty || 0.3) * 1.8;
  if (lv('header') && w.head) w.head *= 1.5;
  if (S.p.weakFoot >= 4 && w.weakfoot) w.weakfoot *= 0.6;
  const kinds = [];
  for (let i = 0; i < n; i++) {
    const keys = Object.keys(w).filter(k => !kinds.includes(k));
    kinds.push(wpick(keys, k => w[k]));
  }
  return kinds;
}

const FLAVOR = ['팽팽한 탐색전이 이어진다.', '상대의 슈팅이 골대를 강타했다!', '관중석에서 응원가가 울려 퍼진다.', '양 팀 모두 거친 몸싸움을 벌인다.',
  '주심이 경고를 꺼내 들었다.', '상대 골키퍼의 선방이 나왔다.', '빗줄기가 굵어지기 시작했다.', '감독이 터치라인에서 지시를 쏟아낸다.'];

function startFeatured(fx, ctx) {
  const p = S.p;
  let part = participation(fx);
  let main = fx, reserveNote = '';
  if (part.status === 'out' && fx.type !== 'friendly' && fx.type !== 'intl' && isPro()) {
    simFixture(fx, part); // 본 경기는 결장 상태로 처리
    const opp = friendlyOpp();
    reserveNote = `${fx.comp} ${fx.oppName || clubName(fx.opp)}전 명단에서 제외됐다. 대신 2군 경기에서 감독에게 어필할 기회!`;
    main = { type: 'reserve', comp: `${clubName(p.club)} 2군`, oppName: clubName(opp) + ' 2군', oppStr: cs(opp) - 8, home: rnd() < 0.5, imp: 0 };
    part = { status: 'start', mins: 90, entry: 0 };
  }
  const nMom = part.status === 'start' ? (main.imp >= 8 ? 3 : 2) : part.status === 'sub' ? 1 : 0;
  const teamStr = fxTeamStr(main, part);
  const [bgf, bga] = simScore(teamStr, main.oppStr, main.home, main.neutral, nMom * 0.18);
  const c = part.mins > 0 ? contribution(bgf, part.mins * (nMom ? 0.5 : 1), teamStr) : { g: 0, a: 0 };
  const exitMin = part.entry + part.mins;
  const ev = [];
  const winMin = () => ri(Math.max(1, part.entry + 1), Math.max(part.entry + 1, exitMin));
  let pg = c.g, pa = c.a;
  for (let i = 0; i < bgf; i++) {
    if (pg > 0) { ev.push({ min: winMin(), k: 'goal', by: 'me' }); pg--; }
    else if (pa > 0) { ev.push({ min: winMin(), k: 'goal', by: 'team', ast: 'me' }); pa--; }
    else ev.push({ min: ri(1, 90), k: 'goal', by: 'team' });
  }
  for (let i = 0; i < bga; i++) ev.push({ min: ri(1, 90), k: 'opp' });
  for (let i = 0; i < 3; i++) ev.push({ min: ri(3, 88), k: 'flavor', text: pick(FLAVOR) });
  if (part.status === 'sub') ev.push({ min: part.entry, k: 'subin' });
  if (part.status === 'start' && part.mins < 90) ev.push({ min: exitMin, k: 'subout' });
  const big = main.imp >= 6 || main.type === 'intl';
  const kinds = pickMomentKinds(nMom);
  const mins = [];
  if (part.status === 'start') {
    const lo = 8, hi = Math.max(lo + 10, exitMin - 2), span = (hi - lo) / nMom;
    for (let i = 0; i < nMom; i++) mins.push(ri(Math.round(lo + span * i), Math.round(lo + span * (i + 1) - 1)));
  } else if (nMom) mins.push(ri(part.entry + 3, 89));
  const moments = kinds.map((k, i) => makeMoment(k, mins[i], main.oppStr, big));
  moments.forEach((m, i) => ev.push({ min: m.min + 0.5, k: 'moment', mi: i }));
  ev.push({ min: 45.9, k: 'ht' });
  ev.sort((a, b) => a.min - b.min);
  S.pending.match = {
    fx: main, ctx, part, reserveNote, teamStr, big, ev, moments, mi: 0, bonus: 0, done: false, result: null,
    myName: main.type === 'intl' ? NATIONS[p.nat].name + (main.u23 ? ' U23' : '') : (main.type === 'reserve' ? clubName(p.club) + ' 2군' : clubName(p.club)),
    oppName: main.oppName || clubName(main.opp),
  };
  S.phase = 'match';
  if (!moments.length) finishFeatured();
}

function resolveMoment(choice) {
  const M = S.pending.match;
  const m = M.moments[M.mi];
  if (!m || m.res) return;
  const o = m.opts[choice];
  if (!o || o.locked) return;
  const p = S.p;
  const ok = rnd() < o.p;
  let text = '', addEv = null;
  const nm = p.name;
  switch (o.out) {
    case 'goal':
      if (ok) { text = `⚽ 골!!! ${nm}의 슈팅이 그물을 흔든다!`; addEv = { k: 'goal', by: 'me' }; M.bonus += 0.15 + o.rb; if (o.rep) p.rep = clamp(p.rep + o.rep, 0, 100); }
      else { text = pick(['아쉽게 골문을 벗어났다…', '골키퍼의 선방에 막혔다!', '수비수가 몸을 던져 막아냈다.']); M.bonus -= 0.2; }
      break;
    case 'assist':
      if (ok) { text = `🅰️ 완벽한 패스! 동료가 가볍게 밀어 넣는다.`; addEv = { k: 'goal', by: 'team', ast: 'me' }; M.bonus += 0.1; }
      else { text = pick(['패스가 길었다. 상대가 끊어냈다.', '동료의 슈팅이 크로스바를 넘어갔다.']); M.bonus -= 0.15; }
      break;
    case 'goa':
      if (ok) {
        if (rnd() < 0.5) { text = `⚽ 수비를 무너뜨리고 직접 마무리! ${nm}의 골!`; addEv = { k: 'goal', by: 'me' }; }
        else { text = '🅰️ 수비를 끌어낸 뒤 내준 공, 동료의 골!'; addEv = { k: 'goal', by: 'team', ast: 'me' }; }
        M.bonus += 0.2;
      } else { text = '공을 빼앗겼다. 아쉬운 장면.'; M.bonus -= 0.2; }
      break;
    case 'safe':
      text = '침착하게 위기를 넘기며 흐름을 지켰다.'; M.bonus += 0.08; p.trust = clamp(p.trust + 0.5, 0, 100);
      break;
    case 'foul':
      if (rnd() < 0.06) { text = '🟥 퇴장! 최후방 수비수의 파울로 판정됐다.'; M.bonus -= 1.0; p.susp += 1; p.trust = clamp(p.trust - 6, 0, 100); }
      else { text = '🟨 경고를 받았지만 위기를 끊어냈다.'; M.bonus -= 0.1; p.yellow++; if (p.yellow >= 5) { p.yellow = 0; p.susp += 1; text += ' (누적 경고로 다음 경기 출전 정지)'; } }
      break;
    case 'prevent':
      if (ok) { text = pick(['🛡️ 완벽한 수비! 공을 깔끔하게 빼앗았다.', '🛡️ 끝까지 따라붙어 슈팅을 막아냈다!']); M.bonus += 0.45; }
      else if (rnd() < (o.fg != null ? o.fg : 0.72)) { text = '❌ 뚫렸다… 상대의 골.'; addEv = { k: 'opp' }; M.bonus -= 0.35; }
      else { text = '뚫렸지만 상대 슈팅이 빗나갔다. 가슴을 쓸어내린다.'; M.bonus -= 0.1; }
      break;
    case 'intercept':
      if (ok) {
        text = '✂️ 패스를 끊어냈다!'; M.bonus += 0.4;
        if (rnd() < 0.3) { text += ' 곧바로 역습 연결, 동료의 골! 🅰️'; addEv = { k: 'goal', by: 'team', ast: 'me' }; }
      } else if (rnd() < 0.45) { text = '❌ 타이밍이 늦었다. 뒷공간을 내주며 실점.'; addEv = { k: 'opp' }; M.bonus -= 0.35; }
      else { text = '차단에 실패했지만 동료가 커버했다.'; M.bonus -= 0.1; }
      break;
    case 'buildup':
      if (ok) {
        text = '압박을 벗겨내고 공격의 시작점이 됐다.'; M.bonus += 0.3;
        if (o.as && rnd() < o.as) { text += ' 전방 전환이 그대로 골로! 🅰️'; addEv = { k: 'goal', by: 'team', ast: 'me' }; }
      } else if (rnd() < 0.35) { text = '❌ 압박에 걸려 공을 빼앗겼고, 실점으로 이어졌다.'; addEv = { k: 'opp' }; M.bonus -= 0.45; }
      else { text = '공을 빼앗겼지만 수비가 막아냈다.'; M.bonus -= 0.15; }
      break;
    case 'save':
      if (ok) { text = pick(['🧤 슈퍼 세이브!', '🧤 믿기 힘든 반사신경! 막아냈다!', '🧤 완벽한 판단으로 공을 지켜냈다.']); M.bonus += 0.5 + (o.rb || 0); }
      else if (m.kind === 'gkpk' || rnd() < 0.85) { text = '❌ 막지 못했다. 실점.'; addEv = { k: 'opp' }; M.bonus -= 0.15; }
      else { text = '놓쳤지만 공이 골대를 맞고 나왔다!'; }
      break;
    default: break;
  }
  p.trust = clamp(p.trust + (ok ? 1.2 : -0.8), 0, 100);
  m.res = { choice, ok: o.out === 'safe' ? true : ok, text };
  if (addEv) { addEv.min = m.min + 0.6; M.ev.push(addEv); M.ev.sort((a, b) => a.min - b.min); }
  M.mi++;
  if (M.mi >= M.moments.length) finishFeatured();
}

function finishFeatured() {
  const M = S.pending.match, p = S.p;
  let gf = 0, ga = 0, g = 0, a = 0;
  for (const e of M.ev) {
    if (e.k === 'goal') { gf++; if (e.by === 'me') g++; if (e.ast === 'me') a++; }
    if (e.k === 'opp') ga++;
  }
  const saves = isGK() && M.part.mins > 0 ? poisson(2.2 * Math.exp((M.fx.oppStr - M.teamStr) / 25) * M.part.mins / 90) : 0;
  const rating = matchRating({ g, a, gf, ga, mins: M.part.mins, oppStr: M.fx.oppStr, saves, bonus: M.bonus });
  let pens;
  if (gf === ga && isKO(M.fx)) pens = penaltyWin(M.teamStr, M.fx.oppStr);
  const line = applyResult(M.fx, { gf, ga, part: M.part, g, a, saves, rating, pens });
  M.result = { gf, ga, g, a, rating, pens, saves, line };
  M.done = true;
}

/* ===================== 월간 계획 · 성장 ===================== */
const monthlySalary = () => Math.round((S.p.contract.salary || 0) / 12);
const trainerCost = () => Math.max(100, Math.round(monthlySalary() * 0.08));
const nutritionCost = () => Math.max(50, Math.round(monthlySalary() * 0.04));
const rehabCost = () => Math.max(300, Math.round(monthlySalary() * 0.3));
const actCost = act => (act === 'trainer' ? (S.p.trainerMonths > 0 ? 0 : trainerCost()) : act === 'nutrition' ? nutritionCost() : 0);
const facility = () => { const c = curClub(); const base = c.youth ? cs(c.parent) : cs(c.id); return 0.9 + clamp((base - 50) / 40, 0, 1) * 0.25; };

function defaultPlan() {
  const w = OVR_WEIGHTS[group()];
  const focus = Object.keys(w).sort((a, b) => w[b] - w[a]).slice(0, 2);
  return { focus, intensity: 1, skill: null, act: 'rest' };
}

function skillAllowed(id, pos) {
  const sk = SKILLS[id], g = POSITIONS[pos || S.p.pos].group;
  return sk.groups.includes('ALL') || (sk.groups.includes('OUT') && g !== 'GK') || sk.groups.includes(g);
}
function reqValue(k) {
  const p = S.p;
  if (k === 'age') return p.age;
  if (k === 'rep') return p.rep;
  if (p.attrs[k] != null) return p.attrs[k];
  return k === 'pas' ? p.attrs.kic : 0;
}
function skillStatus(id) {
  const p = S.p, sk = SKILLS[id], lvl = lv(id);
  const owned = Object.keys(p.skills).filter(k => k !== 'weakfoot' && p.skills[k] > 0).length;
  const unmet = Object.keys(sk.req).filter(k => reqValue(k) < sk.req[k]).map(k => `${k === 'age' ? '나이' : k === 'rep' ? '명성' : ATTR_NAME[k] || k} ${sk.req[k]}`);
  const maxed = lvl >= SKILL_MAX_LV || (id === 'weakfoot' && p.weakFoot >= 5);
  const slotOk = lvl > 0 || id === 'weakfoot' || owned < SKILL_SLOTS;
  return {
    id, lvl, maxed, allowed: skillAllowed(id), unmet, slotOk, prog: Math.floor(p.skillProg[id] || 0), next: SKILL_COST[Math.min(lvl + 1, 3)],
    can: skillAllowed(id) && !maxed && !unmet.length && slotOk,
  };
}
function skillList() { return Object.keys(SKILLS).filter(id => skillAllowed(id)).map(skillStatus); }

function ageGrowth(age) {
  const T = { 16: 2.1, 17: 2.1, 18: 2.0, 19: 1.85, 20: 1.65, 21: 1.45, 22: 1.25, 23: 1.05, 24: 0.85, 25: 0.65, 26: 0.5, 27: 0.35, 28: 0.2, 29: 0.08, 30: -0.15, 31: -0.3, 32: -0.5, 33: -0.7, 34: -0.9, 35: -1.1 };
  let b = age >= 36 ? -1.3 : (T[age] != null ? T[age] : 2.1);
  const t = S.p.traits.growth;
  if (t === 'early') { if (age <= 20) b *= 1.3; else if (age <= 24 && b > 0) b *= 0.9; if (age >= 28) b -= 0.15; }
  if (t === 'late') { if (age <= 20) b *= 0.8; else if (age <= 27 && b > 0) b *= 1.25; if (age >= 29 && age <= 31) b += 0.15; }
  return b;
}

function submitPlan(plan) {
  if (S.phase !== 'plan') return;
  const p = S.p;
  plan = Object.assign(defaultPlan(), plan || {});
  const keys = attrKeys();
  plan.focus = (plan.focus || []).filter(k => keys.includes(k)).slice(0, 2);
  plan.intensity = clamp(plan.intensity | 0, 0, 3);
  if (plan.skill && !skillStatus(plan.skill).can) plan.skill = null;
  if (!ACTIVITIES[plan.act]) plan.act = 'rest';
  const cost = actCost(plan.act);
  if (cost > p.money) plan.act = 'rest';
  S.lastPlan = plan;
  p.buff = p.buffNext || {};
  p.buffNext = {};
  S.mctx = {
    plan, intensity: plan.intensity, mins: 0, reserveMins: 0, possible: 0, ratings: [], g: 0, a: 0, lines: [],
    decision: plan.act === 'video' ? 4 : 0, big: plan.act === 'mental' ? 3 : 0, nutrition: plan.act === 'nutrition',
    ovrBefore: ovrF(), attrsBefore: Object.assign({}, p.attrs), moneyBefore: p.money, injuredNew: null, notes: [],
  };
  if (cost) p.money -= cost;
  if (plan.act === 'trainer' && p.trainerMonths > 0) p.trainerMonths--;
  const fx = S.monthFx || [];
  fx.forEach((f, i) => { if (i !== S.featuredIdx) simFixture(f); });
  if (S.featuredIdx >= 0 && fx[S.featuredIdx]) startFeatured(fx[S.featuredIdx], { kind: 'month' });
  else finalizeMonth();
}

function matchDone() {
  const M = S.pending.match;
  if (!M || !M.done) return;
  if (M.ctx.kind === 'tour') return tourAfterMatch();
  finalizeMonth();
}

function finalizeMonth() {
  const p = S.p, mc = S.mctx, plan = mc.plan, I = INTENSITY[plan.intensity], m = S.month, se = S.season;
  // 미진행 리그 라운드 처리
  se.league.roundMonth.forEach((mm, r) => { if (mm === m) simRound(se.league, r, null); });
  // 대륙대회 리그 페이즈 종료
  if (se.cont && se.cont.alive && se.cont.stage === 'league' && m === CONT_LEAGUE_MONTHS[CONT_LEAGUE_MONTHS.length - 1]) {
    const c = se.cont;
    if (c.pts >= 10 || (c.pts >= 7 && rnd() < 0.5)) { c.stage = 'ko'; c.ko = 0; c.result = `리그 페이즈 통과 (${c.pts}점)`; mc.notes.push(`🌍 ${c.name} 토너먼트 진출!`); }
    else { c.alive = false; c.result = `리그 페이즈 탈락 (${c.pts}점)`; mc.notes.push(`${c.name} 리그 페이즈 탈락`); }
  }
  // 출전 비율
  const share = mc.possible > 0 ? clamp((mc.mins + mc.reserveMins * 0.5) / mc.possible, 0, 1) : 1;
  mc.share = share;
  const injuredFrac = p.injury > 0 ? clamp(p.injury / 4, 0, 1) : 0;
  // 능력치 성장
  const keys = attrKeys(), w = OVR_WEIGHTS[group()];
  const base = ageGrowth(p.age);
  const trainer = plan.act === 'trainer' ? 1.15 : 1;
  const extra = plan.act === 'extra' ? 1.1 : 1;
  const skillSplit = plan.skill ? 0.75 : 1;
  const injF = 1 - 0.65 * Math.max(injuredFrac, mc.lines.filter(l => l.status === 'injured').length / Math.max(1, mc.lines.length));
  if (base > 0) {
    const gap = p.pot - ovrF();
    const gapF = gap > 0 ? clamp(gap / 12, 0.04, 1.15) : 0.02;
    let T = GROWTH_K * base * I.growth * facility() * p.traits.prof * (0.8 + 0.4 * share) * trainer * extra * skillSplit * injF * gapF * (p.buff.growth || 1);
    if (m === 0) T *= 1.4;
    const focus = plan.focus.length ? plan.focus : [];
    const rest = keys.filter(k => !focus.includes(k));
    const rw = rest.reduce((s, k) => s + Math.max(0.05, w[k]), 0);
    const oNow = ovrF();
    for (const k of keys) {
      const sh = focus.includes(k) ? FOCUS_SHARE / focus.length : (focus.length ? 1 - FOCUS_SHARE : 1) * Math.max(0.05, w[k]) / rw;
      const capK = Math.min(99, p.pot + 12);
      const over = p.attrs[k] - oNow - 8; // 오버롤보다 지나치게 높은 능력치는 성장 둔화
      const dim = over > 0 ? Math.exp(-over / 8) : 1;
      p.attrs[k] = Math.min(capK, p.attrs[k] + T * sh * dim);
    }
  } else {
    const D = -base * (1.25 - 0.15 * plan.intensity) * (2 - p.traits.prof);
    for (const k of keys) {
      const sh = (k === 'pac' || k === 'phy' || k === 'ref' || k === 'div') ? 0.26 : 0.12;
      p.attrs[k] = Math.max(25, p.attrs[k] - D * sh * (plan.focus.includes(k) ? 0.35 : 1) * 2);
    }
  }
  // 스킬 수련
  if (plan.skill) {
    const id = plan.skill;
    const gain = 30 * I.skill * facility() * p.traits.prof * (plan.act === 'trainer' ? 1.25 : 1) * (p.age <= 23 ? 1.1 : 1) * (1 - 0.5 * injuredFrac) * (p.buff.skill || 1);
    p.skillProg[id] = (p.skillProg[id] || 0) + gain;
    while (lv(id) < SKILL_MAX_LV && p.skillProg[id] >= SKILL_COST[lv(id) + 1]) {
      if (id === 'weakfoot' && p.weakFoot >= 5) break;
      p.skillProg[id] -= SKILL_COST[lv(id) + 1];
      p.skills[id] = lv(id) + 1;
      if (id === 'weakfoot') p.weakFoot = Math.min(5, p.weakFoot + 1);
      mc.notes.push(`🎉 스킬 ${SKILLS[id].icon} ${SKILLS[id].name} Lv${p.skills[id]} 습득!`);
      addNews(`${p.name}, 새 무기 장착 — ${SKILLS[id].name} Lv${p.skills[id]}`);
    }
    if (lv(id) >= SKILL_MAX_LV || (id === 'weakfoot' && p.weakFoot >= 5)) p.skillProg[id] = 0;
  }
  // 피로 · 사기 · 활동
  let fat = I.fatigue - 22;
  if (plan.act === 'rest') { fat -= 10; p.morale += 3; }
  if (plan.act === 'nutrition') fat -= 6;
  if (plan.act === 'extra') fat += 8;
  if (plan.act === 'video') p.trust += 3;
  if (plan.act === 'mental') p.morale += 8;
  if (plan.act === 'media') { p.rep += 2; p.trust -= 1; p.money += Math.round(10 + p.rep * 4); }
  p.fatigue = clamp(p.fatigue + fat * (fat > 0 ? 1 - 0.15 * lv('stamina') : 1), 0, 100);
  // 훈련 중 부상
  if (p.injury === 0) {
    const tr = 0.012 * Math.pow(I.injury, 1.5) * p.traits.injury * (1 - 0.2 * lv('iron')) * (mc.nutrition ? 0.6 : 1) * (p.fatigue > 60 ? 1.6 : 1) * (p.buff.injRisk || 1);
    if (rnd() < tr) { injure('훈련 중'); p.injury = Math.min(p.injury, ri(1, 4)); mc.injuredNew.n = p.injury; }
  }
  // A매치
  if (S.intlThisMonth) {
    let g = 0;
    for (let i = 0; i < 2; i++) g += binom(1, clamp(GOAL_SH[group()] * 0.8 * (p.attrs.sho || 0) / 75, 0, 0.6));
    p.intl.caps += 2; p.intl.goals += g; se.intlCaps += 2; se.intlGoals += g;
    p.rep = clamp(p.rep + 1 + g * 0.5, 0, 100); p.fatigue = clamp(p.fatigue + 6, 0, 100);
    mc.notes.push(`🇺🇳 ${NATIONS[p.nat].name} 대표팀 소집 — A매치 2경기${g ? ` ${g}골` : ''}`);
    if (p.intl.caps === 2) addNews(`${p.name}, ${NATIONS[p.nat].name} 국가대표 첫 발탁`);
  }
  // 돈
  const sal = monthlySalary() * (p.agent === 'big' ? 0.9 : 1) + (curClub().youth ? 30 : 0);
  p.money += Math.round(sal);
  // 표류
  p.trust = clamp(p.trust + (50 - p.trust) * 0.03, 0, 100);
  p.morale = clamp(p.morale + (60 - p.morale) * 0.1, 0, 100);
  const o = ovr();
  if (o > p.peak) { p.peak = o; p.peakAge = p.age; }
  // 리포트
  const rs = mc.ratings;
  const delta = {};
  for (const k of keys) delta[k] = p.attrs[k] - mc.attrsBefore[k];
  S.pending.report = {
    label: `${se.label} ${MONTHS[m]}`, lines: mc.lines, g: mc.g, a: mc.a, apps: rs.length,
    avg: rs.length ? r1(rs.reduce((s, x) => s + x, 0) / rs.length) : null, share: Math.round(share * 100),
    ovrBefore: Math.round(mc.ovrBefore), ovrAfter: o, ovrDelta: Math.round((ovrF() - mc.ovrBefore) * 10) / 10, delta,
    money: p.money - mc.moneyBefore, notes: mc.notes.slice(),
    skill: plan.skill ? { id: plan.skill, ...skillStatus(plan.skill) } : null,
  };
  if (mc.g >= 3) addNews(`${p.name}, ${MONTHS[m]}에만 ${mc.g}골 폭발`);
  // 이벤트
  S.pending.events = rollEvents();
  S.pending.evResult = null;
  if (S.pending.events.length) S.phase = 'event'; else nextMonth();
}

function nextMonth() {
  const p = S.p;
  S.month++;
  S.pending.match = null;
  if (S.month >= 11) return seasonEnd();
  if (S.month === 6) {
    const se = S.season;
    S.lastShare = se.possible ? se.mins / se.possible : 1;
    if (p.mil.serving && S.year >= p.mil.dischargeYear) {
      const note = discharge();
      const offers = genOffers('summer').filter(o => o.kind !== 'renew');
      if (S.pending.returnOffer) { offers.unshift(S.pending.returnOffer); S.pending.returnOffer = null; }
      S.pending.window = { kind: 'winter', offers, note, mustChoose: true };
      S.phase = 'window';
      return;
    }
    const offers = genOffers('winter');
    if (offers.length) { S.pending.window = { kind: 'winter', offers, note: '', mustChoose: false }; S.phase = 'window'; return; }
  }
  prepareMonth();
  S.phase = 'plan';
}

/* ===================== 이벤트 ===================== */
const bigClubPick = () => wpick(proClubs().filter(c => cs(c.id) >= cs(S.p.club) + 4), c => Math.exp(-Math.abs(cs(c.id) - ovrF() - 2) / 5));
const EVENTS = {
  injury: {
    make(par) {
      const sev = par.n >= 10 ? '중상' : par.n >= 4 ? '부상' : '경미한 부상';
      return {
        title: '🚑 부상', text: `${par.where} ${sev}을 당했습니다. 의료진 소견: 약 ${par.n}경기 결장 예상.`,
        opts: [
          { label: '무리해서라도 빨리 복귀한다', hint: '결장 약 40% 단축 · 다음 달 부상 위험 ×1.8' },
          { label: '의료진 계획대로 재활한다', hint: '안전 · 사기 소폭 하락' },
          { label: `해외 전문 재활 센터 (${fmtMoney(rehabCost())})`, hint: '결장 25% 단축 · 후유증 없음', dis: S.p.money < rehabCost() },
        ],
      };
    },
    apply(i, par) {
      const p = S.p;
      if (i === 0) { p.injury = Math.max(1, Math.ceil(p.injury * 0.6)); p.buffNext.injRisk = 1.8; return '조기 복귀를 택했다. 몸 상태를 주의해야 한다.'; }
      if (i === 2 && p.money >= rehabCost()) { p.money -= rehabCost(); p.injury = Math.max(1, Math.ceil(p.injury * 0.75)); return '최고 수준의 재활 프로그램으로 회복 중이다.'; }
      p.morale = clamp(p.morale - 3, 0, 100);
      if (par.n >= 10) { const k = isGK() ? 'div' : 'pac'; p.attrs[k] = Math.max(25, p.attrs[k] - ri(1, 2)); return `차분히 재활에 들어갔다. 큰 부상의 여파로 ${ATTR_NAME[k]}이 조금 떨어졌다.`; }
      return '차분히 재활에 들어갔다.';
    },
  },
  bench_talk: {
    w: () => (isPro() && S.mctx.share < 0.35 && S.p.age >= 18 ? 3 : 0),
    make: () => ({
      title: '🗣️ 감독실 면담', text: `최근 출전 시간이 부족합니다. ${clubName(S.p.club)} 감독과 면담할 기회가 생겼습니다.`,
      opts: [
        { label: '출전 기회를 요구한다', hint: '감독 신뢰가 높으면 기회, 낮으면 역효과' },
        { label: '훈련으로 증명하겠다고 말한다', hint: '신뢰 +, 사기 -' },
        { label: '이적·임대를 요청한다', hint: '다음 이적시장 제안 증가 · 신뢰 크게 하락' },
      ],
    }),
    apply(i) {
      const p = S.p;
      if (i === 0) {
        if (p.trust >= 55 || rnd() < 0.3) { p.buffNext.sel = 4; return '감독이 고개를 끄덕였다. "다음 달에 기회를 주겠다."'; }
        p.trust -= 6; return '감독의 표정이 굳었다. "자리는 스스로 쟁취하는 거다."';
      }
      if (i === 1) { p.trust += 5; p.morale -= 4; return '감독이 태도를 높이 평가했다.'; }
      p.trust -= 10; p.wantsMove = true; return '구단이 이적·임대 제안을 검토하기로 했다.';
    },
  },
  praise: {
    w: () => { const r = S.pending.report; return r && r.avg >= 7.3 && r.apps >= 2 ? 2.5 : 0; },
    make: () => ({
      title: '👏 감독의 칭찬', text: `이번 달 활약에 감독이 공개적으로 칭찬했습니다. 기자들이 소감을 묻습니다.`,
      opts: [{ label: '"더 큰 역할을 맡고 싶습니다"', hint: '명성 +, 신뢰 +' }, { label: '"팀이 이겨서 기쁠 뿐입니다"', hint: '신뢰 ++' }],
    }),
    apply(i) { const p = S.p; if (i === 0) { p.rep += 2; p.trust += 4; return '야망 있는 발언이 화제가 됐다.'; } p.trust += 7; return '겸손한 태도에 감독과 동료들의 신뢰가 깊어졌다.'; },
  },
  interview: {
    w: () => (S.p.rep >= 10 ? 1.5 : 0),
    make: () => ({
      title: '🎙️ 기자회견', text: '다음 경기를 앞두고 기자회견에 참석했습니다. 라이벌 팀에 대한 질문이 나옵니다.',
      opts: [{ label: '겸손하게 답한다', hint: '신뢰 +' }, { label: '자신감을 드러낸다', hint: '명성 +, 사기 +' }, { label: '도발한다', hint: '명성 ++, 신뢰 -' }],
    }),
    apply(i) {
      const p = S.p;
      if (i === 0) { p.trust += 2; p.rep += 0.5; return '무난한 답변이었다.'; }
      if (i === 1) { p.rep += 2.5; p.morale += 4; p.trust -= 1; return '"자신감 넘치는 신성" — 헤드라인이 나왔다.'; }
      p.rep += 5; p.trust -= 6; p.buffNext.decision = (p.buffNext.decision || 0) - 2; addNews(`${p.name}의 도발 발언, 상대 팬 분노`); return '도발 발언이 큰 화제가 됐다. 다음 경기 상대의 견제가 심해질 것이다.';
    },
  },
  mentor: {
    w: () => (S.p.age <= 23 ? 1.6 : 0.4),
    make: () => {
      const target = (S.lastPlan && S.lastPlan.skill) || (S.p.rec || []).find(id => skillStatus(id).can) || null;
      return {
        title: '🧓 베테랑의 조언', text: `팀 베테랑이 훈련 후 따로 남아 비법을 알려주겠다고 합니다.${target ? ` (대상 스킬: ${SKILLS[target].name})` : ''}`,
        opts: [{ label: '남아서 배운다', hint: target ? '스킬 수련 +60 · 피로 +5' : '감독 신뢰 + · 피로 +5' }, { label: '정중히 사양하고 쉰다', hint: '피로 -5' }], params: { target },
      };
    },
    apply(i, par) {
      const p = S.p;
      if (i === 1) { p.fatigue = clamp(p.fatigue - 5, 0, 100); return '휴식을 택했다.'; }
      p.fatigue = clamp(p.fatigue + 5, 0, 100);
      if (par.target && skillStatus(par.target).can) { p.skillProg[par.target] = (p.skillProg[par.target] || 0) + 60; return `${SKILLS[par.target].name}의 감각을 익혔다. (수련 +60)`; }
      p.trust += 3; return '베테랑과 가까워졌고, 감독도 이를 좋게 봤다.';
    },
  },
  sponsor: {
    w: () => (S.p.rep >= 30 ? 1.2 : 0),
    make: () => {
      const fee = Math.round(200 + S.p.rep * S.p.rep * 2.5);
      return { title: '💼 광고 촬영 제안', text: `스포츠 브랜드에서 광고 모델 제안이 왔습니다. 계약금 ${fmtMoney(fee)}.`, opts: [{ label: '수락한다', hint: '수입 + · 피로 +10' }, { label: '축구에 집중한다', hint: '신뢰 + · 사기 +' }], params: { fee } };
    },
    apply(i, par) { const p = S.p; if (i === 0) { p.money += par.fee; p.fatigue = clamp(p.fatigue + 10, 0, 100); p.rep += 1; return `광고 촬영을 마쳤다. +${fmtMoney(par.fee)}`; } p.trust += 2; p.morale += 2; return '축구에 집중하기로 했다.'; },
  },
  dinner: {
    w: () => 1,
    make: () => ({ title: '🍖 팀 회식', text: '연승을 기념해 팀 회식이 열립니다.', opts: [{ label: '참석해서 어울린다', hint: '사기 + · 신뢰 + · 피로 +' }, { label: '빠지고 휴식한다', hint: '피로 - · 사기 -' }] }),
    apply(i) { const p = S.p; if (i === 0) { p.morale += 6; p.trust += 2; p.fatigue = clamp(p.fatigue + 4, 0, 100); return '동료들과 한층 가까워졌다.'; } p.fatigue = clamp(p.fatigue - 6, 0, 100); p.morale -= 2; return '푹 쉬었다.'; },
  },
  sns: {
    w: () => (S.p.rep >= 25 ? 0.8 : 0),
    make: () => ({ title: '📱 SNS 논란', text: '경기 후 올린 게시물이 오해를 사며 논란이 커지고 있습니다.', opts: [{ label: '즉시 사과문을 올린다', hint: '명성 소폭 -' }, { label: '무시한다', hint: '운에 맡긴다' }, { label: '해명 영상을 올린다', hint: '명성 ± · 사기 -' }] }),
    apply(i) {
      const p = S.p;
      if (i === 0) { p.rep -= 1.5; return '빠른 사과로 논란이 가라앉았다.'; }
      if (i === 1) { if (rnd() < 0.5) return '다행히 금방 잊혔다.'; p.rep -= 5; p.morale -= 5; return '논란이 커져 비판 여론이 거세졌다.'; }
      p.morale -= 3; if (rnd() < 0.6) { p.rep += 1; return '솔직한 해명이 오히려 호평을 받았다.'; } p.rep -= 3; return '해명이 또 다른 논란을 낳았다.';
    },
  },
  rival: {
    w: () => (isPro() ? 1.1 : 0),
    make: () => {
      const adj = ADJACENT_POS[S.p.pos].slice(0, 2);
      const opts = [{ label: '정면으로 경쟁한다', hint: '다음 달 성장 ×1.15 · 출전 경쟁 심화' }];
      adj.forEach(ps => opts.push({ label: `${POSITIONS[ps].name}(으)로 포지션 변경 시도`, hint: `예상 오버롤 ${Math.round(overallOf(S.p.attrs, ps))}` }));
      opts.push({ label: '이적을 고려한다', hint: '다음 이적시장 제안 증가' });
      return { title: '🆕 경쟁자 영입', text: `${clubName(S.p.club)}이(가) 같은 포지션의 경쟁자를 영입했습니다.`, opts, params: { adj } };
    },
    apply(i, par) {
      const p = S.p;
      if (i === 0) { p.buffNext.growth = 1.15; p.buffNext.sel = -2; p.morale += 2; return '경쟁이 의욕을 끌어올렸다.'; }
      if (i <= par.adj.length) return changePos(par.adj[i - 1]);
      p.wantsMove = true; return '에이전트가 새 팀을 알아보기 시작했다.';
    },
  },
  poschange: {
    w: () => {
      if (!isPro() || isGK()) return 0;
      const best = ADJACENT_POS[S.p.pos].map(ps => overallOf(S.p.attrs, ps)).sort((a, b) => b - a)[0];
      return best > ovrF() + 1.5 ? 1.5 : 0;
    },
    make: () => {
      const ps = ADJACENT_POS[S.p.pos].slice().sort((a, b) => overallOf(S.p.attrs, b) - overallOf(S.p.attrs, a))[0];
      return { title: '🔄 포지션 변경 제안', text: `감독이 ${POSITIONS[ps].name} 기용을 제안했습니다. 예상 오버롤 ${Math.round(overallOf(S.p.attrs, ps))} (현재 ${ovr()}).`, opts: [{ label: '받아들인다', hint: '포지션 변경 · 신뢰 +' }, { label: '지금 포지션을 고집한다', hint: '신뢰 -' }], params: { ps } };
    },
    apply(i, par) { if (i === 0) { S.p.trust += 4; return changePos(par.ps); } S.p.trust -= 3; return '원래 포지션에서 증명하기로 했다.'; },
  },
  youth_nt: {
    w: () => (S.p.age <= 21 && ovrF() >= NATIONS[S.p.nat].thr - 16 && S.p.intl.caps === 0 ? 1.6 : 0),
    make: () => {
      const u = S.p.age <= 17 ? 17 : S.p.age <= 20 ? 20 : 23;
      return { title: '🎽 연령별 대표팀 소집', text: `${NATIONS[S.p.nat].name} U-${u} 대표팀 소집 통보를 받았습니다.`, opts: [{ label: '대표팀에 합류한다', hint: '명성 + · 다음 달 성장 ×1.1 · 피로 +8' }, { label: '소속팀 훈련에 집중한다', hint: '신뢰 +' }], params: { u } };
    },
    apply(i, par) { const p = S.p; if (i === 0) { p.rep += 3; p.intl.youthCaps += 2; p.buffNext.growth = 1.1; p.fatigue = clamp(p.fatigue + 8, 0, 100); addNews(`${p.name}, U-${par.u} 대표팀 발탁`); return '연령별 대표팀에서 좋은 경험을 쌓았다.'; } p.trust += 3; return '소속팀에 남아 훈련했다.'; },
  },
  trainer_offer: {
    w: () => (S.p.money >= trainerCost() * 2.2 && S.p.trainerMonths === 0 ? 0.9 : 0),
    make: () => { const c = Math.round(trainerCost() * 2.2); return { title: '🏋️ 유명 트레이너의 제안', text: `유명 피지컬 트레이너가 3개월 집중 패키지를 ${fmtMoney(c)}에 제안했습니다. (정상가의 약 73%)`, opts: [{ label: '계약한다', hint: '3개월간 개인 트레이너 무료' }, { label: '거절한다', hint: '' }], params: { c } }; },
    apply(i, par) { if (i === 0 && S.p.money >= par.c) { S.p.money -= par.c; S.p.trainerMonths = 3; return '3개월 패키지 계약. 월간 계획에서 개인 트레이너를 무료로 선택할 수 있다.'; } return '제안을 거절했다.'; },
  },
  family: {
    w: () => 0.8,
    make: () => ({ title: '👨‍👩‍👦 가족의 방문', text: '가족이 경기장을 찾아 응원하겠다고 연락했습니다.', opts: [{ label: '좋은 자리를 마련한다', hint: '사기 ++' }, { label: '경기에 집중하고 싶다고 말한다', hint: '이번 달 판단 +2%p' }] }),
    apply(i) { if (i === 0) { S.p.morale += 9; return '가족의 응원에 힘이 났다.'; } S.p.buffNext.decision = (S.p.buffNext.decision || 0) + 2; return '마음을 다잡았다.'; },
  },
  agent: {
    w: () => (S.p.rep >= 15 && !S.p.agent ? 1.5 : 0),
    make: () => ({ title: '🤝 에이전트 계약', text: '여러 에이전시에서 연락이 왔습니다.', opts: [{ label: '대형 에이전시', hint: '이적 제안 + · 연봉 +15% · 수수료 10%' }, { label: '가족 같은 소형 에이전시', hint: '연봉 +5%' }, { label: '혼자 하겠다', hint: '' }] }),
    apply(i) { if (i === 0) { S.p.agent = 'big'; return '대형 에이전시와 손잡았다.'; } if (i === 1) { S.p.agent = 'small'; return '믿을 수 있는 에이전트를 얻었다.'; } S.p.agent = 'none'; return '당분간 직접 협상하기로 했다.'; },
  },
  scout: {
    w: () => (isPro() && S.p.rep >= 18 && proClubs().some(c => cs(c.id) >= cs(S.p.club) + 4) ? 1.2 : 0),
    make: () => { const c = bigClubPick(); return { title: '🔭 빅클럽 스카우트', text: `${clubName(c.id)} 스카우트가 다음 달 경기를 지켜볼 예정이라는 소식입니다.`, opts: [{ label: '평소대로 한다', hint: '' }, { label: '과감한 플레이로 어필한다', hint: '다음 달 판단 +2%p · 활약 시 해당 구단 제안 가능' }], params: { id: c.id } }; },
    apply(i, par) { if (i === 1) { S.p.buffNext.decision = (S.p.buffNext.decision || 0) + 2; S.p.scoutClub = par.id; return '눈도장을 찍을 준비가 됐다.'; } return '평정심을 유지했다.'; },
  },
  pain: {
    w: () => (S.p.fatigue >= 55 && S.p.injury === 0 ? 2 : 0),
    make: () => ({ title: '⚠️ 근육 통증', text: '훈련 중 허벅지에 뻐근한 통증이 느껴집니다.', opts: [{ label: '참고 뛴다', hint: '다음 달 부상 위험 ×2' }, { label: '정밀 검사를 받는다', hint: '1경기 결장 · 피로 -10' }, { label: '휴식을 요청한다', hint: '피로 -18 · 신뢰 -3' }] }),
    apply(i) { const p = S.p; if (i === 0) { p.buffNext.injRisk = 2; return '통증을 참기로 했다.'; } if (i === 1) { p.injury = Math.max(p.injury, 1); p.fatigue = clamp(p.fatigue - 10, 0, 100); return '다행히 큰 문제는 아니었다. 한 경기 쉬어간다.'; } p.fatigue = clamp(p.fatigue - 18, 0, 100); p.trust -= 3; return '충분히 쉬었다.'; },
  },
  captain: {
    w: () => (isPro() && S.p.age >= 25 && S.p.trust >= 70 && S.p.seasonsAtClub >= 3 && !S.p.captain ? 2 : 0),
    make: () => ({ title: '©️ 주장 제안', text: '감독이 다음 시즌까지 주장 완장을 맡아 달라고 제안했습니다.', opts: [{ label: '수락한다', hint: '출전 우선권 + · 명성 + · 리더십 수련 +' }, { label: '고사한다', hint: '' }] }),
    apply(i) { const p = S.p; if (i === 0) { p.captain = true; p.rep += 2; p.skillProg.leader = (p.skillProg.leader || 0) + 40; addNews(`${p.name}, ${clubName(p.club)} 주장 선임`); return '주장 완장을 찼다.'; } return '플레이에 집중하겠다고 했다.'; },
  },
  sangmu: {
    w: () => (S.p.nat === 'KOR' && isPro() && !S.p.mil.done && !S.p.mil.exempt && !S.p.mil.planned && !S.p.mil.serving && S.p.age >= 24 && S.p.age <= 27 ? 1.3 : 0),
    make: () => ({ title: '🎖️ 병역 계획', text: `만 ${S.p.age}세. 병역 의무를 어떻게 해결할지 정해야 할 시기가 다가옵니다. 김천 상무에 지원하면 다음 시즌부터 약 18개월간 복무합니다.`, opts: [{ label: '김천 상무에 지원한다', hint: '다음 시즌 입대 · 커리어 공백 최소화' }, { label: '조금 더 미룬다', hint: '만 28세가 되면 입대해야 함' }] }),
    apply(i) { if (i === 0) { S.p.mil.planned = true; return '시즌 종료 후 김천 상무에 입대한다.'; } return '조금 더 고민하기로 했다.'; },
  },
  school: {
    w: () => (!isPro() && S.p.nat === 'KOR' ? 1.2 : 0),
    make: () => ({ title: '📚 기말고사 기간', text: '학교 기말고사가 다가옵니다. 담임 선생님이 수업 출석을 당부합니다.', opts: [{ label: '공부에 집중한다', hint: '사기 + · 피로 - · 다음 달 성장 ×0.9' }, { label: '훈련을 우선한다', hint: '신뢰 + · 다음 달 성장 ×1.1 · 사기 -' }] }),
    apply(i) { const p = S.p; if (i === 0) { p.morale += 5; p.fatigue = clamp(p.fatigue - 8, 0, 100); p.buffNext.growth = 0.9; return '성적표가 꽤 괜찮았다.'; } p.trust += 3; p.buffNext.growth = 1.1; p.morale -= 3; return '코치진이 열정을 눈여겨봤다.'; },
  },
  fan: {
    w: () => (S.p.rep >= 20 ? 0.8 : 0),
    make: () => ({ title: '✍️ 팬 사인회', text: '구단이 팬 사인회 참석을 요청했습니다.', opts: [{ label: '참석한다', hint: '명성 + · 피로 +' }, { label: '정중히 거절한다', hint: '' }] }),
    apply(i) { if (i === 0) { S.p.rep += 2; S.p.fatigue = clamp(S.p.fatigue + 3, 0, 100); return '팬들의 뜨거운 환호를 받았다.'; } return '다음 기회로 미뤘다.'; },
  },
};

function changePos(ps) {
  const p = S.p, before = ovr();
  p.pos = ps;
  for (const k of Object.keys(p.skills)) if (!skillAllowed(k)) { /* 포지션 외 스킬은 보유하되 효과 없음 */ }
  addNews(`${p.name}, ${POSITIONS[ps].name}(으)로 포지션 변경`);
  return `${POSITIONS[ps].name}(으)로 포지션을 바꿨다. 오버롤 ${before} → ${ovr()}`;
}

function rollEvents() {
  const evs = [];
  const mc = S.mctx;
  if (mc.injuredNew && S.p.injury > 0) evs.push(buildEvent('injury', mc.injuredNew));
  if (rnd() < 0.72) {
    S.recentEv = S.recentEv || [];
    const ids = Object.keys(EVENTS).filter(id => EVENTS[id].w && !S.recentEv.includes(id));
    const cand = ids.filter(id => EVENTS[id].w() > 0);
    if (cand.length) {
      const id = wpick(cand, x => EVENTS[x].w());
      evs.push(buildEvent(id));
      S.recentEv.push(id);
      if (S.recentEv.length > 4) S.recentEv.shift();
    }
  }
  return evs;
}
function buildEvent(id, par) {
  const e = EVENTS[id].make(par || {});
  return { id, title: e.title, text: e.text, opts: e.opts, params: e.params || par || {} };
}

function eventChoice(i) {
  if (S.phase !== 'event' || S.pending.evResult) return;
  const ev = S.pending.events[0];
  const o = ev.opts[i];
  if (!o || o.dis) return;
  const txt = EVENTS[ev.id].apply(i, ev.params);
  const p = S.p;
  p.trust = clamp(p.trust, 0, 100); p.morale = clamp(p.morale, 0, 100); p.rep = clamp(p.rep, 0, 100);
  S.pending.evResult = { title: ev.title, choice: o.label, text: txt };
}
function eventAck() {
  if (S.phase !== 'event' || !S.pending.evResult) return;
  S.pending.events.shift();
  S.pending.evResult = null;
  if (!S.pending.events.length) nextMonth();
}

/* ===================== 이적시장 ===================== */
function mkOffer(c, kind) {
  const p = S.p, o = ovrF(), fit = o - cs(c.id);
  const role = fit >= 1 ? '주전' : fit >= -4 ? '로테이션' : '유망주';
  const years = kind === 'loan' ? 1 : p.age < 24 ? ri(3, 5) : p.age < 30 ? ri(2, 4) : ri(1, 2);
  let salary = salaryFor(o, c.lg) * (role === '주전' ? 1.1 : role === '유망주' ? 0.7 : 1) * (p.agent === 'big' ? 1.15 : p.agent === 'small' ? 1.05 : 1);
  if (p.age <= 19) salary *= 0.6;
  const fee = kind === 'loan' || kind === 'renew' || kind === 'return' || p.contract.years <= 0 || curClub().youth ? 0 : marketValue();
  return { kind, club: c.id, lg: c.lg, role, years, salary: Math.round(salary / 10) * 10, fee: Math.round(fee * 10) / 10 };
}

function genOffers(kind) {
  const p = S.p, o = ovrF(), cur = curClub(), offers = [];
  if (p.mil.serving) return offers;
  const youth = cur.youth;
  if (youth && kind === 'winter') return offers;
  const N = NATIONS[p.nat];
  let want;
  if (youth) want = p.age >= 19 ? 3 : p.age >= 18 ? (o >= 50 ? 2 : 1) : (o >= 55 ? 1 : 0);
  else if (kind === 'winter') want = p.wantsMove ? 2 : (rnd() < 0.3 ? 1 : 0);
  else want = 2 + (p.wantsMove ? 1 : 0) + (p.agent === 'big' ? 1 : 0) + (p.rep > 60 ? 1 : 0);
  const used = new Set([p.club]);
  const pool = proClubs().filter(c => c.id !== p.club);
  const weight = c => {
    const fit = o - cs(c.id);
    const lo = p.age <= 21 ? -11 : -7;
    if (fit < lo || fit > 14) return 0;
    let w = Math.exp(-Math.abs(fit - 1) / 4.5) * (0.6 + p.rep / 60);
    const home = LEAGUES[c.lg].nat === p.nat;
    if (youth) w *= home ? 4 : 0.3;
    else if (home) w *= 1.5;
    return w;
  };
  // 유스 → 원소속 구단 프로 계약
  if (youth && p.age >= 17) {
    const par = CLUBS[cur.parent];
    if (o >= cs(par.id) - 13 && (p.age >= 18 || o >= 52)) { offers.push(mkOffer(par, 'pro')); used.add(par.id); }
  }
  // 스카우트 이벤트 구단
  if (p.scoutClub && !used.has(p.scoutClub) && kind === 'summer') {
    const c = CLUBS[p.scoutClub];
    if (o - cs(c.id) >= -10 && S.lastShare > 0.3) { offers.push(mkOffer(c, 'transfer')); used.add(c.id); }
    p.scoutClub = null;
  }
  for (let i = 0; i < want; i++) {
    const cand = pool.filter(c => !used.has(c.id));
    if (!cand.length) break;
    const c = wpick(cand, weight);
    if (weight(c) <= 0) break;
    used.add(c.id);
    offers.push(mkOffer(c, youth ? 'pro' : 'transfer'));
  }
  // 재계약
  if (!youth && kind === 'summer' && p.contract.type !== 'loan' && p.contract.type !== 'military' && p.contract.years <= 1 && p.age < 38) {
    if (o >= cs(p.club) - 6 || (p.age <= 22 && p.pot > cs(p.club))) {
      const r = mkOffer(cur, 'renew');
      r.salary = Math.max(r.salary, Math.round(p.contract.salary * 1.1 / 10) * 10);
      offers.unshift(r);
    }
  }
  // 임대
  if (!youth && p.age <= 22 && S.lastShare < 0.35 && p.contract.type === 'pro' && p.contract.years > 0) {
    const lc = pool.filter(c => !used.has(c.id) && o - cs(c.id) >= 0 && o - cs(c.id) <= 9);
    for (let i = 0; i < (kind === 'winter' ? 1 : 2) && lc.length; i++) {
      const c = wpick(lc, x => (LEAGUES[x.lg].nat === LEAGUES[cur.lg].nat ? 2 : 1));
      lc.splice(lc.indexOf(c), 1); used.add(c.id);
      const off = mkOffer(c, 'loan'); off.role = '주전'; off.salary = p.contract.salary;
      offers.push(off);
    }
  }
  // 최소 보장 (유스 졸업 · 자유계약)
  const mustMove = (youth && p.age >= 19) || (!youth && p.contract.years <= 0 && p.contract.type !== 'loan');
  if (mustMove && !offers.length && p.age < 34) {
    const home = proClubs().filter(c => LEAGUES[c.lg].nat === p.nat && !used.has(c.id));
    const list = (home.length ? home : proClubs()).sort((a, b) => cs(a.id) - cs(b.id));
    offers.push(mkOffer(list[ri(0, Math.min(2, list.length - 1))], youth ? 'pro' : 'transfer'));
  }
  return offers;
}

function applyOffer(of, mid) {
  const p = S.p, prevClub = p.club;
  if (of.kind === 'renew') {
    p.contract.years = of.years; p.contract.salary = of.salary; p.contract.role = of.role;
    addNews(`${p.name}, ${clubName(p.club)}와 ${of.years}년 재계약`);
    return;
  }
  if (of.kind === 'loan') {
    p.loan = { from: p.club, contract: Object.assign({}, p.contract) };
    p.club = of.club;
    p.contract = { club: of.club, years: 1, salary: of.salary, role: of.role, type: 'loan' };
    addNews(`${p.name}, ${clubName(of.club)}로 임대 — "경기 감각이 먼저"`);
  } else {
    if (of.kind === 'return') { p.club = of.club; p.contract = of.contract; }
    else {
      p.club = of.club;
      p.contract = { club: of.club, years: of.years, salary: of.salary, role: of.role, type: 'pro' };
      addNews(of.fee > 0 ? `${p.name}, ${clubName(of.club)} 이적 — 이적료 ${fmtFee(of.fee)}` : `${p.name}, ${clubName(of.club)}와 ${of.years}년 계약`);
    }
    p.captain = false;
    p.seasonsAtClub = mid ? 1 : 0;
  }
  p.trust = of.role === '주전' ? 62 : of.role === '로테이션' ? 52 : 45;
  p.wantsMove = false;
  if (!p.clubs.includes(p.club)) p.clubs.push(p.club);
  if (mid && prevClub !== p.club) switchClubMidseason();
}

function switchClubMidseason() {
  const se = S.season, c = curClub();
  se.league = buildLeague(c.lg, S.month);
  se.cup = { name: leagueOf(c.lg).cup, alive: false, result: '시즌 중 이적으로 미출전', youth: false };
  se.cont = null;
  if (!se.clubs.includes(c.id)) se.clubs.push(c.id);
}

function windowChoice(i) {
  if (S.phase !== 'window') return;
  const W = S.pending.window, p = S.p;
  if (i < 0) { if (W.mustChoose) return; }
  else { const of = W.offers[i]; if (!of) return; applyOffer(of, W.kind === 'winter'); }
  S.pending.window = null;
  if (W.kind === 'summer') startNewSeason();
  else { prepareMonth(); S.phase = 'plan'; }
}

function discharge() {
  const p = S.p;
  p.mil.serving = false; p.mil.done = true;
  addNews(`${p.name}, 김천 상무 전역`);
  if (p.mil.returnClub) {
    const rc = p.mil.returnClub;
    S.pending.returnOffer = { kind: 'return', club: rc, lg: CLUBS[rc].lg, role: p.mil.returnContract.role, years: p.mil.returnContract.years, salary: p.mil.returnContract.salary, fee: 0, contract: p.mil.returnContract };
  }
  p.contract.years = 0;
  return '🎖️ 만기 전역! 원소속팀 복귀 또는 새 팀을 선택하세요.';
}

/* ===================== 시즌 종료 · 시상 ===================== */
function seasonTotals(se) {
  const t = { apps: 0, starts: 0, mins: 0, g: 0, a: 0, cs: 0, saves: 0, rs: 0, motm: 0 };
  for (const k in se.stats) {
    if (k === '친선경기' || k === '2군 경기') continue;
    const s = se.stats[k];
    for (const f in t) t[f] += s[f] || 0;
  }
  return t;
}

function seasonEnd() {
  const p = S.p, se = S.season, L = se.league, lgInfo = leagueOf(L.lg);
  L.rounds.forEach((_, r) => simRound(L, r, null));
  const order = sortedTable(L);
  const pos = order.indexOf(p.club) + 1;
  se.tablePos = pos;
  se.lgName = L.name;
  const youth = curClub().youth;
  if (pos === 1) { se.trophies.push(L.name + (youth ? ' (유스)' : '')); addNews(`🏆 ${clubName(p.club)}, ${L.name} 우승!`); }
  S.lastTables[L.lg] = order;
  S.lastShare = se.possible ? se.mins / se.possible : 1;
  // 리그 개인상
  const st = se.stats[L.name] || { apps: 0, g: 0, a: 0, cs: 0, rs: 0 };
  const rounds = L.rounds.length;
  const avgR = st.apps ? st.rs / st.apps : 0;
  const aw = [];
  const tag = youth ? ' (유스)' : '';
  if (st.apps >= rounds * 0.4) {
    const topG = Math.max(5, Math.round(rounds * (youth ? 0.72 : 0.6) + normal() * 2.5));
    const topA = Math.max(4, Math.round(rounds * 0.33 + normal() * 2));
    if (st.g >= topG) aw.push(`${L.name} 득점왕${tag}`);
    if (st.a >= topA) aw.push(`${L.name} 도움왕${tag}`);
    const g = group();
    const mvp = (avgR - 6.9) * 5 + st.g / rounds * 4 + st.a / rounds * 3 + (pos === 1 ? 1.2 : pos <= 3 ? 0.5 : 0)
      + (['CB', 'FB', 'DM', 'GK'].includes(g) ? st.cs / rounds * 3 : 0);
    if (mvp >= (youth ? 4.8 : 4.2) + normal() * 0.4) aw.push(`${L.name} MVP${tag}`);
    else if (!youth && p.age <= 23 && mvp >= 2.6 + normal() * 0.4) aw.push(`${L.name} 영플레이어상`);
    if (mvp >= 2.8) aw.push(`${L.name} 올해의 팀${tag}`);
  }
  se.awards.push(...aw);
  aw.forEach(a => addNews(`🏅 ${p.name}, ${a}`));
  S.pending.summary = {
    label: se.label, club: p.club, lg: L.name, pos, teams: order.length, trophies: se.trophies.slice(), awards: aw,
    totals: seasonTotals(se), league: st, cup: se.cup.result || '-', cupName: se.cup.name,
    cont: se.cont ? `${se.cont.name}: ${se.cont.result || '-'}` : null, ovrStart: se.startOvr, ovrEnd: ovr(), caps: se.intlCaps,
  };
  S.phase = 'seasonEnd';
}

function seasonAck() {
  if (S.phase !== 'seasonEnd') return;
  S.pending.tourQueue = determineTours();
  nextTourOrOff();
}
function nextTourOrOff() {
  const q = S.pending.tourQueue || [];
  if (q.length) startTour(q.shift()); else offseason();
}

/* ---------- 대표팀 대회 ---------- */
const TOURS = {
  WC:    { name: 'FIFA 월드컵', pool: 'ALL', ko: ['32강', '16강', '8강', '4강', '결승'], prestige: 22, lenient: true },
  EURO:  { name: 'UEFA 유로', pool: 'UEFA', ko: ['16강', '8강', '4강', '결승'], prestige: 14 },
  COPA:  { name: '코파 아메리카', pool: 'CONMEBOL', ko: ['8강', '4강', '결승'], prestige: 14 },
  ASIAN: { name: 'AFC 아시안컵', pool: 'AFC', ko: ['16강', '8강', '4강', '결승'], prestige: 6 },
  OLY:   { name: '올림픽 남자축구', pool: 'ALL', ko: ['8강', '4강', '결승'], u23: true, bronze: true, prestige: 4 },
  AG:    { name: '아시안게임 남자축구', pool: 'AFC', ko: ['16강', '8강', '4강', '결승'], u23: true, bronze: true, prestige: 2 },
};

function determineTours() {
  const p = S.p, N = NATIONS[p.nat], E = S.year + 1, out = [];
  if (p.age < 17) return out;
  const senior = () => p.age >= 18 && ovrF() + p.rep * 0.05 + normal() * 1.2 >= N.thr;
  const u23 = () => {
    if (p.age <= 23) return ovrF() + normal() * 1.5 >= N.thr - 9;
    const wcChance = p.nat === 'KOR' && !p.mil.exempt && !p.mil.done ? 0.7 : 0.3;
    return ovrF() >= N.thr + 3 && rnd() < wcChance;
  };
  if (E % 4 === 2 && senior()) out.push('WC');
  if (E % 4 === 0 && N.conf === 'UEFA' && senior()) out.push('EURO');
  if (E % 4 === 0 && N.conf === 'CONMEBOL' && senior()) out.push('COPA');
  if (E % 4 === 3 && N.conf === 'AFC' && senior()) out.push('ASIAN');
  if (E % 4 === 0 && u23()) out.push('OLY');
  if (E % 4 === 2 && N.conf === 'AFC' && u23()) out.push('AG');
  return out;
}

function ntPool(T) {
  const me = NATIONS[S.p.nat].name;
  const arr = T.pool === 'ALL' ? [].concat(NT_POOL.UEFA, NT_POOL.CONMEBOL, NT_POOL.AFC.slice(0, 6), NT_POOL.OTHER) : NT_POOL[T.pool];
  const seen = new Set();
  return arr.filter(([n]) => n !== me && !seen.has(n) && seen.add(n));
}

function startTour(id) {
  const T = TOURS[id], p = S.p, N = NATIONS[p.nat];
  const base = N.str - (T.u23 ? 8 : 0);
  const pool = ntPool(T);
  const group = shuffle(pool.slice()).slice(0, 3);
  const tr = { id, name: T.name + (T.u23 ? '' : ''), u23: !!T.u23, base, si: 0, bronze: false, games: [], alive: true, result: '', pts: 0, used: group.map(x => x[0]) };
  for (const [opp, str] of group) {
    const fx = { type: 'intl', comp: T.name, stage: '조별리그', oppName: opp, oppStr: str - (T.u23 ? 8 : 0), neutral: true, teamBase: base, imp: 6, u23: tr.u23 };
    const line = simFixture(fx);
    tr.games.push(line);
    tr.pts += line.gf > line.ga ? 3 : line.gf === line.ga ? 1 : 0;
    if (line.mins > 0) { p.intl.caps++; p.intl.goals += line.g; }
  }
  const adv = tr.pts >= 4 || (tr.pts === 3 && rnd() < (T.lenient ? 0.8 : 0.5));
  if (!adv) { tr.alive = false; tr.result = '조별리그 탈락'; }
  S.pending.tour = tr;
  S.phase = 'tournament';
}

function tourStage() { const tr = S.pending.tour; return tr.bronze ? '3·4위전' : TOURS[tr.id].ko[tr.si]; }

function tourNext() {
  const tr = S.pending.tour;
  if (S.phase !== 'tournament' || !tr.alive) return;
  const T = TOURS[tr.id];
  const stage = tourStage();
  const cand = ntPool(T).filter(x => !tr.used.includes(x[0]));
  const depth = tr.si / T.ko.length;
  const [opp, str] = wpick(cand, x => Math.exp((x[1] - 75) / 6 * (0.5 + depth)));
  tr.used.push(opp);
  const fx = { type: 'intl', comp: T.name, stage, oppName: opp, oppStr: str - (T.u23 ? 8 : 0), neutral: true, teamBase: tr.base, imp: 7 + tr.si, ko: true, u23: tr.u23 };
  startFeatured(fx, { kind: 'tour' });
}

function tourAfterMatch() {
  const M = S.pending.match, tr = S.pending.tour, T = TOURS[tr.id], p = S.p;
  const r = M.result;
  if (M.part.mins > 0) { p.intl.caps++; p.intl.goals += r.g; }
  tr.games.push(r.line);
  const won = r.gf > r.ga || (r.gf === r.ga && r.pens);
  const stage = tourStage();
  if (stage === '3·4위전') { tr.alive = false; tr.result = won ? '3위 (동메달)' : '4위'; }
  else if (stage === '결승') { tr.alive = false; tr.result = won ? '우승' : '준우승'; }
  else if (!won) {
    if (T.bronze && stage === '4강') tr.bronze = true;
    else { tr.alive = false; tr.result = `${stage} 탈락`; }
  } else tr.si++;
  if (!tr.alive) finishTour();
  S.pending.match = null;
  S.phase = 'tournament';
}

function finishTour() {
  const tr = S.pending.tour, p = S.p, se = S.season;
  if (tr.result === '우승') { se.trophies.push(tr.name); addNews(`🏆 ${NATIONS[p.nat].name}, ${tr.name} 우승! ${p.name} 정상에 서다`); p.rep = clamp(p.rep + TOURS[tr.id].prestige * 0.6, 0, 100); }
  else addNews(`${NATIONS[p.nat].name}, ${tr.name} ${tr.result}`);
  se.tourResults = se.tourResults || [];
  se.tourResults.push(`${tr.name}: ${tr.result}`);
  if (p.nat === 'KOR' && !p.mil.exempt && !p.mil.done) {
    const medal = tr.id === 'OLY' && ['우승', '준우승', '3위 (동메달)'].includes(tr.result);
    const ag = tr.id === 'AG' && tr.result === '우승';
    if (medal || ag) { p.mil.exempt = true; p.mil.planned = false; tr.exempt = true; addNews(`${p.name}, 병역 특례 대상 — 예술·체육요원 편입`); }
  }
}

function tourAck() {
  if (S.phase !== 'tournament' || S.pending.tour.alive) return;
  S.pending.tour = null;
  nextTourOrOff();
}

/* ---------- 발롱도르 ---------- */
function computeBallon() {
  const p = S.p, se = S.season;
  if (curClub().youth || p.age < 18) return null;
  const t = seasonTotals(se);
  if (t.apps < 10) return null;
  const avgR = t.rs / t.apps;
  const L = LEAGUES[curClub().lg];
  const g = group();
  let B = (avgR - 6.5) * 20 * Math.min(1, t.apps / 30) + t.g * 0.45 + t.a * 0.3;
  if (g === 'GK') B += t.cs * 0.9; else if (['CB', 'FB', 'DM'].includes(g)) B += t.cs * 0.6;
  for (const tr of se.trophies) {
    if (tr.includes('(유스)')) continue;
    if (Object.values(LEAGUES).some(l => l.name === tr)) B += 8 * (L ? L.prestige / 5 : 0.5);
    else if (tr === CONTINENTAL.UCL.name) B += 15;
    else if (tr === CONTINENTAL.LIB.name) B += 8;
    else if (tr === CONTINENTAL.ACL.name) B += 5;
    else { const T = Object.values(TOURS).find(x => x.name === tr); B += T ? T.prestige : 4; }
  }
  B += (ovrF() - 84) * 3 + p.rep * 0.1 + (L ? L.prestige * 2 : 0) - 6;
  const Bgk = B;
  if (g === 'GK') B *= 0.72;
  const T = 105 + normal() * 8;
  let rank = B >= T ? 1 : 2 + Math.floor((T - B) / 2.0 + rnd() * 1.5);
  if (rank > 30) rank = null;
  const res = { rank, score: Math.round(B), extra: [] };
  if (g === 'GK' && Bgk >= 68 + normal() * 6) res.extra.push('야신 트로피');
  if (p.age <= 21 && B >= 52 + normal() * 6) res.extra.push('코파 트로피');
  return res;
}

/* ---------- 오프시즌 ---------- */
function offseason() {
  const p = S.p, se = S.season, notes = [];
  const ballon = computeBallon();
  if (ballon) {
    if (ballon.rank === 1) { se.awards.push('발롱도르'); addNews(`🌟 ${p.name}, 발롱도르 수상! 세계 최고의 선수로 선정`); }
    else if (ballon.rank) addNews(`${p.name}, 발롱도르 ${ballon.rank}위`);
    for (const x of ballon.extra) { se.awards.push(x); addNews(`🏅 ${p.name}, ${x} 수상`); }
  }
  const t = seasonTotals(se);
  S.history.push({
    label: se.label, age: p.age, clubs: se.clubs.map(clubName), lg: se.lgName, pos: p.pos, ovr: ovr(), pos_t: se.tablePos,
    apps: t.apps, g: t.g, a: t.a, cs: t.cs, avg: t.apps ? r1(t.rs / t.apps) : null, mins: t.mins,
    trophies: se.trophies.slice(), awards: se.awards.slice(), ballon: ballon ? ballon.rank : null, caps: se.intlCaps + (se.tourResults ? 0 : 0),
    tours: se.tourResults || [], youth: curClub().youth, club: p.club,
  });
  S.trophies.push(...se.trophies.map(x => ({ t: x, y: se.label })));
  S.awards.push(...se.awards.map(x => ({ t: x, y: se.label })));
  // 잠재력 변동
  if (p.age <= 22 && t.apps) {
    const share = se.possible ? se.mins / se.possible : 0;
    const d = clamp((t.rs / t.apps - 7.1) * 0.6 + (share - 0.6) * 0.8, -1.5, 0.6);
    p.pot = clamp(p.pot + d, 50, 97);
  }
  p.pot = Math.max(p.pot, ovrF());
  p.age++;
  p.rep = clamp(p.rep * 0.92, 0, 100);
  p.fatigue = clamp(p.fatigue - 30, 0, 100);
  p.yellow = 0;
  // 특성 공개
  const G = { early: '조기 성장형', normal: '표준 성장형', late: '대기만성형' };
  if (p.age === 18 && !p.revealed.growth) { p.revealed.growth = true; notes.push(`📋 스카우트 리포트: 성장 유형은 「${G[p.traits.growth]}」입니다.`); }
  if (p.age === 19 && !p.revealed.prof) { p.revealed.prof = true; notes.push(`📋 코치진 평가: 프로 의식 ${p.traits.prof >= 1.05 ? '매우 높음' : p.traits.prof >= 0.95 ? '보통' : '낮음'}.`); }
  if (p.age === 20 && !p.revealed.injury) { p.revealed.injury = true; notes.push(`📋 메디컬 리포트: 부상 체질 ${p.traits.injury <= 0.9 ? '강함 (부상이 적음)' : p.traits.injury <= 1.2 ? '보통' : '약함 (부상 주의)'}.`); }
  // 계약
  if (p.contract.type === 'loan' && p.loan) {
    p.club = p.loan.from; p.contract = p.loan.contract; p.loan = null; p.contract.years--;
    notes.push(`↩️ 임대 종료 — ${clubName(p.club)} 복귀`);
  } else if (p.contract.type !== 'military') p.contract.years--;
  // 구단 전력 변동
  for (const id in CLUBS) {
    const b = CLUBS[id].str, c = cs(id);
    S.cs[id] = Math.round((c + (b - c) * 0.3 + normal() * 1.4) * 10) / 10;
  }
  // 병역
  let enlist = false;
  if (p.nat === 'KOR' && !p.mil.done && !p.mil.exempt && !p.mil.serving && isPro() && (p.age >= 28 || p.mil.planned)) {
    enlist = true;
    notes.push(`🎖️ 병역 의무 이행 — 다음 시즌부터 김천 상무에서 약 18개월간 복무합니다.`);
  }
  // 은퇴 판단
  const o = ovr();
  const forced = p.age >= 40 || (p.age >= 35 && o < 60) ? (p.age >= 40 ? '만 40세, 선수 생활을 마칠 시간입니다.' : '기량 하락으로 더 이상 프로 무대에서 뛰기 어렵습니다.') : '';
  S.pending.off = { ballon, notes, enlist, canRetire: p.age >= 32 && !forced, forced, label: se.label };
  S.phase = 'offseason';
}

function offAction(a) {
  if (S.phase !== 'offseason') return;
  const off = S.pending.off, p = S.p;
  if (off.forced || a === 'retire') return retire();
  if (off.enlist) { enlist(); return startNewSeason(); }
  const offers = genOffers('summer');
  const youthDone = curClub().youth && p.age >= 19;
  const mustChoose = p.contract.years <= 0 || youthDone;
  if (mustChoose && !offers.length) { S.pending.off.forced = '새 소속팀을 찾지 못했습니다.'; return retire(); }
  if (offers.length) { S.pending.window = { kind: 'summer', offers, note: '', mustChoose }; S.phase = 'window'; return; }
  startNewSeason();
}

function enlist() {
  const p = S.p;
  p.mil.serving = true; p.mil.planned = false;
  p.mil.returnClub = p.contract.years > 0 && p.contract.type !== 'loan' ? p.club : null;
  p.mil.returnContract = Object.assign({}, p.contract);
  p.mil.dischargeYear = S.year + 2;
  p.club = 'gimcheon';
  p.contract = { club: 'gimcheon', years: 2, salary: 2400, role: ovrF() >= cs('gimcheon') - 2 ? '주전' : '로테이션', type: 'military' };
  p.captain = false; p.seasonsAtClub = 0; p.trust = 55;
  if (!p.clubs.includes('gimcheon')) p.clubs.push('gimcheon');
  addNews(`${p.name}, 김천 상무 입대`);
}

function startNewSeason() {
  S.year++;
  S.month = 0;
  setupSeason();
  prepareMonth();
  S.pending = { report: null };
  S.phase = 'plan';
}

function retire() {
  const p = S.p;
  S.phase = 'retired';
  S.pending = { career: careerSummary(), reason: (S.pending.off && S.pending.off.forced) || '' };
  addNews(`${p.name}, 현역 은퇴 선언`);
}

function careerSummary() {
  const p = S.p, H = S.history.filter(h => !h.youth);
  const sum = f => H.reduce((s, h) => s + (h[f] || 0), 0);
  const ballon = S.awards.filter(a => a.t === '발롱도르').length;
  const indiv = S.awards.filter(a => !a.t.includes('(유스)') && !a.t.includes('올해의 팀')).length;
  const clubCount = new Set(H.map(h => h.club)).size;
  const byClub = {};
  H.forEach(h => { byClub[h.club] = (byClub[h.club] || 0) + 1; });
  const topClub = Object.keys(byClub).sort((a, b) => byClub[b] - byClub[a])[0];
  const topShare = H.length ? byClub[topClub] / H.length : 0;
  const trophies = S.trophies.filter(t => !t.t.includes('(유스)')).length;
  let type = '성실한 프로';
  if (ballon >= 3) type = '시대를 지배한 슈퍼스타';
  else if (ballon >= 1) type = '발롱도르 위너';
  else if (p.intl.caps >= 80) type = '대표팀의 상징';
  else if (trophies >= 12) type = '트로피 컬렉터';
  else if (topShare >= 0.8 && H.length >= 8) type = '원클럽 레전드';
  else if (clubCount >= 6) type = '어디서든 살아남은 저니맨';
  else if (p.peakAge >= 29) type = '늦게 핀 꽃';
  else if (p.peak >= 85) type = '월드클래스';
  return {
    name: p.name, nat: p.nat, pos: p.pos, age: p.age, seasons: H.length, apps: sum('apps'), g: sum('g'), a: sum('a'), cs: sum('cs'),
    peak: p.peak, peakAge: p.peakAge, ballon, indiv, trophies, caps: p.intl.caps, intlGoals: p.intl.goals, clubs: p.clubs.filter(c => !CLUBS[c].youth).map(clubName),
    topClub: topClub ? clubName(topClub) : '-', type, endYear: S.year + 1, money: p.money,
    trophyList: S.trophies.map(t => `${t.y} ${t.t}`), awardList: S.awards.map(a => `${a.y} ${a.t}`),
  };
}

/* ===================== 표시용 ===================== */
function fmtMoney(man) { // 만 원 단위 입력
  const neg = man < 0; man = Math.abs(Math.round(man));
  const eok = Math.floor(man / 10000), rest = man % 10000;
  const s = eok ? `${eok.toLocaleString()}억${rest ? ` ${rest.toLocaleString()}만` : ''} 원` : `${rest.toLocaleString()}만 원`;
  return (neg ? '-' : '') + s;
}
function fmtFee(eok) { return eok >= 1 ? `${(Math.round(eok * 10) / 10).toLocaleString()}억 원` : `${Math.round(eok * 10000).toLocaleString()}만 원`; }
function potLabel() {
  const st = S.p.stars;
  return '★'.repeat(Math.floor(st)) + (st % 1 ? '☆' : '');
}

var Engine = {
  get S() { return S; }, load(s) { S = s; }, genCandidates, newCareer, submitPlan, resolveMoment, matchDone, eventChoice, eventAck,
  windowChoice, seasonAck, tourNext, tourAck, offAction, defaultPlan, skillList, skillStatus, ovr, ovrF, overallOf, marketValue, cs,
  clubName, CLUBS, leagueOf, sortedTable, trainerCost, nutritionCost, actCost, monthlySalary, careerSummary, fmtMoney, fmtFee, potLabel,
  attrKeys, group, cond, josa, TOURS,
};
/*NODE*/
if (typeof module !== 'undefined') module.exports = Engine;
/*/NODE*/

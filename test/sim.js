// 자동 플레이 봇: 엔진 오류 검출 및 밸런스 점검
// 사용: node test/sim.js [커리어 수] [국적] [포지션]
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'src/data.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8');
const ctx = { console, Date, Math, JSON };
vm.createContext(ctx);
vm.runInContext(code + '\nthis.Engine = Engine; this.STAFF = STAFF; this.EQUIPMENT = EQUIPMENT; this.STYLES = STYLES; this.POSITIONS = POSITIONS; this.LEGACY = LEGACY;', ctx);
const E = ctx.Engine;

const KINDS = {};
function bestOffer(offers) {
  let bi = -1, bs = -1e9;
  const S = E.S, o = E.ovrF();
  offers.forEach((of, i) => {
    let s = E.cs(of.club) - (of.role === '유망주' && S.p.age > 20 ? 8 : 0) + (of.role === '주전' ? 2 : 0) + (of.kind === 'loan' ? 3 : 0);
    if (s > bs) { bs = s; bi = i; }
  });
  return { bi, bs };
}

function playCareer(seed, nat, pos, verbose, levels) {
  const perks = E.perksFrom(levels || {});
  const grpStyles = ctx.STYLES[ctx.POSITIONS[pos].group];
  const cand = E.genPlayer(pos, grpStyles[seed % grpStyles.length].id, seed, perks);
  const youth = Object.keys(E.CLUBS).filter(id => E.CLUBS[id].lg === 'Y_' + nat);
  E.newCareer({ name: '테스트', nat, pos, cand, youthClub: youth[seed % youth.length], seed, perks, startSkill: cand.rec[0] });
  let steps = 0;
  while (E.S.phase !== 'retired' && steps < 20000) {
    steps++;
    const S = E.S, ph = S.phase;
    if (ph === 'plan') {
      const pl = E.defaultPlan();
      pl.intensity = S.p.fatigue > 55 ? 0 : S.p.fatigue > 35 ? 1 : 2;
      const sk = E.skillList().filter(x => x.can);
      const rec = sk.find(x => (S.p.rec || []).includes(x.id)) || sk[0];
      pl.skill = rec && S.month % 3 !== 0 ? rec.id : null;
      pl.act = 'rest';
      // 투자: 월 수입의 일정 비율 안에서 스태프 고용, 여유 자금으로 장비 구입
      const inc = E.monthlySalary() + 80;
      for (const k of ['trainer', 'nutri', 'house']) {
        const tiers = ctx.STAFF[k].tiers; let best = 0;
        tiers.forEach((t, i) => { if (t.cost <= inc * (k === 'house' ? 0.08 : 0.15)) best = i; });
        if ((S.p.staff || {})[k] !== best) E.setStaff(k, best);
      }
      for (const k of Object.keys(ctx.EQUIPMENT)) ctx.EQUIPMENT[k].tiers.forEach((t, i) => { if (i > ((S.p.equip || {})[k] || 0) && S.p.money > t.cost * 3) E.buyEquip(k, i); });
      if (process.env.AUTO && S.month % 2 === 1) E.autoRun(pl, 'month'); else E.submitPlan(pl);
    } else if (ph === 'match') {
      const M = S.pending.match;
      if (M.done) E.matchDone();
      else {
        const m = M.moments[M.mi];
        KINDS[m.kind] = (KINDS[m.kind] || 0) + 1;
        let bi = 0, bp = -1;
        m.opts.forEach((o, i) => { if (!o.locked && o.out !== 'foul' && o.p > bp) { bp = o.p; bi = i; } });
        E.resolveMoment(bi);
      }
    } else if (ph === 'event') {
      if (S.pending.evResult) E.eventAck();
      else { const ev = S.pending.events[0]; const i = ev.opts.findIndex(o => !o.dis); E.eventChoice(i < 0 ? 0 : i); }
    } else if (ph === 'window') {
      const W = S.pending.window;
      const { bi, bs } = bestOffer(W.offers);
      const stayScore = E.cs(S.p.club) + (S.p.contract.role === '주전' ? 2 : 0);
      if (W.mustChoose || (bi >= 0 && bs > stayScore + 1)) E.windowChoice(bi < 0 ? 0 : bi); else E.windowChoice(-1);
    } else if (ph === 'seasonEnd') E.seasonAck();
    else if (ph === 'tournament') { if (S.pending.tour.invite) E.tourJoin(); else if (S.pending.tour.alive) E.tourNext(); else E.tourAck(); }
    else if (ph === 'offseason') E.offAction(S.p.age >= 36 && S.pending.off.canRetire ? 'retire' : 'continue');
    else throw new Error('unknown phase ' + ph);
  }
  if (steps >= 20000) throw new Error('stuck in phase ' + E.S.phase);
  const c = E.S.pending.career;
  if (verbose) {
    for (const h of E.S.history) console.log(`${h.label} ${h.age}세 ${h.clubs.join('/')} OVR${h.ovr} ${h.apps}경기 ${h.g}골 ${h.a}도움 평점${h.avg} ${h.ballon ? '발롱' + h.ballon + '위' : ''} ${h.awards.join(',')} ${h.trophies.join(',')}`);
  }
  return { c, steps, pot: E.S.p.pot };
}

if (process.env.RUNS) {
  // 다회차 시뮬레이션: LP를 가장 싼 업그레이드부터 사며 회차별 결과 출력
  const levels = {}; let lp = 0;
  for (let r = 1; r <= +process.env.RUNS; r++) {
    const { c } = playCareer(5000 + r * 131, process.argv[3] || 'KOR', process.argv[4] || 'ST', false, levels);
    lp += c.lp.total;
    for (;;) {
      const opts = ctx.LEGACY.filter(x => (levels[x.id] || 0) < x.max).map(x => ({ id: x.id, cost: x.cost[levels[x.id] || 0] })).sort((a, b) => a.cost - b.cost);
      if (!opts.length || opts[0].cost > lp) break;
      lp -= opts[0].cost; levels[opts[0].id] = (levels[opts[0].id] || 0) + 1;
    }
    console.log(`회차 ${r}: 최고 OVR ${c.peak} · 발롱 ${c.ballon} · 개인상 ${c.indiv} · LP +${c.lp.total} · 남은 LP ${lp} · ${JSON.stringify(levels)}`);
  }
  process.exit(0);
}
const n = +process.argv[2] || 20, nat = process.argv[3] || 'KOR', pos = process.argv[4] || 'ST';
const res = [];
for (let i = 0; i < n; i++) {
  const seed = (+process.env.SEED || 1000) + i * 7919;
  try { res.push(playCareer(seed, nat, pos, n === 1)); }
  catch (e) { console.error('seed', seed, e.stack); process.exit(1); }
}
const avg = f => (res.reduce((s, r) => s + f(r), 0) / res.length).toFixed(1);
console.log(`careers=${n} ${nat} ${pos}`);
console.log('peak', avg(r => r.c.peak), 'peakAge', avg(r => r.c.peakAge), 'seasons', avg(r => r.c.seasons), 'apps', avg(r => r.c.apps), 'goals', avg(r => r.c.g), 'assists', avg(r => r.c.a));
console.log('ballon avg', avg(r => r.c.ballon), 'with ballon', res.filter(r => r.c.ballon > 0).length, 'indiv', avg(r => r.c.indiv), 'trophies', avg(r => r.c.trophies), 'caps', avg(r => r.c.caps), 'steps', avg(r => r.steps));
console.log('peak/pot', res.map(r => r.c.peak + '/' + Math.round(r.pot)).join(' '));
console.log('types', res.map(r => r.c.type).join(' | '));
const tot = Object.values(KINDS).reduce((a, b) => a + b, 0);
console.log('moment kinds', Object.keys(KINDS).length, Object.entries(KINDS).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${(v / tot * 100).toFixed(1)}%`).join(' '));
if (process.env.SIZE) {
  // 커리어 중간 저장 크기 측정
  const E2 = E; const seed = 4242;
  const cands = E2.genCandidates('ST', 'KOR', seed);
  E2.newCareer({ name: 'x', nat: 'KOR', pos: 'ST', cand: cands[0], youthClub: 'Y_suwon', seed });
  let mx = 0, steps = 0;
  while (E2.S.phase !== 'retired' && steps++ < 20000) {
    const S = E2.S, ph = S.phase;
    if (ph === 'plan') E2.submitPlan(E2.defaultPlan());
    else if (ph === 'match') { const M = S.pending.match; if (M.done) E2.matchDone(); else E2.resolveMoment(M.moments[M.mi].opts.findIndex(o => !o.locked)); }
    else if (ph === 'event') { if (S.pending.evResult) E2.eventAck(); else E2.eventChoice(S.pending.events[0].opts.findIndex(o => !o.dis)); }
    else if (ph === 'window') E2.windowChoice(S.pending.window.mustChoose ? 0 : -1);
    else if (ph === 'seasonEnd') E2.seasonAck();
    else if (ph === 'tournament') { if (S.pending.tour.alive) E2.tourNext(); else E2.tourAck(); }
    else if (ph === 'offseason') E2.offAction('continue');
    mx = Math.max(mx, JSON.stringify(E2.S).length);
  }
  console.log('max save size KB', (mx / 1024).toFixed(1), 'seasons', E2.S.history.length);
}

// 자동 플레이 봇: 엔진 오류 검출 및 밸런스 점검
// 사용: node test/sim.js [커리어 수] [국적] [포지션]
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'src/data.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8');
const ctx = { console, Date, Math, JSON };
vm.createContext(ctx);
vm.runInContext(code + '\nthis.Engine = Engine;', ctx);
const E = ctx.Engine;

function bestOffer(offers) {
  let bi = -1, bs = -1e9;
  const S = E.S, o = E.ovrF();
  offers.forEach((of, i) => {
    let s = E.cs(of.club) - (of.role === '유망주' && S.p.age > 20 ? 8 : 0) + (of.role === '주전' ? 2 : 0) + (of.kind === 'loan' ? 3 : 0);
    if (s > bs) { bs = s; bi = i; }
  });
  return { bi, bs };
}

function playCareer(seed, nat, pos, verbose) {
  const cands = E.genCandidates(pos, nat, seed);
  const cand = cands[seed % 3];
  const youth = Object.keys(E.CLUBS).filter(id => E.CLUBS[id].lg === 'Y_' + nat);
  E.newCareer({ name: '테스트', nat, pos, cand, youthClub: youth[seed % youth.length], seed });
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
      pl.act = S.p.money > E.trainerCost() * 3 ? 'trainer' : 'rest';
      E.submitPlan(pl);
    } else if (ph === 'match') {
      const M = S.pending.match;
      if (M.done) E.matchDone();
      else {
        const m = M.moments[M.mi];
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
    else if (ph === 'tournament') { if (S.pending.tour.alive) E.tourNext(); else E.tourAck(); }
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

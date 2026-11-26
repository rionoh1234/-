// 필드 핵앤슬래시 자동사냥 엔진 (사신키우기류). 고정 틱, 결정론적 RNG, 렌더러/시뮬 공용.
(function (g) {
  const C = g.RPG.C;
  const TICK = 0.05;
  const TF = g.TUNE || {};
  const REGEN_FIGHT = TF.rgc != null && TF.rgc !== '' && !isNaN(+TF.rgc) ? +TF.rgc : (C.REGEN_FIGHT != null ? C.REGEN_FIGHT : 0.004);   // 전투 중 자연 회복(초당 최대 체력 비율)
const HEAL_SK = new Set(['heal', 'healall', 'sanctuary', 'bless', 'shield', 'resurrect', 'anthem']);   // 치유가 사거리와 무관하게 쓰는 회복·보호 스킬
  let SKCD = 0;   // 지금 시전 중인 스킬의 쿨(그로기 게이지 가산 비례용, castSkill에서 설정 — 시전 후 효과(postFx)까지 유지)
  let SRC = 0;   // 2026-11-20 파훼 잠금: 지금 디버프를 거는 영웅(id) — 같은 영웅의 파훼는 C.GIM_LOCK초에 한 번만 인정
  let NOW = 0;   // 지금 전투 시각(tick 시작에 갱신) — 영웅별 디버프 만료 기록용
  // 속성 디버프 중첩(2026-11-25 사용자 '한 캐릭터는 쌓고 한 캐릭터는 쌓인 만큼 세지는 시너지'): 속성 디버프(화상·출혈·연타·실명·빙결)가 걸릴 때마다 +1(최대 C.STACK.max, 대상마다 icd초에 한 번), 디버프가 끝나면 0.
  //   화상·출혈 = 지속 피해가 중첩만큼 커짐 · 연타(질풍) = 받는 피해 중첩당 +vuln · 실명(빛) = 가득 차면 천벌(큰 피해) 후 0 · 빙결(서리) = 가득 차면 동결(iceT초 — 맞는 공격 전부 치명타 + 치명타 피해 +iceAmp) 후 0
  const STK = { burnT: 'burnN', bleedT: 'bleedN', comboT: 'vsN', blindT: 'blindN', frzT: 'frzN' };   // 질풍: 연타가 걸릴 때 '받는 피해 증가' 중첩(vsN, 자기 타이머 vsT)이 쌓임 — 연타(추가타·장벽 파훼)는 그 위에 따로(2026-11-25 사용자 '받피증 중첩이길 바랐다, 연타는 그 위에 얹어지는 것')
  let STKADD = false;   // 쌓는 영웅(디버프 지원의 부여 효과)이 건 디버프만 중첩을 올린다 — 그 밖의 디버프는 1중첩을 만들 뿐(2026-11-25 사용자 '1중첩부터 효과, 대신 쌓는 캐릭을 넣어야 5~7중첩')
  let CUR = null, EAT = null;   // CUR = 지금 틱의 전투 상태 · EAT = 이번 시전에서 소모할 중첩 [대상, 필드]
  function stackAdd(d, k) { const S = C.STACK, f = STK[k]; if (!S || !f || !S.on.includes(k) || !CUR || !d || d.kind !== 'mob' || d.dead || !SRC) return; const b = d.b;
    if (k === 'frzT' && (d.iceT > 0 || (d.iceLk || 0) > NOW)) return;   // 동결 중·동결 직후 iceLock초는 빙결이 안 쌓임
    if ((b[f + 'Lk'] || 0) > NOW) return;   /* 소모형이 터뜨린 직후 eatLock초는 다시 안 쌓임(유지형과 같이 쓰면 유지형이 손해 — 둘 중 하나를 고르게) */
    if (!STKADD) { if (!(b[f] > 0)) b[f] = 1; if (f === 'vsN') b.vsT = Math.max(b.vsT || 0, 3); return; } const tk = f + 'At'; if (b[tk] != null && NOW - b[tk] < S.icd && NOW >= b[tk]) return; b[tk] = NOW;
    b[f] = Math.min(S.max, (b[f] || 0) + 1); if (f === 'vsN') b.vsT = Math.max(b.vsT || 0, 3);
    if (b[f] >= S.max) { if (k === 'blindT') smite(CUR, d); else if (k === 'frzT') iceOn(CUR, d); } }
  function smite(st, d, k) { k = k || 1; const S = C.STACK; d.b.blindN = 0; const u = st.heroes.find(h => h.id === SRC && !h.dead) || st.heroes.find(h => !h.dead); if (!u) return; const lk = d.gim ? gimLeak(d) : 1;   // 천벌: 마지막 중첩을 쌓은 영웅의 공격력 기준
    fx(st, { type: 'burst', x: d.x, y: d.y - 14, r: 60, ttl: 0.9, elem: 'light' }); if (!(lk > 0)) { text(st, d.x, d.y - 74, '천벌', 'smite', 3); return; }
    const v = Math.max(1, Math.round(dotV(u, d, S.smite * k) * lk * takeAmp(d))); d.hp = Math.max(0, d.hp - v); st.dmgDealt += v; u.dmgOut = (u.dmgOut || 0) + v; text(st, d.x, d.y - 74, '천벌', 'smite', 3); text(st, d.x, d.y - 48, fmtN(v), 'crit', 1.5); st.shake = Math.max(st.shake || 0, 0.25);   /* 금색 큰 글자(게임 3초 = ×3배속 실시간 1초)가 떴다 사라짐 */ if (d.hp <= 0 && !d.dead) kill(st, d, u); }
  function iceOn(st, d, t) { const S = C.STACK; t = t || S.iceT; d.b.frzN = 0; d.iceT = Math.max(d.iceT || 0, t); d.iceLk = NOW + t + (S.iceLock || 0); if (!d.boss) d.b.stunT = Math.max(d.b.stunT || 0, t); text(st, d.x, d.y - 74, '동결', 'ice', 3); st.shake = Math.max(st.shake || 0, 0.2); fx(st, { type: 'burst', x: d.x, y: d.y - 14, r: 40, ttl: 0.5, elem: 'water' }); }
  const effN = (n) => Math.max(0, (n || 0) - C.STACK.base);   // 효과가 붙는 중첩 수: base중첩까지는 효과 없음(쌓는 영웅 없이도 2~3중첩은 생김 — 쌓는 영웅이 있어야 의미가 있게)
  const windN = (d) => d.b.vsT > 0 && C.STACK ? Math.max(0, (d.b.vsN || 0) - (C.STACK.vulnFrom != null ? C.STACK.vulnFrom : C.STACK.base)) : 0;   // 질풍 중첩: vulnFrom중첩까지는 효과 없음(질풍은 쌓는 영웅 없이도 3~4중첩이 흔해서 문턱을 더 높임)
  const takeAmp = (d) => (windN(d) > 0 ? 1 + C.STACK.vuln * windN(d) : 1) * (d.grgT > 0 ? 1 + C.GROGGY.vuln : 1);   // 받는 피해 증폭(질풍 중첩 × 그로기) — 타격·지속 피해·천벌 공통
  // ── 영웅 개성(2026-11-27 사용자 '속성 공통 장치 말고 영웅마다 다른 조건'): 고유기 정의의 tr = { k: 종류, v: 값, … }. 눈에 보이는 상태(걸린 디버프·그로기·보호막·체력)에 조건을 건다
  const TR = (a) => a._tr !== undefined ? a._tr : (a._tr = ((a.skills || []).find(k => k.tr) || {}).tr || null);
  const SIGC = (a, skill) => !!(skill && a._sk && a._sk.sig);   // 고유기 타격인가
  let CHN = null;   // 이번 시전에서 소모한 '사슬' 대상
  function traitMult(st, a, d, skill) { const t = TR(a); if (!t) return 1; const b = d.b;
    switch (t.k) {
      case 'debkinds': { let n = 0; if (b.burnT > 0) n++; if (b.bleedT > 0) n++; if (b.psnT > 0) n++; if (b.comboT > 0) n++; if (b.blindT > 0) n++; if (b.slowT > 0) n++; if (b.vulnT > 0) n++; if (b.atkT > 0 && b.atk < 0) n++; if (b.defT > 0 && b.def < 0) n++; return 1 + t.v * Math.min(n, t.max); }   // 벨리알: 걸린 디버프 종류마다
      case 'dotkinds': { if (!SIGC(a, skill)) return 1; let n = 0; if (b.burnT > 0) n++; if (b.bleedT > 0) n++; if (b.psnT > 0) n++; return 1 + t.v * n; }   // 이프리아: 지속 피해 종류마다(고유기)
      case 'ramp': { if (a._rampU !== d.uid) { a._rampU = d.uid; a._rampN = 0; } const m = 1 + t.v * a._rampN; a._rampN = Math.min(t.max, a._rampN + 1); return m; }   // 나디아: 같은 적을 계속 때릴수록
      case 'wave': return SIGC(a, skill) ? 1 + t.v * Math.min(t.max, a._wave || 0) : 1;   // 세이렌: 지난 고유기에 맞은 적 수만큼
      case 'elems': { if (a._elN == null) a._elN = new Set(st.heroes.map(h => h.elem)).size; return 1 + t.v * Math.max(0, a._elN - 1); }   // 라이나: 편성 속성 종류
      case 'groggy': return SIGC(a, skill) && d.grgT > 0 ? 1 + t.v : 1;   // 브륀힐드: 그로기 중인 적
      case 'buffs': { const ab = a.b; let n = 0; if (ab.atkT > 0 && ab.atk > 0) n++; if (ab.aspdT > 0 && ab.aspd > 0) n++; if (ab.sklT > 0) n++; if (ab.cdmT > 0) n++; if (ab.crtT > 0) n++; if (ab.defT > 0 && ab.def > 0) n++; if (ab.gdrT > 0) n++; if (a.shield > 0) n++; if (ab.gfxT > 0) n++; return 1 + t.v * Math.min(n, t.max); }   // 루시엘: 자기에게 걸린 버프 수
      case 'fullhp': return SIGC(a, skill) && d.hp / d.maxHp >= t.th ? 1 + t.v : 1;   // 갈레안: 체력이 가득한 적(개막)
      case 'shield': return a.shield > 0 ? 1 + t.v : 1;   // 아폴라: 보호막이 있는 동안
      case 'solo': { if (a._solo == null) a._solo = !st.heroes.some(h => h !== a && h.role === 'dps' && h.range <= 60); return a._solo ? 1 + t.v : 1; }   // 닉스: 다른 근접 딜러가 없을 때
      case 'immobile': return SIGC(a, skill) && (b.stunT > 0 || d.grgT > 0 || b.frzT > 0 || d.iceT > 0) ? 1 + t.v : 1;   // 레이븐: 기절·그로기·빙결로 못 움직이는 적
    } return 1; }
  const frostAura = (st) => st._fa != null ? st._fa : (st._fa = Math.max(0, ...st.heroes.map(h => (TR(h) && TR(h).k === 'critslow') ? TR(h).v : 0)));   // 프로스티아: 둔화·빙결된 적은 아군 전원에게 치명타 피해를 더 받음
  function tag(d, k, t) { stackAdd(d, k); if (!d.boss || !SRC) return; const S = d.src || (d.src = {}), m = S[k] || (S[k] = {}); m[SRC] = Math.max(m[SRC] || 0, NOW + (t || 3) * (C.BUFF_DUR || 1)); }   // 이 영웅이 건 몫의 만료(공용 타이머는 다른 영웅 것이 더 길 수 있어서 따로)   // 보스에게 건 디버프를 건 영웅별로 기록(만료 시각)
  function unl(st, d, k) { const m = d.src && d.src[k]; if (!m) return 0; let best = 0; for (const id in m) if (m[id] > st.t && !(d.lk && d.lk[id] > st.t) && (!best || m[id] < m[best])) best = id; return best; }   // 여럿이면 가장 먼저 끝나는 쪽을 씀(오래 남는 디버프는 다음 파훼로)   // 잠기지 않은 영웅의 디버프가 걸려 있으면 그 영웅 id
  function lock(st, d, k) { const id = unl(st, d, k); if (id) (d.lk || (d.lk = {}))[id] = st.t + C.GIM_LOCK; }
  const HEAL_BASIC = +(TF.hbh) || C.HEAL_BASIC || 0;   // 치유 평타 → 체력 비율 가장 낮은 아군 회복(공격력 ×값), 0이면 끔
  const W = 360; let H = 325;   // 세로는 화면에 맞춰 바뀜(2026-11-19, 사용자 '남는 공간을 전투 화면으로 꽉 채워' — ui/battle.js fitField → setH, 최소 325). 진형·등장 높이는 KY = H/325 비율. 이전 기록: 2026-10-23 300→325 (전장 세로 확대, 높이 760 화면에 한 페이지). 진형 중심 CY = 184

  // 진형: 아군은 왼쪽, 적은 오른쪽에서 등장. 역할별 기본 위치(앞→뒤): 수호 > 근접 공격 > 원거리 공격 > 치유·지원
  // 전열(front) 기준 뒤로 물러서는 거리: 수호 0 · 근접 8 · 원거리 70 · 치유·지원 105. 전열은 적을 향해 전진한다
  const ROW_OFF = { tank: 0, melee: 8, ranged: 70, back: 105 };
  const COL_Y = [0, -40, 40, -80, 80];
  const KY = () => H / 325;
  function rowOf(src) { return src.role === 'tank' ? 'tank' : src.role === 'dps' ? (src.range > 60 ? 'ranged' : 'melee') : 'back'; }
  function assignHomes(heroes) {
    const groups = {};
    for (const h of heroes) (groups[rowOf(h)] = groups[rowOf(h)] || []).push(h);
    for (const r in groups) groups[r].forEach((h, k) => {
      h.row = r; h.off = ROW_OFF[r] + (k >= 3 ? 12 : 0);
      const ky = KY(); h.homeY = Math.max(80 * ky, Math.min(H - 26, (184 + COL_Y[k % 5] + (r === 'ranged' || r === 'back' ? 20 : 0)) * ky));   // 후열은 앞줄과 겹치지 않게 살짝 엇갈림
    });
  }
  function mkHero(src, i) {
    return {
      kind: 'hero', uid: src.uid, id: src.id, name: src.name, elem: src.elem, role: src.role, star: src.star, img: src.img, isMain: i === 0, idx: i,
      x: 110 + i * 2, y: (162 + (i - 2) * 28) * KY(), hp: src.hp, maxHp: src.hp, atk: src.atk, def: src.def, spd: src.spd, range: src.range,
      crit: src.crit || 0.05, cdmg: src.cdmg || 1.5, aspd: src.aspd || 1, healBonus: src.healBonus || 0, dr: src.dr || 0, bossDmg: src.bossDmg || 0, skillAmp: src.skillAmp || 0, basicAmp: src.basicAmp || 0, ultAmp: src.ultAmp || 0, ls: src.ls || 0, moveSpd: 85,
      skills: src.skills.map(s => Object.assign({}, s, { ready: s.grant ? 0 : s.cd * (s.ult ? 0.6 : 0.4) })), atkCd: 0.2 + i * 0.1, facing: 1, dead: false, regenT: 0,
      b: { atk: 0, atkT: 0, def: 0, defT: 0, aspd: 0, aspdT: 0, slowT: 0, burn: 0, burnT: 0, burnTick: 0, stunT: 0, tauntT: 0, vuln: 0, vulnT: 0, hot: 0, hotT: 0, hotTick: 0, comboT: 0, blindT: 0, bleed: 0, bleedT: 0, bleedTick: 0 },
      shield: 0, shieldT: 0, reflect: 0,
    };
  }
  function mkMob(src, st, boss) {
    const rng = st.rng;
    let x, y;
    if (boss) { x = W - 50; y = 184 * KY(); }   // 진형 중심 높이
    else { x = W + 20; y = 84 * KY() + rng() * (H - 120 * KY()); }   // 적은 오른쪽 가장자리에서만 등장
    return {
      kind: 'mob', uid: 'm' + (st.seq++), id: src.id, name: src.name, elem: src.elem, boss: !!boss, hue: src.hue || 0,
      x, y, hp: src.hp, maxHp: src.hp, atk: src.atk, def: src.def, spd: src.spd, range: src.range, basic: src.basic || 1, roarM: src.roar || 1, moveSpd: boss ? 32 : 40 + rng() * 10,
      skills: (src.skills || []).map(s => Object.assign({}, s, { ready: s.cd })), atkCd: 0.5, facing: -1, dead: false, deadT: 0, shield: 0, shieldT: 0, reflect: 0,
      gim: boss ? src.gim || null : null, bar: 0, bornT: st.t || 0, barT: 0, armT: 0, hstT: 0, rmp: 0, rmpOn: false, rmpBrk: false, rmpCd: boss && src.gim === 'rampage' ? C.GIM.rampage.first : 0, rmpAcc: 0, chT: boss && src.gim === 'frenzy' ? (C.GIM.frenzy.first || C.GIM.frenzy.every) : 0, chargeT: 0,   // 보스 기믹(시즌 3)
      b: { atk: 0, atkT: 0, def: 0, defT: 0, aspd: 0, aspdT: 0, slowT: 0, burn: 0, burnT: 0, burnTick: 0, stunT: 0, tauntT: 0, vuln: 0, vulnT: 0, hot: 0, hotT: 0, hotTick: 0, comboT: 0, blindT: 0, bleed: 0, bleedT: 0, bleedTick: 0 },
    };
  }
  const alive = (a) => a.filter(u => !u.dead);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const BW = () => C.BUFF_STR == null ? 1 : C.BUFF_STR;   // 버프·디버프 세기 배율(지속 ×3과 짝 — const/core.js C.BUFF_DUR)
  // 지속 피해 세기(2026-11-25 사용자 '도트딜 유의미하게'): 거는 순간 그 영웅의 스킬 피해·치명타 기대값·상성·보스 피해를 곱해 둔다(예전엔 공격력만 → 일반 치명타의 1/30~1/150). 피해는 건 영웅 몫(dmgOut)으로 셈
  const dotV = (u, d, k, key) => { let v = effAtk(u) * k; if (u && u.kind === 'hero') { const cr = Math.min(0.95, (u.crit || 0.05) + (u.b.crtT > 0 ? u.b.crt * BW() : 0)), cd = (u.cdmg || 1.5) + (u.b.cdmT > 0 ? u.b.cdm * BW() : 0);
    v *= (1 + (u.skillAmp || 0) + (u.b.sklT > 0 ? u.b.skl * BW() : 0)) * (1 + cr * (cd - 1)) * C.elemMult(u.elem, d.elem) * (d.boss && u.bossDmg ? 1 + u.bossDmg : 1) * (C.DOT_MULT || 1); if (key) d.b[key + 'By'] = u; } return v; };
  const effAtk = (u) => u.atk * (1 + u.b.atk * BW()) * (u.enr || 1) * (u.frz ? 1 + u.frz * C.GIM.frenzy.amp : 1) * (u.rmp ? 1 + u.rmp * C.GIM.rampage.amp : 1);
  const effDef = (u) => Math.max(0, u.def * (1 + u.b.def * BW()));
  const atkInterval = (u) => 100 / Math.max(20, u.spd * (u.aspd || 1) * (1 + u.b.aspd * BW()) * (u.b.slowT > 0 ? 1 - Math.min(0.9, u.b.slow || 0.3) * BW() : 1) * (u.rmp ? 1 + u.rmp * C.GIM.rampage.spd : 1));
  const text = (st, x, y, txt, cls, ttl) => { if (st.headless) return; if (st.texts.length > 60) st.texts.shift(); let vx = 0; if (!/[가-힣]/.test(txt)) { const n = st.txn = (st.txn || 0) + 1; x += ((n * 37) % 37) - 18; y -= (n % 4) * 7; vx = ((n * 53) % 61) - 30; } st.texts.push({ x, y, txt, cls, ttl: ttl || 0.8, vx }); };   // 수치 글자는 흩뿌리고 좌우로 흘려 겹침을 줄임(그리기 전용 — 난수 st.rng는 쓰지 않음)
  const fx = (st, o) => { if (st.headless) return; if (st.fx.length > 60) st.fx.shift(); o.ttl = o.max = o.ttl || 0.3; st.fx.push(o); };

  function damage(st, a, d, mult) {
    if (a.kind !== 'hero' && a.b.blindT > 0 && st.rng() < C.ELEM_DEB.blind * BW()) return { v: 0, crit: false, el: null, miss: true };   // 실명: 빗나감
    const atk = effAtk(a), def = effDef(d);
    const el = C.elemMult(a.elem, d.elem);
    const ice = d.iceT > 0 && a.kind === 'hero' && C.STACK; const crit = st.rng() < Math.min(0.95, (a.crit || 0.05) + (a.b && a.b.crtT > 0 ? a.b.crt * BW() : 0)) || !!ice || !!a._fc;   // 동결된 적·사슬에 묶인 적(엘리스)은 무조건 치명타   // b.crt: 아군 치명타 확률 버프(어둠 1번 부가 효과)
    let v = mult * atk * atk / (atk + def) * el * (crit ? (a.cdmg || 1.5) + (a.b && a.b.cdmT > 0 ? a.b.cdm * BW() : 0) : 1) * (0.92 + st.rng() * 0.16) * (d.b.vulnT > 0 ? 1 + d.b.vuln * BW() : 1) * (d.boss && a.bossDmg ? 1 + a.bossDmg : 1) * (a.kind === 'hero' ? takeAmp(d) : 1) * (ice ? 1 + C.STACK.iceAmp : 1) * (crit && a.kind === 'hero' && d.b.slowT > 0 && frostAura(st) ? 1 + frostAura(st) : 1) * (1 - (d.dr || 0)) * (d.b && d.b.gdrT > 0 ? 1 - d.b.gdr * BW() : 1);
    return { v: Math.max(1, Math.round(v)), crit, el: el > 1 ? 'adv' : (el < 1 ? 'dis' : null) };
  }
  function hit(st, a, d, mult, skill) {
    if (a.kind === 'hero') SRC = a.id;
    if (a.kind === 'hero') mult *= skill ? 1 + (a.skillAmp || 0) + (a._ult ? a.ultAmp || 0 : 0) + (a.b.sklT > 0 ? a.b.skl * BW() : 0) : 1 + (a.basicAmp || 0);   // 장비 옵션: 스킬·궁극기·일반 공격 피해
    if (a.kind === 'hero' && C.STACK) {   // 중첩 연계: 유지형(stk — 이 영웅의 모든 피해가 대상의 중첩당 +per) · 소모형(eat — 고유기가 중첩을 전부 소모하며 중첩당 +per)
      if (a.stkK === undefined) { const s2 = a.skills.find(k => k.stk); a.stkK = s2 ? s2.stk : null; }
      if (a.stkK) { const n = Math.max(0, (d.b[a.stkK[0] + 'N'] || 0) - (a.stkK[2] != null ? a.stkK[2] : C.STACK.base)); if (n > 0) mult *= 1 + a.stkK[1] * n; }   // stk = [디버프, 중첩당 증가, 이 중첩까지는 효과 없음] — 유지형은 높은 중첩을 지켜야 보상(소모형과 같이 쓰면 거의 못 받음)
      if (skill && a._sk && a._sk.eat) { const f = a._sk.eat[0] + 'N', n = effN(d.b[f]); if (n > 0) { mult *= 1 + a._sk.eat[1] * n; if (EAT) EAT.push([d, f]); } } }
    if (a.kind === 'hero') { const tm = traitMult(st, a, d, skill); if (tm !== 1) mult *= tm;
      if (a.bzT > 0 && a.sacP) { const [sp, fl, sk2, cap] = a.sacP; if (a.hp / a.maxHp > fl && (a.sacAcc || 0) < (cap || 9)) { a.hp -= a.maxHp * sp; a.sacAcc = (a.sacAcc || 0) + sp; } mult *= 1 + sk2 * (a.sacAcc || 0); }   // 바알: 광란 중 공격할 때마다 체력을 바치고, 바친 누적량만큼 피해 증가
      if (skill && d.chainT > 0 && d.chainBy !== a.id) { mult *= 1 + d.chainV; a._fc = true; if (CHN) CHN.push(d); else d.chainT = 0; } }   // 엘리스의 사슬: 다른 아군의 다음 스킬 1회가 치명타 + 피해 증가
    const r = damage(st, a, d, mult); a._fc = false;
    if (r.miss) { text(st, d.x, d.y - 30, '빗나감', 'heal'); return 0; }
    if (d.gim && a.kind === 'hero') { r.v = gimHit(st, d, r.v); if (!r.v) { fx(st, { type: 'hit', x: d.x, y: d.y - 14, ttl: 0.15 }); if (a.kind === 'hero' && a.b.gfxT > 0 && st.rng() < C.GRANT.p) { SRC = a.b.gfxBy || a.id; STKADD = true; applyDeb(st, a, d, a.b.gfx); STKADD = false; SRC = a.id; } return 0; } }   // 보스 기믹: 장벽·철갑
    let dmg = r.v;
    if (a.kind === 'mob' && d.kind === 'hero' && d.role !== 'tank') dmg = cover(st, a, d, dmg);   // 수호의 보호(2026-10-30)
    if (d.shield > 0) { const ab = Math.min(d.shield, dmg); d.shield -= ab; dmg -= ab; if (d.reflect && !a.dead && a.kind !== d.kind) { const rv = Math.round(ab * d.reflect); a.hp = Math.max(0, a.hp - rv); if (a.hp <= 0 && !a.dead) kill(st, a, d); } }
    d.hp = Math.max(0, d.hp - dmg); d.hitAt = st.t; if (!skill && !(a.range > 60)) a.atkAt = st.t;   // 그리기 전용: 피격 번쩍임·공격 동작
    if (a.kind === 'hero' && d.b.comboT > 0 && r.v > 1) { const e = Math.max(1, Math.round(r.v * C.ELEM_DEB.combo * BW())); d.hp = Math.max(0, d.hp - e); r.v += e; }   // 연타 추가타
    if (a.kind === 'hero') { st.dmgDealt += r.v; a.dmgOut = (a.dmgOut || 0) + r.v; const t = TR(a);
      if (t) { if (t.k === 'killcd') { if (SIGC(a, skill) && d.hp <= 0) a._kr = true; }   // 아젤라: 고유기로 처치하면 쿨 환급
        else if (t.k === 'bleedshield') { if (d.b.bleedT > 0) { a.shield = Math.min(a.maxHp * t.max, (a.shield || 0) + a.maxHp * t.v); a.shieldT = Math.max(a.shieldT || 0, 8); } }   // 모르가나: 출혈 걸린 적을 때리면 보호막
        else if (t.k === 'chain') { if (SIGC(a, skill)) { d.chainT = t.dur; d.chainBy = a.id; d.chainV = t.v; } }   // 엘리스: 사슬로 묶음
        else if (t.k === 'wave') { if (SIGC(a, skill)) a._waveHit = (a._waveHit || 0) + 1; } } }   // dmgOut: 전투 탭 출전 줄의 '이번 전투 피해 비중' 표시 전용(결과에 영향 없음)
    text(st, d.x, d.y - 26, (r.crit ? '!' : '') + fmtN(r.v), r.crit ? 'crit' : (a.kind === 'mob' ? 'enemy' : (r.el || 'norm')));
    fx(st, { type: 'hit', x: d.x, y: d.y - 14, ttl: 0.15 });
    const ls = (a.ls || 0) + (a.lsBuffT > 0 ? (a.lsBuff || 0) * BW() : 0) + (skill && a._sk && a._sk.hDrain ? a._sk.hDrain : 0);
    if (ls && !a.dead && a.kind === 'hero') a.hp = Math.min(a.maxHp, a.hp + r.v * ls);   // 장비 옵션 흡혈 · 전용장비 흡수
    if (skill && a._sk) { const k = a._sk; if (k.hStun) stun(st, d, k.hStun); if (k.hSlow) slowOn(st, a, d, k.hSlow); if (k.hVuln) { d.b.vuln = Math.max(d.b.vuln, k.hVuln); d.b.vulnT = Math.max(d.b.vulnT, 5); armorBreak(st, d); } if (k.hBleed) bleedOn(st, a, d, 3, 1); if (k.hBurn) { d.b.burn = effAtk(a) * 0.15; d.b.burnT = 3; tag(d, 'burnT'); d.b.burnTick = 0; } }
    if (a.kind === 'hero' && a.b.gfxT > 0 && !d.dead && d.kind !== 'hero' && st.rng() < C.GRANT.p) { SRC = a.b.gfxBy || a.id; STKADD = true; applyDeb(st, a, d, a.b.gfx); STKADD = false; SRC = a.id; }   // 파훼 지원 버프(grant): 아군 공격이 확률로 속성 디버프
    if (d.hp <= 0 && !d.dead) kill(st, d, a);
    return r.v;
  }
  // ---------- 보스 기믹(시즌 3, C.GIM) ----------
  // 장벽: 타격 횟수(bar)로만 깨지고, 깨지면 open초 동안 무방비 뒤 다시 생김. 장벽이 있는 동안 받는 피해는 leak배
  // 철갑: 받는 피해 leak배. 화상·방어력 감소·표식이 걸려 있는 동안과 그 뒤 open초 동안 벗겨짐
  // 신속: 공격 속도 k배. 둔화가 걸려 있는 동안과 그 뒤 open초 동안 정상
  // 격분: every초마다 cast초 동안 힘을 모은 뒤 영웅 전원에게 평타의 mult배 피해 + 그때마다 보스 공격력 +amp(누적). 모으는 동안 기절 기술을 맞으면 끊김(보스는 기절하지 않지만 '저지')
  function gimLeak(d) { if (d.gim === 'barrier') return d.bar > 0 ? 0 : 1; if (d.gim === 'armor') return d.armT > 0 ? 1 : C.GIM.armor.leak; return 1; }   // 장벽이 있는 동안 지속 피해는 막힘
  function gimHit(st, d, v) {
    if (d.gim === 'barrier' && d.bar > 0) {   // 2026-11-20 장벽 = 보호막 체력(최대 체력의 pct). 막는 동안 본체 피해 0, 연타(질풍)가 걸린 동안은 보호막에 comboMul배
      const cm = d.b.comboT > 0 && !C.GIM_NOANS && unl(st, d, 'comboT'); d.bar -= v * (cm ? C.GIM.barrier.comboMul : 1);
      if (d.bar <= 0) { if (cm) lock(st, d, 'comboT'); d.bar = 0; d.barT = C.GIM.barrier.every; text(st, d.x, d.y - 62, '장벽 파괴', 'crit'); fx(st, { type: 'burst', x: d.x, y: d.y - 24, r: 46, ttl: 0.45, elem: 'light' }); fx(st, { type: 'shards', x: d.x, y: d.y - 28, ttl: 0.7, n: 14, big: true, elem: 'water' }); st.shake = Math.max(st.shake || 0, 0.2); }
      return 0;
    }
    const m = gimLeak(d); if (m !== 1) v = Math.max(1, Math.round(v * m));
    return v;
  }
  function armorBreak(st, d) { if (d.gim !== 'armor' || d.dead || !(d.b.burnT > 0) || C.GIM_NOANS || d.armT > 0 || !unl(st, d, 'burnT')) return; lock(st, d, 'burnT');   // 2026-11-20: 철갑은 화상(화염)으로만 벗겨짐
    if (!(d.armT > 0)) { text(st, d.x, d.y - 62, '철갑 파괴', 'crit'); fx(st, { type: 'burst', x: d.x, y: d.y - 24, r: 46, ttl: 0.45, elem: 'fire' }); fx(st, { type: 'shards', x: d.x, y: d.y - 28, ttl: 0.7, n: 12, big: true }); } d.armT = C.GIM.armor.open; }
  function interrupt(st, f) { if (!(f.chargeT > 0) || C.GIM_NOANS || !unl(st, f, 'blindT')) return false; lock(st, f, 'blindT'); f.chargeT = 0; f.frz = 0; f.chT = Math.max(C.GIM.frenzy.every, C.GIM.frenzy.stagger || 0); text(st, f.x, f.y - 62, '저지!', 'crit'); fx(st, { type: 'burst', x: f.x, y: f.y - 24, r: 40, ttl: 0.4, elem: 'light' }); st.events.push({ t: 'interrupt' }); return true; }   // 실명으로 힘 모으기 끊기(기절과 같은 저지)
  // 보스 그로기(2026-11-25 사용자 'CC를 몰아 걸면 그로기'): 보스에 CC가 들어올 때마다 게이지가 차고(강한 CC = 기절·넉백·끌어당김·시간정지, 약한 CC = 빙결·둔화), 안 들어오면 초당 decay씩 빠짐. 가득 차면 dur초 행동 불능 + 받는 피해 +vuln
  function grog(st, f, kind) { const Gg = C.GROGGY; if (!Gg || !f || !f.boss || f.dead || f.grgT > 0) return;
    if (kind === 'strong') { const m = f.grgS || (f.grgS = {}); if (m[SRC] != null && st.t - m[SRC] < Gg.sIcd) return; m[SRC] = st.t; }   // 같은 영웅의 강한 CC는 sIcd초에 한 번(다단 히트 기절 중복 방지)
    else { const m = f.grgW || (f.grgW = {}); if (m[kind] != null && st.t - m[kind] < Gg.wIcd) return; m[kind] = st.t; }   // 약한 CC는 종류별 wIcd초에 한 번
    let add = Gg[kind]; if (kind === 'strong') { const cd = SKCD; if (cd) add *= Math.max(0.4, Math.min(1.4, cd / Gg.cdRef)); }   // 강한 CC는 그 스킬 쿨에 비례(쿨 cdRef초 = 100%) — 쿨 짧은 CC 영웅 혼자 채우지 못하게
    f.grg = (f.grg || 0) + add;
    if (f.grg >= Gg.max) { f.grg = 0; f.grgT = Gg.dur; f.grgN = (f.grgN || 0) + 1; f.b.stunT = Math.max(f.b.stunT || 0, Gg.dur); text(st, f.x, f.y - 62, '그로기!', 'crit'); fx(st, { type: 'stun', x: f.x, y: f.y - 44, ttl: Gg.dur }); st.events.push({ t: 'groggy' }); } }
  function stun(st, f, dur) {   // 기절: 일반 적은 기절, 보스는 기절 면역이지만 격분을 모으는 중이면 끊는다. 돌려주는 값 = 실제로 기절했는지
    if (!f.boss) { f.b.stunT = Math.max(f.b.stunT, dur); return true; }
    grog(st, f, 'strong');
    if (false && f.chargeT > 0) { f.chargeT = 0; f.chT = Math.max(C.GIM.frenzy.every, C.GIM.frenzy.stagger || 0);   /* 2026-11-20: 격분은 실명(빛)으로만 저지 — 기절은 일반 적에게만. 저지당하면 한동안 다시 모으지 못함(기절 스킬 쿨타임 30~39초에 맞춤 — 기절 영웅 1명이면 계속 막을 수 있게) */ text(st, f.x, f.y - 62, '저지!', 'crit'); fx(st, { type: 'stun', x: f.x, y: f.y - 40, ttl: 1.2 }); st.events.push({ t: 'interrupt' }); }
    return false;
  }
  const DEF_T = { guard: 1, taunt: 1, heal: 1, healall: 1, sanctuary: 1, shield: 1, bless: 1, guardall: 1 };
  const GKEY = { armor: 'burnT', regen: 'bleedT', barrier: 'comboT', rampage: 'frzT', frenzy: 'blindT' };
  const cntSk = (u, sk, g) => { const c = sk._ga || (sk._ga = {}); if (c[g] === undefined) c[g] = C.gimAnswer(g, [sk], u.elem); return c[g]; };
  const BLIND_SK = (sk) => sk.fx === 'blind' || !!sk.blind || !!(sk.postNova && sk.postNova.blind) || sk.grant === 'blind';   // 실명을 거는 스킬(격분의 답) — 2026-11-20
  const FREEZE_SK = (u, sk) => u.elem === 'water' && (sk.fx === 'freeze' || sk.type === 'timestop' || !!sk.hSlow || !!sk.postSlow || sk.type === 'slowall' || (sk.type === 'vortex' && !sk.noSlow) || sk.grant === 'freeze');   // 빙결을 거는 스킬(폭주의 답) — 2026-11-20
  const STUN_SK = (sk) => sk.type === 'bash' || sk.type === 'timestop' || ((sk.type === 'aoe' || sk.type === 'dive' || sk.type === 'nova') && sk.stun) || !!(sk.postNova && sk.postNova.stun) || !!sk.hStun;   // 기절을 거는 스킬
  function gimTick(st, u, dt) {   // 돌려주는 값 true = 이번 틱은 행동하지 않음(힘을 모으는 중)
    if (u.gim === 'barrier') { if (u.bar <= 0 && (u.barT -= dt) <= 0) { u.bar = u.maxHp * C.GIM.barrier.pct; text(st, u.x, u.y - 62, '장벽', 'enemy'); } return false; }
    if (u.gim === 'armor') { armorBreak(st, u); if (u.armT > 0) u.armT -= dt; return false; }   // 2026-11-20: 벗겨지면 open초(화상이 계속돼도 연장 안 됨), 같은 영웅은 GIM_LOCK초 뒤에 다시
    if (u.gim === 'regen') { if (u.rgH != null && u.hp < u.rgH && !(u.rgnT > 0)) u.rgP = (u.rgP || 0) + (u.rgH - u.hp) * C.GIM.regen.keep;   /* 지난 틱 이후 받은 피해(지속 피해 포함) */ if (u.b.bleedT > 0 && !C.GIM_NOANS && !(u.rgnT > 0) && unl(st, u, 'bleedT')) { text(st, u.x, u.y - 62, '재생 차단', 'crit'); u.rgnT = C.GIM.regen.open; lock(st, u, 'bleedT'); u.rgP = 0; } if (u.rgnT > 0) u.rgnT -= dt; else if (u.rgP > 0) { const h = u.rgP * Math.min(1, C.GIM.regen.rate * dt); u.hp = Math.min(u.maxHp, u.hp + h); u.rgP -= h; } u.rgH = u.hp; return false; }   // 2026-11-21 재생 = 받은 피해의 keep만큼을 회복분으로 쌓아 초당 rate씩 되돌림(싸움 길이와 무관하게 '되돌리는 비율'로 어려움) — 출혈로 차단되면 쌓인 회복분 소멸
    if (u.gim === 'rampage') {   // 2026-11-20 폭주(격분처럼 보이는 패턴): first초 뒤 '폭주!' → every초마다 공격력 amp·공속 spd 누적(끝없이). 빙결(서리)이 들어가면 누적 0 + stagger초 동안 폭주 안 함
      if (u.rmpOn) {
        if (u.b.frzT > 0 && !C.GIM_NOANS && unl(st, u, 'frzT')) { lock(st, u, 'frzT'); u.rmpOn = false; u.rmpBrk = true; u.rmp = 0; u.rmpAcc = 0; u.rmpCd = C.GIM.rampage.stagger; text(st, u.x, u.y - 62, '폭주 해제', 'crit'); fx(st, { type: 'shards', x: u.x, y: u.y - 28, ttl: 0.7, n: 14, big: true, elem: 'water' }); st.shake = Math.max(st.shake || 0, 0.2); st.events.push({ t: 'interrupt' }); }
        else if ((u.rmpAcc += dt) >= C.GIM.rampage.every) { u.rmpAcc -= C.GIM.rampage.every; if (u.rmp < (C.GIM.rampage.max || 99)) u.rmp++; text(st, u.x, u.y - 62, '폭주 ×' + u.rmp, 'enemy'); }
      } else if ((u.rmpCd -= dt) <= 0 && alive(st.heroes).length) { u.rmpOn = true; u.rmpAcc = 0; text(st, u.x, u.y - 62, '폭주!', 'crit'); fx(st, { type: 'burst', x: u.x, y: u.y - 20, r: 60, ttl: 0.5, elem: 'fire' }); st.events.push({ t: 'charge' }); }
      return false; }
    if (u.gim === 'frenzy') {
      if (u.chargeT > 0) {
        if (u.b.blindT > 0 && interrupt(st, u)) return false;   // 힘을 모으기 시작할 때 이미 실명이면 바로 끊김
        if ((u.chargeT -= dt) <= 0) { u.chargeT = 0; u.chT = C.GIM.frenzy.every; fx(st, { type: 'burst', x: u.x, y: u.y - 10, r: 200, ttl: 0.6, elem: 'fire' }); st.shake = Math.max(st.shake || 0, 0.3); for (const h of alive(st.heroes)) hit(st, u, h, C.GIM.frenzy.mult * (u.basic || 1), true); u.frz = Math.min((u.frz || 0) + 1, C.GIM.frenzy.max || 99); text(st, u.x, u.y - 62, '격분 ' + u.frz, 'crit'); }
        return true;
      }
      if ((u.chT -= dt) <= 0 && alive(st.heroes).length) { u.chargeT = C.GIM.frenzy.cast; text(st, u.x, u.y - 62, '격분', 'crit'); st.events.push({ t: 'charge' }); return true; }
    }
    return false;
  }
  // 수호의 보호: 살아 있는 수호가 있으면 다른 영웅이 받는 적 피해를 줄이고(TANK_AURA) 일부를 수호가 대신 받는다(TANK_COVER, 대신 받는 몫은 TANK_COVER_DR만큼 경감)
  function cover(st, a, d, dmg) {
    if (!C.TANK_AURA && !C.TANK_COVER) return dmg;
    let tk = null; for (const h of st.heroes) if (h.role === 'tank' && !h.dead && (!tk || h.hp / h.maxHp > tk.hp / tk.maxHp)) tk = h;
    if (!tk) return dmg;
    if (C.TANK_AURA) dmg = Math.round(dmg * (1 - C.TANK_AURA));
    if (C.TANK_COVER) { const share = Math.round(dmg * C.TANK_COVER); dmg -= share; let td = Math.round(share * (1 - (C.TANK_COVER_DR || 0)));
      if (tk.shield > 0) { const ab = Math.min(tk.shield, td); tk.shield -= ab; td -= ab; }
      if (td > 0) { tk.hp = Math.max(0, tk.hp - td); tk._tk = (tk._tk || 0) + td; if (tk.hp <= 0 && !tk.dead) kill(st, tk, a); } }
    return dmg;
  }
  function fmtN(n) { return C.fmt(n); }
  function heal(st, src, tgt, v) { v = Math.round(v); if (v <= 0) return; tgt.hp = Math.min(tgt.maxHp, tgt.hp + v); text(st, tgt.x, tgt.y - 30, '+' + fmtN(v), 'heal'); }
  function kill(st, d, by) {
    if (d.kind === 'mob' && d.boss && st.params && st.params.mode === 'raid') { d.hp = 1; return; }   // 레이드 보스는 죽지 않는다(제한 시간 동안 피해량 경쟁)
    d.dead = true; d.deadT = 0.35;
    if (d.kind === 'mob') {
      if (d.boss) { st.events.push({ t: 'bosskill', x: d.x, y: d.y - 24, elem: d.elem, gim: d.gim }); st.boss = null; st.phase = 'won'; }
      else { st.kills++; st.events.push({ t: 'kill' }); fx(st, { type: 'poof', x: d.x, y: d.y - 12, ttl: 0.35, hue: d.hue }); fx(st, { type: 'shards', x: d.x, y: d.y - 14, ttl: 0.5, n: 7, elem: d.elem }); }
    } else { fx(st, { type: 'poof', x: d.x, y: d.y - 14, ttl: 0.4 }); text(st, d.x, d.y - 30, d.name + ' 쓰러짐', 'enemy'); st.events.push({ t: 'herodown', uid: d.uid }); }
  }
  function nearest(from, list) { let best = null, bd = Infinity; for (const u of list) { const d = dist(from, u); if (d < bd) { bd = d; best = u; } } return best; }
  function foesInRange(st, u, r) { return alive(u.kind === 'hero' ? st.mobs : st.heroes).filter(f => dist(u, f) <= r); }

  function slowOn(st, u, d, t) {   // 둔화. 서리 영웅이 건 둔화는 빙결(폭주 기믹의 답)도 함께 — 2026-11-20
    d.b.slowT = Math.max(d.b.slowT, t); if (d.boss && u && u.kind === 'hero') grog(st, d, u.elem === 'water' ? 'freeze' : 'slow');
    if (u && u.kind === 'hero' && u.elem === 'water') { d.b.frzT = Math.max(d.b.frzT || 0, t); tag(d, 'frzT', t); }
  }
  function applyDeb(st, u, d, k) {   // 속성 디버프 1종 걸기(일반 스킬 fx와 같은 세기·지속) — 파훼 지원 버프용
    const DB = C.ELEM_DEB;
    if (k === 'burn') { d.b.burn = Math.max(d.b.burnT > 0 ? d.b.burn : 0, dotV(u, d, DB.burn, 'burn')); d.b.burnT = Math.max(d.b.burnT || 0, 3); tag(d, 'burnT'); d.b.burnTick = d.b.burnTick || 0; armorBreak(st, d); }
    else if (k === 'freeze' || k === 'slow') slowOn(st, u, d, 3);
    else if (k === 'combo') { d.b.comboT = Math.max(d.b.comboT || 0, 3); tag(d, 'comboT'); }
    else if (k === 'blind') { d.b.blindT = Math.max(d.b.blindT || 0, 3); tag(d, 'blindT'); if (d.boss) interrupt(st, d); }
    else if (k === 'bleed') bleedOn(st, u, d, 3, 1);
  }
  function bleedOn(st, u, d, t, mul) { const DB = C.ELEM_DEB; d.b.bleed = Math.max(d.b.bleedT > 0 ? d.b.bleed : 0, dotV(u, d, DB.bleed * (mul || 1), 'bleed')); d.b.bleedT = Math.max(d.b.bleedT || 0, t || 3); tag(d, 'bleedT', t); d.b.bleedTick = d.b.bleedTick || 0; d.b.vuln = Math.max(d.b.vulnT > 0 ? d.b.vuln : 0, DB.bleedVuln); d.b.vulnT = Math.max(d.b.vulnT || 0, t || 3); armorBreak(st, d); }
  function castOnce(st, u, sk, tgt) {
    const isHero = u.kind === 'hero';
    const mates = alive(isHero ? st.heroes : st.mobs);
    const R = sk.type === 'aoe' || sk.type === 'debuffdef' || sk.type === 'vulnall' || sk.type === 'debuffatk' || sk.type === 'slowall' ? (u.range > 60 ? 120 : 95) : u.range + 6;
    let fxDone = false;
    const applyFx = (d, dealt) => {
      if (!sk.fx) return;
      if (!d || !C.ELEM_DEBUFFS.includes(sk.fx)) return; fxDone = true; const DB = C.ELEM_DEB;
      if (sk.fx === 'burn') { d.b.burn = Math.max(d.b.burnT > 0 ? d.b.burn : 0, dotV(u, d, DB.burn, 'burn')); d.b.burnT = 3; tag(d, 'burnT'); d.b.burnTick = 0; }
      if (sk.fx === 'freeze' || sk.fx === 'slow') slowOn(st, u, d, 3);
      if (sk.fx === 'combo') { d.b.comboT = Math.max(d.b.comboT || 0, 3); tag(d, 'comboT'); }
      if (sk.fx === 'blind') { d.b.blindT = Math.max(d.b.blindT || 0, 3); tag(d, 'blindT'); if (d.boss) interrupt(st, d); }
      if (sk.fx === 'bleed') { d.b.bleed = Math.max(d.b.bleedT > 0 ? d.b.bleed : 0, dotV(u, d, DB.bleed, 'bleed')); d.b.bleedT = 3; tag(d, 'bleedT'); d.b.bleedTick = d.b.bleedTick || 0; d.b.vuln = Math.max(d.b.vulnT > 0 ? d.b.vuln : 0, DB.bleedVuln); d.b.vulnT = Math.max(d.b.vulnT || 0, 3); armorBreak(st, d); }
      if (sk.fx === 'vuln' && d) { d.b.vuln = Math.max(d.b.vulnT > 0 ? d.b.vuln : 0, 0.2); d.b.vulnT = Math.max(d.b.vulnT || 0, 3); }   // 어둠 표식(2026-11-16, 흡혈 대체 — 흡혈은 측정 효과 0): 받는 피해 20%↑ 3초(세기·지속 배율 적용 → 6.7% 9초)
    };
    let ok = true;
    switch (sk.type) {
      case 'single': { if (!tgt) return false; fx(st, { type: 'slash', x: tgt.x, y: tgt.y - 14, ttl: 0.25, elem: u.elem }); const v = hit(st, u, tgt, sk.mult, true); applyFx(tgt, v); break; }
      case 'multi': { if (!tgt) return false; let tot = 0; for (let i = 0, nh = sk.hits + (sk.tr && sk.tr.k === 'aspdhits' && u.b.aspdT > 0 && u.b.aspd > 0 ? sk.tr.v : 0); i < nh; i++) { if (tgt.dead) tgt = nearest(u, foesInRange(st, u, u.range + 10)); if (!tgt) break; fx(st, { type: 'slash', x: tgt.x + (i - 1) * 6, y: tgt.y - 14, ttl: 0.25, elem: u.elem }); tot += hit(st, u, tgt, sk.mult, true); } applyFx(tgt, tot); break; }
      case 'aoe': { const fs = foesInRange(st, u, R); if (!fs.length) return false; fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: R, ttl: 0.45, elem: u.elem }); let tot = 0; for (const f of fs) { tot += hit(st, u, f, sk.mult, true); if (sk.stun) stun(st, f, sk.stun); if (sk.fx === 'burn' || sk.fx === 'slow' || sk.fx === 'vuln') applyFx(f, 0); } if (sk.fx === 'drain') applyFx(null, tot); break; }
      case 'bash': { if (!tgt) return false; fx(st, { type: 'slash', x: tgt.x, y: tgt.y - 14, ttl: 0.25, elem: u.elem }); const v = hit(st, u, tgt, sk.mult, true); { const sd = sk.stun || 1.2; if (stun(st, tgt, sd)) fx(st, { type: 'stun', x: tgt.x, y: tgt.y - 36, ttl: sd }); } applyFx(tgt, v); break; }
      case 'taunt': case 'guard': { // 수호 공통 자기 강화: 방어력↑ + 변형(주변 피해 / 자가 회복). 적은 항상 수호를 노리므로 도발 없음
        u.b.def = Math.max(u.b.def, sk.defUp == null ? 0.5 : sk.defUp); u.b.defT = sk.dur || 6;
        fx(st, { type: 'aura', x: u.x, y: u.y - 12, r: 34, ttl: 0.6, elem: u.elem });
        const near = foesInRange(st, u, 70);
        if (sk.mult > 0) { fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: 70, ttl: 0.4, elem: u.elem }); for (const f of near) hit(st, u, f, sk.mult, true); }
        if (sk.selfHeal) heal(st, u, u, u.maxHp * sk.selfHeal);
        if (C.GUARD_TEAM_DR) for (const m of mates) if (m !== u) { m.b.gdr = Math.max(m.b.gdrT > 0 ? m.b.gdr : 0, C.GUARD_TEAM_DR); m.b.gdrT = C.GUARD_TEAM_DUR; fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 22, ttl: 0.5, elem: u.elem }); }   // 수호의 보호: 다른 아군 받는 피해 감소
        if (C.ELEM_DEBUFFS.includes(sk.fx)) for (const f of near) applyFx(f, 0);
        break; }
      case 'heal': { const low = mates.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (!low || low.hp / low.maxHp > 0.85) { if (isHero && C.ELEM_DEBUFFS.includes(sk.fx) && st.boss && !st.boss.dead) break; return false; } fx(st, { type: 'healfx', x: low.x, y: low.y - 14, ttl: 0.6 }); heal(st, u, low, effAtk(u) * sk.mult * (1 + u.healBonus)); break; }
      case 'healall': { if (!sk.team && !mates.some(m => m.hp / m.maxHp < 0.9)) { if (isHero && C.ELEM_DEBUFFS.includes(sk.fx) && st.boss && !st.boss.dead) break; return false; }   /* 2026-11-20: 파훼 디버프가 달린 회복은 보스전이면 다친 아군이 없어도 써서 디버프를 건다 */ for (const m of mates) { fx(st, { type: 'healfx', x: m.x, y: m.y - 14, ttl: 0.6 }); heal(st, u, m, effAtk(u) * sk.mult * (1 + u.healBonus)); } break; }
      case 'buffatk': { for (const m of mates) { m.b.atk = Math.max(m.b.atk, sk.mult); m.b.atkT = sk.dur || 5; fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 26, ttl: 0.5, elem: 'light' }); } break; }
      case 'buffaspd': { for (const m of mates) { m.b.aspd = Math.max(m.b.aspd, sk.mult); m.b.aspdT = sk.dur || 5; fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 26, ttl: 0.5, elem: 'wind' }); } break; }
      case 'debuffdef': { const fs = foesInRange(st, u, R); if (!fs.length) return false; fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: R, ttl: 0.45, elem: u.elem }); for (const f of fs) { f.b.def = Math.min(f.b.def, -sk.mult); f.b.defT = sk.dur || 5; armorBreak(st, f); } break; }
      case 'guardall': { for (const m of mates) { m.b.def = Math.max(m.b.def, sk.mult); m.b.defT = sk.dur || 5; fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 26, ttl: 0.5, elem: u.elem }); } break; }
      case 'vulnall': { const fs = foesInRange(st, u, R); if (!fs.length) return false; fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: R, ttl: 0.45, elem: u.elem }); for (const f of fs) { f.b.vuln = Math.max(f.b.vulnT > 0 ? f.b.vuln : 0, sk.mult); f.b.vulnT = Math.max(f.b.vulnT || 0, sk.dur || 5); armorBreak(st, f); } break; }   // 받는 피해↑(화염의 낙인, 2026-11-16)
      case 'debuffatk': { const fs = foesInRange(st, u, R); if (!fs.length) return false; fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: R, ttl: 0.45, elem: 'dark' }); for (const f of fs) { f.b.atk = Math.min(f.b.atk, -sk.mult); f.b.atkT = sk.dur || 5; if (sk.blind) { f.b.blindT = Math.max(f.b.blindT || 0, sk.blind); tag(f, 'blindT'); if (f.boss) interrupt(st, f); } } break; }
      case 'slowall': { const fs = foesInRange(st, u, R); if (!fs.length) return false; fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: R, ttl: 0.45, elem: 'water' }); for (const f of fs) { slowOn(st, u, f, sk.dur || 4); f.b.slow = Math.max(f.b.slowT > 0 ? f.b.slow || 0 : 0, sk.slow || 0.3); } break; }
      case 'roar': { const fs = foesInRange(st, u, 110); if (!fs.length) return false; fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: 110, ttl: 0.5, elem: 'fire' }); for (const f of fs) hit(st, u, f, sk.mult * (u.roarM || 1), true); break; }
      // ---------- ★3 고유 스킬 ----------
      case 'chain': { if (!tgt) return false; const foes = alive(isHero ? st.mobs : st.heroes); let cur = tgt; const seen = new Set(); const pts = [{ x: u.x, y: u.y - 18 }];
        for (let i = 0; i < sk.n && cur; i++) { seen.add(cur); pts.push({ x: cur.x, y: cur.y - 14 }); hit(st, u, cur, sk.mult * (1 - i * 0.08), true); cur = nearest(cur, foes.filter(f => !seen.has(f) && !f.dead && dist(f, cur) < 120)); }
        fx(st, { type: 'bolt', pts, ttl: 0.4, elem: u.elem }); break; }
      case 'meteor': { if (!tgt) return false; const cx = tgt.x, cy = tgt.y; const fs = alive(isHero ? st.mobs : st.heroes).filter(f => Math.hypot(f.x - cx, f.y - cy) <= sk.r); fx(st, { type: 'burst', x: cx, y: cy - 10, r: sk.r, ttl: 0.55, elem: u.elem });
        for (const f of fs) { hit(st, u, f, sk.mult, true); if (sk.burn) { f.b.burn = Math.max(f.b.burnT > 0 ? f.b.burn : 0, dotV(u, f, C.ELEM_DEB.burn, 'burn')); f.b.burnT = 3; tag(f, 'burnT'); f.b.burnTick = 0; } } break; }
      case 'execute': { if (!tgt) return false; const low = tgt.hp / tgt.maxHp <= sk.th; fx(st, { type: 'slash', x: tgt.x, y: tgt.y - 14, ttl: 0.35, elem: u.elem, big: true }); const v = hit(st, u, tgt, sk.mult * (low ? 2 : 1), true); if (low) text(st, tgt.x, tgt.y - 40, '처형!', 'crit'); if (sk.drain) heal(st, u, u, v * sk.drain); break; }
      case 'whirl': { const fs = foesInRange(st, u, sk.r); if (!fs.length) return false; for (let i = 0, nh = sk.hits + (sk.tr && sk.tr.k === 'slowhits' && fs.some(f => f.b.slowT > 0) ? sk.tr.v : 0); i < nh; i++) { fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: sk.r * (0.6 + i * 0.1), ttl: 0.25 + i * 0.07, elem: u.elem }); for (const f of fs) if (!f.dead) hit(st, u, f, sk.mult, true); } break; }
      case 'shield': { for (const m of mates) { m.shield = Math.max(m.shield, m.maxHp * sk.pct); m.shieldT = sk.sdur || 8; m.reflect = sk.reflect || 0; if (sk.heal) heal(st, u, m, effAtk(u) * sk.heal * (1 + u.healBonus)); fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 28, ttl: 0.6, elem: u.elem }); } if (sk.selfDef) { u.b.def = Math.max(u.b.def, sk.selfDef); u.b.defT = sk.dur || 6; } break; }
      case 'resurrect': { const dead = isHero ? st.heroes.filter(h => h.dead) : []; if (dead.length) { for (const h of dead) { h.dead = false; h.hp = Math.round(h.maxHp * (sk.revHp || 0.5)); h.x = u.x - 14; h.y = u.y + 8; fx(st, { type: 'healfx', x: h.x, y: h.y - 14, ttl: 0.8 }); text(st, h.x, h.y - 34, '부활!', 'heal'); } }
        else { if (!mates.some(m => m.hp / m.maxHp < 0.85)) return false; for (const m of mates) { fx(st, { type: 'healfx', x: m.x, y: m.y - 14, ttl: 0.6 }); heal(st, u, m, effAtk(u) * sk.mult * (1 + u.healBonus)); } } fx(st, { type: 'burst', x: u.x, y: u.y - 12, r: 70, ttl: 0.6, elem: 'light' }); break; }
      case 'sanctuary': { for (const m of mates) { m.b.hot = effAtk(u) * sk.mult * (1 + u.healBonus); m.b.hotT = 5; m.b.hotTick = 0; m.b.def = Math.max(m.b.def, sk.def || 0.3); m.b.defT = 5; } fx(st, { type: 'burst', x: u.x, y: u.y - 12, r: 90, ttl: 0.7, elem: 'light' }); break; }
      case 'mark': { const fs = foesInRange(st, u, 120); if (!fs.length) return false; for (const f of fs) { f.b.vuln = Math.max(f.b.vuln, sk.pct); f.b.vulnT = sk.dur || 6; armorBreak(st, f); fx(st, { type: 'stun', x: f.x, y: f.y - 38, ttl: 1.0, glyph: '᛭' }); } fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: 120, ttl: 0.5, elem: u.elem }); break; }
      case 'plague': { const fs = foesInRange(st, u, 120); if (!fs.length) return false; for (const f of fs) { f.b.psn = Math.max(f.b.psnT > 0 ? f.b.psn : 0, dotV(u, f, C.ELEM_DEB.burn * (sk.dotMul || 1), 'psn')); f.b.psnT = 3; f.b.psnTick = 0; if (sk.hVuln) { f.b.vuln = Math.max(f.b.vuln, sk.hVuln); f.b.vulnT = 5; armorBreak(st, f); } if (sk.hSlow) slowOn(st, u, f, sk.hSlow); } fx(st, { type: 'burst', x: u.x, y: u.y - 10, r: 120, ttl: 0.6, elem: 'dark' }); break; }
      case 'line': { if (!tgt) return false; const dx = tgt.x - u.x, dy = tgt.y - u.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        const fs = alive(isHero ? st.mobs : st.heroes).filter(f => { const px = f.x - u.x, py = f.y - u.y, t = px * ux + py * uy, perp = Math.abs(px * uy - py * ux); return t >= -10 && t <= sk.len && perp <= sk.w / 2; });
        fx(st, { type: 'beam', x: u.x, y: u.y - 14, x2: u.x + ux * sk.len, y2: u.y - 14 + uy * sk.len, w: sk.w, ttl: 0.4, elem: u.elem });
        for (const f of fs) { hit(st, u, f, sk.mult, true); if (sk.burn) { f.b.burn = Math.max(f.b.burnT > 0 ? f.b.burn : 0, dotV(u, f, C.ELEM_DEB.burn, 'burn')); f.b.burnT = 3; tag(f, 'burnT'); f.b.burnTick = 0; } }
        if (sk.buff) for (const m of mates) { m.b.atk = Math.max(m.b.atk, sk.buff); m.b.atkT = sk.dur || 5; } break; }
      case 'nova': { const fs = foesInRange(st, u, sk.r); if (!fs.length) return false; fx(st, { type: 'burst', x: u.x, y: u.y - 10, r: sk.r, ttl: 0.5, elem: u.elem });
        for (const f of fs) { hit(st, u, f, sk.mult, true); if (sk.burn) { f.b.burn = Math.max(f.b.burnT > 0 ? f.b.burn : 0, dotV(u, f, C.ELEM_DEB.burn, 'burn')); f.b.burnT = 3; tag(f, 'burnT'); f.b.burnTick = 0; } if (f.boss && sk.kb) grog(st, f, 'strong'); if (!f.boss && sk.kb) { const d = dist(u, f) || 1; f.x += (f.x - u.x) / d * sk.kb; f.y += (f.y - u.y) / d * sk.kb; } if (sk.stun && stun(st, f, sk.stun)) fx(st, { type: 'stun', x: f.x, y: f.y - 36, ttl: sk.stun }); }
        if (sk.selfDef) { u.b.def = Math.max(u.b.def, sk.selfDef); u.b.defT = sk.dur || 6; } break; }   // stun·selfDef: 108 마그나(2026-11-19)
      case 'dive': { const foes = alive(isHero ? st.mobs : st.heroes); if (!foes.length) return false; let best = foes[0], bn = -1; for (const f of foes) { const n = foes.filter(o => dist(o, f) < sk.r).length; if (n > bn) { bn = n; best = f; } }
        fx(st, { type: 'beam', x: u.x, y: u.y - 14, x2: best.x, y2: best.y - 14, w: 8, ttl: 0.25, elem: u.elem }); u.x = best.x - 12 * (best.x >= u.x ? 1 : -1); u.y = best.y; clamp(u);
        fx(st, { type: 'burst', x: best.x, y: best.y - 10, r: sk.r, ttl: 0.5, elem: u.elem });
        for (const f of foes.filter(o => dist(o, best) <= sk.r)) { hit(st, u, f, sk.mult, true); if (sk.stun) stun(st, f, sk.stun); } break; }
      case 'timestop': { const fs = foesInRange(st, u, sk.r); if (!fs.length) return false; fx(st, { type: 'burst', x: u.x, y: u.y - 10, r: sk.r, ttl: 0.7, elem: 'water' }); for (const f of fs) { if (sk.hard) { f.b.stunT = Math.max(f.b.stunT, f.boss ? 1 : sk.dur); if (f.boss) stun(st, f, 1); } slowOn(st, u, f, sk.dur); hit(st, u, f, sk.mult, true); } break; }   /* 2026-11-25: 기본은 빙결(둔화)만 — 전용장비(hard)일 때만 기절(하드 CC) */   /* 서리의 동결(절대영도 등) = 빙결 */
      case 'vortex': { if (!tgt) return false; const cx = tgt.x, cy = tgt.y; const fs = alive(isHero ? st.mobs : st.heroes).filter(f => Math.hypot(f.x - cx, f.y - cy) <= sk.r); fx(st, { type: 'vortex', x: cx, y: cy - 10, r: sk.r * 0.6, ttl: 0.8, elem: u.elem });
        for (const f of fs) { if (!f.boss) { f.x += (cx - f.x) * 0.75; f.y += (cy - f.y) * 0.75; } else if (isHero) grog(st, f, 'strong'); if (!sk.noSlow) slowOn(st, u, f, 3); hit(st, u, f, sk.mult, true); } break; }
      case 'berserk': { if (!tgt) return false; if (sk.sac) { u.bzT = (sk.dur || 6) * (C.BUFF_DUR || 1); u.sacAcc = 0; u.sacP = sk.sac; } else if (!sk.noCost) u.hp = Math.max(1, u.hp - u.maxHp * 0.1); u.b.atk = Math.max(u.b.atk, sk.atk); u.b.atkT = sk.dur || 6; u.b.aspd = Math.max(u.b.aspd, sk.aspd); u.b.aspdT = sk.dur || 6; fx(st, { type: 'aura', x: u.x, y: u.y - 12, r: 34, ttl: 0.8, elem: 'fire' }); break; }
      case 'bless': { for (const m of mates) { heal(st, u, m, effAtk(u) * sk.mult * (1 + u.healBonus)); m.b.atk = Math.max(m.b.atk, sk.buff || 0); m.b.atkT = sk.dur || 5; if (sk.def) { m.b.def = Math.max(m.b.def, sk.def); m.b.defT = sk.dur || 5; } fx(st, { type: 'healfx', x: m.x, y: m.y - 14, ttl: 0.6 }); } fx(st, { type: 'burst', x: u.x, y: u.y - 12, r: 80, ttl: 0.6, elem: 'light' }); break; }
      case 'anthem': { for (const m of mates) { m.b.atk = Math.max(m.b.atk, sk.atk); m.b.atkT = sk.dur || 6; m.b.aspd = Math.max(m.b.aspd, sk.aspd); m.b.aspdT = sk.dur || 6; for (const q of ['skl', 'cdm']) if (sk[q]) { m.b[q] = Math.max(m.b[q + 'T'] > 0 ? m.b[q] || 0 : 0, sk[q]); m.b[q + 'T'] = Math.max(m.b[q + 'T'] || 0, sk.dur || 6); }   /* 2026-11-21 버프 지원 궁극기: 스킬 피해·치명타 피해 */ fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 28, ttl: 0.6, elem: 'wind' }); if (sk.heal) { heal(st, u, m, effAtk(u) * sk.heal * (1 + u.healBonus)); fx(st, { type: 'healfx', x: m.x, y: m.y - 14, ttl: 0.6 }); } } break; }
      default: ok = false;
    }
    if (ok && isHero && !fxDone && C.ELEM_DEBUFFS.includes(sk.fx)) { const tg = tgt && !tgt.dead && tgt.kind !== 'hero' ? tgt : st.boss && !st.boss.dead ? st.boss : alive(st.mobs)[0]; if (tg) applyFx(tg, 0); }   // 적을 치지 않는 스킬(회복·버프 등)도 디버프형이면 지금 대상(없으면 보스)에게 건다
    return ok;
  }

  // 스킬 시전 래퍼: 전용장비 특수 옵션(반복 시전·적중 효과·시전 후 효과)을 처리한다
  function castSkill(st, u, sk, tgt) {
    const isHero = u.kind === 'hero'; u._ult = !!sk.ult; u._sk = sk; if (isHero) { SRC = u.id; SKCD = sk.cd || 0; CHN = []; } EAT = sk.eat ? [] : null;
    let ok = castOnce(st, u, sk, tgt);
    if (ok && sk.team && isHero) { const [k, v, dur] = sk.team; for (const m of alive(st.heroes)) { m.b[k] = Math.max(m.b[k + 'T'] > 0 ? m.b[k] || 0 : 0, v); m.b[k + 'T'] = Math.max(m.b[k + 'T'] || 0, dur); } }   // 지원 1번의 아군 공격 효과(2026-11-16): [능력치 칸, 세기, 지속] — skl 스킬 피해 · cdm 치명타 피해 · atk 공격력
    if (ok && sk.repeat > 1) { const foes = alive(u.kind === 'hero' ? st.mobs : st.heroes); for (let i = 1; i < sk.repeat && foes.length; i++) { const t2 = foes[Math.floor(st.rng() * foes.length)]; if (!t2.dead) castOnce(st, u, sk, t2); } }
    if (EAT) { const done = new Set(); for (const [d, f] of EAT) { const key = d.uid + f; if (done.has(key)) continue; done.add(key); const n = d.b[f] || 0;   // 터뜨리는 딜러(eat): 시전이 끝나면 대상의 중첩을 소모 — 빛·서리는 중첩 수만큼 천벌·동결을 즉시 발동(2026-11-25 사용자 '중첩 수만큼 즉시 발동')
      if (n > 0 && !d.dead) { if (f === 'blindN') smite(st, d, n / C.STACK.max * (C.STACK.burstSmite || 1)); else if (f === 'frzN') iceOn(st, d, C.STACK.iceT * n / C.STACK.max * (C.STACK.burstIce || 1)); }
      d.b[f] = 0; d.b[f + 'Lk'] = NOW + (C.STACK.eatLock || 0); } EAT = null; }   // 소모형: 시전이 끝나면 중첩을 1로(디버프 자체는 남음 — 기믹 파훼 유지)
    if (isHero) { if (CHN) { for (const d of CHN) d.chainT = 0; CHN = null; }
      const t = TR(u); if (t && t.k === 'wave' && sk.sig) { u._wave = u._waveHit || 0; u._waveHit = 0; }
      if (ok) for (const h of st.heroes) { const ht = h !== u && !h.dead && TR(h); if (ht && ht.k === 'allycdr') for (const k of h.skills) k.ready -= ht.v; } }   // 로웨나: 아군이 스킬을 쓸 때마다 쿨 감소
    u._ult = false; u._sk = null;
    if (ok && u.kind === 'hero') postFx(st, u, sk);
    if (ok && sk.fx && C.ELEM_TEAM[sk.fx]) {   // 1번 스킬 속성 부가 효과 = 아군 전체 버프(2026-11-17 사용자: 화염 공격력 · 서리 스킬 피해(+둔화) · 질풍 공속 · 빛 치명타 피해 · 어둠 치명타 확률). 시전 성공 시 살아 있는 아군 전원, 4초(세기 ÷3·지속 ×3)
      const k = C.ELEM_TEAM[sk.fx], v = C.ELEM_FX[sk.fx];
      for (const m of (isHero ? alive(st.heroes) : [u])) { if (!(m.b[k + 'T'] > 0) || (m.b[k] || 0) < v) m.b[k] = v; m.b[k + 'T'] = Math.max(m.b[k + 'T'] || 0, 4); } }
    if (isHero) SKCD = 0;
    if (ok) { u.atkAt = st.t; st.events.push({ t: 'skill', uid: u.uid, hid: u.id, sk, name: sk.name, main: !!u.isMain, sig: !!sk.sig, ult: isHero && !!sk.ult, elem: u.elem, who: u.name }); if (sk.ult && isHero) { st.shake = Math.max(st.shake || 0, 0.2); text(st, u.x, u.y - 50, sk.name.replace(/^(진·|각성·)/, ''), 'sig'); } else if (sk.sig) { st.shake = Math.max(st.shake || 0, 0.25); text(st, u.x, u.y - 50, sk.name, 'sig'); } else if (u.isMain) text(st, u.x, u.y - 44, sk.name, 'skill'); }
    return ok;
  }
  function postFx(st, u, sk) {
    const mates = alive(st.heroes); const ha = effAtk(u) * (1 + (u.healBonus || 0));
    if (sk.postHeal) for (const m of mates) { heal(st, u, m, ha * sk.postHeal); fx(st, { type: 'healfx', x: m.x, y: m.y - 14, ttl: 0.6 }); }
    if (sk.postShield) for (const m of mates) { m.shield = Math.max(m.shield, m.maxHp * sk.postShield); m.shieldT = 8; fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 28, ttl: 0.6, elem: u.elem }); }
    if (sk.postAtk) for (const m of mates) { m.b.atk = Math.max(m.b.atk, sk.postAtk); m.b.atkT = 7; }
    if (sk.postAspd) for (const m of mates) { m.b.aspd = Math.max(m.b.aspd, sk.postAspd); m.b.aspdT = 7; }
    if (sk.postCdr) for (const m of mates) for (const k of m.skills) k.ready -= sk.postCdr;
    if (sk.grant) for (const m of mates) { m.b.gfx = sk.grant; m.b.gfxT = sk.gdur || C.GRANT.dur; m.b.gfxBy = u.id; fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 28, ttl: 0.6, elem: u.elem }); }
    if (sk.lsBuff) { u.lsBuff = sk.lsBuff; u.lsBuffT = sk.dur || 7; }
    if (sk.postNova) { const n = sk.postNova; const fs = foesInRange(st, u, n.r); fx(st, { type: 'burst', x: u.x, y: u.y - 10, r: n.r, ttl: 0.55, elem: u.elem });
      for (const f of fs) { if (n.mult) hit(st, u, f, n.mult, true); if (n.stun) stun(st, f, n.stun); if (n.burn) { f.b.burn = Math.max(f.b.burnT > 0 ? f.b.burn : 0, dotV(u, f, C.ELEM_DEB.burn, 'burn')); f.b.burnT = 3; tag(f, 'burnT'); f.b.burnTick = 0; } if (n.bleed) bleedOn(st, u, f, n.bleedT || 3, n.bleedMul || 1); if (n.vuln) { f.b.vuln = Math.max(f.b.vulnT > 0 ? f.b.vuln : 0, n.vuln); f.b.vulnT = Math.max(f.b.vulnT || 0, n.vulnT || 5); } if (n.blind) { f.b.blindT = Math.max(f.b.blindT || 0, n.blind); tag(f, 'blindT'); if (f.boss) interrupt(st, f); } } }
    // 2026-11-20 신규 ★3 20인용: 적 전체 둔화 · 아군(또는 자신) 받는 피해 감소(gdr — 세기·지속 배율 규칙 그대로)
    if (sk.postSlow) { for (const f of foesInRange(st, u, 220)) { slowOn(st, u, f, sk.postSlow); f.b.slow = Math.max(f.b.slow || 0, 0.3); } fx(st, { type: 'ring', x: u.x, y: u.y - 10, r: 120, ttl: 0.45, elem: 'water' }); }
    if (sk.postDr) { const [v, d] = sk.postDr; for (const m of (sk.drSelf ? [u] : mates)) { m.b.gdr = Math.max(m.b.gdrT > 0 ? m.b.gdr : 0, v); m.b.gdrT = Math.max(m.b.gdrT || 0, d); fx(st, { type: 'aura', x: m.x, y: m.y - 12, r: 24, ttl: 0.5, elem: u.elem }); } }
  }

  function tickBuffs(st, u, dt) {
    const b = u.b, K = C.BUFF_DUR || 1, bd = dt / K, dk = BW();   // 지속 타이머는 1/배율 속도로 줄어듦(C.BUFF_DUR) — 저장된 값은 스킬 정의의 수치, 실제 지속 = 값 × 배율. 화상·회복은 실제 1초마다 틱당 × 세기 배율(총량 유지). 기절은 세기가 없어 지속도 그대로
    if (b.atkT > 0 && (b.atkT -= bd) <= 0) b.atk = 0;
    if (b.defT > 0 && (b.defT -= bd) <= 0) b.def = 0;
    if (b.aspdT > 0 && (b.aspdT -= bd) <= 0) b.aspd = 0;
    if (b.slowT > 0) { b.slowT -= bd; if (b.slowT <= 0) b.slow = 0; } if (b.gdrT > 0) b.gdrT -= bd; if (b.stunT > 0) b.stunT -= dt; if (b.tauntT > 0) b.tauntT -= bd;
    if (u.bzT > 0 && (u.bzT -= dt) <= 0) u.sacAcc = 0;
    if (u.kind === 'mob') { if (u.chainT > 0) u.chainT -= dt; if (u.iceT > 0) u.iceT -= dt; if (b.burnN && !(b.burnT > 0)) b.burnN = 0; if (b.bleedN && !(b.bleedT > 0)) b.bleedN = 0; if (b.vsT > 0 && (b.vsT -= bd) <= 0) b.vsN = 0; if (b.blindN && !(b.blindT > 0)) b.blindN = 0; if (b.frzN && !(b.frzT > 0)) b.frzN = 0; }
    if (u.boss && C.GROGGY) { if (u.grgT > 0) u.grgT -= dt; else if (u.grg > 0) u.grg = Math.max(0, u.grg - C.GROGGY.decay * dt); }
    if (b.vulnT > 0 && (b.vulnT -= bd) <= 0) b.vuln = 0;
    if (b.sklT > 0 && (b.sklT -= bd) <= 0) b.skl = 0; if (b.comboT > 0) b.comboT -= bd; if (b.gfxT > 0) b.gfxT -= bd; if (b.frzT > 0) b.frzT -= bd; if (b.blindT > 0) b.blindT -= bd; if (b.crtT > 0 && (b.crtT -= bd) <= 0) b.crt = 0; if (b.cdmT > 0 && (b.cdmT -= bd) <= 0) b.cdm = 0;
    if (u.shieldT > 0 && (u.shieldT -= bd) <= 0) { u.shield = 0; u.reflect = 0; }
    if (u.lsBuffT > 0) u.lsBuffT -= bd;
    if (b.hotT > 0) { b.hotT -= bd; b.hotTick += dt; if (b.hotTick >= 1) { b.hotTick -= 1; heal(st, u, u, b.hot * dk); } }
    if (b.bleedT > 0) { b.bleedT -= bd; b.bleedTick += dt; if (b.bleedTick >= 1) { b.bleedTick -= 1; const lk = u.gim ? gimLeak(u) : 1; if (lk > 0) { const v = Math.max(1, Math.round(b.bleed * dk * lk * (b.vulnT > 0 ? 1 + b.vuln * dk : 1) * takeAmp(u) * (C.STACK ? 1 + (C.STACK.dotB != null ? C.STACK.dotB : C.STACK.dot) * effN(b.bleedN) : 1))); u.hp = Math.max(0, u.hp - v); if (u.kind === 'mob') { st.dmgDealt += v; const by = b.bleedBy; if (by && by.kind === 'hero') by.dmgOut = (by.dmgOut || 0) + v; } text(st, u.x, u.y - 26, fmtN(v), 'burn'); if (u.hp <= 0 && !u.dead) kill(st, u, null); } } }
    if (b.burnT > 0) { b.burnT -= bd; b.burnTick += dt; if (b.burnTick >= 1) { b.burnTick -= 1; const lk = u.gim ? gimLeak(u) : 1; if (lk > 0) { const v = Math.max(1, Math.round(b.burn * dk * lk * (b.vulnT > 0 ? 1 + b.vuln * dk : 1) * takeAmp(u) * (C.STACK ? 1 + C.STACK.dot * effN(b.burnN) : 1))); u.hp = Math.max(0, u.hp - v); if (u.kind === 'mob') { st.dmgDealt += v; const by = b.burnBy; if (by && by.kind === 'hero') by.dmgOut = (by.dmgOut || 0) + v; } text(st, u.x, u.y - 26, '🔥' + fmtN(v), 'burn'); if (u.hp <= 0 && !u.dead) kill(st, u, null); } } }
    if (b.psnT > 0) { b.psnT -= bd; b.psnTick += dt; if (b.psnTick >= 1) { b.psnTick -= 1; const lk = u.gim ? gimLeak(u) : 1; if (lk > 0) { const v = Math.max(1, Math.round(b.psn * dk * lk * (b.vulnT > 0 ? 1 + b.vuln * dk : 1) * takeAmp(u))); u.hp = Math.max(0, u.hp - v); if (u.kind === 'mob') { st.dmgDealt += v; const by = b.psnBy; if (by && by.kind === 'hero') by.dmgOut = (by.dmgOut || 0) + v; } text(st, u.x, u.y - 26, '☠' + fmtN(v), 'burn'); if (u.hp <= 0 && !u.dead) kill(st, u, null); } } }   // 중독(사령왕 역병) — 2026-11-20 화상과 분리: 화상만 철갑을 벗김
  }
  function moveToward(u, tx, ty, speed, dt, stopAt) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy); if (d <= stopAt) return;
    const step = Math.min(d - stopAt, speed * dt); u.x += dx / d * step; u.y += dy / d * step; if (Math.abs(dx) > 1) u.facing = dx > 0 ? 1 : -1;
  }
  function clamp(u) { u.x = Math.max(u.x < 14 ? u.x : 14, Math.min(W - 14, u.x)); u.y = Math.max(20, Math.min(H - 12, u.y)); }
  function clampMob(u) { u.x = Math.max(16, Math.min(W - 16, u.x)); u.y = Math.max(22, Math.min(H - 14, u.y)); }

  function heroAct(st, u, dt) {
    if (u.dead) return;   // 자동 부활 없음 — 부활은 스킬(월광의 은총 등)로만, 다음 스테이지로 넘어가면 복귀
    tickBuffs(st, u, dt); if (u.dead) return;
    for (const sk of u.skills) sk.ready -= dt;
    u.atkCd -= dt;
    // 자연 회복: 비전투 1.5%/s, 전투 0.4%/s
    const mobs = alive(st.mobs);
    const regen = mobs.length ? REGEN_FIGHT : 0.015; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * regen * dt);
    if (u.b.stunT > 0) return;
    // 전진형 진형: 전열(st.frontX)은 가장 앞의 적을 향해 나아가고, 각자 역할 거리만큼 뒤에서 따라간다.
    // 근접·수호는 적에게 달려들고, 원거리·후열은 전열보다 앞서지 않는 선에서 사거리까지 다가간다.
    const melee = u.range <= 60;
    const wantX = st.frontX - u.off;
    const tgt = nearest(u, mobs);
    if (!tgt) { moveToward(u, wantX, u.homeY, u.moveSpd, dt, 3); u.facing = 1; clamp(u); return; }
    const d = dist(u, tgt);
    if (u.role === 'heal') {   // 2026-11-01: 치유는 적이 사거리 밖이어도(전열 뒤에서 이동 중이어도) 치유 스킬·치유 평타를 씀 — 이전엔 적이 사거리에 들어와야만 행동해서 딜러가 다쳐도 회복이 늦었음
      for (let i = u.skills.length - 1; i >= 0; i--) { const sk = u.skills[i]; if (sk.ready <= 0 && HEAL_SK.has(sk.type) && castSkill(st, u, sk, tgt)) { sk.ready = sk.cd; u.atkCd = Math.max(u.atkCd, 0.3); } }
      if (u.atkCd <= 0 && HEAL_BASIC) { const low = alive(st.heroes).filter(m => m.hp < m.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (low) { fx(st, { type: 'healfx', x: low.x, y: low.y - 14, ttl: 0.5 }); heal(st, u, low, effAtk(u) * HEAL_BASIC * (1 + (u.healBonus || 0))); u.atkCd = atkInterval(u); } }
    }
    if (d > u.range) {
      if (melee) { const oy = tgt.boss ? (u.idx % 2 ? 13 : -13) : 0;   /* 2026-11-17: 같은 줄(y)에 선 근접 둘이 보스로 일직선 돌진하면 앞사람에 막혀 영영 사거리에 못 들어갔음(레이드 검귀 닉스 0%) → 보스에게는 위·아래로 갈라 붙음 */ if (oy) moveToward(u, tgt.x - 10 * Math.sign(tgt.x - u.x || 1), tgt.y + oy, u.moveSpd, dt, 0); else moveToward(u, tgt.x, tgt.y, u.moveSpd, dt, u.range - 2); }
      else { const lim = (u.role === 'sup' ? st.frontX - 70 : wantX) + 12;   /* 2026-11-16: 지원은 후열(전열 105 뒤)에 서면 사거리(105)가 보스에 닿지 않아 보스전에서 스킬·평타를 한 번도 못 썼음 → 행동할 때는 원거리 줄(70)까지 다가감 */ if (tgt.x - u.range + 2 <= lim) moveToward(u, tgt.x, tgt.y, u.moveSpd, dt, u.range - 2); else moveToward(u, lim, u.homeY + (tgt.y - u.homeY) * 0.5, u.moveSpd, dt, 2); }   // 전열보다 앞서지 않음
      clamp(u); return;
    }
    u.facing = tgt.x >= u.x ? 1 : -1;
    const pb = st.params && st.params.boss, hold = (st.boss && !st.boss.dead ? st.boss.gim === 'frenzy' && !(st.boss.chargeT > 0) : !!(pb && pb.gim === 'frenzy' && !C.GIM.frenzy.nohunt));   // 격분 보스: 실명 스킬(2026-11-20 기절 → 실명)은 힘을 모을 때까지 아낀다(보스가 나오기 전 사냥 중에도 — 첫 힘 모으기에 쿨타임이 걸려 있지 않게)
    const B = st.boss && !st.boss.dead ? st.boss : null;   // 폭주 보스: 서리의 빙결 스킬은 보스가 나올 때까지 아꼈다가 보스에게 씀(보스전 중에는 바로바로 — 시뮬에서 보스전 중 아끼면 시전 횟수가 줄어 오히려 승률 하락) — 2026-11-20
    const holdR = B ? B.gim === 'rampage' && !B.rmpOn : !!(pb && pb.gim === 'rampage');   /* 폭주 보스: 서리 빙결 스킬(1번 포함)은 보스가 '폭주!'에 들어갈 때까지 아꼈다가 그 순간 보스에게 (격분의 실명과 같은 방식) */
    for (let i = u.skills.length - 1; i >= 0; i--) { const sk = u.skills[i]; if (sk.ready <= 0) {
      if (sk.eat && B && C.STACK && C.STACK.burstAt && (u._stkA != null ? u._stkA : (u._stkA = st.heroes.some(h => h.skills.some(k => k.grant === ({ burn: 'burn', vs: 'combo', blind: 'blind', frz: 'freeze', bleed: 'bleed' })[sk.eat[0]]))))) { const bn = B.b[sk.eat[0] + 'N'] || 0; sk._wait = (sk._wait || 0) + dt; if (bn < C.STACK.burstAt && sk._wait < C.STACK.burstWait) continue; }   // 터뜨리는 딜러(eat): 편성에 그 디버프를 쌓는 지원이 있으면 보스의 중첩이 burstAt 이상이 될 때까지 아낌(최대 burstWait초, 쌓는 지원이 없으면 아끼지 않음) — 2026-11-25 빛·서리는 10중첩 자동 발동이 잦아 바로 쓰면 늘 0~1중첩이었음
      const lkd = (B && B.lk && B.lk[u.id] > st.t) || (!C.HOLD_DEF && DEF_T[sk.type]);   /* 2026-11-21 방어·회복 스킬(수호 방벽·회복·보호막)은 파훼가 붙어 있어도 아끼지 않음 — 수호가 잔몹에 녹던 문제 */ if ((hold || (B && B.chargeT > 0 && B.b.blindT > 0 && unl(st, B, 'blindT'))) && !lkd && BLIND_SK(sk)) continue; if ((holdR || (B && B.rmpOn && B.b.frzT > 0 && unl(st, B, 'frzT'))) && !lkd && FREEZE_SK(u, sk)) continue;   /* 다른 영웅의 파훼가 이미 들어가 있으면 아낌(둘이 한꺼번에 써서 낭비되지 않게 — 번갈아 쓰기) */ if (!B && !lkd && pb && (pb.gim === 'armor' || pb.gim === 'regen' || pb.gim === 'barrier') && cntSk(u, sk, pb.gim)) continue;   /* 보스가 나올 때까지 아껴 등장하자마자 파훼(격분·폭주와 같은 방식) */ if (B && !lkd && (B.gim === 'armor' || B.gim === 'regen' || B.gim === 'barrier') && cntSk(u, sk, B.gim) && ((B.gim === 'armor' ? B.armT : B.gim === 'regen' ? B.rgnT : (B.bar > 0 ? 0 : B.barT)) > 3 * (C.BUFF_DUR || 1) - 2 || (B.b[GKEY[B.gim]] > 0 && unl(st, B, GKEY[B.gim])))) continue;   /* 철갑·재생·장벽이 열려 있는 동안은 디버프가 창이 닫힌 뒤까지 남을 때만 씀(다음 파훼로 이어지게) */ if (B && B.gim === 'rampage' && sk.type === 'timestop' && FREEZE_SK(u, sk) && Math.hypot(B.x - u.x, B.y - u.y) > sk.r) continue; if (sk.grant && pb && (C.GRANT_HOLD_ALL || C.GIM_DEB[pb.gim] === sk.grant) && !(st.boss && !st.boss.dead)) continue;   /* 파훼 지원 버프는 보스가 나올 때까지 아낌(2026-11-20) */ const t2 = st.boss && ((st.boss.chargeT > 0 && BLIND_SK(sk)) || (st.boss.gim === 'rampage' && st.boss.rmpOn && FREEZE_SK(u, sk)) || (B && (B.gim === 'armor' || B.gim === 'regen' || B.gim === 'barrier') && cntSk(u, sk, B.gim))) ? st.boss : tgt; if (castSkill(st, u, sk, t2)) { sk.ready = sk.cd; sk._wait = 0; { const t = TR(u); if (t && sk.sig) { if (t.k === 'killcd' && u._kr) sk.ready = sk.cd * (1 - t.v); else if (t.k === 'halfcd' && B && B.hp / B.maxHp <= t.th) sk.ready = sk.cd * (1 - t.v); } u._kr = false; }   /* 아젤라 처치 환급 · 세이아 보스 체력 절반 이하 쿨 감소 */ u.atkCd = Math.max(u.atkCd, 0.3); return; } } } // 궁극기(2번째) 우선
    if (u.atkCd <= 0 && HEAL_BASIC && u.role === 'heal') {   // 치유는 평타 대신 다친 아군 회복(모두 체력이 가득하면 공격)
      const low = alive(st.heroes).filter(m => m.hp < m.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (low) { fx(st, { type: 'healfx', x: low.x, y: low.y - 14, ttl: 0.5 }); heal(st, u, low, effAtk(u) * HEAL_BASIC * (1 + (u.healBonus || 0))); u.atkCd = atkInterval(u); return; }
    }
    if (u.atkCd <= 0) {
      if (u.range > 60) { st.projs.push({ x: u.x, y: u.y - 16, tx: tgt, from: u, spd: 320, elem: u.elem, ttl: 2 }); u.atkAt = st.t; }
      else { fx(st, { type: 'swing', x: u.x + u.facing * 14, y: u.y - 14, ttl: 0.12, dir: u.facing }); hit(st, u, tgt, 1.0, false); }
      u.atkCd = atkInterval(u);
    }
  }
  function mobAct(st, u, dt) {
    tickBuffs(st, u, dt); if (u.dead) return;
    for (const sk of u.skills) sk.ready -= dt;
    u.atkCd -= dt;
    if (u.gim && gimTick(st, u, dt)) return;
    if (u.b.stunT > 0) return;
    const hs = alive(st.heroes); if (!hs.length) return;
    // 적은 무조건 수호를 노린다 (살아 있는 수호가 없을 때만 가장 가까운 영웅)
    const tanks = hs.filter(h => h.role === 'tank');
    const tgt = nearest(u, tanks.length ? tanks : hs);
    const d = dist(u, tgt);
    if (d > u.range) { moveToward(u, tgt.x, tgt.y, u.moveSpd * (u.b.slowT > 0 ? 1 - 0.4 * BW() : 1), dt, u.range - 2); clampMob(u); return; }
    clampMob(u); // 화면 밖(가장자리 스폰 위치)에 머물며 원거리 공격만 하는 상황 방지 — 영웅이 닿을 수 있는 범위 안으로 들어오게
    u.facing = tgt.x >= u.x ? 1 : -1;
    for (const sk of u.skills) { if (sk.ready <= 0 && castSkill(st, u, sk, tgt)) { sk.ready = sk.cd; u.atkCd = Math.max(u.atkCd, 0.4); return; } }
    if (u.atkCd <= 0) {
      if (u.range > 60) { st.projs.push({ x: u.x, y: u.y - 14, tx: tgt, from: u, spd: 220, elem: u.elem, ttl: 2.5, enemy: true }); u.atkAt = st.t; }
      else { fx(st, { type: 'swing', x: u.x + u.facing * 12, y: u.y - 12, ttl: 0.12, dir: u.facing, enemy: true }); hit(st, u, tgt, u.boss ? u.basic : 1.0, false); }
      u.atkCd = atkInterval(u);
    }
  }

  // 유닛 간 충돌: 스프라이트가 최대 60% 정도만 겹치도록 중심 간 최소 간격을 둔다 (가로 rx · 세로 ry 타원, 같은 편끼리 강하게, 적과는 약하게)
  const RX = (u) => u.kind === 'hero' ? 10 : (u.boss ? 18 : 8), RY = (u) => u.kind === 'hero' ? 12 : (u.boss ? 16 : 8);
  function separate(st) {
    const hs = alive(st.heroes), ms = alive(st.mobs);
    const push = (a, b, k, wa, wb) => {
      const rx = (RX(a) + RX(b)) * k, ry = (RY(a) + RY(b)) * k;
      let dx = b.x - a.x, dy = b.y - a.y;
      const nx = dx / rx, ny = dy / ry; let d = Math.hypot(nx, ny);
      if (d >= 1) return;
      let ux, uy;
      if (d < 0.001) { const ang = (a.idx || 0) * 2.4 + (b.idx || 0) * 1.3 + 0.7; ux = Math.cos(ang); uy = Math.sin(ang); d = 0; }
      else { ux = nx / d; uy = ny / d; }
      const need = 1 - d, tw = (wa + wb) || 1;   // 타원 정규화 공간에서 겹친 만큼 밀어낸다
      const mx = ux * need * rx, my = uy * need * ry;
      a.x -= mx * wa / tw; a.y -= my * wa / tw; b.x += mx * wb / tw; b.y += my * wb / tw;
    };
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) push(hs[i], hs[j], 1, 1, 1);
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) push(ms[i], ms[j], 1, ms[i].boss ? 0 : 1, ms[j].boss ? 0 : 1);
    for (const h of hs) for (const m of ms) push(h, m, 0.6, 1, m.boss ? 0 : 0.5);
    for (const h of hs) clamp(h);
    for (const m of ms) if (m.x > 0 && m.x < W && m.y > 0 && m.y < H) clampMob(m);
  }

  function spawnBoss(st) {
    // 보스 페이즈: 남아 있던 일반 몹은 전부 사라진다 (처치 수에 포함하지 않음)
    for (const m of st.mobs) if (!m.dead && !m.boss) { fx(st, { type: 'poof', x: m.x, y: m.y - 12, ttl: 0.4 }); }
    st.mobs = st.mobs.filter(m => m.dead || m.boss);
    st.projs = st.projs.filter(p => !p.tx || p.tx.boss || p.enemy);
    const src = st.params.boss; const b = mkMob(src, st, true); b.facing = -1; b.bornT = st.t; st.mobs.push(b); st.boss = b; st.phase = 'boss';
    st.events.push({ t: 'boss' }); fx(st, { type: 'ring', x: b.x, y: b.y - 10, r: 60, ttl: 0.6, elem: 'fire' }); fx(st, { type: 'ring', x: b.x, y: b.y - 10, r: 110, ttl: 0.9, elem: b.elem }); st.shake = Math.max(st.shake || 0, 0.35);
  }

  function create(heroesSrc, params, opts) {
    opts = opts || {};
    const hs = heroesSrc.map(mkHero); assignHomes(hs); for (const h of hs) { h.x = -20 - h.off * 0.6; h.y = h.homeY; }   // 왼쪽 밖에서 걸어 들어온다
    const st = { W, H, rng: C.seededRng(opts.seed || 1), seq: 1, heroes: hs, mobs: [], projs: [], fx: [], texts: [], events: [],
      kills: 0, boss: null, phase: 'hunt', t: 0, spawnT: 0, deadT: 0, dmgDealt: 0, headless: !!opts.headless, params: null, speedup: 1 };
    setParams(st, params);
    return st;
  }
  // params: { stage, mobs:[mobSrc...], boss: mobSrc, quota, maxMobs, autoBoss, mode:'stage'|'tower'|'raid', raidTime }
  function setParams(st, params) {
    st.params = params; st.kills = 0; st.boss = null; st.mobs = []; st.projs = []; st.phase = params.mode === 'raid' ? 'boss' : 'hunt'; st.t = 0; st.spawnT = 1.2;
    // 새 스테이지: 영웅은 왼쪽 밖에서 다시 입장(렌더러가 gen 변화를 보고 잠깐 암전), 적은 잠시 뒤 오른쪽에서
    for (const h of st.heroes) { h.hp = h.maxHp; h.dead = false; h.dmgOut = 0; h.b.burnT = 0; h.b.slowT = 0; h.b.stunT = 0; h.shield = 0; if (h.off != null) { h.x = -20 - h.off * 0.6; h.y = h.homeY; h.facing = 1; }
      for (const k of h.skills) k.ready = k.grant ? 0 : k.cd; }   // 2026-11-24 사용자 '새 층이면 스킬을 0부터 다시 채우게' — 이전 스테이지 쿨 이어받지 않음(전투 처음 입장도 같음). 파훼 지원 궁극기(grant)만 예전처럼 준비 상태
    st.frontX = 120; st.gen = (st.gen || 0) + 1; st.fx = []; st.texts = [];
    if (params.mode === 'raid') spawnBoss(st);
  }
  function respawnHeroes(st) {
    st.mobs = []; st.projs = []; st.boss = null;
    for (const h of st.heroes) { h.hp = h.maxHp; h.dead = false; h.dmgOut = 0; h.x = -20 - h.off * 0.6; h.y = h.homeY; h.b.burnT = 0; h.b.stunT = 0; h.b.slowT = 0; }
    st.phase = 'hunt'; st.spawnT = 1.2; st.frontX = 120; st.gen = (st.gen || 0) + 1; st.events.push({ t: 'respawn' });
  }

  function tick(st) { NOW = st.t; CUR = st;
    const dt = TICK; st.t += dt;
    const p = st.params;
    // 효과·텍스트 수명
    for (const f of st.fx) f.ttl -= dt; st.fx = st.fx.filter(f => f.ttl > 0);
    for (const tx of st.texts) { tx.ttl -= dt; tx.y -= (tx.cls === 'smite' || tx.cls === 'ice' ? 6 : 28) * dt; if (tx.vx) tx.x += tx.vx * dt; } st.texts = st.texts.filter(t => t.ttl > 0);
    for (const m of st.mobs) if (m.dead) m.deadT -= dt; st.mobs = st.mobs.filter(m => !m.dead || m.deadT > 0);

    if (st.phase === 'dead') { st.deadT -= dt; if (st.deadT <= 0) { if (p.mode !== 'stage') { st.phase = 'lost'; st.events.push({ t: 'lost' }); } else respawnHeroes(st); } return; }
    if (st.phase === 'won' || st.phase === 'lost') return;
    if (p.mode === 'raid' && st.t >= p.raidTime) { st.phase = 'lost'; st.events.push({ t: 'raidend', dmg: st.dmgDealt }); return; }
    if (p.timeLimit && st.t >= p.timeLimit) { st.phase = 'lost'; st.events.push({ t: 'lost', timeout: true }); return; }
    if (p.enrage && st.boss && !st.boss.dead) { const e = st.t - st.boss.bornT - p.enrage.at; if (e > 0) { if (!st.boss.enr) { text(st, st.boss.x, st.boss.y - 60, '격노', 'crit'); st.events.push({ t: 'enrage' }); } const tk = C.TANK_ENRAGE != null && C.TANK_ENRAGE !== 1 && st.heroes.some(h => h.role === 'tank' && !h.dead); st.boss.enE = (st.boss.enE || 0) + Math.min(dt, e) * (tk ? C.TANK_ENRAGE : 1); st.boss.enr = 1 + st.boss.enE / p.enrage.per; } }   // 수호가 살아 있으면 격노 진행 TANK_ENRAGE배(2026-10-30)

    // 스폰
    if (st.phase === 'hunt' && p.mode !== 'raid') {
      st.spawnT -= dt;
      const n = alive(st.mobs).length;
      if (st.spawnT <= 0 && n < p.maxMobs) { const src = p.mobs[Math.floor(st.rng() * p.mobs.length)]; st.mobs.push(mkMob(src, st, false)); st.spawnT = n < 2 ? 0.3 : 0.75; }
      if (st.kills >= p.quota && !st.boss && p.autoBoss) spawnBoss(st);
    }
    { const ms = alive(st.mobs); const tx = ms.length ? Math.max(120, Math.min(W - 40, Math.min.apply(null, ms.map(m => m.x)) - 26)) : 200;
      st.frontX = st.frontX == null ? 120 : st.frontX + (tx - st.frontX) * Math.min(1, dt * 1.2); }
    for (const h of st.heroes) heroAct(st, h, dt);
    for (const m of st.mobs) if (!m.dead) mobAct(st, m, dt);
    separate(st);
    // 투사체
    for (const pr of st.projs) {
      pr.ttl -= dt; const t = pr.tx; if (!t || t.dead) { pr.ttl = 0; continue; }
      const dx = t.x - pr.x, dy = (t.y - 14) - pr.y, d = Math.hypot(dx, dy);
      if (d < 10) { hit(st, pr.from, t, pr.from.boss ? pr.from.basic || 1 : 1.0, false); pr.ttl = 0; continue; }
      pr.x += dx / d * pr.spd * dt; pr.y += dy / d * pr.spd * dt;
    }
    st.projs = st.projs.filter(pr => pr.ttl > 0);
    // 전원 사망 시에만 전멸 처리 (한 명이 쓰러지면 나머지가 계속 싸우고, 쓰러진 영웅은 12초 뒤 부활)
    if (!alive(st.heroes).length) {
      st.phase = 'dead'; st.deadT = 2.5;
      if (st.boss) { st.events.push({ t: 'bossfail' }); st.kills = 0; } else st.events.push({ t: 'dead' });
      return;
    }
  }
  function runFor(st, seconds) { const n = Math.round(seconds / TICK); for (let i = 0; i < n; i++) { tick(st); if (st.phase === 'won' || st.phase === 'lost') break; } }

  g.RPG.Field = { create, tick, setParams, runFor, TICK, W, get H() { return H; }, setH(h) { H = h; } };
})(typeof window !== 'undefined' ? window : globalThis);

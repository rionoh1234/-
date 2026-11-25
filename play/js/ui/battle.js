// 전투: 필드 자동사냥 컨트롤러(BC)·전투 탭(스탯 강화·유물)
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- ★3 후광 (2026-10-28) ----------
// 속성색 빛무리 + 빛줄기를 캔버스 하나로 미리 그려 두고(속성별 캐시), 캐릭터 뒤에 천천히 돌리며 그림. 배속과 무관하게 실제 시간으로 움직임.
const HALO = {}, HALO_ON = true;   // 2026-10-28 자홍 시트 도트(이펙트 포함)로 바꾸며 껐다가, 2026-11-20 이펙트 없는 새 ★3 도트 50장으로 바꾸며 다시 켬(사용자)
const UNIT_SCALE = 1.25;   // 2026-11-20 사용자 '캐릭터 크기 1.25배' — 영웅·몹·보스 그림만 키움(전투 계산·위치는 그대로)
function haloCanvas(elem) {
  if (HALO[elem]) return HALO[elem];
  const Z = 128, c = document.createElement('canvas'); c.width = c.height = Z; const g = c.getContext('2d'), m = Z / 2;
  const col = (C.ELEM_COLOR && C.ELEM_COLOR[elem]) || '#ffd34f';
  const rgb = [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)), rc = a => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  for (let i = 0; i < 12; i++) {   // 빛줄기 12개(길고 짧게 번갈아)
    const a = i / 12 * Math.PI * 2, L = i % 2 ? m * 0.78 : m * 0.98, wd = 0.11;
    const gr = g.createRadialGradient(m, m, 0, m, m, L); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(0.4, rc(0.75)); gr.addColorStop(1, rc(0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(m, m); g.lineTo(m + Math.cos(a - wd) * L, m + Math.sin(a - wd) * L); g.lineTo(m + Math.cos(a + wd) * L, m + Math.sin(a + wd) * L); g.closePath(); g.fill();
  }
  const gl = g.createRadialGradient(m, m, 0, m, m, m * 0.62); gl.addColorStop(0, 'rgba(255,255,255,.7)'); gl.addColorStop(0.45, rc(0.6)); gl.addColorStop(1, rc(0));   // 가운데 빛무리
  g.fillStyle = gl; g.beginPath(); g.arc(m, m, m * 0.62, 0, Math.PI * 2); g.fill();
  return HALO[elem] = c;
}
function drawHalo(cx, x, y, elem, uid) {
  const t = performance.now() / 1000, ph = uid ? (uid.charCodeAt(uid.length - 1) % 7) : 0;   // 영웅마다 위상을 살짝 다르게
  const r = 40 * UNIT_SCALE * (1 + 0.05 * Math.sin(t * 2 + ph));
  cx.save(); cx.translate(x, y); cx.rotate(t * 0.35 + ph); cx.globalCompositeOperation = 'screen'; cx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 2.4 + ph);
  cx.drawImage(haloCanvas(elem), -r, -r, r * 2, r * 2); cx.restore();
}
// 발끝 맞추기(2026-10-28): 도트마다 발끝 높이가 달라(옛 도트 294/300, pixsnap·자홍 시트 도트 269/300) 그림자 위에 떠 보이던 문제 — 그림의 맨 아래 불투명 줄을 재서 그만큼 내려 그림
const FOOT = {};
function footGap(im, key) {
  if (FOOT[key] != null) return FOOT[key];
  if (!im || !im.complete || !im.naturalWidth) return 0;
  try {
    const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, W, H).data; let y = H - 1;
    for (; y > 0; y--) { let hit = false; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 0) { hit = true; break; } if (hit) break; }
    FOOT[key] = (H - 1 - y) / H;
  } catch (e) { FOOT[key] = 0; }
  return FOOT[key];
}
// ---------- 전투 (필드 자동사냥) ----------
const BC = {
  ctx: { kind: 'stage' }, st: null, running: false, raf: null, last: 0, acc: 0, logs: [], retryAt: 0, cv: null, cx: null, dpr: 1, bossBanner: 0, deadRecent: [], _hudN: 0,
  pause() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; },
  params() {
    const slots = G.slots(S);
    if (this.ctx.kind === 'tower') return C.towerParams(this.ctx.floor, slots);
    if (this.ctx.kind === 'raid') return C.raidParams(S.raid.week || 0, S.maxClear);
    if (this.ctx.kind === 'dummy') return C.dummyParams(S.maxClear, slots, this.ctx.el);
    if (this.ctx.kind === 'dungeon') return C.dungeonParams(this.ctx.dkind, this.ctx.level, slots);
    return C.stageParams(this.curStage(), slots, S.autoBoss !== false);
  },
  curStage() { S.stage = Math.max(1, Math.min(C.STAGE_MAX, S.maxClear + 1, S.stage || 1)); return S.stage; },
  trial() { const d = this.ctx.kind === 'dungeon' && C.DG[this.ctx.dkind]; return d && d.el ? G.trialTeam(S, d.el) : null; },   // 속성 시련(시즌 3): 그 속성 영웅만 출전
  inTeam(fn) { if (this.ctx.kind === 'dummy') { const P = this.ctx.team && S.epresets && S.epresets[this.ctx.team]; return P ? G.withParty(S, psetIds(P), () => G.withLoadout(S, P, fn)) : fn(); }   // 허수아비: 고른 속성 프리셋(편성·장비)으로
    const t = this.trial(); if (!t) return fn(); const el = C.DG[this.ctx.dkind].el; return G.withParty(S, t, () => G.withLoadout(S, S.epresets && S.epresets[el], fn)); },   // 속성 시련: 그 속성 프리셋의 장비로(2026-11-22)   // 지금 전투의 편성 기준으로 계산(공명·인연 포함)
  rebuild(keepKills) {
    const units = this.inTeam(() => G.partyUnits(S));
    for (const u of units) { const src = illOf(u.id); if (src) img(src); }   // 출전 영웅 일러스트를 미리 받아 둠 — 첫 궁극기 컷인이 빈 칸으로 뜨지 않게
    const kills = keepKills && this.st ? this.st.kills : 0;
    const old = this.st;
    if (!old) this.bossBanner = 0;   // 새 전투(탑·던전·레이드 진입 등)에선 이전 전투의 보스 배너를 버림 — 다른 탭에 있는 동안 멈춰 있던 배너가 보스 없는 새 전투에 'BOSS / BOSS'로 뜨던 것(2026-11-19)
    this.st = F.create(units, this.params(), { seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    if (this.bossAt != null) this.bossAt = (keepKills && old && old.phase === 'boss') ? this.st.t - (old.t - this.bossAt) : null;   // 빠른 진격용 보스 등장 시각: 전투를 다시 만들면 새 시계 기준으로 옮김
    if (keepKills && old) { this.st.kills = Math.min(kills, this.st.params.quota); if (old.phase === 'boss' && old.boss) this.st.kills = this.st.params.quota; }
    if (old && keepKills) { // 강화·편성 변경 등으로 능력치만 다시 계산: 전투 상황(위치·체력 비율·사망·적·보스·전열·암전 세대)을 그대로 이어받는다
      for (const h of this.st.heroes) { const o = old.heroes.find(x => x.uid === h.uid); if (o) { h.x = o.x; h.y = o.y; h.dead = o.dead; h.hp = o.dead ? 0 : Math.max(1, Math.round(h.maxHp * o.hp / o.maxHp)); h.facing = o.facing; h.shield = o.shield; h.shieldT = o.shieldT; h.dmgOut = o.dmgOut || 0; h.b = o.b; h.skills.forEach((sk, i) => { if (o.skills[i]) sk.ready = Math.min(sk.cd, o.skills[i].ready); }); } }
      if (old.params.mode === this.st.params.mode && old.params.stage === this.st.params.stage) {
        const st = this.st; st.mobs = old.mobs; st.boss = old.boss; st.phase = old.phase; st.t = old.t; st.spawnT = old.spawnT; st.deadT = old.deadT; st.kills = old.kills; st.dmgDealt = old.dmgDealt;
        st.projs = old.projs.filter(p => p.enemy); st.fx = old.fx; st.texts = old.texts; st.shake = old.shake;
        st.frontX = old.frontX; st.gen = old.gen; st.seq = old.seq; st.rng = old.rng;
      }
    }
    this.st.events.length = 0;
  },
  start() {
    if (!this.inTeam(() => G.activeParty(S)).length) { addLog('<span class="lose">대표 영웅이 없습니다</span>'); return; }
    if (!S.navV) { if (S.stage < S.maxClear) S.stage = S.maxClear; S.navV = 1; }   // 수동 이동 버튼 삭제(2026-11-15): 예전에 아래 스테이지로 내려 두었던 저장은 최고 스테이지로 한 번 올림
    if (!this.st) this.rebuild(false);
    this.cv = $('#field'); this.cx = this.cv ? this.cv.getContext('2d') : null; if (this.cv) this.resize();
    if (tab === 'battle') renderBattleHead();
    if (this.running) return;
    this.running = true; this.last = performance.now(); this.acc = 0;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  },
  resize() {
    const cv = this.cv; if (!cv) return; const w = cv.clientWidth || 360; const dpr = Math.min(3, window.devicePixelRatio || 1); this.dpr = dpr;   // 2026-11-20 상한 2 → 3(그림 1.25배에서도 도트가 흐려지지 않게)
    const h = Math.round(w * F.H / F.W); cv.style.height = h + 'px';
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    this.scale = w / F.W;
    const bs = $('#bstat'); if (bs) { bs.style.top = Math.round(40.3 * this.scale) + 'px'; bs.style.height = Math.round(15 * this.scale) + 'px'; }   // 보스 띠 아래(캔버스 y 40) — 전장 세로가 바뀌어도 같은 자리
  },
  frame(now) {
    if (!this.running || !this.st) return;
    const dt = Math.min(0.2, (now - this.last) / 1000); this.last = now;
    this.acc += dt * (S.speed || 1);
    let n = 0; while (this.acc >= F.TICK && n++ < 30) { F.tick(this.st); this.acc -= F.TICK; }
    if (this.ctx.kind === 'stage') { this.gemAcc = (this.gemAcc || 0) + dt * C.idleRate(C.sOld(S.maxClear)).crystal / 60; if (this.gemAcc >= 1) { const g = Math.floor(this.gemAcc); S.crystal += g; this.gemAcc -= g; } }   // 접속 중에도 방치 보상과 같은 비율로 보석(정체 구간에서 접속이 방치보다 손해 보던 문제)
    this.events();
    if (tab === 'battle' && this.cx && this.cv && this.cv.isConnected) { this.draw(dt); this.hud(); } else { this.st.fx.length = 0; this.st.texts.length = 0; this.tickRetry(); }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  },
  events() {
    const st = this.st; if (!st.events.length) return;
    const k = this.ctx.kind; const stage = st.params.stage; let ult = null;
    for (const e of st.events) {
      if (e.t === 'kill') { if (k === 'stage') { G.applyKill(S, stage); this.gemAcc = (this.gemAcc || 0) + C.idleRate(C.sOld(S.maxClear)).crystal * C.ONLINE_GEM.bonus / C.ONLINE_GEM.kpm; } else if (k === 'tower') S.gold += C.killGold(60 + stage); }
      else if (e.t === 'boss') { this.bossAt = st.t; this.bossBanner = 1.6; addLog(`<b>보스</b> ${st.boss ? st.boss.name : ''} 등장`); }
      else if (e.t === 'bosskill') {
        this.kfx = { x: e.x == null ? F.W - 60 : e.x, y: e.y == null ? 160 : e.y, t: 0, elem: e.elem, gate: !!st.params.gate };
        if (k === 'stage') {
          const first = stage > S.maxClear; const rw = G.applyBossClear(S, stage);
          feed(`+${fmt(rw.gold)}${ico('gold')} +${rw.crystal}${ico('crys')}${rw.sshard ? ' +' + rw.sshard + ico('ssh') : ''}`);
          const dr = G.eqDrop(S, stage);
          if (dr && dr.kept) { feed(`<span class="eqg${dr.it.g}">${G.eqName(dr.it)}</span>${dr.equipped ? ' · 장착' : dr.better ? ' <b style="color:var(--good)">▲</b>' : ''}`); if (dr.equipped) this._rb = true; }
          else if (dr) feed(`<span class="eqg${dr.it.g}">${G.eqName(dr.it)}</span> 분해 +${dr.stone}${ico('est')}`);
          if (rw.seal) { feed(`<b style="color:var(--gold)">관문 돌파</b> +${rw.seal}${ico('seal')}`); bigPop('gate', '관문 돌파', `${ico('seal')} 별의 인장 +${rw.seal}`, 2200); }
          if (first && C.SLOT_UNLOCK.includes(stage)) { feed(`동료 슬롯 개방 · ${C.partySlots(S.maxClear)}명`); bigPop('gate', '동료 슬롯 개방', `원정대 ${C.partySlots(S.maxClear)}명`, 2200); }
          if (first && stage % (100 * C.STAGE_DISP) === 0) feed(`심화 ${stage / (100 * C.STAGE_DISP)} 지역 개방`);
          const front = S.autoBoss !== false && stage === S.maxClear;
          if (first && front && stage >= C.RUSH.min && this.bossAt != null && st.t - this.bossAt >= 0 && st.t - this.bossAt <= C.RUSH.sec && stage < C.STAGE_MAX) {   // 빠른 진격
            const R = G.rush(S, C.RUSH.n); this.bossAt = null;
            feed(`<b style="color:var(--gold)">빠른 진격</b> ${R.from}~${R.to} +${fmt(R.gold)}${ico('gold')} +${fmt(R.crystal)}${ico('crys')}${R.sshard ? ' +' + R.sshard + ico('ssh') : ''}`);
            for (const dr of R.drops) { if (dr.equipped) this._rb = true; if (dr.it.g >= 4) feed(`<span class="eqg${dr.it.g}">${G.eqName(dr.it)}</span>${dr.equipped ? ' · 장착' : ''}`); }
            if (R.stone) feed(`장비 분해 +${R.stone}${ico('est')}`);
            { const L = 100 * C.STAGE_DISP; if (Math.floor(R.to / L) > Math.floor((R.from - 1) / L)) feed(`심화 ${Math.floor(R.to / L)} 지역 개방`); }
            addLog(`<b>빠른 진격</b> ${R.from}~${R.to}스테이지 클리어`); if (R.to >= R.from) bigPop('rush', '빠른 진격', `${R.from} → ${R.to}`, 1500);
          }
          if (front && S.maxClear < C.STAGE_MAX) S.stage = S.maxClear + 1;
          else if (S.autoBoss !== false && stage < S.maxClear) S.stage = stage + 1;   // 물러나 있던 곳의 보스를 잡으면 한 단계 위로
          F.setParams(st, this.params()); renderBattleHead();
        } else if (k === 'tower') {
          const tw = (fl) => { const rw = C.towerReward(fl); S.tower.floor = Math.max(S.tower.floor, fl); S.gold += Math.round(rw.gold * G.goldMult(S)); S.crystal += rw.crystal; G.giveUsh(S, rw); S.sshard = (S.sshard || 0) + rw.sshard; if (rw.seal) S.seal = (S.seal || 0) + rw.seal; return rw; };
          const f = this.ctx.floor; const rw = tw(f); let next = f + 1;
          feed(`${f}층 ${rewardTxt(rw)}`); if (rw.seal) bigPop('gate', `${f}층 돌파`, `${ico('seal')} 별의 인장 +${rw.seal}`, 2200);
          if (this.bossAt != null && st.t - this.bossAt >= 0 && st.t - this.bossAt <= C.RUSH.sec) {   // 빠른 돌파(탑, 2026-11-24 사용자 — 10층): 보스를 RUSH.sec 안에 잡으면 다음 C.RUSH.tw층을 바로 클리어, 층마다 보상 전부
            const tot = {}; let seal = 0;
            for (let i = 1; i <= C.RUSH.tw; i++) { const r = tw(f + i); for (const k2 in r) if (typeof r[k2] === 'number') tot[k2] = (tot[k2] || 0) + r[k2]; if (r.seal) seal += r.seal; }
            feed(`<b style="color:var(--gold)">빠른 돌파</b> ${f + 1}~${f + C.RUSH.tw}층 ${rewardTxt(tot)}`); bigPop(seal ? 'gate' : 'rush', '빠른 돌파', seal ? `${f + 1} → ${f + C.RUSH.tw}층 · ${ico('seal')} 별의 인장 +${seal}` : `${f + 1} → ${f + C.RUSH.tw}층`, seal ? 2200 : 1500);
            addLog(`<b>빠른 돌파</b> 탑 ${f + 1}~${f + C.RUSH.tw}층 클리어`); next = f + C.RUSH.tw + 1;
          }
          this.bossAt = null; this.ctx.floor = next; F.setParams(st, this.params()); renderBattleHead();
        } else if (k === 'raid') { this.raidEnd(st.dmgDealt, true); }
        else if (k === 'dungeon') {
          const d = C.DG[this.ctx.dkind]; const lv = this.ctx.level; const rw = G.applyDungeonClear(S, this.ctx.dkind, lv);
          feed(`${d.name} Lv.${lv} ${rewardTxt(rw)}`);
          let next = lv + 1;
          if (lv >= C.RUSH.dgMin && this.bossAt != null && st.t - this.bossAt >= 0 && st.t - this.bossAt <= C.RUSH.sec) {   // 빠른 진격(던전): 다음 10레벨을 즉시 클리어, 레벨마다 보상 전부
            const tot = {}; let n = 0;
            for (let i = 1; i <= (C.RUSH.dgn || C.RUSH.n); i++) { const L = lv + i; if (C.dgCap && L > C.dgCap(S)) break; const r = G.applyDungeonClear(S, this.ctx.dkind, L); for (const k in r) if (typeof r[k] === 'number') tot[k] = (tot[k] || 0) + r[k]; n++; }
            if (n) { feed(`<b style="color:var(--gold)">빠른 진격</b> ${d.name} Lv.${lv + 1}~${lv + n} ${rewardTxt(tot)}`); bigPop('rush', '빠른 진격', `Lv.${lv + 1} → ${lv + n}`, 1500); next = lv + n + 1; }
          }
          this.bossAt = null;
          // 도전은 이용권을 쓰지 않음 — 깨면 바로 다음 레벨로 이어서 도전(실패하면 스테이지로)
          this.ctx = next <= C.dgCap(S) ? { kind: 'dungeon', dkind: this.ctx.dkind, level: next } : { kind: 'stage' }; this.st = null; this.rebuild(false); if (tab === 'battle') renderBattleHead();
        }
        save(); renderTop();
      }
      else if (e.t === 'bossfail') { addLog(`<span class="lose">보스에게 패배</span>`); { const B = st.boss, pc = B ? B.hp / B.maxHp * 100 : null; bigPop('lose', '전멸', pc == null ? '' : `보스 체력 ${pc < 10 ? pc.toFixed(1) : Math.ceil(pc)}%`, 1800); } if (k === 'stage') this.fallback(); }
      else if (e.t === 'dead') { addLog(`<span class="lose">원정대가 쓰러졌습니다</span> 잠시 후 부활`); if (k === 'stage') this.fallback(); }
      else if (e.t === 'raidend') { if (k === 'dummy') this.dummyEnd(); else this.raidEnd(e.dmg, false); }
      else if (e.t === 'lost') { if (k === 'dungeon') { const d = C.DG[this.ctx.dkind]; feed(`${d.name} Lv.${this.ctx.level} 실패 · 최고 Lv.${S.dg[this.ctx.dkind].lv}`); this.ctx = { kind: 'stage' }; this.st = null; this.rebuild(false); if (tab === 'battle') renderBattleHead(); save(); } else if (k === 'tower') { addLog(`<span class="lose">탑 ${this.ctx.floor}층 실패</span> 스테이지로 복귀`); feed(`탑 ${this.ctx.floor}층 실패`); this.ctx = { kind: 'stage' }; this.st = null; this.rebuild(false); if (tab === 'battle') renderBattleHead(); } else if (k === 'raid') this.raidEnd(st.dmgDealt, false); else if (k === 'dummy') this.dummyEnd(); }
      else if (e.t === 'skill') { if (e.ult) ult = e; if (e.sig) addLog(`✦ ${e.who}: <b style="color:var(--gold)">${e.name}</b>`); }
    }
    st.events.length = 0;
    if (ult) showUlt(ult);
    if (S._lvup) { S._lvup = 0; this._rb = true; }   // 레벨업 → 능력치 다시 계산
    if (this._rb) { this._rb = false; this.rebuild(true); }
  },
  fallback() { // 쓰러지면 한 단계 물러나 파밍, 60초 후 다시 한 단계 위로. 최전선에서는 최고 스테이지로, 이미 깬 스테이지에서도 쓰러지면 하나 더 아래로(2026-11-15: 수동 이동 버튼을 없애 자동으로 버틸 수 있는 곳을 찾게 함)
    const to = S.stage > S.maxClear ? S.maxClear : S.stage - 1;
    if (S.maxClear >= 1 && to >= 1 && to < S.stage) { S.stage = to; this.retryAt = Date.now() + 60000; F.setParams(this.st, this.params()); addLog(`${S.stage}스테이지에서 재정비 (60초 후 재도전)`); renderBattleHead(); }
  },
  dummyEnd() {   // 허수아비 기록: 편성·허수아비 속성·총 피해·영웅별 피해(최근 12개)
    const st = this.st, c = this.ctx, D = S.dummy || (S.dummy = { team: '', el: '', log: [] });
    const rec = { ts: Date.now(), team: c.team || '', el: c.el || '', dmg: st.dmgDealt, t: st.params.raidTime, h: st.heroes.map(h => [h.id, Math.round(h.dmgOut || 0)]) };
    D.log.unshift(rec); D.log = D.log.slice(0, 12);
    this.ctx = { kind: 'stage' }; this.st = null; this.rebuild(false); if (tab === 'battle') renderBattleHead(); save(); openDummyResult(0);
  },
  raidEnd(dmg, killed) {
    S.raid.total += dmg; if (dmg > S.raid.best) S.raid.best = dmg;
    const rw = C.raidReward(dmg, this.st.params.boss.hp, this.st.params.boss.elem); S.crystal += rw.crystal; G.giveUsh(S, rw); S.sshard = (S.sshard || 0) + rw.sshard;
    feed(`레이드 ${killed ? '보스 처치' : '종료'} · 피해 ${fmt(dmg)} ${rewardTxt(rw)}`);
    this.ctx = { kind: 'stage' }; this.st = null; this.rebuild(false); if (tab === 'battle') renderBattleHead(); save(); renderTop();
  },
  tickRetry() {
    if (this.ctx.kind === 'stage' && this.retryAt && Date.now() > this.retryAt && S.stage <= S.maxClear && S.stage < C.STAGE_MAX && S.autoBoss !== false) {
      this.retryAt = 0; S.stage = S.stage + 1; F.setParams(this.st, this.params()); addLog(`${S.stage}스테이지 재도전`); renderBattleHead();
    }
  },
  draw(dt) {
    const st = this.st, cx = this.cx, sc = this.scale * this.dpr; if (!cx) return;
    cx.setTransform(sc, 0, 0, sc, 0, 0);
    if (st.shake > 0) { st.shake -= dt; const m = 3 * Math.min(1, st.shake / 0.25); cx.translate((Math.random() - .5) * m * 2, (Math.random() - .5) * m * 2); }
    const ch = st.params.chapter || 0;
    const bg = RPG.BG && RPG.BG.get(st.params);
    if (bg && bg.width) cx.drawImage(bg, 0, 0, F.W, F.H);
    else { cx.fillStyle = st.params.ground || C.CHAPTER_GROUND[ch]; cx.fillRect(0, 0, F.W, F.H); }
    this.animT = (this.animT || 0) + dt; const A = this.animT;
    // 격분 예고: 힘을 모으는 동안 보스 중심으로 붉은 범위가 차오른다(유닛보다 먼저 그려 바닥에 깔림)
    { const B = st.boss; if (B && !B.dead && B.chargeT > 0) { const k = 1 - B.chargeT / C.GIM.frenzy.cast, r = 60 + 150 * k; cx.fillStyle = `rgba(255,60,40,${0.10 + 0.16 * k})`; cx.beginPath(); cx.ellipse(B.x, B.y - 6, r, r * 0.55, 0, 0, Math.PI * 2); cx.fill(); cx.strokeStyle = `rgba(255,120,90,${0.5 + 0.4 * Math.sin(A * 22)})`; cx.lineWidth = 2; cx.stroke(); } }
    // 투사체(꼬리 + 흰 심)
    for (const p of st.projs) {
      const col = C.ELEM_COLOR[p.elem] || '#fff'; let ux = p.enemy ? -1 : 1, uy = 0; if (p.tx) { const dx = p.tx.x - p.x, dy = (p.tx.y - 14) - p.y, d = Math.hypot(dx, dy) || 1; ux = dx / d; uy = dy / d; }
      cx.strokeStyle = col; cx.lineCap = 'round'; cx.globalAlpha = .55; cx.lineWidth = p.enemy ? 2.5 : 3.5; cx.beginPath(); cx.moveTo(p.x - ux * 14, p.y - uy * 14); cx.lineTo(p.x, p.y); cx.stroke(); cx.lineCap = 'butt';
      cx.globalAlpha = .4; cx.fillStyle = col; cx.beginPath(); cx.arc(p.x, p.y, 7, 0, Math.PI * 2); cx.fill(); cx.globalAlpha = 1; cx.beginPath(); cx.arc(p.x, p.y, p.enemy ? 3 : 4, 0, Math.PI * 2); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); cx.fill();
    }
    // 유닛 (y 정렬)
    const ents = st.heroes.filter(h => !h.dead).concat(st.mobs).sort((a, b) => a.y - b.y);
    for (const u of ents) {
      const boss = u.boss; const w = (u.kind === 'hero' ? 40 : (boss ? 64 : 36)) * UNIT_SCALE, h = (u.kind === 'hero' ? 52 : (boss ? 64 : 36)) * UNIT_SCALE;
      if (u.kind === 'hero') {   // 발 밑 접지 그림자(2026-10-28): 발끝(u.y) 바로 아래에 작고 진하게, 가장자리로 옅게 — 예전 큰 타원(u.y+2)은 그림자가 발 아래로 깔려 떠 보였음
        const gr = cx.createRadialGradient && cx.createRadialGradient(u.x, u.y, 0, u.x, u.y, w * 0.32); if (gr && gr.addColorStop) { gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(0.6, 'rgba(0,0,0,.24)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
        cx.save(); cx.translate(u.x, u.y - 0.5); cx.scale(1, 3.5 / (w * 0.32)); cx.translate(-u.x, -u.y); cx.fillStyle = (gr && gr.addColorStop) ? gr : 'rgba(0,0,0,.3)'; cx.beginPath(); cx.arc(u.x, u.y, w * 0.32, 0, Math.PI * 2); cx.fill(); cx.restore();
      } else { cx.fillStyle = 'rgba(0,0,0,.28)'; cx.beginPath(); cx.ellipse(u.x, u.y + 2, w * 0.4, 5, 0, 0, Math.PI * 2); cx.fill(); }
      if (HALO_ON && u.kind === 'hero' && u.star === 3 && !u.dead) drawHalo(cx, u.x, u.y - h * 0.56, u.elem, u.uid);   // ★3 후광(캐릭터 뒤)
      const im = u.kind === 'hero' ? img(u.img) : mobImg(u.id, u.hue);
      const ok = im && (im.complete === undefined || (im.complete && im.naturalWidth !== 0) || im.width);
      // 움직임(2026-11-15): 그림은 한 장 — 변형만으로 숨쉬기·걷기 들썩임·공격 내지르기·피격 번쩍임과 밀림·보스 낙하 등장·쓰러질 때 납작해짐
      if (u._ph == null) u._ph = (u.x * 0.37 + u.y * 0.91) % 6.283;
      const mvd = u._px == null ? 0 : Math.abs(u.x - u._px) + Math.abs(u.y - u._py); u._px = u.x; u._py = u.y; u._mv = mvd > 0.12 ? 1 : Math.max(0, (u._mv || 0) - dt * 7);
      const br = Math.sin(A * 2.6 + u._ph) * 0.022, hop = u._mv ? -Math.abs(Math.sin(A * 13 + u._ph)) * 2.2 * u._mv : 0;
      const la = u.atkAt != null ? (st.t - u.atkAt) / 0.3 : 9, lk = la >= 0 && la < 1 ? Math.sin(la * Math.PI) : 0;
      const ha = u.hitAt != null ? (st.t - u.hitAt) / 0.18 : 9, hk = ha >= 0 && ha < 1 ? 1 - ha : 0;
      const ranged = u.range > 60, lx = u.facing * (lk * (ranged ? -3 : 7) - hk * (boss ? 1 : 2.5));
      const ag = boss && u.bornT != null ? (st.t - u.bornT) / 0.55 : 9, ak = ag >= 0 && ag < 1 ? ag : 1;   // 보스 등장(위에서 떨어져 내려앉음)
      const dk = u.dead ? Math.max(0, u.deadT / 0.35) : 1;
      cx.save(); cx.translate(u.x + lx, u.y + hop - (1 - ak) * (1 - ak) * 46);
      if (u.kind === 'hero') { if (u.star === 3) cx.imageSmoothingQuality = 'high'; else cx.imageSmoothingEnabled = false; }   // ★3 고화질 그림은 곱게 축소, ★1·★2 도트는 픽셀 그대로(뿌옇게 번짐 방지, 2026-11-20)
      const flip = u.kind === 'hero' ? u.facing < 0 : u.facing > 0; if (flip) cx.scale(-1, 1);
      if (lk && !u.dead) cx.rotate((u.kind === 'hero' ? 1 : -1) * lk * (ranged ? -0.05 : 0.1));
      cx.scale((1 - br * 0.5) * (1 + (1 - dk) * 0.35) * (1.25 - 0.25 * ak), (1 + br) * dk * (1.25 - 0.25 * ak));
      if (u.dead) cx.globalAlpha = dk; else if (ak < 1) cx.globalAlpha = ak;
      if (u.b.stunT > 0) cx.globalAlpha *= 0.8;
      const dy = ok && u.kind === 'hero' ? footGap(im, u.img) * h : 0;   // 발끝을 그림자(u.y)에 맞춤
      if (ok) {
        if (u.gim === 'rampage' && u.rmp > 0 && !u.dead) { const a0 = cx.globalAlpha; for (let k = 2; k >= 1; k--) { cx.globalAlpha = a0 * 0.3 / k; cx.drawImage(im, -w / 2 + k * 9, -h + dy, w, h); } cx.globalAlpha = a0; }   // 신속: 잔상
        cx.drawImage(im, -w / 2, -h + dy, w, h);
        if (hk > 0 && !u.dead) { const a0 = cx.globalAlpha; cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = a0 * hk * (boss ? 0.3 : 0.8); cx.drawImage(im, -w / 2, -h + dy, w, h); cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = a0; }   // 피격 번쩍임
      } else { cx.fillStyle = u.kind === 'hero' ? '#8fd' : '#f88'; cx.fillRect(-w / 2, -h, w, h); }
      cx.restore();
      if (u.shield > 0) { cx.strokeStyle = u.reflect ? 'rgba(120,230,140,.85)' : 'rgba(150,210,255,.85)'; cx.fillStyle = u.reflect ? 'rgba(120,230,140,.12)' : 'rgba(150,210,255,.12)'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(u.x, u.y - h / 2, w * 0.62, h * 0.6, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); }
      if (u.b.vulnT > 0) { cx.fillStyle = '#d58cff'; cx.font = 'bold 10px sans-serif'; cx.textAlign = 'center'; cx.fillText('᛭', u.x + w * 0.45, u.y - h + 4); }
      if (u.b.tauntT > 0) { cx.strokeStyle = 'rgba(255,211,79,.8)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(u.x, u.y - h / 2, w * 0.7, 0, Math.PI * 2); cx.stroke(); }
      if (!u.dead) { // HP 바
        const bw = boss ? 56 : 30, bh = 4, bx = u.x - bw / 2, by = u.y - h - 7;
        cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        cx.fillStyle = u.kind === 'hero' ? (u.isMain ? '#74e089' : '#8fd4ff') : (boss ? '#ffb347' : '#ff6b6b'); cx.fillRect(bx, by, bw * Math.max(0, u.hp / u.maxHp), bh); cx.fillStyle = 'rgba(255,255,255,.3)'; cx.fillRect(bx, by, bw * Math.max(0, u.hp / u.maxHp), 1);
        if (u.kind === 'hero' && u.isMain) { cx.fillStyle = '#ffd34f'; cx.font = '8px sans-serif'; cx.textAlign = 'center'; cx.fillText('▼', u.x, by - 4); }
        if (u.gim) drawGim(cx, u, w, h, bx, by, bw, st.t);
      }
    }
    // 효과
    for (const f of st.fx) {
      const p = 1 - f.ttl / f.max; const col = C.ELEM_COLOR[f.elem] || '#fff';
      cx.lineWidth = 2; cx.strokeStyle = col; cx.fillStyle = col;
      if (f.big && f.type === 'slash') { cx.save(); cx.translate(f.x, f.y); cx.scale(1.8, 1.8); cx.translate(-f.x, -f.y); }
      if (f.type === 'ring') { cx.globalAlpha = 1 - p; cx.lineWidth = 3; cx.beginPath(); cx.arc(f.x, f.y, f.r * (0.3 + 0.7 * p), 0, Math.PI * 2); cx.stroke(); }
      else if (f.type === 'slash') { cx.globalAlpha = 1 - p; cx.lineWidth = 3; cx.beginPath(); cx.arc(f.x, f.y, 16, -0.9 + p * 1.2, 0.9 + p * 1.2); cx.stroke(); cx.lineWidth = 1; cx.strokeStyle = '#fff'; cx.beginPath(); cx.arc(f.x, f.y, 12, -0.6 + p * 1.2, 0.6 + p * 1.2); cx.stroke(); }
      else if (f.type === 'swing') { cx.globalAlpha = 0.9 * (1 - p); cx.strokeStyle = f.enemy ? '#ffb0b0' : '#fff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(f.x, f.y, 11, (f.dir > 0 ? -0.8 : Math.PI - 0.8) + p, (f.dir > 0 ? 0.8 : Math.PI + 0.8) + p); cx.stroke(); }
      else if (f.type === 'aura') { cx.globalAlpha = 0.5 * (1 - p); cx.beginPath(); cx.arc(f.x, f.y, f.r * (0.8 + 0.4 * p), 0, Math.PI * 2); cx.fill(); }
      else if (f.type === 'healfx') { cx.globalAlpha = 1 - p; cx.fillStyle = '#7cf29a'; for (let i = 0; i < 5; i++) { cx.beginPath(); cx.arc(f.x + (i - 2) * 7, f.y - p * 26 - (i % 2) * 6, 2.5, 0, Math.PI * 2); cx.fill(); } }
      else if (f.type === 'stun') { cx.globalAlpha = 0.9; cx.fillStyle = f.glyph ? '#d58cff' : '#ffd34f'; cx.font = '10px sans-serif'; cx.textAlign = 'center'; cx.fillText(f.glyph || '✦ ✦', f.x, f.y + Math.sin(p * 12) * 2); }
      else if (f.type === 'burst') { const rr = f.r * (0.35 + 0.65 * Math.min(1, p * 1.6)); const gr = cx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr); gr.addColorStop(0, 'rgba(255,255,255,' + (0.9 * (1 - p)) + ')'); gr.addColorStop(0.45, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.globalAlpha = 0.75 * (1 - p); cx.fillStyle = gr; cx.beginPath(); cx.arc(f.x, f.y, rr, 0, Math.PI * 2); cx.fill(); cx.globalAlpha = 1 - p; cx.lineWidth = 3; cx.beginPath(); cx.arc(f.x, f.y, rr, 0, Math.PI * 2); cx.stroke(); }
      else if (f.type === 'beam') { cx.globalAlpha = 1 - p; cx.lineCap = 'round'; cx.lineWidth = f.w * (1 - p * 0.6); cx.beginPath(); cx.moveTo(f.x, f.y); cx.lineTo(f.x2, f.y2); cx.stroke(); cx.strokeStyle = '#fff'; cx.lineWidth = Math.max(2, f.w * 0.3 * (1 - p)); cx.beginPath(); cx.moveTo(f.x, f.y); cx.lineTo(f.x2, f.y2); cx.stroke(); cx.lineCap = 'butt'; }
      else if (f.type === 'bolt') { cx.globalAlpha = 1 - p; for (const [lw, c] of [[5, col], [2, '#fff']]) { cx.lineWidth = lw; cx.strokeStyle = c; cx.beginPath(); f.pts.forEach((q, i) => { const jx = i ? (Math.random() - .5) * 8 : 0, jy = i ? (Math.random() - .5) * 8 : 0; if (!i) cx.moveTo(q.x, q.y); else { const pq = f.pts[i - 1]; cx.lineTo((pq.x + q.x) / 2 + jx, (pq.y + q.y) / 2 + jy); cx.lineTo(q.x, q.y); } }); cx.stroke(); } }
      else if (f.type === 'vortex') { cx.globalAlpha = 0.8 * (1 - p); cx.lineWidth = 3; for (let i = 0; i < 3; i++) { cx.beginPath(); cx.arc(f.x, f.y, f.r * (1 - p) * (0.4 + i * 0.3), p * 10 + i * 2, p * 10 + i * 2 + 4); cx.stroke(); } }
      else if (f.type === 'shards') { const n = f.n || 6, sp0 = f.big ? 64 : 30; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + ((f.x * 0.7 + i * 1.3) % 1.1), sp = (0.55 + ((i * 7) % 5) / 5 * 0.75) * sp0; const px = f.x + Math.cos(a) * sp * p, py = f.y + Math.sin(a) * sp * p * 0.7 + 36 * p * p - 12 * p, s = (f.big ? 4 : 2.6) * (1 - p * 0.6); cx.globalAlpha = 1 - p; cx.fillStyle = i % 3 === 0 ? '#fff' : i % 3 === 1 ? col : '#ffd34f'; cx.fillRect(px - s / 2, py - s / 2, s, s); } }
      else if (f.type === 'poof') { cx.globalAlpha = 0.6 * (1 - p); cx.fillStyle = '#ddd'; cx.beginPath(); cx.arc(f.x, f.y, 6 + 14 * p, 0, Math.PI * 2); cx.fill(); }
      else if (f.type === 'hit') { cx.globalAlpha = 0.8 * (1 - p); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(f.x, f.y, 5, 0, Math.PI * 2); cx.fill(); }
      if (f.big && f.type === 'slash') cx.restore();
      cx.globalAlpha = 1;
    }
    // 텍스트
    cx.textAlign = 'center'; cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.lineJoin = 'round';
    for (const t of st.texts) {
      const sm = t.cls === 'smite' || t.cls === 'ice'; const a = Math.min(1, t.ttl / (sm ? 1.2 : 0.3)); cx.globalAlpha = a; t._a = (t._a || 0) + dt; const pop = t._a < 0.1 ? 1.55 - t._a * 5.5 : 1;   // 처음 0.1초(실시간) 크게 떴다가 제 크기로
      const col = { crit: '#ffb347', heal: '#7cf29a', adv: '#ffd27a', dis: '#9fb0d8', enemy: '#ff8080', burn: '#ff9a5a', skill: '#9fe3ff', sig: '#ffd34f', smite: '#ffd34f', ice: '#aee6ff', norm: '#ffffff' }[t.cls] || '#fff';
      cx.font = (sm ? '900 ' : 'bold ') + Math.round((sm ? 30 : t.cls === 'crit' ? 16 : t.cls === 'sig' ? 14 : t.cls === 'skill' ? 10 : 12) * pop) + "px 'Pretendard', sans-serif"; cx.fillStyle = col;
      if (sm) { cx.shadowColor = t.cls === 'ice' ? 'rgba(120,200,255,.95)' : 'rgba(255,211,79,.95)'; cx.shadowBlur = 14; }   // 천벌: 금색 큰 글자 + 빛 번짐, 천천히 사라짐
      cx.strokeText(t.txt, t.x, t.y); cx.fillText(t.txt, t.x, t.y); if (sm) cx.shadowBlur = 0;
    }
    cx.globalAlpha = 1;
    // 스테이지 전환 암전: gen이 바뀌면 0.5초 동안 검은 화면에서 서서히 밝아짐
    if (st.gen !== this._gen) { if (this._gen != null) this.fadeT = 0.5; this._gen = st.gen; }
    if (this.fadeT > 0) { this.fadeT -= dt; cx.fillStyle = `rgba(4,6,12,${Math.max(0, Math.min(1, this.fadeT / 0.5)) * 0.95})`; cx.fillRect(0, 0, F.W, F.H); }
    // 보스 처치 섬광: 암전 위로 금빛 고리와 빛살이 퍼진다
    if (this.kfx) { const k = this.kfx; k.t += dt; const p = k.t / 0.7; if (p >= 1) this.kfx = null; else {
      cx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.55 - p * 2.6)})`; cx.fillRect(0, 0, F.W, F.H);
      const col = k.gate ? '#ffd34f' : (C.ELEM_COLOR[k.elem] || '#ffd34f'); cx.strokeStyle = col; cx.globalAlpha = 1 - p;
      for (const [rr, lw] of [[26 + 150 * p, 4], [14 + 90 * p, 2]]) { cx.lineWidth = lw; cx.beginPath(); cx.arc(k.x, k.y, rr, 0, Math.PI * 2); cx.stroke(); }
      cx.lineWidth = 2.5; cx.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + 0.26, r0 = 20 + 110 * p, r1 = r0 + 26 * (1 - p); cx.beginPath(); cx.moveTo(k.x + Math.cos(a) * r0, k.y + Math.sin(a) * r0 * 0.8); cx.lineTo(k.x + Math.cos(a) * r1, k.y + Math.sin(a) * r1 * 0.8); cx.stroke(); } cx.lineCap = 'butt';
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, sp = (0.5 + ((i * 7) % 5) / 5) * 120, s = 4 * (1 - p * 0.6); cx.fillStyle = i % 2 ? '#fff' : col; cx.fillRect(k.x + Math.cos(a) * sp * p - s / 2, k.y + Math.sin(a) * sp * p * 0.7 + 40 * p * p - s / 2, s, s); }
      cx.globalAlpha = 1; } }
    drawBossBar(cx, st, this, dt, A);
    // 보스 배너(이름이 오른쪽에서 미끄러져 들어옴)·사망 오버레이
    if (this.bossBanner > 0) { this.bossBanner -= dt; const bb = this.bossBanner, B = st.boss, gate = st.params.gate, e = Math.min(1, (1.6 - bb) / 0.22), sx = (1 - e) * (1 - e) * 120;
      cx.globalAlpha = Math.min(1, bb / 0.35); const y0 = F.H / 2 - 26;
      cx.fillStyle = 'rgba(4,6,12,.72)'; cx.fillRect(0, y0, F.W, 52); cx.fillStyle = gate ? '#ff7a8a' : '#ffb347'; cx.fillRect(0, y0, F.W, 1.5); cx.fillRect(0, y0 + 50.5, F.W, 1.5);
      cx.textAlign = 'center'; cx.font = "800 10px 'Pretendard', sans-serif"; cx.fillText(gate ? '관문' + (B && B.gim ? ' · ' + C.GIM_KR[B.gim] : '') : 'BOSS', F.W / 2 - sx, y0 + 17);
      cx.fillStyle = '#fff'; cx.font = "800 22px 'Pretendard', sans-serif"; cx.fillText(B && B.name || ctxTitle(), F.W / 2 + sx, y0 + 40); cx.globalAlpha = 1; }
    if (st.phase === 'dead') { cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(0, 0, F.W, F.H); cx.fillStyle = '#ff8080'; cx.font = "bold 18px 'Pretendard', sans-serif"; cx.fillText('부활 중', F.W / 2, F.H / 2 + 6); }
    if (st.params.mode === 'dungeon') { const left = Math.max(0, st.params.timeLimit - st.t); cx.fillStyle = left < 10 ? '#ff8080' : '#fff'; cx.font = "bold 16px 'Pretendard', sans-serif"; cx.textAlign = 'right'; cx.fillText(left.toFixed(1) + 's', F.W - 8, st.boss ? 50 : 24); }
    if (st.params.mode === 'raid') { cx.fillStyle = '#fff'; cx.font = "bold 14px 'Pretendard', sans-serif"; cx.textAlign = 'right'; cx.fillText(Math.max(0, st.params.raidTime - st.t).toFixed(1) + 's · ' + fmt(st.dmgDealt), F.W - 8, 24); }
    cx.setTransform(1, 0, 0, 1, 0, 0);
  },
  hud() {
    const st = this.st; this.tickRetry();
    const kb = $('#killbar'); if (kb) { const q = st.params.quota || 1; kb.firstElementChild.style.width = Math.min(100, st.kills / q * 100) + '%'; $('#killtxt').innerHTML = st.params.mode === 'raid' ? '레이드' : (st.boss ? '<b>보스 전투 중</b>' : `<b>${Math.min(st.kills, q)}</b> / ${q}`); }
    if (this.ctx.kind !== 'stage' && this.ctx.kind !== 'tower' && this._hudN++ % 60 === 0) { /* 던전·레이드 중 */ }
    updPStrip(); updBossStat();
    if (st.boss && !this._bossBar) this._bossBar = true;
  },
};
// 보스 기믹 표시(시즌 3, 2026-11-15 개편): 보스 몸에는 상태 그림만, 수치·이름은 화면 위 보스 띠의 알약(drawBossBar)
//   장벽 = 빛나는 막(남은 타격이 줄수록 옅어짐) / 철갑 = 강철 고리 조각(벗겨지면 사라짐) / 격분 = 힘을 모으는 동안 조여드는 붉은 고리 + ! / 신속 = 도는 초록 호 + 잔상(유닛 그리기)
function drawGim(cx, u, w, h, bx, by, bw, t) {
  const cy = u.y - h / 2;
  if (u.gim === 'barrier' && u.bar > 0) {
    const k = u.bar / (u.maxHp * C.GIM.barrier.pct), hk = u.hitAt != null && t - u.hitAt >= 0 && t - u.hitAt < 0.15 ? 1 : 0;
    const g = cx.createRadialGradient && cx.createRadialGradient(u.x - w * 0.2, cy - h * 0.25, 2, u.x, cy, w * 0.75);
    if (g && g.addColorStop) { g.addColorStop(0, `rgba(220,245,255,${0.30 * k + 0.08})`); g.addColorStop(0.7, `rgba(120,190,255,${0.14 * k + 0.05})`); g.addColorStop(1, 'rgba(120,190,255,0)'); }
    cx.fillStyle = g && g.addColorStop ? g : 'rgba(120,190,255,.16)'; cx.beginPath(); cx.ellipse(u.x, cy, w * 0.68, h * 0.66, 0, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = `rgba(${hk ? '255,255,255' : '160,220,255'},${0.45 + 0.5 * k})`; cx.lineWidth = hk ? 3 : 2; cx.stroke();
    cx.strokeStyle = 'rgba(255,255,255,.75)'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(u.x, cy, w * 0.68, h * 0.66, 0, t * 2.2, t * 2.2 + 0.7); cx.stroke();
  } else if (u.gim === 'armor' && !(u.armT > 0)) {
    for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.25; cx.strokeStyle = 'rgba(96,108,128,.95)'; cx.lineWidth = 5; cx.beginPath(); cx.ellipse(u.x, cy, w * 0.62, h * 0.6, 0, a, a + 1.15); cx.stroke(); cx.strokeStyle = 'rgba(226,232,242,.95)'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(u.x, cy, w * 0.62 + 1.5, h * 0.6 + 1.5, 0, a + 0.08, a + 0.7); cx.stroke(); }
  } else if (u.gim === 'frenzy' && u.chargeT > 0) {
    const k = 1 - u.chargeT / C.GIM.frenzy.cast;
    cx.strokeStyle = `rgba(255,90,70,${0.55 + 0.4 * Math.sin(t * 18)})`; cx.lineWidth = 3; cx.beginPath(); cx.arc(u.x, cy, w * (1.15 - 0.45 * k), 0, Math.PI * 2); cx.stroke();
    cx.fillStyle = '#ff5a46'; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.lineWidth = 3; cx.font = "900 20px 'Pretendard', sans-serif"; cx.textAlign = 'center'; cx.strokeText('!', u.x, u.y - h - 12); cx.fillText('!', u.x, u.y - h - 12);
  } else if (u.gim === 'regen' && !(u.rgnT > 0)) {   // 재생: 초록 물결이 몸을 타고 오름
    for (let i = 0; i < 3; i++) { const k = ((t * 0.9 + i / 3) % 1); cx.strokeStyle = `rgba(110,255,150,${0.75 * (1 - k)})`; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(u.x, u.y - h * k, w * 0.5 * (1 - k * 0.3), 6, 0, 0, Math.PI * 2); cx.stroke(); }
  } else if (u.gim === 'rampage' && u.rmp > 0) {
    cx.strokeStyle = `rgba(255,${Math.max(60, 170 - u.rmp * 10)},60,.9)`; cx.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t * 7 + i * 2.1; cx.beginPath(); cx.arc(u.x, cy, w * 0.66, a, a + 0.9); cx.stroke(); }
  }
}
// 화면 위 보스 띠: 이름·체력(뒤따라 줄어드는 흰 잔량)·격노까지 남은 시간·기믹 알약
function drawBossBar(cx, st, bc, dt, A) {
  const B = st.boss; if (!B || B.dead || st.params.mode === 'raid') { bc._lagOf = null; return; }
  const r = Math.max(0, Math.min(1, B.hp / B.maxHp)); if (bc._lagOf !== B) { bc._lagOf = B; bc._lag = r; } bc._lag = Math.max(r, bc._lag - dt * 0.4);
  const x0 = 54, w = F.W - 108, y0 = 17, h = 8, gate = st.params.gate;
  const rr = (x, y, ww, hh, rad) => { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, Math.max(0, ww), hh, rad); else cx.rect(x, y, Math.max(0, ww), hh); };
  cx.globalAlpha = B.bornT != null ? Math.max(0, Math.min(1, (st.t - B.bornT) / 0.6)) : 1;
  cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.lineJoin = 'round'; cx.font = "800 10px 'Pretendard', sans-serif";
  cx.textAlign = 'left'; cx.fillStyle = gate ? '#ffb3bd' : '#ffd9a0'; cx.strokeText(B.name, x0, 12); cx.fillText(B.name, x0, 12);
  const pct = r * 100, ptxt = (pct < 10 ? pct.toFixed(1) : Math.ceil(pct)) + '%'; cx.textAlign = 'right'; cx.fillStyle = '#fff'; cx.strokeText(ptxt, x0 + w, 12); cx.fillText(ptxt, x0 + w, 12);
  cx.fillStyle = 'rgba(6,8,16,.85)'; rr(x0 - 2.5, y0 - 2.5, w + 5, h + 5, 6); cx.fill(); cx.strokeStyle = gate ? 'rgba(255,122,138,.9)' : 'rgba(255,179,71,.75)'; cx.lineWidth = 1; cx.stroke();
  cx.fillStyle = 'rgba(255,255,255,.6)'; rr(x0, y0, w * bc._lag, h, 3); cx.fill();
  const g = cx.createLinearGradient && cx.createLinearGradient(x0, 0, x0 + w, 0); if (g && g.addColorStop) { g.addColorStop(0, '#ff4a3a'); g.addColorStop(1, '#ffb347'); }
  cx.fillStyle = g && g.addColorStop ? g : '#ffb347'; rr(x0, y0, w * r, h, 3); cx.fill(); cx.fillStyle = 'rgba(255,255,255,.25)'; cx.fillRect(x0 + 1, y0 + 1, Math.max(0, w * r - 2), 2);
  const en = st.params.enrage;   // 격노: 시작 전에는 줄어드는 가는 선, 시작 뒤에는 배율
  if (en && B.bornT != null) { const e = st.t - B.bornT - en.at;
    if (e < 0) { const k = -e / en.at, ty = y0 + h + 5, th = 5, low = k < 0.25;   // 2026-11-15 사용자 '시간 바가 너무 작다': 2 → 5 높이, 테두리·남은 초 표시, 1/4 아래로 내려가면 붉게 깜박임
      cx.fillStyle = 'rgba(6,8,16,.85)'; rr(x0 - 1.5, ty - 1.5, w + 3, th + 3, 4); cx.fill(); cx.strokeStyle = low ? 'rgba(255,90,70,.9)' : 'rgba(255,255,255,.35)'; cx.lineWidth = 1; cx.stroke();
      cx.fillStyle = low ? `rgba(255,${80 + Math.round(50 * Math.sin(A * 10))},64,1)` : k < 0.5 ? '#ffc46b' : '#e9eefb'; rr(x0, ty, w * k, th, 2.5); cx.fill();
      { const P = st.params, D = P.stage;   // 빠른 진격 눈금(2026-11-24 사용자): 보스 등장 후 C.RUSH.sec 안에 잡으면 진격 — 그 시점 위치에 눈금, 아직 가능하면 눈금 오른쪽 막대를 금색으로
        if (((P.mode === 'stage' && D > S.maxClear && S.autoBoss !== false && D >= C.RUSH.min && D < C.STAGE_MAX) || P.mode === 'tower') && C.RUSH.sec < en.at) {   // 탑은 매 층 빠른 돌파 가능
          const kr = 1 - C.RUSH.sec / en.at, xr = x0 + w * kr, on = bc.bossAt != null && st.t - bc.bossAt <= C.RUSH.sec && k > kr;
          if (on) { cx.fillStyle = '#ffd34f'; cx.fillRect(xr, ty, w * (k - kr), th); }
          cx.fillStyle = 'rgba(0,0,0,.85)'; cx.fillRect(Math.round(xr) - 2, ty - 4, 4, th + 8); cx.fillStyle = on ? '#ffd34f' : 'rgba(233,238,251,.5)'; cx.fillRect(Math.round(xr) - 1, ty - 3, 2, th + 6); } }
      const sec = String(Math.ceil(-e)); cx.font = "800 10px 'Pretendard', sans-serif"; cx.textAlign = 'left'; cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.fillStyle = low ? '#ff8a78' : '#e9eefb'; cx.strokeText(sec, x0 + w + 6, ty + th + 1); cx.fillText(sec, x0 + w + 6, ty + th + 1); }
    else { const tx = '격노 ×' + (B.enr || 1).toFixed(1); cx.font = "800 11px 'Pretendard', sans-serif"; cx.textAlign = 'right'; cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.fillStyle = `rgba(255,${90 + Math.round(60 * Math.sin(A * 9))},70,1)`; cx.strokeText(tx, x0 + w, y0 + h + 12); cx.fillText(tx, x0 + w, y0 + h + 12); } }
  let pillR = x0 + w + 1.5;   // 알약은 오른쪽부터 왼쪽으로 쌓음(기믹 → 그로기)
  const pill = (label, col, fill) => { cx.font = "800 10px 'Pretendard', sans-serif"; const tw = cx.measureText ? (cx.measureText(label) || {}).width || label.length * 9 : label.length * 9, pw = tw + 16, px = pillR - pw, py = y0 + h + 15, ph = 15;
    cx.fillStyle = 'rgba(6,8,16,.88)'; rr(px, py, pw, ph, 7.5); cx.fill(); cx.save(); rr(px, py, pw, ph, 7.5); if (cx.clip) cx.clip(); cx.globalAlpha *= 0.3; cx.fillStyle = col; cx.fillRect(px, py, pw * Math.max(0, Math.min(1, fill)), ph); cx.restore();
    cx.strokeStyle = col; cx.lineWidth = 1.2; rr(px, py, pw, ph, 7.5); cx.stroke(); cx.fillStyle = col; cx.textAlign = 'center'; cx.fillText(label, px + pw / 2, py + 11); pillR = px - 4; };
  const G0 = B.gim; if (G0) { let label, col, fill = 1;
    if (G0 === 'barrier') { if (B.bar > 0) { const k = B.bar / (B.maxHp * C.GIM.barrier.pct); label = '장벽 ' + Math.ceil(k * 100) + '%'; col = '#9fdcff'; fill = k; } else { label = '무방비 ' + Math.max(1, Math.ceil(B.barT)); col = '#ffd34f'; fill = B.barT / C.GIM.barrier.every; } }
    else if (G0 === 'armor') { if (B.armT > 0) { label = '철갑 해제 ' + Math.max(1, Math.ceil(B.armT)); col = '#ffd34f'; fill = B.armT / C.GIM.armor.open; } else { label = '철갑'; col = '#cdd6e4'; } }
    else if (G0 === 'frenzy') { if (B.chargeT > 0) { label = '격분!'; col = '#ff5a46'; fill = 1 - B.chargeT / C.GIM.frenzy.cast; } else { label = '격분' + (B.frz ? ' ×' + B.frz : ''); col = '#ff9a8a'; fill = 1 - Math.max(0, B.chT) / C.GIM.frenzy.every; } }
    else if (G0 === 'regen') { if (B.rgnT > 0) { label = '재생 차단 ' + Math.max(1, Math.ceil(B.rgnT)); col = '#ffd34f'; fill = B.rgnT / C.GIM.regen.open; } else { label = '재생'; col = '#7dff9a'; } }
    else { if (B.rmpOn) { label = '폭주 ×' + B.rmp; col = '#ff9a3c'; fill = B.rmpAcc / C.GIM.rampage.every; } else if (B.rmpBrk) { label = '폭주 해제 ' + Math.max(1, Math.ceil(B.rmpCd)); col = '#ffd34f'; fill = B.rmpCd / C.GIM.rampage.stagger; } else { label = '폭주 ' + Math.max(1, Math.ceil(B.rmpCd)); col = '#ff9a3c'; fill = 1 - B.rmpCd / C.GIM.rampage.first; } }
    pill(label, col, fill); }
  if (C.GROGGY && (B.grgT > 0 || B.grg > 0)) { if (B.grgT > 0) pill('그로기 ' + Math.max(1, Math.ceil(B.grgT)), `rgba(255,${200 + Math.round(40 * Math.sin(A * 12))},90,1)`, B.grgT / C.GROGGY.dur); else pill('CC ' + Math.min(99, Math.floor(B.grg / C.GROGGY.max * 100)) + '%', '#c9a6ff', B.grg / C.GROGGY.max); }   /* 차는 중에는 'CC n%'(2026-11-25 사용자 '계속 그로기인데?' — 차는 중에도 '그로기'라고 떠서 걸린 것처럼 보였음) */   // 보스 그로기 게이지(2026-11-25): 차는 중 = 보라, 그로기 중 = 금색 깜박임
  cx.globalAlpha = 1; cx.textAlign = 'center';
}
// 기믹 설명(2026-11-15, 사용자 '꼬리표를 누르면 어떻게 파훼하는지 알려줘 · 귀찮은 건 싫다'): 무엇을 하는 보스인지 · 무엇이 답인지 · 내 영웅 중 답(누르면 바로 출전)
const GIM_INFO = {   // 2026-11-21 파훼 개편: 같은 영웅의 파훼는 C.GIM_LOCK초에 한 번 — 혼자면 빈틈, 둘이면 번갈아
  barrier: () => [`최대 체력 ${Math.round(C.GIM.barrier.pct * 100)}%짜리 보호막. 있는 동안 본체는 피해를 받지 않고, 깨지면 ${C.GIM.barrier.every}초 뒤 다시 생김`, `연타(질풍)가 걸린 동안 보호막에 ${C.GIM.barrier.comboMul}배 피해 · 같은 영웅은 ${C.GIM_LOCK}초에 한 번`],
  frenzy: () => [`${C.GIM.frenzy.every}초마다 ${C.GIM.frenzy.cast}초 동안 힘을 모아 전체 공격. 터질 때마다 공격력 +${Math.round(C.GIM.frenzy.amp * 100)}%(최대 ${C.GIM.frenzy.max}회)`, `힘을 모으는 동안 실명(빛)으로 끊으면 누적이 사라지고 ${C.GIM.frenzy.stagger}초 쉼 · 같은 영웅은 ${C.GIM_LOCK}초에 한 번`],
  armor: () => [`받는 피해가 ${Math.round(C.GIM.armor.leak * 100)}%로 줄어듦`, `화상(화염)으로 ${C.GIM.armor.open}초 벗겨짐 · 같은 영웅은 ${C.GIM_LOCK}초에 한 번`],
  rampage: () => [`폭주하면 ${C.GIM.rampage.every}초마다 공격력 +${Math.round(C.GIM.rampage.amp * 100)}% · 공격 속도 +${Math.round(C.GIM.rampage.spd * 100)}% 누적(최대 ${C.GIM.rampage.max}회)`, `빙결(서리)로 누적이 사라지고 ${C.GIM.rampage.stagger}초 쉼 · 같은 영웅은 ${C.GIM_LOCK}초에 한 번`],
  regen: () => [`받은 피해의 ${Math.round(C.GIM.regen.keep * 100)}%를 곧바로 되돌림`, `출혈(어둠)로 ${C.GIM.regen.open}초 회복 못 함(쌓인 회복분 소멸) · 같은 영웅은 ${C.GIM_LOCK}초에 한 번`],
};
function gimIsAns(g, id) { return C.gimAnswer(g, G.unitOf(S, id).skills, byId(id).elem); }
function openGim(g) {
  const [what, how] = GIM_INFO[g](); const p = G.activeParty(S);
  const ids = Object.keys(S.heroes).map(Number).filter(id => gimIsAns(g, id)).sort((a, b) => G.heroPower(S, b) - G.heroPower(S, a));
  const inP = ids.filter(id => p.includes(id)), out = ids.filter(id => !p.includes(id)).slice(0, 10);
  const cell = (id, sw) => { const c = byId(id); return `<button class="gimh e-${c.elem} ${sw ? '' : 'in'}" ${sw ? `data-swap="${id}"` : 'disabled'}><img src="${imgOf(id)}" alt=""><b>${c.name.split(' ').pop()}</b><i class="stars s${c.star}">${starStr(c.star)}</i></button>`; };
  modal(`<h2><span class="lbtag gim ${g} big">${C.GIM_KR[g]}</span></h2>
    <div class="giminfo"><div>${what}</div><div class="how">${how}</div></div>
    <h3>출전 중 <span class="muted num">${inP.length}</span></h3><div class="gimrow">${inP.map(id => cell(id, false)).join('') || '<span class="tiny">없음</span>'}</div>
    ${out.length ? `<h3>대기 중 <span class="muted num">${ids.length - inP.length}</span></h3><div class="gimrow">${out.map(id => cell(id, true)).join('')}</div>` : ''}`);
  document.querySelectorAll('#modal [data-swap]').forEach(b => b.onclick = () => { gimSwapIn(+b.dataset.swap, g); openGim(g); });
}
function gimSwapIn(id, g) {   // 답 영웅을 한 번에 출전: 빈 자리가 있으면 거기, 없으면 같은 역할(없으면 수가 겹치는 역할·공격·지원) 중 답이 아닌 가장 약한 동료와 교체. 대표는 건드리지 않음
  const slots = G.slots(S); const cur = G.activeParty(S); if (cur.includes(id) || !S.heroes[id]) return;
  for (let i = 0; i < slots; i++) if (!S.party[i] || !S.heroes[S.party[i]]) { S.party[i] = id; partyChanged(); renderBattleHead(); toast(`<b>${byId(id).name}</b> 출전`); return; }
  const role = (x) => byId(x).role, cnt = (r) => cur.filter(x => role(x) === r).length;
  const safe = cur.slice(1).filter(x => role(x) === role(id) || cnt(role(x)) > 1 || (role(x) !== 'tank' && role(x) !== 'heal'));   // 하나뿐인 수호·치유는 같은 역할이 들어올 때만 뺀다
  const pick = (l) => l.slice().sort((a, b) => G.heroPower(S, a) - G.heroPower(S, b))[0];
  const non = safe.filter(x => !gimIsAns(g, x)); const outId = pick(non.filter(x => role(x) === role(id))) || pick(non) || pick(safe.filter(x => role(x) === role(id))) || pick(safe);
  if (!outId) { toast('교체할 자리 없음'); return; }
  S.party[S.party.indexOf(outId)] = id; partyChanged(); renderBattleHead(); toast(`${byId(outId).name} → <b>${byId(id).name}</b>`);
}
// 전장 한가운데 큰 알림(관문 돌파·빠른 진격·전멸 등 '해소'의 순간) — 한 번에 하나씩 차례로(겹치면 읽을 수 없음)
const BIGQ = []; let bigOn = false;
function bigPop(cls, title, sub, ms) {
  if (tab !== 'battle' || !document.getElementById('fieldwrap')) return;
  if (BIGQ.length < 3) BIGQ.push({ cls, title, sub, ms: ms || 2000 }); if (!bigOn) bigNext();
}
function bigNext() {
  const w = document.getElementById('fieldwrap'), x = BIGQ.shift(); if (!x || !w || tab !== 'battle') { BIGQ.length = 0; bigOn = false; return; }
  bigOn = true; const ms = BIGQ.length ? Math.min(x.ms, 1300) : x.ms;   // 뒤에 기다리는 알림이 있으면 짧게
  const d = document.createElement('div'); d.className = 'bigpop ' + x.cls; d.style.animationDuration = ms + 'ms'; d.innerHTML = `<i></i><b>${x.title}</b>${x.sub ? `<span>${x.sub}</span>` : ''}`; w.appendChild(d);
  setTimeout(() => { d.remove(); bigNext(); }, ms);
}
// 궁극기(2번째 스킬) 컷인: 전장 하단에서 일러스트 + 스킬명이 올라온다
let ultT = 0, ultAt = -1e9;
const ULT_GAP_MS = 0;   // 컷인 빈도 제한 없음 (대신 스킬 쿨타임 자체를 ×3)
// 궁극기 컷인 효과 태그(최대 3개) — 고유기는 영웅별, 일반 궁극기는 종류별
// 컷인 효과 태그(2026-11-21): 손으로 적은 표(SIG_TAGS) 대신 실제 스킬 수치(전용장비로 바뀐 효과 포함)에서 만든다 — 스킬이 바뀌어도 태그가 따라감
const DEB_KR = { burn: '화상', freeze: '빙결', combo: '연타', blind: '실명', bleed: '출혈' };
function ultTags(sk, hid, elem) {
  if (!sk) return [];
  const pn = sk.postNova || {}, T = [], add = (t, pr) => { if (t && !T.some(x => x[0] === t)) T.push([t, pr]); };
  const area = { single: '단일', bash: '단일', execute: '단일', multi: '단일', line: '관통', chain: '연쇄', aoe: '광역', nova: '광역', meteor: '광역', whirl: '광역', vortex: '광역', plague: '광역', dive: '광역', timestop: '광역', slowall: '광역', debuffatk: '광역', debuffdef: '광역', vulnall: '광역', mark: '광역' }[sk.type];
  add(area, 9);
  if (sk.grant) add(DEB_KR[sk.grant] + ' 부여', 0);
  if (C.ELEM_DEBUFFS.includes(sk.fx)) add(DEB_KR[sk.fx], 1);
  if (sk.burn || sk.hBurn || pn.burn) add('화상', 1);
  if (sk.bleed || sk.hBleed || pn.bleed) add('출혈', 1);
  if (sk.blind || pn.blind) add('실명', 1);
  const slow = sk.hSlow || sk.postSlow || sk.type === 'slowall' || (sk.type === 'vortex' && !sk.noSlow) || sk.fx === 'slow';
  if (sk.type === 'timestop') add(elem === 'water' ? '빙결' : '수면', 1); else if (slow) add(elem === 'water' ? '빙결' : '둔화', 1);
  if (sk.type === 'plague') add('중독', 2);
  if (sk.stun || sk.hStun || pn.stun || sk.type === 'bash') add('기절', 2);
  if (sk.type === 'execute') add('처형', 2);
  if (sk.hVuln || pn.vuln || sk.type === 'mark' || sk.type === 'vulnall') add('받는 피해↑', 3);
  if (sk.type === 'debuffatk') add('공격↓', 3);
  if (sk.type === 'debuffdef') add('방어↓', 3);
  if (sk.type === 'resurrect' || sk.revHp) add('부활', 3);
  if (sk.type === 'shield' || sk.postShield) add('보호막', 4);
  if (sk.type === 'heal' || sk.type === 'healall' || sk.type === 'bless' || sk.heal || sk.postHeal) add('회복', 4);
  if (sk.type === 'sanctuary') add('지속 회복', 4);
  if (sk.type === 'buffatk' || sk.type === 'bless' || sk.postAtk || sk.atk) add('공격↑', 5);
  if (sk.type === 'buffaspd' || sk.postAspd || sk.aspd) add('공속↑', 5);
  if (sk.skl) add('스킬 피해↑', 5);
  if (sk.cdm) add('치명타 피해↑', 5);
  if (sk.postCdr) add('쿨↓', 5);
  if (sk.postDr || sk.drSelf) add('피해↓', 5);
  if (sk.type === 'guardall' || sk.selfDef || sk.def) add('방어↑', 6);
  if (sk.type === 'berserk') add('광폭', 6);
  if (sk.reflect) add('반사', 6);
  if (sk.drain || sk.hDrain || sk.lsBuff) add('흡혈', 6);
  if (sk.hits >= 3 && (sk.type === 'multi' || sk.type === 'whirl' || sk.type === 'chain')) add(sk.hits + '연격', 6);
  if (sk.kb) add('넉백', 7);
  if (sk.type === 'vortex') add('끌어당김', 7);
  const head = area ? [area] : [], rest = T.filter(x => x[0] !== area && !(sk.grant && x[0] === DEB_KR[sk.grant])).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  return head.concat(rest).slice(0, 3);
}
function showUlt(e) {
  const el = document.getElementById('ultban'); if (!el || tab !== 'battle') return;
  const now = performance.now(); if (now - ultAt < ULT_GAP_MS) return; ultAt = now;
  const c = illCfg(e.hid), im = el.querySelector('.ui');
  if (c) { // 얼굴 전체가 띠 높이에 들어가도록 축소: 얼굴 높이(h%)가 띠의 약 82%를 차지하게 맞추고, 얼굴 중심을 상자 왼쪽 30%·세로 중앙에 둔다
    im.className = 'ui'; im.style.width = ''; im.style.backgroundImage = `url(${c.src})`;
    const bw = im.clientWidth || 230, bh = im.clientHeight || 40, ar = c.ar || 1.5, f = c.face || [50, (c.y == null ? 15 : c.y) + 6, 12];
    const imgH = bh * 0.5 / ((f[2] || 12) / 100), imgW = imgH / ar;   // 얼굴이 띠 높이의 절반 — 어깨까지 보이게
    const px = Math.min(0, Math.round(0.3 * bw - f[0] / 100 * imgW));
    im.style.backgroundSize = Math.round(imgW) + 'px ' + Math.round(imgH) + 'px';
    im.style.backgroundPosition = `${px}px ${Math.round(0.42 * bh - f[1] / 100 * imgH)}px`;
    im.style.width = Math.round(Math.min(bw, imgW + px)) + 'px'; // 상자를 그림 폭에 맞춰야 오른쪽 페이드가 그림 끝에 걸린다
  }
  else { im.className = 'ui px'; im.style.backgroundImage = `url(${imgOf(e.hid)})`; im.style.backgroundPosition = ''; im.style.backgroundSize = ''; im.style.width = ''; }
  el.querySelector('small').textContent = e.who;
  el.querySelector('b').textContent = e.name.replace(/^각성·/, '');
  el.querySelector('.ud').innerHTML = ultTags(e.sk, e.hid, e.elem).map(x => `<i>${x}</i>`).join('');
  el.className = e.elem || ''; void el.offsetWidth; el.className = 'on ' + (e.elem || '');   // 매번 처음부터: 올라온 뒤 그림이 오른쪽으로 살짝 흐름
  clearTimeout(ultT); ultT = setTimeout(() => { el.className = e.elem || ''; }, 1400);
}
function addLog() { }   // 전투 로그 줄은 없앰 (획득 내역은 전장 좌측 feed로)
function feed(html) { // 전장 좌측 상단 획득 알림: 최대 4줄, 3초 뒤 사라짐
  const f = document.getElementById('feed'); if (!f || tab !== 'battle') return;
  const d = document.createElement('div'); d.innerHTML = html; f.appendChild(d);
  while (f.children.length > 4) f.removeChild(f.firstChild);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 520); }, 3000);
}

function renderBattle(m) {
  m.innerHTML = `<div id="bhead"><div class="stage" id="bstage"></div><div class="hchips" id="bchips"></div><div class="nav"><button class="btn" id="b-speed" aria-label="배속"></button><button class="btn" id="b-auto" aria-label="보스 도전"><span><svg width="20" height="20"><use href="#i-skull"/></svg></span></button><button class="btn" id="b-exit" aria-label="나가기" hidden><svg width="18" height="18"><use href="#i-x"/></svg></button></div></div>
    <div id="fieldwrap"><canvas id="field" width="360" height="325"></canvas><div id="bstat" aria-hidden="true"></div><div id="feed"></div><div id="ultban" aria-hidden="true"><div class="ui"></div><div class="ut"><small></small><b></b><span class="ud"></span></div></div></div>
    <div id="killov"><div id="presets"></div></div>
    <div id="pstrip"></div>
    <div class="card" id="uppanel"></div>
    <div class="card" id="relicpanel"></div>`;
  $('#b-exit').onclick = () => { if (BC.ctx.kind !== 'dungeon' && BC.ctx.kind !== 'tower' && BC.ctx.kind !== 'dummy') return; BC.ctx = { kind: 'stage' }; BC.st = null; BC.rebuild(false); renderBattleHead(); save(); };   // 던전·탑 도중 나가기(예전에는 '이전 스테이지' 버튼이 겸했음)
  $('#b-speed').onclick = () => { S.speed = S.speed >= 3 ? 1 : S.speed + 1; save(); renderBattleHead(); };
  $('#b-auto').onclick = () => { S.autoBoss = S.autoBoss === false; if (BC.st) BC.st.params.autoBoss = S.autoBoss !== false; save(); renderBattleHead(); };
  renderUpgrades();
  BC.start();
  renderPresets();
  fitField();
}
// 편성 프리셋(2026-11-19 → 2026-11-22 속성별): 화·서·질·빛·어 = 저장한 편성 + 장비(공용 장비 3부위·출전 영웅 전용장비) 불러오기, '저장'을 누른 뒤 속성을 누르면 지금 편성·장비를 저장.
// 보유하지 않게 된 영웅·남는 칸·분해한 장비는 빼고 불러옴(빠진 부위는 지금 장비 유지). 옛 번호 프리셋 S.presets는 그대로 남겨 둠(안 씀)
let presetSave = false;
function psetSnap() { const party = G.activeParty(S).slice(), ex = {}; G.ensureEx(S); for (const h of party) if (S.ex.on[h]) ex[h] = S.ex.on[h]; return { party, eq: Object.assign({}, G.ensureEq(S).on), ex }; }
function psetIds(p) { return p.party.filter(id => S.heroes[id]).slice(0, G.slots(S)); }
function psetSame(p) {
  if (psetIds(p).join(',') !== G.activeParty(S).join(',')) return false;
  for (const k in p.eq || {}) if (p.eq[k] && G.eqItem(S, p.eq[k]) && S.eq.on[k] !== p.eq[k]) return false;
  for (const h in p.ex || {}) if (G.exItem(S, p.ex[h]) && S.ex.on[h] !== p.ex[h]) return false;
  return true;
}
function renderPresets() {
  const el = $('#presets'); if (!el) return; const P = S.epresets || (S.epresets = {});
  el.innerHTML = C.ELEMS.map(e => { const p = P[e]; return `<button class="pset pe ${p ? 'has' : ''} ${!presetSave && p && psetSame(p) ? 'on' : ''}" style="--ec:${C.ELEM_COLOR[e]}" data-pset="${e}">${C.ELEM_NAME[e][0]}</button>`; }).join('') + `<button class="pset sv ${presetSave ? 'on' : ''}" id="pset-save">저장</button>`;
  el.classList.toggle('saving', presetSave);
  el.querySelectorAll('[data-pset]').forEach(b => b.onclick = () => { const e = b.dataset.pset, nm = C.ELEM_NAME[e];
    if (presetSave) { P[e] = psetSnap(); presetSave = false; save(); toast(`${nm} 편성 저장`); renderPresets(); return; }
    const p = P[e]; if (!p) return; const ids = psetIds(p); if (!ids.length) return; if (psetSame(p)) return;
    S.party = ids; for (const k in p.eq || {}) if (p.eq[k]) G.eqEquip(S, p.eq[k]); for (const h in p.ex || {}) G.exEquip(S, p.ex[h]);
    partyChanged(); renderBattleHead(); renderPresets(); toast(`${nm} 편성`); });
  $('#pset-save').onclick = () => { presetSave = !presetSave; renderPresets(); };
}
// 전장 세로를 화면에 맞춤(2026-11-19, 사용자 '남는 공간을 전투 화면으로 꽉 채워' + '유물 줄까지 다 나와야 함'): 스탯 강화·유물이 접힌 상태에서 유물 줄 아래가 탭 바 위에 딱 닿게. 최소 280, 최대 560(처음 크기 325)
function fitField() {
  const m = $('#main'), cv = $('#field'), last = $('#relicpanel'); if (!m || !cv || !last || !cv.clientWidth) return;
  let open = 0; for (const p of [$('#uppanel'), $('#relicpanel')]) if (p && p.classList.contains('open')) { const h = p.querySelector('.phead'); open += p.offsetHeight - (h ? h.offsetHeight : 0); }
  const pb = parseFloat(getComputedStyle(m).paddingBottom) || 0; const free = m.getBoundingClientRect().bottom - pb - (last.getBoundingClientRect().bottom + m.scrollTop - open);
  const nh = Math.max(280, Math.min(560, Math.round((cv.clientHeight + free) * F.W / cv.clientWidth)));
  if (Math.abs(nh - F.H) < 4) return;
  F.setH(nh); if (RPG.BG && RPG.BG.setH) RPG.BG.setH(nh); BC.resize(); if (BC.st) BC.rebuild(true);
}
window.addEventListener('resize', () => { if (tab === 'battle') setTimeout(fitField, 50); });
// 상태 아이콘(2026-11-15, 사용자 '보스에 걸린 디버프·버프를 시간 바 아래에, 영웅 버프는 초상화 아래 작은 아이콘으로'): 전투 엔진의 지속 효과(u.b · 보호막 · 흡혈 강화)를 그대로 읽음
//   [아이콘, 버프(b)·디버프(d), 꾸밈(u 올림 화살표 · dn 내림 화살표 · f 채움)]. 색은 그 유닛 기준 — 버프 = 푸른색, 디버프 = 붉은색(보스·영웅 같은 기준. 처음엔 '내 편에 좋은가'로 칠해 보스의 화상이 푸르게 나왔고, 사용자 '화상도 디버프잖아')
const ST_DEF = { stun: ['stun', 'd', ''], burn: ['flame', 'd', ''], mark: ['mark', 'd', ''], defD: ['shield', 'd', 'dn'], atkD: ['sword', 'd', 'dn'], slow: ['sand', 'd', ''], ice: ['sand', 'd', 'f'],
  atkU: ['sword', 'b', 'u'], defU: ['shield', 'b', 'u'], fast: ['fast', 'b', ''], shld: ['shield', 'b', 'f'], hot: ['plus', 'b', ''], taunt: ['hand', 'b', ''], ls: ['drop', 'b', ''], skl: ['spark', 'b', 'u'], cdm: ['mark', 'b', 'u'], crt: ['stun', 'b', 'u'], combo: ['fast', 'd', ''], blind: ['eye', 'd', ''], bleed: ['drop', 'd', ''] };
function unitStatus(u) {
  const b = u.b || {}, o = [];
  if (b.stunT > 0) o.push(['stun', b.stunT]); if (b.burnT > 0) o.push(['burn', b.burnT, b.burnN]); if (b.bleedT > 0) o.push(['bleed', b.bleedT, b.bleedN]); if (b.comboT > 0) o.push(['combo', b.comboT, b.comboN]); if (b.blindT > 0) o.push(['blind', b.blindT, b.blindN]); if (b.vulnT > 0) o.push(['mark', b.vulnT]);
  if (b.defT > 0 && b.def < 0) o.push(['defD', b.defT]); if (b.atkT > 0 && b.atk < 0) o.push(['atkD', b.atkT]); if (u.iceT > 0) o.push(['ice', u.iceT / (C.BUFF_DUR || 1)]); if (b.slowT > 0) o.push(['slow', b.slowT, b.frzT > 0 ? b.frzN : 0]);
  if (b.atkT > 0 && b.atk > 0) o.push(['atkU', b.atkT]); const dU = Math.max(b.defT > 0 && b.def > 0 ? b.defT : 0, b.gdrT > 0 ? b.gdrT : 0); if (dU > 0) o.push(['defU', dU]);
  if (b.aspdT > 0 && b.aspd > 0) o.push(['fast', b.aspdT]); if (u.shield > 0 && u.shieldT > 0) o.push(['shld', u.shieldT]); if (b.hotT > 0) o.push(['hot', b.hotT]); if (b.tauntT > 0) o.push(['taunt', b.tauntT]); if (u.lsBuffT > 0) o.push(['ls', u.lsBuffT]); if (b.sklT > 0) o.push(['skl', b.sklT]); if (b.cdmT > 0) o.push(['cdm', b.cdmT]); if (b.crtT > 0) o.push(['crt', b.crtT]);
  return o;
}
function statusFill(el, list, hero, sec) {   // 내용이 바뀔 때만 다시 그림(초 표시는 정수 단위)
  if (hero) list = list.filter(x => ST_DEF[x[0]][1] === 'b').concat(list.filter(x => ST_DEF[x[0]][1] === 'd'));
  const K = C.BUFF_DUR || 1;   // 타이머 값 × 배율 = 실제 남은 초
  const rs = (k, v) => Math.max(1, Math.ceil(v * (k === 'stun' ? 1 : K)));   // 기절은 지속 배율 없음
  const sig = list.map(([k, v, n]) => k + (sec ? rs(k, v) : '') + (n > 1 ? 'x' + n : '')).join(','); if (el.dataset.s === sig) return; el.dataset.s = sig;
  el.innerHTML = list.map(([k, v, n]) => { const d = ST_DEF[k]; return `<i class="sti ${d[1] === 'b' ? 'g' : 'x'}"><span class="ic ${d[2]}"><svg><use href="#i-${d[0]}"/></svg></span>${n > 1 ? `<u>×${n}</u>` : ''}${sec ? `<b>${rs(k, v)}</b>` : ''}</i>`; }).join('');   // n = 중첩 수(2026-11-25 속성 디버프 중첩 — 화상·실명)
}
function updBossStat() {   // 보스 띠 아래 줄 왼쪽(오른쪽은 기믹 알약 — drawBossBar)
  const el = $('#bstat'); if (!el || !BC.st) return; const B = BC.st.boss, on = !!B && !B.dead && BC.st.params.mode !== 'raid';
  if (el.hidden === on) el.hidden = !on; if (on) statusFill(el, unitStatus(B), false, true);
}
// 보스 속성·상성(2026-11-18, 사용자 '지금 라운드가 어떤 속성이고 어떤 속성이랑 어떤 관계인지 전투 화면에'): 머리줄에 보스 속성 알약(누르면 상성표 창), 출전 줄 초상화에 유리 ▲ · 불리 ▼
function bossElem() {
  const p = BC.st && BC.st.params; if (p && p.boss && p.boss.elem) return p.boss.elem;
  if (BC.ctx.kind === 'stage') { const b = C.stageParams(BC.curStage(), G.slots(S), S.autoBoss !== false).boss; return b && b.elem || null; }
  return null;
}
function advMark(he, be) { if (!be) return ''; const k = C.elemMult(he, be); return k > 1 ? '<i class="adv up">▲</i>' : k < 1 ? '<i class="adv dn">▼</i>' : ''; }
function openElemInfo(be) {
  const x = (k, inv) => { const g = inv ? k < 1 : k > 1, b = inv ? k > 1 : k < 1; return `<b class="${g ? 'up' : b ? 'dn' : ''}">×${k}</b>`; }; const party = G.activeParty(S);   // 받는 피해는 낮을수록 좋음(초록)
  const rows = C.ELEMS.map(e => { const ids = party.filter(id => byId(id).elem === e);
    return `<tr class="${ids.length ? 'has' : ''}"><th>${elemDot(e)}${C.ELEM_NAME[e]}</th><td>${x(C.elemMult(e, be))}</td><td>${x(C.elemMult(be, e), true)}</td><td class="eh">${ids.map(id => `<img src="${imgOf(id)}" alt="${byId(id).name}">`).join('')}</td></tr>`; }).join('');
  modal(`<h2><span class="eyebrow">보스 속성</span>${elemDot(be)} ${C.ELEM_NAME[be]}</h2>
    <table class="eltab"><thead><tr><th>내 영웅</th><th>주는 피해</th><th>받는 피해</th><th>출전</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="elcyc">${['fire', 'wind', 'water', 'fire'].map(e => elemDot(e) + C.ELEM_NAME[e]).join(' → ')} <span>×${C.ADV} · 반대 ×${C.DIS}</span></div>
    <div class="elcyc">${elemDot('light')}${C.ELEM_NAME.light} ↔ ${elemDot('dark')}${C.ELEM_NAME.dark} <span>서로 ×${C.ADV_LD}</span></div>`);
}
// 출전 줄(2026-11-15, 사용자 '메인 창이 비는데 출전 캐릭터를 넣을까' → '버프 아이콘으로' → '캐릭터 위에 이번 전투 피해 %' → '스킬 아이콘 두 개를 캐릭터 아래에'): 지금 싸우는 영웅의 이번 전투 피해 비중 · 도트 · 체력 · 걸려 있는 버프/디버프 아이콘 · 스킬 2칸(쿨타임). 누르면 영웅 상세, 빈 칸은 정보 탭으로
//   피해 비중 = u.dmgOut(field.js) ÷ 합. 새 전투(다음 스테이지·층, 전멸 뒤 재입장, 던전 입장)마다 0부터 — 능력치만 다시 계산하는 rebuild(true)에서는 이어받음. 가장 높은 영웅은 금색
function renderPStrip() {
  const el = $('#pstrip'); if (!el || !BC.st) return; const hs = BC.st.heroes; const stage = BC.ctx.kind === 'stage';
  const n = stage ? Math.max(hs.length, G.slots(S)) : hs.length; const be = bossElem(); const key = hs.map(h => h.id).join(',') + '|' + n + '|' + be;
  if (el.dataset.k === key && el.children.length) return; el.dataset.k = key;
  el.innerHTML = Array.from({ length: n }, (_, i) => { const h = hs[i];
    return h ? `<button class="ps e-${h.elem} ${i === 0 ? 'main' : ''}" data-id="${h.id}" aria-label="${h.name}"><span class="dm num"><svg width="9" height="9"><use href="#i-sword"/></svg><b>-</b></span><span class="pp"><img src="${imgOf(h.id)}" alt="">${advMark(h.elem, be)}</span><span class="hpb"><i></i></span><span class="bf"></span><span class="sks">${h.skills.map(sk => `<i class="skc ${sk.ult ? 'ult' : ''}"${sk.icon ? ` style="${C.skIcoBg(sk.icon)}"` : ''}>${sk.icon ? '' : '<svg width="14" height="14"><use href="#i-skill"/></svg>'}<em></em></i>`).join('')}</span></button>`
      : `<button class="ps empty" data-add="1" aria-label="영웅 출전"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>`; }).join('');
  el.querySelectorAll('.ps[data-id]').forEach(b => b.onclick = () => openHero(+b.dataset.id));
  el.querySelectorAll('.ps[data-add]').forEach(b => b.onclick = () => setTab('heroes'));
}
function updPStrip() {
  const el = $('#pstrip'); if (!el || !BC.st) return; renderPStrip();
  const now = performance.now(), txt = now - (BC._dmT || 0) > 500; let tot = 0, top = 0; if (txt) { BC._dmT = now; for (const h of BC.st.heroes) { const v = h.dmgOut || 0; tot += v; if (v > top) top = v; } }   // 피해 비중 글자는 0.5초마다
  BC.st.heroes.forEach((h, i) => { const c = el.children[i]; if (!c || !c.dataset.id) return; const r = h.dead ? 0 : Math.max(0, Math.min(1, h.hp / h.maxHp));
    const bar = c.querySelector('.hpb i'); const w = Math.round(r * 100) + '%'; if (bar.style.width !== w) { bar.style.width = w; bar.className = r < 0.3 ? 'lo' : r < 0.6 ? 'mid' : ''; }
    if (c.classList.contains('dead') !== !!h.dead) c.classList.toggle('dead', !!h.dead);
    statusFill(c.querySelector('.bf'), h.dead ? [] : unitStatus(h), true, false);
    const sk = c.querySelector('.sks'); h.skills.forEach((k, j) => { const e = sk.children[j]; if (!e) return; const pc = h.dead ? 100 : Math.round(Math.max(0, Math.min(1, k.ready / k.cd)) * 100); if (e._pc !== pc) { e._pc = pc; e.lastElementChild.style.height = pc + '%'; e.classList.toggle('ready', pc === 0); } });   // 스킬 2칸: 쿨타임만큼 아래에서 어둡게, 준비되면 금테
    if (txt) { const v = h.dmgOut || 0, s = tot > 0 ? Math.round(v / tot * 100) + '%' : '-'; const d = c.querySelector('.dm'), b = d.firstElementChild.nextElementSibling; if (b.textContent !== s) b.textContent = s; const isTop = tot > 0 && v === top; if (d.classList.contains('top') !== isTop) d.classList.toggle('top', isTop); } });
}
// 보스 배너 아랫줄: 보스 이름이 아직 없으면(보스 등장 전) 지금 싸우는 곳 이름 — 'BOSS / BOSS'로 겹쳐 나오던 것 수정(2026-11-19)
function ctxTitle() { const k = BC.ctx.kind; return k === 'tower' ? `무한의 탑 ${BC.ctx.floor}층` : k === 'dungeon' ? C.DG[BC.ctx.dkind].name : k === 'raid' ? '주간 레이드' : k === 'dummy' ? '허수아비' : `스테이지 ${BC.curStage()}`; }
// 제목이 꼬리표·버튼과 겹치면 글자를 줄임(28px → 최소 18px)
function fitTitle() { const st = $('#bstage'); if (!st) return; st.style.fontSize = ''; let f = 28; while (st.scrollWidth > st.clientWidth + 1 && f > 18) { f -= 1; st.style.fontSize = f + 'px'; } }
function renderBattleHead() {
  const st = $('#bstage'); if (!st || !$('#b-speed')) return;
  const slots = G.slots(S);
  const gtag = (g) => `<button class="lbtag gim ${g}" data-gim="${g}">${C.GIM_KR[g]}<i></i></button>`;
  // 머리줄 윗줄 작은 글씨(장 이름·최고·원정대 n/n·최고 n층·n초 등)는 전부 삭제(2026-11-19, 사용자 '지저분한 건 싹 다') — 제목 + 꼬리표만
  // 머리줄 꼬리표(관문·보스·기믹·보스 속성)는 한 묶음(.hchips)으로 — 자리가 모자라면 묶음째 다음 줄로(2026-11-19, 사용자 '신속 화염이 한 줄에 같이')
  const be = bossElem(); const chips = []; let head = '';
  if (BC.ctx.kind === 'stage') { const s = BC.curStage(); const up = BC._lastS != null && s > BC._lastS; BC._lastS = s; head = `스테이지 <em${up ? ' class="up"' : ''}>${s}</em>`;
    if (C.isGate(s)) chips.push('<span class="lbtag gate">관문</span>', gtag(C.gimOf(s / C.GATE.every - 1))); else if (s % (10 * C.STAGE_DISP) === 0) chips.push('<span class="lbtag">보스</span>'); }
  else if (BC.ctx.kind === 'tower') { head = `무한의 탑 <em>${BC.ctx.floor}</em>층`; if (BC.ctx.floor % 10 === 0) chips.push(gtag(C.gimOf(BC.ctx.floor / 10 - 1))); }
  else if (BC.ctx.kind === 'dungeon') { const d = C.DG[BC.ctx.dkind]; head = `${d.name} <em>Lv.${BC.ctx.level}</em>`; }
  else head = BC.ctx.kind === 'dummy' ? '허수아비' : `주간 레이드`;
  if (be) chips.push(`<button class="elchip e-${be}" data-elinfo="${be}" aria-label="${C.ELEM_NAME[be]} 속성 상성">${elemDot(be)}${C.ELEM_NAME[be]}</button>`);
  // 꼬리표는 제목 오른쪽·배속 버튼 왼쪽에 2줄 격자(위→아래, 다 차면 왼쪽 옆 칸으로) — 2026-11-19 사용자 '재생·어둠을 ×3 왼쪽에 위아래 두 줄로, 3·4개면 옆으로'
  st.innerHTML = head; const hc = $('#bchips'); if (hc) { hc.innerHTML = chips.join(''); hc.classList.toggle('one', chips.length <= 1); }
  const bh = $('#bhead'); bh.querySelectorAll('[data-gim]').forEach(b => b.onclick = () => openGim(b.dataset.gim));
  bh.querySelectorAll('[data-elinfo]').forEach(b => b.onclick = () => openElemInfo(b.dataset.elinfo));
  fitTitle();
  renderPStrip();
  $('#b-speed').textContent = '×' + (S.speed || 1);
  const isStage = BC.ctx.kind === 'stage';   // 보스 도전 켬/끔은 스테이지에서만 의미가 있음 → 던전·탑에서는 그 자리에 나가기
  $('#b-auto').hidden = !isStage; $('#b-exit').hidden = !(BC.ctx.kind === 'dungeon' || BC.ctx.kind === 'tower' || BC.ctx.kind === 'dummy');
  $('#b-auto').classList.toggle('spin', S.autoBoss !== false);   // 켜져 있으면 테두리 빛이 시계방향으로 돈다
  $('#b-auto').setAttribute('aria-pressed', S.autoBoss !== false ? 'true' : 'false');
}
function upValue(key) {
  const u = C.UP[key], lv = S.up[key] || 0;
  if (u.comp) return '+' + Math.round((C.upMult(key, lv) - 1) * 100) + '%';
  if (key === 'crit') return (5 + lv * u.step).toFixed(1) + '%';
  if (key === 'cdmg') return (150 + lv * u.step) + '%';
  return '+' + (lv * u.step) + '%';
}
const fold = (() => { try { return JSON.parse(localStorage.getItem('starband_fold') || '{}'); } catch (e) { return {}; } })();   // 전투 탭 접기 상태(기본 접힘)
const setFold = (k, v) => { fold[k] = v; try { localStorage.setItem('starband_fold', JSON.stringify(fold)); } catch (e) {} };
function renderUpgrades() {
  const p = $('#uppanel'); if (!p) return; const open = !!fold.up; p.classList.toggle('open', open);
  p.innerHTML = `<div class="phead"><h3 class="fold" id="up-tg">스탯 강화${'<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'}</h3><span class="pw num">전투력 <b>${fmt(G.partyPower(S))}</b></span><button class="btn s p" id="up-allin" style="min-height:34px">골드 올인</button></div>
` + (!open ? '' : C.UP_KEYS.map(k => {
    const c1 = G.upCost(S, k, 1), c10 = G.upCost(S, k, 10); const maxed = c1.n === 0;
    return `<div class="uprow"><div class="t"><b>${C.UP[k].kr} <span class="lvl num">Lv.${S.up[k] || 0}</span></b></div>
      <button class="btn ${S.gold >= c1.cost && !maxed ? 'p' : ''}" data-up="${k}" data-n="1" ${maxed || S.gold < c1.cost ? 'disabled' : ''}>${maxed ? 'MAX' : '강화<span class="cost">' + fmt(c1.cost) + '</span>'}</button>
      <button class="btn x" data-up="${k}" data-n="10" ${maxed || S.gold < c10.cost ? 'disabled' : ''}>×${c10.n || 10}<span class="cost">${fmt(c10.cost)}</span></button></div>`;
  }).join(''));
  $('#up-tg').onclick = () => { setFold('up', !open); renderUpgrades(); };
  $('#up-allin').onclick = () => {
    const before = G.partyPower(S); let n = 0, guard = 0;
    while (guard++ < 5000) { const c = ['atk', 'hp', 'def'].map(k => ({ k, c: G.upCost(S, k, 1) })).filter(x => x.c.n > 0).sort((a, b) => a.c.cost - b.c.cost)[0]; if (!c || S.gold < c.c.cost) break; G.upgrade(S, c.k, 1); n++; }
    if (n) { save(); renderTop(); renderUpgrades(); if (BC.st) BC.rebuild(true); } else toast('강화할 골드가 부족합니다');   // 성공 알림은 가운데 전투력 표시(powerCheck)로 대체(2026-11-02 사용자)
  };
  p.querySelectorAll('button[data-up]').forEach(b => b.onclick = () => { const n = G.upgrade(S, b.dataset.up, +b.dataset.n); if (n) { save(); renderTop(); renderUpgrades(); if (BC.st) BC.rebuild(true); } });
  renderRelics();
}
function renderRelics() {
  const p = $('#relicpanel'); if (!p) return;
  const ss = S.sshard || 0; const open = !!fold.relic; p.classList.toggle('open', open);
  const RI = { crown: 'crown', aegis: 'shield', hand: 'hand', eye: 'eye', sand: 'sand', scythe: 'scythe' };
  p.innerHTML = `<div class="phead"><h3 class="fold" id="relic-tg">유물<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></h3><span class="pw num">보유 <b>${fmt(ss)}</b>${ico('ssh')}</span></div>` + (!open ? '' : C.RELIC_KEYS.map(k => {
    const r = C.RELICS[k], lv = G.relicLv(S, k), c = G.relicCost(S, k);
    return `<div class="uprow relic"><div class="t"><b><svg><use href="#i-${RI[k] || 'ssh'}"/></svg>${r.name} <span class="lvl num">Lv.${lv}</span></b><span class="val num">${r.fmt(lv)}</span></div>
      <button class="btn ${c != null && ss >= c ? 'p' : ''}" data-relic="${k}" ${c == null || ss < c ? 'disabled' : ''}>${c == null ? 'MAX' : '강화<span class="cost">' + fmt(c) + ico('ssh') + '</span>'}</button><span></span></div>`;
  }).join(''));
  $('#relic-tg').onclick = () => { setFold('relic', !open); renderRelics(); };
  p.querySelectorAll('button[data-relic]').forEach(b => b.onclick = () => { if (G.relicUp(S, b.dataset.relic)) { save(); renderTop(); renderRelics(); if (BC.st) BC.rebuild(true); const r = C.RELICS[b.dataset.relic]; toast(`${r.name} Lv.${G.relicLv(S, b.dataset.relic)} · ${r.fmt(G.relicLv(S, b.dataset.relic))}`); } });
}
setInterval(() => { if (S && tab === 'battle' && !document.hidden) { renderTop(); const p = $('#uppanel'); if (p) p.querySelectorAll('button[data-up]').forEach(b => { const c = G.upCost(S, b.dataset.up, +b.dataset.n); b.disabled = c.n === 0 || S.gold < c.cost; b.classList.toggle('p', b.dataset.n === '1' && c.n > 0 && S.gold >= c.cost); }); } }, 1000);

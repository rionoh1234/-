// 상수·수식 4: 티켓제 던전·레이드 보스
(function (g) {
  const C = g.RPG.C;
  const T = g.TUNE || {};
  // ---------- 티켓제 던전 (시간 리필 · 소탕) ----------
  C.TICKET_MAX = 3;
  C.TICKET_REFILL_MS = 4 * 3600 * 1000;   // 4시간에 1장 → 12시간 비우면 3장
  C.RAID_REFILL_MS = 8 * 3600 * 1000;     // 레이드는 8시간에 1장
  C.DG_UNLOCK = 100;   // 2026-11-18 새 단위(×10)                      // 던전 개방 스테이지
  C.DG_TIME = 60;                         // 던전 제한 시간(초)
  C.DG = {
    gold: { name: '황금 광산', icon: '⛏️', mobs: ['golem', 'slime', 'mushroom', 'gob_spear', 'bandit'], boss: 'troll', hue: 40, ground: '#4a3e1e', desc: '골드' },
    crys: { name: '수정 동굴', icon: '💎', mobs: ['eye', 'ghost', 'spider', 'crystal_golem', 'ice_spirit'], boss: 'frost_queen', hue: 200, ground: '#1e3a4a', desc: '보석' },
    soul: { name: '영혼의 제단', icon: '🔮', mobs: ['skeleton', 'ghost', 'darkmage', 'wraith', 'reaper'], boss: 'archmage', hue: 280, ground: '#2e1e4a', desc: '영혼석' },
    t_fire: { name: '화염의 시련', el: 'fire', mobs: ['golem', 'imp', 'fire_spirit', 'hell_knight', 'scorpion'], boss: 'hell_lord', hue: 0, desc: '승급석' },
    t_water: { name: '서리의 시련', el: 'water', mobs: ['slime', 'ice_golem', 'frost_wolf', 'jelly', 'ice_spirit'], boss: 'ice_dragon', hue: 200, desc: '승급석' },
    t_wind: { name: '질풍의 시련', el: 'wind', mobs: ['goblin', 'wolf', 'treant', 'vine', 'druid'], boss: 'tree_giant', hue: 100, desc: '승급석' },
    t_light: { name: '빛의 시련', el: 'light', mobs: ['ghost', 'eye', 'seraph', 'crystal_golem', 'fallen_priest'], boss: 'war_angel', hue: 45, desc: '승급석' },
    t_dark: { name: '어둠의 시련', el: 'dark', mobs: ['bat', 'shadow', 'gargoyle', 'dark_priest', 'shade_beast'], boss: 'abyss_lord', hue: 270, desc: '승급석' },
    xp: { name: '수련의 숲', icon: '📖', mobs: ['goblin', 'wolf', 'mushroom', 'gob_archer', 'druid'], boss: 'troll', hue: 100, ground: '#22361e', desc: '경험치 물약' },
    equip: { name: '잊힌 대장간', icon: '⚒', mobs: ['golem', 'orc', 'iron_skel', 'mecha', 'hill_orc'], boss: 'lava_giant', hue: 15, ground: '#3a2418', desc: '강화석' },
  };
  C.DG_KINDS = ['gold', 'crys', 'xp', 'soul', 'equip', 't_fire', 't_water', 't_wind', 't_light', 't_dark'];   // t_* = 속성의 시련 5종(적 전원이 그 속성)
  C.dgStage = function (lv) { return lv * 10; };
  C.TRIAL_K = +(T.trk) || 6;   // 속성 시련 적 강화(시뮬: ★2 5명 편성이 상한 바로 아래, 인원·등급이 모자라면 상한의 70~85%)
  C.DG_CLIMB = 0.2;   // 2026-11-01 사용자: 도전(레벨 올리기)·던전 빠른 진격 보상은 20%(별의 파편 첫 클리어는 그대로), 소탕은 100%
  C.dgCap = function (s) { return Math.max(1, Math.floor((s.maxClear || 0) / (10 * (C.STAGE_DISP || 1)))); };   // 2026-10-31 도전 상한 = 최고 스테이지 ÷ 10(이미 넘은 레벨은 유지, 소탕도 그 레벨로) — 던전이 실력만큼 끝없이 올라가 보상이 폭주하던 문제   // 던전 Lv.n 적 강도 = n×10 스테이지
  C.dungeonReward = function (kind, lv) {
    if (kind === 'gold') return { gold: C.stageGold(C.dgStage(lv)) * 100 };
    if (kind === 'crys') return { crystal: C.gem(150 + 15 * lv) };
    if (kind === 'equip') return { estone: C.eqDungeonStone(lv) };
    if (kind === 'xp') return { xpot: 5 + lv };   // 경험치 물약(1개 = C.XPOT_EXP)
    if (kind === 'soul') return { xstone: 2 * (5 + lv) };   // 영혼석: 전용장비 소환 (2배)
    const d = C.DG[kind]; return { ['u_' + d.el]: 5 + lv };   // 속성의 시련: 그 속성 승급석
  };
  C.dungeonParams = function (kind, lv, slots) {
    const d = C.DG[kind]; const st = C.dgStage(lv); const m = C.stageMult(st);
    const mobs = d.mobs.map(t => { const mm = C.makeMob(t, m, false); mm.hue = d.hue; return mm; });
    const boss = C.makeMob(d.boss, m * 1.1, true, st); boss.hue = d.hue;
    if (d.el) { for (const mm of mobs) mm.elem = d.el; boss.elem = d.el;
      const K = C.TRIAL_K, A = Math.sqrt(K); for (const mm of mobs.concat([boss])) { mm.hp = Math.round(mm.hp * K); mm.atk = Math.round(mm.atk * A); } }   // 속성 시련은 그 속성 영웅만 출전(시즌 3) — 편성이 갖춰져야 상한까지 오르도록 적 체력 ×K·공격 ×√K
    return { mode: 'dungeon', kind, stage: st, level: lv, mobs, boss, quota: 8, maxMobs: C.maxMobs(slots) + 1, autoBoss: true, timeLimit: C.DG_TIME, chapter: 9, ground: d.ground };
  };
  C.RAID_TRIES = 3;
  C.RAID_TIME = 40;         // 레이드 제한 시간(초)
  C.raidBoss = function (week, maxStage) {
    const types = ['dragon', 'titan', 'lich', 'demonlord', 'ice_dragon', 'hell_lord', 'fallen_angel', 'hive_eye'];
    const type = types[week % types.length];
    const m = C.stageMult(Math.max(30, maxStage)) * 1.2;
    const mob = C.makeMob(type, m, true, Math.max(30, maxStage));
    const rp = Math.min(1, Math.max(30, maxStage) / C.STAGE_BOSS.ramp);   // 스테이지 보스와 같은 비율로 강화(최대 ×20)
    mob.hp = Math.round(mob.hp * 4 * (1 + (C.STAGE_BOSS.hp / 3 - 1) * rp)); mob.atk = Math.round(mob.atk * (1 + (C.STAGE_BOSS.atk - 1) * rp)); mob.hue = 0; // 레이드 보스는 매우 큼 · 죽지 않음(field.js kill)
    return mob;
  };
  // 허수아비(2026-11-23 사용자 '편성끼리 전투력 비교'): 보상 없음·공격 안 함·죽지 않음(레이드처럼 raid 모드), DUMMY_TIME초 동안 준 피해를 잼.
  //   방어력·보스 판정은 지금 최고 스테이지 보스와 같게(보스 피해 옵션 반영), 기믹·격노 없음. elem = 허수아비 속성(null = 무속성 — 상성 없음)
  C.DUMMY_TIME = 60;
  C.dummyParams = function (maxClear, slots, elem) {
    const p = C.stageParams(Math.max(1, maxClear), slots, true);
    const b = Object.assign({}, p.boss, { id: 'dummy', name: '허수아비', elem: elem || null, atk: 0, skills: [], basic: 0, roar: 0 }); delete b.gim; b.hp = Math.max(1e30, b.hp * 1e6);
    return { mode: 'raid', dummy: true, stage: p.stage, mobs: [], boss: b, quota: 0, maxMobs: 0, autoBoss: true, raidTime: C.DUMMY_TIME, chapter: p.chapter };
  };
  C.raidParams = function (week, maxStage) { const so = C.sOld ? C.sOld(maxStage) : maxStage; return { mode: 'raid', stage: so, mobs: [], boss: C.raidBoss(week, so), quota: 0, maxMobs: 0, autoBoss: true, raidTime: C.RAID_TIME, chapter: 9 }; };
  C.raidReward = function (dmg, bossHp, elem) {
    const q = Math.sqrt(Math.max(0, dmg / bossHp));   // 상한 없음 · 체감(제곱근): 체력의 40% ≈ 이전 최대 보상(보석 600)
    const o = { crystal: C.gem(150 + 700 * q), sshard: Math.round(2 + 15 * q) }; o['u_' + (elem || 'fire')] = Math.round(4 + 25 * q); return o;   // 레이드 보스 속성의 승급석
  };
})(typeof window !== 'undefined' ? window : globalThis);

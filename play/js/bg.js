// 전장 배경: 지역(10장)·던전별 도트풍 배경을 한 번 그려 캐시해 두고 매 프레임 그대로 깐다.
// 구성: 하늘(그라데이션) → 원경 실루엣 → 바닥(원근 그라데이션 + 도트 질감 + 얼룩) → 소품 → 비네트
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;
  g.RPG = g.RPG || {};
  const W = 360, SC = 2, HZ = 54; let H = 325;   // H는 전장 세로에 맞춰 바뀜(setH, 2026-11-19) // 논리 크기, 렌더 배율, 지평선 높이

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };

  // 지역 테마: sky=[위, 지평선], far=원경 종류·색, gnd=[먼 바닥, 가까운 바닥, 질감 어두움, 질감 밝음], deco=소품, glow=분위기 빛
  const THEMES = {
    c0: { sky: ['#6fa8dc', '#cfe6f0'], far: ['hills', '#4e7c46', '#6a9a58'], gnd: ['#47703a', '#5d8c45', '#3c6232', '#6e9c52'], deco: ['grass', 'grass', 'flower', 'flower', 'rock'], n: 46 },
    c1: { sky: ['#1f3a2c', '#4f7052'], far: ['pines', '#173024', '#22402e'], gnd: ['#2f4f2a', '#41683a', '#26421f', '#4f7a44'], deco: ['grass', 'mush', 'stump', 'rock', 'grass'], n: 42, fog: 'rgba(150,200,150,.10)' },
    c2: { sky: ['#141a2c', '#3a4262'], far: ['graves', '#242a3c', '#30364c'], moon: '#e8e4d0', gnd: ['#2f323c', '#454955', '#272a32', '#545866'], deco: ['tomb', 'tomb', 'bone', 'dgrass', 'rock'], n: 34, fog: 'rgba(170,180,210,.12)' },
    c3: { sky: ['#b8603e', '#efb47a'], far: ['cliffs', '#6e3f2a', '#8a5236'], gnd: ['#7a5a3c', '#9c7a52', '#6a4c32', '#b08a5e'], deco: ['rock', 'rock', 'bone', 'shrub', 'crack'], n: 36 },
    c4: { sky: ['#0d0b12', '#221b2a'], far: ['stalac', '#17121e', '#201a29'], gnd: ['#28242e', '#38323f', '#1f1b24', '#463f4f'], deco: ['web', 'rock', 'egg', 'egg', 'web'], n: 30, vig: 0.6 },
    c5: { sky: ['#20301f', '#4a5a38'], far: ['deadtrees', '#1a2818', '#243422'], gnd: ['#33422a', '#47593a', '#2a3822', '#566a44'], deco: ['puddle', 'mush', 'reed', 'reed', 'puddle'], n: 38, fog: 'rgba(140,190,120,.13)' },
    c6: { sky: ['#110d1e', '#2c2346'], far: ['mansion', '#18122a', '#221a38'], moon: '#d8d0f0', gnd: ['#29243a', '#3a3350', '#211d30', '#4a4262'], deco: ['candle', 'bone', 'dgrass', 'tomb', 'candle'], n: 30, fog: 'rgba(160,140,220,.12)', vig: 0.5 },
    c7: { sky: ['#56677a', '#9aa8b4'], far: ['walls', '#454b55', '#565d68'], gnd: ['#55565c', '#6c6d73', '#48494e', '#7c7d84'], deco: ['rock', 'rubble', 'rubble', 'rock', 'crack'], n: 40, tiles: true },
    c8: { sky: ['#5e2e20', '#b0603a'], far: ['tents', '#2e1f18', '#3e2a20'], gnd: ['#56442f', '#6f5a40', '#4a3a28', '#806a4c'], deco: ['spear', 'skull', 'rock', 'crack', 'spear'], n: 36, fog: 'rgba(60,40,30,.15)' },
    c9: { sky: ['#1e070c', '#5c1418'], far: ['castle', '#14060a', '#200a10'], gnd: ['#2a1e22', '#3c2a2e', '#21171a', '#4a3438'], deco: ['lava', 'skull', 'spike', 'crack', 'lava'], n: 32, vig: 0.55, glow: 'rgba(255,90,40,.10)' },
    gold: { sky: ['#140f08', '#2e2312'], far: ['stalac', '#1f170c', '#2a2010'], gnd: ['#4a3c1e', '#62502a', '#3e3218', '#7a6434'], deco: ['ore', 'ore', 'rock', 'lantern', 'rail'], n: 30, vig: 0.55, glow: 'rgba(255,200,90,.08)' },
    crys: { sky: ['#07141e', '#12303e'], far: ['stalac', '#0b1e2a', '#102836'], gnd: ['#1e3846', '#2a4a5a', '#18303c', '#365e70'], deco: ['crystal', 'crystal', 'rock', 'crystal', 'puddle'], n: 30, vig: 0.55, glow: 'rgba(110,200,255,.10)' },
    elem: { sky: ['#0a0e1c', '#1c2a44'], far: ['pillars', '#101830', '#16203c'], gnd: ['#22304a', '#2c3c5a', '#1a2640', '#3a4e70'], deco: ['crystal', 'rune', 'rock', 'crystal', 'candle'], n: 28, vig: 0.55, glow: 'rgba(150,200,255,.10)', circle: true },
    equip: { sky: ['#140a06', '#3a1a0c'], far: ['stalac', '#1e0f08', '#2a140a'], gnd: ['#3a2418', '#4c3020', '#2e1c12', '#6a4228'], deco: ['lava', 'rock', 'ore', 'lantern', 'rubble'], n: 28, vig: 0.6, glow: 'rgba(255,120,60,.10)' },
    soul: { sky: ['#0e0818', '#2a1844'], far: ['pillars', '#160e26', '#20143a'], gnd: ['#2c2040', '#3c2c56', '#241a36', '#4c3a6a'], deco: ['candle', 'rune', 'bone', 'candle', 'skull'], n: 28, vig: 0.6, glow: 'rgba(190,130,255,.10)', circle: true },
  };

  // 작은 도트 소품 (문자 = 팔레트 인덱스, '.' = 투명). 1칸 = 논리 1px
  const SPR = {
    grass: { m: ['.a..a', 'a.ab.', '.bab.'], p: (t) => [t.gnd[3], mix(t.gnd[3], '#ffffff', .25)] },
    dgrass: { m: ['.a..a', 'a..a.', '.aaa.'], p: () => ['#6e6650'] },
    flower: { m: ['.b.', 'bcb', '.b.', '.a.'], p: (t, r) => [t.gnd[2], ['#f2d36b', '#f08a9a', '#e8eef8', '#b9a0f0'][Math.floor(r() * 4)], '#fff3c0'] },
    rock: { m: ['..aaa.', '.abbba', 'abbbca', 'aaaaaa'], p: () => ['#3e3c3a', '#6e6a64', '#8c8880'] },
    rubble: { m: ['.ab.a', 'abbaa', 'aa.ab'], p: () => ['#4a4a4e', '#7a7a80'] },
    mush: { m: ['.aaa.', 'abaab', '..c..', '..c..'], p: () => ['#c0473c', '#f2e2d0', '#e8dcc4'] },
    stump: { m: ['.aaa.', 'abcba', 'aaaaa', 'a.a.a'], p: () => ['#4a3020', '#7a5636', '#9c7448'] },
    tomb: { m: ['.aaa.', 'abbba', 'abcba', 'abbba', 'abbba', 'aaaaa'], p: () => ['#2a2c34', '#6a6e7c', '#3a3e4a'] },
    bone: { m: ['a....a', '.aaaa.', 'a....a'], p: () => ['#d8d2c0'] },
    skull: { m: ['.aaa.', 'abaab', 'aaaaa', '.a.a.'], p: () => ['#d8d2c0', '#2a2020'] },
    shrub: { m: ['.a.a.', 'aaba.', '.aaa.'], p: () => ['#7a6a3a', '#9a8a4a'] },
    web: { lines: true },
    egg: { m: ['.aa.', 'abaa', 'aaaa', '.aa.'], p: () => ['#d8d0c0', '#f8f4ec'] },
    reed: { m: ['a.b', 'a.b', 'aab', '.ab', '.a.'], p: () => ['#5a6a34', '#7a8a44'] },
    candle: { m: ['.c.', '.b.', '.a.', '.a.', 'aaa'], p: () => ['#d8d0b8', '#ffb050', '#fff0a0'], glow: 'rgba(255,170,80,.30)' },
    spear: { m: ['..a', '..a', '.b.', '.b.', 'b..', 'b..'], p: () => ['#c8c8d0', '#6a4a2a'] },
    spike: { m: ['..a..', '.aba.', '.aba.', 'abbba'], p: () => ['#1a1014', '#4a2a30'] },
    ore: { m: ['.aaa.', 'abaca', 'aacba', '.aaa.'], p: () => ['#4a3a24', '#f2c84a', '#fff0a0'], glow: 'rgba(255,210,90,.22)' },
    crystal: { m: ['..a..', '.aba.', '.aba.', 'abbca', '.aaa.'], p: () => ['#4aa8e8', '#9adcff', '#e8f8ff'], glow: 'rgba(110,200,255,.30)' },
    lantern: { m: ['.a.', 'aba', 'aca', '.a.'], p: () => ['#3a2a18', '#ffcc60', '#fff0b0'], glow: 'rgba(255,200,90,.35)' },
  };

  function drawSpr(cx, name, x, y, t, r, k) {
    k = k || 2;
    const s = SPR[name]; if (!s) return;
    if (s.lines) { // 거미줄
      cx.strokeStyle = 'rgba(220,220,230,.35)'; cx.lineWidth = 0.5;
      const R = 7 + r() * 5; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.6); cx.stroke(); }
      for (let q = 1; q <= 3; q++) { cx.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2; const px = x + Math.cos(a) * R * q / 3.2, py = y + Math.sin(a) * R * 0.6 * q / 3.2; k ? cx.lineTo(px, py) : cx.moveTo(px, py); } cx.stroke(); }
      return;
    }
    const pal = s.p(t, r);
    if (s.glow) { const gx = x + 2 * k, gy = y + 2 * k, R = 9 * k; const gr = cx.createRadialGradient(gx, gy, 0, gx, gy, R); gr.addColorStop(0, s.glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(gx - R, gy - R, R * 2, R * 2); }
    cx.fillStyle = 'rgba(0,0,0,.22)'; cx.fillRect(x, y + s.m.length * k - 1, s.m[0].length * k, 2); // 접지 그림자
    s.m.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = row[i]; if (c === '.') continue; cx.fillStyle = pal['abc'.indexOf(c)] || pal[0]; cx.fillRect(x + i * k, y + j * k, k, k); } });
  }

  // 원경 실루엣
  function far(cx, t, r) {
    const [kind, c1, c2] = t.far;
    const layer = (col, base, amp, step, jag) => { cx.fillStyle = col; cx.beginPath(); cx.moveTo(0, HZ); for (let x = 0; x <= W; x += step) cx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.03 + r() * 0.4)) - (jag ? r() * jag : 0)); cx.lineTo(W, HZ); cx.closePath(); cx.fill(); };
    if (kind === 'hills') { layer(c2, HZ - 10, 16, 6, 0); layer(c1, HZ - 2, 10, 6, 0); }
    else if (kind === 'cliffs') { layer(c2, HZ - 14, 22, 8, 8); layer(c1, HZ - 4, 12, 6, 5); }
    else if (kind === 'pines' || kind === 'deadtrees') {
      layer(c2, HZ - 6, 6, 8, 2);
      for (let x = -4; x < W; x += 9 + r() * 8) {
        const h = 20 + r() * 22, b = HZ + 1; cx.fillStyle = r() < .5 ? c1 : c2;
        if (kind === 'pines') { cx.beginPath(); cx.moveTo(x, b); cx.lineTo(x + 6, b - h); cx.lineTo(x + 12, b); cx.fill(); }
        else { cx.fillRect(x + 5, b - h, 2, h); for (let k = 0; k < 3; k++) { const yy = b - h + 4 + k * 5; cx.fillRect(x + (k % 2 ? 6 : 1), yy, 5, 1); } }
      }
    } else if (kind === 'graves') {
      layer(c2, HZ - 4, 5, 8, 2);
      for (let x = 4; x < W; x += 14 + r() * 14) { cx.fillStyle = c1; const h = 8 + r() * 8; if (r() < .45) { cx.fillRect(x + 2, HZ - h, 2, h); cx.fillRect(x, HZ - h + 3, 6, 2); } else { cx.fillRect(x, HZ - h, 6, h); cx.fillRect(x + 1, HZ - h - 1, 4, 1); } }
    } else if (kind === 'stalac') {
      cx.fillStyle = c1; for (let x = -4; x < W; x += 7 + r() * 10) { const h = 10 + r() * 30, w = 5 + r() * 7; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x + w / 2, h); cx.lineTo(x + w, 0); cx.fill(); }
      layer(c2, HZ - 2, 6, 7, 4);
    } else if (kind === 'mansion') {
      layer(c2, HZ - 4, 4, 8, 2);
      cx.fillStyle = c1; const mx = 120 + r() * 80; cx.fillRect(mx, HZ - 34, 90, 34); cx.beginPath(); cx.moveTo(mx - 6, HZ - 34); cx.lineTo(mx + 45, HZ - 52); cx.lineTo(mx + 96, HZ - 34); cx.fill();
      cx.fillRect(mx + 70, HZ - 50, 8, 16);
      for (let i = 0; i < 6; i++) { cx.fillStyle = r() < .55 ? 'rgba(255,210,120,.75)' : '#0c0a14'; cx.fillRect(mx + 8 + i * 13, HZ - 26, 5, 7); cx.fillRect(mx + 8 + i * 13, HZ - 14, 5, 7); }
    } else if (kind === 'walls') {
      layer(c2, HZ - 18, 10, 9, 6);
      cx.fillStyle = c1; cx.fillRect(0, HZ - 18, W, 18); for (let x = 0; x < W; x += 12) cx.fillRect(x, HZ - 24, 7, 6);
      for (let x = 30 + r() * 40; x < W; x += 110 + r() * 40) { cx.fillRect(x, HZ - 40, 18, 40); for (let k = 0; k < 3; k++) cx.fillRect(x - 2 + k * 8, HZ - 45, 5, 5); }
      cx.fillStyle = 'rgba(0,0,0,.25)'; for (let y = HZ - 16; y < HZ; y += 5) for (let x = (y % 10 ? 0 : 6); x < W; x += 12) cx.fillRect(x, y, 1, 4);
    } else if (kind === 'tents') {
      layer(c2, HZ - 6, 8, 8, 4);
      for (let x = 6; x < W; x += 34 + r() * 30) { cx.fillStyle = c1; cx.beginPath(); cx.moveTo(x, HZ); cx.lineTo(x + 13, HZ - 20); cx.lineTo(x + 26, HZ); cx.fill(); cx.fillRect(x + 12, HZ - 30, 1, 12); cx.fillStyle = '#8a2a1e'; cx.fillRect(x + 13, HZ - 30, 7, 4); }
      cx.fillStyle = 'rgba(40,30,30,.35)'; for (let k = 0; k < 4; k++) { const sx = r() * W; cx.beginPath(); cx.ellipse(sx, HZ - 30 - r() * 14, 22, 7, 0, 0, Math.PI * 2); cx.fill(); }
    } else if (kind === 'castle') {
      layer(c2, HZ - 8, 10, 8, 6);
      cx.fillStyle = c1; const bx = 110 + r() * 60;
      cx.fillRect(bx, HZ - 30, 140, 30); for (let x = bx; x < bx + 140; x += 10) cx.fillRect(x, HZ - 34, 6, 4);
      [[bx - 6, 46], [bx + 30, 58], [bx + 66, 72], [bx + 104, 54], [bx + 134, 44]].forEach(([x, h]) => { cx.fillRect(x, HZ - h, 12, h); cx.beginPath(); cx.moveTo(x - 2, HZ - h); cx.lineTo(x + 6, HZ - h - 14); cx.lineTo(x + 14, HZ - h); cx.fill(); });
      cx.fillStyle = 'rgba(255,90,40,.8)'; for (let i = 0; i < 9; i++) cx.fillRect(bx + 6 + r() * 128, HZ - 26 + r() * 18, 2, 3);
    } else if (kind === 'pillars') {
      cx.fillStyle = c2; cx.fillRect(0, HZ - 6, W, 6);
      for (let x = 10; x < W; x += 46) { cx.fillStyle = c1; cx.fillRect(x, HZ - 48, 10, 48); cx.fillRect(x - 3, HZ - 50, 16, 4); cx.fillStyle = 'rgba(190,130,255,.55)'; cx.fillRect(x + 4, HZ - 40, 2, 3); }
    }
  }

  // 그림 배경(2026-10-25): full = 전장 비율(360:325)로 미리 자른 그림을 통째로, band = 가로로 긴 그림을 위쪽 띠로 깔고 아래 바닥은 절차 생성(gnd = 그림 아래쪽 평균색)
  const PIC = {
    c0: { src: 'img/bg/c0.jpg', mode: 'full' },
    c1: { src: 'img/bg/c1.jpg', mode: 'full' },
    c2: { src: 'img/bg/c2.jpg', mode: 'full' },
    c3: { src: 'img/bg/c3.jpg', mode: 'full' },
    c4: { src: 'img/bg/c4.jpg', mode: 'full' },
    c5: { src: 'img/bg/c5.jpg', mode: 'full' },
    c6: { src: 'img/bg/c6.jpg', mode: 'full' },
    c7: { src: 'img/bg/c7.jpg', mode: 'full' },
    c8: { src: 'img/bg/c8.jpg', mode: 'full' },
    c9: { src: 'img/bg/c9.jpg', mode: 'full' },
    c2: { src: 'img/bg/c2.jpg', mode: 'full' },
    t_fire: { src: 'img/bg/t_fire.jpg', mode: 'band', gnd: ['#371b1e', '#452225', '#291416', '#53292d'] },
    t_water: { src: 'img/bg/t_water.jpg', mode: 'band', gnd: ['#4f7fb0', '#639fdc', '#3b5f84', '#77bfff'] },
    t_wind: { src: 'img/bg/t_wind.jpg', mode: 'band', gnd: ['#4a5b35', '#5d7242', '#384427', '#70894f'] },
    t_light: { src: 'img/bg/t_light.jpg', mode: 'band', gnd: ['#9d8b7c', '#c5ae9b', '#76685d', '#ecd1ba'] },
    t_dark: { src: 'img/bg/t_dark.jpg', mode: 'band', gnd: ['#291a58', '#33216f', '#1f1342', '#3e2785'] },
    crys: { src: 'img/bg/crys.jpg', mode: 'band', gnd: ['#151043', '#1b1454', '#100c32', '#201965'] },   // 수정 광산(2026-10-26, 시트 5행 1열 수정 동굴)
  };
  const PIC_IMG = {};
  function picCanvas(key, im) {
    const P = PIC[key]; const cv = document.createElement('canvas'); cv.width = W * SC; cv.height = H * SC; const cx = cv.getContext('2d');
    if (!cx || !cx.drawImage) return null; cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    if (P.mode === 'full') { const nw = im.naturalWidth, nh = im.naturalHeight; let sx = 0, sy = 0, sw = nw, sh = nh; if (nh / nw < H / W) { sw = nh * W / H; sx = (nw - sw) / 2; } else { sh = nw * H / W; sy = (nh - sh) / 2; } cx.drawImage(im, sx, sy, sw, sh, 0, 0, W * SC, H * SC); }   // 그림 비율과 전장 비율이 다르면 가운데를 잘라 씀(늘이지 않음)
    else {
      const base = build(key, { gnd: P.gnd, deco: ['rock', 'crack', 'rock'], n: 18, glow: null, circle: false, fog: null }); cx.drawImage(base, 0, 0);
      const bh = Math.round((P.band || 165) * H / 325) * SC, sw = im.naturalHeight * (W * SC) / bh;   // 띠 높이 165(논리) — 그림 가운데를 잘라 높이를 키움(위쪽 유닛이 그림 속 바닥에 서도록)
      const tmp = document.createElement('canvas'); tmp.width = W * SC; tmp.height = bh; const tc = tmp.getContext('2d'); tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
      tc.drawImage(im, (im.naturalWidth - sw) / 2, 0, sw, im.naturalHeight, 0, 0, W * SC, bh); tc.globalCompositeOperation = 'destination-in';
      const gm = tc.createLinearGradient(0, 0, 0, bh); gm.addColorStop(0, '#000'); gm.addColorStop(0.8, '#000'); gm.addColorStop(1, 'rgba(0,0,0,0)'); tc.fillStyle = gm; tc.fillRect(0, 0, W * SC, bh);
      cx.drawImage(tmp, 0, 0);
    }
    const vg = cx.createRadialGradient(W * SC / 2, H * SC * 0.58, H * SC * 0.4, W * SC / 2, H * SC * 0.58, H * SC); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.3)'); cx.fillStyle = vg; cx.fillRect(0, 0, W * SC, H * SC);
    return cv;
  }
  function build(key, over) {
    const t = Object.assign({}, THEMES[key] || (key.startsWith('t_') ? THEMES.elem : THEMES.c0), over || {}); const r = rng(key.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const cv = document.createElement('canvas'); cv.width = W * SC; cv.height = H * SC;
    const cx = cv.getContext('2d'); const probe = cx && cx.createLinearGradient && cx.createLinearGradient(0, 0, 0, 1);
    if (!probe || !probe.addColorStop) return cv; // 캔버스 미지원 환경(테스트)에서는 빈 배경
    cx.imageSmoothingEnabled = false; cx.setTransform(SC, 0, 0, SC, 0, 0);
    // 하늘
    const sk = cx.createLinearGradient(0, 0, 0, HZ); sk.addColorStop(0, t.sky[0]); sk.addColorStop(1, t.sky[1]); cx.fillStyle = sk; cx.fillRect(0, 0, W, HZ);
    if (t.moon) { cx.fillStyle = t.moon; cx.beginPath(); cx.arc(290, 18, 9, 0, Math.PI * 2); cx.fill(); cx.fillStyle = 'rgba(255,255,255,.08)'; cx.beginPath(); cx.arc(290, 18, 18, 0, Math.PI * 2); cx.fill(); }
    if (key === 'c0' || key === 'c3') { cx.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 4; k++) { const x = r() * W, y = 8 + r() * 22; for (let j = 0; j < 4; j++) cx.fillRect(x + j * 5, y - (j % 2) * 2, 10, 3); } }
    if (key === 'c2' || key === 'c6' || key === 'c9') { cx.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 24; k++) cx.fillRect(r() * W, r() * (HZ - 20), 1, 1); }
    far(cx, t, r);
    // 바닥: 원근 그라데이션
    const gd = cx.createLinearGradient(0, HZ, 0, H); gd.addColorStop(0, t.gnd[0]); gd.addColorStop(1, t.gnd[1]); cx.fillStyle = gd; cx.fillRect(0, HZ, W, H - HZ);
    cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(0, HZ, W, 2);
    // 석재 타일(요새)
    if (t.tiles) { cx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = HZ + 8; y < H; y += 14) { cx.fillRect(0, y, W, 1); for (let x = ((y / 14) % 2 ? 0 : 14); x < W; x += 28) cx.fillRect(x, y, 1, 14); } }
    // 얼룩(밝고 어두운 패치) — 도트 블록으로
    for (let k = 0; k < 16; k++) {
      const px = r() * W, py = HZ + 6 + r() * (H - HZ - 6), rw = 10 + r() * 30, rh = 4 + r() * 10, dark = r() < .5;
      cx.fillStyle = dark ? t.gnd[2] : t.gnd[3]; cx.globalAlpha = 0.22;
      for (let yy = -rh; yy <= rh; yy += 2) { const ww = rw * Math.sqrt(Math.max(0, 1 - (yy * yy) / (rh * rh))); cx.fillRect(Math.round(px - ww), Math.round(py + yy), Math.round(ww * 2), 2); }
      cx.globalAlpha = 1;
    }
    // 도트 질감
    for (let k = 0; k < 1400; k++) { const y = HZ + 2 + r() * (H - HZ); cx.fillStyle = r() < .5 ? t.gnd[2] : t.gnd[3]; cx.globalAlpha = 0.18 + r() * 0.25; cx.fillRect(Math.floor(r() * W), Math.floor(y), r() < .7 ? 1 : 2, 1); }
    cx.globalAlpha = 1;
    // 영혼의 제단: 바닥 마법진
    if (t.circle) { cx.strokeStyle = 'rgba(190,130,255,.35)'; cx.lineWidth = 1; [70, 52].forEach(R => { cx.beginPath(); cx.ellipse(W / 2, 185, R, R * 0.42, 0, 0, Math.PI * 2); cx.stroke(); }); cx.beginPath(); for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 4 / 5; const x = W / 2 + Math.cos(a) * 52, y = 185 + Math.sin(a) * 52 * 0.42; k ? cx.lineTo(x, y) : cx.moveTo(x, y); } cx.stroke(); }
    // 용암 균열(마왕의 성)
    const cracks = (col, glow, n) => { for (let k = 0; k < n; k++) { let x = r() * W, y = HZ + 20 + r() * (H - HZ - 30); cx.strokeStyle = glow; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(x, y); const pts = [[x, y]]; for (let j = 0; j < 5; j++) { x += 4 + r() * 8; y += (r() - .5) * 8; pts.push([x, y]); cx.lineTo(x, y); } cx.stroke(); cx.strokeStyle = col; cx.lineWidth = 1; cx.beginPath(); pts.forEach(([a, b], i) => i ? cx.lineTo(a, b) : cx.moveTo(a, b)); cx.stroke(); } };
    // 소품: 전투 중앙(가로 100~260, 세로 110~230)은 덜 배치해 유닛이 묻히지 않게
    const items = t.deco; let placed = 0, guard = 0; const N = Math.round(t.n * 0.7);
    while (placed < N && guard++ < 600) {
      const x = 4 + r() * (W - 14), y = HZ + 6 + r() * (H - HZ - 16);
      if (x > 100 && x < 260 && y > 122 && y < 242 && r() < 0.75) continue;
      const it = items[Math.floor(r() * items.length)];
      if (it === 'crack') cracks('rgba(0,0,0,.45)', 'rgba(0,0,0,.12)', 1);
      else if (it === 'lava') cracks('#ffb040', 'rgba(255,80,30,.35)', 1);
      else if (it === 'puddle') { cx.fillStyle = key === 'crys' ? 'rgba(120,200,255,.25)' : 'rgba(40,80,70,.55)'; cx.beginPath(); cx.ellipse(x, y, 9 + r() * 8, 3 + r() * 2, 0, 0, Math.PI * 2); cx.fill(); cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(x - 4, y - 1, 4, 1); }
      else if (it === 'rail') { cx.fillStyle = '#3a2e1e'; for (let k = 0; k < 8; k++) cx.fillRect(x + k * 6, y, 2, 6); cx.fillStyle = '#7a7470'; cx.fillRect(x - 2, y + 1, 50, 1); cx.fillRect(x - 2, y + 4, 50, 1); }
      else if (it === 'rune') { cx.fillStyle = 'rgba(190,130,255,.55)'; const sz = 3 + Math.floor(r() * 3); cx.fillRect(x, y, 1, sz); cx.fillRect(x, y, sz, 1); cx.fillRect(x + sz - 1, y + Math.floor(sz / 2), 1, sz - 1); }
      else drawSpr(cx, it, Math.round(x), Math.round(y), t, r);
      placed++;
    }
    // 전경 프레임: 하단 모서리에 어두운 덤불·바위 실루엣으로 깊이감
    const fgKind = { c0: 'bush', c1: 'bush', c5: 'bush', c2: 'grave', c6: 'grave', c9: 'spike', crys: 'crys' }[key] || 'rock';
    const fgCol = mix(t.gnd[2], '#000000', 0.45), fgHi = mix(t.gnd[3], '#000000', 0.25);
    const fgAt = (x0, y0, sc) => {
      if (fgKind === 'bush') { for (let k = 0; k < 7; k++) { const bx = x0 + (r() - .5) * 46 * sc, by = y0 + (r() - .3) * 18 * sc, br = (8 + r() * 10) * sc; cx.fillStyle = fgCol; cx.beginPath(); cx.arc(bx, by, br, 0, Math.PI * 2); cx.fill(); cx.fillStyle = fgHi; cx.fillRect(bx - br * .4, by - br * .7, br * .5, 2); } }
      else if (fgKind === 'grave') { for (let k = 0; k < 3; k++) { const bx = x0 + (k - 1) * 18 * sc, h = (16 + r() * 12) * sc; cx.fillStyle = fgCol; cx.fillRect(bx, y0 - h, 11 * sc, h + 20); cx.fillRect(bx + 2 * sc, y0 - h - 3 * sc, 7 * sc, 3 * sc); cx.fillStyle = fgHi; cx.fillRect(bx + 2 * sc, y0 - h + 3 * sc, 1, h * .6); } }
      else if (fgKind === 'spike') { for (let k = 0; k < 6; k++) { const bx = x0 + (r() - .5) * 50 * sc, h = (14 + r() * 26) * sc; cx.fillStyle = fgCol; cx.beginPath(); cx.moveTo(bx - 5 * sc, y0 + 14); cx.lineTo(bx, y0 - h); cx.lineTo(bx + 5 * sc, y0 + 14); cx.fill(); } }
      else if (fgKind === 'crys') { for (let k = 0; k < 5; k++) { const bx = x0 + (r() - .5) * 44 * sc, h = (12 + r() * 22) * sc; cx.fillStyle = 'rgba(70,150,210,.85)'; cx.beginPath(); cx.moveTo(bx - 4 * sc, y0 + 12); cx.lineTo(bx, y0 - h); cx.lineTo(bx + 4 * sc, y0 + 12); cx.fill(); cx.fillStyle = 'rgba(200,240,255,.6)'; cx.fillRect(bx - 1, y0 - h + 4, 1, h * .5); } }
      else { for (let k = 0; k < 4; k++) { const bx = x0 + (r() - .5) * 44 * sc, by = y0 + (r() - .2) * 12 * sc, w = (14 + r() * 16) * sc, h = (9 + r() * 10) * sc; cx.fillStyle = fgCol; cx.beginPath(); cx.moveTo(bx - w / 2, by + h / 2); cx.lineTo(bx - w / 3, by - h / 2); cx.lineTo(bx + w / 4, by - h / 1.6); cx.lineTo(bx + w / 2, by + h / 2); cx.fill(); cx.fillStyle = fgHi; cx.fillRect(bx - w / 4, by - h / 2 + 1, w / 3, 2); } }
    };
    fgAt(-4, H - 4, 1.1); fgAt(W + 4, H - 6, 1.1); fgAt(W * 0.62, H + 8, 0.7);
    // 분위기: 안개·빛·비네트
    if (t.fog) { const fg = cx.createLinearGradient(0, HZ - 10, 0, HZ + 60); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(0.4, t.fog); fg.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = fg; cx.fillRect(0, HZ - 10, W, 70); }
    if (t.glow) { cx.fillStyle = t.glow; cx.fillRect(0, 0, W, H); }
    const vg = cx.createRadialGradient(W / 2, H * 0.58, H * 0.35, W / 2, H * 0.58, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (t.vig || 0.38) + ')'); cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
    return cv;
  }

  const CACHE = {};
  function keyOf(p) { if (p.mode === 'dungeon' && p.kind === 'xp') return 't_wind';   // 수련의 숲 = 질풍의 시련 그림(2026-10-30 사용자 선택)
    if (p.mode === 'dungeon' && p.kind && p.kind.startsWith('t_')) return p.kind; if (p.mode === 'dungeon' && p.kind && THEMES[p.kind]) return p.kind; return 'c' + ((p.chapter || 0) % 10); }
  function setH(h) { if (h === H) return; H = h; for (const k in CACHE) delete CACHE[k]; for (const k in PIC_IMG) { const im = PIC_IMG[k]; if (im.complete && im.naturalWidth) { try { const c = picCanvas(k, im); if (c) CACHE[k + '#pic'] = c; } catch (e) { } } } }
  g.RPG.BG = { W, get H() { return H; }, setH, get(p) {
    const k = keyOf(p || {}); const P = PIC[k];
    if (P && typeof Image !== 'undefined') {   // 그림이 있으면 불러온 뒤부터 그림 배경, 그 전엔 절차 생성
      if (CACHE[k + '#pic']) return CACHE[k + '#pic'];
      loadPic(k);
    }
    return CACHE[k] || (CACHE[k] = build(k));
  }, keys: Object.keys(THEMES), _build: build };
  // 그림 배경은 처음 쓸 때 불러오면 잠깐 절차 배경이 보였다가 바뀜 → 시작하자마자 전부 미리 받아 캔버스까지 만들어 둠(2026-10-26, 합계 약 1.8MB)
  function loadPic(k) {
    if (PIC_IMG[k] || typeof Image === 'undefined') return; const P = PIC[k]; const im = new Image(); PIC_IMG[k] = im;
    im.onload = () => { try { const c = picCanvas(k, im); if (c) CACHE[k + '#pic'] = c; } catch (e) { } }; im.src = P.src;
  }
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') setTimeout(() => Object.keys(PIC).forEach(loadPic), 0);
})();

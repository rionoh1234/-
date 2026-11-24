// 소환 탭: 영웅 소환·★3 소환 연출
// ui/*.js는 한 전역 스코프를 공유하는 일반 스크립트(모듈 아님) — index.html의 순서대로 로드. 다른 파일의 함수는 호출 시점에만 쓸 것(최상위에서 즉시 호출 금지).
// ---------- 소환 ----------
let lastPull = null;
function gachaPicks(E) {
  const all = CHARS.filter(c => c.star === 3 && (!E || c.elem === E)); const miss = all.filter(c => !S.heroes[c.id]);
  const rot = (l) => l.slice().sort((a, b) => ((a.seed + S.pulls) % 97) - ((b.seed + S.pulls) % 97));
  const pick = rot(miss).concat(rot(all.filter(c => S.heroes[c.id]))).slice(0, 3); // 미보유 먼저, 모자라면 보유 영웅(흐리게)
  while (pick.length && pick.length < 3) pick.push(pick[0]);
  return { all, miss, pick };
}
function pullBtns(E, cls) {
  const cost = E ? C.GACHA_COST_ELEM : C.GACHA_COST;
  return `<div class="pullbtns ${cls || ''}"><button class="btn" data-pull="1" data-pelem="${E || ''}" ${S.crystal < cost ? 'disabled' : ''}>1회<span class="cost">${ico('crys')}${cost}</span></button><button class="btn p ten" data-pull="10" data-pelem="${E || ''}" ${S.crystal < cost * 10 ? 'disabled' : ''}>10회 소환<span class="cost">${ico('crys')}${(cost * 10).toLocaleString()}</span></button></div>`;
}
let gachaView = 'hero';
const viewSeg = (cur, a, b, key, c) => `<div class="seg viewseg">${[a, b, c].filter(Boolean).map(x => `<button class="${cur === x[0] ? 'on' : ''}" data-${key}="${x[0]}">${x[1]}</button>`).join('')}</div>`;
function bindViewSeg(m, key, set) { m.querySelectorAll(`.viewseg button[data-${key}]`).forEach(b => b.onclick = () => { set(b.dataset[key]); render(); }); }
function renderGacha(m) {
  if (gachaView === 'equip') { renderEqGacha(m); bindViewSeg(m, 'gv', v => gachaView = v); return; }
  if (gachaView === 'ex') { renderExGacha(m); bindViewSeg(m, 'gv', v => gachaView = v); return; }
  const g = gachaPicks('');
  const elemCards = C.ELEMS.map(e => { const x = gachaPicks(e); return `<div class="gcard e-${e}"><div class="gh"><div class="gt"><b>${elemDot(e)}${C.ELEM_NAME[e]} 소환</b><span class="tiny num">★3 ${x.all.length - x.miss.length}/${x.all.length}</span></div><div class="gsp">${x.pick.slice(0, 3).map(c => `<img src="${imgOf(c.id)}" alt="${c.name}" class="${S.heroes[c.id] ? 'has' : ''}">`).join('')}</div></div>${pullBtns(e, 'sm')}</div>`; }).join('');
  m.innerHTML = `${viewSeg('hero', ['hero', '영웅 소환'], ['equip', '장비 소환'], 'gv', ['ex', '전용 소환'])}${(() => { const pk = G.pickup(); if (!pk) return ''; const c = byId(pk.id); const hrs = Math.max(1, Math.ceil((pk.until - Date.now()) / 3600000)); const share = C.PICKUP_MULT / (g.all.length - 1 + C.PICKUP_MULT);
      return `<div class="banner pick"><img class="pil" src="${illOf(pk.id)}" alt="${c.name} 일러스트" style="transform:scale(${Math.max(1, (illCfg(pk.id).zoom || 1) * 0.85)});transform-origin:50% ${illCfg(pk.id).y == null ? 15 : illCfg(pk.id).y}%">
      <div class="tl"><span class="pill">픽업</span><span class="num">${hrs}시간</span></div>
      
      <div class="bt"><div class="row" style="justify-content:center;gap:6px;margin-bottom:4px">${stars(3)}<span class="role">${elemDot(c.elem)}${C.ELEM_NAME[c.elem]} · ${C.ROLE_KR[c.role]}</span>${S.heroes[pk.id] ? '<span class="role gold">보유</span>' : ''}</div><b>${c.name}</b>${sigOf(pk.id) ? '<span>「' + sigOf(pk.id).name + '」</span>' : ''}</div></div>`; })()}
    ${(() => { const lv = C.gachaLv(S.pulls), next = C.GACHA_SLV[lv], prev = C.GACHA_SLV[lv - 1], rt = C.gachaRate(S.pulls), prog = next ? (S.pulls - prev) / (next - prev) : 1;
      return `<div class="card eqsl" style="margin-top:10px"><div class="lbl"><b>소환 Lv.${lv}</b><span class="num">${next ? `${S.pulls - prev} / ${next - prev}` : 'MAX'}</span></div><div class="bar"><i style="width:${Math.min(100, prog * 100)}%"></i></div>
        <div class="eqrate"><span style="color:var(--gold3)">★3 ${+(rt[3] * 100).toFixed(2)}%</span><span style="color:var(--crys2)">★2 ${+(rt[2] * 100).toFixed(1)}%</span><span>★1 ${+(rt[1] * 100).toFixed(1)}%</span></div></div>`; })()}
    ${pullBtns('')}
    <div id="gres" style="margin-top:10px"></div>
    ${wishCard()}
    <h3 style="margin-top:14px">속성 소환</h3>
    ${elemCards}`;
  m.querySelectorAll('button[data-pull]').forEach(b => b.onclick = () => doPull(+b.dataset.pull, b.dataset.pelem || null));
  if ($('#wish-pick')) $('#wish-pick').onclick = openWish;
  bindViewSeg(m, 'gv', v => gachaView = v);
  if (lastPull) showPull(lastPull);
}
// 지정 소환(시즌 3): 게이지가 차면 지정한 ★3 확정
function wishCard() {
  const w = S.wish ? byId(S.wish) : null; 
  return `<div class="card wish ${w ? 'e-' + w.elem : 'none'}" style="margin-bottom:10px"><button class="wsel" id="wish-pick" aria-label="지정 영웅 선택">${w ? `<img src="${imgOf(w.id)}" alt="${w.name}">` : '<span>+</span>'}</button>
    <div class="pity"><div class="lbl"><b>지정 소환${w ? ' · ' + w.name : ''}</b><span><em>${S.pity}</em> / ${C.PITY}</span></div><div class="bar"><i style="width:${Math.min(100, S.pity / C.PITY * 100)}%"></i></div></div></div>`;
}
function openWish() {
  modal(`<h2>지정 소환</h2>` + C.ELEMS.map(e => `<div class="wgh">${elemDot(e)}${C.ELEM_NAME[e]}</div><div class="wgrid">${CHARS.filter(c => c.star === 3 && c.elem === e).map(c => `<button class="wpick e-${e} ${S.wish === c.id ? 'on' : ''} ${S.heroes[c.id] ? 'has' : ''}" data-wish="${c.id}"><img src="${imgOf(c.id)}" alt="" loading="lazy"><b>${c.name}</b><small>${C.ROLE_KR[c.role]}${S.heroes[c.id] ? ' · 보유' : ''}</small></button>`).join('')}</div>`).join(''));
  document.querySelectorAll('#modal [data-wish]').forEach(b => b.onclick = () => { if (G.setWish(S, +b.dataset.wish)) { save(); closeModal(); render(); } });
}
function doPull(n, elem) {
  const r = G.pull(S, n, null, elem || null, Date.now()); if (!r) return; save(true); lastPull = r; renderGacha($('#main')); renderTop();
  const s3 = r.filter(x => x.star === 3).sort((a, b) => b.isNew - a.isNew); const pop = () => pullPop(r, n, elem); if (s3.length) summonFx(s3, pop); else pop();
}
// 소환 결과 창(2026-11-17, 사용자 '10회 소환을 눌러도 화면에 변화가 없다 — 결과가 픽업 아래에 나와서'): ★3 연출이 끝나면 결과를 창으로 띄움. 같은 소환을 바로 다시 할 수 있음
function pullPop(r, n, elem) {
  const cost = (elem ? C.GACHA_COST_ELEM : C.GACHA_COST) * n, best = Math.max(...r.map(x => x.star));
  modal(`<h2><span class="eyebrow">${elem ? C.ELEM_NAME[elem] + ' 소환' : '별무리 소환'} · ${n}회</span>소환 결과</h2>
    <div class="gpop ${best === 3 ? 'b3' : best === 2 ? 'b2' : ''}">${r.map((x, i) => { const dp = !x.isNew && x.star < 3 && C.DUPE_PITY ? C.DUPE_PITY[x.star] : 0; return `<div class="gpw" style="animation-delay:${i * 70}ms">${heroCard(x.id, { isNew: x.isNew, noParty: true })}${dp ? `<i class="gdp">+${dp}</i>` : ''}</div>`; }).join('')}</div>
    <div class="gpopb"><button class="btn" id="gp-close">닫기</button><button class="btn p" id="gp-again" ${S.crystal < cost ? 'disabled' : ''}>${n}회 더<span class="cost">${ico('crys')}${cost.toLocaleString()}</span></button></div>`);
  document.querySelectorAll('#modal .gpop .hcard').forEach(c => c.onclick = () => openHero(+c.dataset.id));
  $('#gp-close').onclick = closeModal; $('#gp-again').onclick = () => { closeModal(); doPull(n, elem); };
}
// ★3 소환 연출: 암전 → 빛 구슬(금빛 → 속성색) → 빛기둥·섬광 → 일러스트(없으면 도트) + 별·이름·대사. 탭 = 다음 단계, 건너뛰기 = 전부 닫기
function summonFx(list, done) {
  let i = 0, ph = 0, tm = []; const ov = document.createElement('div'); ov.id = 'sfx'; document.body.appendChild(ov);
  const clear = () => { tm.forEach(clearTimeout); tm = []; };
  const close = () => { clear(); ov.remove(); if (done) done(); };
  const toP3 = () => { clear(); ph = 3; ov.className = 'sfx tint p3'; };
  const play = () => {
    const x = list[i], ch = byId(x.id), cfg = illCfg(x.id), sig = sigOf(x.id);
    const pic = cfg ? `<div class="sfx-ill"><img src="${cfg.src}" alt="" style="object-position:50% ${cfg.y == null ? 15 : cfg.y}%"></div>` : `<div class="sfx-ill spr"><img src="${imgOf(x.id)}" alt=""></div>`;
    ov.style.setProperty('--ec', `var(--e-${ch.elem})`);
    ov.innerHTML = `<button class="sfx-skip">건너뛰기</button><div class="sfx-rays"></div><div class="sfx-orb"></div><div class="sfx-beam"></div><div class="sfx-flash"></div>
      <div class="sfx-hero">${pic}<div class="sfx-info"><div class="sfx-st"><i>★</i><i>★</i><i>★</i></div><div class="sfx-tg">${x.isNew ? '<span class="new">NEW</span>' : `<span class="dup">조각 +${C.DUPE_SHARDS[3]}</span>`}<span class="role">${elemDot(ch.elem)}${C.ELEM_NAME[ch.elem]} · ${C.ROLE_KR[ch.role]}</span></div><div class="sfx-nm">${ch.name}</div>${sig && sig.line ? `<div class="sfx-ln">「${sig.line}」</div>` : ''}</div></div>
      ${list.length > 1 ? `<div class="sfx-cnt num">${i + 1} / ${list.length}</div>` : ''}`;
    ov.querySelector('.sfx-skip').onclick = (e) => { e.stopPropagation(); close(); };
    ph = 1; ov.className = 'sfx p1'; void ov.offsetWidth;
    tm.push(setTimeout(() => ov.classList.add('tint'), 700), setTimeout(() => { ph = 2; ov.className = 'sfx tint p2'; }, 1250), setTimeout(toP3, 1700));
  };
  ov.onclick = () => { if (ph < 3) { toP3(); return; } if (++i < list.length) play(); else close(); };
  play();
}
function reveal(id) {
  const ch = byId(id);
  modal(`<div class="reveal">${illustBlock(id)}<div class="ilinfo-src" style="text-align:center"><div class="tiny" style="color:var(--gold3);letter-spacing:.25em;font-weight:700">NEW HERO</div><div class="name">${ch.name}</div><div class="row" style="justify-content:center;gap:6px;margin-top:4px">${stars(ch.star)}<span class="role">${elemDot(ch.elem)}${C.ELEM_NAME[ch.elem]} · ${C.ROLE_KR[ch.role]}</span></div></div><div style="text-align:center;margin-top:10px"><button class="btn p" id="rv-ok">상세 보기</button></div></div>`);
  bindIllust($('#modal-box')); $('#rv-ok').onclick = () => openHero(id);
}
function showPull(r) {
  $('#gres').innerHTML = `<div class="card" style="margin-bottom:10px;padding-top:8px"><h3 style="margin:0 0 6px">소환 결과</h3><div class="gacha-res" style="margin-top:0">${r.map((x, i) => heroCard(x.id, { isNew: x.isNew, noParty: true }).replace('class="hcard', `style="animation-delay:${i * 90}ms" class="hcard`)).join('')}</div></div>`;
  document.querySelectorAll('#gres .hcard').forEach(c => c.onclick = () => openHero(+c.dataset.id));
}

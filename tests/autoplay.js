// 무한 모드 자동 플레이 테스트.
// 사용: node tests/autoplay.js [난이도 0~2] [최대 라운드] [시드 보유 캐릭터 이름들...]
// 예:  node tests/autoplay.js 0 60 태양신 검신
// Playwright + Chromium 필요. 환경변수 PW_MODULE / PW_CHROMIUM 으로 경로를 지정할 수 있습니다.
// 봇은 소환 → "지금 가능" 조합을 높은 등급부터 실행 → 보스 보상은 공격력 선택 → 도전 보스는 가능하면 소환합니다.
const path = require('path');
const pwPath = process.env.PW_MODULE || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node-tools/node_modules/playwright'; } })();
const { chromium } = require(pwPath);
const diff = Number(process.argv[2] || 0), maxRound = Number(process.argv[3] || 80), seed = process.argv.slice(4);
const file = 'file://' + path.resolve(__dirname, '../docs/index.html') + '#debug';
(async () => {
  const launch = { args: ['--no-sandbox'] }; if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM; else if (require('fs').existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(file);
  const chars = {}; for (const n of seed) chars[n] = 1;
  await page.evaluate(c => localStorage.setItem('rtd_meta', JSON.stringify({ gems: 0, chars: c, items: [], equip: { weapon: null, boots: null, trinket: null }, best: 0, runs: 0, seq: 0, bestInf: 0 })), chars);
  await page.reload(); await page.waitForTimeout(200);
  await page.click('[data-tab="deploy"]');
  await page.evaluate(i => [...document.querySelectorAll('#modes .mode.inf button')][i].click(), diff);
  await page.waitForTimeout(100);
  for (const n of seed) await page.evaluate(n => window.__rtd.give(n), n);
  await page.click('#bSpeed'); await page.click('#bSpeed'); // ×3
  const t0 = Date.now(); let last = null, lastRound = 0;
  for (let i = 0; i < 20000; i++) {
    await page.waitForTimeout(120);
    const st = await page.evaluate(() => {
      const S = window.__rtd.state(); if (!S) return null;
      const ov = document.getElementById('overlay');
      if (!ov.hidden) { const t = ov.innerText; if (t.includes('보스 보상 선택')) { const ch = document.querySelectorAll('#overlay .choice'); ch[ch.length - 1].click(); return { round: S.round, choice: true }; } return { over: t.replace(/\n+/g, ' | ').slice(0, 260), round: S.round, kills: S.kills, peak: S.peakDps, units: S.units.length }; }
      if (S.phase !== 'play') return { round: S.round };
      const b = document.getElementById('bSummon'); if (!b.disabled) b.click();
      // 조합: 지금 가능 탭에서 등급 높은 순
      const tabs = [...document.querySelectorAll('#recipes .rtabs button')]; const now = tabs.find(t => t.textContent.includes('지금 가능')); if (now && !now.classList.contains('on')) now.click();
      const rows = [...document.querySelectorAll('#recipes .recipe.ok')]; if (rows.length) { const btn = [...rows[rows.length - 1].querySelectorAll('button')].pop(); if (btn && !btn.disabled) btn.click(); }
      const ch = document.getElementById('bChallenge'); if (ch && !ch.disabled && window.__rtd.boardDps() >= window.__rtd.challengeHp() / 12) ch.click(); // 실측 유효 피해 ≈ 보드 DPS의 10~35%
      return { round: S.round, gold: S.gold, units: S.units.length, top: Math.max(0, ...S.units.map(u => u.grade)), mon: S.monsters.filter(m => !m.dead).length };
    });
    if (!st) break;
    if (st.over) { last = st; break; }
    if (st.round !== lastRound) { lastRound = st.round; if (st.round % 10 === 0) console.log(`R${st.round} gold=${st.gold} units=${st.units} topGrade=${st.top} mon=${st.mon} ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    if (st.round >= maxRound) { last = { stoppedAt: st.round, ...st }; break; }
  }
  console.log(JSON.stringify({ diff, seed, result: last, elapsedSec: Math.round((Date.now() - t0) / 1000), errors }, null, 1));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });

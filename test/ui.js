// 브라우저 UI 자동 클릭 테스트. 사용: node test/ui.js [진행 스텝 수]
const { chromium } = require('playwright');
const path = require('path');
const out = process.env.SHOT_DIR || path.join(__dirname, 'shots');
(async () => {
  const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', process.env.FILE || 'index.html'));
  await page.screenshot({ path: out + '/01-home.png' });
  await page.click('[data-act=new]');
  await page.fill('#cName', '김루키');
  await page.click('[data-act=cpos][data-arg=ST]');
  await page.screenshot({ path: out + '/02-create.png', fullPage: true });
  await page.click('[data-act=cstart]');
  await page.screenshot({ path: out + '/03-plan.png', fullPage: true });
  const shots = {};
  const steps = +process.argv[2] || 400;
  for (let i = 0; i < steps; i++) {
    const phase = await page.evaluate(() => Engine.S.phase);
    if (!shots[phase] || (phase === 'match' && shots[phase] < 3)) {
      shots[phase] = (shots[phase] || 0) + 1;
      await page.screenshot({ path: `${out}/p-${phase}-${shots[phase]}.png`, fullPage: true });
    }
    const btn = await page.$('[data-act=mom]') || await page.$('[data-act=mdone]') || await page.$('[data-act=evok]') || await page.$('[data-act=ev]:not([disabled])')
      || await page.$('[data-act=win]') || await page.$('[data-act=sack]') || await page.$('[data-act=tjoin]') || await page.$('[data-act=tnext]') || await page.$('[data-act=tack]')
      || await page.$('[data-act=off][data-arg=continue]') || await page.$('[data-act=off]') || await page.$('[data-act=submit]');
    if (!btn) { console.log('no button at phase', phase); break; }
    if (phase === 'plan' && i % 5 === 0) {
      const sk = await page.$('[data-act=skill]:not([disabled]):not([data-arg=""])');
      if (sk) await sk.click();
      await page.click('[data-act=int][data-arg="2"]');
    }
    await (phase === 'plan' ? page.click('[data-act=submit]') : btn.click());
    if (phase === 'retired') { await page.click('[data-act=legacy]'); await page.screenshot({ path: out + '/legacy.png', fullPage: true }); await page.click('[data-act=back]'); break; }
  }
  for (const t of ['player', 'record', 'table', 'menu']) {
    await page.click(`[data-act=tab][data-arg=${t}]`);
    await page.screenshot({ path: `${out}/t-${t}.png`, fullPage: true });
  }
  await page.click('[data-act=tab][data-arg=play]');
  // 저장 → 새로고침 → 이어하기
  await page.reload();
  await page.click('[data-act=continue]');
  const ok = await page.evaluate(() => !!Engine.S && Engine.S.p.name);
  console.log('reload continue:', ok, 'phase', await page.evaluate(() => Engine.S.phase), 'season', await page.evaluate(() => Engine.S.season.label));
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();

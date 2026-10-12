// src/ 의 파일을 합칩니다.
//   node tools/build.js            → index.html (단일 파일, 엠블럼은 인터넷 주소)
//   node tools/build.js --artifact → dist/artifact.html (claude.ai Artifact용, 엠블럼 내장·계정 저장)
//                                     먼저 python3 tools/embed-logos.py 로 dist/logo-data.js 생성 필요
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const strip = s => s.replace(/\/\*NODE\*\/[\s\S]*?\/\*\/NODE\*\//g, '').replace(/^'use strict';\n/, '');
const artifact = process.argv.includes('--artifact');
const js = [strip(rd('src/data.js')), fs.existsSync(path.join(root, 'src/logos.js')) ? strip(rd('src/logos.js')) : '',
  artifact ? rd('dist/logo-data.js') : '', strip(rd('src/engine.js')), strip(rd('src/ui.js'))].join('\n');
let html;
if (artifact) {
  // Artifact 게시 시 doctype/head/body 골격이 자동으로 씌워지므로 내용만 작성
  html = `<title>풋볼 라이프</title>\n<style>\n${rd('src/style.css')}\n</style>\n<div id="app"></div>\n<script>\n'use strict';\n${js}\n</script>\n`;
} else {
  html = rd('src/template.html').replace('/*STYLE*/', () => rd('src/style.css')).replace('/*DATA*/\n/*ENGINE*/\n/*UI*/', () => js);
}
const out = path.join(root, artifact ? 'dist/artifact.html' : 'index.html');
// 문법 검사: 스크립트가 해석되지 않으면 빌드 중단
try { new Function(html.split('<script>')[1].split('</script>')[0]); } catch (e) { console.error('스크립트 문법 오류:', e.message); process.exit(1); }
fs.writeFileSync(out, html);
console.log(path.relative(root, out), (html.length / 1024).toFixed(1) + 'KB');

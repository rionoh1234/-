// src/ 의 파일을 하나의 index.html 로 합칩니다.  사용: node tools/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const strip = s => s.replace(/\/\*NODE\*\/[\s\S]*?\/\*\/NODE\*\//g, '');
let html = rd('template.html');
html = html.replace('/*STYLE*/', () => rd('style.css'))
  .replace('/*DATA*/', () => strip(rd('data.js')) + '\n' + (fs.existsSync(path.join(root, 'src', 'logos.js')) ? rd('logos.js').replace(/^'use strict';\n/, '') : ''))
  .replace('/*ENGINE*/', () => strip(rd('engine.js')).replace(/^'use strict';\n/, ''))
  .replace('/*UI*/', () => rd('ui.js').replace(/^'use strict';\n/, ''));
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(1) + 'KB');

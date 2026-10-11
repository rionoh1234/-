// fetch-logos.js 결과에서 누락·오매칭 구단을 대체 검색어로 보정합니다. 사용: node tools/fix-logos.js
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'src', 'logos.js');
const src = fs.readFileSync(file, 'utf8');
const LOGOS = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
// [검색어 후보..., 리그 이름에 포함돼야 하는 문자열]
const FIX = {
  nfo: [['Nottingham Forest', "Nott'm Forest", 'Nottingham'], 'English'], hsv: [['Hamburg', 'Hamburger SV', 'HSV'], 'German'],
  los: [['Lille', 'Lille OSC', 'LOSC'], 'French'], gro: [['Groningen', 'FC Groningen'], 'Dutch'], fcp: [['Porto', 'FC Porto'], 'Portuguese'],
  seouland: [['Seoul E-Land FC', 'Seoul E Land', 'Seoul E-Land'], 'Korean'], psg: [['Paris Saint-Germain', 'Paris Saint Germain', 'PSG'], 'French Ligue 1'],
  hilal: [['Al Hilal', 'Al-Hilal Saudi', 'Al Hilal SFC'], 'Saudi'], nassr: [['Al Nassr', 'Al-Nassr FC'], 'Saudi'], ittihad: [['Al Ittihad', 'Al-Ittihad Jeddah', 'Ittihad'], 'Saudi'],
  ahli: [['Al Ahli', 'Al-Ahli Saudi', 'Al Ahli Jeddah'], 'Saudi'], qadsiah: [['Al Qadsiah', 'Al-Qadisiyah', 'Al Qadisiyah'], 'Saudi'],
  shabab: [['Al Shabab', 'Al-Shabab Riyadh'], 'Saudi'], taawoun: [['Al Taawoun', "Al-Ta'awoun", 'Al Taawon'], 'Saudi'],
  ettifaq: [['Al Ettifaq', 'Al-Ettifaq FC', 'Ettifaq'], 'Saudi'], khaleej: [['Al Khaleej', 'Al-Khaleej Saihat'], 'Saudi'], fateh: [['Al Fateh', 'Al-Fateh SC'], 'Saudi'],
  estu: [['Estudiantes de La Plata', 'Estudiantes LP', 'Estudiantes'], 'Argentin'],
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) { for (let i = 0; i < 4; i++) { try { const r = await fetch(url); if (r.status === 429) { await sleep(20000); continue; } return await r.json(); } catch (e) { await sleep(3000); } } return null; }
(async () => {
  for (const id in FIX) {
    const [names, lg] = FIX[id];
    let found = null;
    for (const n of names) {
      const j = await get('https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=' + encodeURIComponent(n));
      await sleep(2200);
      const t = ((j && j.teams) || []).find(x => x.strSport === 'Soccer' && x.strGender !== 'Female' && x.strBadge && [x.strLeague, x.strLeague2, x.strCountry].join(' ').includes(lg.split(' ')[0]) && (lg.split(' ').length === 1 || (x.strLeague || '').includes(lg)));
      if (t) { found = t; break; }
    }
    if (found) { LOGOS.clubs[id] = found.strBadge; console.log(id, '->', found.strTeam, '|', found.strLeague); } else { delete LOGOS.clubs[id]; console.log(id, 'STILL MISSING'); }
  }
  const j = await get('https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?s=Soccer');
  const acl = ((j && (j.countries || j.countrys)) || []).find(l => /AFC Champions League/i.test(l.strLeague) && !/Two|2/.test(l.strLeague));
  if (acl && (acl.strBadge || acl.strLogo)) { LOGOS.leagues.ACL = acl.strBadge || acl.strLogo; console.log('ACL ->', acl.strLeague); } else { delete LOGOS.leagues.ACL; console.log('ACL STILL MISSING'); }
  fs.writeFileSync(file, `'use strict';\n// 자동 생성: node tools/fetch-logos.js → node tools/fix-logos.js (출처: TheSportsDB)\nconst LOGOS = ${JSON.stringify(LOGOS, null, 1)};\n`);
})();

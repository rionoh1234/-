// TheSportsDB에서 구단/대회 엠블럼 URL을 수집해 src/logos.js 를 만듭니다. 사용: node tools/fetch-logos.js
const fs = require('fs'), path = require('path');
const EN = {
  mci: 'Manchester City', ars: 'Arsenal', liv: 'Liverpool', che: 'Chelsea', mun: 'Manchester United', tot: 'Tottenham Hotspur',
  new: 'Newcastle United', avl: 'Aston Villa', bha: 'Brighton and Hove Albion', whu: 'West Ham United', cry: 'Crystal Palace', ful: 'Fulham',
  bre: 'Brentford', bou: 'Bournemouth', nfo: 'Nottingham Forest', eve: 'Everton', wol: 'Wolverhampton Wanderers', lee: 'Leeds United',
  bur: 'Burnley', sun: 'Sunderland', lei: 'Leicester City', sou: 'Southampton', ips: 'Ipswich Town', shu: 'Sheffield United',
  mid: 'Middlesbrough', nor: 'Norwich City', wat: 'Watford', wba: 'West Bromwich Albion', cov: 'Coventry City', sto: 'Stoke City',
  swa: 'Swansea City', hul: 'Hull City',
  rma: 'Real Madrid', bar: 'Barcelona', atm: 'Atletico Madrid', ath: 'Athletic Bilbao', vil: 'Villarreal', rso: 'Real Sociedad',
  bet: 'Real Betis', sev: 'Sevilla', val: 'Valencia', cel: 'Celta Vigo', gir: 'Girona', mlr: 'Mallorca', osa: 'Osasuna',
  ray: 'Rayo Vallecano', get: 'Getafe', esp: 'Espanyol',
  fcb: 'Bayern Munich', b04: 'Bayer Leverkusen', bvb: 'Borussia Dortmund', rbl: 'RB Leipzig', sge: 'Eintracht Frankfurt', vfb: 'VfB Stuttgart',
  scf: 'SC Freiburg', wob: 'VfL Wolfsburg', bmg: 'Borussia Monchengladbach', m05: 'Mainz', tsg: 'Hoffenheim', fcu: 'Union Berlin',
  svw: 'Werder Bremen', fca: 'Augsburg', koe: 'FC Koln', hsv: 'Hamburger SV',
  int: 'Inter Milan', nap: 'Napoli', juv: 'Juventus', mil: 'AC Milan', ata: 'Atalanta', rom: 'Roma', laz: 'Lazio', fio: 'Fiorentina',
  bol: 'Bologna', com: 'Como', tor: 'Torino', udi: 'Udinese', gen: 'Genoa', par: 'Parma', cag: 'Cagliari', lec: 'Lecce',
  psg: 'Paris SG', om: 'Marseille', asm: 'Monaco', los: 'Lille', ol: 'Lyon', ogc: 'Nice', rcl: 'Lens', srf: 'Rennes',
  rcs: 'Strasbourg', fcn: 'Nantes', tfc: 'Toulouse', sb29: 'Brest',
  psv: 'PSV Eindhoven', aja: 'Ajax', fey: 'Feyenoord', az: 'AZ Alkmaar', twe: 'FC Twente', utr: 'FC Utrecht', hee: 'Heerenveen',
  gro: 'FC Groningen', nec: 'NEC Nijmegen', spa: 'Sparta Rotterdam',
  ben: 'Benfica', fcp: 'FC Porto', scp: 'Sporting CP', bra: 'Braga', vsc: 'Vitoria Guimaraes', fam: 'Famalicao', rio: 'Rio Ave',
  est: 'Estoril', gil: 'Gil Vicente', mor: 'Moreirense',
  ulsan: 'Ulsan HD', jeonbuk: 'Jeonbuk Hyundai Motors', pohang: 'Pohang Steelers', seoul: 'FC Seoul', gimcheon: 'Gimcheon Sangmu',
  gangwon: 'Gangwon FC', daejeon: 'Daejeon Hana Citizen', gwangju: 'Gwangju FC', jeju: 'Jeju United', suwonfc: 'Suwon FC', daegu: 'Daegu FC',
  anyang: 'FC Anyang', suwon: 'Suwon Samsung Bluewings', incheon: 'Incheon United', busan: 'Busan IPark', jeonnam: 'Jeonnam Dragons',
  seongnam: 'Seongnam FC', bucheon: 'Bucheon FC 1995', gyeongnam: 'Gyeongnam FC', chungbuk: 'Chungbuk Cheongju', ansan: 'Ansan Greeners',
  cheonan: 'Cheonan City', seouland: 'Seoul E-Land', gimpo: 'Gimpo FC',
  kobe: 'Vissel Kobe', kashima: 'Kashima Antlers', hiroshima: 'Sanfrecce Hiroshima', kawasaki: 'Kawasaki Frontale', marinos: 'Yokohama F. Marinos',
  urawa: 'Urawa Red Diamonds', fctokyo: 'FC Tokyo', gamba: 'Gamba Osaka', cerezo: 'Cerezo Osaka', nagoya: 'Nagoya Grampus',
  kashiwa: 'Kashiwa Reysol', machida: 'Machida Zelvia',
  hilal: 'Al-Hilal', nassr: 'Al-Nassr', ittihad: 'Al-Ittihad', ahli: 'Al-Ahli', qadsiah: 'Al-Qadsiah', shabab: 'Al-Shabab',
  taawoun: 'Al-Taawoun', ettifaq: 'Al-Ettifaq', khaleej: 'Al-Khaleej', fateh: 'Al-Fateh',
  fla: 'Flamengo', pal: 'Palmeiras', bot: 'Botafogo', spfc: 'Sao Paulo', cor: 'Corinthians', flu: 'Fluminense', gre: 'Gremio',
  inter: 'Internacional', cru: 'Cruzeiro', atl: 'Atletico Mineiro', vas: 'Vasco da Gama', bah: 'Bahia',
  riv: 'River Plate', boc: 'Boca Juniors', rac: 'Racing Club', ind: 'Independiente', estu: 'Estudiantes', vel: 'Velez Sarsfield',
  tal: 'Talleres', sl: 'San Lorenzo',
};
// 대회: TheSportsDB 리그 ID
const LG = {
  EPL: 4328, CHAMP: 4329, LIGA: 4335, BUN: 4331, SA: 4332, L1: 4334, ERE: 4337, POR: 4344, K1: 4689, K2: 4822, J1: 4633,
  SPL: 4668, BRA: 4351, ARG: 4406, UCL: 4480, ACL: 4720, LIB: 4501, WC: 4429, EURO: 4502, COPA: 4499, ASIAN: 4866,
  FA: 4482, CDR: 4483, DFB: 4485, CIT: 4506, CDF: 4484,
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
async function get(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (r.status === 429) { await sleep(20000); continue; } return await r.json(); }
    catch (e) { await sleep(3000); }
  }
  return null;
}
(async () => {
  const out = { clubs: {}, leagues: {} }, miss = [];
  for (const id in EN) {
    const j = await get('https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=' + encodeURIComponent(EN[id]));
    const teams = ((j && j.teams) || []).filter(t => t.strSport === 'Soccer' && t.strGender !== 'Female' && t.strBadge);
    const want = norm(EN[id]);
    const t = teams.find(x => norm(x.strTeam) === want) || teams.find(x => norm(x.strTeamAlternate).includes(want)) || teams[0];
    if (t) { out.clubs[id] = t.strBadge; console.log(id, '->', t.strTeam, '|', t.strLeague); } else { miss.push(id); console.log(id, 'MISSING'); }
    await sleep(2200);
  }
  for (const k in LG) {
    const j = await get('https://www.thesportsdb.com/api/v1/json/3/lookupleague.php?id=' + LG[k]);
    const l = j && j.leagues && j.leagues[0];
    if (l && (l.strBadge || l.strLogo)) { out.leagues[k] = l.strBadge || l.strLogo; console.log(k, '->', l.strLeague); } else console.log(k, 'MISSING');
    await sleep(2200);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'logos.js'), `'use strict';\n// 자동 생성: node tools/fetch-logos.js (출처: TheSportsDB)\nconst LOGOS = ${JSON.stringify(out, null, 1)};\n`);
  console.log('missing:', miss.join(','));
})();

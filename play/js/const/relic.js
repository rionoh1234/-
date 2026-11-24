// 상수·수식 7: 유물·큰 수 표기·RNG
(function (g) {
  const C = g.RPG.C;
  const T = g.TUNE || {};
  // ---------- 유물 (별의 파편으로 영구 강화, 상한 없음) ----------
  C.RELICS = {
    crown: { name: '왕의 인장', icon: '👑', per: 0.03, comp: true, desc: '공격력 ×1.03 (복리)', fmt: (lv) => '공격력 +' + Math.round((Math.pow(1.03, lv) - 1) * 100) + '%' },
    aegis: { name: '수호의 문장', icon: '🛡️', per: 0.03, comp: true, desc: '체력 ×1.03 (복리)', fmt: (lv) => '체력 +' + Math.round((Math.pow(1.03, lv) - 1) * 100) + '%' },
    hand: { name: '황금 손', icon: '🪙', per: 0.04, comp: true, max: 60, desc: '골드 획득 ×1.04 (복리, 최대 Lv60)', fmt: (lv) => '골드 +' + Math.round((Math.pow(1.04, lv) - 1) * 100) + '%' },
    eye: { name: '별의 눈', icon: '👁️', per: 0.10, desc: '치명타 피해 +10%p (상한 없음)', fmt: (lv) => '치명타 피해 +' + Math.round(lv * 10) + '%p' },
    sand: { name: '시간의 모래', icon: '⏳', per: 0.01, max: 40, desc: '스킬 쿨타임 -1% (최대 -40%)', fmt: (lv) => '쿨타임 -' + lv + '%' },
    scythe: { name: '수확자의 낫', icon: '💀', per: 0.05, desc: '보스에게 주는 피해 +5%', fmt: (lv) => '보스 피해 +' + Math.round(lv * 5) + '%' },
  };
  C.RELIC_KEYS = ['crown', 'aegis', 'hand', 'eye', 'sand', 'scythe'];
  C.relicCost = function (key, lv) { return Math.round(10 * Math.pow(1.12, lv)); };
  C.SSHARD_STAGE = 10;      // 100스테이지 이후 보스 스테이지 첫 클리어 시
  C.SSHARD_DG = function (lv) { return 3 + lv; };   // 던전 레벨 첫 클리어 시

  // 큰 수 표기(2026-10-31 사용자): 1000배마다 a, b, … z, 그다음 aa, ab, … az, ba, … zz, 그다음 aaa … zzz, aaaa … (1a = 1,000)
  C.unitName = function (k) { let s = ''; while (k > 0) { k--; s = String.fromCharCode(97 + (k % 26)) + s; k = Math.floor(k / 26); } return s; };
  C.fmt = function (n) {
    n = Math.floor(n); if (!isFinite(n)) return '∞'; if (n < 0) return '-' + C.fmt(-n); if (n < 1000) return String(n);
    let k = Math.floor(Math.log10(n) / 3), v = n / Math.pow(10, k * 3);
    if (v >= 1000) { k++; v /= 1000; } else if (v < 1) { k--; v *= 1000; }
    v *= 1 + 1e-9;   // 부동소수 오차(9.03 → 9.02) 방지
    const t = v >= 100 ? String(Math.floor(v)) : v >= 10 ? (Math.floor(v * 10) / 10).toFixed(1) : (Math.floor(v * 100) / 100).toFixed(2);
    return t + C.unitName(k);
  };
  // 결정론적 RNG (mulberry32)
  C.seededRng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);

// 어둠 ★3 — 고유 스킬(SIG)·전용장비(EXCLUSIVE). 이 속성 영웅을 고칠 때는 이 파일만 열면 된다(공통 규칙·필드 설명은 data/el/_notes.md).
(function (g) { g.SIG = g.SIG || {}; g.EXCLUSIVE = g.EXCLUSIVE || {};
// ── 고유 스킬 · 소개 · 대사 ──
Object.assign(g.SIG, {
  60: { name: '죽음의 날개', type: 'shield', pct: 0.4, cd: 15, selfDef: 0.6, dur: 7, desc: '검은 날개로 아군 전체를 감싸 최대 체력 40% 보호막 + 자신 방어력 60%↑ 7초',
    intro: '죽은 흑룡의 날개를 이어받은 기사. 그 날개가 펼쳐지면 하늘이 검게 물들고, 그 뒤에 선 동료는 다치지 않는다.', line: '뒤에 서라. 용은 등을 보이지 않는다.' },
  61: { name: '사신의 원무', type: 'whirl', hits: 6, r: 70, mult: 1.3, cd: 13, tr: { k: 'bleedshield', v: 0.02, max: 0.3, dmg: 0.3 }, desc: '낫을 휘돌려 주변 적 전체에 130% 피해 6회 · 출혈 걸린 적에게 모르가나의 모든 피해 +30%, 때릴 때마다 최대 체력 2% 보호막(최대 30%)',
    intro: '그믐달 아래에서만 춤추는 사신. 춤이 끝나면 박수칠 관객이 남지 않는다.', line: '한 곡 추자. 끝까지 서 있으면 놓아줄게.' },
  64: { name: '망자의 역병', type: 'plague', mult: 1.0, grant: 'bleed', cd: 13, postNova: { r: 120, mult: 0, stun: 2 }, desc: '주변 적 2초 기절 · 3초간 중독 + 7초간 아군 공격이 50% 확률로 출혈',
    intro: '무덤을 왕좌 삼은 사령왕. 원정대에 합류한 이유는 "산 자가 더 재밌어서".', line: '죽음은 끝이 아니야. 내 밑에서 일하는 시작이지.' },
  69: { name: '그림자 처형', type: 'execute', th: 0.5, mult: 6.0, cd: 12, tr: { k: 'halfcd', v: 0.5, th: 0.5 }, desc: '적 하나에 600% 피해, 체력 50% 이하면 2배 · 보스 체력이 절반 이하면 쿨타임 50% 감소',
    intro: '왕국의 그림자를 다스리는 암살여왕. 그녀의 이름을 아는 사람은 둘뿐이고 하나는 이미 죽었다.', line: '쉿. 이미 끝났어.' },
  75: { name: '귀검 난무', type: 'multi', hits: 8, mult: 0.9, cd: 12, tr: { k: 'solo', v: 0.3, max: 1 }, desc: '적 하나에 90% 피해 8연타 · 편성에 다른 근접 딜러가 1명 이하면 닉스의 모든 피해 +30%',
    intro: '검에 깃든 귀신에게 몸을 내준 검사. 둘 중 누가 더 피를 좋아하는지는 불명.', line: '칼이 배고프다는군.' },
  77: { name: '마룡 돌격', type: 'dive', r: 65, mult: 4.5, cd: 12, desc: '적 밀집지로 돌격해 범위 450% 피해',
    intro: '마룡을 길들인 창기사. 정확히는 마룡이 그녀를 길들였다는 설도 있다.', line: '창끝이 향하는 곳이 전장이다.' },
  124: { name: '피의 성찬', type: 'bless', mult: 2.0, buff: 0, dur: 5, cd: 15, postNova: { r: 110, mult: 0.5, bleed: true, bleedT: 5 },
    desc: '아군 전체 회복(공격력 200%) + 주변 적 50% 피해·5초 출혈',
    intro: '가시관을 쓴 마녀. 적의 피로 아군의 상처를 메우는 금술을 쓴다.', line: '아파? 걱정 마. 대신 아플 사람은 따로 있으니까.' },
  125: { name: '영혼의 등불', type: 'bless', mult: 2.0, buff: 0, dur: 5, cd: 15, postDr: [0.2, 5],
    desc: '아군 전체 회복(공격력 200%) + 5초간 아군 받는 피해 20%↓',
    intro: '흑장미를 품은 수녀. 등불 속 영혼들이 그녀 대신 동료를 지킨다.', line: '이 불빛 안에서는, 아무도 길을 잃지 않아요.' },
  126: { name: '흑익 저격', type: 'execute', th: 0, mult: 7.5, hSlow: 4, ranged: true, cd: 12, tr: { k: 'immobile', v: 0.8 },
    desc: '적 하나에 750% 피해 + 둔화 · 기절·그로기·빙결로 묶인 적에게는 저격 피해 +80%',
    intro: '심연에서 돌아온 저격수. 한쪽 눈을 잃은 뒤로 오히려 빗나간 적이 없다.', line: '한 발이면 돼. 두 발은 낭비야.' },
  127: { name: '달콤한 꿈', type: 'anthem', atk: 0.3, aspd: 0, cdm: 1.5, dur: 7, cd: 15,   // 2026-11-21 버프 지원으로(수면·받는 피해↑ → 아군 버프)
    desc: '아군에게 7초간 꿈의 가호 — 공격력 30%↑ + 치명타 피해 150%p↑',
    intro: '양 인형을 안고 다니는 악몽술사. 그녀가 하품하면 적들이 먼저 잠든다.', line: '쉿… 좋은 꿈 꿔. 아니, 나쁜 꿈.' },
});
// ── 전용장비 레전드(a = 스킬 강화형 · b = 스킬 변화형) ──
Object.assign(g.EXCLUSIVE, {
  60: { a: { name: '데스윙의 심장', desc: '보호막 40 → 60% · 자신 방어력 60 → 100%↑', mod: { set: { pct: 0.6, selfDef: 1.0 } } },
        b: { name: '역린', desc: '보호막이 받은 피해 40% 반사 · 아군 공격력 20%↑', mod: { set: { reflect: 0.4, postAtk: 0.2 } } } },
  61: { a: { name: '그믐달 낫', desc: '사신의 원무 6 → 9회 · 범위 +20%', mod: { add: { hits: 3 }, mul: { r: 1.2 } } },
        b: { name: '죽음의 무도', desc: '원무에 맞은 적 1초 기절 · 피해의 30% 흡수', mod: { set: { hStun: 1, hDrain: 0.3 } } } },
  64: { a: { name: '사령서', desc: '망자의 역병 중독 피해 +70%', mod: { set: { dotMul: 1.7 } } },
        b: { name: '역병의 군세', desc: '중독된 적 받는 피해 30%↑ · 둔화', mod: { set: { hVuln: 0.3, hSlow: 5 } } } },
  69: { a: { name: '그림자 단검', desc: '처형 기준 체력 50 → 70% · 피해 +30%', mod: { set: { th: 0.7 }, mul: { mult: 1.3 } } },
        b: { name: '그림자 분신', desc: '분신과 함께 3명을 연속 처형(각 75%)', mod: { mul: { mult: 0.75 }, set: { repeat: 3 } } } },
  75: { a: { name: '귀신 들린 검집', desc: '귀검 난무 8 → 12연타', mod: { add: { hits: 4 } } },
        b: { name: '피의 검무', desc: '연타마다 피해의 20% 흡수 · 받는 피해 20%↑', mod: { set: { hDrain: 0.2, hVuln: 0.2 } } } },
  77: { a: { name: '마룡의 창', desc: '마룡 돌격 피해 +50%', mod: { mul: { mult: 1.5 } } },
        b: { name: '마룡의 포효', desc: '돌격 후 아군 공격력 30%↑ · 맞은 적 받는 피해 25%↑', mod: { set: { postAtk: 0.3, hVuln: 0.25 } } } },
  124: { a: { name: '가시 성배', desc: '회복 +50% · 출혈 피해 +50%', mod: { mul: { mult: 1.5 }, set: { postNova: { r: 110, mult: 0.5, bleed: true, bleedT: 5, bleedMul: 1.5 } } } },
         b: { name: '피의 계약', desc: '성찬 뒤 5초간 아군 받는 피해 20%↓', mod: { set: { postDr: [0.2, 5] } } } },
  125: { a: { name: '흑장미 묵주', desc: '회복 +50% · 피해 감소 20 → 35%', mod: { mul: { mult: 1.5 }, set: { postDr: [0.35, 5] } } },
         b: { name: '영혼 등불 지팡이', desc: '등불의 영혼불이 적 전체를 4초 둔화', mod: { set: { postSlow: 4 } } } },
  126: { a: { name: '까마귀의 눈', desc: '흑익 저격 피해 +50%', mod: { mul: { mult: 1.5 } } },
         b: { name: '관통 볼트', desc: '직선상의 적 전부를 꿰뚫음(450%)', mod: { set: { type: 'line', len: 220, w: 24, mult: 4.5 } } } },
  127: { a: { name: '키 맞춘 양 인형', desc: '치명타 피해 150 → 225%p↑', mod: { set: { cdm: 2.25 } } },
         b: { name: '멈춘 모래시계', desc: '꿈의 가호 7 → 10초', mod: { set: { dur: 10 } } } },
});
})(typeof window !== "undefined" ? window : globalThis);

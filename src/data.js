'use strict';
/* =========================================================
 * 게임 데이터
 * - 구단 전력(str)은 실제 평가가 아니라 게임 밸런스용 임의 수치입니다.
 * - 리그/컵/대륙대회 명칭은 텍스트로만 사용하며 로고는 쓰지 않습니다.
 * ========================================================= */

const POSITIONS = {
  ST:  { name: '스트라이커', group: 'ST' },
  LW:  { name: '왼쪽 윙어', group: 'W' },
  RW:  { name: '오른쪽 윙어', group: 'W' },
  CAM: { name: '공격형 미드필더', group: 'AM' },
  CM:  { name: '중앙 미드필더', group: 'CM' },
  CDM: { name: '수비형 미드필더', group: 'DM' },
  LB:  { name: '왼쪽 풀백', group: 'FB' },
  RB:  { name: '오른쪽 풀백', group: 'FB' },
  CB:  { name: '센터백', group: 'CB' },
  GK:  { name: '골키퍼', group: 'GK' },
};

// 포지션 변경 시 인접 포지션
const ADJACENT_POS = {
  ST: ['LW', 'RW', 'CAM'], LW: ['RW', 'ST', 'CAM', 'LB'], RW: ['LW', 'ST', 'CAM', 'RB'],
  CAM: ['CM', 'ST', 'LW', 'RW'], CM: ['CAM', 'CDM'], CDM: ['CM', 'CB'],
  LB: ['RB', 'LW', 'CB'], RB: ['LB', 'RW', 'CB'], CB: ['CDM', 'LB', 'RB'], GK: [],
};

const ATTRS_OUT = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
const ATTRS_GK = ['ref', 'div', 'han', 'gpo', 'kic', 'phy'];
const ATTR_NAME = {
  pac: '속도', sho: '슈팅', pas: '패스', dri: '드리블', def: '수비', phy: '피지컬',
  ref: '반사신경', div: '다이빙', han: '핸들링', gpo: '위치선정', kic: '킥',
};

// 포지션 그룹별 오버롤 가중치 (합계 1)
const OVR_WEIGHTS = {
  ST: { pac: .20, sho: .35, pas: .10, dri: .15, def: 0, phy: .20 },
  W:  { pac: .30, sho: .20, pas: .15, dri: .30, def: 0, phy: .05 },
  AM: { pac: .10, sho: .20, pas: .35, dri: .30, def: 0, phy: .05 },
  CM: { pac: .10, sho: .10, pas: .35, dri: .20, def: .15, phy: .10 },
  DM: { pac: .10, sho: 0, pas: .25, dri: .10, def: .35, phy: .20 },
  FB: { pac: .30, sho: 0, pas: .20, dri: .10, def: .30, phy: .10 },
  CB: { pac: .15, sho: 0, pas: .10, dri: 0, def: .50, phy: .25 },
  GK: { ref: .25, div: .25, han: .20, gpo: .20, kic: .05, phy: .05 },
};

// 플레이 스타일: 시작 능력치 분포에 영향 (가중 보너스)
const STYLES = {
  ST: [
    { id: 'target', name: '타깃맨', desc: '제공권과 몸싸움으로 버티는 정통 9번', bias: { phy: 8, sho: 4, pac: -6 }, rec: ['header', 'finisher', 'power'] },
    { id: 'runner', name: '침투형 스트라이커', desc: '수비 뒷공간을 파고드는 스피드형', bias: { pac: 8, sho: 3, phy: -5 }, rec: ['finisher', 'chip', 'sprint'] },
    { id: 'link', name: '연계형 공격수', desc: '내려와서 동료를 살리는 공격수', bias: { pas: 7, dri: 4, phy: -4 }, rec: ['through', 'finesse', 'finisher'] },
  ],
  W: [
    { id: 'speed', name: '스피드 윙어', desc: '폭발적인 속도로 측면을 찢는다', bias: { pac: 9, dri: 3, sho: -5 }, rec: ['sprint', 'elastico', 'cross'] },
    { id: 'inside', name: '인사이드 포워드', desc: '안으로 파고들어 직접 마무리', bias: { sho: 7, dri: 4, pas: -5 }, rec: ['finesse', 'finisher', 'elastico'] },
    { id: 'cross', name: '크로스 윙어', desc: '정확한 크로스로 기회를 만든다', bias: { pas: 7, pac: 3, sho: -5 }, rec: ['cross', 'through', 'freekick'] },
  ],
  AM: [
    { id: 'maestro', name: '플레이메이커', desc: '한 번의 패스로 경기를 바꾼다', bias: { pas: 8, dri: 3, sho: -4 }, rec: ['through', 'freekick', 'press'] },
    { id: 'shadow', name: '섀도 스트라이커', desc: '2선에서 침투해 골을 노린다', bias: { sho: 7, pac: 3, pas: -4 }, rec: ['finisher', 'finesse', 'power'] },
  ],
  CM: [
    { id: 'b2b', name: '박스 투 박스', desc: '공수 양면을 쉬지 않고 오간다', bias: { phy: 6, def: 4, pas: -2, dri: -2 }, rec: ['stamina', 'power', 'tackle'] },
    { id: 'deep', name: '딥 라잉 플레이메이커', desc: '후방에서 경기를 조율한다', bias: { pas: 8, def: 2, pac: -5 }, rec: ['longball', 'through', 'press'] },
  ],
  DM: [
    { id: 'anchor', name: '앵커', desc: '수비 앞에서 흐름을 끊는다', bias: { def: 7, phy: 5, pas: -4 }, rec: ['intercept', 'tackle', 'aerial'] },
    { id: 'regista', name: '레지스타', desc: '수비형 위치에서 빌드업을 책임진다', bias: { pas: 7, def: 2, phy: -4 }, rec: ['longball', 'press', 'intercept'] },
  ],
  FB: [
    { id: 'attfb', name: '공격형 풀백', desc: '오버래핑으로 측면 공격에 가담', bias: { pac: 6, pas: 5, def: -5 }, rec: ['cross', 'sprint', 'stamina'] },
    { id: 'deffb', name: '수비형 풀백', desc: '측면을 단단히 잠근다', bias: { def: 7, phy: 3, pas: -4 }, rec: ['tackle', 'marking', 'stamina'] },
  ],
  CB: [
    { id: 'stopper', name: '스토퍼', desc: '공중볼과 대인 수비의 기둥', bias: { def: 6, phy: 6, pas: -5 }, rec: ['aerial', 'tackle', 'marking'] },
    { id: 'ballcb', name: '볼 플레잉 센터백', desc: '후방 빌드업의 출발점', bias: { pas: 7, def: 3, phy: -4 }, rec: ['longball', 'intercept', 'marking'] },
  ],
  GK: [
    { id: 'saver', name: '슈퍼 세이버', desc: '반사신경으로 불가능한 슈팅을 막는다', bias: { ref: 7, div: 5, kic: -6 }, rec: ['reflexes', 'oneonone', 'pkstopper'] },
    { id: 'sweeper', name: '스위퍼 키퍼', desc: '발밑과 위치선정으로 수비 뒷공간을 지운다', bias: { kic: 7, gpo: 5, ref: -5 }, rec: ['sweeper', 'oneonone', 'reflexes'] },
  ],
};

/* ---------- 스킬 ----------
 * groups: 적용 가능 포지션 그룹 ('ALL' 이면 전체, 'OUT' 이면 필드 플레이어)
 * req: 습득 조건 (능력치 최소값)
 * cost: 레벨별 필요 수련 포인트
 */
const SKILLS = {
  finisher:  { name: '침착한 마무리', icon: '🎯', groups: ['ST', 'W', 'AM'], req: { sho: 52 }, desc: '1대1·문전 마무리 성공률 상승, 득점 관여 증가' },
  finesse:   { name: '감아차기', icon: '🌀', groups: ['ST', 'W', 'AM', 'CM'], req: { sho: 50, pas: 45 }, desc: '박스 바깥에서 감아차기 선택지 해금' },
  power:     { name: '중거리 강슛', icon: '💥', groups: ['ST', 'AM', 'CM', 'DM'], req: { sho: 50, phy: 50 }, desc: '중거리 강슛 선택지 해금' },
  chip:      { name: '칩슛', icon: '🪶', groups: ['ST', 'W', 'AM'], req: { sho: 55, dri: 50 }, desc: '1대1에서 칩슛 선택지 해금' },
  header:    { name: '헤더 장인', icon: '🗣️', groups: ['ST', 'CB', 'DM'], req: { phy: 55 }, desc: '세트피스 헤더 성공률·득점 관여 상승' },
  freekick:  { name: '프리킥 스페셜리스트', icon: '🎨', groups: ['OUT'], req: { sho: 55, pas: 55 }, desc: '경기 중 직접 프리킥 기회가 생김' },
  penalty:   { name: '강심장 키커', icon: '🧊', groups: ['OUT'], req: { sho: 50 }, desc: '페널티킥 성공률 상승, PK 키커 지정 확률 증가' },
  through:   { name: '킬 패스', icon: '🔑', groups: ['ST', 'W', 'AM', 'CM'], req: { pas: 55 }, desc: '침투 패스 성공률·도움 관여 상승' },
  longball:  { name: '롱패스', icon: '📐', groups: ['CM', 'DM', 'CB', 'FB', 'GK'], req: { pas: 52 }, desc: '전환 패스 성공률 상승 (GK는 킥)' },
  cross:     { name: '얼리 크로스', icon: '🏹', groups: ['W', 'FB'], req: { pas: 50 }, desc: '크로스 성공률·도움 관여 상승' },
  elastico:  { name: '개인기 · 헛다리', icon: '🕺', groups: ['ST', 'W', 'AM'], req: { dri: 55 }, desc: '드리블 돌파 성공률 상승' },
  press:     { name: '탈압박', icon: '🧲', groups: ['CM', 'DM', 'AM'], req: { dri: 50, phy: 48 }, desc: '평점 안정성 상승, 역습 상황 대처 향상' },
  sprint:    { name: '폭발적 스프린트', icon: '⚡', groups: ['ST', 'W', 'FB'], req: { pac: 60 }, desc: '역습·침투 상황 성공률 상승' },
  tackle:    { name: '정확한 태클', icon: '🦵', groups: ['CB', 'DM', 'FB', 'CM'], req: { def: 52 }, desc: '태클 성공률 상승, 카드 위험 감소' },
  marking:   { name: '대인 마크', icon: '🔒', groups: ['CB', 'FB', 'DM'], req: { def: 55 }, desc: '실점 확률 감소, 지연 수비 성공률 상승' },
  aerial:    { name: '공중볼 장악', icon: '🛡️', groups: ['CB', 'DM', 'ST'], req: { phy: 55 }, desc: '공중볼 경합 성공률 상승' },
  intercept: { name: '패스 차단', icon: '✂️', groups: ['DM', 'CB', 'CM'], req: { def: 50, pas: 45 }, desc: '패스 길목 차단 성공률 상승' },
  reflexes:  { name: '동물적 반사신경', icon: '🐆', groups: ['GK'], req: { ref: 55 }, desc: '근거리 슈팅 선방률 상승' },
  oneonone:  { name: '1대1 선방', icon: '🧤', groups: ['GK'], req: { gpo: 50, div: 50 }, desc: '1대1 상황 선방률 상승' },
  pkstopper: { name: 'PK 방어 전문가', icon: '🔮', groups: ['GK'], req: { ref: 50 }, desc: '키커의 방향을 읽어낼 확률 상승' },
  sweeper:   { name: '스위퍼 키퍼', icon: '🧹', groups: ['GK'], req: { kic: 50, gpo: 55 }, desc: '전진 수비·빌드업 성공률 상승' },
  stamina:   { name: '강철 체력', icon: '🔋', groups: ['ALL'], req: { phy: 50 }, desc: '경기·훈련 피로 누적 감소' },
  iron:      { name: '부상 방지 루틴', icon: '🩹', groups: ['ALL'], req: {}, desc: '부상 확률 감소' },
  leader:    { name: '리더십', icon: '📣', groups: ['ALL'], req: { age: 22 }, desc: '감독 신뢰 상승폭 증가, 팀 전력 소폭 상승' },
  biggame:   { name: '빅게임 플레이어', icon: '🏟️', groups: ['ALL'], req: { rep: 25 }, desc: '결승·대륙대회·대표팀 경기에서 판단 성공률 상승' },
  weakfoot:  { name: '약발 강화', icon: '🦶', groups: ['OUT'], req: {}, desc: '레벨당 약발 ★1 상승 (최대 ★5)' },
};
const SKILL_COST = [0, 100, 180, 300]; // Lv1, Lv2, Lv3 도달에 필요한 수련 포인트
const SKILL_MAX_LV = 3;
const SKILL_SLOTS = 6; // 약발 강화 제외 보유 가능 스킬 수

/* ---------- 리그 / 구단 ---------- */
const LEAGUES = {
  EPL:   { name: '프리미어리그', nat: 'ENG', tier: 1, prestige: 5, wealth: 4.0, cup: 'FA컵', cont: 'UCL', slots: 4 },
  CHAMP: { name: '챔피언십', nat: 'ENG', tier: 2, prestige: 2, wealth: 1.6, cup: 'FA컵', cont: null, slots: 0 },
  LIGA:  { name: '라리가', nat: 'ESP', tier: 1, prestige: 5, wealth: 3.0, cup: '코파 델 레이', cont: 'UCL', slots: 4 },
  BUN:   { name: '분데스리가', nat: 'GER', tier: 1, prestige: 5, wealth: 3.0, cup: 'DFB 포칼', cont: 'UCL', slots: 4 },
  SA:    { name: '세리에 A', nat: 'ITA', tier: 1, prestige: 5, wealth: 2.5, cup: '코파 이탈리아', cont: 'UCL', slots: 4 },
  L1:    { name: '리그 1', nat: 'FRA', tier: 1, prestige: 4, wealth: 2.3, cup: '쿠프 드 프랑스', cont: 'UCL', slots: 3 },
  ERE:   { name: '에레디비시', nat: 'NED', tier: 1, prestige: 3, wealth: 1.3, cup: 'KNVB 베이커르', cont: 'UCL', slots: 2 },
  POR:   { name: '프리메이라리가', nat: 'POR', tier: 1, prestige: 3, wealth: 1.2, cup: '타사 드 포르투갈', cont: 'UCL', slots: 2 },
  K1:    { name: 'K리그1', nat: 'KOR', tier: 1, prestige: 2, wealth: 1.0, cup: '코리아컵', cont: 'ACL', slots: 3 },
  K2:    { name: 'K리그2', nat: 'KOR', tier: 2, prestige: 1, wealth: 0.6, cup: '코리아컵', cont: null, slots: 0 },
  J1:    { name: 'J1리그', nat: 'JPN', tier: 1, prestige: 2, wealth: 1.2, cup: '천황배', cont: 'ACL', slots: 3 },
  SPL:   { name: '사우디 프로리그', nat: 'KSA', tier: 1, prestige: 2, wealth: 4.5, cup: '킹스컵', cont: 'ACL', slots: 3 },
  BRA:   { name: '브라질레이랑 세리 A', nat: 'BRA', tier: 1, prestige: 3, wealth: 1.2, cup: '코파 두 브라질', cont: 'LIB', slots: 4 },
  ARG:   { name: '아르헨티나 리가 프로페시오날', nat: 'ARG', tier: 1, prestige: 2, wealth: 0.8, cup: '코파 아르헨티나', cont: 'LIB', slots: 3 },
};

const CONTINENTAL = {
  UCL: { name: 'UEFA 챔피언스리그', prestige: 5 },
  ACL: { name: 'AFC 챔피언스리그 엘리트', prestige: 2 },
  LIB: { name: '코파 리베르타도레스', prestige: 3 },
};

// [id, 이름, 전력]
const CLUB_LIST = {
  EPL: [
    ['mci', '맨체스터 시티', 86], ['ars', '아스널', 86], ['liv', '리버풀', 86], ['che', '첼시', 83],
    ['mun', '맨체스터 유나이티드', 79], ['tot', '토트넘 홋스퍼', 79], ['new', '뉴캐슬 유나이티드', 80], ['avl', '아스톤 빌라', 79],
    ['bha', '브라이턴', 76], ['whu', '웨스트햄 유나이티드', 75], ['cry', '크리스털 팰리스', 76], ['ful', '풀럼', 74],
    ['bre', '브렌트퍼드', 74], ['bou', '본머스', 75], ['nfo', '노팅엄 포리스트', 76], ['eve', '에버턴', 73],
    ['wol', '울버햄프턴', 72], ['lee', '리즈 유나이티드', 71], ['bur', '번리', 70], ['sun', '선덜랜드', 71],
  ],
  CHAMP: [
    ['lei', '레스터 시티', 70], ['sou', '사우샘프턴', 70], ['ips', '입스위치 타운', 69], ['shu', '셰필드 유나이티드', 67],
    ['mid', '미들즈브러', 67], ['nor', '노리치 시티', 66], ['wat', '왓퍼드', 65], ['wba', '웨스트 브로미치 앨비언', 66],
    ['cov', '코번트리 시티', 66], ['sto', '스토크 시티', 64], ['swa', '스완지 시티', 64], ['hul', '헐 시티', 63],
  ],
  LIGA: [
    ['rma', '레알 마드리드', 87], ['bar', '바르셀로나', 87], ['atm', '아틀레티코 마드리드', 83], ['ath', '아틀레틱 빌바오', 78],
    ['vil', '비야레알', 78], ['rso', '레알 소시에다드', 76], ['bet', '레알 베티스', 77], ['sev', '세비야', 74],
    ['val', '발렌시아', 73], ['cel', '셀타 비고', 73], ['gir', '지로나', 73], ['mlr', '마요르카', 72],
    ['osa', '오사수나', 72], ['ray', '라요 바예카노', 72], ['get', '헤타페', 71], ['esp', '에스파뇰', 71],
  ],
  BUN: [
    ['fcb', '바이에른 뮌헨', 87], ['b04', '바이어 레버쿠젠', 82], ['bvb', '보루시아 도르트문트', 81], ['rbl', 'RB 라이프치히', 80],
    ['sge', '아인트라흐트 프랑크푸르트', 78], ['vfb', 'VfB 슈투트가르트', 78], ['scf', 'SC 프라이부르크', 75], ['wob', 'VfL 볼프스부르크', 74],
    ['bmg', '보루시아 묀헨글라트바흐', 73], ['m05', '마인츠 05', 74], ['tsg', '호펜하임', 74], ['fcu', '우니온 베를린', 72],
    ['svw', '베르더 브레멘', 72], ['fca', 'FC 아우크스부르크', 71], ['koe', 'FC 쾰른', 71], ['hsv', '함부르크 SV', 70],
  ],
  SA: [
    ['int', '인테르', 84], ['nap', '나폴리', 83], ['juv', '유벤투스', 81], ['mil', 'AC 밀란', 81],
    ['ata', '아탈란타', 80], ['rom', 'AS 로마', 79], ['laz', '라치오', 77], ['fio', '피오렌티나', 76],
    ['bol', '볼로냐', 77], ['com', '코모', 75], ['tor', '토리노', 72], ['udi', '우디네세', 71],
    ['gen', '제노아', 70], ['par', '파르마', 70], ['cag', '칼리아리', 69], ['lec', '레체', 68],
  ],
  L1: [
    ['psg', '파리 생제르맹', 87], ['om', '마르세유', 78], ['asm', 'AS 모나코', 78], ['los', '릴', 76],
    ['ol', '올랭피크 리옹', 76], ['ogc', 'OGC 니스', 74], ['rcl', 'RC 랑스', 75], ['srf', '스타드 렌', 74],
    ['rcs', '스트라스부르', 74], ['fcn', '낭트', 70], ['tfc', '툴루즈', 71], ['sb29', '브레스트', 71],
  ],
  ERE: [
    ['psv', 'PSV 에인트호번', 77], ['aja', '아약스', 76], ['fey', '페예노르트', 77], ['az', 'AZ 알크마르', 73],
    ['twe', 'FC 트벤테', 71], ['utr', 'FC 위트레흐트', 70], ['hee', 'SC 헤이렌베인', 66], ['gro', 'FC 흐로닝언', 65],
    ['nec', 'NEC 네이메헌', 67], ['spa', '스파르타 로테르담', 65],
  ],
  POR: [
    ['ben', '벤피카', 79], ['fcp', 'FC 포르투', 79], ['scp', '스포르팅 CP', 80], ['bra', 'SC 브라가', 74],
    ['vsc', '비토리아 기마랑이스', 70], ['fam', '파말리캉', 67], ['rio', '히우 아브', 65], ['est', '에스토릴', 66],
    ['gil', '질 비센테', 66], ['mor', '모레이렌스', 65],
  ],
  K1: [
    ['ulsan', '울산 HD', 66], ['jeonbuk', '전북 현대 모터스', 68], ['pohang', '포항 스틸러스', 63], ['seoul', 'FC 서울', 64],
    ['gimcheon', '김천 상무', 62], ['gangwon', '강원 FC', 61], ['daejeon', '대전 하나시티즌', 63], ['gwangju', '광주 FC', 60],
    ['jeju', '제주 SK', 59], ['suwonfc', '수원 FC', 58], ['daegu', '대구 FC', 57], ['anyang', 'FC 안양', 57],
  ],
  K2: [
    ['suwon', '수원 삼성 블루윙즈', 57], ['incheon', '인천 유나이티드', 57], ['busan', '부산 아이파크', 54], ['jeonnam', '전남 드래곤즈', 53],
    ['seongnam', '성남 FC', 52], ['bucheon', '부천 FC 1995', 53], ['gyeongnam', '경남 FC', 50], ['chungbuk', '충북청주 FC', 49],
    ['ansan', '안산 그리너스', 48], ['cheonan', '천안 시티 FC', 48], ['seouland', '서울 이랜드 FC', 53], ['gimpo', '김포 FC', 50],
  ],
  J1: [
    ['kobe', '비셀 고베', 67], ['kashima', '가시마 앤틀러스', 66], ['hiroshima', '산프레체 히로시마', 66], ['kawasaki', '가와사키 프론탈레', 65],
    ['marinos', '요코하마 F. 마리노스', 64], ['urawa', '우라와 레드 다이아몬즈', 65], ['fctokyo', 'FC 도쿄', 63], ['gamba', '감바 오사카', 63],
    ['cerezo', '세레소 오사카', 62], ['nagoya', '나고야 그램퍼스', 62], ['kashiwa', '가시와 레이솔', 63], ['machida', '마치다 젤비아', 64],
  ],
  SPL: [
    ['hilal', '알 힐랄', 80], ['nassr', '알 나스르', 80], ['ittihad', '알 이티하드', 79], ['ahli', '알 아흘리', 78],
    ['qadsiah', '알 카디시야', 74], ['shabab', '알 샤바브', 72], ['taawoun', '알 타아원', 70], ['ettifaq', '알 에티파크', 72],
    ['khaleej', '알 칼리즈', 68], ['fateh', '알 파테흐', 67],
  ],
  BRA: [
    ['fla', '플라멩구', 78], ['pal', '팔메이라스', 78], ['bot', '보타포구', 75], ['spfc', '상파울루', 73],
    ['cor', '코린치안스', 72], ['flu', '플루미넨시', 73], ['gre', '그레미우', 71], ['inter', '인테르나시오나우', 72],
    ['cru', '크루제이루', 73], ['atl', '아틀레치쿠 미네이루', 72], ['vas', '바스쿠 다 가마', 70], ['bah', '바이아', 71],
  ],
  ARG: [
    ['riv', '리버 플레이트', 75], ['boc', '보카 주니어스', 74], ['rac', '라싱 클루브', 72], ['ind', '인데펜디엔테', 69],
    ['estu', '에스투디안테스', 70], ['vel', '벨레스 사르스필드', 70], ['tal', '탈레레스', 70], ['sl', '산 로렌소', 68],
  ],
};

// 한국 K리그 산하 U18 고교 (산하 구단 id, 학교명)
const KOR_YOUTH = [
  ['suwon', '매탄고등학교'], ['seoul', '오산고등학교'], ['ulsan', '현대고등학교'], ['pohang', '포항제철고등학교'],
  ['jeonbuk', '전주영생고등학교'], ['jeonnam', '광양제철고등학교'], ['incheon', '인천대건고등학교'], ['gwangju', '금호고등학교'],
  ['daejeon', '충남기계공업고등학교'], ['gangwon', '강릉제일고등학교'], ['busan', '개성고등학교'],
];

/* ---------- 국가 ---------- */
// 플레이어 선택 가능 국적
const NATIONS = {
  KOR: { name: '대한민국', conf: 'AFC', str: 74, thr: 69, lg: 'K1', youthComp: 'K리그 주니어 U18', youthCup: '전국고등학교축구대회' },
  JPN: { name: '일본', conf: 'AFC', str: 77, thr: 71, lg: 'J1', youthComp: '프리미어리그 U18 (일본)', youthCup: 'J유스컵' },
  ENG: { name: '잉글랜드', conf: 'UEFA', str: 85, thr: 78, lg: 'EPL', youthComp: 'U18 프리미어리그', youthCup: 'FA 유스컵' },
  ESP: { name: '스페인', conf: 'UEFA', str: 87, thr: 79, lg: 'LIGA', youthComp: '디비시온 데 오노르 후베닐', youthCup: '코파 델 레이 후베닐' },
  GER: { name: '독일', conf: 'UEFA', str: 84, thr: 78, lg: 'BUN', youthComp: 'U19 분데스리가', youthCup: 'DFB 유소년 포칼' },
  ITA: { name: '이탈리아', conf: 'UEFA', str: 82, thr: 77, lg: 'SA', youthComp: '프리마베라 1', youthCup: '코파 이탈리아 프리마베라' },
  FRA: { name: '프랑스', conf: 'UEFA', str: 87, thr: 80, lg: 'L1', youthComp: '샹피오나 나시오날 U19', youthCup: '쿠프 갑바르델라' },
  NED: { name: '네덜란드', conf: 'UEFA', str: 83, thr: 76, lg: 'ERE', youthComp: 'U19 디비시' , youthCup: 'KNVB 유스컵' },
  POR: { name: '포르투갈', conf: 'UEFA', str: 85, thr: 77, lg: 'POR', youthComp: '캄페오나투 나시오날 Sub-19', youthCup: '타사 드 포르투갈 Sub-19' },
  BRA: { name: '브라질', conf: 'CONMEBOL', str: 86, thr: 79, lg: 'BRA', youthComp: '브라질레이랑 Sub-20', youthCup: '코파 상파울루 주니오르' },
  ARG: { name: '아르헨티나', conf: 'CONMEBOL', str: 87, thr: 79, lg: 'ARG', youthComp: '아르헨티나 리저브 리그', youthCup: '코파 아르헨티나 유스' },
};

// 대표팀 대회 상대국 (이름, 전력)
const NT_POOL = {
  AFC: [['일본', 77], ['대한민국', 74], ['이란', 73], ['호주', 72], ['사우디아라비아', 69], ['카타르', 68], ['우즈베키스탄', 69],
    ['이라크', 67], ['아랍에미리트', 66], ['요르단', 67], ['중국', 64], ['오만', 63], ['바레인', 62], ['태국', 61], ['베트남', 60]],
  UEFA: [['프랑스', 87], ['스페인', 87], ['잉글랜드', 85], ['포르투갈', 85], ['독일', 84], ['네덜란드', 83], ['이탈리아', 82],
    ['벨기에', 81], ['크로아티아', 80], ['덴마크', 78], ['스위스', 78], ['오스트리아', 77], ['튀르키예', 77], ['노르웨이', 77],
    ['세르비아', 75], ['폴란드', 75], ['우크라이나', 75], ['스코틀랜드', 73], ['체코', 74], ['헝가리', 73]],
  CONMEBOL: [['아르헨티나', 87], ['브라질', 86], ['우루과이', 81], ['콜롬비아', 81], ['에콰도르', 78], ['파라과이', 75],
    ['칠레', 73], ['페루', 72], ['베네수엘라', 71], ['볼리비아', 66]],
  OTHER: [['모로코', 80], ['미국', 77], ['멕시코', 77], ['세네갈', 77], ['일본', 77], ['캐나다', 74], ['나이지리아', 75],
    ['이집트', 74], ['코트디부아르', 75], ['알제리', 74], ['가나', 71], ['카메룬', 72], ['튀니지', 71], ['코스타리카', 68], ['뉴질랜드', 64]],
};

// 국기 (flagcdn.com 코드)
const FLAG_CODE = {
  '대한민국': 'kr', '일본': 'jp', '잉글랜드': 'gb-eng', '스페인': 'es', '독일': 'de', '이탈리아': 'it', '프랑스': 'fr', '네덜란드': 'nl',
  '포르투갈': 'pt', '브라질': 'br', '아르헨티나': 'ar', '이란': 'ir', '호주': 'au', '사우디아라비아': 'sa', '카타르': 'qa', '우즈베키스탄': 'uz',
  '이라크': 'iq', '아랍에미리트': 'ae', '요르단': 'jo', '중국': 'cn', '오만': 'om', '바레인': 'bh', '태국': 'th', '베트남': 'vn',
  '벨기에': 'be', '크로아티아': 'hr', '덴마크': 'dk', '스위스': 'ch', '오스트리아': 'at', '튀르키예': 'tr', '노르웨이': 'no', '세르비아': 'rs',
  '폴란드': 'pl', '우크라이나': 'ua', '스코틀랜드': 'gb-sct', '체코': 'cz', '헝가리': 'hu', '우루과이': 'uy', '콜롬비아': 'co', '에콰도르': 'ec',
  '파라과이': 'py', '칠레': 'cl', '페루': 'pe', '베네수엘라': 've', '볼리비아': 'bo', '모로코': 'ma', '미국': 'us', '멕시코': 'mx', '세네갈': 'sn',
  '캐나다': 'ca', '나이지리아': 'ng', '이집트': 'eg', '코트디부아르': 'ci', '알제리': 'dz', '가나': 'gh', '카메룬': 'cm', '튀니지': 'tn',
  '코스타리카': 'cr', '뉴질랜드': 'nz',
};

const MONTHS = ['7월', '8월', '9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월'];
// 대표팀 A매치 기간 (월 인덱스)
const INTL_BREAKS = [2, 3, 4, 8];
// 컵대회 라운드 월 인덱스
const CUP_ROUNDS = [{ m: 3, name: '3라운드' }, { m: 5, name: '16강' }, { m: 7, name: '8강' }, { m: 9, name: '4강' }, { m: 10, name: '결승' }];
// 대륙대회: 리그 페이즈 6경기 (9월~2월), 8강(3월), 4강(4월), 결승(5월)
const CONT_LEAGUE_MONTHS = [2, 3, 4, 5, 6, 7];
const CONT_KO = [{ m: 8, name: '8강' }, { m: 9, name: '4강' }, { m: 10, name: '결승' }];

/* ---------- 월간 계획 옵션 ---------- */
const INTENSITY = [
  { id: 0, name: '회복 위주', icon: '🛌', growth: 0.75, skill: 0.6, fatigue: -18, injury: 0.6, desc: '피로 크게 회복 · 성장 느림' },
  { id: 1, name: '보통', icon: '🏃', growth: 1.0, skill: 1.0, fatigue: 2, injury: 1.0, desc: '균형 잡힌 훈련' },
  { id: 2, name: '강훈련', icon: '🔥', growth: 1.2, skill: 1.3, fatigue: 11, injury: 1.35, desc: '성장 빠름 · 피로·부상 위험 증가' },
  { id: 3, name: '한계 돌파', icon: '💀', growth: 1.4, skill: 1.6, fatigue: 20, injury: 1.9, desc: '성장 매우 빠름 · 부상 위험 큼' },
];

const ACTIVITIES = {
  rest:      { name: '휴식', icon: '☕', desc: '피로 -10, 사기 +3' },
  video:     { name: '영상 분석', icon: '📺', desc: '감독 신뢰 +3, 이번 달 경기 판단 성공률 +4%p' },
  trainer:   { name: '개인 트레이너', icon: '🏋️', desc: '능력치 성장 ×1.15, 스킬 수련 ×1.25 (비용 발생)' },
  nutrition: { name: '영양 관리', icon: '🥗', desc: '부상 위험 40% 감소, 피로 -6 (비용 발생)' },
  extra:     { name: '야간 개인훈련', icon: '🌙', desc: '능력치 성장 ×1.1, 피로 +8' },
  media:     { name: 'SNS · 미디어', icon: '📱', desc: '명성 +2, 소액 수입, 감독 신뢰 -1' },
  mental:    { name: '멘탈 코칭', icon: '🧘', desc: '사기 +8, 이번 달 빅매치 판단 +3%p' },
};

/*NODE*/
if (typeof module !== 'undefined') {
  module.exports = {
    POSITIONS, ADJACENT_POS, ATTRS_OUT, ATTRS_GK, ATTR_NAME, OVR_WEIGHTS, STYLES, SKILLS, SKILL_COST, SKILL_MAX_LV,
    SKILL_SLOTS, LEAGUES, CONTINENTAL, CLUB_LIST, KOR_YOUTH, NATIONS, NT_POOL, MONTHS, INTL_BREAKS, CUP_ROUNDS,
    CONT_LEAGUE_MONTHS, CONT_KO, INTENSITY, ACTIVITIES, FLAG_CODE,
  };
}
/*/NODE*/

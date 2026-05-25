/* ==========================================
   군포시 실시간 버스 - 정적 기준 데이터
   경기도 군포시 주요 버스 정류장 (실제 stationId 기반)
   좌표(x, y)는 SVG 맵(960×380) 픽셀 좌표로 변환한 값
   실제 위경도 기준: 군포시 중심(37.36°N, 126.93°E)
   ========================================== */

// ── 군포시 주요 정류장 (실제 ARSID / stationId) ──────────────
export const STATIONS = [
  {
    id: '26378',
    name: '수리산역',
    x: 120, y: 130,
    description: '4호선 수리산역 북측 정류장',
    arsId: '26378',
  },
  {
    id: '26379',
    name: '수리산역(반대)',
    x: 140, y: 160,
    description: '4호선 수리산역 남측 정류장',
    arsId: '26379',
  },
  {
    id: '26046',
    name: '산본역①',
    x: 290, y: 100,
    description: '4호선 산본역 1번 출구 방면',
    arsId: '26046',
  },
  {
    id: '26054',
    name: '산본역②',
    x: 330, y: 130,
    description: '4호선 산본역 2번 출구 방면',
    arsId: '26054',
  },
  {
    id: '26055',
    name: '군포시청·산본역',
    x: 350, y: 170,
    description: '군포시청, 산본역 방면 주요 환승 정류장',
    arsId: '26055',
  },
  {
    id: '26049',
    name: '산본역③',
    x: 310, y: 200,
    description: '산본역 인근 추가 정류장',
    arsId: '26049',
  },
  {
    id: '26084',
    name: '군포역',
    x: 540, y: 150,
    description: '1호선 군포역 정류장',
    arsId: '26084',
  },
  {
    id: '26085',
    name: '군포역(반대)',
    x: 570, y: 180,
    description: '1호선 군포역 맞은편 정류장',
    arsId: '26085',
  },
  {
    id: '26170',
    name: '당정역',
    x: 720, y: 140,
    description: '1호선 당정역 정류장',
    arsId: '26170',
  },
  {
    id: '26179',
    name: '군포보건소',
    x: 760, y: 230,
    description: '군포보건소, 시외버스 하차 정류장',
    arsId: '26179',
  },
  {
    id: '26173',
    name: '군포공영차고지',
    x: 820, y: 100,
    description: '군포공영차고지 주요 버스 기점',
    arsId: '26173',
  },
  {
    id: '26172',
    name: '군포공영차고지(종점)',
    x: 860, y: 130,
    description: '군포공영차고지 종점 전용 정류장',
    arsId: '26172',
  },
  {
    id: '26182',
    name: '군포보건소(삼성)',
    x: 740, y: 270,
    description: '삼성마을 방향 군포보건소 정류장',
    arsId: '26182',
  },
  {
    id: '26216',
    name: '군포공영차고지입구',
    x: 790, y: 160,
    description: '공영차고지 입구 방면 정류장',
    arsId: '26216',
  },
];

// ── 노선 유형 코드 매핑 (경기도 버스 routeTypeCd 기준) ────────
export const ROUTE_TYPE_MAP = {
  '11': { label: '직행좌석',  type: 'express', color: '#ef4444' },
  '12': { label: '좌석',      type: 'express', color: '#f97316' },
  '13': { label: '일반',      type: 'trunk',   color: '#3b82f6' },
  '14': { label: '광역급행',  type: 'express', color: '#ef4444' },
  '15': { label: '따복버스',  type: 'branch',  color: '#10b981' },
  '16': { label: '공공버스',  type: 'branch',  color: '#10b981' },
  '21': { label: '마을버스',  type: 'local',   color: '#f59e0b' },
  '22': { label: '시내일반',  type: 'trunk',   color: '#3b82f6' },
  '23': { label: '시내좌석',  type: 'express', color: '#ef4444' },
  '30': { label: '시외버스',  type: 'express', color: '#8b5cf6' },
  '41': { label: '고속버스',  type: 'express', color: '#ec4899' },
};

// 혼잡도 코드 → 내부 표현 변환
export function parseCongestion(code) {
  switch (String(code)) {
    case '3': return 'crowded';
    case '2': return 'moderate';
    case '1':
    case '0':
    default:  return 'empty';
  }
}

// flag 코드 → 도착 상태 한국어 변환
export function parseArrivalFlag(flag) {
  switch (String(flag)) {
    case '0': return '운행중';
    case '1': return '도착정보없음';
    case '2': return '운행종료';
    case '3': return '첫차대기';
    default:  return '운행중';
  }
}

// stationId로 정류장 찾기
export function getStationById(id) {
  return STATIONS.find(s => s.id === String(id));
}

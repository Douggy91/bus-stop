/* ==========================================
   LIVE METROBUS - STATIC TRANSIT DATA & SEEDS
   Defines stations, routes, and coordinate maps
   ========================================== */

// All static stations with their display coordinates on our 1000x400 map
export const STATIONS = [
  { id: 'STN-101', name: '서울역 (Seoul Stn)', x: 120, y: 150, description: '수도권 전철 1, 4호선, 경의중앙선, 공항철도, KTX 환승역' },
  { id: 'STN-102', name: '광화문 (Gwanghwamun)', x: 260, y: 110, description: '세종문화회관, 경복궁 방면' },
  { id: 'STN-103', name: '종로3가 (Jongno 3-ga)', x: 460, y: 140, description: '지하철 1, 3, 5호선 트리플 환승역' },
  { id: 'STN-104', name: '동대문 (Dongdaemun)', x: 680, y: 180, description: '동대문디자인플라자(DDP), 쇼핑센터 방면' },
  { id: 'STN-105', name: '청량리역 (Cheongnyangni)', x: 880, y: 150, description: '강원/경북행 열차 출발지, 광역환승센터' },
  { id: 'STN-106', name: '강남역 (Gangnam Stn)', x: 260, y: 310, description: '신분당선 환승, 최대 상업지구 및 대중교통 거점' },
  { id: 'STN-107', name: '신사역 (Sinsa Stn)', x: 460, y: 290, description: '가로수길, 을지병원 방면' },
  { id: 'STN-108', name: '고속터미널 (Express Terminal)', x: 680, y: 310, description: '호남/영동선 터미널, 3, 7, 9호선 환승' },
  { id: 'STN-109', name: '잠실역 (Jamsil Stn)', x: 880, y: 290, description: '롯데월드타워, 송파구청 방면 광역 허브' }
];

// Master routes list
export const ROUTES = [
  {
    id: 'R-143',
    number: '143',
    name: '정릉 ↔ 개포동 (간선)',
    type: 'trunk', // blue
    color: '#3b82f6',
    // Order of stops this route stops at
    stations: ['STN-107', 'STN-106', 'STN-108', 'STN-109', 'STN-104', 'STN-103'],
    intervalMinutes: 6,
    speedFactor: 1.0 // Base speed multiplier
  },
  {
    id: 'R-9401',
    number: '9401',
    name: '분당 ↔ 서울역 (광역)',
    type: 'express', // red
    color: '#ef4444',
    stations: ['STN-109', 'STN-108', 'STN-106', 'STN-101'],
    intervalMinutes: 10,
    speedFactor: 1.5 // Moves faster between nodes
  },
  {
    id: 'R-7212',
    number: '7212',
    name: '은평 ↔ 옥수동 (지선)',
    type: 'branch', // green
    color: '#10b981',
    stations: ['STN-105', 'STN-104', 'STN-103', 'STN-102', 'STN-101'],
    intervalMinutes: 8,
    speedFactor: 0.9 // Slightly slower
  },
  {
    id: 'R-01',
    number: '01',
    name: '남산 순환 (순환)',
    type: 'local', // yellow/amber
    color: '#f59e0b',
    stations: ['STN-102', 'STN-103', 'STN-107', 'STN-101'],
    intervalMinutes: 5,
    speedFactor: 0.8
  }
];

// Helper to look up a station by ID
export function getStationById(id) {
  return STATIONS.find(s => s.id === id);
}

// Helper to look up a route by ID
export function getRouteById(id) {
  return ROUTES.find(r => r.id === id);
}

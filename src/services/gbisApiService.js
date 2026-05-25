/* ==========================================
   군포시 실시간 버스 - GBIS API 서비스
   프록시 서버(localhost:3001/api)를 통해
   공공데이터포털 경기도 버스정보 API 호출
   ========================================== */

const API_BASE = '/api';

// ── 공통 fetch 래퍼 ──────────────────────────────────────────
async function apiFetch(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(12000),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }

  return data;
}

// ── 헬스 체크 ────────────────────────────────────────────────
export async function checkApiHealth() {
  try {
    const data = await apiFetch('/health');
    return data;
  } catch (e) {
    return { status: 'error', apiKeySet: false };
  }
}

// ── ARS번호 → 실제 stationId 해석 캐시 ──────────────────────
// GBIS 도착 API에 필요한 stationId는 ARS번호(5자리)가 아닌
// 정류소 목록 조회 결과의 stationId 필드 값이다.
const stationIdCache = new Map(); // arsId → realStationId

/**
 * ARS번호(5자리)로 GBIS 정류소 목록을 검색해서
 * 실제 API용 stationId를 반환한다.
 * @param {string} arsId - 클릭한 정류소의 ARS번호 (예: '26378')
 * @returns {Promise<string|null>} 실제 stationId 또는 null
 */
export async function resolveRealStationId(arsId) {
  if (!arsId) return null;

  // 캐시 히트
  if (stationIdCache.has(arsId)) {
    const cached = stationIdCache.get(arsId);
    console.log(`[gbisApi] resolveRealStationId(${arsId}) → 캐시: ${cached}`);
    return cached;
  }

  console.log(`[gbisApi] resolveRealStationId(${arsId}) → 정류소 조회 시작`);
  const data = await apiFetch('/stations', { keyword: arsId });
  const stations = data.stations || [];

  console.log(`[gbisApi] 정류소 조회 결과 (keyword=${arsId}):`, stations);

  if (stations.length === 0) {
    console.warn(`[gbisApi] ARS ${arsId}에 해당하는 정류소를 찾지 못했습니다.`);
    return null;
  }

  // 매칭 우선순위:
  // 1) mobileNo(ARS표시번호) === arsId → 정확한 ARS번호 매칭
  // 2) stationId === arsId → stationId가 ARS번호와 동일한 경우
  // 3) 첫 번째 결과 사용
  const byMobileNo = stations.find(s => String(s.mobileNo) === String(arsId));
  const byStationId = stations.find(s => String(s.stationId) === String(arsId));
  const match = byMobileNo || byStationId || stations[0];

  const realId = String(match.stationId);
  console.log(`[gbisApi] ARS ${arsId} → stationId: ${realId}, mobileNo: ${match.mobileNo}, 이름: ${match.stationName}`);

  stationIdCache.set(arsId, realId);
  return realId;
}


// ── 정류소 목록 조회 (키워드 검색용) ────────────────────────
export async function fetchStationList(keyword) {
  const data = await apiFetch('/stations', { keyword });
  return data.stations || [];
}


// ── 버스 도착 정보 조회 ──────────────────────────────────────
// stationId: 정류소 ID (예: '26054')
// 반환: 도착 정보 배열 (최대 2대/노선)
export async function fetchArrivalList(stationId) {
  if (!stationId) throw new Error('stationId가 필요합니다.');
  const data = await apiFetch('/arrivals', { stationId });

  // ── 클라이언트 측 디버그 로그 ──
  console.log(`[gbisApi] fetchArrivalList(${stationId}) →`, {
    arrivalCount: (data.arrivals || []).length,
    _debug: data._debug,
    firstItem: data.arrivals?.[0],
  });

  if (data._debug) {
    console.warn('[gbisApi] 서버 디버그:', JSON.stringify(data._debug));
  }

  return data.arrivals || [];
}


// ── 노선 상세 정보 조회 ──────────────────────────────────────
export async function fetchRouteInfo(routeId) {
  if (!routeId) throw new Error('routeId가 필요합니다.');
  const data = await apiFetch('/route', { routeId });
  return data.route;
}

// ── 노선별 정류소 목록 조회 ──────────────────────────────────
export async function fetchRouteStations(routeId) {
  if (!routeId) throw new Error('routeId가 필요합니다.');
  const data = await apiFetch('/route-stations', { routeId });
  return data.stations || [];
}

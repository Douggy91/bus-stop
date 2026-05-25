/* ==========================================
   군포시 실시간 버스 - GBIS 폴링 엔진
   30초마다 공공 API에서 실시간 도착 정보를 가져와
   구독자(UI 컴포넌트)에게 state를 전파합니다.
   ========================================== */

import { STATIONS, ROUTE_TYPE_MAP, parseCongestion } from './transitData.js';
import { fetchArrivalList, checkApiHealth, resolveRealStationId } from './gbisApiService.js';


// 노선 색상 캐시 (routeId → color)
const routeColorCache = new Map();

function getRouteStyle(routeTypeCd) {
  return ROUTE_TYPE_MAP[String(routeTypeCd)] || ROUTE_TYPE_MAP['13'];
}

// API 도착 정보를 내부 arrival 포맷으로 변환
function normalizeArrival(raw) {
  const style = getRouteStyle(raw.routeTypeCd);

  // 노선 색 캐시에 저장
  if (!routeColorCache.has(raw.routeId)) {
    routeColorCache.set(raw.routeId, style.color);
  }

  const arrivals = [];

  // 첫 번째 버스
  if (raw.predictTime1 !== undefined && raw.predictTime1 !== null) {
    arrivals.push({
      routeId:      raw.routeId,
      routeName:    raw.routeName,
      routeTypeCd:  raw.routeTypeCd,
      type:         style.type,
      color:        style.color,
      typeLabel:    style.label,
      predictTime:  raw.predictTime1,   // 분
      locationNo:   raw.locationNo1,    // 몇 정거장 전
      plateNo:      raw.plateNo1,
      isLowFloor:   raw.lowPlate1,
      congestion:   parseCongestion(raw.congestion1),
      busOrder:     1,
    });
  }

  // 두 번째 버스
  if (raw.predictTime2 !== undefined && raw.predictTime2 !== null && raw.predictTime2 > 0) {
    arrivals.push({
      routeId:      raw.routeId,
      routeName:    raw.routeName,
      routeTypeCd:  raw.routeTypeCd,
      type:         style.type,
      color:        style.color,
      typeLabel:    style.label,
      predictTime:  raw.predictTime2,
      locationNo:   raw.locationNo2,
      plateNo:      raw.plateNo2,
      isLowFloor:   raw.lowPlate2,
      congestion:   parseCongestion(raw.congestion2),
      busOrder:     2,
    });
  }

  return arrivals;
}

class TransitEngine {
  constructor() {
    this.stations         = STATIONS;
    this.activeStationId  = null;
    this.arrivalCache     = new Map();   // stationId → arrivals[]
    this.loadingStations  = new Set();
    this.errorMap         = new Map();   // stationId → errorMsg
    this.boardingRequests = new Set();   // "stationId:routeId"
    this.listeners        = [];
    this.pollInterval     = null;
    this.pollSeconds      = 30;
    this.lastUpdated      = null;
    this.apiKeySet        = true;        // 낙관적 초기값

    // API 키 확인 및 초기 폴링 시작
    this._init();
  }

  async _init() {
    const health = await checkApiHealth();
    this.apiKeySet = health.apiKeySet;
    if (!this.apiKeySet) {
      this.notify();
      return;
    }
    // 초기 상태 전파
    this.notify();
  }

  // ── 구독 / 알림 ──────────────────────────────────────────
  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getState());
  }

  unsubscribe(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }

  getState() {
    const arrivals = this.activeStationId
      ? (this.arrivalCache.get(this.activeStationId) || [])
      : [];

    return {
      stations:         this.stations,
      activeStationId:  this.activeStationId,
      arrivals,
      isLoading:        this.activeStationId
                          ? this.loadingStations.has(this.activeStationId)
                          : false,
      error:            this.activeStationId
                          ? (this.errorMap.get(this.activeStationId) || null)
                          : null,
      boardingRequests: Array.from(this.boardingRequests),
      lastUpdated:      this.lastUpdated,
      pollSeconds:      this.pollSeconds,
      apiKeySet:        this.apiKeySet,
      // 통계용
      totalArrivalsAllStations: Array.from(this.arrivalCache.values())
        .reduce((sum, arr) => sum + arr.length, 0),
    };
  }

  // ── 활성 정류장 변경 ──────────────────────────────────────
  setActiveStation(stationId) {
    if (this.activeStationId === stationId) return;
    this.activeStationId = stationId;

    // 기존 폴링 정지 후 새 정류장으로 재시작
    this._stopPoll();
    this._fetchArrivals(stationId);
    this._startPoll(stationId);

    this.notify();
  }

  // ── 수동 새로고침 ─────────────────────────────────────────
  async refresh() {
    if (!this.activeStationId) return;
    await this._fetchArrivals(this.activeStationId);
  }

  // ── 폴링 주기 변경 ────────────────────────────────────────
  setPollInterval(seconds) {
    this.pollSeconds = seconds;
    if (this.activeStationId) {
      this._stopPoll();
      this._startPoll(this.activeStationId);
    }
    this.notify();
  }

  // ── 내부: 도착 정보 fetch (2단계 조회) ──────────────────────
  // 1단계: ARS번호(arsId)로 정류소 목록 조회 → 실제 stationId 획득
  // 2단계: 실제 stationId로 버스 도착 정보 조회
  async _fetchArrivals(arsId) {
    if (!arsId || !this.apiKeySet) return;

    this.loadingStations.add(arsId);
    this.errorMap.delete(arsId);
    this.notify();

    try {
      // ── 1단계: ARS번호 → 실제 stationId 해석 ──
      const realStationId = await resolveRealStationId(arsId);

      if (!realStationId) {
        throw new Error(`ARS ${arsId}에 해당하는 정류소를 GBIS에서 찾을 수 없습니다.`);
      }

      console.log(`[Engine] ${arsId} → realStationId: ${realStationId} 로 도착 정보 조회`);

      // ── 2단계: 실제 stationId로 도착 정보 조회 ──
      const rawList = await fetchArrivalList(realStationId);

      // 각 노선의 raw 도착 정보를 정규화 후 flatten
      const arrivals = rawList.flatMap(raw => normalizeArrival(raw));

      // ETA 오름차순 정렬
      arrivals.sort((a, b) => a.predictTime - b.predictTime);

      // arsId 키로 캐시 저장 (UI는 arsId 기준으로 조회)
      this.arrivalCache.set(arsId, arrivals);
      this.lastUpdated = new Date();

      console.log(`[Engine] ${arsId} 도착 정보 ${arrivals.length}건 수신 완료`);
    } catch (err) {
      console.error(`[Engine] fetch 실패 (ARS ${arsId}):`, err.message);
      this.errorMap.set(arsId, err.message);
      // 캐시 유지 (마지막 성공 데이터 표시)
    } finally {
      this.loadingStations.delete(arsId);
      this.notify();
    }
  }

  // ── 폴링 시작/정지 ───────────────────────────────────────
  _startPoll(stationId) {
    this.pollInterval = setInterval(() => {
      this._fetchArrivals(stationId);
    }, this.pollSeconds * 1000);
  }

  _stopPoll() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ── 승차 예약 토글 ────────────────────────────────────────
  toggleBoardingRequest(stationId, routeId) {
    const key = `${stationId}:${routeId}`;
    if (this.boardingRequests.has(key)) {
      this.boardingRequests.delete(key);
    } else {
      this.boardingRequests.add(key);
    }
    this.notify();
  }

  isBoardingRequestActive(stationId, routeId) {
    return this.boardingRequests.has(`${stationId}:${routeId}`);
  }

  // ── 정류장으로 캐시된 도착 정보 조회 ─────────────────────
  getArrivalsForStation(stationId) {
    return this.arrivalCache.get(stationId) || [];
  }
}

// 싱글턴 인스턴스
export const transitEngine = new TransitEngine();
window.transitEngine = transitEngine; // 개발 디버깅용

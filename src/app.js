/* ==========================================
   군포시 실시간 버스 정보 시스템 - 앱 오케스트레이터
   공공데이터포털 GBIS API 연동 버전
   ========================================== */

import { transitEngine } from './services/transitEngine.js';
import { StationList }   from './components/StationList.js';
import { ArrivalBoard }  from './components/ArrivalBoard.js';
import { RouteMap }      from './components/RouteMap.js';
import { ControlPanel }  from './components/ControlPanel.js';
import { StatWidget }    from './components/StatWidget.js';
import { initPanelResizers } from './panelResizer.js';

class App {
  constructor() {
    // 1. 상태 초기화
    this.activeStationId = null;  // 정류장 선택 전까지 null
    this.favorites = this.loadFavorites();

    // 2. 컴포넌트 인스턴스 생성
    this.stationList = new StationList(
      'station-list-container',
      (id) => this.setActiveStation(id),
      (id) => this.toggleFavorite(id)
    );

    this.arrivalBoard = new ArrivalBoard(
      'arrival-board-container',
      this.activeStationId,
      (id) => this.toggleFavorite(id)
    );

    this.routeMap = new RouteMap(
      'route-map-container',
      this.activeStationId,
      (id) => this.setActiveStation(id)
    );

    this.controlPanel = new ControlPanel('control-panel-container');
    this.statWidget   = new StatWidget('stat-widget-container');

    // 3. 글로벌 이벤트 등록
    this.setupGlobalEvents();

    // 4. 엔진 구독 (상태 변화 → UI 갱신)
    transitEngine.subscribe((engineState) => this.handleStateUpdate(engineState));

    // 5. 헤더 시계 시작
    this.startClock();
  }

  loadFavorites() {
    try {
      const saved = localStorage.getItem('gunpobus_fav_stations');
      return saved ? JSON.parse(saved) : ['26054', '26084']; // 산본역②, 군포역 기본 즐겨찾기
    } catch {
      return ['26054', '26084'];
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem('gunpobus_fav_stations', JSON.stringify(this.favorites));
    } catch (e) {
      console.error('즐겨찾기 저장 실패:', e);
    }
  }

  setActiveStation(stationId) {
    if (this.activeStationId === stationId) return;
    this.activeStationId = stationId;
    transitEngine.setActiveStation(stationId);
    this.updateUI(transitEngine.getState());
  }

  toggleFavorite(stationId) {
    const idx = this.favorites.indexOf(stationId);
    if (idx === -1) this.favorites.push(stationId);
    else            this.favorites.splice(idx, 1);
    this.saveFavorites();
    this.updateUI(transitEngine.getState());
  }

  handleStateUpdate(engineState) {
    this.updateUI(engineState);
  }

  updateUI(engineState) {
    if (!engineState) return;

    const unifiedState = {
      ...engineState,
      activeStationId: this.activeStationId,
      favorites:       this.favorites,
    };

    this.stationList.render(unifiedState);
    this.arrivalBoard.render(unifiedState);
    this.routeMap.render(unifiedState);
    this.controlPanel.render(unifiedState);
    this.statWidget.render(unifiedState);
  }

  setupGlobalEvents() {
    const alertBanner = document.getElementById('alert-banner');
    const alertText   = alertBanner?.querySelector('.alert-text');
    const alertTitle  = alertBanner?.querySelector('.alert-title');
    const alertClose  = document.getElementById('alert-close');

    window.addEventListener('transit-alert', e => {
      const { title, text } = e.detail;
      if (alertBanner && alertText && alertTitle) {
        alertTitle.textContent = title;
        alertText.textContent  = text;
        alertBanner.classList.remove('hidden');
        setTimeout(() => alertBanner.classList.add('hidden'), 10000);
      }
    });

    alertClose?.addEventListener('click', () => {
      alertBanner?.classList.add('hidden');
    });
  }

  startClock() {
    const timeEl = document.getElementById('system-time');
    const update = () => {
      const d    = new Date();
      const hms  = [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, '0'))
        .join(':');
      if (timeEl) {
        timeEl.innerHTML = `<i data-lucide="clock" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;color:var(--color-trunk);"></i>${hms}`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      }
    };
    update();
    setInterval(update, 1000);
  }
}

// ── 앱 초기화 ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();

  // 패널 리사이저 초기화
  initPanelResizers();

  // Lucide 아이콘 로드 대기
  const iconInterval = setInterval(() => {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
      clearInterval(iconInterval);
    }
  }, 100);
  setTimeout(() => clearInterval(iconInterval), 10000);
});

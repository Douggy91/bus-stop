/* ==========================================
   군포시 실시간 버스 - 도착 정보 보드
   GBIS API 실제 데이터 기반 렌더링
   ========================================== */

import { transitEngine } from '../services/transitEngine.js';

export class ArrivalBoard {
  constructor(containerId, activeStationId, onToggleFavoriteStation) {
    this.container = document.getElementById(containerId);
    this.activeStationId = activeStationId;
    this.onToggleFavoriteStation = onToggleFavoriteStation;
    this.setupEvents();
  }

  setupEvents() {
    const favToggle = document.getElementById('station-fav-toggle');
    if (favToggle) {
      favToggle.addEventListener('click', () => {
        if (this.activeStationId) {
          this.onToggleFavoriteStation(this.activeStationId);
        }
      });
    }
  }

  setActiveStation(stationId) {
    this.activeStationId = stationId;
  }

  // 혼잡도 한국어 변환
  getCongestionLabel(level) {
    switch (level) {
      case 'empty':    return '여유';
      case 'moderate': return '보통';
      case 'crowded':  return '혼잡';
      default:         return '보통';
    }
  }

  // ETA 표시 HTML 생성
  buildEtaHtml(arrival) {
    const mins = arrival.predictTime;

    if (mins === 0) {
      return `
        <span class="bus-eta-time arriving-soon">곧 도착<span>진입</span></span>
        <span class="bus-eta-stops">정류장 진입 중</span>
      `;
    }
    if (mins === 1) {
      return `
        <span class="bus-eta-time arriving-soon">1<span>분</span></span>
        <span class="bus-eta-stops">${arrival.locationNo}정거장 전</span>
      `;
    }
    return `
      <span class="bus-eta-time ${mins <= 3 ? 'arriving-soon' : ''}">${mins}<span>분</span></span>
      <span class="bus-eta-stops">${arrival.locationNo}정거장 전</span>
    `;
  }

  render(state) {
    if (!state) return;
    const { stations, activeStationId, favorites, arrivals, isLoading, error, boardingRequests, apiKeySet } = state;
    this.setActiveStation(activeStationId);

    // ── 헤더 업데이트 ───────────────────────────────────────
    const station = stations.find(s => s.id === activeStationId);
    const nameEl   = document.getElementById('active-station-name');
    const idEl     = document.getElementById('active-station-id');
    const favToggle = document.getElementById('station-fav-toggle');

    if (station) {
      nameEl.textContent = station.name;
      idEl.textContent   = `ARS ${station.arsId || station.id}`;
      idEl.classList.remove('hidden');
      favToggle.classList.remove('hidden');

      const isFav = (favorites || []).includes(station.id);
      const icon  = favToggle.querySelector('.heart-icon') || favToggle.querySelector('svg') || favToggle.querySelector('i');
      if (isFav) {
        favToggle.classList.add('active');
        if (icon) icon.style.fill = 'currentColor';
      } else {
        favToggle.classList.remove('active');
        if (icon) icon.style.fill = 'none';
      }
    } else {
      nameEl.textContent = '정류장을 선택하세요';
      idEl.classList.add('hidden');
      favToggle.classList.add('hidden');
    }

    // ── API 키 미설정 안내 ──────────────────────────────────
    if (!apiKeySet) {
      this.container.innerHTML = `
        <div class="no-arrivals" style="gap:16px; padding: 40px 20px;">
          <i data-lucide="key-round" style="width:48px; height:48px; color:var(--color-local);"></i>
          <p style="font-size:14px; font-weight:600; color:var(--text-main);">API 키 설정이 필요합니다</p>
          <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:12px; padding:16px 20px; text-align:left; font-size:12px; line-height:1.8; color:var(--text-secondary); max-width:320px;">
            <strong style="color:var(--color-local);">설정 방법</strong><br>
            1. <a href="https://www.data.go.kr" target="_blank" style="color:var(--color-trunk);">data.go.kr</a> 회원가입<br>
            2. "경기도 버스도착정보조회서비스" 검색 후 활용 신청<br>
            3. 발급된 키를 <code style="background:rgba(255,255,255,0.08); padding:1px 5px; border-radius:4px;">.env</code> 파일에 입력<br>
            4. <code style="background:rgba(255,255,255,0.08); padding:1px 5px; border-radius:4px;">node server.js</code> 재시작
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }

    // ── 정류장 미선택 ───────────────────────────────────────
    if (!activeStationId) {
      this.container.innerHTML = `
        <div class="no-arrivals">
          <i data-lucide="map-pin" style="width:40px; height:40px; color:var(--text-muted);"></i>
          <p>왼쪽 목록에서 정류장을 선택하여<br>실시간 버스 도착 정보를 확인하세요.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }

    // ── 로딩 상태 ──────────────────────────────────────────
    if (isLoading && (!arrivals || arrivals.length === 0)) {
      this.container.innerHTML = `
        <div class="no-arrivals">
          <div class="loading-spinner"></div>
          <p style="margin-top:12px;">실시간 버스 정보를 불러오는 중...</p>
        </div>
      `;
      return;
    }

    // ── 오류 상태 ──────────────────────────────────────────
    if (error && (!arrivals || arrivals.length === 0)) {
      this.container.innerHTML = `
        <div class="no-arrivals">
          <i data-lucide="wifi-off" style="width:40px; height:40px; color:var(--color-express);"></i>
          <p style="color:var(--color-express); font-weight:600;">데이터 조회 오류</p>
          <p style="font-size:11px; color:var(--text-muted);">${error}</p>
          <button onclick="window.transitEngine.refresh()" style="margin-top:8px; padding:8px 16px; border-radius:10px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); color:var(--color-trunk); cursor:pointer; font-size:12px;">
            다시 시도
          </button>
        </div>
      `;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }

    // ── 도착 정보 없음 ──────────────────────────────────────
    if (!arrivals || arrivals.length === 0) {
      this.container.innerHTML = `
        <div class="no-arrivals">
          <i data-lucide="bus-front" style="width:40px; height:40px; color:var(--text-muted);"></i>
          <p>현재 도착 예정 버스가 없습니다.<br>운행 시간을 확인해주세요.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }

    // ── 도착 카드 렌더링 ────────────────────────────────────
    // 구조 변경 감지 (정류장 전환 or 노선 수 변화)
    const arrivalKey = arrivals.map(a => `${a.routeId}-${a.busOrder}`).join(',');
    const forceRedraw =
      this.lastActiveStationId !== activeStationId ||
      this.lastArrivalKey !== arrivalKey ||
      this.container.querySelector('.no-arrivals') ||
      this.container.children.length === 0;

    if (forceRedraw) {
      this.lastActiveStationId = activeStationId;
      this.lastArrivalKey = arrivalKey;
      this._drawFullCards(arrivals, boardingRequests, activeStationId);
      return;
    }

    // ── 플리커 없는 부분 업데이트 ──────────────────────────
    arrivals.forEach(arrival => {
      const cardId = `${arrival.routeId}-${arrival.busOrder}`;
      const card = this.container.querySelector(`[data-arrival-id="${cardId}"]`);
      if (!card) return;

      const reqKey    = `${activeStationId}:${arrival.routeId}`;
      const isReserved = (boardingRequests || []).includes(reqKey);

      if (isReserved) card.classList.add('bell-active');
      else            card.classList.remove('bell-active');

      const etaGroup = card.querySelector('.bus-eta-group');
      if (etaGroup) {
        const newHtml = this.buildEtaHtml(arrival);
        if (etaGroup.innerHTML.replace(/\s+/g, '') !== newHtml.replace(/\s+/g, '')) {
          etaGroup.innerHTML = newHtml;
        }
      }
    });
  }

  _drawFullCards(arrivals, boardingRequests, activeStationId) {
    this.container.innerHTML = '';

    arrivals.forEach(arrival => {
      const reqKey    = `${activeStationId}:${arrival.routeId}`;
      const isReserved = (boardingRequests || []).includes(reqKey);

      const card = document.createElement('div');
      card.className = `arrival-card ${isReserved ? 'bell-active' : ''}`;
      card.dataset.arrivalId = `${arrival.routeId}-${arrival.busOrder}`;
      card.style.setProperty('--line-color', arrival.color);
      card.style.setProperty('--line-color-soft', arrival.color + '22');

      const wheelchairHtml = arrival.isLowFloor
        ? `<span class="tag tag-accessibility" title="저상버스">
             <i data-lucide="accessibility" style="width:11px;height:11px;"></i>저상
           </span>`
        : '';

      const congestionLabel = this.getCongestionLabel(arrival.congestion);

      const bellHtml = isReserved
        ? `<button class="bell-request-btn active" data-route-id="${arrival.routeId}">
             <i data-lucide="bell-ring"></i> 예약 취소 🔔
           </button>`
        : `<button class="bell-request-btn" data-route-id="${arrival.routeId}">
             <i data-lucide="bell"></i> 승차 예약
           </button>`;

      // 차량번호 마스킹 (경기 XX바 1234 → 경기 **바 1234)
      const plateDisplay = arrival.plateNo
        ? arrival.plateNo
        : '번호 미제공';

      card.innerHTML = `
        <!-- 노선 번호 배지 -->
        <div class="bus-badge-container">
          <div class="bus-badge ${arrival.type}">${arrival.routeName}</div>
          <div class="bus-type-lbl">${arrival.typeLabel}</div>
          ${arrival.busOrder === 2 ? '<div class="bus-type-lbl" style="color:var(--text-muted);">다음 버스</div>' : ''}
        </div>

        <!-- 노선 상세 -->
        <div class="bus-route-details">
          <div class="bus-destination">${arrival.routeName}번</div>
          <div class="bus-meta-tags">
            <span class="tag tag-plate">${plateDisplay}</span>
            ${wheelchairHtml}
            <span class="tag tag-congestion ${arrival.congestion}">${congestionLabel}</span>
          </div>
        </div>

        <!-- ETA -->
        <div class="bus-eta-group">
          ${this.buildEtaHtml(arrival)}
        </div>

        <!-- 승차 예약 버튼 -->
        <div class="bell-btn-group" data-last-state="${isReserved}">
          ${bellHtml}
        </div>
      `;

      // 승차 예약 버튼 이벤트
      const bellBtn = card.querySelector('.bell-request-btn');
      if (bellBtn) {
        bellBtn.addEventListener('click', e => {
          e.stopPropagation();
          transitEngine.toggleBoardingRequest(activeStationId, arrival.routeId);
        });
      }

      this.container.appendChild(card);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

/* ==========================================
   LIVE METROBUS - ARRIVAL BOARD COMPONENT
   Displays incoming buses, congestion metrics,
   real-time ETAs, and interactive stop bells.
   Provides 100% flicker-free reactive rendering.
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
    // Favorite button for the active station
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

  // Helper to translate congestion to Korean
  getCongestionLabel(level) {
    switch (level) {
      case 'empty': return '여유';
      case 'moderate': return '보통';
      case 'crowded': return '혼잡';
      default: return '보통';
    }
  }

  render(state) {
    if (!state) return;
    const { stations, activeStationId, favorites, boardingRequests } = state;
    this.setActiveStation(activeStationId);

    const station = stations.find(s => s.id === activeStationId);
    
    // Update active station details in header
    const nameEl = document.getElementById('active-station-name');
    const idEl = document.getElementById('active-station-id');
    const favToggle = document.getElementById('station-fav-toggle');

    if (station) {
      nameEl.textContent = station.name;
      idEl.textContent = station.id;
      idEl.classList.remove('hidden');
      favToggle.classList.remove('hidden');

      const isFav = favorites.includes(station.id);
      const icon = favToggle.querySelector('.heart-icon') || favToggle.querySelector('svg') || favToggle.querySelector('i');
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
      this.container.innerHTML = `
        <div class="no-arrivals">
          <i data-lucide="info" style="width:40px; height:40px; margin-bottom:12px; color:var(--text-muted);"></i>
          <p>왼쪽 목록에서 정류장을 선택하여<br>실시간 버스 진입 현황을 확인하세요.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }

    // Fetch live arrival data from simulation engine
    const arrivals = transitEngine.getArrivalsForStation(activeStationId);

    if (arrivals.length === 0) {
      this.container.innerHTML = `
        <div class="no-arrivals">
          <i data-lucide="bus-front" style="width:40px; height:40px; margin-bottom:12px; color:var(--text-muted);"></i>
          <p>현재 운행 중인 버스가 노선 상에 없습니다.<br>오른쪽 제어반에서 차량을 수동으로 추가해보세요.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }

    // Identify if structural change happened (spawns/departs, station switch)
    const arrivalsListId = arrivals.map(a => a.bus.id).join(',');
    if (
      this.lastActiveStationId !== activeStationId || 
      this.lastArrivalsListId !== arrivalsListId || 
      this.container.querySelector('.no-arrivals') ||
      this.container.children.length === 0
    ) {
      this.lastActiveStationId = activeStationId;
      this.lastArrivalsListId = arrivalsListId;
      
      // Structural rendering
      this.drawFullCards(arrivals, boardingRequests, activeStationId);
      return;
    }

    // Flicker-Free Precision Value Updates: Only modify the text values within existing DOM elements!
    arrivals.forEach(arrival => {
      const { bus, route, stopsAway, etaSeconds, isAtStation, isBoardingActive } = arrival;
      const card = this.container.querySelector(`[data-bus-id="${bus.id}"]`);
      if (!card) return;

      const requestKey = `${activeStationId}:${route.id}`;
      const isReserved = boardingRequests.includes(requestKey);

      // 1. Update card glowing border
      if (isReserved) {
        card.classList.add('bell-active');
      } else {
        card.classList.remove('bell-active');
      }

      // 2. Update ETA Group text and classes
      const etaGroup = card.querySelector('.bus-eta-group');
      if (etaGroup) {
        let etaHTML = '';
        if (isBoardingActive) {
          etaHTML = `<span class="bus-eta-time arriving-soon" style="color:var(--color-bell);">탑승 중<span>🚶‍♂️</span></span>
                     <span class="bus-eta-stops">예약 승객 승차 중</span>`;
        } else if (isAtStation) {
          etaHTML = `<span class="bus-eta-time arriving-soon">곧 도착<span>진입</span></span>
                     <span class="bus-eta-stops">정류장 정차 중</span>`;
        } else {
          const mins = Math.floor(etaSeconds / 60);
          const secs = etaSeconds % 60;
          const etaClass = mins < 2 ? 'arriving-soon' : '';
          const timeStr = mins > 0 
            ? `${mins}<span>분</span> ${secs}<span>초</span>` 
            : `${secs}<span>초</span>`;

          etaHTML = `<span class="bus-eta-time ${etaClass}">${timeStr}</span>
                     <span class="bus-eta-stops">${stopsAway}정거장 전</span>`;
        }

        // Avoid minor blinking by only changing DOM when text differs
        if (etaGroup.innerHTML !== etaHTML) {
          etaGroup.innerHTML = etaHTML;
        }
      }

      // 3. Update congestion badge class & text
      const congestionTag = card.querySelector('.tag-congestion');
      if (congestionTag) {
        const expectedClass = `tag tag-congestion ${bus.congestion}`;
        if (congestionTag.className !== expectedClass) {
          congestionTag.className = expectedClass;
        }
        const expectedText = `${this.getCongestionLabel(bus.congestion)} (${bus.seatsRemaining}석)`;
        if (congestionTag.textContent !== expectedText) {
          congestionTag.textContent = expectedText;
        }
      }

      // 4. Update Boarding Bell button state
      const bellBtnGroup = card.querySelector('.bell-btn-group');
      if (bellBtnGroup) {
        let buttonHTML = '';
        if (isBoardingActive) {
          buttonHTML = `
            <button class="bell-request-btn active" style="background:var(--color-empty); border-color:var(--color-empty); pointer-events:none;">
              <i data-lucide="check"></i> 탑승 완료
            </button>
          `;
        } else if (isReserved) {
          buttonHTML = `
            <button class="bell-request-btn active" data-route-id="${route.id}">
              <i data-lucide="bell-ring"></i> 예약 취소 🔔
            </button>
          `;
        } else {
          buttonHTML = `
            <button class="bell-request-btn" data-route-id="${route.id}">
              <i data-lucide="bell"></i> 승차 예약
            </button>
          `;
        }

        // Prevent button flicker by only updating DOM if button state changed
        const currentCleanHtml = bellBtnGroup.innerHTML.replace(/\s+/g, ' ').trim();
        const expectedCleanHtml = buttonHTML.replace(/\s+/g, ' ').trim();
        
        // If state is structurally changing, redraw button and re-bind event
        if (bellBtnGroup.dataset.lastState !== isReserved + '-' + isBoardingActive) {
          bellBtnGroup.dataset.lastState = isReserved + '-' + isBoardingActive;
          bellBtnGroup.innerHTML = buttonHTML;
          
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
          
          const bellBtn = bellBtnGroup.querySelector('.bell-request-btn');
          if (bellBtn && !isBoardingActive) {
            bellBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              transitEngine.toggleBoardingRequest(activeStationId, route.id);
            });
          }
        }
      }
    });
  }

  // Structural rendering of all arrival cards
  drawFullCards(arrivals, boardingRequests, activeStationId) {
    this.container.innerHTML = '';
    
    arrivals.forEach(arrival => {
      const { bus, route, stopsAway, etaSeconds, isAtStation, isBoardingActive } = arrival;
      
      const requestKey = `${activeStationId}:${route.id}`;
      const isReserved = boardingRequests.includes(requestKey);

      const card = document.createElement('div');
      card.className = `arrival-card ${isReserved ? 'bell-active' : ''}`;
      card.dataset.busId = bus.id;
      card.style.setProperty('--line-color', route.color);
      
      const routeTypeSoftColor = route.color + '18';
      card.style.setProperty('--line-color-soft', routeTypeSoftColor);

      let busTypeLabel = '일반 버스';
      if (route.type === 'express') busTypeLabel = '광역 급행';
      if (route.type === 'trunk') busTypeLabel = '도심 간선';
      if (route.type === 'branch') busTypeLabel = '지선 순환';
      if (route.type === 'local') busTypeLabel = '순환 마을';

      let etaHTML = '';
      if (isBoardingActive) {
        etaHTML = `<span class="bus-eta-time arriving-soon" style="color:var(--color-bell);">탑승 중<span>🚶‍♂️</span></span>
                   <span class="bus-eta-stops">예약 승객 승차 중</span>`;
      } else if (isAtStation) {
        etaHTML = `<span class="bus-eta-time arriving-soon">곧 도착<span>진입</span></span>
                   <span class="bus-eta-stops">정류장 정차 중</span>`;
      } else {
        const mins = Math.floor(etaSeconds / 60);
        const secs = etaSeconds % 60;
        const etaClass = mins < 2 ? 'arriving-soon' : '';
        const timeStr = mins > 0 
          ? `${mins}<span>분</span> ${secs}<span>초</span>` 
          : `${secs}<span>초</span>`;

        etaHTML = `<span class="bus-eta-time ${etaClass}">${timeStr}</span>
                   <span class="bus-eta-stops">${stopsAway}정거장 전</span>`;
      }

      const wheelchairHTML = bus.isLowFloor 
        ? `<span class="tag tag-accessibility" title="휠체어 탑승 가능 저상 버스">
             <i data-lucide="accessibility" style="width:11px; height:11px;"></i>저상
           </span>` 
        : '';

      const delayHTML = bus.isDelayed 
        ? `<span class="tag tag-congestion crowded" style="animation: pulse-glow-red 1s infinite;">
             <i data-lucide="alert-circle" style="width:11px; height:11px;"></i>지연 중
           </span>`
        : '';

      let buttonHTML = '';
      if (isBoardingActive) {
        buttonHTML = `
          <button class="bell-request-btn active" style="background:var(--color-empty); border-color:var(--color-empty); pointer-events:none;">
            <i data-lucide="check"></i> 탑승 완료
          </button>
        `;
      } else if (isReserved) {
        buttonHTML = `
          <button class="bell-request-btn active" data-route-id="${route.id}">
            <i data-lucide="bell-ring"></i> 예약 취소 🔔
          </button>
        `;
      } else {
        buttonHTML = `
          <button class="bell-request-btn" data-route-id="${route.id}">
            <i data-lucide="bell"></i> 승차 예약
          </button>
        `;
      }

      card.innerHTML = `
        <!-- Route Badge -->
        <div class="bus-badge-container">
          <div class="bus-badge ${route.type}">${route.number}</div>
          <div class="bus-type-lbl">${busTypeLabel}</div>
        </div>

        <!-- Details & Tags -->
        <div class="bus-route-details">
          <div class="bus-destination">${route.name}</div>
          <div class="bus-meta-tags">
            <span class="tag tag-plate">${bus.plateNumber}</span>
            ${wheelchairHTML}
            <span class="tag tag-congestion ${bus.congestion}">
              ${this.getCongestionLabel(bus.congestion)} (${bus.seatsRemaining}석)
            </span>
            ${delayHTML}
          </div>
        </div>

        <!-- ETA Timer -->
        <div class="bus-eta-group">
          ${etaHTML}
        </div>

        <!-- Reservation Bell Button -->
        <div class="bell-btn-group" data-last-state="${isReserved}-${isBoardingActive}">
          ${buttonHTML}
        </div>
      `;

      const bellBtn = card.querySelector('.bell-request-btn');
      if (bellBtn && !isBoardingActive) {
        bellBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          transitEngine.toggleBoardingRequest(activeStationId, route.id);
        });
      }

      this.container.appendChild(card);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

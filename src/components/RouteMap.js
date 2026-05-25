/* ==========================================
   군포시 실시간 버스 - 노선도 SVG 맵
   군포시 실제 정류장 좌표 기반 정적 맵
   도착 정보의 노선 색상을 반영한 동적 강조
   ========================================== */

import { STATIONS, ROUTE_TYPE_MAP } from '../services/transitData.js';

// 군포시 내 주요 노선 연결 경로 (시각화용, 정류장 좌표 기반)
const VISUAL_ROUTES = [
  {
    id: 'line-4',
    label: '4호선 환승 라인',
    color: '#3b82f6',
    stationIds: ['26378', '26379', '26046', '26054', '26055', '26049'],
  },
  {
    id: 'line-1',
    label: '1호선 환승 라인',
    color: '#10b981',
    stationIds: ['26084', '26085', '26170', '26179', '26182'],
  },
  {
    id: 'line-garage',
    label: '공영차고지 라인',
    color: '#f59e0b',
    stationIds: ['26170', '26216', '26173', '26172'],
  },
];

export class RouteMap {
  constructor(containerId, activeStationId, onSelectStation) {
    this.container       = document.getElementById(containerId);
    this.activeStationId = activeStationId;
    this.onSelectStation = onSelectStation;
    this.svgBuilt        = false;
    this.state           = null;
    this.setupTooltip();
  }

  setupTooltip() {
    // 다크 글래스모피즘 테마의 툴팁 요소 동적 바인딩
    this.tooltip = document.getElementById('map-tooltip');
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'map-tooltip';
      this.tooltip.style.cssText = `
        position: fixed;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transform: scale(0.95) translateY(6px);
        transition: opacity 0.15s ease-out, transform 0.15s ease-out;
        background: rgba(13, 20, 35, 0.9);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 10px 14px;
        color: #f3f4f6;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(236, 72, 153, 0.15);
        font-size: 11.5px;
        font-family: 'Inter', sans-serif;
        line-height: 1.5;
        min-width: 160px;
      `;
      document.body.appendChild(this.tooltip);
    }
  }

  showTooltip(stationId, event) {
    if (!this.state) return;
    const { boardingRequests, arrivals } = this.state;
    const station = STATIONS.find(s => s.id === stationId);
    if (!station) return;

    const reqs = (boardingRequests || []).filter(r => r.startsWith(stationId + ':'));
    if (reqs.length === 0) return; // 예약된 건이 없으면 툴팁을 띄우지 않음

    let tooltipContent = '';

    // 현재 선택된 정류장인 경우 -> 상세 버스 실시간 도착 정보 제공
    if (this.activeStationId === stationId && arrivals && arrivals.length > 0) {
      const reservedArrivals = arrivals.filter(a => {
        const key = `${stationId}:${a.routeId}`;
        return reqs.includes(key);
      });

      if (reservedArrivals.length > 0) {
        tooltipContent = `
          <div style="font-weight:800; color:var(--color-bell); display:flex; align-items:center; gap:5px; margin-bottom:5px;">
            <span style="font-size:13px;">🔔</span> 승차 예약 노선 정보
          </div>
          <div style="font-weight:700; font-size:12.5px; color:#fff; margin-bottom:4px;">${station.name}</div>
          <div style="border-top:1px solid rgba(255,255,255,0.08); margin: 6px 0;"></div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${reservedArrivals.map(a => {
              const mins = a.predictTime;
              const timeStr = mins === 0 ? '곧 도착 진입' : `${mins}분전`;
              const stopsStr = `${a.locationNo}전`;
              return `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
                  <span style="background:${a.color}22; color:${a.color}; border:1px solid ${a.color}44; font-weight:800; font-size:10px; padding:2px 6px; border-radius:6px;">
                    ${a.routeName}번
                  </span>
                  <span style="font-weight:600; color:#fff;">
                    ${timeStr} <span style="font-size:9.5px; color:var(--text-muted); font-weight:normal;">(${stopsStr})</span>
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    // 선택되지 않은 정류장이거나 상세 정보가 없는 경우 -> 예약 여부만 노출
    if (!tooltipContent) {
      tooltipContent = `
        <div style="font-weight:800; color:var(--color-bell); display:flex; align-items:center; gap:5px; margin-bottom:4px;">
          <span style="font-size:13px;">🔔</span> 승차 예약 활성
        </div>
        <div style="font-weight:700; font-size:12.5px; color:#fff; margin-bottom:4px;">${station.name}</div>
        <div style="border-top:1px solid rgba(255,255,255,0.08); margin: 5px 0;"></div>
        <div style="font-size:10.5px; color:var(--text-secondary);">해당 정류장에 탑승 예약한 노선이 있습니다.</div>
      `;
    }

    this.tooltip.innerHTML = tooltipContent;
    this.tooltip.style.opacity = '1';
    this.tooltip.style.transform = 'scale(1) translateY(0)';
    this.moveTooltip(event);
  }

  moveTooltip(event) {
    if (!this.tooltip) return;
    const offset = 14;
    this.tooltip.style.left = `${event.clientX + offset}px`;
    this.tooltip.style.top = `${event.clientY + offset}px`;
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.style.opacity = '0';
    this.tooltip.style.transform = 'scale(0.95) translateY(6px)';
  }

  setActiveStation(stationId) {
    this.activeStationId = stationId;
  }

  renderGridPattern() {
    return `
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.015)" stroke-width="1"/>
        </pattern>
        <filter id="glow-filter">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)"/>
    `;
  }

  // 도착 정보의 노선 색상으로 활성 경로 강조
  renderRouteLines(arrivals) {
    let html = '';

    // 현재 도착 노선의 색상 수집
    const activeRouteColors = new Map();
    (arrivals || []).forEach(a => {
      if (!activeRouteColors.has(a.type)) {
        activeRouteColors.set(a.routeId, a.color);
      }
    });

    VISUAL_ROUTES.forEach(route => {
      const routeStations = route.stationIds
        .map(id => STATIONS.find(s => s.id === id))
        .filter(Boolean);

      if (routeStations.length < 2) return;

      let pathData = `M ${routeStations[0].x} ${routeStations[0].y}`;
      for (let i = 1; i < routeStations.length; i++) {
        const from = routeStations[i - 1];
        const to   = routeStations[i];
        const cx   = (from.x + to.x) / 2;
        const cy   = (from.y + to.y) / 2 - 10;
        pathData += ` Q ${cx} ${cy}, ${to.x} ${to.y}`;
      }

      html += `
        <path d="${pathData}"
              class="map-route-path"
              style="stroke:${route.color}; opacity:0.35; stroke-width:4;"
              id="path-${route.id}"/>
      `;
    });

    return html;
  }

  renderStationNodes(arrivals, boardingRequests) {
    let html = '';

    // 현재 도착 정보가 있는 정류장 파악
    const hasArrivals = arrivals && arrivals.length > 0;

    STATIONS.forEach(station => {
      const isActive    = station.id === this.activeStationId;
      const hasBell     = (boardingRequests || []).some(r => r.startsWith(station.id));
      const radius      = isActive ? 9 : 6;

      html += `
        <g class="station-node-group" style="cursor:pointer;" data-id="${station.id}">
          ${hasBell ? `
            <circle cx="${station.x}" cy="${station.y}" r="14" fill="none"
                    stroke="var(--color-bell)" stroke-width="1.5"
                    style="animation:marker-ring-pulse 1.2s infinite; pointer-events:none;"/>
          ` : ''}
          ${isActive ? `
            <circle cx="${station.x}" cy="${station.y}" r="14" fill="none"
                    stroke="var(--color-trunk)" stroke-width="1" opacity="0.3"
                    style="pointer-events:none;"/>
          ` : ''}

          <circle cx="${station.x}" cy="${station.y}" r="${radius}"
                  class="map-station-node ${isActive ? 'active-station' : ''} ${hasBell ? 'boarding-bell-active' : ''}"
                  data-id="${station.id}"/>

          <text x="${station.x}" y="${station.y - (isActive ? 16 : 12)}"
                text-anchor="middle"
                class="map-station-label ${isActive ? 'active-station-label' : ''}">
            ${station.name.split('(')[0].trim()} ${hasBell ? '🔔' : ''}
          </text>
        </g>
      `;
    });

    return html;
  }

  // 도착 정보 있는 정류장에 버스 수 뱃지 표시
  renderArrivalBadges(arrivals) {
    if (!arrivals || arrivals.length === 0 || !this.activeStationId) return '';
    const station = STATIONS.find(s => s.id === this.activeStationId);
    if (!station) return '';

    return `
      <g transform="translate(${station.x + 12}, ${station.y - 18})">
        <rect x="-10" y="-9" width="22" height="16" rx="5"
              fill="var(--color-trunk)" opacity="0.9"/>
        <text x="1" y="2" fill="#fff" font-size="9" font-weight="800"
              text-anchor="middle" font-family="Outfit, sans-serif">
          ${arrivals.length}대
        </text>
      </g>
    `;
  }

  render(state) {
    if (!state) return;
    this.state = state;
    const { activeStationId, favorites, boardingRequests, arrivals } = state;

    this.setActiveStation(activeStationId);

    const bellsStr = (boardingRequests || []).join(',');

    // SVG 기반 구조가 없으면 초기 구축
    if (!this.svgBuilt || !this.container.querySelector('svg')) {
      this.svgBuilt = true;

      this.container.innerHTML = `
        <svg class="svg-map-element" viewBox="0 0 960 380"
             width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <g id="map-grid-layer">${this.renderGridPattern()}</g>
          <g id="map-paths-layer"></g>
          <g id="map-stations-layer"></g>
          <g id="map-badges-layer"></g>
        </svg>
      `;

      this.pathsLayer    = this.container.querySelector('#map-paths-layer');
      this.stationsLayer = this.container.querySelector('#map-stations-layer');
      this.badgesLayer   = this.container.querySelector('#map-badges-layer');

      // 노선 경로는 정적 (한 번만 그림)
      if (this.pathsLayer) {
        this.pathsLayer.innerHTML = this.renderRouteLines(arrivals);
      }
    }

    // 정류장 노드: 활성 정류장 / 벨 예약 변화 시 갱신
    if (
      this.lastActiveId !== activeStationId ||
      this.lastBells    !== bellsStr        ||
      !this.stationsLayer?.innerHTML
    ) {
      this.lastActiveId = activeStationId;
      this.lastBells    = bellsStr;

      if (this.stationsLayer) {
        this.stationsLayer.innerHTML = this.renderStationNodes(arrivals, boardingRequests);

        // 정류장 클릭 및 마우스 호버 이벤트 바인딩
        this.container.querySelectorAll('.station-node-group').forEach(g => {
          const stationId = g.dataset.id;

          g.addEventListener('click', e => {
            const id = g.dataset.id || e.currentTarget.dataset.id;
            if (id) this.onSelectStation(id);
          });

          g.addEventListener('mouseenter', e => {
            if (stationId) this.showTooltip(stationId, e);
          });

          g.addEventListener('mousemove', e => {
            this.moveTooltip(e);
          });

          g.addEventListener('mouseleave', () => {
            this.hideTooltip();
          });
        });
      }

      if (this.badgesLayer) {
        this.badgesLayer.innerHTML = this.renderArrivalBadges(arrivals);
      }
    }
  }
}

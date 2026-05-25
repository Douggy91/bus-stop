/* ==========================================
   LIVE METROBUS - INTERACTIVE SVG ROUTE MAP
   Plots static station hubs, connects transit pathways,
   and visualizes real-time moving vehicles with
   dynamic boarding indicators.
   ========================================== */

import { STATIONS, ROUTES } from '../services/transitData.js';
import { transitEngine } from '../services/transitEngine.js';

export class RouteMap {
  constructor(containerId, activeStationId, onSelectStation) {
    this.container = document.getElementById(containerId);
    this.activeStationId = activeStationId;
    this.onSelectStation = onSelectStation;
  }

  setActiveStation(stationId) {
    this.activeStationId = stationId;
  }

  // Draw background grid pattern for high tech aesthetics
  renderGridPattern() {
    return `
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.015)" stroke-width="1"/>
        </pattern>
        <filter id="glow-heavy" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    `;
  }

  // Draw Route paths (connecting stations chronologically)
  renderRouteLines(activeRoutes) {
    let html = '';
    
    ROUTES.forEach(route => {
      const isRouteActive = activeRoutes.some(ar => ar.id === route.id);
      const stationsOnRoute = route.stations.map(id => STATIONS.find(s => s.id === id));
      
      if (stationsOnRoute.length < 2) return;

      // Draw path sequence
      let pathData = `M ${stationsOnRoute[0].x} ${stationsOnRoute[0].y}`;
      for (let i = 1; i < stationsOnRoute.length; i++) {
        const from = stationsOnRoute[i - 1];
        const to = stationsOnRoute[i];
        
        // Calculate curve/smooth offset to make routes look premium, not just boring straight lines
        // A subtle quadratic/bezier offset if route is blue, red etc. to keep them from perfectly overlapping!
        let cx = (from.x + to.x) / 2;
        let cy = (from.y + to.y) / 2;

        if (route.type === 'express') cy -= 15; // Arc Red express routes slightly up
        if (route.type === 'branch') cy += 15;  // Arc Green branch routes slightly down
        if (route.type === 'local') cx += 15;   // Arc Yellow routes right

        pathData += ` Q ${cx} ${cy}, ${to.x} ${to.y}`;
      }

      // Loop back path to create continuous visual flow
      const from = stationsOnRoute[stationsOnRoute.length - 1];
      const to = stationsOnRoute[0];
      let cx = (from.x + to.x) / 2;
      let cy = (from.y + to.y) / 2;
      if (route.type === 'express') cy -= 15;
      if (route.type === 'branch') cy += 15;
      if (route.type === 'local') cx += 15;
      pathData += ` Q ${cx} ${cy}, ${to.x} ${to.y}`;

      html += `
        <path d="${pathData}" 
              class="map-route-path ${route.type} ${isRouteActive ? 'highlighted' : ''}" 
              style="--line-color: ${route.color}" 
              id="path-${route.id}" />
      `;
    });

    return html;
  }

  // Draw station node dots
  renderStationNodes(favorites, boardingRequests) {
    let html = '';

    STATIONS.forEach(station => {
      const isActive = station.id === this.activeStationId;
      
      // Check if there is an active boarding bell for any route AT this station
      const hasActiveBell = boardingRequests.some(req => req.startsWith(station.id));

      html += `
        <g class="station-node-group">
          <!-- Glow circle for boarding bell -->
          ${hasActiveBell ? `<circle cx="${station.x}" cy="${station.y}" r="12" fill="none" stroke="var(--color-bell)" stroke-width="2" class="map-station-node-bell-pulse" style="animation: marker-ring-pulse 1.2s infinite; pointer-events:none;" />` : ''}
          
          <circle cx="${station.x}" cy="${station.y}" r="${isActive ? '8.5' : '6'}" 
                  class="map-station-node ${isActive ? 'active-station' : ''} ${hasActiveBell ? 'boarding-bell-active' : ''}" 
                  data-id="${station.id}" />
                  
          <text x="${station.x}" y="${station.y - (isActive ? 16 : 12)}" 
                text-anchor="middle" 
                class="map-station-label ${isActive ? 'active-station-label' : ''}">
            ${station.name.split(' ')[0]} ${hasActiveBell ? '🔔' : ''}
          </text>
        </g>
      `;
    });

    return html;
  }

  // Draw active moving buses
  renderBuses(buses, boardingRequests) {
    let html = '';

    buses.forEach(bus => {
      const coords = transitEngine.getBusCoordinates(bus);
      
      // Determine if this specific bus is approaching a station where it has an active boarding reservation
      const nextStationIndex = (bus.currentStationIndex + 1) % buses.length; // Approximate
      const route = ROUTES.find(r => r.id === bus.routeId);
      let isBellActiveForBus = false;

      if (route) {
        const nextStationId = route.stations[(bus.currentStationIndex + 1) % route.stations.length];
        const requestKey = `${nextStationId}:${bus.routeId}`;
        isBellActiveForBus = boardingRequests.includes(requestKey);
      }

      const isStopped = bus.dwellTimeRemaining > 0;
      
      // Animate bus position smoothly
      html += `
        <g class="map-bus-group" data-bus-id="${bus.id}" transform="translate(${coords.x}, ${coords.y})">
          <!-- Glowing Pulsing Ring if passenger boarding request is active -->
          <circle cx="0" cy="0" r="14" class="map-bus-glow-ring" />
          
          <!-- Outer border -->
          <circle cx="0" cy="0" r="10" 
                  class="map-bus-marker ${bus.type} ${isBellActiveForBus ? 'bell-active' : ''}" 
                  title="${bus.busNumber}번 (${bus.plateNumber})"/>
          
          <!-- Bus Text label -->
          <text x="0" y="3" class="map-bus-label">${bus.busNumber}</text>

          <!-- Dwell Time Loading Ring -->
          ${isStopped && !bus.isDelayed ? `
            <circle cx="0" cy="0" r="12" fill="none" stroke="var(--color-empty)" stroke-width="2" 
                    stroke-dasharray="75.3" stroke-dashoffset="${75.3 * (1 - bus.dwellTimeRemaining / bus.dwellTimeTotal)}" 
                    transform="rotate(-90)" style="transition: stroke-dashoffset 0.1s linear; pointer-events:none;"/>
          ` : ''}

          <!-- Emergency Warning Flag -->
          ${bus.isDelayed ? `
            <g transform="translate(8, -8)" style="pointer-events:none;">
              <circle cx="0" cy="0" r="6" fill="var(--color-express)" />
              <text x="0" y="2" fill="#fff" font-size="7" font-weight="900" text-anchor="middle">!</text>
            </g>
          ` : ''}
        </g>
      `;
    });

    return html;
  }

  render(state) {
    if (!state) return;
    const { buses, activeStationId, favorites, boardingRequests } = state;
    
    const boardingBellsStr = (boardingRequests || []).join(',');
    const favoritesStr = (favorites || []).join(',');

    // Identify active routes crossing active station
    const activeRoutes = activeStationId 
      ? ROUTES.filter(route => route.stations.includes(activeStationId))
      : [];

    // If SVG frame is not built or active station changed, rebuild static layers
    if (this.lastActiveStationId !== activeStationId || !this.svgBuilt || !this.container.querySelector('svg')) {
      this.lastActiveStationId = activeStationId;
      this.svgBuilt = true;

      this.container.innerHTML = `
        <svg class="svg-map-element" viewBox="0 0 1000 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <!-- Background Grid Layer -->
          <g id="map-grid-layer">
            ${this.renderGridPattern()}
          </g>

          <!-- Route Paths Layer -->
          <g id="map-paths-layer">
            ${this.renderRouteLines(activeRoutes)}
          </g>

          <!-- Buses Layer -->
          <g id="map-buses-layer"></g>

          <!-- Station Hubs Layer -->
          <g id="map-stations-layer"></g>
        </svg>
      `;

      // Cache layer references
      this.busesLayer = this.container.querySelector('#map-buses-layer');
      this.stationsLayer = this.container.querySelector('#map-stations-layer');
    }

    // 1. Redraw Station nodes (only when favorites, active station focus, or reservations change)
    if (
      this.lastStationsRenderedActiveId !== activeStationId ||
      this.lastStationsRenderedBells !== boardingBellsStr ||
      this.lastStationsRenderedFavs !== favoritesStr ||
      !this.stationsLayer ||
      !this.stationsLayer.innerHTML
    ) {
      this.lastStationsRenderedActiveId = activeStationId;
      this.lastStationsRenderedBells = boardingBellsStr;
      this.lastStationsRenderedFavs = favoritesStr;
      
      if (this.stationsLayer) {
        this.stationsLayer.innerHTML = this.renderStationNodes(favorites, boardingRequests);

        // Re-bind click listeners on station node elements
        const stationNodes = this.container.querySelectorAll('.map-station-node');
        stationNodes.forEach(node => {
          node.addEventListener('click', (e) => {
            const stationId = e.target.dataset.id;
            this.onSelectStation(stationId);
          });
        });
      }
    }

    // 2. Redraw live moving buses (always redraw every 100ms to update progress coords)
    if (this.busesLayer) {
      this.busesLayer.innerHTML = this.renderBuses(buses, boardingRequests);
    }
  }
}

/* ==========================================
   LIVE METROBUS - MAIN APP ORCHESTRATOR
   Integrates local storage favorite caching,
   orchestrates UI component updates, and routes
   live simulation ticks.
   ========================================== */

import { transitEngine } from './services/transitEngine.js';
import { StationList } from './components/StationList.js';
import { ArrivalBoard } from './components/ArrivalBoard.js';
import { RouteMap } from './components/RouteMap.js';
import { ControlPanel } from './components/ControlPanel.js';
import { StatWidget } from './components/StatWidget.js';
import { initPanelResizers } from './panelResizer.js';

class App {
  constructor() {
    // 1. Initialize State
    this.activeStationId = 'STN-101'; // Default: Seoul Station (수도권 최대 허브)
    this.favorites = this.loadFavorites();
    
    // 2. Instantiate Components
    this.stationList = new StationList(
      'station-list-container',
      (id) => this.setActiveStationId(id),
      (id) => this.toggleFavoriteStation(id)
    );
    
    this.arrivalBoard = new ArrivalBoard(
      'arrival-board-container',
      this.activeStationId,
      (id) => this.toggleFavoriteStation(id)
    );
    
    this.routeMap = new RouteMap(
      'route-map-container',
      this.activeStationId,
      (id) => this.setActiveStationId(id)
    );
    
    this.controlPanel = new ControlPanel('control-panel-container');
    this.statWidget = new StatWidget('stat-widget-container');

    // 3. Setup Global UI Events
    this.setupGlobalEvents();
    
    // 4. Subscribe to Real-Time Simulation Engine Ticks
    transitEngine.subscribe((engineState) => this.handleEngineTick(engineState));
    
    // 5. Start Header Clock
    this.startClock();
  }

  // Load favorites from LocalStorage
  loadFavorites() {
    try {
      const saved = localStorage.getItem('metrobus_fav_stations');
      return saved ? JSON.parse(saved) : ['STN-101', 'STN-106']; // Pre-populate some favorites
    } catch (e) {
      return ['STN-101', 'STN-106'];
    }
  }

  // Save favorites to LocalStorage
  saveFavorites() {
    try {
      localStorage.setItem('metrobus_fav_stations', JSON.stringify(this.favorites));
    } catch (e) {
      console.error('Failed to save favorites to localStorage:', e);
    }
  }

  // State Mutator: Change focused station
  setActiveStationId(stationId) {
    this.activeStationId = stationId;
    this.updateUI();
  }

  // State Mutator: Toggle bookmarks
  toggleFavoriteStation(stationId) {
    const index = this.favorites.indexOf(stationId);
    if (index === -1) {
      this.favorites.push(stationId);
    } else {
      this.favorites.splice(index, 1);
    }
    this.saveFavorites();
    this.updateUI();
  }

  // Orchestrate data merges and component redrawing on engine ticks
  handleEngineTick(engineState) {
    this.latestEngineState = engineState;
    this.updateUI();
  }

  // Master UI Redraw orchestrator
  updateUI() {
    if (!this.latestEngineState) return;

    // Combine local states with engine state
    const unifiedState = {
      ...this.latestEngineState,
      activeStationId: this.activeStationId,
      favorites: this.favorites
    };

    // Redraw all components
    this.stationList.render(unifiedState);
    this.arrivalBoard.render(unifiedState);
    this.routeMap.render(unifiedState);
    this.controlPanel.render(unifiedState);
    this.statWidget.render(unifiedState);
  }

  // Listen for custom system alerts (breakdowns, spawns)
  setupGlobalEvents() {
    const alertBanner = document.getElementById('alert-banner');
    const alertText = alertBanner.querySelector('.alert-text');
    const alertTitle = alertBanner.querySelector('.alert-title');
    const alertClose = document.getElementById('alert-close');

    window.addEventListener('transit-alert', (e) => {
      const { title, text } = e.detail;
      if (alertBanner && alertText && alertTitle) {
        alertTitle.textContent = title;
        alertText.textContent = text;
        alertBanner.classList.remove('hidden');
        
        // Auto-dismiss normal spawns in 8 seconds, keep breakdowns visible until closed
        if (title.includes('증차') || title.includes('도착')) {
          setTimeout(() => {
            alertBanner.classList.add('hidden');
          }, 8000);
        }
      }
    });

    if (alertClose && alertBanner) {
      alertClose.addEventListener('click', () => {
        alertBanner.classList.add('hidden');
      });
    }
  }

  // Digital Clock loop
  startClock() {
    const timeEl = document.getElementById('system-time');
    
    const updateTime = () => {
      const d = new Date();
      const hrs = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      
      if (timeEl) {
        timeEl.innerHTML = `<i data-lucide="clock" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:6px; color:var(--color-trunk);"></i>${hrs}:${mins}:${secs}`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      }
    };
    
    updateTime();
    setInterval(updateTime, 1000);
  }
}

// Initialise App once page loads
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();

  // Initialize drag-to-resize panel resizers
  initPanelResizers();
  
  // Poll to render icons as soon as the Lucide CDN script finishes loading
  const lucideInterval = setInterval(() => {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
      clearInterval(lucideInterval);
    }
  }, 100);
  
  // Also clean up interval after 10 seconds to avoid infinite loops if offline
  setTimeout(() => clearInterval(lucideInterval), 10000);
});

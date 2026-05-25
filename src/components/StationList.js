/* ==========================================
   LIVE METROBUS - STATION LIST COMPONENT
   Handles station listing, search index filtering,
   and favorites toggling.
   ========================================== */

import { ROUTES } from '../services/transitData.js';

export class StationList {
  constructor(containerId, onSelectStation, onToggleFavorite) {
    this.container = document.getElementById(containerId);
    this.onSelectStation = onSelectStation;
    this.onToggleFavorite = onToggleFavorite;
    
    this.searchQuery = '';
    this.activeTab = 'all'; // 'all' or 'favorites'
    
    // Bind search and tab DOM events
    this.setupEvents();
  }

  setupEvents() {
    const searchInput = document.getElementById('station-search');
    const clearBtn = document.getElementById('search-clear-btn');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        if (this.searchQuery) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
        this.render(this.lastState);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearBtn.classList.add('hidden');
        this.render(this.lastState);
      });
    }

    const tabAll = document.getElementById('tab-all');
    const tabFav = document.getElementById('tab-fav');

    if (tabAll && tabFav) {
      tabAll.addEventListener('click', () => {
        tabAll.classList.add('active');
        tabFav.classList.remove('active');
        this.activeTab = 'all';
        this.render(this.lastState);
      });

      tabFav.addEventListener('click', () => {
        tabFav.classList.add('active');
        tabAll.classList.remove('active');
        this.activeTab = 'favorites';
        this.render(this.lastState);
      });
    }
  }

  // Count how many bus routes stop at this station
  getRoutesCountForStation(stationId) {
    return ROUTES.filter(route => route.stations.includes(stationId)).length;
  }

  render(state) {
    if (!state) return;
    this.lastState = state;

    const { stations, activeStationId, favorites } = state;

    // Render Guards: Check if list structure actually changed
    const favoritesStr = (favorites || []).join(',');
    if (
      this.lastRenderedQuery === this.searchQuery &&
      this.lastRenderedTab === this.activeTab &&
      this.lastRenderedFavorites === favoritesStr &&
      this.container.children.length > 0
    ) {
      // Only activeStationId changed! Toggle class instead of rebuilding HTML
      if (this.lastRenderedActiveId !== activeStationId) {
        const cards = this.container.querySelectorAll('.station-card');
        cards.forEach(card => {
          if (card.dataset.id === activeStationId) {
            card.classList.add('active');
            const nameEl = card.querySelector('.station-name');
            if (nameEl) nameEl.style.color = 'var(--color-trunk)';
          } else {
            card.classList.remove('active');
            const nameEl = card.querySelector('.station-name');
            if (nameEl) nameEl.style.color = '';
          }
        });
        this.lastRenderedActiveId = activeStationId;
      }
      return;
    }

    this.lastRenderedQuery = this.searchQuery;
    this.lastRenderedTab = this.activeTab;
    this.lastRenderedFavorites = favoritesStr;
    this.lastRenderedActiveId = activeStationId;

    // Update Favorites Badge Count
    const favCountBadge = document.getElementById('fav-count');
    if (favCountBadge) {
      favCountBadge.textContent = favorites.length;
    }

    // Filter Stations
    let filteredStations = stations;

    // Filter by Tab
    if (this.activeTab === 'favorites') {
      filteredStations = stations.filter(s => favorites.includes(s.id));
    }

    // Filter by Search Query
    if (this.searchQuery) {
      filteredStations = filteredStations.filter(s => 
        s.name.toLowerCase().includes(this.searchQuery) || 
        s.id.toLowerCase().includes(this.searchQuery)
      );
    }

    // Clear Container
    this.container.innerHTML = '';

    if (filteredStations.length === 0) {
      this.container.innerHTML = `
        <div class="no-results">
          <i data-lucide="search-slash" style="display:block; margin: 0 auto 10px auto; width:24px;"></i>
          ${this.activeTab === 'favorites' ? '즐겨찾기한 정류장이 없습니다.' : '검색 결과가 없습니다.'}
        </div>
      `;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }

    // Render Cards
    filteredStations.forEach(station => {
      const isFavorite = favorites.includes(station.id);
      const isActive = station.id === activeStationId;
      const routesCount = this.getRoutesCountForStation(station.id);

      const card = document.createElement('div');
      card.className = `station-card ${isActive ? 'active' : ''}`;
      card.dataset.id = station.id;

      card.innerHTML = `
        <div class="station-info-group">
          <div class="station-name">${station.name}</div>
          <div class="station-meta">
            <span class="station-card-id">${station.id}</span>
            <span class="station-bus-count">
              <i data-lucide="bus" style="width:10px; height:10px;"></i>
              ${routesCount}개 노선
            </span>
          </div>
        </div>
        <button class="station-card-fav-btn ${isFavorite ? 'active' : ''}" data-id="${station.id}">
          <i data-lucide="heart" style="width:14px; height:14px; fill: ${isFavorite ? 'currentColor' : 'none'}"></i>
        </button>
      `;

      // Select Card event
      card.addEventListener('click', (e) => {
        // Prevent click if clicking the heart button
        if (e.target.closest('.station-card-fav-btn')) return;
        this.onSelectStation(station.id);
      });

      // Favorite toggle event
      const favBtn = card.querySelector('.station-card-fav-btn');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onToggleFavorite(station.id);
      });

      this.container.appendChild(card);
    });

    // Refresh lucide icons for newly appended elements
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

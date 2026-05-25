/* ==========================================
   군포시 실시간 버스 - 정류장 목록 컴포넌트
   군포시 실제 정류장 데이터 기반 렌더링
   ========================================== */

import { STATIONS } from '../services/transitData.js';

export class StationList {
  constructor(containerId, onSelectStation, onToggleFavorite) {
    this.container       = document.getElementById(containerId);
    this.onSelectStation = onSelectStation;
    this.onToggleFavorite = onToggleFavorite;

    this.searchQuery = '';
    this.activeTab   = 'all';

    this.setupEvents();
  }

  setupEvents() {
    const searchInput = document.getElementById('station-search');
    const clearBtn    = document.getElementById('search-clear-btn');

    if (searchInput) {
      searchInput.addEventListener('input', e => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        clearBtn?.classList.toggle('hidden', !this.searchQuery);
        this.render(this.lastState);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery  = '';
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

  render(state) {
    if (!state) return;
    this.lastState = state;

    const { activeStationId, favorites, arrivals } = state;

    // 즐겨찾기 배지 업데이트
    const favCount = document.getElementById('fav-count');
    if (favCount) favCount.textContent = (favorites || []).length;

    // 탭/검색/즐겨찾기 변화 시 렌더링 스킵 판단
    const favsStr = (favorites || []).join(',');
    const changed =
      this.lastQuery !== this.searchQuery ||
      this.lastTab   !== this.activeTab   ||
      this.lastFavs  !== favsStr          ||
      this.container.children.length === 0;

    if (!changed) {
      // 활성 정류장만 클래스 토글
      if (this.lastActiveId !== activeStationId) {
        this.container.querySelectorAll('.station-card').forEach(card => {
          const isActive = card.dataset.id === activeStationId;
          card.classList.toggle('active', isActive);
        });
        this.lastActiveId = activeStationId;
      }
      return;
    }

    this.lastQuery    = this.searchQuery;
    this.lastTab      = this.activeTab;
    this.lastFavs     = favsStr;
    this.lastActiveId = activeStationId;

    // ── 필터링 ──────────────────────────────────────────────
    let list = STATIONS;

    if (this.activeTab === 'favorites') {
      list = list.filter(s => (favorites || []).includes(s.id));
    }

    if (this.searchQuery) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(this.searchQuery) ||
        s.id.toLowerCase().includes(this.searchQuery) ||
        (s.arsId && s.arsId.includes(this.searchQuery))
      );
    }

    this.container.innerHTML = '';

    if (list.length === 0) {
      this.container.innerHTML = `
        <div class="no-results">
          <i data-lucide="search-slash" style="display:block; margin:0 auto 10px; width:24px;"></i>
          ${this.activeTab === 'favorites' ? '즐겨찾기한 정류장이 없습니다.' : '검색 결과가 없습니다.'}
        </div>
      `;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }

    // ── 카드 렌더링 ──────────────────────────────────────────
    list.forEach(station => {
      const isFav    = (favorites || []).includes(station.id);
      const isActive = station.id === activeStationId;

      // 이 정류장의 도착 정보 수 (캐시된 것 기준)
      const arrCount = arrivals && station.id === activeStationId ? arrivals.length : 0;

      const card = document.createElement('div');
      card.className = `station-card ${isActive ? 'active' : ''}`;
      card.dataset.id = station.id;

      card.innerHTML = `
        <div class="station-info-group">
          <div class="station-name">${station.name}</div>
          <div class="station-meta">
            <span class="station-card-id">ARS ${station.arsId || station.id}</span>
            ${isActive && arrCount > 0
              ? `<span class="station-bus-count">
                   <i data-lucide="bus" style="width:10px;height:10px;"></i>
                   ${arrCount}대 운행 중
                 </span>`
              : `<span class="station-bus-count" style="color:var(--text-muted); font-size:10px;">
                   ${station.description ? station.description.substring(0, 14) + '...' : ''}
                 </span>`
            }
          </div>
        </div>
        <button class="station-card-fav-btn ${isFav ? 'active' : ''}" data-id="${station.id}" title="${isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
          <i data-lucide="heart" style="width:14px;height:14px;fill:${isFav ? 'currentColor' : 'none'}"></i>
        </button>
      `;

      card.addEventListener('click', e => {
        if (e.target.closest('.station-card-fav-btn')) return;
        this.onSelectStation(station.id);
      });

      card.querySelector('.station-card-fav-btn').addEventListener('click', e => {
        e.stopPropagation();
        this.onToggleFavorite(station.id);
      });

      this.container.appendChild(card);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

/* ==========================================
   LIVE METROBUS - STAT WIDGET COMPONENT
   Visualizes high-level transit analytics and
   boarding bell summary counts in the top header.
   ========================================== */

export class StatWidget {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(state) {
    if (!state) return;
    const { buses, boardingRequests, trafficLevel } = state;

    // Calculate dynamic stats
    const activeBusesCount = buses.length;
    const delayedBusesCount = buses.filter(b => b.isDelayed).length;
    const boardingBellsCount = boardingRequests.length;

    if (
      this.lastActive === activeBusesCount &&
      this.lastDelayed === delayedBusesCount &&
      this.lastBells === boardingBellsCount &&
      this.lastTraffic === trafficLevel &&
      this.container.children.length > 0
    ) {
      return;
    }

    this.lastActive = activeBusesCount;
    this.lastDelayed = delayedBusesCount;
    this.lastBells = boardingBellsCount;
    this.lastTraffic = trafficLevel;
    
    // Road Traffic Level localized
    let trafficLabel = '원활';
    let trafficClass = 'text-secondary';
    if (trafficLevel === 'heavy') {
      trafficLabel = '지체 서행';
      trafficClass = 'text-accent';
    } else if (trafficLevel === 'rush_hour') {
      trafficLabel = '혼잡 정체';
      trafficClass = 'text-danger';
    }

    this.container.innerHTML = `
      <!-- Widget 1: Total Buses -->
      <div class="stat-widget">
        <i data-lucide="bus"></i>
        <div class="stat-info">
          <span class="stat-value">${activeBusesCount}대</span>
          <span class="stat-label">총 운행 중인 차량</span>
        </div>
      </div>

      <!-- Widget 2: Active Stop Bells -->
      <div class="stat-widget" style="${boardingBellsCount > 0 ? 'border-color: rgba(236,72,153,0.3); background: rgba(236,72,153,0.05);' : ''}">
        <i data-lucide="bell" class="${boardingBellsCount > 0 ? 'text-danger' : ''}" style="${boardingBellsCount > 0 ? 'color:var(--color-bell) !important;' : ''}"></i>
        <div class="stat-info">
          <span class="stat-value" style="${boardingBellsCount > 0 ? 'color:var(--color-bell);' : ''}">${boardingBellsCount}건</span>
          <span class="stat-label">승차 예약 대기</span>
        </div>
      </div>

      <!-- Widget 3: Delayed buses -->
      <div class="stat-widget">
        <i data-lucide="alert-triangle" class="${delayedBusesCount > 0 ? 'text-danger' : ''}"></i>
        <div class="stat-info">
          <span class="stat-value ${delayedBusesCount > 0 ? 'text-danger' : ''}">${delayedBusesCount}대</span>
          <span class="stat-label">돌발 지연/장애</span>
        </div>
      </div>

      <!-- Widget 4: Traffic Condition -->
      <div class="stat-widget">
        <i data-lucide="gauge"></i>
        <div class="stat-info">
          <span class="stat-value ${trafficClass}">${trafficLabel}</span>
          <span class="stat-label">전체 도로 정체도</span>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

/* ==========================================
   군포시 실시간 버스 - 헤더 통계 위젯
   GBIS API 실제 데이터 기반 통계 표시
   ========================================== */

export class StatWidget {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(state) {
    if (!state) return;
    const { arrivals, boardingRequests, lastUpdated, apiKeySet } = state;

    // 통계 계산
    const arrivalCount  = (arrivals || []).length;
    const bellCount     = (boardingRequests || []).length;
    const minEta        = arrivalCount > 0
      ? Math.min(...arrivals.map(a => a.predictTime))
      : null;
    const hasLowFloor   = (arrivals || []).some(a => a.isLowFloor);

    const updatedStr = lastUpdated
      ? lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '—';

    // 변화 없으면 스킵
    if (
      this.lastArrivalCount === arrivalCount &&
      this.lastBellCount    === bellCount    &&
      this.lastMinEta       === minEta       &&
      this.lastUpdated      === updatedStr   &&
      this.container.children.length > 0
    ) {
      return;
    }

    this.lastArrivalCount = arrivalCount;
    this.lastBellCount    = bellCount;
    this.lastMinEta       = minEta;
    this.lastUpdated      = updatedStr;

    this.container.innerHTML = `
      <!-- 위젯 1: 접근 중인 버스 수 -->
      <div class="stat-widget">
        <i data-lucide="bus"></i>
        <div class="stat-info">
          <span class="stat-value">${arrivalCount > 0 ? arrivalCount + '대' : '—'}</span>
          <span class="stat-label">접근 중인 버스</span>
        </div>
      </div>

      <!-- 위젯 2: 최단 도착 시간 -->
      <div class="stat-widget" style="${minEta !== null && minEta <= 3 ? 'border-color:rgba(239,68,68,0.35); background:rgba(239,68,68,0.05);' : ''}">
        <i data-lucide="timer" style="${minEta !== null && minEta <= 3 ? 'color:var(--color-express) !important;' : ''}"></i>
        <div class="stat-info">
          <span class="stat-value" style="${minEta !== null && minEta <= 3 ? 'color:var(--color-express);' : ''}">
            ${minEta !== null ? minEta + '분' : '—'}
          </span>
          <span class="stat-label">최단 도착 예정</span>
        </div>
      </div>

      <!-- 위젯 3: 승차 예약 건수 -->
      <div class="stat-widget" style="${bellCount > 0 ? 'border-color:rgba(236,72,153,0.35); background:rgba(236,72,153,0.05);' : ''}">
        <i data-lucide="bell" style="${bellCount > 0 ? 'color:var(--color-bell) !important;' : ''}"></i>
        <div class="stat-info">
          <span class="stat-value" style="${bellCount > 0 ? 'color:var(--color-bell);' : ''}">
            ${bellCount}건
          </span>
          <span class="stat-label">승차 예약 대기</span>
        </div>
      </div>

      <!-- 위젯 4: API 갱신 시각 -->
      <div class="stat-widget" title="${apiKeySet ? 'GBIS API 연결됨' : 'API 키 미설정'}">
        <i data-lucide="${apiKeySet ? 'wifi' : 'wifi-off'}" style="${!apiKeySet ? 'color:var(--color-express) !important;' : ''}"></i>
        <div class="stat-info">
          <span class="stat-value" style="font-size:13px; ${!apiKeySet ? 'color:var(--color-express);' : ''}">
            ${apiKeySet ? updatedStr : '미연결'}
          </span>
          <span class="stat-label">${apiKeySet ? '최근 갱신 시각' : 'API 키 필요'}</span>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

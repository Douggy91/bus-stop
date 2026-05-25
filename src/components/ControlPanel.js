/* ==========================================
   군포시 실시간 버스 - 정보 갱신 컨트롤 패널
   폴링 주기 설정 및 수동 새로고침 기능
   ========================================== */

import { transitEngine } from '../services/transitEngine.js';

export class ControlPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(state) {
    if (!state) return;
    const { pollSeconds, lastUpdated, apiKeySet, isLoading } = state;

    // 최소 변화가 있을 때만 재렌더링
    const updatedStr = lastUpdated ? lastUpdated.toLocaleTimeString('ko-KR') : null;
    if (
      this.lastPollSeconds === pollSeconds &&
      this.lastUpdatedStr  === updatedStr  &&
      this.lastLoading     === isLoading   &&
      this.container.children.length > 0
    ) {
      return;
    }

    this.lastPollSeconds = pollSeconds;
    this.lastUpdatedStr  = updatedStr;
    this.lastLoading     = isLoading;

    const loadingStyle = isLoading
      ? 'opacity:0.5; pointer-events:none;'
      : '';

    this.container.innerHTML = `
      <!-- 마지막 갱신 시각 -->
      <div class="control-row">
        <div class="control-label-group">
          <span>마지막 데이터 갱신</span>
          <p>공공데이터포털 GBIS API 기준</p>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
          <span style="font-family:var(--font-display); font-size:14px; font-weight:700; color:var(--color-branch);" id="last-updated-time">
            ${updatedStr || '—'}
          </span>
          <span style="font-size:10px; color:var(--text-muted);">
            ${lastUpdated ? '기준 시각' : '아직 미조회'}
          </span>
        </div>
      </div>

      <!-- 수동 새로고침 버튼 -->
      <div class="control-row">
        <div class="control-label-group">
          <span>수동 새로고침</span>
          <p>즉시 최신 도착 정보를 조회합니다.</p>
        </div>
        <button id="refresh-btn" class="spawner-btn btn-outline" style="${loadingStyle} width:auto; padding:8px 16px; gap:6px;" ${!apiKeySet ? 'disabled' : ''}>
          <i data-lucide="${isLoading ? 'loader' : 'refresh-cw'}" style="${isLoading ? 'animation:spin 1s linear infinite;' : ''}"></i>
          ${isLoading ? '조회 중...' : '새로고침'}
        </button>
      </div>

      <!-- 자동 갱신 주기 -->
      <div class="control-row">
        <div class="control-label-group">
          <span>자동 갱신 주기</span>
          <p>정류장 선택 시 자동으로 반복 조회합니다.</p>
        </div>
        <div class="btn-pill-group">
          <button class="btn-pill-sm ${pollSeconds === 15 ? 'active' : ''}" data-poll="15">15초</button>
          <button class="btn-pill-sm ${pollSeconds === 30 ? 'active' : ''}" data-poll="30">30초</button>
          <button class="btn-pill-sm ${pollSeconds === 60 ? 'active' : ''}" data-poll="60">1분</button>
        </div>
      </div>

      <!-- API 상태 표시 -->
      <div class="control-row" style="border-top:1px solid var(--border-glass); padding-top:15px; flex-direction:column; align-items:stretch; gap:8px;">
        <div class="control-label-group" style="margin-bottom:5px;">
          <span>데이터 출처</span>
          <p>공공데이터포털 경기도 버스도착정보조회서비스</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div class="api-status-row">
            <span class="api-status-dot ${apiKeySet ? 'online' : 'offline'}"></span>
            <span style="font-size:11.5px; color:${apiKeySet ? 'var(--color-branch)' : 'var(--color-express)'};">
              API 키 ${apiKeySet ? '정상 연결' : '미설정'}
            </span>
          </div>
          <div class="api-status-row">
            <i data-lucide="map-pin" style="width:12px;height:12px;color:var(--text-muted);"></i>
            <span style="font-size:11px; color:var(--text-muted);">경기도 군포시 한정</span>
          </div>
          <div class="api-status-row">
            <i data-lucide="clock" style="width:12px;height:12px;color:var(--text-muted);"></i>
            <span style="font-size:11px; color:var(--text-muted);">실시간 · ${pollSeconds}초 자동 갱신</span>
          </div>
        </div>
      </div>
    `;

    // 수동 새로고침
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      transitEngine.refresh();
    });

    // 갱신 주기 변경
    this.container.querySelectorAll('[data-poll]').forEach(btn => {
      btn.addEventListener('click', e => {
        const secs = parseInt(e.currentTarget.dataset.poll);
        transitEngine.setPollInterval(secs);
      });
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

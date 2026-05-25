/* ==========================================
   LIVE METROBUS - SIMULATION CONTROL PANEL
   Enables live play/pause, time-speed scaling,
   traffic density edits, and emergency triggers.
   ========================================== */

import { transitEngine } from '../services/transitEngine.js';

export class ControlPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(state) {
    if (!state) return;
    const { isPaused, simulationSpeed, trafficLevel } = state;

    if (
      this.lastPaused === isPaused &&
      this.lastSpeed === simulationSpeed &&
      this.lastTraffic === trafficLevel &&
      this.container.children.length > 0 &&
      this.container.querySelector('.btn-pill-sm')
    ) {
      return;
    }

    this.lastPaused = isPaused;
    this.lastSpeed = simulationSpeed;
    this.lastTraffic = trafficLevel;

    this.container.innerHTML = `
      <!-- Time Speed row -->
      <div class="control-row">
        <div class="control-label-group">
          <span>시뮬레이션 시간 배속</span>
          <p> 실시간 버스 이동 속도를 증가시킵니다.</p>
        </div>
        <div class="btn-pill-group">
          <button class="btn-pill-sm ${isPaused ? 'active danger' : ''}" id="sim-btn-pause">
            <i data-lucide="${isPaused ? 'play' : 'pause'}" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:3px;"></i>
            ${isPaused ? '시작' : '일시정지'}
          </button>
          <button class="btn-pill-sm ${!isPaused && simulationSpeed === 1 ? 'active' : ''}" data-speed="1">1x</button>
          <button class="btn-pill-sm ${!isPaused && simulationSpeed === 2 ? 'active' : ''}" data-speed="2">2x</button>
          <button class="btn-pill-sm ${!isPaused && simulationSpeed === 5 ? 'active' : ''}" data-speed="5">5x</button>
          <button class="btn-pill-sm ${!isPaused && simulationSpeed === 10 ? 'active' : ''}" data-speed="10">10x</button>
        </div>
      </div>

      <!-- Traffic Density row -->
      <div class="control-row">
        <div class="control-label-group">
          <span>도로 교통 상황 제어</span>
          <p> 정체 시 버스 대기시간이 증가하고 만차가 늘어납니다.</p>
        </div>
        <div class="btn-pill-group">
          <button class="btn-pill-sm ${trafficLevel === 'normal' ? 'active' : ''}" data-traffic="normal">보통</button>
          <button class="btn-pill-sm ${trafficLevel === 'heavy' ? 'active' : ''}" data-traffic="heavy">정체</button>
          <button class="btn-pill-sm ${trafficLevel === 'rush_hour' ? 'active' : ''}" data-traffic="rush_hour" style="${trafficLevel === 'rush_hour' ? 'background:rgba(239, 68, 68, 0.2); color:#fca5a5; border-color:rgba(239, 68, 68, 0.4);' : ''}">출퇴근</button>
        </div>
      </div>

      <!-- Spawners & Disaster Buttons -->
      <div class="control-row" style="flex-direction: column; align-items: stretch; gap: 8px; border-top: 1px solid var(--border-glass); padding-top: 15px;">
        <div class="control-label-group" style="margin-bottom: 5px;">
          <span>실시간 교통 시나리오 연출</span>
          <p>도로 상의 갑작스러운 특수 상황을 유발하여 시스템 작동을 검증합니다.</p>
        </div>
        
        <div class="spawner-btn-group">
          <button class="spawner-btn btn-outline" id="spawn-backup-btn">
            <i data-lucide="plus-circle"></i>
            임시 증차 운행
          </button>
          <button class="spawner-btn btn-outline-danger" id="trigger-breakdown-btn">
            <i data-lucide="alert-triangle"></i>
            돌발 고장 유발
          </button>
        </div>
      </div>
    `;

    // Wire events
    // 1. Play / Pause
    const pauseBtn = document.getElementById('sim-btn-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        transitEngine.setPaused(!isPaused);
      });
    }

    // 2. Speed modifiers
    const speedBtns = this.container.querySelectorAll('[data-speed]');
    speedBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        transitEngine.setPaused(false);
        transitEngine.setSpeed(e.target.dataset.speed);
      });
    });

    // 3. Traffic Density modifiers
    const trafficBtns = this.container.querySelectorAll('[data-traffic]');
    trafficBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        transitEngine.setTraffic(e.target.dataset.traffic);
      });
    });

    // 4. Spawners
    const spawnBtn = document.getElementById('spawn-backup-btn');
    if (spawnBtn) {
      spawnBtn.addEventListener('click', () => {
        transitEngine.spawnBackupBus();
      });
    }

    const breakdownBtn = document.getElementById('trigger-breakdown-btn');
    if (breakdownBtn) {
      breakdownBtn.addEventListener('click', () => {
        transitEngine.triggerBreakdown();
      });
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

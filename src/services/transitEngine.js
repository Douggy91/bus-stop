/* ==========================================
   LIVE METROBUS - REAL-TIME TRANSIT ENGINE
   Dynamic coordinate calculations, live updates,
   and stop bell reservation controls.
   ========================================== */

import { STATIONS, ROUTES } from './transitData.js';

class TransitEngine {
  constructor() {
    this.buses = [];
    this.isPaused = false;
    this.simulationSpeed = 1; // 1x, 2x, 5x, 10x
    this.trafficLevel = 'normal'; // 'normal', 'heavy', 'rush_hour'
    
    // Boarding requests: { stationId, routeId }
    this.boardingRequests = new Set();
    
    // Event listeners
    this.listeners = [];
    
    // Seed initial buses
    this.initializeBuses();
    
    // Start tick loop (runs every 100ms)
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 100);
  }

  // Generate real-time buses
  initializeBuses() {
    let busIdCounter = 1;
    const platePrefixes = ['서울 74사', '경기 70아', '서울 70가', '경기 77바'];
    
    // Spawn 2-3 buses per route at different segments
    ROUTES.forEach(route => {
      const numBuses = 3;
      for (let i = 0; i < numBuses; i++) {
        // Distribute buses along route stations
        const startStationIndex = Math.floor((route.stations.length / numBuses) * i);
        const randomPlate = `${platePrefixes[Math.floor(Math.random() * platePrefixes.length)]} ${Math.floor(1000 + Math.random() * 9000)}`;
        
        this.buses.push({
          id: `B-${route.number}-${busIdCounter++}`,
          routeId: route.id,
          busNumber: route.number,
          plateNumber: randomPlate,
          type: route.type,
          color: route.color,
          isLowFloor: Math.random() > 0.4, // 60% are low-floor
          congestion: this.getRandomCongestion(),
          seatsRemaining: Math.floor(Math.random() * 35),
          currentStationIndex: startStationIndex,
          progress: Math.random(), // 0.0 to 1.0 progress to next station
          dwellTimeRemaining: 0,   // Stopped time at station
          dwellTimeTotal: 0,
          isDelayed: false,
          speed: 0.02 + Math.random() * 0.01, // Base progress speed per second
          isBoardingActive: false  // For passenger boarding animation
        });
      }
    });
  }

  getRandomCongestion() {
    const list = ['empty', 'moderate', 'crowded'];
    const weights = [0.4, 0.45, 0.15]; // Congestion weights
    const r = Math.random();
    if (r < weights[0]) return list[0];
    if (r < weights[0] + weights[1]) return list[1];
    return list[2];
  }

  // Register listener for UI updates
  subscribe(callback) {
    this.listeners.push(callback);
    // Initial call
    callback(this.getState());
  }

  unsubscribe(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(callback => callback(state));
  }

  getState() {
    return {
      buses: this.buses,
      isPaused: this.isPaused,
      simulationSpeed: this.simulationSpeed,
      trafficLevel: this.trafficLevel,
      boardingRequests: Array.from(this.boardingRequests),
      stations: STATIONS,
      routes: ROUTES
    };
  }

  // Control Actions
  setPaused(paused) {
    this.isPaused = paused;
    this.notify();
  }

  setSpeed(speed) {
    this.simulationSpeed = parseInt(speed) || 1;
    this.notify();
  }

  setTraffic(level) {
    this.trafficLevel = level;
    // Dynamic congestion adjustments based on traffic
    this.buses.forEach(bus => {
      if (level === 'rush_hour') {
        bus.congestion = Math.random() > 0.3 ? 'crowded' : 'moderate';
        bus.seatsRemaining = Math.floor(Math.random() * 8);
      } else if (level === 'heavy') {
        bus.congestion = Math.random() > 0.5 ? 'crowded' : 'moderate';
        bus.seatsRemaining = Math.floor(Math.random() * 18);
      } else {
        bus.congestion = this.getRandomCongestion();
        bus.seatsRemaining = Math.floor(Math.random() * 35);
      }
    });
    this.notify();
  }

  // Trigger bus breakdown event (delays a random bus)
  triggerBreakdown() {
    const activeBuses = this.buses.filter(b => !b.isDelayed);
    if (activeBuses.length === 0) return;
    
    const randomBus = activeBuses[Math.floor(Math.random() * activeBuses.length)];
    randomBus.isDelayed = true;
    randomBus.dwellTimeRemaining = 15; // Delay for 15 simulation-adjusted seconds
    randomBus.dwellTimeTotal = 15;
    
    this.notify();
    
    // Dispatch system alert event
    const event = new CustomEvent('transit-alert', {
      detail: {
        title: '차량 장애 안내',
        text: `[노선 ${randomBus.busNumber}] ${randomBus.plateNumber} 차량이 고장 및 돌발 장애로 긴급 정차 중입니다. (지연 발생)`,
        busId: randomBus.id
      }
    });
    window.dispatchEvent(event);
  }

  // Dispatch an extra backup bus
  spawnBackupBus() {
    const randomRoute = ROUTES[Math.floor(Math.random() * ROUTES.length)];
    const platePrefixes = ['서울 74사', '경기 70아', '서울 70가'];
    const randomPlate = `${platePrefixes[Math.floor(Math.random() * platePrefixes.length)]} ${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newBus = {
      id: `B-${randomRoute.number}-SPAWN-${Date.now()}`,
      routeId: randomRoute.id,
      busNumber: randomRoute.number,
      plateNumber: `${randomPlate} (임시)`,
      type: randomRoute.type,
      color: randomRoute.color,
      isLowFloor: true,
      congestion: 'empty',
      seatsRemaining: 45,
      currentStationIndex: 0,
      progress: 0.0,
      dwellTimeRemaining: 0,
      dwellTimeTotal: 0,
      isDelayed: false,
      speed: 0.025, // Quick backup
      isBoardingActive: false
    };
    
    this.buses.push(newBus);
    this.notify();

    const event = new CustomEvent('transit-alert', {
      detail: {
        title: '증차 운행 안내',
        text: `[노선 ${randomRoute.number}] 출퇴근 혼잡 완화를 위해 임시 증차 차량(${randomPlate}) 운행을 시작합니다.`,
        busId: newBus.id
      }
    });
    window.dispatchEvent(event);
  }

  // Toggle stop bell reservation (승차 예약)
  toggleBoardingRequest(stationId, routeId) {
    const key = `${stationId}:${routeId}`;
    if (this.boardingRequests.has(key)) {
      this.boardingRequests.delete(key);
    } else {
      this.boardingRequests.add(key);
    }
    this.notify();
  }

  isBoardingRequestActive(stationId, routeId) {
    return this.boardingRequests.has(`${stationId}:${routeId}`);
  }

  // Main physics engine tick loop
  tick() {
    if (this.isPaused) {
      this.lastTickTime = Date.now();
      return;
    }

    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000; // in seconds
    this.lastTickTime = now;

    // Traffic speed multiplier
    let trafficMultiplier = 1.0;
    if (this.trafficLevel === 'heavy') trafficMultiplier = 0.6;
    if (this.trafficLevel === 'rush_hour') trafficMultiplier = 0.35;

    let stateChanged = false;

    this.buses.forEach(bus => {
      const route = ROUTES.find(r => r.id === bus.routeId);
      if (!route) return;

      // 1. Bus is currently stopped at a station (Dwell Time)
      if (bus.dwellTimeRemaining > 0) {
        bus.dwellTimeRemaining -= deltaTime * this.simulationSpeed;
        
        if (bus.dwellTimeRemaining <= 0) {
          // Depart station
          bus.dwellTimeRemaining = 0;
          bus.dwellTimeTotal = 0;
          bus.isBoardingActive = false;
          bus.isDelayed = false;
          
          // Move past station
          bus.currentStationIndex = (bus.currentStationIndex + 1) % route.stations.length;
          bus.progress = 0.0;
          
          stateChanged = true;
        }
      } 
      // 2. Bus is moving between stations
      else {
        const speedFactor = route.speedFactor;
        const progressIncrement = bus.speed * speedFactor * trafficMultiplier * deltaTime * this.simulationSpeed;
        
        bus.progress += progressIncrement;
        
        if (bus.progress >= 1.0) {
          // Arrived at next station!
          bus.progress = 1.0;
          const nextStationIndex = (bus.currentStationIndex + 1) % route.stations.length;
          const nextStationId = route.stations[nextStationIndex];

          // Check if there's a boarding bell request for this route at this station
          const requestKey = `${nextStationId}:${bus.routeId}`;
          const hasBoardingRequest = this.boardingRequests.has(requestKey);

          // Configure stop duration (seconds)
          let dwellDuration = 3.0; // Base stop is 3s
          
          if (hasBoardingRequest) {
            dwellDuration = 8.0; // Increase dwell to 8s for active boarding animation
            bus.isBoardingActive = true;
            
            // Delete boarding reservation since bus has arrived and passenger is boarding!
            this.boardingRequests.delete(requestKey);
            
            // Dispatch dynamic alert
            const event = new CustomEvent('transit-alert', {
              detail: {
                title: '승차 진행 중',
                text: `[노선 ${bus.busNumber}] 차량이 예약된 정류장(${STATIONS.find(s => s.id === nextStationId).name})에 도착하여 승차를 완료합니다.`,
                busId: bus.id
              }
            });
            window.dispatchEvent(event);
          } else {
            // Normal stop randomizes slightly
            dwellDuration = 2.0 + Math.random() * 2.0;
          }

          bus.dwellTimeRemaining = dwellDuration;
          bus.dwellTimeTotal = dwellDuration;
          stateChanged = true;
        }
      }
    });

    // Always notify because bus coordinates update continuously for 60fps mapping!
    this.notify();
  }

  // Calculate Real-time arrivals for a specific station
  getArrivalsForStation(stationId) {
    const arrivals = [];

    this.buses.forEach(bus => {
      const route = ROUTES.find(r => r.id === bus.routeId);
      if (!route) return;

      // Check if this route stops at the requested station
      const stationRouteIndex = route.stations.indexOf(stationId);
      if (stationRouteIndex === -1) return; // This bus route doesn't stop here

      // Locate the bus relative to this station
      const busIndex = bus.currentStationIndex;
      
      // Calculate how many stops away the bus is
      let stopsAway = stationRouteIndex - busIndex;
      
      // Since it's a loop, if the bus has already passed the station in its sequence, 
      // it has to travel the full loop back.
      if (stopsAway < 0 || (stopsAway === 0 && bus.progress > 0 && bus.dwellTimeRemaining === 0)) {
        stopsAway += route.stations.length;
      }

      // If stopsAway is 0 and it's stopped, it is currently AT this station!
      const isAtStation = (stopsAway === 0 && bus.dwellTimeRemaining > 0);

      // Estimate travel time (in seconds)
      // Let's assume average travel time between adjacent stations is 60 seconds under normal traffic.
      let trafficMultiplier = 1.0;
      if (this.trafficLevel === 'heavy') trafficMultiplier = 1.6;
      if (this.trafficLevel === 'rush_hour') trafficMultiplier = 2.8;

      const baseTravelTimePerSegment = 50 / (bus.speed * route.speedFactor * 30); // Dynamic base per segment
      
      let etaSeconds = 0;

      if (isAtStation) {
        etaSeconds = 0;
      } else {
        // Time remaining in current segment
        const currentSegmentRemaining = 1.0 - bus.progress;
        
        // Sum total segments to reach destination
        let totalSegments = currentSegmentRemaining;
        if (stopsAway > 1) {
          totalSegments += (stopsAway - 1);
        }

        etaSeconds = totalSegments * baseTravelTimePerSegment * trafficMultiplier;
        
        // Add typical stop dwell times for intermediates (approx 3s per stop)
        if (stopsAway > 1) {
          etaSeconds += (stopsAway - 1) * 3.5;
        }
        
        // If bus is delayed/broken down, add delay time
        if (bus.isDelayed) {
          etaSeconds += bus.dwellTimeRemaining;
        }
      }

      arrivals.push({
        bus,
        route,
        stopsAway,
        etaSeconds: Math.max(0, Math.round(etaSeconds)),
        isAtStation,
        isBoardingActive: isAtStation && bus.isBoardingActive
      });
    });

    // Sort by ETA (closest first)
    return arrivals.sort((a, b) => {
      if (a.isAtStation && !b.isAtStation) return -1;
      if (!a.isAtStation && b.isAtStation) return 1;
      return a.etaSeconds - b.etaSeconds;
    });
  }

  // Get physical coordinate of a bus in 2D space for plotting on map
  getBusCoordinates(bus) {
    const route = ROUTES.find(r => r.id === bus.routeId);
    if (!route) return { x: 0, y: 0 };

    const fromStation = STATIONS.find(s => s.id === route.stations[bus.currentStationIndex]);
    const nextStationIndex = (bus.currentStationIndex + 1) % route.stations.length;
    const toStation = STATIONS.find(s => s.id === route.stations[nextStationIndex]);

    if (!fromStation || !toStation) return { x: 0, y: 0 };

    // Linear interpolation based on progress (with smooth easing for nice visual transit)
    // Formula: coord = from + progress * (to - from)
    const t = bus.progress;
    // Simple sine ease-in-out for smooth bus braking and acceleration!
    const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const x = fromStation.x + easeT * (toStation.x - fromStation.x);
    const y = fromStation.y + easeT * (toStation.y - fromStation.y);

    return { x, y };
  }
}

// Singleton global instance
export const transitEngine = new TransitEngine();
window.transitEngine = transitEngine; // For easy dev debugging

/**
 * server.js — 군포시 실시간 버스 정보 시스템 프록시 서버
 *
 * 역할:
 *  1. 정적 파일(HTML/CSS/JS) 서빙
 *  2. 브라우저 CORS 문제 해결을 위한 GBIS API 프록시
 *  3. API 인증키를 서버 측에서만 보관 (.env)
 *
 * 실행: node server.js
 * 접속: http://localhost:3001
 */

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const SERVICE_KEY = process.env.GBIS_SERVICE_KEY;

const GBIS_BASE = 'http://apis.data.go.kr/6410000';

// ── 정적 파일 서빙 ──────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── API 키 유효성 미들웨어 ───────────────────────────────────
app.use('/api', (req, res, next) => {
  if (!SERVICE_KEY || SERVICE_KEY === '여기에_발급받은_인증키_입력') {
    return res.status(503).json({
      error: 'API_KEY_NOT_SET',
      message: '.env 파일에 GBIS_SERVICE_KEY를 설정해주세요.\n공공데이터포털(data.go.kr)에서 "경기도 버스도착정보조회서비스" 신청 후 발급받은 키를 입력하세요.'
    });
  }
  next();
});

// ── XML → JSON 파서 ──────────────────────────────────────────
async function parseGbisXml(xmlText) {
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
  return parser.parseStringPromise(xmlText);
}

// ── 공통 GBIS API 호출 함수 ──────────────────────────────────
async function callGbis(endpoint, params = {}) {
  const url = new URL(`${GBIS_BASE}/${endpoint}`);
  url.searchParams.set('serviceKey', SERVICE_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const fullUrl = url.toString();
  console.log(`[GBIS→] ${endpoint}`, params);

  const response = await fetch(fullUrl, { timeout: 10000 });
  if (!response.ok) throw new Error(`GBIS HTTP ${response.status}`);

  const text = await response.text();
  console.log(`[GBIS←] ${endpoint} (${text.length}bytes) 시작부분:`, text.substring(0, 300));

  // JSON 응답인 경우 그대로 파싱
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    return JSON.parse(text);
  }

  // XML 응답 파싱
  const parsed = await parseGbisXml(text);
  return parsed;
}

// ── 라우터: 정류소 목록 조회 ─────────────────────────────────
// GET /api/stations?keyword=26378  ← ARS번호 5자리를 keyword로 사용
app.get('/api/stations', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: 'keyword 파라미터가 필요합니다.' });

    const data = await callGbis('busstationservice/v2/getBusStationListv2', { keyword });

    // 응답 구조 정규화
    const response = data?.response;
    const msgBody = response?.msgBody || data?.msgBody;

    console.log('[stations] msgBody keys:', Object.keys(msgBody || {}));

    // 필드명 다중 시도
    const items = msgBody?.busStationList || msgBody?.BusStationList || msgBody?.item || msgBody?.items;

    if (!items) {
      console.warn('[stations] items 없음, msgBody:', JSON.stringify(msgBody).substring(0, 300));
      return res.json({ stations: [], _debug: { msgBodyKeys: Object.keys(msgBody || {}) } });
    }

    // 단일 항목일 경우 배열로 감싸기
    const list = Array.isArray(items) ? items : [items];

    console.log(`[stations] keyword="${keyword}" → ${list.length}개 결과`);
    if (list.length > 0) {
      console.log('[stations] 첫 번째 항목 전체:', JSON.stringify(list[0]));
    }

    const stations = list.map(s => ({
      stationId:   s.stationId,   // GBIS 내부 ID (도착 API에 사용)
      stationName: s.stationName,
      arsId:       s.stationId,   // 주의: API에 따라 mobileNo 등 별도 필드일 수 있음
      mobileNo:    s.mobileNo,    // ARS 표시번호 (정류소 표지판 번호)
      x: parseFloat(s.x) || 0,
      y: parseFloat(s.y) || 0,
      districtCd:  s.districtCd,
      regionName:  s.regionName,
    }));

    res.json({ stations });
  } catch (err) {
    console.error('[/api/stations]', err.message);

    res.status(500).json({ error: err.message });
  }
});

// ── 라우터: 버스 도착 정보 조회 ─────────────────────────────
// GET /api/arrivals?stationId=26054
app.get('/api/arrivals', async (req, res) => {
  try {
    const { stationId } = req.query;
    if (!stationId) return res.status(400).json({ error: 'stationId 파라미터가 필요합니다.' });

    const data = await callGbis('busarrivalservice/v2/getBusArrivalListv2', { stationId });

    // ── 응답 구조 탐색 (다양한 중첩 패턴 처리) ──
    // 경기도 GBIS API는 버전마다 응답 구조가 다를 수 있음
    const response = data?.response;
    const msgHeader = response?.msgHeader || data?.msgHeader;
    const msgBody = response?.msgBody || data?.msgBody;
    const resultCode = String(msgHeader?.resultCode ?? '0');

    console.log('[arrivals] resultCode:', resultCode,
      'resultMessage:', msgHeader?.resultMessage);
    console.log('[arrivals] msgBody keys:', Object.keys(msgBody || {}));

    if (resultCode !== '0') {
      return res.json({
        arrivals: [],
        _debug: { resultCode, message: msgHeader?.resultMessage, rawKeys: Object.keys(data || {}) }
      });
    }

    // 필드명이 API 버전에 따라 다를 수 있으므로 여러 이름 시도
    const items =
      msgBody?.busArrivalList ||
      msgBody?.BusArrivalList ||
      msgBody?.item ||
      msgBody?.items;

    console.log('[arrivals] items type:', typeof items, Array.isArray(items) ? `length=${items.length}` : '');
    if (items && !Array.isArray(items)) {
      console.log('[arrivals] single item keys:', Object.keys(items));
      console.log('[arrivals] single item sample:', JSON.stringify(items).substring(0, 400));
    } else if (Array.isArray(items) && items.length > 0) {
      console.log('[arrivals] first item keys:', Object.keys(items[0]));
      console.log('[arrivals] first item sample:', JSON.stringify(items[0]).substring(0, 400));
    }

    if (!items) {
      return res.json({
        arrivals: [],
        _debug: { note: 'items가 없음', msgBodyKeys: Object.keys(msgBody || {}) }
      });
    }

    const list = Array.isArray(items) ? items : [items];

    const arrivals = list.map(a => ({
      routeId: a.routeId,
      routeName: a.routeName,
      flag: a.flag,
      locationNo1: parseInt(a.locationNo1) || 0,
      predictTime1: parseInt(a.predictTime1) || 0,
      plateNo1: a.plateNo1 || '',
      locationNo2: parseInt(a.locationNo2) || 0,
      predictTime2: parseInt(a.predictTime2) || 0,
      plateNo2: a.plateNo2 || '',
      lowPlate1: a.lowPlate1 === '1',
      lowPlate2: a.lowPlate2 === '1',
      congestion1: a.congestion1 || '0',
      congestion2: a.congestion2 || '0',
      staOrder: parseInt(a.staOrder) || 0,
      routeTypeCd: a.routeTypeCd || '13',
    }));

    res.json({ arrivals });
  } catch (err) {
    console.error('[/api/arrivals] ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 라우터: 노선 정보 조회 ────────────────────────────────────
// GET /api/route?routeId=200000038
app.get('/api/route', async (req, res) => {
  try {
    const { routeId } = req.query;
    if (!routeId) return res.status(400).json({ error: 'routeId 파라미터가 필요합니다.' });

    const data = await callGbis('busrouteservice/v2/getBusRouteInfoItemv2', { routeId });

    const response = data?.response;
    const msgBody = response?.msgBody || data?.msgBody;
    const item = msgBody?.busRouteInfoItem;

    if (!item) {
      return res.json({ route: null });
    }

    res.json({
      route: {
        routeId: item.routeId,
        routeName: item.routeName,
        routeTypeCd: item.routeTypeCd,
        startStationName: item.startStationName,
        endStationName: item.endStationName,
        districtCd: item.districtCd,
      }
    });
  } catch (err) {
    console.error('[/api/route]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 라우터: 노선의 정류소 목록 조회 ──────────────────────────
// GET /api/route-stations?routeId=200000038
app.get('/api/route-stations', async (req, res) => {
  try {
    const { routeId } = req.query;
    if (!routeId) return res.status(400).json({ error: 'routeId 파라미터가 필요합니다.' });

    const data = await callGbis('busrouteservice/v2/getBusRouteStationListv2', { routeId });

    const response = data?.response;
    const msgBody = response?.msgBody || data?.msgBody;
    const items = msgBody?.busRouteStationList;

    if (!items) return res.json({ stations: [] });

    const list = Array.isArray(items) ? items : [items];
    const stations = list.map(s => ({
      stationId: s.stationId,
      stationName: s.stationName,
      stationSeq: parseInt(s.stationSeq) || 0,
      x: parseFloat(s.x) || 0,
      y: parseFloat(s.y) || 0,
    }));

    res.json({ stations });
  } catch (err) {
    console.error('[/api/route-stations]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 헬스 체크 ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeySet: !!(SERVICE_KEY && SERVICE_KEY !== '여기에_발급받은_인증키_입력'),
    timestamp: new Date().toISOString()
  });
});

// ── [DEBUG] 원시 API 응답 덤프 ─────────────────────────────
// GET /api/debug/arrivals?stationId=26054
// 파싱 없이 GBIS 원본 응답 전체를 그대로 반환 (디버깅 전용)
app.get('/api/debug/arrivals', async (req, res) => {
  try {
    const { stationId = '26054' } = req.query;
    const url = new URL(`${GBIS_BASE}/busarrivalservice/v2/getBusArrivalListv2`);
    url.searchParams.set('serviceKey', SERVICE_KEY);
    url.searchParams.set('stationId', stationId);

    const response = await fetch(url.toString(), { timeout: 10000 });
    const rawText = await response.text();

    let parsed = null;
    let parseError = null;
    try {
      if (rawText.trim().startsWith('<')) {
        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
        parsed = await parser.parseStringPromise(rawText);
      } else {
        parsed = JSON.parse(rawText);
      }
    } catch (e) {
      parseError = e.message;
    }

    res.json({
      stationId,
      httpStatus: response.status,
      rawLength: rawText.length,
      rawFirst500: rawText.substring(0, 500),
      parsed,
      parseError,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── [DEBUG] 원시 API 응답 덤프 (정류소 목록) ───────────────
// GET /api/debug/stations?keyword=군포
app.get('/api/debug/stations', async (req, res) => {
  try {
    const { keyword = '군포' } = req.query;
    const url = new URL(`${GBIS_BASE}/busstationservice/v2/getBusStationListv2`);
    url.searchParams.set('serviceKey', SERVICE_KEY);
    url.searchParams.set('keyword', keyword);

    const response = await fetch(url.toString(), { timeout: 10000 });
    const rawText = await response.text();

    let parsed = null;
    try {
      if (rawText.trim().startsWith('<')) {
        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
        parsed = await parser.parseStringPromise(rawText);
      } else {
        parsed = JSON.parse(rawText);
      }
    } catch (e) { /* 무시 */ }

    res.json({ keyword, httpStatus: response.status, rawFirst500: rawText.substring(0, 500), parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── 서버 시작 ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚌 군포시 실시간 버스 정보 시스템`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
  if (!SERVICE_KEY || SERVICE_KEY === '여기에_발급받은_인증키_입력') {
    console.log(`⚠️  경고: .env 파일의 GBIS_SERVICE_KEY가 설정되지 않았습니다.`);
    console.log(`   data.go.kr에서 "경기도 버스도착정보조회서비스" 신청 후 키를 입력하세요.`);
  } else {
    console.log(`🔑 API 키 확인됨 (${SERVICE_KEY.substring(0, 8)}...)`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

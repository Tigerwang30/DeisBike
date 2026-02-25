/**
 * LINKA API connectivity test
 * Tests read-only + command endpoints for Leo2 lock, bike ID 5000.
 *
 * Run from the server/ directory:
 *   node test-linka.js
 */

import 'dotenv/config';

const BASE       = process.env.LINKA_API_BASE_URL || 'https://app.linkalock.com/api/merchant_api';
const TOKEN      = process.env.LINKA_ACCESS_TOKEN;
const USER_ID    = process.env.LINKA_USER_ID;
const LOCK_TOKEN = process.env.LINKA_LOCK_TOKEN;
const MAC_ADDR   = process.env.LINKA_MAC_ADDR;
const BIKE_ID    = '5000';

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Auth-Token': TOKEN,
  'X-User-Id':    USER_ID,
  'Origin':       'https://fleetview.linkalock.com',
  'Referer':      'https://fleetview.linkalock.com/',
};

// Body format discovered from FleetView Network tab
const COMMAND_BODY = {
  access_token:     LOCK_TOKEN,
  mac_addr:         MAC_ADDR,
  schedule:         true,
  firmware_version: '2.6.15',
  smartkey_mac:     ''
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const url = `${BASE}${path}`;
  const opts = { method, headers: HEADERS };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const qs = body && method === 'GET' ? '?' + new URLSearchParams(body).toString() : '';

  process.stdout.write(`  ${method} ${url}${qs}\n       → `);
  try {
    const res  = await fetch(url + qs, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }

    const icon = res.ok ? '✓' : (res.status === 401 || res.status === 403) ? '🔑' : '✗';
    console.log(`${icon} ${res.status} ${res.statusText}`);
    if (typeof data === 'object') {
      console.log('       response:', JSON.stringify(data, null, 2).replace(/\n/g, '\n       '));
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.log(`ERR ${err.message}`);
    return { ok: false, error: err.message };
  }
}

const get  = (path, params) => request('GET',  path, params);
const post = (path, body)   => request('POST', path, body);

// ── test suite ────────────────────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(70));
  console.log(' LINKA API test — app.linkalock.com — Leo2 Pro, bike ID', BIKE_ID);
  console.log('='.repeat(70));
  console.log(' Base URL    :', BASE);
  console.log(' X-Auth-Token:', TOKEN      ? `${TOKEN.slice(0, 8)}...`      : '(not set ❌)');
  console.log(' X-User-Id   :', USER_ID    ? `${USER_ID.slice(0, 8)}...`    : '(not set ❌)');
  console.log(' Lock Token  :', LOCK_TOKEN ? `${LOCK_TOKEN.slice(0, 8)}...` : '(not set ❌)');
  console.log(' MAC Address :', MAC_ADDR   || '(not set ❌)');
  console.log('='.repeat(70));

  // -------------------------------------------------------------------
  // 1. Status / info — try both GET (query params) and POST (body)
  // -------------------------------------------------------------------
  console.log('\n[1] Get device status');
  await get('/device_status', { device_id: BIKE_ID });
  await get('/get_device',    { device_id: BIKE_ID });
  await get('/lock_status',   { device_id: BIKE_ID });
  await get('/device_status/' + BIKE_ID, {});
  await get('/devices/' + BIKE_ID, {});

  // -------------------------------------------------------------------
  // 2. Unlock (will actually unlock the bike!)
  // -------------------------------------------------------------------
  console.log('\n[2] Unlock command — POST (will actually unlock the bike!)');
  await post('/command_unlock', COMMAND_BODY);

  // -------------------------------------------------------------------
  // 3. Lock (will actually lock the bike!)
  // -------------------------------------------------------------------
  console.log('\n[3] Lock command — POST (will actually lock the bike!)');
  await post('/command_lock', COMMAND_BODY);

  console.log('\n' + '='.repeat(70));
  console.log(' Legend: ✓ success  🔑 auth error (wrong creds)  ✗ not found / error');
  console.log('\n If [2] and [3] return ✓, the integration is working.');
  console.log('='.repeat(70));
}

run().catch(console.error);

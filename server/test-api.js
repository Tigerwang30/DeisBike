/**
 * End-to-end lock test through the DeisBikes server API
 * Tests: dev login → open (unlock) → lock
 *
 * Run from the server/ directory (server must be running on port 3001):
 *   node test-api.js
 */

const BASE   = 'http://localhost:3001';
const BIKE_ID = '5000';

// ── helpers ──────────────────────────────────────────────────────────────────

let cookie = '';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
    redirect: 'manual'
  };
  if (body) opts.body = JSON.stringify(body);

  const url = `${BASE}${path}`;
  process.stdout.write(`  ${method} ${path}\n       → `);

  const res = await fetch(url, opts);

  // Capture session cookie
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  // Follow redirect manually so we keep the cookie
  if (res.status === 302) {
    const location = res.headers.get('location');
    console.log(`302 → ${location}`);
    return { ok: true, status: 302, redirectTo: location };
  }

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 200); }

  const icon = res.ok ? '✓' : '✗';
  console.log(`${icon} ${res.status} ${res.statusText}`);
  if (data && typeof data === 'object') {
    console.log('       ', JSON.stringify(data, null, 2).replace(/\n/g, '\n        '));
  }
  return { ok: res.ok, status: res.status, data };
}

const get  = (path)       => request('GET',  path, null);
const post = (path, body) => request('POST', path, body);

// ── test ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(60));
  console.log(' DeisBikes API lock test — bike ID', BIKE_ID);
  console.log(' Server:', BASE);
  console.log('='.repeat(60));

  // Step 1: Dev login (creates a session)
  console.log('\n[1] Dev login');
  const login = await get('/auth/dev-login');
  if (!cookie) {
    console.log('\n  ✗ No session cookie received — is the server running?\n');
    process.exit(1);
  }
  console.log('       Session cookie captured ✓');

  // Step 2: Confirm we're logged in
  console.log('\n[2] Check auth status');
  const status = await get('/auth/status');
  if (!status.data?.authenticated) {
    console.log('\n  ✗ Not authenticated after dev-login. Aborting.\n');
    process.exit(1);
  }

  // Step 3: Unlock (open) the bike — if a ride is already active, lock it first to clear state
  console.log('\n[3] Open (unlock) bike', BIKE_ID);
  let openRes = await post('/api/command', { action: 'open', bikeId: BIKE_ID });
  if (!openRes.ok && openRes.data?.sessionId) {
    console.log('       Active ride found — locking it first to reset state...');
    await post('/api/command', { action: 'lock', sessionId: openRes.data.sessionId });
    console.log('\n[3b] Retrying unlock...');
    openRes = await post('/api/command', { action: 'open', bikeId: BIKE_ID });
  }
  if (!openRes.ok) {
    console.log('\n  ✗ Unlock failed. Aborting.\n');
    process.exit(1);
  }
  const sessionId = openRes.data?.sessionId;
  console.log('       sessionId:', sessionId);

  // Step 4: Lock the bike using the sessionId from above
  // Wait for the lock to finish processing the unlock command
  console.log('\n   Waiting 5 seconds before locking...');
  await new Promise(r => setTimeout(r, 5000));
  console.log('[4] Lock bike (sessionId:', sessionId, ')');
  await post('/api/command', { action: 'lock', sessionId });

  console.log('\n' + '='.repeat(60));
  console.log(' Done. Check the physical lock — it should have opened then locked.');
  console.log('='.repeat(60));
}

run().catch(err => {
  console.error('\nUnhandled error:', err.message);
  process.exit(1);
});

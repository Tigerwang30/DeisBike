/**
 * Lock test — sends a single lock command to bike 5000
 *
 * Run from the server/ directory (server must be running on port 3001):
 *   node test-lock.js
 *
 * Note: run AFTER the lock is already open (use test-unlock.js first).
 * The LINKA lock can only handle one command at a time, so wait a few
 * seconds after unlocking before locking.
 */

import 'dotenv/config';

const BASE    = 'http://localhost:3001';
const BIKE_ID = '5000';

let cookie = '';

// Send lock command directly to LINKA (fallback when server has no session)
async function directLock() {
  process.stdout.write('[3] Sending lock directly to LINKA... ');
  const res = await fetch('https://app.linkalock.com/api/merchant_api/command_lock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': process.env.LINKA_ACCESS_TOKEN,
      'X-User-Id':    process.env.LINKA_USER_ID,
      'Origin':       'https://fleetview.linkalock.com',
      'Referer':      'https://fleetview.linkalock.com/'
    },
    body: JSON.stringify({
      access_token:     process.env.LINKA_LOCK_TOKEN,
      mac_addr:         process.env.LINKA_MAC_ADDR,
      schedule:         true,
      firmware_version: '2.6.15',
      smartkey_mac:     ''
    })
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.status === 'success') {
    console.log('✓ Lock command sent!');
    console.log('   command_id:', data.data?.command_id);
  } else {
    console.log('✗ Failed —', data.message || res.status);
  }
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
    redirect: 'manual'
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  if (res.status === 302) return { ok: true, status: 302 };

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function run() {
  console.log('='.repeat(50));
  console.log(' Lock test — bike', BIKE_ID);
  console.log('='.repeat(50));

  // Login
  process.stdout.write('\n[1] Logging in... ');
  await request('GET', '/auth/dev-login');
  if (!cookie) { console.log('✗ No session — is the server running?'); process.exit(1); }
  console.log('✓');

  // Find the active session
  process.stdout.write('[2] Looking for active ride session... ');
  const sessionRes = await request('POST', '/api/command', { action: 'active_session' });
  const session = sessionRes.data?.session;

  if (!session) {
    console.log('✗ No active session in server — sending lock directly to LINKA...');
    await directLock();
    console.log('\n' + '='.repeat(50));
    return;
  }
  console.log('✓');
  console.log('       Session ID:', session.sessionId);

  // Lock — retry up to 5 times if a previous command is still in progress
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000; // ms
  let res;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    process.stdout.write(`[3] Sending lock command (attempt ${attempt}/${MAX_RETRIES})... `);
    res = await request('POST', '/api/command', { action: 'lock', sessionId: session.sessionId });

    if (res.ok) {
      console.log('✓ Locked!');
      console.log('\n   Duration:', res.data.duration, 'minutes');
      console.log('   Message :', res.data.message);
      break;
    }

    const err = res.data?.error || '';
    console.log('✗ Failed —', err);

    if (attempt < MAX_RETRIES && err.includes('Another command')) {
      console.log(`   Waiting ${RETRY_DELAY / 1000}s for the lock to finish the previous command...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    } else if (attempt === MAX_RETRIES) {
      console.log('\n   Falling back to direct LINKA command...');
      await directLock();
    }
  }

  console.log('\n' + '='.repeat(50));
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });

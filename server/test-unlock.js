/**
 * Unlock test — sends a single open command to bike 5000
 *
 * Run from the server/ directory (server must be running on port 3001):
 *   node test-unlock.js
 */

const BASE    = 'http://localhost:3001';
const BIKE_ID = '5000';

let cookie = '';

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
  console.log(' Unlock test — bike', BIKE_ID);
  console.log('='.repeat(50));

  // Login
  process.stdout.write('\n[1] Logging in... ');
  await request('GET', '/auth/dev-login');
  if (!cookie) { console.log('✗ No session — is the server running?'); process.exit(1); }
  console.log('✓');

  // Unlock
  process.stdout.write('[2] Sending unlock command... ');
  const res = await request('POST', '/api/command', { action: 'open', bikeId: BIKE_ID });

  if (res.ok) {
    console.log('✓ Unlocked!');
    console.log('\n   Session ID:', res.data.sessionId);
    console.log('   Message   :', res.data.message);
  } else {
    console.log('✗ Failed');
    console.log('\n   Error:', res.data?.error || res.status);
  }

  console.log('\n' + '='.repeat(50));
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });

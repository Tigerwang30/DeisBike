"""
Email magic link auth tests — matches tests/test_api.py style.

Usage:
    # Requires server running on port 3001
    python tests/test_auth_email.py

    # Against a different target
    BASE_URL=http://localhost:3001 python tests/test_auth_email.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = os.getenv("BASE_URL", "http://localhost:3001")
PASS = 0
FAIL = 0


def req(method, path, body=None, cookie=None, follow_redirects=False):
    url = f"{BASE_URL}{path}"
    payload = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=payload, method=method)
    r.add_header("Content-Type", "application/json")
    if cookie:
        r.add_header("Cookie", cookie)
    try:
        opener = urllib.request.build_opener()
        if not follow_redirects:
            opener = urllib.request.build_opener(
                urllib.request.HTTPRedirectHandler()
            )
            # Disable redirect following by raising on 3xx
            class NoRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, headers, newurl):
                    return None
            opener = urllib.request.build_opener(NoRedirect)

        with opener.open(r, timeout=10) as resp:
            raw = resp.read()
            data = json.loads(raw) if raw else {}
            return resp.status, data, resp.headers
    except urllib.error.HTTPError as e:
        try:
            data = json.loads(e.read())
        except Exception:
            data = {"error": str(e)}
        return e.code, data, e.headers
    except Exception as e:
        return None, {"error": str(e)}, {}


def get(path, cookie=None, follow_redirects=False):
    return req("GET", path, cookie=cookie, follow_redirects=follow_redirects)


def post(path, body=None, cookie=None):
    return req("POST", path, body=body, cookie=cookie)


def check(label, status, data, expected=200):
    global PASS, FAIL
    if status is None:
        print(f"  [FAIL] {label}: CONNECTION ERROR — {data.get('error', '?')}")
        FAIL += 1
        return False
    ok = status == expected
    icon = "PASS" if ok else "FAIL"
    snippet = json.dumps(data)[:120]
    print(f"  [{icon}] {label}: HTTP {status} — {snippet}")
    if ok:
        PASS += 1
    else:
        FAIL += 1
    return ok


def check_multi(label, status, data, expected_statuses):
    """Pass if status is any of the expected values."""
    global PASS, FAIL
    if status is None:
        print(f"  [FAIL] {label}: CONNECTION ERROR — {data.get('error', '?')}")
        FAIL += 1
        return False
    ok = status in expected_statuses
    icon = "PASS" if ok else "FAIL"
    snippet = json.dumps(data)[:120]
    expected_str = " or ".join(str(s) for s in expected_statuses)
    print(f"  [{icon}] {label}: HTTP {status} (expected {expected_str}) — {snippet}")
    if ok:
        PASS += 1
    else:
        FAIL += 1
    return ok


# ── Tests ─────────────────────────────────────────────────────────────────────

print(f"\n=== DeisBike Email Auth Tests ===")
print(f"Target: {BASE_URL}\n")


# ── [1] Non-brandeis email is rejected ───────────────────────────────────────
print("[1] POST /auth/request-link — non-brandeis email rejected")
status, data, _ = post("/auth/request-link", body={"email": "hacker@gmail.com"})
ok = check("gmail.com → 400", status, data, expected=400)
if ok:
    detail = data.get("detail", "")
    if "brandeis.edu" in detail.lower():
        print(f"       ✓ Error message mentions brandeis.edu: {detail[:80]}")
    else:
        print(f"       ? No brandeis mention in detail: {detail[:80]}")


# ── [2] Empty email is rejected ───────────────────────────────────────────────
print("\n[2] POST /auth/request-link — empty email rejected")
status, data, _ = post("/auth/request-link", body={"email": ""})
check("empty email → 400", status, data, expected=400)


# ── [3] Missing email field is rejected ───────────────────────────────────────
print("\n[3] POST /auth/request-link — missing email field rejected")
status, data, _ = post("/auth/request-link", body={})
check("no email field → 400", status, data, expected=400)


# ── [4] Valid brandeis email: 200 or 502 (SMTP may not be configured) ─────────
print("\n[4] POST /auth/request-link — valid brandeis email")
print("     (Accepts 200 if SMTP is configured, 502 if not)")
status, data, _ = post("/auth/request-link", body={"email": "testuser@brandeis.edu"})
check_multi("testuser@brandeis.edu → 200 or 502", status, data, expected_statuses=[200, 502])


# ── [5] Rate limit: same email twice in quick succession → 429 ────────────────
print("\n[5] Rate limit — two requests within 60s")
# Use a fresh unique-ish email to avoid leftover state from test 4
rl_email = "ratelimit_test@brandeis.edu"
post("/auth/request-link", body={"email": rl_email})   # first (may succeed or 502)
status, data, _ = post("/auth/request-link", body={"email": rl_email})  # second immediately
check("second request within 60s → 429", status, data, expected=429)


# ── [6] GET /auth/verify — invalid token → redirect to /login?error=invalid_link
print("\n[6] GET /auth/verify — invalid token redirects to error page")
status, data, headers = get("/auth/verify?token=this_is_a_fake_token_that_does_not_exist")
if status == 302:
    location = headers.get("Location", headers.get("location", ""))
    if "invalid_link" in location:
        PASS += 1
        print(f"  [PASS] invalid token → 302 to {location[:80]}")
    else:
        FAIL += 1
        print(f"  [FAIL] invalid token → 302 but Location missing 'invalid_link': {location}")
else:
    check("invalid token → 302", status, data, expected=302)


# ── [7] GET /auth/verify — missing token → 422 validation error ───────────────
print("\n[7] GET /auth/verify — missing token parameter → 422")
status, data, _ = get("/auth/verify")
check("no token param → 422", status, data, expected=422)


# ── [8] GET /auth/me — unauthenticated → 401 ─────────────────────────────────
print("\n[8] GET /auth/me — no cookie → 401")
status, data, _ = get("/auth/me")
check("/auth/me (no cookie) → 401", status, data, expected=401)


# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n=== Results: {PASS} passed, {FAIL} failed ===\n")

if FAIL > 0:
    print("Troubleshooting tips:")
    print("  - CONNECTION ERROR → Is the server running? Try: npm run dev")
    print("  - Test 4 returns 400 → Check that email_service.py exists in api/services/")
    print("  - Test 5 (rate limit) fails with 200 → _pending dict may have been cleared")
    print("    (this can happen if server restarted between tests)")
    print("  - Test 6 returns 200 instead of 302 → urllib may be following redirects;")
    print("    check that NoRedirect handler is working")
    sys.exit(1)

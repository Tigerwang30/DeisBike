"""
DeisBike API test script — works against local or Vercel deployments.

Usage:
    # Test locally (start server first: uvicorn api.index:app --reload)
    python tests/test_api.py

    # Test a Vercel deployment (replace with your actual URL)
    BASE_URL=https://deis-bike.vercel.app/login python tests/test_api.py
    BASE_URL=https://deis-bike-backend.vercel.app python tests/test_api.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
PASS = 0
FAIL = 0


def req(method, path, body=None, cookie=None):
    url = f"{BASE_URL}{path}"
    payload = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=payload, method=method)
    r.add_header("Content-Type", "application/json")
    if cookie:
        r.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
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


def get(path, cookie=None):
    return req("GET", path, cookie=cookie)


def post(path, body=None, cookie=None):
    return req("POST", path, body=body, cookie=cookie)


def check(label, status, data, expected=200):
    global PASS, FAIL
    if status is None:
        print(f"  [FAIL] {label}: CONNECTION ERROR — {data.get('error','?')}")
        FAIL += 1
        return False
    ok = status == expected
    icon = "PASS" if ok else "FAIL"
    snippet = json.dumps(data)[:100]
    print(f"  [{icon}] {label}: HTTP {status} — {snippet}")
    if ok:
        PASS += 1
    else:
        FAIL += 1
    return ok


# ── 1. Diagnostic ────────────────────────────────────────────────────────────

print(f"\n=== DeisBike API Tests ===")
print(f"Target: {BASE_URL}\n")

print("[1] Diagnostic /ping")
status, data, _ = get("/ping")
if status == 200:
    check("/ping", status, data)
    print(f"       Python: {data.get('python_version','?')[:40]}")
    print(f"       CWD:    {data.get('cwd','?')}")
    print(f"       Packages:")
    for k, v in (data.get("external_packages") or {}).items():
        mark = "ok" if v == "ok" else f"!! {v}"
        print(f"                {k}: {mark}")
    print(f"       Internal modules:")
    for k, v in (data.get("internal_modules") or {}).items():
        mark = "ok" if v == "ok" else f"!! {v}"
        print(f"                {k}: {mark}")
    print(f"       Env vars:")
    for k, v in (data.get("env_vars") or {}).items():
        print(f"                {k}: {v}")
else:
    check("/ping", status, data)
    if status == 404:
        if BASE_URL.startswith("http://localhost"):
            print("       (expected locally — /ping only works on Vercel, not uvicorn)")
        else:
            print("       !! /ping returned 404 on Vercel — Python runtime not running.")
            print("          Ensure devbranch is merged to main so Vercel redeploys.")

# ── 2. Health ─────────────────────────────────────────────────────────────────

print("\n[2] Health check")
status, data, _ = get("/health")
check("/health", status, data)

# ── 3. Auth (unauthenticated) ─────────────────────────────────────────────────

print("\n[3] Auth — unauthenticated")
status, data, _ = get("/auth/status")
check("/auth/status", status, data)

status, data, _ = get("/auth/me")
check("/auth/me → 401", status, data, expected=401)

status, data, _ = get("/api/bikes")
check("/api/bikes → 401", status, data, expected=401)

# ── 4. Dev login ──────────────────────────────────────────────────────────────

print("\n[4] Dev login (only works when NODE_ENV=development)")
print("     /auth/dev-login returns a redirect — needs a browser or cookie jar.")
print("     To test manually, open in a browser or run:")
print(f"     curl -c /tmp/cookies.txt -L '{BASE_URL}/auth/dev-login'")
print(f"     curl -b /tmp/cookies.txt '{BASE_URL}/auth/me'")

# ── 5. Summary ────────────────────────────────────────────────────────────────

print(f"\n=== Results: {PASS} passed, {FAIL} failed ===\n")

if FAIL > 0:
    print("Troubleshooting tips:")
    print("  - 404 on /ping → Python runtime not running. Ensure vercel.json is committed.")
    print("  - 404 on /health → api/index.py import error. Check /ping for details.")
    print("  - 'FAILED' internal modules → sys.path doesn't include project root.")
    print("    Fix: Add 'import sys; sys.path.insert(0, \"/var/task\")' at top of api/index.py")
    print("  - 'MISSING' packages → requirements.txt not found. Ensure it is at project root.")
    print("  - Env vars MISSING → Add them in Vercel project Settings → Environment Variables.")
    sys.exit(1)

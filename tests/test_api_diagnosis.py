"""
DeisBike API diagnostic tests — isolate api/index.py crashes (500) vs api/ping.py.

Usage:
    # Against Vercel (diagnose production crash)
    BASE_URL=https://deis-bike.vercel.app python tests/test_api_diagnosis.py

    # Against local uvicorn
    BASE_URL=http://localhost:3001 python tests/test_api_diagnosis.py

    # With Vercel deployment protection bypass
    BASE_URL=https://your-app.vercel.app VERCEL_PROTECTION_BYPASS=your-secret python3 tests/test_api_diagnosis.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
BYPASS_SECRET = os.getenv("VERCEL_PROTECTION_BYPASS")
PASS = 0
FAIL = 0


def req(method, path, body=None, cookie=None, headers=None):
    url = f"{BASE_URL}{path}"
    payload = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=payload, method=method)
    r.add_header("Content-Type", "application/json")
    if cookie:
        r.add_header("Cookie", cookie)
    if BYPASS_SECRET:
        r.add_header("x-vercel-protection-bypass", BYPASS_SECRET)
    if headers:
        for k, v in headers.items():
            r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            raw = resp.read()
            data = json.loads(raw) if raw else {}
            return resp.status, data, resp.headers
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            data = json.loads(raw) if raw else {}
        except Exception:
            data = {"error": str(e), "raw": raw.decode("utf-8", errors="replace") if raw else ""}
        return e.code, data, e.headers
    except Exception as e:
        return None, {"error": str(e)}, {}


def get(path, cookie=None, headers=None):
    return req("GET", path, cookie=cookie, headers=headers)


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
    snippet = json.dumps(data)[:100]
    print(f"  [{icon}] {label}: HTTP {status} — {snippet}")
    if ok:
        PASS += 1
    else:
        FAIL += 1
    return ok


def check_500(label, status, data, resp_headers):
    """On 500: print full details and return False; otherwise delegate to check()."""
    global FAIL
    if status is None:
        print(f"  [FAIL] {label}: CONNECTION ERROR — {data.get('error', '?')}")
        FAIL += 1
        return False
    if status != 500:
        return check(label, status, data)
    print(f"  [FAIL] {label}: HTTP 500 — FUNCTION INVOCATION FAILED")
    print(f"         Raw body: {json.dumps(data)}")
    if resp_headers:
        for h in ("content-type", "x-vercel-id", "x-vercel-error"):
            try:
                v = resp_headers.get(h)
            except Exception:
                v = None
            if v:
                print(f"         {h}: {v}")
    FAIL += 1
    return False


# ── 1. api/ping (api/ping.py - BaseHTTPRequestHandler) ────────────────────────

print(f"\n=== DeisBike API Diagnostic Tests ===")
print(f"Target: {BASE_URL}\n")

print("[1] api/ping (api/ping.py - BaseHTTPRequestHandler)")
ping_status, ping_data, _ = get("/ping")
if ping_status == 200:
    check("/ping", ping_status, ping_data)
    print(f"       Python: {ping_data.get('python_version', '?')[:50]}")
    print(f"       CWD:    {ping_data.get('cwd', '?')}")
else:
    check("/ping", ping_status, ping_data)
    if ping_status == 404 and BASE_URL.startswith("http://localhost"):
        print("       (expected locally — /ping only works on Vercel)")

# ── 2. api/index.py endpoints (FastAPI + Mangum) ──────────────────────────────

print("\n[2] api/index.py endpoints (FastAPI + Mangum)")

health_status, health_data, health_headers = get("/health")
health_ok = check_500("/health", health_status, health_data, health_headers)

if not health_ok:
    print("  [SKIP] /auth/status, /auth/me, /api/bikes — /health failed, skipping")
else:
    status, data, _ = get("/auth/status")
    check("/auth/status", status, data)

    status, data, _ = get("/auth/me")
    check("/auth/me → 401", status, data, expected=401)

    status, data, _ = get("/api/bikes")
    check("/api/bikes → 401", status, data, expected=401)

# ── 3. Header probes (if /health passed) ──────────────────────────────────────

if health_ok:
    print("\n[3] Header probes")
    check("/health (minimal)", *get("/health")[:2])
    check("/health (Accept)", *get("/health", headers={"Accept": "application/json"})[:2])
    check("/health (User-Agent)", *get("/health", headers={"User-Agent": "DeisBike-Diagnosis/1.0"})[:2])
    check("/health (Cookie)", *get("/health", cookie="auth_token=test")[:2])
else:
    print("\n[3] Header probes — skipped ( /health failed)")

# ── 4. POST test ──────────────────────────────────────────────────────────────

print("\n[4] POST /auth/status (expect 405)")
post_status, post_data, _ = post("/auth/status", body={})
check("/auth/status POST → 405", post_status, post_data, expected=405)

# ── 5. Diagnosis summary ──────────────────────────────────────────────────────

print(f"\n=== Results: {PASS} passed, {FAIL} failed ===")

if not health_ok and ping_status == 200:
    print("\nDiagnosis: /health returns 500 — crash in api/index.py ASGI/Mangum path.")
    print("  - /ping (api/ping.py) works; api/index.py (FastAPI + Mangum) crashes.")
    print("  - Consider removing Mangum and exporting only `app` for Vercel ASGI.")
elif not health_ok and ping_status != 200:
    print("\nDiagnosis: Both /ping and /health failing — check Python runtime on Vercel.")
elif health_ok:
    print("\nDiagnosis: api/index.py endpoints OK. Crash may be route-specific or intermittent.")

print()

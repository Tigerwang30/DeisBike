"""
Standalone diagnostic endpoint — NO internal imports.
Deploy this first to confirm the Python runtime works on Vercel.

Hit /ping to learn:
  - Is Python running at all?
  - What Python version?
  - What is the working directory?
  - What is in sys.path? (needed for our api.* imports to work)
  - Are all required packages installed (fastapi, mangum, httpx, etc.)?
  - Can our internal modules be imported?
"""
import json
import sys
import os
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # --- 1. Check external packages ---
        ext_packages = ["fastapi", "mangum", "httpx", "jwt", "reportlab", "dotenv"]
        ext_results = {}
        for mod in ext_packages:
            try:
                __import__(mod)
                ext_results[mod] = "ok"
            except ImportError as e:
                ext_results[mod] = f"MISSING: {e}"

        # --- 2. Check our internal modules ---
        # These require the project root to be in sys.path
        int_modules = ["api._state", "api._auth", "api._linka", "api._routes.auth"]
        int_results = {}
        for mod in int_modules:
            try:
                __import__(mod)
                int_results[mod] = "ok"
            except Exception as e:
                int_results[mod] = f"FAILED: {type(e).__name__}: {e}"

        # --- 3. Check env vars (keys only, not values) ---
        important_keys = [
            "LINKA_API_KEY", "LINKA_ACCESS_TOKEN", "LINKA_USER_ID",
            "LINKA_LOCK_TOKEN", "LINKA_MAC_ADDR", "LINKA_API_BASE_URL",
            "CLIENT_URL", "SESSION_SECRET", "NODE_ENV",
        ]
        env_present = {k: ("SET" if os.getenv(k) else "MISSING") for k in important_keys}

        body = json.dumps({
            "status":           "ok",
            "python_version":   sys.version,
            "cwd":              os.getcwd(),
            "sys_path":         sys.path,
            "external_packages": ext_results,
            "internal_modules": int_results,
            "env_vars":         env_present,
        }, indent=2)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body.encode())

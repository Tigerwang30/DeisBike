"""
Regression tests: the /auth/dev-login backdoor has been removed entirely.

The endpoint used to mint an admin session with no real authentication, gated
only on NODE_ENV=development. It is now gone, so it must 404 *even in
development mode* — the one environment where it was previously live. Auth is
now exclusively the magic-link email flow.

NODE_ENV and STORAGE_BACKEND are set before importing the app so _IS_DEV=True
and the store uses memory (no file I/O).
"""

import os

# Set before any app import so _IS_DEV=True and store uses memory (no file I/O)
os.environ["NODE_ENV"] = "development"
os.environ["STORAGE_BACKEND"] = "memory"

from fastapi.testclient import TestClient

from api.index import app

client = TestClient(app, follow_redirects=False)


def test_dev_login_is_removed_even_in_development(monkeypatch):
    """GET /auth/dev-login must 404 in development — the backdoor is gone, not just gated."""
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.delenv("DEV_PASSWORD", raising=False)
    resp = client.get("/auth/dev-login")
    assert resp.status_code == 404


def test_dev_login_password_query_still_404(monkeypatch):
    """Passing the old ?password= query param does not resurrect the endpoint."""
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.setenv("DEV_PASSWORD", "secret")
    resp = client.get("/auth/dev-login?password=secret")
    assert resp.status_code == 404


def test_magic_link_endpoint_still_present():
    """Sanity check the real auth path survived removal: /auth/status responds."""
    resp = client.get("/auth/status")
    assert resp.status_code == 200

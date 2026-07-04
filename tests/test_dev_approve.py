"""
Tests for the DEV-ONLY POST /auth/dev-approve endpoint.

On localhost a developer gets stuck at the Moodle safety-course gate
(`moodleApproved`), which is normally admin-only. This endpoint lets an
*already-authenticated* dev user self-grant that approval so the bike rental
flow can be tested end-to-end. It must:
  - grant moodleApproved AND re-issue the auth cookie (the gate reads the flag
    from the JWT cookie, not the store), and update the store record;
  - require authentication (401 otherwise);
  - 404 outside development — the guard reads NODE_ENV at request time, so
    monkeypatching NODE_ENV to "production" turns it off.

NODE_ENV and STORAGE_BACKEND are set before importing the app so the store uses
memory (no file I/O).
"""

import os

os.environ["NODE_ENV"] = "development"
os.environ["STORAGE_BACKEND"] = "memory"

import pytest
from fastapi.testclient import TestClient

from api.index import app
from api._auth import create_token, decode_token
from api.storage import get_store

client = TestClient(app, follow_redirects=False)


@pytest.fixture(autouse=True)
def _clear_store():
    store = get_store()
    if hasattr(store, "_data") and isinstance(store._data, dict):
        store._data.get("users", {}).clear()
    client.cookies.clear()
    yield


def _login(user_id="dev-1", moodle=False):
    """Seed a user in the store and mint an auth cookie for it."""
    record = {
        "id":              user_id,
        "email":           f"{user_id}@brandeis.edu",
        "displayName":     user_id,
        "photo":           None,
        "hasSignedWaiver": True,
        "moodleApproved":  moodle,
        "isAdmin":         False,
    }
    get_store().put_user(user_id, record)
    client.cookies.set("auth_token", create_token(record))
    return record


def test_dev_approve_grants_moodle_and_reissues_cookie(monkeypatch):
    monkeypatch.setenv("NODE_ENV", "development")
    _login("dev-1", moodle=False)

    resp = client.post("/auth/dev-approve")

    assert resp.status_code == 200
    assert resp.json()["nextStep"] == "/map"

    # Cookie re-issued with the live flag
    new_token = resp.cookies.get("auth_token")
    assert new_token is not None
    assert decode_token(new_token)["moodleApproved"] is True

    # Store record updated too
    assert get_store().get_user("dev-1")["moodleApproved"] is True


def test_dev_approve_requires_authentication(monkeypatch):
    monkeypatch.setenv("NODE_ENV", "development")
    resp = client.post("/auth/dev-approve")  # no cookie
    assert resp.status_code == 401


def test_dev_approve_404_in_production(monkeypatch):
    monkeypatch.setenv("NODE_ENV", "production")
    _login("dev-2", moodle=False)

    resp = client.post("/auth/dev-approve")

    assert resp.status_code == 404
    # And the store record must NOT have been changed
    assert get_store().get_user("dev-2")["moodleApproved"] is False

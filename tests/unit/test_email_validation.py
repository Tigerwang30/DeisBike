"""
Tests for email validation + the dev-only mocked-send path of
POST /auth/request-link.

Two concerns:
  1. The shared validators in api/utils/validators.py enforce a real format
     check plus the @brandeis.edu domain (the old route only did a loose
     `endswith`, so "@brandeis.edu" / "a b@brandeis.edu" slipped through).
  2. /auth/request-link always skips the real SMTP send and reports success
     (real email delivery isn't configured yet), so the login flow works in
     every environment, including where NODE_ENV isn't 'development'. A
     malformed / non-brandeis address is still rejected with 400 before any
     of that.

STORAGE_BACKEND=memory keeps the store file-free.
"""

import os

os.environ["STORAGE_BACKEND"] = "memory"

import pytest
from fastapi.testclient import TestClient

import api._routes.auth as auth_route
from api.index import app
from api.utils.validators import is_valid_email, is_brandeis_email

client = TestClient(app, follow_redirects=False)


# ── Pure validator unit tests ────────────────────────────────────────────────

@pytest.mark.parametrize("email", [
    "alice@brandeis.edu",
    "bob.smith@brandeis.edu",
    "carol@gmail.com",
])
def test_is_valid_email_accepts_well_formed(email):
    assert is_valid_email(email) is True


@pytest.mark.parametrize("email", [
    "",                       # empty
    "@brandeis.edu",          # empty local part
    "a b@brandeis.edu",       # whitespace in local part
    " alice@brandeis.edu",    # leading space
    "alice@brandeis",         # domain without a dot
    "alice.brandeis.edu",     # no @
    "alice@@brandeis.edu",    # double @
])
def test_is_valid_email_rejects_malformed(email):
    assert is_valid_email(email) is False


def test_is_brandeis_email():
    assert is_brandeis_email("alice@brandeis.edu") is True
    assert is_brandeis_email("Alice@Brandeis.EDU") is True      # case-insensitive
    assert is_brandeis_email("alice@gmail.com") is False        # wrong domain
    assert is_brandeis_email("@brandeis.edu") is False          # invalid format
    assert is_brandeis_email("a b@brandeis.edu") is False       # whitespace


# ── Route behaviour ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("email", [
    "someone@gmail.com",      # valid format, wrong domain
    "@brandeis.edu",          # empty local part (old check would have passed)
    "a b@brandeis.edu",       # whitespace (old check would have passed)
])
def test_request_link_rejects_bad_email(email):
    resp = client.post("/auth/request-link", json={"email": email})
    assert resp.status_code == 400


def test_request_link_mock_success_skips_smtp(monkeypatch):
    """With MOCK_EMAIL set, a valid brandeis email succeeds without sending."""
    monkeypatch.setenv("MOCK_EMAIL", "1")

    called = {"n": 0}

    def _boom(*args, **kwargs):
        called["n"] += 1
        raise AssertionError("send_magic_link must not be called when mocked")

    monkeypatch.setattr(auth_route, "send_magic_link", _boom)

    resp = client.post("/auth/request-link", json={"email": "dev@brandeis.edu"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body.get("mocked") is True
    assert called["n"] == 0

    # The dev response exposes a usable verify link so login can be completed
    # locally; following it mints an auth cookie.
    assert "/auth/verify?token=" in body["devLoginUrl"]
    token = body["devLoginUrl"].split("token=")[1]
    verify = client.get(f"/auth/verify?token={token}")
    assert verify.status_code == 302
    assert verify.cookies.get("auth_token") is not None


def test_request_link_always_mocked_even_with_dev_flags_off(monkeypatch):
    """Regression: valid brandeis emails must not hit real SMTP, even outside
    dev/MOCK_EMAIL (e.g. on Vercel, where NODE_ENV isn't 'development').
    Real email delivery isn't configured yet, so the auth stage must still
    succeed via the mocked devLoginUrl path."""
    monkeypatch.delenv("MOCK_EMAIL", raising=False)
    monkeypatch.setattr(auth_route, "_IS_DEV", False)

    def _boom(*args, **kwargs):
        raise AssertionError("send_magic_link must not be called")

    monkeypatch.setattr(auth_route, "send_magic_link", _boom)

    resp = client.post("/auth/request-link", json={"email": "prod@brandeis.edu"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body.get("mocked") is True
    assert "/auth/verify?token=" in body["devLoginUrl"]

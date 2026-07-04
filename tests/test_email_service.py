"""
Unit tests for send_magic_link's STARTTLS handling.

STARTTLS must stay ON by default (production safety) and be opt-out only via
SMTP_STARTTLS=false, which is what lets the plain-SMTP local catcher
(tools/smtp_capture.py) accept magic-link emails without throwing
SMTPNotSupportedError.

smtplib.SMTP is replaced with a fake that records the calls, so no real
network or TLS is involved.
"""

import smtplib

import pytest

from api.services import email_service


class _FakeSMTP:
    """Records method calls; stands in for smtplib.SMTP as a context manager."""
    last_instance = None

    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.calls = []
        _FakeSMTP.last_instance = self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def ehlo(self):
        self.calls.append("ehlo")

    def starttls(self):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user, password))

    def sendmail(self, sender, to, body):
        self.calls.append(("sendmail", to))


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    # Neutralise any real SMTP settings so tests are hermetic
    for key in ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD",
                "SMTP_FROM", "SMTP_STARTTLS", "APP_BASE_URL"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)


def test_starttls_used_by_default():
    """With no SMTP_STARTTLS set, STARTTLS is negotiated (production default)."""
    email_service.send_magic_link("alice@brandeis.edu", "tok123")
    assert "starttls" in _FakeSMTP.last_instance.calls


def test_starttls_skipped_when_disabled(monkeypatch):
    """SMTP_STARTTLS=false skips STARTTLS so a plain dev catcher works."""
    monkeypatch.setenv("SMTP_STARTTLS", "false")
    email_service.send_magic_link("bob@brandeis.edu", "tok456")
    calls = _FakeSMTP.last_instance.calls
    assert "starttls" not in calls
    assert ("sendmail", "bob@brandeis.edu") in calls


def test_no_login_without_credentials(monkeypatch):
    """login() is only called when both user and password are configured."""
    monkeypatch.setenv("SMTP_STARTTLS", "false")
    email_service.send_magic_link("carol@brandeis.edu", "tok789")
    assert not any(isinstance(c, tuple) and c[0] == "login"
                   for c in _FakeSMTP.last_instance.calls)


def test_magic_link_url_uses_app_base_url(monkeypatch):
    """The verify link embeds APP_BASE_URL and the token."""
    captured = {}
    monkeypatch.setenv("SMTP_STARTTLS", "false")
    monkeypatch.setenv("APP_BASE_URL", "http://localhost:3000")

    class _CapturingSMTP(_FakeSMTP):
        def sendmail(self, sender, to, body):
            captured["body"] = body
            super().sendmail(sender, to, body)

    monkeypatch.setattr(smtplib, "SMTP", _CapturingSMTP)
    email_service.send_magic_link("dave@brandeis.edu", "abc")
    assert "http://localhost:3000/auth/verify?token=abc" in captured["body"]

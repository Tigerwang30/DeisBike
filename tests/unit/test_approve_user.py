"""
Unit tests for the tools/approve_user.py local test helper.

Uses the in-memory store so nothing touches data/store.json.
"""

import os

os.environ["STORAGE_BACKEND"] = "memory"

import pytest

from api.storage import get_store
from tools.approve_user import approve


@pytest.fixture(autouse=True)
def _clear_store():
    # Wipe the in-memory user dict between tests (BaseStore keeps users in
    # `_users`; a MemoryStore is used here via STORAGE_BACKEND=memory).
    get_store()._users.clear()
    yield


def test_creates_new_user_fully_approved():
    rec = approve("new@brandeis.edu")
    assert rec["email"] == "new@brandeis.edu"
    assert rec["hasSignedWaiver"] is True
    assert rec["moodleApproved"] is True
    assert rec["isAdmin"] is False
    # Persisted in the store, resolvable by email
    stored = next(u for u in get_store().get_all_users() if u["email"] == "new@brandeis.edu")
    assert stored["moodleApproved"] is True


def test_admin_flag_grants_admin():
    rec = approve("boss@brandeis.edu", admin=True)
    assert rec["isAdmin"] is True
    assert rec["moodleApproved"] is True


def test_updates_existing_user_without_duplicating():
    store = get_store()
    store.put_user("u1", {
        "id": "u1", "email": "existing@brandeis.edu", "displayName": "existing",
        "hasSignedWaiver": False, "moodleApproved": False, "isAdmin": False,
    })
    approve("existing@brandeis.edu")
    matches = [u for u in store.get_all_users() if u["email"] == "existing@brandeis.edu"]
    assert len(matches) == 1                       # no duplicate record
    assert matches[0]["id"] == "u1"                # same record updated
    assert matches[0]["moodleApproved"] is True


def test_email_is_normalised():
    rec = approve("  MixedCase@Brandeis.edu  ")
    assert rec["email"] == "mixedcase@brandeis.edu"


def test_empty_email_raises():
    with pytest.raises(ValueError):
        approve("   ")

#!/usr/bin/env python3
"""
DeisBikes local test helper — mark a user as fully approved (skip waiver + Moodle).

Since dev-login was removed, magic-link signups start with hasSignedWaiver=False
and moodleApproved=False, so they can't ride until an admin approves them. For
local testing there's no admin to do that, so this tool flips the flags directly
in the store (the same data/store.json the server reads).

It is an operator CLI, NOT an HTTP endpoint — it can only be run by someone with
shell access to the machine, so it adds no attack surface to the running app.

Usage (run from the repo root, with STORAGE_BACKEND=json — the default):
    # Approve an existing or new test user (creates the record if absent):
    python3 tools/approve_user.py you@brandeis.edu

    # Also make them an admin (so they can approve others via the admin UI):
    python3 tools/approve_user.py you@brandeis.edu --admin

Then log in via the magic link with that email — the login flow loads the
existing record by email and keeps these flags, so /waiver and /safety-course
are skipped.
"""

import argparse
import hashlib
import os
import sys
from datetime import datetime

# Allow running as a standalone script (`python3 tools/approve_user.py`) from the
# repo root by putting the project root (parent of tools/) on the import path.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.storage import get_store


def approve(email: str, admin: bool = False) -> dict:
    """Set hasSignedWaiver + moodleApproved (and optionally isAdmin) for `email`.

    Finds the user by email; creates a minimal record if none exists.
    Returns the resulting user record. Raises ValueError on empty email.
    """
    email = (email or "").strip().lower()
    if not email:
        raise ValueError("email is required")

    store = get_store()
    existing = next((u for u in store.get_all_users() if u.get("email") == email), None)

    updates = {
        "hasSignedWaiver": True,
        "waiverSignedAt":  datetime.utcnow().isoformat(),
        "moodleApproved":  True,
        "moodleApprovedAt": datetime.utcnow().isoformat(),
        "moodleApprovedBy": "approve_user.py",
    }
    if admin:
        updates["isAdmin"] = True

    if existing:
        store.update_user(existing["id"], updates)
        return {**existing, **updates}

    # Match the id scheme used by the magic-link flow so a later real login
    # resolves to this same record by email regardless of id.
    user_id = f"user-{hashlib.sha256(email.encode()).hexdigest()[:12]}"
    record = {
        "id":          user_id,
        "email":       email,
        "displayName": email.split("@")[0],
        "photo":       None,
        "isAdmin":     admin,
        "createdAt":   datetime.utcnow().isoformat(),
        **updates,
    }
    store.put_user(user_id, record)
    return record


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Approve a DeisBikes user for local testing.")
    parser.add_argument("email", help="@brandeis.edu email to approve")
    parser.add_argument("--admin", action="store_true", help="also grant admin privileges")
    args = parser.parse_args(argv)

    try:
        user = approve(args.email, admin=args.admin)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    role = "admin" if user.get("isAdmin") else "rider"
    print(f"✓ {user['email']} approved ({role}): waiver + Moodle set. Log in via magic link to use it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

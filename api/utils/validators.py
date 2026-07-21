"""Shared validation helpers.

Kept dependency-free (stdlib only) to match the project's no-extra-deps style.
Used by the auth route (server-side) and mirrored on the client in
`client/src/utils/validators.ts`.
"""

import re

BRANDEIS_DOMAIN = "@brandeis.edu"

# Pragmatic email format check: exactly one "@", a non-empty local part with no
# whitespace, and a dotted domain. Not full RFC 5322 — deliberately strict
# enough to reject the cases the old `endswith` check let through
# ("@brandeis.edu", "a b@brandeis.edu", trailing spaces).
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def is_valid_email(email: str) -> bool:
    """True if `email` is a structurally valid email address."""
    if not email:
        return False
    return bool(_EMAIL_RE.match(email))


def is_brandeis_email(email: str) -> bool:
    """True if `email` is a valid address in the @brandeis.edu domain."""
    return is_valid_email(email) and email.lower().endswith(BRANDEIS_DOMAIN)

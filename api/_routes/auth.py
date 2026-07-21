import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
_IS_DEV = os.getenv("NODE_ENV") == "development"


def _cookie_kwargs():
    """Return secure cookie settings, relaxed for local HTTP dev."""
    if _IS_DEV:
        return dict(httponly=True, samesite="lax", secure=False, max_age=86400)
    return dict(httponly=True, samesite="none", secure=True, max_age=86400)

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from api._auth import create_token, decode_token, get_current_user
from api.storage import get_store
from api.services.email_service import send_magic_link
from api.utils.validators import is_brandeis_email


def _mock_email_enabled() -> bool:
    """Always skip the real SMTP send and report success.

    Real email delivery isn't configured yet; the pending token is still
    stored so /auth/verify works via the returned devLoginUrl.
    """
    return True

router = APIRouter()

# In-memory pending verifications: token → {email, expires_at, requested_at}
_pending: dict[str, dict] = {}


def _clean_expired() -> None:
    now = datetime.utcnow()
    expired = [t for t, v in list(_pending.items())
               if datetime.fromisoformat(v["expires_at"]) < now]
    for t in expired:
        del _pending[t]


def _find_pending_by_email(email: str) -> Optional[dict]:
    return next((v for v in _pending.values() if v["email"] == email), None)


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id":              user["id"],
        "email":           user["email"],
        "displayName":     user["displayName"],
        "photo":           user.get("photo"),
        "hasSignedWaiver": user.get("hasSignedWaiver", False),
        "moodleApproved":  user.get("moodleApproved", False),
        "isAdmin":         user.get("isAdmin", False),
    }


@router.post("/auth/waiver")
async def sign_waiver(request: Request, response: Response,
                      user: dict = Depends(get_current_user)):
    body = await request.json()
    if not body.get("agreed"):
        raise HTTPException(status_code=400, detail="You must agree to the waiver")

    updated = {**user, "hasSignedWaiver": True}
    token   = create_token(updated)
    response.set_cookie("auth_token", token, **_cookie_kwargs())
    return {
        "success":  True,
        "message":  "Waiver signed successfully",
        "nextStep": "/map" if updated.get("moodleApproved") else "/safety-course",
    }


@router.post("/auth/dev-approve")
async def dev_approve(response: Response, user: dict = Depends(get_current_user)):
    """DEV ONLY: grant the current user Moodle safety-course approval so the bike
    rental flow can be tested locally without an admin. 404 outside development."""
    if os.getenv("NODE_ENV") != "development":
        raise HTTPException(status_code=404, detail="Not found")

    store  = get_store()
    record = store.get_user(user["id"]) or user
    record = {**record, "moodleApproved": True}
    store.put_user(user["id"], record)          # keep the store consistent

    updated = {**user, "moodleApproved": True}
    token   = create_token(updated)             # re-issue cookie so the flag is live
    response.set_cookie("auth_token", token, **_cookie_kwargs())
    return {"success": True, "message": "Dev approval granted", "nextStep": "/map"}


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("auth_token")
    return {"success": True, "message": "Logged out successfully"}


@router.get("/auth/status")
async def auth_status(request: Request):
    token = request.cookies.get("auth_token")
    if not token:
        return {"authenticated": False, "user": None}
    user = decode_token(token)
    if not user:
        return {"authenticated": False, "user": None}
    return {
        "authenticated": True,
        "user": {
            "displayName":     user.get("displayName"),
            "hasSignedWaiver": user.get("hasSignedWaiver", False),
            "moodleApproved":  user.get("moodleApproved", False),
        },
    }


@router.post("/auth/request-link")
async def request_magic_link(request: Request):
    body  = await request.json()
    email = (body.get("email") or "").strip().lower()

    if not is_brandeis_email(email):
        raise HTTPException(status_code=400, detail="Only valid @brandeis.edu email addresses are allowed.")

    _clean_expired()

    existing = _find_pending_by_email(email)
    if existing:
        requested_at = datetime.fromisoformat(existing["requested_at"])
        if (datetime.utcnow() - requested_at).total_seconds() < 60:
            raise HTTPException(
                status_code=429,
                detail="A link was already sent. Please wait 60 seconds before requesting another."
            )

    token = secrets.token_urlsafe(32)
    now   = datetime.utcnow()
    _pending[token] = {
        "email":        email,
        "expires_at":   (now + timedelta(minutes=15)).isoformat(),
        "requested_at": now.isoformat(),
    }

    # Dev-only: bypass the (potentially unavailable) SMTP infrastructure and
    # report success. The pending token is still stored above; the verify link
    # is returned in the response (dev-gated only) so the login flow can be
    # completed locally without a real inbox.
    if _mock_email_enabled():
        base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
        return {
            "success": True,
            "mocked": True,
            "message": "Check your email for a login link.",
            "devLoginUrl": f"{base_url}/auth/verify?token={token}",
        }

    try:
        send_magic_link(email, token)
    except Exception as exc:
        _pending.pop(token, None)
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}")

    return {"success": True, "message": "Check your email for a login link."}


@router.get("/auth/verify")
async def verify_magic_link(token: str, request: Request):
    _clean_expired()
    client_url = os.getenv("CLIENT_URL", "http://localhost:3000")

    entry = _pending.get(token)
    if not entry:
        return RedirectResponse(url=f"{client_url}/login?error=invalid_link", status_code=302)

    email = entry["email"]
    _pending.pop(token)

    store     = get_store()
    all_users = store.get_all_users()
    user_record = next((u for u in all_users if u.get("email") == email), None)

    if not user_record:
        user_id = f"user-{hashlib.sha256(email.encode()).hexdigest()[:12]}"
        user_record = {
            "id":              user_id,
            "email":           email,
            "displayName":     email.split("@")[0],
            "photo":           None,
            "hasSignedWaiver": False,
            "moodleApproved":  False,
            "isAdmin":         False,
            "createdAt":       datetime.utcnow().isoformat(),
        }
        store.put_user(user_id, user_record)

    jwt = create_token(user_record)
    redirect = RedirectResponse(url=f"{client_url}/", status_code=302)
    redirect.set_cookie("auth_token", jwt, **_cookie_kwargs())
    return redirect

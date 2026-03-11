import os
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from api._state import users
from api._auth import create_token, decode_token, get_current_user

router = APIRouter()


@router.get("/auth/dev-login")
async def dev_login(request: Request):
    if os.getenv("NODE_ENV") != "development":
        raise HTTPException(status_code=404, detail="Not found")

    dev_user = {
        "id":              "dev-user-001",
        "email":           "devuser@brandeis.edu",
        "displayName":     "Dev User",
        "photo":           None,
        "hasSignedWaiver": True,
        "moodleApproved":  True,
        "isAdmin":         True,
    }
    users[dev_user["id"]] = dev_user

    # Redirect to the origin the user came from (or request base_url on Vercel)
    ref = request.headers.get("referer") or request.headers.get("origin")
    if ref:
        p = urlparse(ref)
        client_url = f"{p.scheme}://{p.netloc}"
    else:
        # No Referer: use base_url (correct on Vercel) before CLIENT_URL
        client_url = str(request.base_url).rstrip("/") or os.getenv("CLIENT_URL", "http://localhost:3000")
    token       = create_token(dev_user)
    redirect    = RedirectResponse(url=f"{client_url}/map", status_code=302)
    redirect.set_cookie("auth_token", token, httponly=True, samesite="none",
                        secure=True, max_age=86400)
    return redirect


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
    response.set_cookie("auth_token", token, httponly=True, samesite="none",
                        secure=True, max_age=86400)
    return {
        "success":  True,
        "message":  "Waiver signed successfully",
        "nextStep": "/map" if updated.get("moodleApproved") else "/safety-course",
    }


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

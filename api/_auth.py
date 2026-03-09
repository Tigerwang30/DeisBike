import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request


def create_token(user: dict) -> str:
    secret  = os.getenv("SESSION_SECRET", "deisbikes-dev-secret")
    payload = {**user, "exp": datetime.utcnow() + timedelta(hours=24)}
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    try:
        secret = os.getenv("SESSION_SECRET", "deisbikes-dev-secret")
        return jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None


def get_current_user(request: Request) -> dict:
    token = request.cookies.get("auth_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = decode_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("isAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def get_fully_approved_user(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("hasSignedWaiver"):
        raise HTTPException(status_code=403, detail="Waiver required")
    if not user.get("moodleApproved"):
        raise HTTPException(status_code=403, detail="Safety course completion required")
    return user

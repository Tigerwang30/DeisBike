import os
from typing import Optional

import httpx
from fastapi import HTTPException


def _linka_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "X-Auth-Token": os.getenv("LINKA_ACCESS_TOKEN", ""),
        "X-User-Id":    os.getenv("LINKA_USER_ID", ""),
        "Origin":       "https://fleetview.linkalock.com",
        "Referer":      "https://fleetview.linkalock.com/",
    }


def _command_body() -> dict:
    return {
        "access_token":     os.getenv("LINKA_LOCK_TOKEN", ""),
        "mac_addr":         os.getenv("LINKA_MAC_ADDR", ""),
        "schedule":         True,
        "firmware_version": "2.6.15",
        "smartkey_mac":     "",
    }


async def call_linka(endpoint: str, body: Optional[dict] = None) -> dict:
    if not os.getenv("LINKA_API_KEY"):
        return {"success": True, "simulated": True}
    base   = os.getenv("LINKA_API_BASE_URL", "https://app.linkalock.com/api/merchant_api")
    method = "POST" if body else "GET"
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method, f"{base}{endpoint}",
            headers=_linka_headers(), json=body, timeout=10.0,
        )
    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"LINKA API error: {resp.status_code}")
    return resp.json() if resp.content else {}

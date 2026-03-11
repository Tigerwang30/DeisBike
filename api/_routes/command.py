import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request

from api._auth import get_fully_approved_user
from api._linka import call_linka
from api.config.bikes import registry
from api.services.ride_service import ride_service
from api.storage import get_store

router = APIRouter()


@router.post("/api/command")
async def command(request: Request, user: dict = Depends(get_fully_approved_user)):
    body       = await request.json()
    action     = body.get("action")
    bike_id    = body.get("bikeId")
    session_id = body.get("sessionId")

    if action == "open":
        if not bike_id:
            raise HTTPException(status_code=400, detail="bikeId is required")
        return await ride_service.start_ride(user, bike_id)

    if action == "unlock_chain":
        if not bike_id:
            raise HTTPException(status_code=400, detail="bikeId is required")
        await call_linka("/command_unlock", registry.command_body(bike_id))
        sid = f"session-{int(time.time() * 1000)}-{user['id']}"
        get_store().put_session(sid, {
            "sessionId": sid, "bikeId": bike_id, "userId": user["id"],
            "chainUnlocked": True, "wheelUnlocked": False,
            "startTime": None, "status": "chain_unlocked",
        })
        return {
            "success": True, "sessionId": sid,
            "message": "Chain unlocked. Please secure the chain and confirm.",
            "nextStep": "confirm_chain_secured",
        }

    if action == "unlock_wheel":
        if not session_id:
            raise HTTPException(status_code=400, detail="sessionId is required")
        store   = get_store()
        session = store.get_session(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session. Please start over.")
        await call_linka("/command_unlock", registry.command_body(session["bikeId"]))
        updated = {**session, "wheelUnlocked": True,
                   "startTime": datetime.utcnow().isoformat(), "status": "ride_active"}
        store.put_session(session_id, updated)
        return {
            "success": True, "sessionId": session_id, "bikeId": updated["bikeId"],
            "startTime": updated["startTime"],
            "message": "Bike unlocked! Enjoy your ride.", "status": "ride_active",
        }

    if action == "lock":
        if not session_id:
            raise HTTPException(status_code=400, detail="sessionId is required")
        return await ride_service.lock_ride(user, session_id)

    if action == "status":
        if not bike_id:
            raise HTTPException(status_code=400, detail="bikeId is required")
        try:
            return await call_linka(f"/device_status/{bike_id}")
        except Exception:
            return {"bikeId": bike_id, "chainLocked": True, "wheelLocked": True,
                    "batteryLevel": 85, "lastUpdated": datetime.utcnow().isoformat()}

    if action == "active_session":
        return {"session": ride_service.get_active_session(user["id"])}

    raise HTTPException(status_code=400, detail="Invalid action")


@router.post("/api/command/webhook")
async def command_webhook(request: Request):
    payload = await request.json()
    bike_id = payload.get("bikeId")
    event   = payload.get("event")

    if event == "chain_locked" and bike_id:
        result = await ride_service.handle_webhook_lock(bike_id)
        if result:
            return result

    return {"success": True, "message": "Webhook processed"}

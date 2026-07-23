from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from api._linka import call_linka
from api.services.ride_service import ride_service

router = APIRouter()


@router.post("/api/command")
async def command(request: Request):
    body       = await request.json()
    action     = body.get("action")
    bike_id    = body.get("bikeId")
    session_id = body.get("sessionId")

    if action == "open":
        if not bike_id:
            raise HTTPException(status_code=400, detail="bikeId is required")
        return await ride_service.start_ride(bike_id)

    if action == "unlock_chain":
        if not bike_id:
            raise HTTPException(status_code=400, detail="bikeId is required")
        return await ride_service.unlock_chain(bike_id)

    if action == "unlock_wheel":
        if not session_id:
            raise HTTPException(status_code=400, detail="sessionId is required")
        return await ride_service.unlock_wheel(session_id)

    if action == "lock":
        if not session_id:
            raise HTTPException(status_code=400, detail="sessionId is required")
        return await ride_service.lock_ride(session_id)

    if action == "status":
        if not bike_id:
            raise HTTPException(status_code=400, detail="bikeId is required")
        try:
            return await call_linka(f"/device_status/{bike_id}")
        except Exception:
            return {"bikeId": bike_id, "chainLocked": True, "wheelLocked": True,
                    "batteryLevel": 85, "lastUpdated": datetime.utcnow().isoformat()}

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

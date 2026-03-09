import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request

from api._state import active_sessions, ride_history
from api._auth import get_fully_approved_user
from api._linka import call_linka, _command_body

router = APIRouter()


@router.post("/api/command")
async def command(request: Request, user: dict = Depends(get_fully_approved_user)):
    body       = await request.json()
    action     = body.get("action")
    bike_id    = body.get("bikeId")
    session_id = body.get("sessionId")

    if action == "open":
        await call_linka("/command_unlock", _command_body())
        sid = f"session-{int(time.time() * 1000)}-{user['id']}"
        active_sessions[sid] = {
            "sessionId": sid, "bikeId": bike_id, "userId": user["id"],
            "startTime": datetime.utcnow().isoformat(), "status": "ride_active",
        }
        return {
            "success": True, "sessionId": sid, "bikeId": bike_id,
            "startTime": active_sessions[sid]["startTime"],
            "message": "Bike unlocked! Enjoy your ride.", "status": "ride_active",
        }

    if action == "unlock_chain":
        await call_linka("/command_unlock", _command_body())
        sid = f"session-{int(time.time() * 1000)}-{user['id']}"
        active_sessions[sid] = {
            "sessionId": sid, "bikeId": bike_id, "userId": user["id"],
            "chainUnlocked": True, "wheelUnlocked": False,
            "startTime": None, "status": "chain_unlocked",
        }
        return {
            "success": True, "sessionId": sid,
            "message": "Chain unlocked. Please secure the chain and confirm.",
            "nextStep": "confirm_chain_secured",
        }

    if action == "unlock_wheel":
        session = active_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session. Please start over.")
        await call_linka("/command_unlock", _command_body())
        session.update({
            "wheelUnlocked": True,
            "startTime":     datetime.utcnow().isoformat(),
            "status":        "ride_active",
        })
        return {
            "success": True, "sessionId": session_id, "bikeId": session["bikeId"],
            "startTime": session["startTime"],
            "message": "Bike unlocked! Enjoy your ride.", "status": "ride_active",
        }

    if action == "lock":
        session = active_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session.")
        await call_linka("/command_lock", _command_body())
        end_time = datetime.utcnow()
        start    = datetime.fromisoformat(session["startTime"]) if session.get("startTime") else end_time
        duration = int((end_time - start).total_seconds() / 60)

        ride_record = {
            **session,
            "rideId":   session_id,
            "endTime":  end_time.isoformat(),
            "duration": duration,
            "status":   "completed",
        }
        ride_history.setdefault(session["userId"], []).insert(0, ride_record)
        del active_sessions[session_id]

        return {
            "success":   True,
            "rideId":    session_id,
            "bikeId":    ride_record["bikeId"],
            "startTime": ride_record["startTime"],
            "endTime":   ride_record["endTime"],
            "duration":  duration,
            "message":   f"Ride completed. Duration: {duration} minutes.",
        }

    if action == "status":
        if not bike_id:
            raise HTTPException(status_code=400, detail="bikeId is required")
        try:
            data = await call_linka(f"/device_status/{bike_id}")
        except Exception:
            data = {"bikeId": bike_id, "chainLocked": True, "wheelLocked": True,
                    "batteryLevel": 85, "lastUpdated": datetime.utcnow().isoformat()}
        return data

    if action == "active_session":
        session = next(
            (s for s in active_sessions.values()
             if s["userId"] == user["id"] and s["status"] == "ride_active"),
            None,
        )
        return {"session": session}

    raise HTTPException(status_code=400, detail="Invalid action")


@router.post("/api/command/webhook")
async def command_webhook(request: Request):
    payload = await request.json()
    bike_id = payload.get("bikeId")
    event   = payload.get("event")

    if event == "chain_locked" and bike_id:
        for sid, session in list(active_sessions.items()):
            if session["bikeId"] == bike_id and session["status"] == "ride_active":
                await call_linka("/command_lock", _command_body())
                end_time = datetime.utcnow()
                start    = datetime.fromisoformat(session["startTime"]) if session.get("startTime") else end_time
                duration = int((end_time - start).total_seconds() / 60)
                ride_record = {
                    **session,
                    "rideId": sid, "endTime": end_time.isoformat(),
                    "duration": duration, "status": "completed",
                }
                ride_history.setdefault(session["userId"], []).insert(0, ride_record)
                del active_sessions[sid]
                return {"success": True, "rideId": sid, "duration": duration}

    return {"success": True, "message": "Webhook processed"}

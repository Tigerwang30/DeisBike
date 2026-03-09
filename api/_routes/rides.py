from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from api._state import active_sessions, ride_history
from api._auth import get_current_user

router = APIRouter()


@router.get("/api/rides/active")
async def get_active_ride(user: dict = Depends(get_current_user)):
    for sid, session in active_sessions.items():
        if session["userId"] == user["id"] and session["status"] == "ride_active":
            start         = datetime.fromisoformat(session["startTime"])
            duration_mins = int((datetime.utcnow() - start).total_seconds() / 60)
            return {
                "active": True, "sessionId": sid, "bikeId": session["bikeId"],
                "startTime": session["startTime"], "currentDuration": duration_mins,
            }
    return {"active": False}


@router.get("/api/rides/history")
async def get_ride_history(user: dict = Depends(get_current_user)):
    return ride_history.get(user["id"], [])


@router.get("/api/rides/{ride_id}")
async def get_ride(ride_id: str, user: dict = Depends(get_current_user)):
    rides = ride_history.get(user["id"], [])
    ride  = next((r for r in rides if r.get("rideId") == ride_id), None)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return ride

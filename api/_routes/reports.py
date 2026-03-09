import io
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from api._state import ride_history
from api._auth import get_current_user
from api._pdf import _generate_ride_pdf, _generate_history_pdf

router = APIRouter()


@router.get("/api/reports/ride/{ride_id}/pdf")
async def ride_pdf(ride_id: str, user: dict = Depends(get_current_user)):
    rides = ride_history.get(user["id"], [])
    ride  = next((r for r in rides if r.get("rideId") == ride_id), None)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    pdf = _generate_ride_pdf(ride, user)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=ride-{ride_id}.pdf"})


@router.get("/api/reports/history/pdf")
async def history_pdf(user: dict = Depends(get_current_user)):
    rides = ride_history.get(user["id"], [])
    if not rides:
        raise HTTPException(status_code=404, detail="No rides found")
    pdf = _generate_history_pdf(rides, user)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=ride-history-{int(time.time())}.pdf"})


@router.get("/api/reports/summary")
async def report_summary(user: dict = Depends(get_current_user)):
    rides          = ride_history.get(user["id"], [])
    total          = len(rides)
    total_duration = sum(r.get("duration", 0) for r in rides)
    return {
        "totalRides":      total,
        "totalDuration":   total_duration,
        "averageDuration": round(total_duration / total) if total else 0,
        "firstRide":       rides[-1]["startTime"] if rides else None,
        "lastRide":        rides[0]["startTime"]  if rides else None,
    }

from fastapi import APIRouter, Depends, HTTPException

from api._auth import get_current_user
from api.storage import get_store

router = APIRouter()


@router.get("/api/rides/active")
async def get_active_ride(user: dict = Depends(get_current_user)):
    from api.services.ride_service import ride_service
    return ride_service.get_active_ride_status(user["id"])


@router.get("/api/rides/history")
async def get_ride_history(user: dict = Depends(get_current_user)):
    return get_store().get_ride_history(user["id"])


@router.get("/api/rides/{ride_id}")
async def get_ride(ride_id: str, user: dict = Depends(get_current_user)):
    rides = get_store().get_ride_history(user["id"])
    ride  = next((r for r in rides if r.get("rideId") == ride_id), None)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return ride

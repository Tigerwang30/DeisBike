from fastapi import APIRouter

from api.services.ride_service import ride_service

router = APIRouter()


@router.get("/api/rides/active")
async def get_active_ride():
    return ride_service.get_active_ride_status()

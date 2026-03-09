from datetime import datetime

from fastapi import APIRouter, Depends

from api._auth import get_current_user

router = APIRouter()

BIKES = [
    {"id": "5000", "name": "Leo2 Pro — 125Q03004310", "location": "Main Campus", "available": True},
]


@router.get("/api/bikes")
async def list_bikes(user: dict = Depends(get_current_user)):
    return BIKES


@router.get("/api/bikes/locations/all")
async def bike_locations(user: dict = Depends(get_current_user)):
    return [
        {"id": b["id"], "lat": 42.3655, "lng": -71.2595, "available": b["available"]}
        for b in BIKES
    ]


@router.get("/api/bikes/{bike_id}")
async def get_bike(bike_id: str, user: dict = Depends(get_current_user)):
    bike = next((b for b in BIKES if b["id"] == bike_id), None)
    if bike:
        return {**bike, "chainLocked": True, "wheelLocked": True,
                "batteryLevel": 85, "lastUpdated": datetime.utcnow().isoformat()}
    return {"bikeId": bike_id, "chainLocked": True, "wheelLocked": True,
            "batteryLevel": 85, "lastUpdated": datetime.utcnow().isoformat()}

from datetime import datetime

from fastapi import APIRouter

from api.config.bikes import registry

router = APIRouter()


@router.get("/api/bikes")
async def list_bikes():
    return registry.all()


@router.get("/api/bikes/locations/all")
async def bike_locations():
    return [
        {"id": b["id"], "lat": b["lat"], "lng": b["lng"], "available": b["available"],
         "name": b["name"], "location": b["location"]}
        for b in registry.all()
    ]


@router.get("/api/bikes/{bike_id}")
async def get_bike(bike_id: str):
    base = {"chainLocked": True, "wheelLocked": True,
            "batteryLevel": 85, "lastUpdated": datetime.utcnow().isoformat()}
    bike = registry.get(bike_id)
    if bike:
        return {**base, "id": bike_id, "name": bike.get("name"), "location": bike.get("location")}
    return {**base, "bikeId": bike_id}

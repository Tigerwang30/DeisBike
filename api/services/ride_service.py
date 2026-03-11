import time
from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from api._linka import call_linka
from api.config.bikes import registry
from api.storage import get_store


class RideService:
    """
    Owns the ride lifecycle: start, lock, status queries, and webhook finalization.
    Routes are thin HTTP glue that call into this service.

    Storage and BikeRegistry are accessed via module-level singletons (get_store()
    and registry) rather than constructor injection, to stay compatible with
    FastAPI's import-time module loading.
    """

    @property
    def _store(self):
        return get_store()

    async def start_ride(self, user: dict, bike_id: str) -> dict:
        """
        Calls LINKA unlock and creates an active session in the store.
        Returns the full session response for the client.
        """
        if not registry.get(bike_id):
            raise HTTPException(status_code=404, detail=f"Bike {bike_id} not found")

        await call_linka("/command_unlock", registry.command_body(bike_id))

        sid = f"session-{int(time.time() * 1000)}-{user['id']}"
        session = {
            "sessionId": sid,
            "bikeId":    bike_id,
            "userId":    user["id"],
            "startTime": datetime.utcnow().isoformat(),
            "status":    "ride_active",
        }
        self._store.put_session(sid, session)

        return {
            "success":   True,
            "sessionId": sid,
            "bikeId":    bike_id,
            "startTime": session["startTime"],
            "message":   "Bike unlocked! Enjoy your ride.",
            "status":    "ride_active",
        }

    async def lock_ride(self, user: dict, session_id: str) -> dict:
        """
        Calls LINKA lock, finalizes the ride record, and moves it to history.
        Returns the completed ride record for the client.
        """
        session = self._store.get_session(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session.")

        await call_linka("/command_lock", registry.command_body(session["bikeId"]))

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
        self._store.append_ride(session["userId"], ride_record)
        self._store.delete_session(session_id)

        return {
            "success":   True,
            "rideId":    session_id,
            "bikeId":    ride_record["bikeId"],
            "startTime": ride_record["startTime"],
            "endTime":   ride_record["endTime"],
            "duration":  duration,
            "message":   f"Ride completed. Duration: {duration} minutes.",
        }

    def get_active_session(self, user_id: str) -> Optional[dict]:
        """Returns the active session dict for a user, or None."""
        result = self._store.get_active_session_for_user(user_id)
        return result[1] if result else None

    def get_active_ride_status(self, user_id: str) -> dict:
        """
        Returns a rich status dict for the active ride, including server-computed
        duration in minutes (used by the frontend timer as an authoritative baseline).
        """
        result = self._store.get_active_session_for_user(user_id)
        if not result:
            return {"active": False}

        sid, session = result
        start         = datetime.fromisoformat(session["startTime"])
        duration_mins = int((datetime.utcnow() - start).total_seconds() / 60)

        return {
            "active":          True,
            "sessionId":       sid,
            "bikeId":          session["bikeId"],
            "startTime":       session["startTime"],
            "currentDuration": duration_mins,
        }

    async def handle_webhook_lock(self, bike_id: str) -> Optional[dict]:
        """
        Called when a chain_locked webhook event arrives.
        Finds the active session for the bike, calls LINKA lock, and finalizes the ride.
        """
        store = self._store
        for sid, session in list(store.get_all_active_sessions().items()):
            if session["bikeId"] == bike_id and session["status"] == "ride_active":
                await call_linka("/command_lock", registry.command_body(bike_id))
                end_time = datetime.utcnow()
                start    = datetime.fromisoformat(session["startTime"]) if session.get("startTime") else end_time
                duration = int((end_time - start).total_seconds() / 60)

                ride_record = {
                    **session,
                    "rideId":   sid,
                    "endTime":  end_time.isoformat(),
                    "duration": duration,
                    "status":   "completed",
                }
                store.append_ride(session["userId"], ride_record)
                store.delete_session(sid)
                return {"success": True, "rideId": sid, "duration": duration}

        return None


# Module-level singleton — imported by routes
ride_service = RideService()

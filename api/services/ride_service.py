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

    @staticmethod
    def _new_session_id(bike_id: str) -> str:
        return f"session-{int(time.time() * 1000)}-{bike_id}"

    @staticmethod
    def _duration_minutes(start_iso: Optional[str], end: datetime) -> int:
        """Whole minutes between a session's ISO startTime and `end`.
        A missing startTime yields 0 (start is treated as `end`)."""
        start = datetime.fromisoformat(start_iso) if start_iso else end
        return int((end - start).total_seconds() / 60)

    async def _finalize_ride(self, sid: str, session: dict) -> dict:
        """
        Lock the bike and drop the session. Shared by lock_ride (rider-initiated)
        and handle_webhook_lock (device event). Returns the completed ride record.
        """
        await call_linka("/command_lock", registry.command_body(session["bikeId"]))
        end_time = datetime.utcnow()
        ride_record = {
            **session,
            "rideId":   sid,
            "endTime":  end_time.isoformat(),
            "duration": self._duration_minutes(session.get("startTime"), end_time),
            "status":   "completed",
        }
        self._store.delete_session(sid)
        return ride_record

    async def start_ride(self, bike_id: str) -> dict:
        """
        Calls LINKA unlock and creates an active session in the store.
        Returns the full session response for the client.
        """
        if not registry.get(bike_id):
            raise HTTPException(status_code=404, detail=f"Bike {bike_id} not found")

        await call_linka("/command_unlock", registry.command_body(bike_id))

        sid = self._new_session_id(bike_id)
        session = {
            "sessionId": sid,
            "bikeId":    bike_id,
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

    async def unlock_chain(self, bike_id: str) -> dict:
        """
        First step of the two-step unlock: release the chain and open a pending
        session that unlock_wheel later promotes to an active ride.
        """
        await call_linka("/command_unlock", registry.command_body(bike_id))

        sid = self._new_session_id(bike_id)
        self._store.put_session(sid, {
            "sessionId":     sid,
            "bikeId":        bike_id,
            "chainUnlocked": True,
            "wheelUnlocked": False,
            "startTime":     None,
            "status":        "chain_unlocked",
        })

        return {
            "success":   True,
            "sessionId": sid,
            "message":   "Chain unlocked. Please secure the chain and confirm.",
            "nextStep":  "confirm_chain_secured",
        }

    async def unlock_wheel(self, session_id: str) -> dict:
        """
        Second step: release the wheel and start the active-ride timer.
        """
        session = self._store.get_session(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session. Please start over.")

        await call_linka("/command_unlock", registry.command_body(session["bikeId"]))

        updated = {
            **session,
            "wheelUnlocked": True,
            "startTime":     datetime.utcnow().isoformat(),
            "status":        "ride_active",
        }
        self._store.put_session(session_id, updated)

        return {
            "success":   True,
            "sessionId": session_id,
            "bikeId":    updated["bikeId"],
            "startTime": updated["startTime"],
            "message":   "Bike unlocked! Enjoy your ride.",
            "status":    "ride_active",
        }

    async def lock_ride(self, session_id: str) -> dict:
        """
        Calls LINKA lock and finalizes the ride record.
        Returns the completed ride record for the client.
        """
        session = self._store.get_session(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session.")

        ride_record = await self._finalize_ride(session_id, session)

        return {
            "success":   True,
            "rideId":    session_id,
            "bikeId":    ride_record["bikeId"],
            "startTime": ride_record["startTime"],
            "endTime":   ride_record["endTime"],
            "duration":  ride_record["duration"],
            "message":   f"Ride completed. Duration: {ride_record['duration']} minutes.",
        }

    def get_active_session(self) -> Optional[dict]:
        """Returns the currently active session dict, or None."""
        result = self._store.get_active_session()
        return result[1] if result else None

    def get_active_ride_status(self) -> dict:
        """
        Returns a rich status dict for the active ride, including server-computed
        duration in minutes (used by the frontend timer as an authoritative baseline).
        """
        result = self._store.get_active_session()
        if not result:
            return {"active": False}

        sid, session = result
        return {
            "active":          True,
            "sessionId":       sid,
            "bikeId":          session["bikeId"],
            "startTime":       session["startTime"],
            "currentDuration": self._duration_minutes(session["startTime"], datetime.utcnow()),
        }

    async def handle_webhook_lock(self, bike_id: str) -> Optional[dict]:
        """
        Called when a chain_locked webhook event arrives.
        Finds the active session for the bike, calls LINKA lock, and finalizes the ride.
        """
        for sid, session in list(self._store.get_all_active_sessions().items()):
            if session["bikeId"] == bike_id and session["status"] == "ride_active":
                ride_record = await self._finalize_ride(sid, session)
                return {"success": True, "rideId": sid, "duration": ride_record["duration"]}

        return None


# Module-level singleton — imported by routes
ride_service = RideService()

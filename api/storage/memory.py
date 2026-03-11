from typing import Optional


class MemoryStore:
    """
    In-memory store — data is lost on server restart.
    Use STORAGE_BACKEND=memory for tests or local dev without persistence.
    """

    def __init__(self):
        self._sessions: dict = {}
        self._ride_history: dict = {}
        self._users: dict = {}

    # --- Sessions ---

    def get_session(self, session_id: str) -> Optional[dict]:
        return self._sessions.get(session_id)

    def get_active_session_for_user(self, user_id: str) -> Optional[tuple[str, dict]]:
        for sid, session in self._sessions.items():
            if session.get("userId") == user_id and session.get("status") == "ride_active":
                return sid, session
        return None

    def get_all_active_sessions(self) -> dict[str, dict]:
        return dict(self._sessions)

    def put_session(self, session_id: str, data: dict) -> None:
        self._sessions[session_id] = data

    def delete_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    # --- Ride History ---

    def get_ride_history(self, user_id: str) -> list[dict]:
        return self._ride_history.get(user_id, [])

    def append_ride(self, user_id: str, ride: dict) -> None:
        self._ride_history.setdefault(user_id, []).insert(0, ride)

    # --- Users ---

    def get_user(self, user_id: str) -> Optional[dict]:
        return self._users.get(user_id)

    def get_all_users(self) -> list[dict]:
        return list(self._users.values())

    def put_user(self, user_id: str, data: dict) -> None:
        self._users[user_id] = data

    def update_user(self, user_id: str, updates: dict) -> None:
        if user_id in self._users:
            self._users[user_id].update(updates)

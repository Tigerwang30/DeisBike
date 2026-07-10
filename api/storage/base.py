from typing import Protocol, Optional


class Store(Protocol):
    # --- Sessions / Active Rides ---
    def get_session(self, session_id: str) -> Optional[dict]: ...
    def get_active_session_for_user(self, user_id: str) -> Optional[tuple[str, dict]]: ...
    def get_all_active_sessions(self) -> dict[str, dict]: ...
    def put_session(self, session_id: str, data: dict) -> None: ...
    def delete_session(self, session_id: str) -> None: ...

    # --- Ride History ---
    def get_ride_history(self, user_id: str) -> list[dict]: ...
    def append_ride(self, user_id: str, ride: dict) -> None: ...

    # --- Users ---
    def get_user(self, user_id: str) -> Optional[dict]: ...
    def get_all_users(self) -> list[dict]: ...
    def put_user(self, user_id: str, data: dict) -> None: ...
    def update_user(self, user_id: str, updates: dict) -> None: ...


class BaseStore:
    """
    Concrete in-memory implementation of the Store interface.

    Holds all state in three dicts and implements every accessor once.
    Subclasses add persistence by overriding _save() (invoked after every
    mutation) and populating the dicts on init — the read/write logic itself
    is identical across backends.
    """

    def __init__(self):
        self._sessions: dict = {}
        self._ride_history: dict = {}
        self._users: dict = {}

    def _save(self) -> None:
        """Persistence hook — no-op for pure in-memory stores."""

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
        self._save()

    def delete_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        self._save()

    # --- Ride History ---

    def get_ride_history(self, user_id: str) -> list[dict]:
        return self._ride_history.get(user_id, [])

    def append_ride(self, user_id: str, ride: dict) -> None:
        self._ride_history.setdefault(user_id, []).insert(0, ride)
        self._save()

    # --- Users ---

    def get_user(self, user_id: str) -> Optional[dict]:
        return self._users.get(user_id)

    def get_all_users(self) -> list[dict]:
        return list(self._users.values())

    def put_user(self, user_id: str, data: dict) -> None:
        self._users[user_id] = data
        self._save()

    def update_user(self, user_id: str, updates: dict) -> None:
        if user_id in self._users:
            self._users[user_id].update(updates)
            self._save()

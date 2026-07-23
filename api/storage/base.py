from typing import Protocol, Optional


class Store(Protocol):
    # --- Sessions / Active Rides ---
    def get_session(self, session_id: str) -> Optional[dict]: ...
    def get_active_session(self) -> Optional[tuple[str, dict]]: ...
    def get_all_active_sessions(self) -> dict[str, dict]: ...
    def put_session(self, session_id: str, data: dict) -> None: ...
    def delete_session(self, session_id: str) -> None: ...


class BaseStore:
    """
    Concrete in-memory implementation of the Store interface.

    Holds session state in a dict and implements every accessor once.
    Subclasses add persistence by overriding _save() (invoked after every
    mutation) and populating the dict on init — the read/write logic itself
    is identical across backends.
    """

    def __init__(self):
        self._sessions: dict = {}

    def _save(self) -> None:
        """Persistence hook — no-op for pure in-memory stores."""

    # --- Sessions ---

    def get_session(self, session_id: str) -> Optional[dict]:
        return self._sessions.get(session_id)

    def get_active_session(self) -> Optional[tuple[str, dict]]:
        for sid, session in self._sessions.items():
            if session.get("status") == "ride_active":
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

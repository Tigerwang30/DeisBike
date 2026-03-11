import json
import os
from typing import Optional


class JsonFileStore:
    """
    Persistent JSON-file store. Survives server restarts.

    Data is kept in memory (for fast reads) and flushed to disk on every write
    via an atomic os.replace() to prevent corruption on crash.

    Default path: data/store.json (relative to working directory).
    Override with STORE_PATH env var.

    NOTE: On Vercel (ephemeral filesystem), writes are not persisted across
    invocations. Set STORAGE_BACKEND=memory on Vercel, or use an external
    store (Vercel KV, Supabase, etc.) for production persistence.
    """

    def __init__(self, path: str = "data/store.json"):
        self._path = path
        self._data: dict = {"sessions": {}, "ride_history": {}, "users": {}}
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self._path):
            return
        try:
            with open(self._path, "r") as f:
                loaded = json.load(f)
            # Merge keys so new top-level keys don't break older store files
            for key in ("sessions", "ride_history", "users"):
                if key in loaded:
                    self._data[key] = loaded[key]
        except (json.JSONDecodeError, IOError):
            pass  # Start fresh if file is corrupt

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self._path) or ".", exist_ok=True)
        tmp = self._path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self._data, f, indent=2)
        os.replace(tmp, self._path)

    # --- Sessions ---

    def get_session(self, session_id: str) -> Optional[dict]:
        return self._data["sessions"].get(session_id)

    def get_active_session_for_user(self, user_id: str) -> Optional[tuple[str, dict]]:
        for sid, session in self._data["sessions"].items():
            if session.get("userId") == user_id and session.get("status") == "ride_active":
                return sid, session
        return None

    def get_all_active_sessions(self) -> dict[str, dict]:
        return dict(self._data["sessions"])

    def put_session(self, session_id: str, data: dict) -> None:
        self._data["sessions"][session_id] = data
        self._save()

    def delete_session(self, session_id: str) -> None:
        self._data["sessions"].pop(session_id, None)
        self._save()

    # --- Ride History ---

    def get_ride_history(self, user_id: str) -> list[dict]:
        return self._data["ride_history"].get(user_id, [])

    def append_ride(self, user_id: str, ride: dict) -> None:
        self._data["ride_history"].setdefault(user_id, []).insert(0, ride)
        self._save()

    # --- Users ---

    def get_user(self, user_id: str) -> Optional[dict]:
        return self._data["users"].get(user_id)

    def get_all_users(self) -> list[dict]:
        return list(self._data["users"].values())

    def put_user(self, user_id: str, data: dict) -> None:
        self._data["users"][user_id] = data
        self._save()

    def update_user(self, user_id: str, updates: dict) -> None:
        if user_id in self._data["users"]:
            self._data["users"][user_id].update(updates)
            self._save()

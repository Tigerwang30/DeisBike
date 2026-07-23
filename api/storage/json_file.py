import json
import os

from api.storage.base import BaseStore


class JsonFileStore(BaseStore):
    """
    Persistent JSON-file store. Survives server restarts.

    Data is kept in memory (for fast reads, via BaseStore) and flushed to disk
    on every write via an atomic os.replace() to prevent corruption on crash.

    Default path: data/store.json (relative to working directory).
    Override with STORE_PATH env var.

    NOTE: On Vercel (ephemeral filesystem), writes are not persisted across
    invocations. Set STORAGE_BACKEND=memory on Vercel, or use an external
    store (Vercel KV, Supabase, etc.) for production persistence.
    """

    def __init__(self, path: str = "data/store.json"):
        super().__init__()
        self._path = path
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self._path):
            return
        try:
            with open(self._path, "r") as f:
                loaded = json.load(f)
        except (json.JSONDecodeError, IOError):
            return  # Start fresh if file is corrupt
        # Merge known keys so new/missing top-level keys don't break older files
        self._sessions = loaded.get("sessions", self._sessions)

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self._path) or ".", exist_ok=True)
        tmp = self._path + ".tmp"
        with open(tmp, "w") as f:
            json.dump({
                "sessions": self._sessions,
            }, f, indent=2)
        os.replace(tmp, self._path)

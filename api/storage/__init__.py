import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.storage.base import Store

_store = None


def get_store() -> "Store":
    """
    Returns the singleton store instance.
    Controlled by STORAGE_BACKEND env var:
      - "json"   (default) — persists to data/store.json
      - "memory"           — in-memory only, resets on restart
    """
    global _store
    if _store is None:
        backend = os.getenv("STORAGE_BACKEND", "json")
        if backend == "memory":
            from api.storage.memory import MemoryStore
            _store = MemoryStore()
        else:
            from api.storage.json_file import JsonFileStore
            _store = JsonFileStore(path=os.getenv("STORE_PATH", "data/store.json"))
    return _store

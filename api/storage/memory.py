from api.storage.base import BaseStore


class MemoryStore(BaseStore):
    """
    In-memory store — data is lost on server restart.
    Use STORAGE_BACKEND=memory for tests or local dev without persistence.

    Inherits all behaviour from BaseStore; _save() stays a no-op.
    """

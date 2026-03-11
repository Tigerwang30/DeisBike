import json
import os
from typing import Optional


class BikeRegistry:
    """
    Loads bike configuration from bikes.json at startup.
    Enables multi-bike support without code changes — add bikes by editing bikes.json.

    bikes.json format:
    [
      {
        "id": "5000",
        "name": "Leo2 Pro — 125Q03004310",
        "location": "Main Campus",
        "lat": 42.3655,
        "lng": -71.2595,
        "available": true,
        "mac_addr": "F2:21:E5:8C:9C:D7",
        "linka_token": "<per-bike access token>",
        "firmware_version": "2.6.15"
      }
    ]

    bikes.json is gitignored (contains credentials).
    Commit bikes.example.json with placeholder values instead.
    """

    def __init__(self, path: str = "bikes.json"):
        self._bikes: dict[str, dict] = {}
        self._load(path)

    def _load(self, path: str) -> None:
        if not os.path.exists(path):
            return
        try:
            with open(path, "r") as f:
                bikes = json.load(f)
            self._bikes = {b["id"]: b for b in bikes}
        except (json.JSONDecodeError, IOError, KeyError):
            pass

    def all(self) -> list[dict]:
        """Returns all bikes (safe fields only — no credentials)."""
        return [
            {
                "id":       b["id"],
                "name":     b.get("name", f"Bike {b['id']}"),
                "location": b.get("location", ""),
                "lat":      b.get("lat", 42.3655),
                "lng":      b.get("lng", -71.2595),
                "available": b.get("available", True),
            }
            for b in self._bikes.values()
        ]

    def get(self, bike_id: str) -> Optional[dict]:
        """Returns the full bike record (including credentials) for internal use."""
        return self._bikes.get(bike_id)

    def command_body(self, bike_id: str) -> dict:
        """Returns the LINKA API command body for the specified bike."""
        bike = self.get(bike_id)
        if not bike:
            raise ValueError(f"Unknown bike: {bike_id}")
        return {
            "access_token":     bike["linka_token"],
            "mac_addr":         bike["mac_addr"],
            "schedule":         True,
            "firmware_version": bike.get("firmware_version", "2.6.15"),
            "smartkey_mac":     "",
        }


# Module-level singleton — imported by routes and services
registry = BikeRegistry()

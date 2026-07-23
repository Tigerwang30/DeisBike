// ─── Domain models ───────────────────────────────────────────────────────────

export interface Bike {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  available: boolean;
}

export interface Ride {
  rideId: string;
  bikeId: string;
  startTime: string;
  duration?: number;
}

// ─── Context value shapes ─────────────────────────────────────────────────────

export interface RideStatusState {
  active: boolean;
  sessionId: string | null;
  bikeId: string | null;
  startTime: string | null;
  currentDuration: number;
  status: string | null;
  loading: boolean;
  error: string | null;
}

export interface RideStatus extends RideStatusState {
  refresh: () => void;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ActiveRideResponse {
  active: boolean;
  sessionId?: string;
  bikeId?: string;
  startTime?: string;
  currentDuration?: number;
  status?: string;
}

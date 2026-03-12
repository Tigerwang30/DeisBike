// ─── Domain models ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  photo: string | null;
  hasSignedWaiver: boolean;
  moodleApproved: boolean;
  isAdmin: boolean;
}

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
  userId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: string;
  chainUnlocked?: boolean;
  wheelUnlocked?: boolean;
}

export interface ReportSummary {
  totalRides: number;
  totalDuration: number;
  averageDuration: number;
  firstRide: string | null;
  lastRide: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  hasSignedWaiver: boolean;
  moodleApproved: boolean;
  isAdmin: boolean;
  createdAt?: string;
}

export interface PendingApproval {
  id: string;
  email: string;
  displayName: string;
  waiverSignedAt?: string;
  createdAt?: string;
}

export interface AdminStats {
  totalUsers: number;
  approvedUsers: number;
  waiverSigned: number;
  totalRides: number;
  timestamp: string;
}

// ─── Context value shapes ─────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  signWaiver: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

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

export interface CommandResponse {
  success: boolean;
  sessionId?: string;
  bikeId?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  message?: string;
  status?: string;
  rideId?: string;
  nextStep?: string;
}

export interface ActiveRideResponse {
  active: boolean;
  sessionId?: string;
  bikeId?: string;
  startTime?: string;
  currentDuration?: number;
  status?: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: Partial<User> | null;
}

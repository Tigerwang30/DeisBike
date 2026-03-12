import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useRideStatus } from '../hooks/useRideStatus';
import type { RideStatus } from '../types';

const RideContext = createContext<RideStatus | null>(null);

/**
 * Provides app-wide access to the current ride status.
 * Wraps the useRideStatus polling hook so any component can read ride state
 * without each page re-implementing its own polling loop.
 *
 * Usage: wrap your route tree with <RideProvider>, then call useRide() anywhere.
 */
export function RideProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Only poll when the user is fully approved and logged in
  const rideStatus = useRideStatus(!!user?.moodleApproved);

  return (
    <RideContext.Provider value={rideStatus}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide(): RideStatus {
  const context = useContext(RideContext);
  if (!context) {
    throw new Error('useRide must be used within a RideProvider');
  }
  return context;
}

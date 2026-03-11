import { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useRideStatus } from '../hooks/useRideStatus';

const RideContext = createContext(null);

/**
 * Provides app-wide access to the current ride status.
 * Wraps the useRideStatus polling hook so any component can read ride state
 * without each page re-implementing its own polling loop.
 *
 * Usage: wrap your route tree with <RideProvider>, then call useRide() anywhere.
 */
export function RideProvider({ children }) {
  const { user } = useAuth();
  // Only poll when the user is fully approved and logged in
  const rideStatus = useRideStatus(!!user?.moodleApproved);

  return (
    <RideContext.Provider value={rideStatus}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const context = useContext(RideContext);
  if (!context) {
    throw new Error('useRide must be used within a RideProvider');
  }
  return context;
}

import { useState, useEffect, useCallback } from 'react';
import { rideService } from '../services/rides';

/**
 * Custom hook for polling ride status
 * Provides "real-time" feel without WebSockets by polling every 10 seconds
 */
export function useRideStatus(enabled = true, pollInterval = 10000) {
  const [rideStatus, setRideStatus] = useState({
    active: false,
    sessionId: null,
    bikeId: null,
    startTime: null,
    currentDuration: 0,
    status: null,
    loading: true,
    error: null
  });

  const fetchStatus = useCallback(async () => {
    try {
      const response = await rideService.getActive();
      setRideStatus({
        active: response.active,
        sessionId: response.sessionId || null,
        bikeId: response.bikeId || null,
        startTime: response.startTime || null,
        currentDuration: response.currentDuration || 0,
        status: response.status || null,
        loading: false,
        error: null
      });
    } catch (err) {
      setRideStatus(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to fetch ride status'
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchStatus();
    }
  }, [enabled, fetchStatus]);

  // Polling
  useEffect(() => {
    if (!enabled || !rideStatus.active) return;

    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [enabled, rideStatus.active, pollInterval, fetchStatus]);

  return {
    ...rideStatus,
    refresh: fetchStatus
  };
}

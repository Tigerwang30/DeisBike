import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRide } from '../context/RideContext';
import { commandService } from '../services/commands';
import type { Bike } from '../types';

type ActionState = 'idle' | 'unlocking' | 'locking';

function RideModePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialBike: Bike | undefined = location.state?.bike;

  // Server-authoritative ride state from RideContext (replaces inline polling)
  const { active, sessionId, bikeId, currentDuration, loading: rideLoading, refresh } = useRide();

  const [bike, setBike] = useState<Bike | undefined>(initialBike);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  // Local second ticker — seeded from server duration, increments every second for smooth display
  const [localSeconds, setLocalSeconds] = useState(0);

  // Sync local timer to server-authoritative duration whenever context updates
  useEffect(() => {
    setLocalSeconds(currentDuration * 60);
  }, [currentDuration]);

  // Local 1s ticker runs only while a ride is active
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setLocalSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);

  // If context reports an active ride but no bike was passed via nav state, reconstruct it
  useEffect(() => {
    if (active && !bike && bikeId) {
      setBike({ id: bikeId, name: `Bike ${bikeId}`, location: '', lat: 0, lng: 0, available: false });
    }
  }, [active, bike, bikeId]);

  const handleOpen = async () => {
    if (!bike) {
      setError('No bike selected. Go back to the map and pick a bike.');
      return;
    }
    setError(null);
    setActionState('unlocking');
    try {
      await commandService.open(bike.id);
      await refresh(); // Pull updated session into RideContext
      setActionState('idle');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to unlock bike. Please try again.');
      setActionState('idle');
    }
  };

  const handleLock = async () => {
    if (!sessionId) return;
    setError(null);
    setActionState('locking');
    try {
      await commandService.lock(sessionId);
      navigate('/history', { state: { rideEnded: true } });
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to lock bike. Please try again.');
      setActionState('idle');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (rideLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue" />
      </div>
    );
  }

  if (!bike && !active) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card text-center">
          <h1 className="text-2xl font-bold text-brandeis-blue mb-4">No Bike Selected</h1>
          <p className="text-gray-600 mb-6">Select a bike from the map to get started.</p>
          <button onClick={() => navigate('/map')} className="btn-primary">
            Go to Map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-brandeis-blue mb-6">Bike Control</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Bike info */}
        {bike && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="font-semibold">{bike.name || `Bike ${bike.id}`}</p>
            {bike.location && <p className="text-gray-600 text-sm">{bike.location}</p>}
          </div>
        )}

        {/* Status indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className={`w-4 h-4 rounded-full mr-3 ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-lg font-medium text-gray-700">
            {active ? 'Unlocked — Ride in Progress' : 'Locked'}
          </span>
        </div>

        {/* Ride timer (shown while unlocked) */}
        {active && (
          <div className="text-center mb-8">
            <p className="text-gray-500 text-sm mb-1">Duration</p>
            <p className="text-5xl font-bold text-brandeis-blue">{formatDuration(localSeconds)}</p>
          </div>
        )}

        {/* Loading spinner */}
        {(actionState === 'unlocking' || actionState === 'locking') && (
          <div className="flex flex-col items-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue mb-3" />
            <p className="text-gray-600">
              {actionState === 'unlocking' ? 'Unlocking bike...' : 'Locking bike...'}
            </p>
          </div>
        )}

        {/* Open button */}
        {!active && actionState === 'idle' && (
          <button onClick={handleOpen} className="w-full btn-primary py-4 text-lg">
            Open (Unlock)
          </button>
        )}

        {/* Lock button */}
        {active && actionState === 'idle' && (
          <button
            onClick={handleLock}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-semibold text-lg transition-colors"
          >
            Lock Bike
          </button>
        )}
      </div>
    </div>
  );
}

export default RideModePage;

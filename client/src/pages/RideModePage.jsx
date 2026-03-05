import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { commandService, rideService } from '../services/api';

function RideModePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialBike = location.state?.bike;

  const [status, setStatus] = useState('idle'); // idle, unlocked, locking, unlocking, ending
  const [session, setSession] = useState(null);
  const [bike, setBike] = useState(initialBike);
  const [error, setError] = useState(null);
  const [rideDuration, setRideDuration] = useState(0);

  // Check for an already-active ride on mount
  useEffect(() => {
    checkActiveRide();
  }, []);

  // Tick the ride timer every second when unlocked
  useEffect(() => {
    if (status !== 'unlocked') return;
    const interval = setInterval(() => setRideDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const checkActiveRide = async () => {
    try {
      const response = await rideService.getActive();
      if (response.active) {
        setSession({ sessionId: response.sessionId });
        setBike({ id: response.bikeId, name: `Bike ${response.bikeId}` });
        setRideDuration((response.currentDuration || 0) * 60);
        setStatus('unlocked');
      }
    } catch (err) {
      // No active ride — that's fine
    }
  };

  const handleOpen = async () => {
    if (!bike) {
      setError('No bike selected. Go back to the map and pick a bike.');
      return;
    }
    setError(null);
    setStatus('unlocking');
    try {
      const response = await commandService.open(bike.id);
      setSession(response);
      setRideDuration(0);
      setStatus('unlocked');
    } catch (err) {
      setError(err.message || 'Failed to unlock bike. Please try again.');
      setStatus('idle');
    }
  };

  const handleLock = async () => {
    if (!session?.sessionId) return;
    setError(null);
    setStatus('locking');
    try {
      await commandService.lock(session.sessionId);
      navigate('/history', { state: { rideEnded: true } });
    } catch (err) {
      setError(err.message || 'Failed to lock bike. Please try again.');
      setStatus('unlocked');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!bike && status === 'idle') {
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
          <div className={`w-4 h-4 rounded-full mr-3 ${status === 'unlocked' ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-lg font-medium text-gray-700">
            {status === 'unlocked' ? 'Unlocked — Ride in Progress' : 'Locked'}
          </span>
        </div>

        {/* Ride timer (shown while unlocked) */}
        {status === 'unlocked' && (
          <div className="text-center mb-8">
            <p className="text-gray-500 text-sm mb-1">Duration</p>
            <p className="text-5xl font-bold text-brandeis-blue">{formatDuration(rideDuration)}</p>
          </div>
        )}

        {/* Loading spinner */}
        {(status === 'unlocking' || status === 'locking') && (
          <div className="flex flex-col items-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue mb-3" />
            <p className="text-gray-600">
              {status === 'unlocking' ? 'Unlocking bike...' : 'Locking bike...'}
            </p>
          </div>
        )}

        {/* Open button */}
        {status === 'idle' && (
          <button
            onClick={handleOpen}
            className="w-full btn-primary py-4 text-lg"
          >
            Open (Unlock)
          </button>
        )}

        {/* Lock button */}
        {status === 'unlocked' && (
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

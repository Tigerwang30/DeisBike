import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { commandService, rideService } from '../services/api';

function RideModePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialBike = location.state?.bike;

  const [step, setStep] = useState('idle'); // idle, unlocking_chain, chain_unlocked, unlocking_wheel, riding, ending
  const [session, setSession] = useState(null);
  const [bike, setBike] = useState(initialBike);
  const [chainSecured, setChainSecured] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rideDuration, setRideDuration] = useState(0);

  // Check for active ride on mount
  useEffect(() => {
    checkActiveRide();
  }, []);

  // Poll ride status every 10 seconds when riding
  useEffect(() => {
    if (step !== 'riding') return;

    const interval = setInterval(() => {
      checkActiveRide();
      // Update duration locally
      setRideDuration((prev) => prev + 10);
    }, 10000);

    return () => clearInterval(interval);
  }, [step]);

  const checkActiveRide = async () => {
    try {
      const response = await rideService.getActive();
      if (response.active) {
        setSession({ sessionId: response.sessionId });
        setBike({ id: response.bikeId, name: `Bike ${response.bikeId}` });
        setRideDuration(response.currentDuration * 60 || 0);
        setStep('riding');
      }
    } catch (err) {
      console.error('Failed to check active ride:', err);
    }
  };

  const handleUnlockChain = async () => {
    if (!bike) {
      setError('No bike selected. Please go back to the map and select a bike.');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('unlocking_chain');

    try {
      const response = await commandService.unlockChain(bike.id);
      setSession(response);
      setStep('chain_unlocked');
    } catch (err) {
      setError(err.message || 'Failed to unlock chain. Please try again.');
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmChainSecured = async () => {
    if (!chainSecured || !session?.sessionId) return;

    setLoading(true);
    setError(null);
    setStep('unlocking_wheel');

    try {
      const response = await commandService.unlockWheel(session.sessionId);
      setSession(response);
      setStep('riding');
      setRideDuration(0);
    } catch (err) {
      setError(err.message || 'Failed to unlock wheel. Please try again.');
      setStep('chain_unlocked');
    } finally {
      setLoading(false);
    }
  };

  const handleEndRide = async () => {
    if (!session?.sessionId) return;

    setLoading(true);
    setError(null);
    setStep('ending');

    try {
      await commandService.lock(session.sessionId);
      navigate('/history', { state: { rideEnded: true } });
    } catch (err) {
      setError(err.message || 'Failed to end ride. Please try again.');
      setStep('riding');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // No bike and no active ride
  if (!bike && step === 'idle') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card text-center">
          <h1 className="text-2xl font-bold text-brandeis-blue mb-4">No Active Ride</h1>
          <p className="text-gray-600 mb-6">
            Select a bike from the map to start a ride.
          </p>
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
        <h1 className="text-2xl font-bold text-brandeis-blue mb-6">
          {step === 'riding' ? 'Ride in Progress' : 'Start Your Ride'}
        </h1>

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

        {/* Step 1: Initial state - Start unlock */}
        {step === 'idle' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                Press the button below to unlock the TetherSense chain.
                You'll need to secure the chain before unlocking the rear wheel.
              </p>
            </div>
            <button
              onClick={handleUnlockChain}
              disabled={loading}
              className="w-full btn-primary py-3 text-lg disabled:opacity-50"
            >
              {loading ? 'Unlocking...' : 'Unlock Chain'}
            </button>
          </div>
        )}

        {/* Step 2: Chain unlocked - Confirm chain secured */}
        {step === 'chain_unlocked' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-semibold text-green-700 mb-2">
                Chain Unlocked!
              </p>
              <p className="text-sm text-green-600">
                Remove the chain from the bike rack and secure it around your waist
                or in the provided holder. Then confirm below.
              </p>
            </div>

            <label className="flex items-center space-x-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={chainSecured}
                onChange={(e) => setChainSecured(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-brandeis-blue focus:ring-brandeis-blue"
              />
              <span className="font-medium">I have secured the chain</span>
            </label>

            <button
              onClick={handleConfirmChainSecured}
              disabled={!chainSecured || loading}
              className="w-full btn-secondary py-3 text-lg disabled:opacity-50"
            >
              {loading ? 'Unlocking Wheel...' : 'Confirm & Unlock Wheel'}
            </button>
          </div>
        )}

        {/* Step 3: Riding */}
        {step === 'riding' && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <p className="text-gray-600 mb-2">Ride Duration</p>
              <p className="text-5xl font-bold text-brandeis-blue">
                {formatDuration(rideDuration)}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700">
                <strong>Enjoy your ride!</strong> When you're done, return the bike
                to any DeisBikes station and plug in the TetherSense chain.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-700">
                <strong>Tip:</strong> The ride will automatically end when you
                plug the TetherSense chain back in at a station.
              </p>
            </div>

            <button
              onClick={handleEndRide}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Ending Ride...' : 'End Ride Manually'}
            </button>
          </div>
        )}

        {/* Loading states */}
        {(step === 'unlocking_chain' || step === 'unlocking_wheel' || step === 'ending') && (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue mb-4"></div>
            <p className="text-gray-600">
              {step === 'unlocking_chain' && 'Unlocking chain...'}
              {step === 'unlocking_wheel' && 'Unlocking rear wheel...'}
              {step === 'ending' && 'Ending ride...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RideModePage;

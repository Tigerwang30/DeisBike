import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bikeService } from '../services/bikes';
import type { Bike } from '../types';

function MapPage() {
  const navigate = useNavigate();
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);

  useEffect(() => {
    fetchBikes();
  }, []);

  const fetchBikes = async () => {
    try {
      const response = await bikeService.getAll();
      setBikes(Array.isArray(response) ? response : []);
    } catch (err) {
      setError('Failed to load bike locations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRide = (bike: Bike) => {
    navigate('/ride', { state: { bike } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brandeis-blue">Find a Bike</h1>
        <button
          onClick={fetchBikes}
          className="text-sm text-brandeis-blue hover:underline"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Map placeholder - In production, integrate with Google Maps or Mapbox */}
      <div className="card">
        <div className="bg-gray-200 rounded-lg h-64 flex items-center justify-center mb-4">
          <div className="text-center text-gray-500">
            <p className="font-semibold">Brandeis Campus Map</p>
            <p className="text-sm">Map integration placeholder</p>
            <p className="text-xs mt-2">Integrate with Google Maps or Mapbox API</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Select a bike below to start your ride
        </p>
      </div>

      {/* Bike list */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bikes.map((bike) => (
          <div
            key={bike.id}
            className={`card cursor-pointer transition-all hover:shadow-lg ${
              selectedBike?.id === bike.id ? 'ring-2 ring-brandeis-blue' : ''
            }`}
            onClick={() => setSelectedBike(bike)}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{bike.name}</h3>
                <p className="text-gray-600 text-sm">{bike.location}</p>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  bike.available
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {bike.available ? 'Available' : 'In Use'}
              </span>
            </div>

            {selectedBike?.id === bike.id && bike.available && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartRide(bike);
                }}
                className="w-full btn-secondary mt-4"
              >
                Start Ride
              </button>
            )}
          </div>
        ))}
      </div>

      {bikes.length === 0 && !error && (
        <div className="text-center text-gray-500 py-8">
          No bikes available at the moment. Please check back later.
        </div>
      )}

      {/* Quick info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">How to Use</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Select an available bike from the list above</li>
          <li>Click "Start Ride" to unlock the TetherSense chain</li>
          <li>Secure the chain and confirm to unlock the rear wheel</li>
          <li>Return the bike to any DeisBikes station when done</li>
        </ol>
      </div>
    </div>
  );
}

export default MapPage;

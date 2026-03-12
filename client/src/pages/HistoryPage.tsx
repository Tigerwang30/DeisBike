import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { rideService } from '../services/rides';
import { reportService } from '../services/reports';
import type { Ride, ReportSummary } from '../types';

function HistoryPage() {
  const location = useLocation();
  const rideEnded: boolean = location.state?.rideEnded;

  const [rides, setRides] = useState<Ride[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [historyRes, summaryRes] = await Promise.all([
        rideService.getHistory(),
        reportService.getSummary()
      ]);
      setRides(Array.isArray(historyRes) ? historyRes : []);
      setSummary(summaryRes);
    } catch (err) {
      setError('Failed to load ride history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
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
      {rideEnded && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          Ride completed successfully! Thanks for using DeisBikes.
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brandeis-blue">Ride History</h1>
        {rides.length > 0 && (
          <button
            onClick={() => reportService.downloadHistoryPDF()}
            className="btn-primary text-sm"
          >
            Download PDF
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-brandeis-blue">{summary.totalRides}</p>
            <p className="text-gray-600 text-sm">Total Rides</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-brandeis-blue">{summary.totalDuration}</p>
            <p className="text-gray-600 text-sm">Total Minutes</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-brandeis-blue">{summary.averageDuration}</p>
            <p className="text-gray-600 text-sm">Avg. Duration (min)</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-brandeis-gold">
              {summary.totalRides > 0 ? Math.round(summary.totalDuration * 0.4) : 0}
            </p>
            <p className="text-gray-600 text-sm">Est. Cal. Burned</p>
          </div>
        </div>
      )}

      {/* Ride list */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Recent Rides</h2>

        {rides.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No rides yet. Start your first ride from the map!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rides.map((ride, index) => (
              <div
                key={ride.rideId || index}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{ride.bikeId}</p>
                    <p className="text-gray-600 text-sm">
                      {formatDate(ride.startTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-brandeis-blue">
                      {ride.duration || 0} min
                    </p>
                    <button
                      onClick={() => reportService.downloadRidePDF(ride.rideId)}
                      className="text-sm text-brandeis-blue hover:underline"
                    >
                      Receipt
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Environmental impact (fun feature) */}
      {summary && summary.totalRides > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-800 mb-2">Your Environmental Impact</h3>
          <p className="text-sm text-green-700">
            By biking instead of driving, you've helped reduce approximately{' '}
            <strong>{Math.round(summary.totalDuration * 0.2)} lbs</strong> of CO2 emissions.
            Keep riding!
          </p>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;

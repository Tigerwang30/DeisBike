import express from 'express';
import { ensureAuthenticated, ensureFullyApproved } from '../middleware/auth.js';
import { lockService, activeSessions } from '../services/LockService.js';

const router = express.Router();

// In-memory ride history for prototype
const rideHistory = new Map();

// Get user's ride history
router.get('/history', ensureAuthenticated, (req, res) => {
  const userId = req.user.id;
  const userRides = rideHistory.get(userId) || [];

  res.json({
    rides: userRides.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
  });
});

// Get active ride status (for polling)
router.get('/active', ensureFullyApproved, (req, res) => {
  const userId = req.user.id;
  const session = lockService.getActiveSession(userId);

  if (!session) {
    return res.json({ active: false });
  }

  // Calculate current duration
  const now = new Date();
  const duration = session.startTime
    ? Math.round((now - new Date(session.startTime)) / 1000 / 60)
    : 0;

  res.json({
    active: true,
    sessionId: session.sessionId,
    bikeId: session.bikeId,
    startTime: session.startTime,
    currentDuration: duration,
    status: session.status
  });
});

// Get specific ride details
router.get('/:rideId', ensureAuthenticated, (req, res) => {
  const { rideId } = req.params;
  const userId = req.user.id;

  const userRides = rideHistory.get(userId) || [];
  const ride = userRides.find(r => r.rideId === rideId);

  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  res.json(ride);
});

// Store completed ride (called internally after ride ends)
export function saveRide(userId, rideData) {
  if (!rideHistory.has(userId)) {
    rideHistory.set(userId, []);
  }
  rideHistory.get(userId).push(rideData);
}

export default router;
export { rideHistory };

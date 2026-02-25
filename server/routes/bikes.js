import express from 'express';
import { ensureAuthenticated, ensureFullyApproved } from '../middleware/auth.js';
import { lockService } from '../services/LockService.js';

const router = express.Router();

// Get bike inventory from env (prototype) or database (production)
function getBikeInventory() {
  try {
    const bikeIds = JSON.parse(process.env.BIKE_IDS || '[]');
    return bikeIds;
  } catch {
    return ['5000']; // Default: Leo2 Pro lock
  }
}

// Get all available bikes
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const bikeIds = getBikeInventory();
    const bikes = await Promise.all(
      bikeIds.map(async (bikeId) => {
        const status = await lockService.getLockStatus(bikeId);
        return {
          id: bikeId,
          ...status,
          available: status.chainLocked && status.wheelLocked
        };
      })
    );

    res.json({ bikes });
  } catch (error) {
    console.error('Error fetching bikes:', error);
    res.status(500).json({ error: 'Failed to fetch bike inventory' });
  }
});

// Get single bike status
router.get('/:bikeId', ensureAuthenticated, async (req, res) => {
  try {
    const { bikeId } = req.params;
    const status = await lockService.getLockStatus(bikeId);
    res.json(status);
  } catch (error) {
    console.error('Error fetching bike status:', error);
    res.status(500).json({ error: 'Failed to fetch bike status' });
  }
});

// Get bike locations (for map display)
router.get('/locations/all', ensureAuthenticated, async (req, res) => {
  // Prototype: Return hardcoded Brandeis campus locations
  const locations = [
    {
      id: '5000',
      name: 'Leo2 Pro — 125Q03004310',
      lat: 42.3656,
      lng: -71.2591,
      location: 'Shapiro Campus Center',
      available: true
    }
  ];

  res.json({ locations });
});

export default router;

import express from 'express';
import { ensureFullyApproved } from '../middleware/auth.js';
import { lockService } from '../services/LockService.js';

const router = express.Router();

/**
 * POST /command - Single endpoint for all lock commands
 * Keeps sensitive API keys hidden from frontend
 */
router.post('/', ensureFullyApproved, async (req, res) => {
  const { action, bikeId, sessionId } = req.body;
  const userId = req.user.id;

  try {
    switch (action) {
      case 'unlock_chain': {
        // Step 1: Unlock TetherSense chain
        if (!bikeId) {
          return res.status(400).json({ error: 'bikeId is required' });
        }

        // Check if user already has an active ride
        const existingSession = lockService.getActiveSession(userId);
        if (existingSession) {
          return res.status(400).json({
            error: 'You already have an active ride',
            sessionId: existingSession.sessionId
          });
        }

        const chainResult = await lockService.unlockChain(bikeId, userId);
        res.json(chainResult);
        break;
      }

      case 'unlock_wheel': {
        // Step 2: Unlock rear wheel after chain confirmation
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId is required' });
        }

        const wheelResult = await lockService.unlockWheel(sessionId);
        res.json(wheelResult);
        break;
      }

      case 'lock': {
        // End ride - lock the bike
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId is required' });
        }

        const lockResult = await lockService.lockBike(sessionId);
        res.json(lockResult);
        break;
      }

      case 'status': {
        // Get current lock status
        if (!bikeId) {
          return res.status(400).json({ error: 'bikeId is required' });
        }

        const status = await lockService.getLockStatus(bikeId);
        res.json(status);
        break;
      }

      case 'active_session': {
        // Get user's active session
        const session = lockService.getActiveSession(userId);
        res.json({ session });
        break;
      }

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Command error:', error);
    res.status(500).json({ error: error.message || 'Command failed' });
  }
});

// Webhook endpoint for LINKA auto-lock events
router.post('/webhook', async (req, res) => {
  // Verify webhook signature in production
  const signature = req.headers['x-linka-signature'];

  // For prototype, accept all webhooks
  try {
    const result = await lockService.handleWebhook(req.body);
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;

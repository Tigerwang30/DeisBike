import express from 'express';
import { ensureAdmin } from '../middleware/auth.js';
import { users } from '../config/passport.js';
import { rideHistory } from './rides.js';

const router = express.Router();

// Get all users
router.get('/users', ensureAdmin, (req, res) => {
  const userList = Array.from(users.values()).map(user => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    hasSignedWaiver: user.hasSignedWaiver,
    moodleApproved: user.moodleApproved,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt
  }));

  res.json({ users: userList });
});

// Approve user's Moodle course completion
router.post('/users/:userId/approve-moodle', ensureAdmin, (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.moodleApproved = true;
  user.moodleApprovedAt = new Date();
  user.moodleApprovedBy = req.user.id;
  users.set(userId, user);

  res.json({
    success: true,
    message: `Moodle course approved for ${user.displayName}`,
    user: {
      id: user.id,
      email: user.email,
      moodleApproved: user.moodleApproved
    }
  });
});

// Revoke user's Moodle approval
router.post('/users/:userId/revoke-moodle', ensureAdmin, (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.moodleApproved = false;
  users.set(userId, user);

  res.json({
    success: true,
    message: `Moodle approval revoked for ${user.displayName}`
  });
});

// Grant admin privileges
router.post('/users/:userId/grant-admin', ensureAdmin, (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.isAdmin = true;
  users.set(userId, user);

  res.json({
    success: true,
    message: `Admin privileges granted to ${user.displayName}`
  });
});

// Get system stats
router.get('/stats', ensureAdmin, (req, res) => {
  const totalUsers = users.size;
  const approvedUsers = Array.from(users.values()).filter(u => u.moodleApproved).length;
  const waiverSigned = Array.from(users.values()).filter(u => u.hasSignedWaiver).length;

  let totalRides = 0;
  for (const [userId, rides] of rideHistory) {
    totalRides += rides.length;
  }

  res.json({
    totalUsers,
    approvedUsers,
    waiverSigned,
    totalRides,
    timestamp: new Date().toISOString()
  });
});

// Get pending approvals (users who signed waiver but need Moodle approval)
router.get('/pending-approvals', ensureAdmin, (req, res) => {
  const pending = Array.from(users.values())
    .filter(u => u.hasSignedWaiver && !u.moodleApproved)
    .map(user => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      waiverSignedAt: user.waiverSignedAt,
      createdAt: user.createdAt
    }));

  res.json({ pendingApprovals: pending });
});

export default router;

import express from 'express';
import passport from 'passport';
import { users } from '../config/passport.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Initiate Google OAuth login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  hd: 'brandeis.edu' // Hint to only show Brandeis accounts
}));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=auth_failed`
  }),
  (req, res) => {
    // Redirect based on user status
    if (!req.user.hasSignedWaiver) {
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/waiver`);
    } else if (!req.user.moodleApproved) {
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/safety-course`);
    } else {
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/map`);
    }
  }
);

// Get current user
router.get('/me', ensureAuthenticated, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    displayName: req.user.displayName,
    photo: req.user.photo,
    hasSignedWaiver: req.user.hasSignedWaiver,
    moodleApproved: req.user.moodleApproved,
    isAdmin: req.user.isAdmin
  });
});

// Sign waiver
router.post('/waiver', ensureAuthenticated, (req, res) => {
  const { agreed } = req.body;

  if (!agreed) {
    return res.status(400).json({ error: 'You must agree to the waiver' });
  }

  // Update user's waiver status
  const user = users.get(req.user.id);
  if (user) {
    user.hasSignedWaiver = true;
    user.waiverSignedAt = new Date();
    users.set(req.user.id, user);
  }

  res.json({
    success: true,
    message: 'Waiver signed successfully',
    nextStep: req.user.moodleApproved ? '/map' : '/safety-course'
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check auth status (no auth required)
router.get('/status', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user ? {
      displayName: req.user.displayName,
      hasSignedWaiver: req.user.hasSignedWaiver,
      moodleApproved: req.user.moodleApproved
    } : null
  });
});

export default router;

// Ensure user is authenticated
export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// Ensure user has signed waiver
export function ensureWaiverSigned(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.hasSignedWaiver) {
    return res.status(403).json({
      error: 'Waiver required',
      redirectTo: '/waiver'
    });
  }
  return next();
}

// Ensure user has completed Moodle course (admin approved)
export function ensureMoodleApproved(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.moodleApproved) {
    return res.status(403).json({
      error: 'Safety course completion required',
      redirectTo: '/safety-course'
    });
  }
  return next();
}

// Ensure user is fully approved (waiver + moodle)
export function ensureFullyApproved(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.hasSignedWaiver) {
    return res.status(403).json({
      error: 'Waiver required',
      redirectTo: '/waiver'
    });
  }
  if (!req.user.moodleApproved) {
    return res.status(403).json({
      error: 'Safety course completion required',
      redirectTo: '/safety-course'
    });
  }
  return next();
}

// Ensure user is admin
export function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

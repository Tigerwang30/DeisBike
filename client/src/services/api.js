const API_BASE = '';

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Auth service
export const authService = {
  getStatus: () => fetchAPI('/auth/status'),
  getMe: () => fetchAPI('/auth/me'),
  signWaiver: () => fetchAPI('/auth/waiver', {
    method: 'POST',
    body: JSON.stringify({ agreed: true })
  }),
  logout: () => fetchAPI('/auth/logout', { method: 'POST' })
};

// Bike service
export const bikeService = {
  getAll: () => fetchAPI('/api/bikes'),
  getLocations: () => fetchAPI('/api/bikes/locations/all'),
  getStatus: (bikeId) => fetchAPI(`/api/bikes/${bikeId}`)
};

// Command service (lock control)
export const commandService = {
  open: (bikeId) => fetchAPI('/api/command', {
    method: 'POST',
    body: JSON.stringify({ action: 'open', bikeId })
  }),
  unlockChain: (bikeId) => fetchAPI('/api/command', {
    method: 'POST',
    body: JSON.stringify({ action: 'unlock_chain', bikeId })
  }),
  unlockWheel: (sessionId) => fetchAPI('/api/command', {
    method: 'POST',
    body: JSON.stringify({ action: 'unlock_wheel', sessionId })
  }),
  lock: (sessionId) => fetchAPI('/api/command', {
    method: 'POST',
    body: JSON.stringify({ action: 'lock', sessionId })
  }),
  getActiveSession: () => fetchAPI('/api/command', {
    method: 'POST',
    body: JSON.stringify({ action: 'active_session' })
  })
};

// Ride service
export const rideService = {
  getActive: () => fetchAPI('/api/rides/active'),
  getHistory: () => fetchAPI('/api/rides/history'),
  getRide: (rideId) => fetchAPI(`/api/rides/${rideId}`)
};

// Report service
export const reportService = {
  getSummary: () => fetchAPI('/api/reports/summary'),
  downloadRidePDF: (rideId) => {
    window.open(`/api/reports/ride/${rideId}/pdf`, '_blank');
  },
  downloadHistoryPDF: () => {
    window.open('/api/reports/history/pdf', '_blank');
  }
};

// Admin service
export const adminService = {
  getUsers: () => fetchAPI('/api/admin/users'),
  getPendingApprovals: () => fetchAPI('/api/admin/pending-approvals'),
  approveMoodle: (userId) => fetchAPI(`/api/admin/users/${userId}/approve-moodle`, {
    method: 'POST'
  }),
  revokeMoodle: (userId) => fetchAPI(`/api/admin/users/${userId}/revoke-moodle`, {
    method: 'POST'
  }),
  getStats: () => fetchAPI('/api/admin/stats')
};

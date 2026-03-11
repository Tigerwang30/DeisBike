import { fetchAPI } from './http';

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

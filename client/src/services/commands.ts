import { fetchAPI } from './http';

export const commandService = {
  open: (bikeId: string): Promise<unknown> =>
    fetchAPI('/api/command', {
      method: 'POST',
      body: JSON.stringify({ action: 'open', bikeId })
    }),

  lock: (sessionId: string): Promise<unknown> =>
    fetchAPI('/api/command', {
      method: 'POST',
      body: JSON.stringify({ action: 'lock', sessionId })
    })
};

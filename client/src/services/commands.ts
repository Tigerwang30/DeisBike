import { fetchAPI } from './http';
import type { CommandResponse, ActiveRideResponse } from '../types';

export const commandService = {
  open: (bikeId: string): Promise<CommandResponse> =>
    fetchAPI('/api/command', {
      method: 'POST',
      body: JSON.stringify({ action: 'open', bikeId })
    }) as Promise<CommandResponse>,

  unlockChain: (bikeId: string): Promise<CommandResponse> =>
    fetchAPI('/api/command', {
      method: 'POST',
      body: JSON.stringify({ action: 'unlock_chain', bikeId })
    }) as Promise<CommandResponse>,

  unlockWheel: (sessionId: string): Promise<CommandResponse> =>
    fetchAPI('/api/command', {
      method: 'POST',
      body: JSON.stringify({ action: 'unlock_wheel', sessionId })
    }) as Promise<CommandResponse>,

  lock: (sessionId: string): Promise<CommandResponse> =>
    fetchAPI('/api/command', {
      method: 'POST',
      body: JSON.stringify({ action: 'lock', sessionId })
    }) as Promise<CommandResponse>,

  getActiveSession: (): Promise<{ session: ActiveRideResponse | null }> =>
    fetchAPI('/api/command', {
      method: 'POST',
      body: JSON.stringify({ action: 'active_session' })
    }) as Promise<{ session: ActiveRideResponse | null }>
};

import { fetchAPI } from './http';
import type { AuthStatusResponse, User } from '../types';

export const authService = {
  getStatus: (): Promise<AuthStatusResponse> =>
    fetchAPI('/auth/status') as Promise<AuthStatusResponse>,
  getMe: (): Promise<User> =>
    fetchAPI('/auth/me') as Promise<User>,
  signWaiver: (): Promise<unknown> =>
    fetchAPI('/auth/waiver', { method: 'POST', body: JSON.stringify({ agreed: true }) }),
  logout: (): Promise<unknown> =>
    fetchAPI('/auth/logout', { method: 'POST' })
};

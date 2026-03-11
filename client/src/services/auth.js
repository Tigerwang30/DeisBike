import { fetchAPI } from './http';

export const authService = {
  getStatus: () => fetchAPI('/auth/status'),
  getMe:     () => fetchAPI('/auth/me'),
  signWaiver: () => fetchAPI('/auth/waiver', {
    method: 'POST',
    body: JSON.stringify({ agreed: true })
  }),
  logout: () => fetchAPI('/auth/logout', { method: 'POST' })
};

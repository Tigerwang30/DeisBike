import { fetchAPI } from './http';

export const adminService = {
  getUsers:           () => fetchAPI('/api/admin/users'),
  getPendingApprovals: () => fetchAPI('/api/admin/pending-approvals'),
  approveMoodle: (userId) => fetchAPI(`/api/admin/users/${userId}/approve-moodle`, {
    method: 'POST'
  }),
  revokeMoodle: (userId) => fetchAPI(`/api/admin/users/${userId}/revoke-moodle`, {
    method: 'POST'
  }),
  getStats: () => fetchAPI('/api/admin/stats')
};

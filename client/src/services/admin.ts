import { fetchAPI } from './http';
import type { AdminUser, PendingApproval, AdminStats } from '../types';

export const adminService = {
  getUsers: (): Promise<{ users: AdminUser[] }> =>
    fetchAPI('/api/admin/users') as Promise<{ users: AdminUser[] }>,

  getPendingApprovals: (): Promise<{ pendingApprovals: PendingApproval[] }> =>
    fetchAPI('/api/admin/pending-approvals') as Promise<{ pendingApprovals: PendingApproval[] }>,

  approveMoodle: (userId: string): Promise<unknown> =>
    fetchAPI(`/api/admin/users/${userId}/approve-moodle`, { method: 'POST' }),

  revokeMoodle: (userId: string): Promise<unknown> =>
    fetchAPI(`/api/admin/users/${userId}/revoke-moodle`, { method: 'POST' }),

  getStats: (): Promise<AdminStats> =>
    fetchAPI('/api/admin/stats') as Promise<AdminStats>
};

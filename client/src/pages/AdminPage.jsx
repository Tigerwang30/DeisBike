import { useState, useEffect } from 'react';
import { adminService } from '../services/api';

function AdminPage() {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pendingRes, usersRes, statsRes] = await Promise.all([
        adminService.getPendingApprovals(),
        adminService.getUsers(),
        adminService.getStats()
      ]);
      setPendingApprovals(pendingRes.pendingApprovals || []);
      setAllUsers(usersRes.users || []);
      setStats(statsRes);
    } catch (err) {
      setError('Failed to load admin data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMoodle = async (userId, userName) => {
    if (!confirm(`Approve Moodle course completion for ${userName}?`)) return;

    setActionLoading(userId);
    try {
      await adminService.approveMoodle(userId);
      await fetchData();
    } catch (err) {
      alert('Failed to approve user: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeMoodle = async (userId, userName) => {
    if (!confirm(`Revoke Moodle approval for ${userName}?`)) return;

    setActionLoading(userId);
    try {
      await adminService.revokeMoodle(userId);
      await fetchData();
    } catch (err) {
      alert('Failed to revoke approval: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brandeis-blue">Admin Dashboard</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-brandeis-blue">{stats.totalUsers}</p>
            <p className="text-gray-600 text-sm">Total Users</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-brandeis-blue">{stats.approvedUsers}</p>
            <p className="text-gray-600 text-sm">Approved Users</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-brandeis-gold">{pendingApprovals.length}</p>
            <p className="text-gray-600 text-sm">Pending Approvals</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-brandeis-blue">{stats.totalRides}</p>
            <p className="text-gray-600 text-sm">Total Rides</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-4 font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-brandeis-blue text-brandeis-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending Approvals ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-4 font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-brandeis-blue text-brandeis-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            All Users ({allUsers.length})
          </button>
        </nav>
      </div>

      {/* Pending Approvals Tab */}
      {activeTab === 'pending' && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Users Awaiting Moodle Approval</h2>

          {pendingApprovals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No pending approvals at this time.
            </p>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map((user) => (
                <div
                  key={user.id}
                  className="border rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">{user.displayName}</p>
                    <p className="text-gray-600 text-sm">{user.email}</p>
                    <p className="text-gray-500 text-xs">
                      Waiver signed: {new Date(user.waiverSignedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleApproveMoodle(user.id, user.displayName)}
                    disabled={actionLoading === user.id}
                    className="btn-secondary disabled:opacity-50"
                  >
                    {actionLoading === user.id ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Users Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">All Registered Users</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-center py-2 px-2">Waiver</th>
                  <th className="text-center py-2 px-2">Moodle</th>
                  <th className="text-center py-2 px-2">Admin</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{user.displayName}</td>
                    <td className="py-2 px-2 text-gray-600">{user.email}</td>
                    <td className="py-2 px-2 text-center">
                      {user.hasSignedWaiver ? (
                        <span className="text-green-500">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {user.moodleApproved ? (
                        <span className="text-green-500">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {user.isAdmin ? (
                        <span className="text-brandeis-gold font-semibold">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {user.moodleApproved ? (
                        <button
                          onClick={() => handleRevokeMoodle(user.id, user.displayName)}
                          disabled={actionLoading === user.id}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Revoke
                        </button>
                      ) : user.hasSignedWaiver ? (
                        <button
                          onClick={() => handleApproveMoodle(user.id, user.displayName)}
                          disabled={actionLoading === user.id}
                          className="text-brandeis-blue hover:underline text-xs"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Admin Instructions</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Review pending approvals after users complete the Moodle safety course</li>
          <li>Verify course completion in Moodle before approving users</li>
          <li>Approved users can immediately start using bikes</li>
          <li>Revoke approval if needed for policy violations</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminPage;

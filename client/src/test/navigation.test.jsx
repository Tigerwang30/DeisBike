/**
 * Navigation tests — verify page routing and link-clicking behaviour.
 *
 * Uses MemoryRouter so we control the starting URL without a real browser.
 * The AuthContext is mocked so each test can set whatever user state it needs.
 * API service calls (bikeService, rideService, etc.) are also mocked so tests
 * never hit a real server.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

// ── Mock external API services ──────────────────────────────────────────────
vi.mock('../services/api', () => ({
  bikeService: {
    getLocations: vi.fn().mockResolvedValue({ locations: [] }),
  },
  rideService: {
    getActive:  vi.fn().mockResolvedValue({ ride: null }),
    getHistory: vi.fn().mockResolvedValue({ rides: [] }),
  },
  commandService: {
    open: vi.fn().mockResolvedValue({ success: true }),
    lock: vi.fn().mockResolvedValue({ success: true }),
  },
  authService: {
    logout:      vi.fn().mockResolvedValue({}),
    signWaiver:  vi.fn().mockResolvedValue({}),
    getStatus:   vi.fn().mockResolvedValue({ authenticated: false }),
    getMe:       vi.fn().mockResolvedValue(null),
  },
  adminService: {
    getUsers:           vi.fn().mockResolvedValue({ users: [] }),
    getPendingApprovals: vi.fn().mockResolvedValue({ pendingApprovals: [] }),
    getStats:           vi.fn().mockResolvedValue({}),
  },
  reportService: {
    getSummary: vi.fn().mockResolvedValue({ totalRides: 0 }),
  },
}));

// ── Mock AuthContext ─────────────────────────────────────────────────────────
const mockAuthValue = {
  user: null,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  signWaiver: vi.fn(),
  refreshUser: vi.fn(),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthValue,
  AuthProvider: ({ children }) => children,
}));

// ── Import components AFTER mocks ────────────────────────────────────────────
import App from '../App';
import Layout from '../components/Layout';
import LoginPage from '../pages/LoginPage';
import MapPage from '../pages/MapPage';
import WaiverPage from '../pages/WaiverPage';
import SafetyCoursePage from '../pages/SafetyCoursePage';
import HistoryPage from '../pages/HistoryPage';
import AdminPage from '../pages/AdminPage';

// ── Helper: reset mock auth state before each test ───────────────────────────
beforeEach(() => {
  mockAuthValue.user    = null;
  mockAuthValue.loading = false;
  vi.clearAllMocks();
});

// ── Helper: render full App at a given path ──────────────────────────────────
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

// ────────────────────────────────────────────────────────────────────────────
describe('Login page', () => {
  it('renders the DeisBikes heading', () => {
    renderAt('/login');
    expect(screen.getByRole('heading', { name: /DeisBikes/i })).toBeInTheDocument();
  });

  it('renders a sign-in button', () => {
    renderAt('/login');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls login() when the sign-in button is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(mockAuthValue.login).toHaveBeenCalledOnce();
  });

  it('redirects to /map if user is already logged in', async () => {
    mockAuthValue.user = {
      id: '1', displayName: 'Test', email: 'test@brandeis.edu',
      hasSignedWaiver: true, moodleApproved: true, isAdmin: false,
    };
    renderAt('/login');
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /DeisBikes/i })).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Protected route redirects (unauthenticated)', () => {
  it('redirects / to /login', async () => {
    renderAt('/');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('redirects /map to /login', async () => {
    renderAt('/map');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('redirects /ride to /login', async () => {
    renderAt('/ride');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('redirects /history to /login', async () => {
    renderAt('/history');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('redirects /admin to /login', async () => {
    renderAt('/admin');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Onboarding redirects', () => {
  it('redirects logged-in user without waiver from /map to /waiver', async () => {
    mockAuthValue.user = {
      id: '1', displayName: 'Test', email: 'test@brandeis.edu',
      hasSignedWaiver: false, moodleApproved: false, isAdmin: false,
    };
    renderAt('/map');
    await waitFor(() => {
      expect(screen.getByText(/liability waiver/i)).toBeInTheDocument();
    });
  });

  it('redirects user with waiver but no approval from /map to /safety-course', async () => {
    mockAuthValue.user = {
      id: '1', displayName: 'Test', email: 'test@brandeis.edu',
      hasSignedWaiver: true, moodleApproved: false, isAdmin: false,
    };
    renderAt('/map');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /safety course required/i })).toBeInTheDocument();
    });
  });

  it('lets fully approved user reach /map', async () => {
    mockAuthValue.user = {
      id: '1', displayName: 'Test', email: 'test@brandeis.edu',
      hasSignedWaiver: true, moodleApproved: true, isAdmin: false,
    };
    renderAt('/map');
    await waitFor(() => {
      // MapPage renders a "Start Ride" or bike-related heading
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Layout navigation bar', () => {
  function renderLayout(initialPath = '/map') {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/map"     element={<div>Map Page</div>} />
            <Route path="/ride"    element={<div>Ride Page</div>} />
            <Route path="/history" element={<div>History Page</div>} />
            <Route path="/admin"   element={<div>Admin Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    mockAuthValue.user = {
      id: '1', displayName: 'Alice', email: 'alice@brandeis.edu',
      hasSignedWaiver: true, moodleApproved: true, isAdmin: false,
    };
  });

  it('shows Map, Ride, and History links', () => {
    renderLayout();
    expect(screen.getAllByRole('link', { name: /^Map$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /^Ride$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /^History$/i }).length).toBeGreaterThan(0);
  });

  it('does NOT show Admin link for non-admin user', () => {
    renderLayout();
    expect(screen.queryByRole('link', { name: /^Admin$/i })).not.toBeInTheDocument();
  });

  it('shows Admin link for admin user', () => {
    mockAuthValue.user.isAdmin = true;
    renderLayout();
    expect(screen.getAllByRole('link', { name: /^Admin$/i }).length).toBeGreaterThan(0);
  });

  it('shows the logged-in user display name', () => {
    renderLayout();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows a Logout button', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('clicking Logout calls logout()', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(mockAuthValue.logout).toHaveBeenCalledOnce();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Clicking nav links navigates to the correct page', () => {
  beforeEach(() => {
    mockAuthValue.user = {
      id: '1', displayName: 'Alice', email: 'alice@brandeis.edu',
      hasSignedWaiver: true, moodleApproved: true, isAdmin: true,
    };
  });

  function renderNavApp(startPath = '/map') {
    return render(
      <MemoryRouter initialEntries={[startPath]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/map"     element={<div>Map Page Content</div>} />
            <Route path="/ride"    element={<div>Ride Page Content</div>} />
            <Route path="/history" element={<div>History Page Content</div>} />
            <Route path="/admin"   element={<div>Admin Page Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }

  it('clicking Ride link shows Ride page', async () => {
    const user = userEvent.setup();
    renderNavApp('/map');
    // Click the first Ride link (desktop nav)
    await user.click(screen.getAllByRole('link', { name: /^Ride$/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('Ride Page Content')).toBeInTheDocument();
    });
  });

  it('clicking History link shows History page', async () => {
    const user = userEvent.setup();
    renderNavApp('/map');
    await user.click(screen.getAllByRole('link', { name: /^History$/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('History Page Content')).toBeInTheDocument();
    });
  });

  it('clicking Admin link shows Admin page', async () => {
    const user = userEvent.setup();
    renderNavApp('/map');
    await user.click(screen.getAllByRole('link', { name: /^Admin$/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('Admin Page Content')).toBeInTheDocument();
    });
  });

  it('clicking Map link from another page returns to Map', async () => {
    const user = userEvent.setup();
    renderNavApp('/ride');
    await user.click(screen.getAllByRole('link', { name: /^Map$/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('Map Page Content')).toBeInTheDocument();
    });
  });

  it('clicking the DeisBikes logo link navigates to /map', async () => {
    const user = userEvent.setup();
    renderNavApp('/history');
    await user.click(screen.getByRole('link', { name: /DeisBikes/i }));
    await waitFor(() => {
      expect(screen.getByText('Map Page Content')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Waiver page', () => {
  beforeEach(() => {
    mockAuthValue.user = {
      id: '1', displayName: 'Alice', email: 'alice@brandeis.edu',
      hasSignedWaiver: false, moodleApproved: false, isAdmin: false,
    };
  });

  it('renders the waiver heading', () => {
    render(<MemoryRouter><WaiverPage /></MemoryRouter>);
    expect(screen.getByText(/liability waiver/i)).toBeInTheDocument();
  });

  it('submit button is disabled until checkbox is ticked', () => {
    render(<MemoryRouter><WaiverPage /></MemoryRouter>);
    const submit = screen.getByRole('button', { name: /sign waiver/i });
    expect(submit).toBeDisabled();
  });

  it('submit button enables after ticking the agree checkbox', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><WaiverPage /></MemoryRouter>);
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(screen.getByRole('button', { name: /sign waiver/i })).not.toBeDisabled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Safety course page', () => {
  it('renders Safety Course Required heading', () => {
    mockAuthValue.user = {
      id: '1', displayName: 'Alice', email: 'alice@brandeis.edu',
      hasSignedWaiver: true, moodleApproved: false, isAdmin: false,
    };
    render(<MemoryRouter><SafetyCoursePage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /safety course required/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Unknown route', () => {
  it('redirects unknown path to /map (for authenticated user)', async () => {
    mockAuthValue.user = {
      id: '1', displayName: 'Test', email: 'test@brandeis.edu',
      hasSignedWaiver: true, moodleApproved: true, isAdmin: false,
    };
    renderAt('/does-not-exist');
    // The catch-all redirects / → /map, so MapPage should load (no sign-in button)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    });
  });
});

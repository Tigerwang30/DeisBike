/**
 * LoginPage tests — verify email magic link auth UI.
 *
 * Uses MemoryRouter so we can control the URL (including ?error= params).
 * AuthContext is mocked so tests don't need a real session.
 * authService.requestMagicLink is mocked to avoid real HTTP calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Mock authService ─────────────────────────────────────────────────────────
vi.mock('../services/auth', () => ({
  authService: {
    getStatus:        vi.fn().mockResolvedValue({ authenticated: false }),
    getMe:            vi.fn().mockResolvedValue(null),
    requestMagicLink: vi.fn().mockResolvedValue({ success: true, message: 'Check your email.' }),
    signWaiver:       vi.fn().mockResolvedValue({}),
    logout:           vi.fn().mockResolvedValue({}),
  },
}));

// ── Mock AuthContext ─────────────────────────────────────────────────────────
const mockAuthValue = {
  user:        null as null | { id: string; displayName: string; email: string; hasSignedWaiver: boolean; moodleApproved: boolean; isAdmin: boolean },
  loading:     false,
  logout:      vi.fn(),
  signWaiver:  vi.fn(),
  refreshUser: vi.fn(),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { authService } from '../services/auth';

beforeEach(() => {
  mockAuthValue.user    = null;
  mockAuthValue.loading = false;
  vi.clearAllMocks();
  // Restore default mock for requestMagicLink
  vi.mocked(authService.requestMagicLink).mockResolvedValue({ success: true, message: 'Check your email.' });
});

function renderLogin(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LoginPage />
    </MemoryRouter>
  );
}

// ────────────────────────────────────────────────────────────────────────────
describe('LoginPage — initial render', () => {
  it('renders the DeisBikes heading', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: /DeisBikes/i })).toBeInTheDocument();
  });

  it('renders an email input field', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/you@brandeis\.edu/i)).toBeInTheDocument();
  });

  it('renders the "Send login link" submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument();
  });

  it('shows a note that only @brandeis.edu addresses are accepted', () => {
    renderLogin();
    expect(screen.getByText(/only @brandeis\.edu/i)).toBeInTheDocument();
  });

  it('does NOT render the removed dev-login "Skip login" backdoor', () => {
    renderLogin();
    expect(screen.queryByText(/skip login/i)).not.toBeInTheDocument();
    expect(
      document.querySelector('a[href="/auth/dev-login"]')
    ).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('LoginPage — successful form submission', () => {
  it('shows "Check your inbox" after a successful submit', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText(/you@brandeis\.edu/i), 'test@brandeis.edu');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    });
  });

  it('displays the submitted email address in the success message', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText(/you@brandeis\.edu/i), 'alice@brandeis.edu');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(screen.getByText(/alice@brandeis\.edu/i)).toBeInTheDocument();
    });
  });

  it('calls authService.requestMagicLink with the entered email', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText(/you@brandeis\.edu/i), 'bob@brandeis.edu');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(authService.requestMagicLink).toHaveBeenCalledWith('bob@brandeis.edu');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('LoginPage — error states', () => {
  it('shows an error message when the API rejects the request', async () => {
    vi.mocked(authService.requestMagicLink).mockRejectedValue(
      new Error('Failed to send email: connection refused')
    );

    const user = userEvent.setup();
    renderLogin();

    // A valid @brandeis.edu address passes client-side validation and reaches
    // the (mocked) API, which then rejects.
    await user.type(screen.getByPlaceholderText(/you@brandeis\.edu/i), 'test@brandeis.edu');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      // The red error div (distinct from the static hint paragraph)
      const errorDiv = document.querySelector('.bg-red-50.text-red-700');
      expect(errorDiv).toBeInTheDocument();
      expect(errorDiv?.textContent).toMatch(/failed to send email/i);
    });
  });

  it('rejects a non-brandeis email client-side without calling the API', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText(/you@brandeis\.edu/i), 'someone@gmail.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      const errorDiv = document.querySelector('.bg-red-50.text-red-700');
      expect(errorDiv).toBeInTheDocument();
      expect(errorDiv?.textContent).toMatch(/valid @brandeis\.edu/i);
    });
    expect(authService.requestMagicLink).not.toHaveBeenCalled();
  });

  it('shows an error banner when ?error=invalid_link is in the URL', () => {
    renderLogin('/login?error=invalid_link');
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
  });

  it('shows a generic error banner for unknown ?error= values', () => {
    renderLogin('/login?error=auth_failed');
    expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('LoginPage — "Use a different email" reset', () => {
  it('returns to the email form when "Use a different email" is clicked', async () => {
    const user = userEvent.setup();
    renderLogin();

    // Get to sent state
    await user.type(screen.getByPlaceholderText(/you@brandeis\.edu/i), 'test@brandeis.edu');
    await user.click(screen.getByRole('button', { name: /send login link/i }));
    await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeInTheDocument());

    // Click reset
    await user.click(screen.getByRole('button', { name: /use a different email/i }));

    // Form should be visible again
    expect(screen.getByPlaceholderText(/you@brandeis\.edu/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('LoginPage — already authenticated', () => {
  it('navigates away from login when user is already logged in', async () => {
    mockAuthValue.user = {
      id: '1', displayName: 'Alice', email: 'alice@brandeis.edu',
      hasSignedWaiver: true, moodleApproved: true, isAdmin: false,
    };
    // Render with a /map route so navigation can actually complete
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/map" element={<div>Map Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/you@brandeis\.edu/i)).not.toBeInTheDocument();
      expect(screen.getByText('Map Page')).toBeInTheDocument();
    });
  });
});

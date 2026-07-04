/**
 * SafetyCoursePage tests — verify the dev-only "skip safety course" button.
 *
 * The button lets a developer bypass the admin-gated Moodle approval locally.
 * It must appear ONLY when import.meta.env.DEV is true, call
 * authService.devApprove, refresh the user, and navigate to /map.
 *
 * AuthContext and authService are mocked so tests need no real session/HTTP.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Mock authService ─────────────────────────────────────────────────────────
vi.mock('../services/auth', () => ({
  authService: {
    devApprove: vi.fn().mockResolvedValue({ nextStep: '/map' }),
  },
}));

// ── Mock AuthContext ─────────────────────────────────────────────────────────
const mockAuthValue = {
  user: null as null | { moodleApproved: boolean; hasSignedWaiver: boolean },
  refreshUser: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import SafetyCoursePage from '../pages/SafetyCoursePage';
import { authService } from '../services/auth';

beforeEach(() => {
  mockAuthValue.user = { moodleApproved: false, hasSignedWaiver: true };
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/safety-course']}>
      <Routes>
        <Route path="/safety-course" element={<SafetyCoursePage />} />
        <Route path="/map" element={<div>Map Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SafetyCoursePage — dev skip button', () => {
  it('renders the dev-only skip button in development', () => {
    vi.stubEnv('DEV', true);
    renderPage();
    expect(
      screen.getByRole('button', { name: /skip safety course \(dev only\)/i })
    ).toBeInTheDocument();
  });

  it('grants approval and navigates to /map when clicked', async () => {
    vi.stubEnv('DEV', true);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /skip safety course \(dev only\)/i }));

    await waitFor(() => {
      expect(authService.devApprove).toHaveBeenCalledTimes(1);
      expect(mockAuthValue.refreshUser).toHaveBeenCalled();
      expect(screen.getByText('Map Page')).toBeInTheDocument();
    });
  });

  it('does NOT render the dev skip button in production', () => {
    vi.stubEnv('DEV', false);
    renderPage();
    expect(
      screen.queryByRole('button', { name: /skip safety course/i })
    ).not.toBeInTheDocument();
  });
});

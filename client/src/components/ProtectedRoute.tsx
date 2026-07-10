import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import Spinner from './ui/Spinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requireWaiver?: boolean;
  requireApproval?: boolean;
  requireAdmin?: boolean;
}

/**
 * Route guard: blocks children until auth has loaded and the user meets the
 * required onboarding gates, redirecting to the appropriate step otherwise.
 */
export default function ProtectedRoute({
  children,
  requireWaiver = false,
  requireApproval = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireWaiver && !user.hasSignedWaiver) {
    return <Navigate to="/waiver" replace />;
  }

  if (requireApproval && !user.moodleApproved) {
    return <Navigate to="/safety-course" replace />;
  }

  if (requireAdmin && !user.isAdmin) {
    return <Navigate to="/map" replace />;
  }

  return children;
}

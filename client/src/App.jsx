import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RideProvider } from './context/RideContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import WaiverPage from './pages/WaiverPage';
import SafetyCoursePage from './pages/SafetyCoursePage';
import MapPage from './pages/MapPage';
import RideModePage from './pages/RideModePage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children, requireWaiver = false, requireApproval = false, requireAdmin = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue"></div>
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<RideProvider><Layout /></RideProvider>}>
        <Route index element={<Navigate to="/map" replace />} />

        <Route path="waiver" element={
          <ProtectedRoute>
            <WaiverPage />
          </ProtectedRoute>
        } />

        <Route path="safety-course" element={
          <ProtectedRoute requireWaiver>
            <SafetyCoursePage />
          </ProtectedRoute>
        } />

        <Route path="map" element={
          <ProtectedRoute requireWaiver requireApproval>
            <MapPage />
          </ProtectedRoute>
        } />

        <Route path="ride" element={
          <ProtectedRoute requireWaiver requireApproval>
            <RideModePage />
          </ProtectedRoute>
        } />

        <Route path="history" element={
          <ProtectedRoute requireWaiver requireApproval>
            <HistoryPage />
          </ProtectedRoute>
        } />

        <Route path="admin" element={
          <ProtectedRoute requireAdmin>
            <AdminPage />
          </ProtectedRoute>
        } />
      </Route>
    </Routes>
  );
}

export default App;

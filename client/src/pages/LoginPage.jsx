import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (user && !loading) {
      navigate('/map');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brandeis-blue to-blue-800">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brandeis-blue mb-2">DeisBikes</h1>
          <p className="text-gray-600">Brandeis University Bike Share</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error === 'auth_failed'
              ? 'Authentication failed. Please use your Brandeis email.'
              : 'An error occurred. Please try again.'}
          </div>
        )}

        <div className="space-y-6">
          <p className="text-gray-600 text-center">
            Sign in with your Brandeis Google account to access the bike share system.
          </p>

          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 hover:border-brandeis-blue hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <p className="text-sm text-gray-500 text-center">
            Only @brandeis.edu email addresses are allowed.
          </p>

          {import.meta.env.DEV && (
            <div className="border-t pt-4">
              <p className="text-xs text-gray-400 text-center mb-2">— Dev mode —</p>
              <a
                href="/auth/dev-login"
                className="w-full block text-center bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Skip login (dev only)
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

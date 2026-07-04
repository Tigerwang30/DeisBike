import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth';

type UIState = 'idle' | 'sending' | 'sent' | 'error';

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlError = searchParams.get('error');

  const [email, setEmail]     = useState('');
  const [uiState, setUIState] = useState<UIState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUIState('sending');
    setErrorMsg('');
    try {
      await authService.requestMagicLink(email.trim().toLowerCase());
      setUIState('sent');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMsg(msg);
      setUIState('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brandeis-blue to-blue-800">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brandeis-blue mb-2">DeisBikes</h1>
          <p className="text-gray-600">Brandeis University Bike Share</p>
        </div>

        {urlError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {urlError === 'invalid_link'
              ? 'That login link is invalid or has expired. Please request a new one.'
              : 'An error occurred. Please try again.'}
          </div>
        )}

        {uiState === 'sent' ? (
          <div className="space-y-4 text-center">
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-4 rounded-lg">
              <p className="font-semibold mb-1">Check your inbox!</p>
              <p className="text-sm">A login link was sent to <strong>{email}</strong>. It expires in 15 minutes.</p>
            </div>
            <button
              onClick={() => { setUIState('idle'); setEmail(''); }}
              className="text-sm text-brandeis-blue hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-600 text-center text-sm">
              Enter your Brandeis email to receive a login link.
            </p>

            <input
              type="email"
              required
              placeholder="you@brandeis.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:border-brandeis-blue focus:ring-1 focus:ring-brandeis-blue"
            />

            {uiState === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={uiState === 'sending'}
              className="w-full bg-brandeis-blue hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {uiState === 'sending' ? 'Sending…' : 'Send login link'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Only @brandeis.edu addresses are accepted.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;

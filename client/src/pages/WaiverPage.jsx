import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function WaiverPage() {
  const { user, signWaiver, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If already signed, redirect
  if (user?.hasSignedWaiver) {
    navigate(user.moodleApproved ? '/map' : '/safety-course');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) return;

    setLoading(true);
    setError(null);

    try {
      await signWaiver();
      await refreshUser();
      navigate('/safety-course');
    } catch (err) {
      setError(err.message || 'Failed to sign waiver. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-brandeis-blue mb-6">
          Liability Waiver & Release
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-6 mb-6 max-h-96 overflow-y-auto">
          <h2 className="font-semibold mb-4">DeisBikes User Agreement</h2>

          <div className="space-y-4 text-sm text-gray-700">
            <p>
              <strong>1. Assumption of Risk:</strong> I understand that bicycling involves inherent risks,
              including but not limited to collision with vehicles, pedestrians, or objects; loss of control;
              mechanical failure; and adverse weather conditions. I voluntarily assume all such risks.
            </p>

            <p>
              <strong>2. Release of Liability:</strong> I hereby release Brandeis University, its officers,
              employees, agents, and volunteers from any and all liability for injuries, damages, or losses
              that may result from my use of the DeisBikes bike share program.
            </p>

            <p>
              <strong>3. Proper Use:</strong> I agree to operate the bicycle safely and in accordance with
              all applicable traffic laws. I will wear a helmet while riding (helmets are strongly recommended).
              I will inspect the bicycle before each use and report any defects immediately.
            </p>

            <p>
              <strong>4. Return Policy:</strong> I agree to return the bicycle to a designated DeisBikes
              station within the allowed time period. I understand that failure to properly return the
              bicycle may result in fees or suspension of my account.
            </p>

            <p>
              <strong>5. Financial Responsibility:</strong> I agree to be financially responsible for any
              damage to or loss of the bicycle while in my possession that results from my negligence or
              misuse.
            </p>

            <p>
              <strong>6. Safety Course Requirement:</strong> I understand that I must complete the required
              safety course on Moodle before I can check out a bicycle.
            </p>

            <p>
              <strong>7. Age Requirement:</strong> I certify that I am at least 18 years of age and am a
              current member of the Brandeis University community.
            </p>

            <p>
              <strong>8. Privacy:</strong> I consent to the collection and use of my trip data for the
              purposes of operating and improving the DeisBikes program.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="flex items-start space-x-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-brandeis-blue focus:ring-brandeis-blue"
            />
            <span className="text-sm text-gray-700">
              I have read and understand the above waiver and release. I agree to all terms and conditions
              of the DeisBikes program. I acknowledge that by checking this box, I am providing my electronic
              signature.
            </span>
          </label>

          <button
            type="submit"
            disabled={!agreed || loading}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing...' : 'Sign Waiver & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WaiverPage;

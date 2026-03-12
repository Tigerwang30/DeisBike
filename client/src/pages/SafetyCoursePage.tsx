import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function SafetyCoursePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If already approved, redirect to map
  if (user?.moodleApproved) {
    navigate('/map');
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-brandeis-blue mb-6">
          Safety Course Required
        </h1>

        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
          <strong>Almost there!</strong> You need to complete the safety course before you can use DeisBikes.
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-semibold text-lg mb-2">Step 1: Complete the Moodle Course</h2>
            <p className="text-gray-600 mb-4">
              Visit the DeisBikes Safety Course on Moodle to learn about bike safety, our policies,
              and how to properly use the TetherSense lock system.
            </p>
            <a
              href="https://moodle2.brandeis.edu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block btn-primary"
            >
              Open Moodle Course
            </a>
          </div>

          <hr />

          <div>
            <h2 className="font-semibold text-lg mb-2">Step 2: Wait for Approval</h2>
            <p className="text-gray-600 mb-4">
              After completing the course, an administrator will verify your completion and approve
              your account. This usually happens within 24 hours on business days.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">Your Status:</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">&#10004;</span>
                Waiver signed
              </li>
              <li className="flex items-center">
                <span className="text-yellow-500 mr-2">&#9679;</span>
                Safety course: <span className="font-medium ml-1">Pending approval</span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-gray-500">
            Questions? Contact the DeisBikes team at deisbikes@brandeis.edu
          </p>
        </div>
      </div>
    </div>
  );
}

export default SafetyCoursePage;

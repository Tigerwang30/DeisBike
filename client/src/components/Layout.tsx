import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/map', label: 'Map' },
    { path: '/ride', label: 'Ride' },
    { path: '/history', label: 'History' }
  ];

  if (user?.isAdmin) {
    navItems.push({ path: '/admin', label: 'Admin' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brandeis-blue text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/map" className="flex items-center space-x-2">
              <span className="text-2xl font-bold">DeisBikes</span>
            </Link>

            {user && (
              <div className="flex items-center space-x-6">
                <nav className="hidden md:flex space-x-4">
                  {navItems.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        location.pathname === item.path
                          ? 'bg-white/20 font-semibold'
                          : 'hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="flex items-center space-x-4">
                  <span className="text-sm hidden sm:block">{user.displayName}</span>
                  <button
                    onClick={logout}
                    className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile nav */}
          {user && (
            <nav className="md:hidden flex space-x-2 mt-4 overflow-x-auto pb-2">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    location.pathname === item.path
                      ? 'bg-white/20 font-semibold'
                      : 'hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>DeisBikes - Brandeis University Bike Share System</p>
          <p className="mt-1">Need help? Contact support@brandeis.edu</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;

import { Routes, Route, Navigate } from 'react-router-dom';
import { RideProvider } from './context/RideContext';
import Layout from './components/Layout';
import MapPage from './pages/MapPage';
import RideModePage from './pages/RideModePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<RideProvider><Layout /></RideProvider>}>
        <Route index element={<Navigate to="/map" replace />} />
        <Route path="map" element={<MapPage />} />
        <Route path="ride" element={<RideModePage />} />
      </Route>
    </Routes>
  );
}

export default App;

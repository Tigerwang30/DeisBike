import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { Bike } from '../types';

// Brandeis University campus center — matches the backend default in api/config/bikes.py
const BRANDEIS_CENTER: [number, number] = [42.3655, -71.2595];

const AVAILABLE_COLOR = '#16a34a'; // green
const IN_USE_COLOR = '#dc2626'; // red

// Leaflet's default PNG markers break under Vite bundling. Use a divIcon with an
// inline colored dot instead — this also encodes availability visually.
function makeIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'bike-marker',
    html: `<span style="
      display:block;width:18px;height:18px;border-radius:9999px;
      background:${color};border:2px solid #fff;
      box-shadow:0 0 0 1px rgba(0,0,0,0.25);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

const AVAILABLE_ICON = makeIcon(AVAILABLE_COLOR);
const IN_USE_ICON = makeIcon(IN_USE_COLOR);

const iconFor = (available: boolean): L.DivIcon =>
  available ? AVAILABLE_ICON : IN_USE_ICON;

interface BikeMapProps {
  bikes: Bike[];
  onStartRide: (bike: Bike) => void;
}

function BikeMap({ bikes, onStartRide }: BikeMapProps) {
  return (
    <MapContainer
      center={BRANDEIS_CENTER}
      zoom={15}
      scrollWheelZoom
      style={{ height: '400px', width: '100%' }}
      className="rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {bikes.map((bike) => (
        <Marker
          key={bike.id}
          position={[bike.lat, bike.lng]}
          icon={iconFor(bike.available)}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{bike.name}</p>
              <p className="text-gray-600">{bike.location}</p>
              <p className={bike.available ? 'text-green-700' : 'text-red-700'}>
                {bike.available ? 'Available' : 'In Use'}
              </p>
              {bike.available && (
                <button
                  onClick={() => onStartRide(bike)}
                  className="btn-secondary mt-2 w-full"
                >
                  Start Ride
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default BikeMap;

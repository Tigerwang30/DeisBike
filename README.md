# DeisBikes

Brandeis University Bike Share System - A lightweight prototype using a "Backend-as-a-Proxy" architecture.

## Architecture

```
User Browser → Express API Gateway → LINKA FleetView API → LEO 2 Pro Lock
                     ↓
              PDF Generation (PDFKit)
```

## Features

- **Open Access**: No login required — anyone can view and unlock bikes
- **TetherSense Lock Control**: Dual-command unlock sequence (chain → wheel)
- **Real-time Ride Mode**: Polling-based status updates

## Project Structure

```
DeisBike/
├── .devcontainer/       # VS Code dev container config
├── server/              # Express backend (API Gateway)
│   ├── routes/          # API endpoints
│   └── services/        # LockService (TetherSense logic)
└── client/              # React frontend (Vite + Tailwind)
    ├── src/
    │   ├── components/  # Reusable UI components
    │   ├── context/     # React Context (active-ride state)
    │   ├── hooks/       # Custom hooks (useRideStatus)
    │   ├── pages/       # Route pages
    │   └── services/    # API client
    └── index.html
```

## Quick Start

### Development Container (Recommended)

1. Open in VS Code with the Remote Containers extension
2. Click "Reopen in Container" when prompted
3. Dependencies will be installed automatically

### Manual Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp server/.env.example server/.env
# Edit server/.env with your credentials

# Start development servers
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Environment Variables

Create `server/.env` with:

```env
PORT=3001

# LINKA FleetView API
LINKA_API_KEY=your-api-key
LINKA_API_SECRET=your-api-secret

# Frontend URL
CLIENT_URL=http://localhost:3000

# Bike inventory (prototype)
BIKE_IDS=["bike-001","bike-002","bike-003"]
```

## API Endpoints

### Bikes
- `GET /api/bikes` - List all bikes
- `GET /api/bikes/locations/all` - Get bike locations

### Commands
- `POST /api/command` - Lock control (actions: open, unlock_chain, unlock_wheel, lock)

### Rides
- `GET /api/rides/active` - Get the currently active ride/session (bike-scoped, no login required)

## TetherSense Lock Sequence

1. User selects bike and clicks "Unlock Chain"
2. Backend calls LINKA API to unlock chain component
3. User secures chain and confirms via checkbox
4. Backend calls LINKA API to unlock rear wheel
5. Ride begins with polling for status
6. When user returns bike, chain plug-in triggers webhook
7. Backend auto-ends the ride and clears the active session

## Future Enhancements

- [ ] Real database (PostgreSQL/MongoDB)
- [ ] WebSocket for real-time updates
- [ ] Google Maps/Mapbox integration
- [ ] Push notifications
- [ ] Chat support widget integration

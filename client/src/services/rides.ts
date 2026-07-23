import { fetchAPI } from './http';
import type { ActiveRideResponse } from '../types';

export const rideService = {
  getActive: (): Promise<ActiveRideResponse> => fetchAPI('/api/rides/active') as Promise<ActiveRideResponse>,
};

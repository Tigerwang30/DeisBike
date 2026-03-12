import { fetchAPI } from './http';
import type { ActiveRideResponse, Ride } from '../types';

export const rideService = {
  getActive:  (): Promise<ActiveRideResponse> => fetchAPI('/api/rides/active') as Promise<ActiveRideResponse>,
  getHistory: (): Promise<Ride[]> => fetchAPI('/api/rides/history') as Promise<Ride[]>,
  getRide:    (rideId: string): Promise<Ride> => fetchAPI(`/api/rides/${rideId}`) as Promise<Ride>
};

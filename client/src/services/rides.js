import { fetchAPI } from './http';

export const rideService = {
  getActive:  () => fetchAPI('/api/rides/active'),
  getHistory: () => fetchAPI('/api/rides/history'),
  getRide:    (rideId) => fetchAPI(`/api/rides/${rideId}`)
};

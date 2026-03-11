import { fetchAPI } from './http';

export const bikeService = {
  getAll:       () => fetchAPI('/api/bikes'),
  getLocations: () => fetchAPI('/api/bikes/locations/all'),
  getStatus:    (bikeId) => fetchAPI(`/api/bikes/${bikeId}`)
};

import { fetchAPI } from './http';
import type { Bike } from '../types';

export const bikeService = {
  getAll:       (): Promise<Bike[]> => fetchAPI('/api/bikes') as Promise<Bike[]>,
  getLocations: (): Promise<Bike[]> => fetchAPI('/api/bikes/locations/all') as Promise<Bike[]>,
  getStatus:    (bikeId: string): Promise<Bike> => fetchAPI(`/api/bikes/${bikeId}`) as Promise<Bike>
};

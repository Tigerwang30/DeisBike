import { fetchAPI } from './http';
import type { Bike } from '../types';

export const bikeService = {
  getAll: (): Promise<Bike[]> => fetchAPI('/api/bikes') as Promise<Bike[]>
};

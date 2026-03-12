import { fetchAPI } from './http';
import type { ReportSummary } from '../types';

export const reportService = {
  getSummary: (): Promise<ReportSummary> =>
    fetchAPI('/api/reports/summary') as Promise<ReportSummary>,

  downloadRidePDF: (rideId: string): void => {
    window.open(`/api/reports/ride/${rideId}/pdf`, '_blank');
  },

  downloadHistoryPDF: (): void => {
    window.open('/api/reports/history/pdf', '_blank');
  }
};

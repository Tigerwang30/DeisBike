import { fetchAPI } from './http';

export const reportService = {
  getSummary: () => fetchAPI('/api/reports/summary'),
  downloadRidePDF: (rideId) => {
    window.open(`/api/reports/ride/${rideId}/pdf`, '_blank');
  },
  downloadHistoryPDF: () => {
    window.open('/api/reports/history/pdf', '_blank');
  }
};

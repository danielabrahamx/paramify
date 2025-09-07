import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export interface FloodData {
  value: number | null;
  timestamp: string | null;
  lastUpdate: string | null;
  status: string;
  error: string | null;
  source: string;
  siteInfo: {
    name: string;
    siteId: string;
  };
}

export interface ServiceStatus {
  service: string;
  lastUpdate: string | null;
  currentFloodLevel: number | null;
  oracleValue: number | null;
  dataSource: string;
  site: {
    name: string;
    siteId: string;
  };
  updateInterval: string;
  nextUpdate: string | null;
  threshold?: {
    thresholdFeet: number;
    thresholdUnits: number;
  };
}

export const usgsApi = {
  async getFloodData(): Promise<FloodData> {
    try {
      const response = await axios.get<FloodData>(`${API_BASE_URL}/flood-data`);
      return response.data;
    } catch (error) {
      console.error('Error fetching flood data:', error);
      throw error;
    }
  },

  async getStatus(): Promise<ServiceStatus> {
    try {
      const response = await axios.get<ServiceStatus>(`${API_BASE_URL}/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching service status:', error);
      throw error;
    }
  },

  async triggerManualUpdate(): Promise<{ success: boolean; message: string; data: FloodData }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/manual-update`);
      return response.data;
    } catch (error) {
      console.error('Error triggering manual update:', error);
      throw error;
    }
  },

  async checkHealth(): Promise<{ status: string; message: string; timestamp: string }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return response.data;
    } catch (error) {
      console.error('Error checking API health:', error);
      throw error;
    }
  },
};

// Helper function to format the timestamp
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Helper function to format the next update time
export function getTimeUntilNextUpdate(nextUpdate: string | null): string {
  if (!nextUpdate) return 'N/A';
  
  const now = new Date();
  const next = new Date(nextUpdate);
  const diffMs = next.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Updating...';
  
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

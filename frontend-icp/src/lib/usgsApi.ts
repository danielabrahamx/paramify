export interface USGSData {
  currentFloodLevel: number;
  threshold: number;
  lastUpdate: string;
  siteName: string;
  siteId: string;
  nextUpdate: string;
}

export interface ServiceStatus {
  currentFloodLevel: number | null;
  oracleValue: number | null;
  threshold: {
    thresholdFeet: number;
    thresholdUnits: number;
  } | null;
  lastUpdate: string;
  nextUpdate: string;
  site: {
    name: string;
    siteId: string;
  };
}

class USGSApi {
  private baseUrl = "http://localhost:3001";

  async getFloodData(): Promise<USGSData> {
    const response = await fetch(`${this.baseUrl}/flood-data`);
    if (!response.ok) {
      throw new Error("Failed to fetch flood data");
    }
    return response.json();
  }

  async getStatus(): Promise<ServiceStatus> {
    const response = await fetch(`${this.baseUrl}/status`);
    if (!response.ok) {
      throw new Error("Failed to fetch service status");
    }
    return response.json();
  }

  async triggerUpdate(): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/update`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to trigger update");
    }
    return response.json();
  }

  async updateThreshold(thresholdFeet: number): Promise<{ success: boolean; thresholdFeet: number; thresholdUnits: number }> {
    const response = await fetch(`${this.baseUrl}/api/threshold`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ thresholdFeet }),
    });
    if (!response.ok) {
      throw new Error("Failed to update threshold");
    }
    return response.json();
  }
}

export const usgsApi = new USGSApi();

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

export function getTimeUntilNextUpdate(nextUpdate: string): string {
  const now = new Date().getTime();
  const next = new Date(nextUpdate).getTime();
  const diff = next - now;
  
  if (diff <= 0) return "Updating...";
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  return `${minutes}m ${seconds}s`;
}

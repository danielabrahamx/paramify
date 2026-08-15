// Browser geolocation helper with demo fallback coordinates
export interface GeoCoords {
  lat: number;
  lng: number;
  source: 'browser' | 'fallback';
}

const FALLBACK: GeoCoords = { lat: 51.5194, lng: -0.127, source: 'fallback' }; // London demo coords

export function getCurrentPosition(timeoutMs = 5000): Promise<GeoCoords> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'browser' }),
      () => resolve(FALLBACK),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

export function formatCoords(c: GeoCoords): string {
  const ns = c.lat >= 0 ? 'N' : 'S';
  const ew = c.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(c.lat).toFixed(4)}° ${ns}, ${Math.abs(c.lng).toFixed(4)}° ${ew}`;
}

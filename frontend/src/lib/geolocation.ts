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

// Reverse geocode via OpenStreetMap Nominatim (free, no API key)
export async function reverseGeocode(c: GeoCoords): Promise<string> {
  if (c.source === 'fallback') return 'Demo location (permission not granted)';
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${c.lat}&lon=${c.lng}&zoom=18`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) throw new Error('geocode failed');
    const data = await res.json();
    return data?.display_name?.split(',').slice(0, 2).join(', ') || formatCoords(c);
  } catch (e) {
    return formatCoords(c);
  }
}

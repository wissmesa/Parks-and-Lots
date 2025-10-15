/**
 * Geolocation service for IP-based location lookup
 * Uses ip-api.com free API (no API key required, 45 requests/minute)
 */

export interface LocationData {
  city: string | null;
  region: string | null;
  country: string | null;
}

/**
 * Get location data from IP address using ip-api.com
 * @param ip - IP address to lookup
 * @returns Location data (city, region, country) or null values if lookup fails
 */
export async function getLocationFromIP(ip: string): Promise<LocationData> {
  // Default response if lookup fails
  const defaultLocation: LocationData = {
    city: null,
    region: null,
    country: null,
  };

  // Skip localhost and private IPs
  if (!ip || ip === 'localhost' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
    console.log('[Geolocation] Skipping local/private IP:', ip);
    return defaultLocation;
  }

  try {
    // Use ip-api.com free API (no key required)
    // Format: http://ip-api.com/json/{ip}?fields=status,message,country,regionName,city
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Parks-and-Lots-Login-Tracker',
        },
        signal: AbortSignal.timeout(3000), // 3 second timeout
      }
    );

    if (!response.ok) {
      console.error('[Geolocation] API response not OK:', response.status, response.statusText);
      return defaultLocation;
    }

    const data = await response.json();

    // Check if the API returned an error
    if (data.status === 'fail') {
      console.error('[Geolocation] API returned fail status:', data.message);
      return defaultLocation;
    }

    // Extract location data
    return {
      city: data.city || null,
      region: data.regionName || null,
      country: data.country || null,
    };
  } catch (error) {
    // Don't throw - just log and return default
    console.error('[Geolocation] Failed to lookup IP location:', error instanceof Error ? error.message : 'Unknown error');
    return defaultLocation;
  }
}

/**
 * Extract IP address from Express request
 * Checks x-forwarded-for header first (for proxies/load balancers), then falls back to req.ip
 */
export function extractIPFromRequest(req: any): string {
  // Check x-forwarded-for header (used by proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = forwardedFor.split(',').map((ip: string) => ip.trim());
    if (ips.length > 0 && ips[0]) {
      return ips[0];
    }
  }

  // Fall back to req.ip
  return req.ip || 'unknown';
}


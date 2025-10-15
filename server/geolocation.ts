/**
 * Geolocation service for IP-based location lookup
 * Uses IPinfo.io free API (no API key required for basic usage, 50k requests/month)
 */

export interface LocationData {
  city: string | null;
  region: string | null;
  country: string | null;
}

/**
 * Get location data from IP address using IPinfo.io
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
    // Use IPinfo.io free API (no key required for basic usage)
    // Format: https://ipinfo.io/{ip}/json
    const response = await fetch(
      `https://ipinfo.io/${ip}/json`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Parks-and-Lots-Login-Tracker',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) {
      console.error('[Geolocation] IPinfo API response not OK:', response.status, response.statusText);
      return defaultLocation;
    }

    const data = await response.json();

    // Check if the API returned an error (IPinfo returns error in "error" field)
    if (data.error) {
      console.error('[Geolocation] IPinfo API returned error:', data.error);
      return defaultLocation;
    }

    // Extract location data
    // IPinfo returns: { ip, city, region, country, loc, org, postal, timezone }
    return {
      city: data.city || null,
      region: data.region || null,
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


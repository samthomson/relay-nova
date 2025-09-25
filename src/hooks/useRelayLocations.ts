import { useQuery } from '@tanstack/react-query';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

// Comprehensive seed list of known Nostr relays
const KNOWN_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.current.fyi',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.orangepill.dev',
  'wss://relay.nostrati.com',
  'wss://eden.nostr.land',
  'wss://nostr.fmt.wiz.biz',
  'wss://relay.nostr.info',
  'wss://offchain.pub',
  'wss://brb.io',
  'wss://relay.nostrich.de',
  'wss://relay.plebstr.com',
  'wss://nostr.oxtr.dev',
  'wss://relay.nostr.wirednet.jp',
  'wss://relay.nostr.au',
  'wss://soloco.nl',
  'wss://relay.wellorder.net',
  'wss://nostr.sandwich.farm',
  'wss://relay.nostrgraph.net',
  'wss://relay.nostrplebs.com',
  'wss://relay.minds.com',
  'wss://nostr.fmt.wiz.biz',
  'wss://nostr-relay.wlvs.space',
  'wss://relay.nostr.net',
  'wss://relay.farscapian.com',
  'wss://relay.nostr.vet',
  'wss://relay.nostr.com.au',
  'wss://nostr.lu.ke',
  'wss://relay.nostr.ro',
  'wss://relay.kronkltd.net',
  'wss://relay.nostr.ch',
  'wss://relay.nostr.vision',
  'wss://relay.nostr.moe',
  'wss://puravida.nostr.land',
  'wss://relay.nostr.com.es',
  'wss://relay.nostr.bg',
  'wss://relay.nostr.hu',
  'wss://nostr.klabo.blog',
  'wss://relay.nostr.nu',
  'wss://relay.nostr.se',
  'wss://relay.nostr.dk',
  'wss://relay.nostr.fi',
  'wss://relay.nostr.no',
  'wss://relay.8333.space'
];

async function getRelayLocation(relayUrl: string): Promise<RelayLocation | null> {
  try {
    // Extract hostname from relay URL
    const hostname = relayUrl.replace('wss://', '').replace('ws://', '').split('/')[0];

    // Use ipapi.co for IP geolocation (free service)
    const response = await fetch(`https://ipapi.co/${hostname}/json/`);
    const data = await response.json();

    if (data.latitude && data.longitude) {
      return {
        url: relayUrl,
        lat: data.latitude,
        lng: data.longitude,
        city: data.city,
        country: data.country_name,
      };
    }

    return null;
  } catch (error) {
    console.warn(`Failed to get location for ${relayUrl}:`, error);
    return null;
  }
}

async function fetchRelayLocations(): Promise<RelayLocation[]> {
  // Fetch locations for all known relays
  const locationPromises = KNOWN_RELAYS.map(async (relayUrl) => {
    // Add a small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    return getRelayLocation(relayUrl);
  });

  const results = await Promise.allSettled(locationPromises);

  const locations: RelayLocation[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      locations.push(result.value);
    }
  });

  // Enhanced fallback locations with more global coverage
  if (locations.length === 0) {
    return [
      // North America
      { url: 'wss://relay.damus.io', lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'USA' },
      { url: 'wss://relay.primal.net', lat: 40.7128, lng: -74.0060, city: 'New York', country: 'USA' },
      { url: 'wss://relay.current.fyi', lat: 39.7392, lng: -104.9903, city: 'Denver', country: 'USA' },
      { url: 'wss://relay.snort.social', lat: 43.6532, lng: -79.3832, city: 'Toronto', country: 'Canada' },

      // Europe
      { url: 'wss://relay.nostr.band', lat: 52.5200, lng: 13.4050, city: 'Berlin', country: 'Germany' },
      { url: 'wss://nos.lol', lat: 51.5074, lng: -0.1278, city: 'London', country: 'UK' },
      { url: 'wss://relay.nostrich.de', lat: 48.8566, lng: 2.3522, city: 'Paris', country: 'France' },
      { url: 'wss://soloco.nl', lat: 52.3676, lng: 4.9041, city: 'Amsterdam', country: 'Netherlands' },
      { url: 'wss://relay.nostr.ch', lat: 46.9481, lng: 7.4474, city: 'Bern', country: 'Switzerland' },
      { url: 'wss://relay.nostr.se', lat: 59.3293, lng: 18.0686, city: 'Stockholm', country: 'Sweden' },
      { url: 'wss://relay.nostr.no', lat: 59.9139, lng: 10.7522, city: 'Oslo', country: 'Norway' },
      { url: 'wss://relay.nostr.fi', lat: 60.1699, lng: 24.9384, city: 'Helsinki', country: 'Finland' },
      { url: 'wss://relay.nostr.hu', lat: 47.4979, lng: 19.0402, city: 'Budapest', country: 'Hungary' },
      { url: 'wss://relay.nostr.ro', lat: 44.4268, lng: 26.1025, city: 'Bucharest', country: 'Romania' },

      // Asia-Pacific
      { url: 'wss://relay.nostr.wirednet.jp', lat: 35.6762, lng: 139.6503, city: 'Tokyo', country: 'Japan' },
      { url: 'wss://nostr.wine', lat: -33.8688, lng: 151.2093, city: 'Sydney', country: 'Australia' },
      { url: 'wss://relay.nostr.au', lat: -27.4698, lng: 153.0251, city: 'Brisbane', country: 'Australia' },
      { url: 'wss://nostr.klabo.blog', lat: 37.5665, lng: 126.9780, city: 'Seoul', country: 'South Korea' },
      { url: 'wss://relay.nostr.moe', lat: 1.3521, lng: 103.8198, city: 'Singapore', country: 'Singapore' },

      // South America
      { url: 'wss://relay.nostrplebs.com', lat: -23.5505, lng: -46.6333, city: 'São Paulo', country: 'Brazil' },
      { url: 'wss://relay.nostrati.com', lat: -34.6118, lng: -58.3960, city: 'Buenos Aires', country: 'Argentina' },

      // Africa & Middle East
      { url: 'wss://relay.nostr.vision', lat: -26.2041, lng: 28.0473, city: 'Johannesburg', country: 'South Africa' },
      { url: 'wss://relay.8333.space', lat: 25.2048, lng: 55.2708, city: 'Dubai', country: 'UAE' },
    ];
  }

  return locations;
}

export function useRelayLocations() {
  return useQuery({
    queryKey: ['relay-locations'],
    queryFn: fetchRelayLocations,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
  });
}
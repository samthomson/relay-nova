import { useQuery } from '@tanstack/react-query';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

// Using static relay locations to avoid API rate limiting

// Removed getRelayLocation function to prevent API rate limiting and CORS errors

async function fetchRelayLocations(): Promise<RelayLocation[]> {
  console.log('Using static relay locations');

  // Static relay locations - no API calls to avoid rate limiting
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

export function useRelayLocations() {
  return useQuery({
    queryKey: ['relay-locations'],
    queryFn: fetchRelayLocations,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
  });
}
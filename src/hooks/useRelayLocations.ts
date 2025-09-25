import { useQuery } from '@tanstack/react-query';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

// Seed list of known Nostr relays
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
  
  // If no locations were fetched (API issues), return some fallback locations
  if (locations.length === 0) {
    return [
      { url: 'wss://relay.damus.io', lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'USA' },
      { url: 'wss://relay.nostr.band', lat: 52.5200, lng: 13.4050, city: 'Berlin', country: 'Germany' },
      { url: 'wss://nos.lol', lat: 51.5074, lng: -0.1278, city: 'London', country: 'UK' },
      { url: 'wss://relay.primal.net', lat: 40.7128, lng: -74.0060, city: 'New York', country: 'USA' },
      { url: 'wss://relay.snort.social', lat: 35.6762, lng: 139.6503, city: 'Tokyo', country: 'Japan' },
      { url: 'wss://nostr.wine', lat: -33.8688, lng: 151.2093, city: 'Sydney', country: 'Australia' },
      { url: 'wss://relay.nostrich.de', lat: 48.8566, lng: 2.3522, city: 'Paris', country: 'France' },
      { url: 'wss://relay.nostr.wirednet.jp', lat: 35.6762, lng: 139.6503, city: 'Tokyo', country: 'Japan' },
      { url: 'wss://relay.nostr.au', lat: -27.4698, lng: 153.0251, city: 'Brisbane', country: 'Australia' },
      { url: 'wss://soloco.nl', lat: 52.3676, lng: 4.9041, city: 'Amsterdam', country: 'Netherlands' },
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
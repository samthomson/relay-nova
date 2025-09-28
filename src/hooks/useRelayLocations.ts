import { useQuery } from '@tanstack/react-query';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

// Load relay locations from the JSON file in public directory
async function fetchRelayLocations(): Promise<RelayLocation[]> {
  try {
    // Fetch JSON file from public directory
    const response = await fetch('/relays.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch relays.json: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform JSON data to match our RelayLocation interface
    const relayLocations: RelayLocation[] = data.map((relay: any) => ({
      url: relay.url,
      lat: relay.location.latitude,
      lng: relay.location.longitude,
      country: relay.location.country,
      // Note: city is not in the JSON format, but we can add it later if needed
    }));
    
    console.log(`Loaded ${relayLocations.length} relays from JSON file`);
    return relayLocations;
    
  } catch (error) {
    console.error('Error loading relay locations:', error);
    
    // Fallback to a small set of default relays if JSON fails to load
    return [
      { url: 'wss://relay.damus.io', lat: 37.7749, lng: -122.4194, country: 'USA' },
      { url: 'wss://relay.nostr.band', lat: 52.5200, lng: 13.4050, country: 'Germany' },
      { url: 'wss://nos.lol', lat: 51.5074, lng: -0.1278, country: 'UK' },
    ];
  }
}

export function useRelayLocations() {
  return useQuery({
    queryKey: ['relay-locations'],
    queryFn: fetchRelayLocations,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
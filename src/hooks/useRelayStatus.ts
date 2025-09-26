import { useQuery } from '@tanstack/react-query';
import { useNostr } from './useNostr';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

interface RelayStatus extends RelayLocation {
  isOnline: boolean;
  checked: boolean;
}

// Check if a relay is online by attempting to connect and fetch a single event
// Using the same approach as RelayNotesPanel which works
async function checkRelayStatus(relayUrl: string, nostr: any): Promise<boolean> {
  try {
    console.log(`Checking relay: ${relayUrl}`);
    
    // Use the same approach as RelayNotesPanel - use nostr.relay()
    const relayConnection = nostr.relay(relayUrl);

    // Try to fetch a single recent event (kind:1) with limit 1
    // This mirrors exactly what RelayNotesPanel does successfully
    const events = await relayConnection.query([
      {
        kinds: [1],
        limit: 1,
      }
    ], { signal: AbortSignal.timeout(3000) });

    console.log(`Relay ${relayUrl} returned ${events.length} events`);
    // If we get any events, the relay is online
    return events.length > 0;
  } catch (error) {
    console.log(`Relay ${relayUrl} failed:`, error);
    // Silently handle connection failures - this is expected for offline relays
    return false;
  }
}

export function useRelayStatus(relays: RelayLocation[] | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-status', relays?.map(r => r.url).join(',')],
    queryFn: async () => {
      console.log('Checking relay status for', relays?.length, 'relays');
      
      if (!relays || relays.length === 0 || !nostr) {
        return [];
      }

      // Check all relays in parallel for speed
      const statusPromises = relays.map(async (relay) => {
        const isOnline = await checkRelayStatus(relay.url, nostr);
        return {
          ...relay,
          isOnline,
          checked: true
        };
      });

      try {
        const results = await Promise.allSettled(statusPromises);
        console.log('Relay status check results:', results);
        
        return results.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            // If check failed, mark as offline
            return {
              ...relays[index],
              isOnline: false,
              checked: true
            };
          }
        });
      } catch (error) {
        console.log('Relay status check failed:', error);
        // Fallback: mark all as offline if something goes wrong
        return relays.map(relay => ({
          ...relay,
          isOnline: false,
          checked: true
        }));
      }
    },
    enabled: !!relays && relays.length > 0 && !!nostr,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
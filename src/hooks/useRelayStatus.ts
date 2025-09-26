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
async function checkRelayStatus(relayUrl: string): Promise<boolean> {
  try {
    // Use the same approach as the working RelayNotesPanel
    // Import nostrify dynamically
    const { Nostr } = await import('@nostrify/nostrify');

    // Create a Nostr instance with just this relay
    const nostr = new Nostr({
      relays: [relayUrl],
    });

    try {
      console.log(`Checking relay: ${relayUrl}`);
      // Try to fetch a single recent event (kind:1) with limit 1
      // This mirrors exactly what RelayNotesPanel does successfully
      const events = await nostr.query([
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
    } finally {
      // Clean up the nostr instance
      await nostr.close();
    }
  } catch (error) {
    console.log(`Relay ${relayUrl} setup failed:`, error);
    // Silently handle any other errors - relay is considered offline
    return false;
  }
}

async function checkAllRelayStatus(relays: RelayLocation[]): Promise<RelayStatus[]> {
  console.log('Checking relay status for', relays?.length, 'relays');
  if (!relays || relays.length === 0) {
    return [];
  }

  // Check all relays in parallel for speed
  const statusPromises = relays.map(async (relay) => {
    const isOnline = await checkRelayStatus(relay.url);
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
}

export function useRelayStatus(relays: RelayLocation[] | undefined) {
  return useQuery({
    queryKey: ['relay-status', relays?.map(r => r.url).join(',')],
    queryFn: () => checkAllRelayStatus(relays || []),
    enabled: !!relays && relays.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
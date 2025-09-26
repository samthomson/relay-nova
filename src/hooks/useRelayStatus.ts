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

// Check if a relay is online by attempting to fetch a single event
async function checkRelayStatus(relayUrl: string): Promise<boolean> {
  try {
    // Import nostr dynamically to avoid issues
    const { SimplePool } = await import('nostr-tools');
    
    // Create a pool with just this relay
    const pool = new SimplePool();
    
    // Try to connect with a timeout
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 3000);
    });

    const connectPromise = new Promise<boolean>(async (resolve) => {
      try {
        // Try to fetch a single recent event (kind 1) with limit 1
        const events = await pool.query(
          [{ kinds: [1], limit: 1 }],
          [relayUrl],
          { signal: AbortSignal.timeout(2500) }
        );
        
        // If we get any events, the relay is online
        resolve(events.length > 0);
      } catch (error) {
        resolve(false);
      }
    });

    const result = await Promise.race([connectPromise, timeoutPromise]);
    
    // Close the pool connection
    pool.close([relayUrl]);
    
    return result;
  } catch (error) {
    return false;
  }
}

async function checkAllRelayStatus(relays: RelayLocation[]): Promise<RelayStatus[]> {
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
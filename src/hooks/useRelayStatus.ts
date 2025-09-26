import { useQuery } from '@tanstack/react-query';
import { useNostr } from './useNostr';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export interface RelayStatus extends RelayLocation {
  isOnline: boolean;
  checked: boolean;
  isRetrying?: boolean;
  retryCount?: number;
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

      // Initial check for all relays
      const initialStatuses = await Promise.allSettled(
        relays.map(async (relay) => {
          const isOnline = await checkRelayStatus(relay.url, nostr);
          return {
            ...relay,
            isOnline,
            checked: true,
            isRetrying: false,
            retryCount: 0
          };
        })
      );

      const results = initialStatuses.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          // If check failed, mark as offline
          return {
            ...relays[index],
            isOnline: false,
            checked: true,
            isRetrying: false,
            retryCount: 0
          };
        }
      });

      // Filter out relays that failed (are offline) and need retrying
      const failedRelays = results.filter(status => !status.isOnline);
      
      if (failedRelays.length > 0) {
        console.log(`Retrying ${failedRelays.length} failed relays after 3 seconds...`);
        
        // Wait 3 seconds before first retry
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const firstRetryResults = await Promise.allSettled(
          failedRelays.map(async (relay) => {
            const isOnline = await checkRelayStatus(relay.url, nostr);
            return {
              ...relay,
              isOnline,
              isRetrying: true,
              retryCount: 1
            };
          })
        );

        // Update results with first retry attempts
        firstRetryResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const originalIndex = results.findIndex(r => r.url === failedRelays[index].url);
            if (originalIndex !== -1) {
              results[originalIndex] = result.value;
            }
          }
        });

        // Filter out relays that still failed after first retry
        const stillFailedRelays = results.filter(status => !status.isOnline && status.retryCount === 1);
        
        if (stillFailedRelays.length > 0) {
          console.log(`Retrying ${stillFailedRelays.length} still-failed relays after another 3 seconds...`);
          
          // Wait another 3 seconds before second retry
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const secondRetryResults = await Promise.allSettled(
            stillFailedRelays.map(async (relay) => {
              const isOnline = await checkRelayStatus(relay.url, nostr);
              return {
                ...relay,
                isOnline,
                isRetrying: true,
                retryCount: 2
              };
            })
          );

          // Update results with second retry attempts
          secondRetryResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              const originalIndex = results.findIndex(r => r.url === stillFailedRelays[index].url);
              if (originalIndex !== -1) {
                results[originalIndex] = result.value;
              }
            }
          });
        }
      }

      // Final cleanup: remove isRetrying flag from all relays
      const finalResults = results.map(status => ({
        ...status,
        isRetrying: false
      }));

      console.log('Final relay status results:', finalResults);
      return finalResults;
    },
    enabled: !!relays && relays.length > 0 && !!nostr,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
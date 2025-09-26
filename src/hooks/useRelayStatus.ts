import { useState, useEffect } from 'react';
import { useNostr } from './useNostr';

export interface RelayStatus {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
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
  const [relayStatuses, setRelayStatuses] = useState<RelayStatus[]>([]);

  useEffect(() => {
    if (!relays || relays.length === 0 || !nostr) {
      setRelayStatuses([]);
      return;
    }

    console.log('Starting relay status check for', relays.length, 'relays');

    // Initialize all relays as unchecked
    const initialStatuses: RelayStatus[] = relays.map(relay => ({
      ...relay,
      isOnline: false,
      checked: false,
      isRetrying: false,
      retryCount: 0
    }));

    setRelayStatuses(initialStatuses);

    // Start the checking process
    const checkRelays = async () => {
      try {
        console.log('Starting initial relay checks...');
        
        // Create a copy of the current statuses
        let currentStatuses = [...initialStatuses];

        // Initial check for all relays
        const initialCheckPromises = relays.map(async (relay, index) => {
          const isOnline = await checkRelayStatus(relay.url, nostr);
          return {
            index,
            status: {
              ...relay,
              isOnline,
              checked: true,
              isRetrying: false,
              retryCount: 0
            }
          };
        });

        const initialResults = await Promise.allSettled(initialCheckPromises);

        // Update statuses with initial results
        initialResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            currentStatuses[result.value.index] = result.value.status;
          }
        });

        // Update state with initial results
        setRelayStatuses([...currentStatuses]);
        console.log('Initial check completed');

        // Filter out relays that failed (are offline) and need retrying
        const failedRelays = currentStatuses.filter(status => !status.isOnline);
        
        if (failedRelays.length > 0) {
          console.log(`Retrying ${failedRelays.length} failed relays after 3 seconds...`);
          
          // Mark relays as retrying
          failedRelays.forEach(failedRelay => {
            const index = currentStatuses.findIndex(r => r.url === failedRelay.url);
            if (index !== -1) {
              currentStatuses[index] = { 
                ...currentStatuses[index], 
                isRetrying: true, 
                retryCount: 1 
              };
            }
          });

          // Update state to show retrying status
          setRelayStatuses([...currentStatuses]);

          // Wait 3 seconds before first retry
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const firstRetryPromises = failedRelays.map(async (relay) => {
            const isOnline = await checkRelayStatus(relay.url, nostr);
            return {
              url: relay.url,
              status: {
                ...relay,
                isOnline,
                checked: true,
                isRetrying: false,
                retryCount: 1
              }
            };
          });

          const firstRetryResults = await Promise.allSettled(firstRetryPromises);

          // Update statuses with first retry results
          firstRetryResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              const index = currentStatuses.findIndex(r => r.url === result.value.url);
              if (index !== -1) {
                currentStatuses[index] = result.value.status;
              }
            }
          });

          // Update state with first retry results
          setRelayStatuses([...currentStatuses]);

          // Filter out relays that still failed after first retry
          const stillFailedRelays = currentStatuses.filter(status => !status.isOnline && status.retryCount === 1);
          
          if (stillFailedRelays.length > 0) {
            console.log(`Retrying ${stillFailedRelays.length} still-failed relays after another 3 seconds...`);
            
            // Mark relays as retrying again
            stillFailedRelays.forEach(stillFailedRelay => {
              const index = currentStatuses.findIndex(r => r.url === stillFailedRelay.url);
              if (index !== -1) {
                currentStatuses[index] = { 
                  ...currentStatuses[index], 
                  isRetrying: true, 
                  retryCount: 2 
                };
              }
            });

            // Update state to show retrying status
            setRelayStatuses([...currentStatuses]);

            // Wait another 3 seconds before second retry
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const secondRetryPromises = stillFailedRelays.map(async (relay) => {
              const isOnline = await checkRelayStatus(relay.url, nostr);
              return {
                url: relay.url,
                status: {
                  ...relay,
                  isOnline,
                  checked: true,
                  isRetrying: false,
                  retryCount: 2
                }
              };
            });

            const secondRetryResults = await Promise.allSettled(secondRetryPromises);

            // Update statuses with second retry results
            secondRetryResults.forEach((result) => {
              if (result.status === 'fulfilled') {
                const index = currentStatuses.findIndex(r => r.url === result.value.url);
                if (index !== -1) {
                  currentStatuses[index] = result.value.status;
                }
              }
            });

            // Final state update
            setRelayStatuses([...currentStatuses]);
          }
        }

        console.log('All relay checks completed');
      } catch (error) {
        console.error('Error in relay checking process:', error);
      }
    };

    // Start the checking process with a small delay
    const timer = setTimeout(checkRelays, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [relays, nostr]);

  return { data: relayStatuses, isLoading: relayStatuses.length === 0 && relays && relays.length > 0 };
}
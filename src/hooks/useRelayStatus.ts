import { useState, useEffect } from 'react';
import { useNostr } from './useNostr';

export interface RelayStatus {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  isOnline: boolean;
  checked: boolean; // true = has been attempted at least once
  isRetrying?: boolean; // true = currently being retried after failure
  attemptCount: number; // 1 = first attempt, 2 = retry, 3 = final retry
}

// Check if a relay is online by attempting to connect and fetch a single event
async function checkRelayStatus(relayUrl: string, nostr: any): Promise<boolean> {
  try {
    console.log(`Checking relay: ${relayUrl}`);
    
    // Use same approach as RelayNotesPanel - use nostr.relay()
    const relayConnection = nostr.relay(relayUrl);

    // Try to fetch a single recent event (kind:1) with limit 1
    const events = await relayConnection.query([
      {
        kinds: [1],
        limit: 1,
      }
    ], { signal: AbortSignal.timeout(5000) });

    console.log(`Relay ${relayUrl} returned ${events.length} events`);
    return events.length > 0;
  } catch (error) {
    console.log(`Relay ${relayUrl} failed:`, error);
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

    console.log('Starting SINGLE CYCLE relay status check for', relays.length, 'relays');

    // Initialize all relays as not checked, 0 attempts
    const initialStatuses: RelayStatus[] = relays.map(relay => ({
      ...relay,
      isOnline: false,
      checked: false,
      isRetrying: false,
      attemptCount: 0
    }));

    setRelayStatuses(initialStatuses);

    // Single cycle: check all relays once, then retry failures (within same cycle)
    const singleCycleCheck = async () => {
      let currentStatuses = [...initialStatuses];
      
      // === FIRST: Check all relays that haven't been attempted ===
      const unattemptedRelays = currentStatuses.filter(status => status.attemptCount === 0);
      console.log(`First attempt: checking ${unattemptedRelays.length} relays`);
      
      // Mark as currently checking (retrying = true for visual feedback)
      unattemptedRelays.forEach(relay => {
        const index = currentStatuses.findIndex(r => r.url === relay.url);
        if (index !== -1) {
          currentStatuses[index] = { 
            ...currentStatuses[index], 
            isRetrying: true,
            attemptCount: 1 
          };
        }
      });
      setRelayStatuses([...currentStatuses]);

      // Check in batches of 20 for performance
      const batchSize = 20;
      for (let i = 0; i < unattemptedRelays.length; i += batchSize) {
        const batch = unattemptedRelays.slice(i, i + batchSize);
        console.log(`First attempt batch ${Math.floor(i/batchSize) + 1}: relays ${i + 1}-${Math.min(i + batchSize, unattemptedRelays.length)}`);
        
        // Check current batch in parallel
        const batchPromises = batch.map(async (relay) => {
          const isOnline = await checkRelayStatus(relay.url, nostr);
          return {
            url: relay.url,
            isOnline,
            attemptCount: 1
          };
        });

        const batchResults = await Promise.allSettled(batchPromises);

        // Update statuses with batch results
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { url, isOnline, attemptCount } = result.value;
            const index = currentStatuses.findIndex(r => r.url === url);
            if (index !== -1) {
              currentStatuses[index] = {
                ...currentStatuses[index],
                isOnline,
                checked: true, // Mark as checked (attempted at least once)
                isRetrying: false,
                attemptCount
              };
            }
          }
        });

        // Update UI after each batch
        setRelayStatuses([...currentStatuses]);
        
        // Small delay between batches to show progress
        if (i + batchSize < unattemptedRelays.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('First attempt completed - all relays now checked');

      // === SECOND: Retry relays that failed first attempt (within same cycle) ===
      const failedFirstAttempt = currentStatuses.filter(
        status => !status.isOnline && status.attemptCount === 1
      );
      
      if (failedFirstAttempt.length > 0) {
        console.log(`Second attempt: retrying ${failedFirstAttempt.length} failed relays`);
        
        // Wait 3 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Mark as retrying
        failedFirstAttempt.forEach(relay => {
          const index = currentStatuses.findIndex(r => r.url === relay.url);
          if (index !== -1) {
            currentStatuses[index] = { 
              ...currentStatuses[index], 
              isRetrying: true,
              attemptCount: 2 
            };
          }
        });
        setRelayStatuses([...currentStatuses]);

        // Retry failed relays in batches
        for (let i = 0; i < failedFirstAttempt.length; i += batchSize) {
          const batch = failedFirstAttempt.slice(i, i + batchSize);
          console.log(`Second attempt batch ${Math.floor(i/batchSize) + 1}: relays ${i + 1}-${Math.min(i + batchSize, failedFirstAttempt.length)}`);
          
          const batchPromises = batch.map(async (relay) => {
            const isOnline = await checkRelayStatus(relay.url, nostr);
            return {
              url: relay.url,
              isOnline,
              attemptCount: 2
            };
          });

          const batchResults = await Promise.allSettled(batchPromises);

          // Update statuses with retry results
          batchResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              const { url, isOnline, attemptCount } = result.value;
              const index = currentStatuses.findIndex(r => r.url === url);
              if (index !== -1) {
                currentStatuses[index] = {
                  ...currentStatuses[index],
                  isOnline,
                  checked: true, // Already checked from first attempt
                  isRetrying: false,
                  attemptCount
                };
              }
            }
          });

          setRelayStatuses([...currentStatuses]);
          
          // Small delay between batches
          if (i + batchSize < failedFirstAttempt.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        console.log('Second attempt completed');

        // === THIRD: Final retry for relays that failed both attempts (within same cycle) ===
        const failedSecondAttempt = currentStatuses.filter(
          status => !status.isOnline && status.attemptCount === 2
        );
        
        if (failedSecondAttempt.length > 0) {
          console.log(`Third attempt: final retry for ${failedSecondAttempt.length} relays`);
          
          // Wait another 3 seconds before final retry
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Mark as final retry
          failedSecondAttempt.forEach(relay => {
            const index = currentStatuses.findIndex(r => r.url === relay.url);
            if (index !== -1) {
              currentStatuses[index] = { 
                ...currentStatuses[index], 
                isRetrying: true,
                attemptCount: 3 
              };
            }
          });
          setRelayStatuses([...currentStatuses]);

          // Final retry batch
          for (let i = 0; i < failedSecondAttempt.length; i += batchSize) {
            const batch = failedSecondAttempt.slice(i, i + batchSize);
            console.log(`Third attempt batch ${Math.floor(i/batchSize) + 1}: relays ${i + 1}-${Math.min(i + batchSize, failedSecondAttempt.length)}`);
            
            const batchPromises = batch.map(async (relay) => {
              const isOnline = await checkRelayStatus(relay.url, nostr);
              return {
                url: relay.url,
                isOnline,
                attemptCount: 3
              };
            });

            const batchResults = await Promise.allSettled(batchPromises);

            // Update statuses with final results
            batchResults.forEach((result) => {
              if (result.status === 'fulfilled') {
                const { url, isOnline, attemptCount } = result.value;
                const index = currentStatuses.findIndex(r => r.url === url);
                if (index !== -1) {
                  currentStatuses[index] = {
                    ...currentStatuses[index],
                    isOnline,
                    checked: true, // Already checked from first attempt
                    isRetrying: false,
                    attemptCount
                  };
                }
              }
            });

            setRelayStatuses([...currentStatuses]);
            
            // Small delay between batches
            if (i + batchSize < failedSecondAttempt.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          console.log('Third attempt completed');
        }
      }

      console.log('SINGLE CYCLE completed - no more retries');
    };

    // Start the single cycle
    const timer = setTimeout(singleCycleCheck, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [relays, nostr]);

  return { data: relayStatuses, isLoading: relayStatuses.length === 0 && relays && relays.length > 0 };
}
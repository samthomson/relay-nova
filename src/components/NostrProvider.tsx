import React, { useEffect, useRef } from 'react';
import { NostrEvent, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { useUserRelays, type UserRelay } from '@/hooks/useUserRelays';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, presetRelays } = useAppContext();
  const { data: userRelays } = useUserRelays();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayUrl = useRef<string>(config.relayUrl);
  const currentUserRelays = useRef<UserRelay[]>([]);

  // Update refs when data changes
  useEffect(() => {
    relayUrl.current = config.relayUrl;
    currentUserRelays.current = userRelays || [];
    queryClient.resetQueries();
  }, [config.relayUrl, userRelays, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        // Use user's read relays if available, otherwise fall back to current relay
        const readRelays = currentUserRelays.current
          .filter(relay => relay.read)
          .map(relay => relay.url);

        if (readRelays.length > 0) {
          // Distribute queries across read relays
          const relayUrls = readRelays.slice(0, 3); // Use up to 3 read relays
          return new Map(relayUrls.map(url => [url, filters]));
        }

        // Fallback to current relay
        return new Map([[relayUrl.current, filters]]);
      },
      eventRouter(_event: NostrEvent) {
        // Publish to user's write relays if available
        const writeRelays = currentUserRelays.current
          .filter(relay => relay.write)
          .map(relay => relay.url);

        const allRelays = new Set<string>();

        // Add write relays
        writeRelays.forEach(url => allRelays.add(url));

        // Fallback to current relay if no write relays
        if (allRelays.size === 0) {
          allRelays.add(relayUrl.current);
        }

        // Also add preset relays as backup, capped to 5 total
        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);

          if (allRelays.size >= 5) {
            break;
          }
        }

        return [...allRelays];
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;
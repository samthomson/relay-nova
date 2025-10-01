import React, { useEffect, useRef } from 'react';
import { NostrEvent, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { useUserRelaysContext } from '@/contexts/UserRelaysContext';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, presetRelays } = useAppContext();
  const { userRelays } = useUserRelaysContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayUrl = useRef<string>(config.relayUrl);
  const userRelaysRef = useRef(userRelays);

  // Update refs when data changes
  useEffect(() => {
    console.log('🔄 NostrProvider updating refs:', {
      relayUrl: config.relayUrl,
      userRelays: userRelays?.map(r => ({ url: r.url, read: r.read, write: r.write })),
    });

    relayUrl.current = config.relayUrl;
    userRelaysRef.current = userRelays;
    queryClient.resetQueries();
  }, [config.relayUrl, userRelays, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        // Get user's read relays from NIP-65 list
        const userReadRelays = userRelaysRef.current
          ?.filter(relay => relay.read)
          .map(relay => relay.url) || [];

        // Use user's read relays if available, otherwise fall back to current relay
        const targetRelays = userReadRelays.length > 0
          ? userReadRelays
          : [relayUrl.current];

        console.log('📡 Routing query to relays:', targetRelays);
        return new Map(targetRelays.map(relay => [relay, filters]));
      },
      eventRouter(_event: NostrEvent) {
        const allRelays = new Set<string>();

        // Add user's write relays from NIP-65 list
        const userWriteRelays = userRelaysRef.current
          ?.filter(relay => relay.write)
          .map(relay => relay.url) || [];

        for (const url of userWriteRelays) {
          allRelays.add(url);
        }

        // If no user write relays, fall back to current relay
        if (allRelays.size === 0) {
          allRelays.add(relayUrl.current);
        }

        // Also add preset relays as backup, capped to 10 total
        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);

          if (allRelays.size >= 10) {
            break;
          }
        }

        console.log('📤 Routing event to relays:', [...allRelays]);
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
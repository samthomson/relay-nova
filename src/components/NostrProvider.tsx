import React, { useEffect, useRef, createContext, useContext } from 'react';
import { NostrEvent, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';

interface NostrProviderProps {
  children: React.ReactNode;
}

interface UserRelay {
  url: string;
  read: boolean;
  write: boolean;
}

// Context to allow UserRelaysProvider to update the userRelaysRef
const NostrInternalContext = createContext<{
  setUserRelays: (relays: UserRelay[]) => void;
} | undefined>(undefined);

export function useNostrInternal() {
  const context = useContext(NostrInternalContext);
  if (!context) {
    return { setUserRelays: () => { } }; // No-op if not available
  }
  return context;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, initialRelays } = useAppContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayUrl = useRef<string>(config.relayUrl);
  const userRelaysRef = useRef<UserRelay[]>([]);
  const initialRelaysRef = useRef<string[]>(initialRelays || []);

  // Track previous relay URL to avoid unnecessary resets
  const prevRelayUrlRef = useRef(config.relayUrl);

  // Update refs when data changes
  useEffect(() => {
    relayUrl.current = config.relayUrl;
    initialRelaysRef.current = initialRelays || [];

    // Only reset queries if the relay URL actually changed
    if (prevRelayUrlRef.current !== config.relayUrl) {
      queryClient.resetQueries();
      prevRelayUrlRef.current = config.relayUrl;
    }
  }, [config.relayUrl, initialRelays, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        // Use initial relays for general queries
        const targetRelays = initialRelaysRef.current;

        return new Map(targetRelays.map(relay => [relay, filters]));
      },
      eventRouter(_event: NostrEvent) {
        // Use initial relays + user write relays for publishing
        // userRelaysRef will be populated by UserRelaysProvider after it mounts
        const userWriteRelays = userRelaysRef.current?.filter(r => r.write).map(r => r.url) || [];
        const targetRelays = [...new Set([...initialRelaysRef.current, ...userWriteRelays])];

        return targetRelays;
      },
    });
  }

  const setUserRelays = (relays: UserRelay[]) => {
    userRelaysRef.current = relays;
  };

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      <NostrInternalContext.Provider value={{ setUserRelays }}>
        {children}
      </NostrInternalContext.Provider>
    </NostrContext.Provider>
  );
};

export default NostrProvider;
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface UserRelay {
  url: string;
  read: boolean;
  write: boolean;
}

interface UserRelaysContextType {
  userRelays: UserRelay[] | undefined;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const UserRelaysContext = createContext<UserRelaysContextType | undefined>(undefined);

function validateNip65Event(event: any): event is { tags: string[][] } {
  return event &&
         event.kind === 10002 &&
         Array.isArray(event.tags) &&
         event.tags.every(tag => Array.isArray(tag) && tag.length >= 2);
}

export function UserRelaysProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  const { data: userRelays, isLoading, refetch } = useQuery({
    queryKey: ['user-relays', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey || !nostr) return [];

      console.log('🔍 Fetching fresh NIP-65 relay list for:', user.pubkey);

      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([
        {
          kinds: [10002], // NIP-65 relay list
          authors: [user.pubkey],
          limit: 1,
        }
      ], { signal });

      console.log('📡 Found NIP-65 events:', events.length);

      const latestEvent = events[0];
      if (!latestEvent || !validateNip65Event(latestEvent)) {
        console.log('❌ No valid NIP-65 event found');
        return [];
      }

      console.log('✅ Valid NIP-65 event found with tags:', latestEvent.tags);

      // Parse relay tags
      const relayList: UserRelay[] = [];
      for (const tag of latestEvent.tags) {
        if (tag[0] === 'r' && tag[1]) {
          const url = tag[1].trim();
          const read = tag.includes('read');
          const write = tag.includes('write');

          relayList.push({
            url,
            read: read || (!tag.includes('read') && !tag.includes('write')), // Default to read if no permissions specified
            write: write || (!tag.includes('read') && !tag.includes('write')), // Default to write if no permissions specified
          });
        }
      }

      console.log('📋 Parsed relay list:', relayList);
      return relayList;
    },
    enabled: !!user?.pubkey && !!nostr,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data at all
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  // Auto-switch to user's first write relay when available
  useEffect(() => {
    if (userRelays && userRelays.length > 0) {
      const writeRelays = userRelays.filter(relay => relay.write);
      if (writeRelays.length > 0) {
        // We'll handle this in AppProvider by listening to this context
        // For now, we'll store the preferred relay in localStorage
        const preferredRelay = writeRelays[0].url;
        const currentRelay = localStorage.getItem('nostr:app-config');
        if (currentRelay) {
          try {
            const config = JSON.parse(currentRelay);
            if (config.relayUrl !== preferredRelay) {
              // Update the config with the new relay
              const updatedConfig = { ...config, relayUrl: preferredRelay };
              localStorage.setItem('nostr:app-config', JSON.stringify(updatedConfig));
              // Trigger a page reload to apply the new config
              window.location.reload();
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }
  }, [userRelays]);

  const value: UserRelaysContextType = {
    userRelays,
    isLoading,
    refetch,
  };

  return (
    <UserRelaysContext.Provider value={value}>
      {children}
    </UserRelaysContext.Provider>
  );
}

export function useUserRelaysContext() {
  const context = useContext(UserRelaysContext);
  if (context === undefined) {
    throw new Error('useUserRelaysContext must be used within a UserRelaysProvider');
  }
  return context;
}
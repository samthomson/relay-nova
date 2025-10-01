import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useRelayConfigContext } from '@/contexts/RelayConfigContext';

interface UserRelay {
  url: string;
  read: boolean;
  write: boolean;
}

interface UserRelaysContextType {
  userRelays: UserRelay[] | undefined;
  isLoading: boolean;
  refetch: () => Promise<void>;
  updateRelayList: (newRelays: UserRelay[]) => Promise<void>;
  removeRelay: (relayUrl: string) => Promise<void>;
  togglePermission: (relayUrl: string, permission: 'read' | 'write') => Promise<void>;
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
  const { setUserRelays } = useRelayConfigContext();

  // Local state for immediate UI updates - this is the source of truth
  const [localRelays, setLocalRelays] = useState<UserRelay[]>([]);

  const { data: networkRelays, isLoading, refetch } = useQuery({
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
    staleTime: 5 * 60 * 1000, // 5 minutes - consider data stale after 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep data in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: true, // Only fetch on mount
    refetchOnReconnect: true, // Refetch when reconnecting to internet
  });

  // Sync network data to local state when network query completes
  useEffect(() => {
    if (networkRelays) {
      console.log('🔄 Syncing network relays to local state:', networkRelays);
      setLocalRelays(networkRelays);
      // Update the shared relay config context
      setUserRelays(networkRelays);
    }
  }, [networkRelays, setUserRelays]);

  const { mutate: publishRelayList } = useMutation({
    mutationFn: async (relaysToPublish: UserRelay[]) => {
      if (!user?.pubkey) throw new Error('User not authenticated');

      console.log('📤 Publishing NIP-65 event with relays:', relaysToPublish);

      const tags = relaysToPublish.map(relay => {
        const tag = ['r', relay.url];
        if (relay.read && !relay.write) tag.push('read');
        if (relay.write && !relay.read) tag.push('write');
        return tag;
      });

      // Create and publish the event
      const event = {
        kind: 10002,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      // Sign and publish the event
      const signedEvent = await user.signer.signEvent(event);

      // Publish to all relays
      await nostr?.event(signedEvent);

      console.log('✅ NIP-65 event published successfully');
    },
    onSuccess: () => {
      // Refetch to ensure we're in sync with the network
      refetch();
    },
  });

  const updateRelayList = async (newRelays: UserRelay[]) => {
    console.log('🔄 Updating relay list locally:', newRelays);

    // Update local state immediately for instant UI feedback
    setLocalRelays(newRelays);
    // Update the shared relay config context
    setUserRelays(newRelays);

    // Publish to network in the background
    await publishRelayList(newRelays);
  };

  const removeRelay = async (relayUrl: string) => {
    console.log('🗑️ Removing relay locally:', relayUrl);

    // Update local state immediately
    const updatedRelays = localRelays.filter(relay => relay.url !== relayUrl);
    setLocalRelays(updatedRelays);
    // Update the shared relay config context
    setUserRelays(updatedRelays);

    // Publish to network in the background
    await publishRelayList(updatedRelays);
  };

  const togglePermission = async (relayUrl: string, permission: 'read' | 'write') => {
    console.log(`🔄 Toggling ${permission} permission for relay:`, relayUrl);

    // Update local state immediately
    const updatedRelays = localRelays.map(relay => {
      if (relay.url === relayUrl) {
        return { ...relay, [permission]: !relay[permission] };
      }
      return relay;
    });
    setLocalRelays(updatedRelays);
    // Update the shared relay config context
    setUserRelays(updatedRelays);

    // Publish to network in the background
    await publishRelayList(updatedRelays);
  };

  const value: UserRelaysContextType = {
    userRelays: localRelays,
    isLoading,
    refetch,
    updateRelayList,
    removeRelay,
    togglePermission,
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
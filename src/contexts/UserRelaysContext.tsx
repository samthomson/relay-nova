import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { useNostrInternal } from '@/components/NostrProvider';

interface UserRelay {
  url: string;
  read: boolean;
  write: boolean;
}

interface UserRelaysContextType {
  userRelays: UserRelay[] | undefined;
  isLoading: boolean;
  refetch: () => Promise<any>;
  updateRelayList: (newRelays: UserRelay[]) => Promise<void>;
  removeRelay: (relayUrl: string) => Promise<void>;
  togglePermission: (relayUrl: string, permission: 'read' | 'write') => Promise<void>;
  // Also expose the current relay URL for visualization
  currentRelayUrl: string;
  setCurrentRelayUrl: (url: string) => void;
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
  const { config, updateConfig, initialRelays } = useAppContext();
  const { setUserRelays } = useNostrInternal();

  // Local state for immediate UI updates - this is the source of truth
  const [localRelays, setLocalRelays] = useState<UserRelay[]>([]);

  // Current relay URL for visualization (from app config)
  const currentRelayUrl = config.relayUrl;
  const setCurrentRelayUrl = (url: string) => {
    updateConfig((current) => ({ ...current, relayUrl: url }));
  };

  const { data: networkRelays, isLoading, refetch } = useQuery({
    queryKey: ['user-relays', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey || !nostr) {
        return [];
      }

      // Query from initial relays to find user's relay list
      // We can't use user relays to fetch the user relay list (circular dependency),
      // so we use the initial relays where kind 10002 is commonly published
      const queryRelays = initialRelays || [];

      // Query all relays at once using nostr.group()
      const relayGroup = nostr.group(queryRelays);
      const events = await relayGroup.query([
        {
          kinds: [10002],
          authors: [user.pubkey],
          limit: 1,
        }
      ], { signal: AbortSignal.timeout(10000) });

      const latestEvent = events[0];
      if (!latestEvent || !validateNip65Event(latestEvent)) {
        return [];
      }

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

      return relayList;
    },
    enabled: !!user?.pubkey && !!nostr,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  // Sync network data to local state when network query completes
  useEffect(() => {
    if (networkRelays) {
      setLocalRelays(networkRelays);
      // Update NostrProvider's ref so publishing uses these relays
      setUserRelays(networkRelays);
    }
  }, [networkRelays, setUserRelays]);

  const { mutate: publishRelayList } = useMutation({
    mutationFn: async (relaysToPublish: UserRelay[]) => {
      if (!user?.pubkey) throw new Error('User not authenticated');

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

      // Use initial + user write relays for publishing
      const userWriteRelays = relaysToPublish.filter(r => r.write).map(r => r.url);
      const publishRelays = [...new Set([...(initialRelays || []), ...userWriteRelays])];

      const publishGroup = nostr.group(publishRelays);
      await publishGroup.event(signedEvent);
    },
    onSuccess: () => {
      // Refetch to ensure we're in sync with the network
      refetch();
    },
  });

  const updateRelayList = async (newRelays: UserRelay[]) => {
    // Update local state immediately for instant UI feedback
    setLocalRelays(newRelays);

    // Publish to network in the background
    await publishRelayList(newRelays);
  };

  const removeRelay = async (relayUrl: string) => {
    // Update local state immediately
    const updatedRelays = localRelays.filter(relay => relay.url !== relayUrl);
    setLocalRelays(updatedRelays);

    // Publish to network in the background
    await publishRelayList(updatedRelays);
  };

  const togglePermission = async (relayUrl: string, permission: 'read' | 'write') => {
    // Update local state immediately
    const updatedRelays = localRelays.map(relay => {
      if (relay.url === relayUrl) {
        return { ...relay, [permission]: !relay[permission] };
      }
      return relay;
    });
    setLocalRelays(updatedRelays);

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
    currentRelayUrl,
    setCurrentRelayUrl,
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
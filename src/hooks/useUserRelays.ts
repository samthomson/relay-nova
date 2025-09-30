import { useNostr } from '@/hooks/useNostr';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface UserRelay {
  url: string;
  read: boolean;
  write: boolean;
}

function validateNip65Event(event: any): event is { tags: string[][] } {
  return event && 
         event.kind === 10002 && 
         Array.isArray(event.tags) &&
         event.tags.every(tag => Array.isArray(tag) && tag.length >= 2);
}

export function useUserRelays() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-relays', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.timeout(3000);
      const events = await nostr.query([
        {
          kinds: [10002], // NIP-65 relay list
          authors: [user.pubkey],
          limit: 1,
        }
      ], { signal });

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
    enabled: !!user?.pubkey,
  });
}
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useNostr } from '@/hooks/useNostr';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Server, Network } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface MyRelaysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RelayListItem {
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

export function MyRelaysModal({ isOpen, onClose }: MyRelaysModalProps) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  const { data: relays, isLoading } = useQuery({
    queryKey: ['nip65-relays', user?.pubkey],
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
      const relayList: RelayListItem[] = [];
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-black/90 backdrop-blur-md border border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-orange-400" />
            My Relays
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-12 rounded-full" />
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : relays && relays.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {relays.map((relay, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Server className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-white/80 text-sm font-mono truncate">
                      {relay.url}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {relay.read && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                        Read
                      </Badge>
                    )}
                    {relay.write && (
                      <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                        Write
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Network className="w-12 h-12 mx-auto mb-4 text-white/30" />
              <p className="text-white/60 mb-2">No relay list found</p>
              <p className="text-white/40 text-sm">
                Your NIP-65 relay list appears to be empty. Configure your preferred relays in your Nostr client.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
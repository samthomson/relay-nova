import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUserRelaysContext } from '@/contexts/UserRelaysContext';
import { Server, Network, X, Trash2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
  const { userRelays: relays, isLoading } = useUserRelaysContext();
  const { mutate: publishEvent, isPending: isPublishing } = useNostrPublish();
  const queryClient = useQueryClient();

  // Track which relays are being toggled - now connected to mutation state
  const [togglingRelays, setTogglingRelays] = useState<Set<string>>(new Set());

  // Clear toggling state when publishing completes OR when relays data updates
  useEffect(() => {
    if (!isPublishing) {
      setTogglingRelays(new Set());
    }
  }, [isPublishing]);

  // Also clear toggling state when relays data changes (indicating successful update)
  useEffect(() => {
    // When relays data updates, clear any remaining toggling states
    if (relays && togglingRelays.size > 0) {
      setTogglingRelays(new Set());
    }
  }, [relays, togglingRelays.size]);

  const updateRelayList = async (updatedRelays: RelayListItem[]) => {
  const tags = updatedRelays.map(relay => {
    const tag = ['r', relay.url];
    if (relay.read && !relay.write) tag.push('read');
    if (relay.write && !relay.read) tag.push('write');
    return tag;
  });

  await publishEvent({
    kind: 10002,
    content: '',
    tags,
  });

  // Invalidate the query to refresh the data
  queryClient.invalidateQueries({ queryKey: ['user-relays'] });
};

const removeRelay = async (relayToRemove: RelayListItem) => {
  if (!relays) return;
  const updatedRelays = relays.filter(relay => relay.url !== relayToRemove.url);
  await updateRelayList(updatedRelays);
};

const togglePermission = async (relayUrl: string, permission: 'read' | 'write') => {
  if (!relays) return;

  // Add to toggling set
  setTogglingRelays(prev => new Set(prev).add(relayUrl));

  try {
    const updatedRelays = relays.map(relay => {
      if (relay.url === relayUrl) {
        return { ...relay, [permission]: !relay[permission] };
      }
      return relay;
    });
    await updateRelayList(updatedRelays);

    // Don't remove from toggling set here - let data refetch handle it
    // This keeps spinner visible until actual data updates
  } catch (error) {
    // Remove from toggling set on error
    setTogglingRelays(prev => {
      const newSet = new Set(prev);
      newSet.delete(relayUrl);
      return newSet;
    });
    console.error('Failed to toggle relay permission:', error);
  }
};

return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-gray-900/95 backdrop-blur-md border border-white/10">
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggleable Read Badge */}
                    <button
                      onClick={() => togglePermission(relay.url, 'read')}
                      disabled={togglingRelays.has(relay.url) || isPublishing}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                        relay.read
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60'
                      } ${(togglingRelays.has(relay.url) || isPublishing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {(togglingRelays.has(relay.url) || isPublishing) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      Read
                    </button>

                    {/* Toggleable Write Badge */}
                    <button
                      onClick={() => togglePermission(relay.url, 'write')}
                      disabled={togglingRelays.has(relay.url) || isPublishing}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                        relay.write
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60'
                      } ${(togglingRelays.has(relay.url) || isPublishing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {(togglingRelays.has(relay.url) || isPublishing) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      Write
                    </button>

                    {/* Remove Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-white/40 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-gray-900/95 backdrop-blur-md border border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Remove Relay</AlertDialogTitle>
                          <AlertDialogDescription className="text-white/70">
                            Are you sure you want to remove "{relay.url}" from your relay list? This action will update your NIP-65 event.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeRelay(relay)}
                            className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
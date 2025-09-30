import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUserRelaysContext } from '@/contexts/UserRelaysContext';
import { Server, Network, X, Trash2, Loader2, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  const { userRelays: relays, isLoading, removeRelay, togglePermission, updateRelayList } = useUserRelaysContext();

  // State for adding new relay
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [isAddingRelay, setIsAddingRelay] = useState(false);

  // Track which relays are being toggled
  const [togglingRelays, setTogglingRelays] = useState<Set<string>>(new Set());

  const handleAddRelay = async () => {
    if (!newRelayUrl.trim() || !relays) return;

    setIsAddingRelay(true);
    try {
      // Validate URL format
      let url = newRelayUrl.trim();
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        url = 'wss://' + url;
      }

      // Check if relay already exists
      if (relays.some(relay => relay.url === url)) {
        alert('This relay is already in your list');
        return;
      }

      // Add new relay with default permissions
      const newRelay = { url, read: true, write: true };
      const updatedRelays = [...relays, newRelay];

      await updateRelayList(updatedRelays);
      setNewRelayUrl('');
    } catch (error) {
      console.error('Error adding relay:', error);
      alert('Failed to add relay. Please check the URL and try again.');
    } finally {
      setIsAddingRelay(false);
    }
  };

  const handleTogglePermission = async (relayUrl: string, permission: 'read' | 'write') => {
    setTogglingRelays(prev => new Set(prev).add(relayUrl));
    try {
      await togglePermission(relayUrl, permission);
    } finally {
      setTogglingRelays(prev => {
        const newSet = new Set(prev);
        newSet.delete(relayUrl);
        return newSet;
      });
    }
  };

  const handleRemoveRelay = async (relayToRemove: RelayListItem) => {
    try {
      await removeRelay(relayToRemove.url);
    } catch (error) {
      console.error('Error removing relay:', error);
      alert('Failed to remove relay. Please try again.');
    }
  };

  // Check if we're in a loading state
  const isAnyOperationPending = isLoading || isAddingRelay || togglingRelays.size > 0;

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
          {/* Add New Relay Section */}
          <div className="flex gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
            <Input
              placeholder="Enter relay URL (e.g., relay.example.com)"
              value={newRelayUrl}
              onChange={(e) => setNewRelayUrl(e.target.value)}
              className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              onKeyPress={(e) => e.key === 'Enter' && handleAddRelay()}
            />
            <Button
              onClick={handleAddRelay}
              disabled={!newRelayUrl.trim() || isAddingRelay}
              className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30"
            >
              {isAddingRelay ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </Button>
          </div>

          {isLoading || isAnyOperationPending ? (
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
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
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
                      onClick={() => handleTogglePermission(relay.url, 'read')}
                      disabled={togglingRelays.has(relay.url)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                        relay.read
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60'
                      } ${togglingRelays.has(relay.url) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {togglingRelays.has(relay.url) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      Read
                    </button>

                    {/* Toggleable Write Badge */}
                    <button
                      onClick={() => handleTogglePermission(relay.url, 'write')}
                      disabled={togglingRelays.has(relay.url)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                        relay.write
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60'
                      } ${togglingRelays.has(relay.url) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {togglingRelays.has(relay.url) ? (
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
                            onClick={() => handleRemoveRelay(relay)}
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
              <p className="text-white/60 mb-2">No relays configured</p>
              <p className="text-white/40 text-sm">
                Add your preferred relays above to get started. They will be saved to your NIP-65 relay list.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
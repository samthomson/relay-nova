import { useState, useEffect, forwardRef, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';
import { Plus, SkipForward, X, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Loader2 } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';
import { NoteContent } from './NoteContent';
import { useUserRelaysContext } from '@/contexts/UserRelaysContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
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

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

interface RelayNotesPanelProps {
  relay: RelayLocation;
  side: 'left' | 'right' | 'bottom';
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onWheel?: (event: React.WheelEvent<HTMLDivElement>) => void;
  onEventsChange?: (events: NostrEvent[] | null, loaded: boolean) => void;
  forwardScrollableRef?: React.RefObject<{ scrollableRef: React.RefObject<HTMLDivElement> }>;
}

export const RelayNotesPanel = forwardRef<HTMLDivElement, RelayNotesPanelProps>(
  ({ relay, side, onClose, onMouseEnter, onMouseLeave, onMouseDown, onWheel, onEventsChange, forwardScrollableRef }, ref) => {
  const { nostr } = useNostr();
  const [notes, setNotes] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const { userRelays, updateRelayList, removeRelay } = useUserRelaysContext();
  const { user } = useCurrentUser();

  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const addCurrentRelay = async () => {
    if (!user || !userRelays) return;

    const relayUrl = relay.url.startsWith('wss://') ? relay.url : `wss://${relay.url}`;

    // Check if relay already exists
    if (userRelays.some(r => r.url === relayUrl)) {
      return;
    }

    setIsAdding(true);
    try {
      const newRelays = [...userRelays, { url: relayUrl, read: true, write: true }];
      await updateRelayList(newRelays);
    } catch (error) {
      console.error('Error adding relay:', error);
      alert('Failed to add relay. Please check the URL and try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const removeCurrentRelay = async () => {
    if (!user) return;

    const relayUrl = relay.url.startsWith('wss://') ? relay.url : `wss://${relay.url}`;
    console.log('🗑️ RELAY VIEWER: Attempting to remove relay:', relayUrl);
    console.log('🗑️ RELAY VIEWER: Current userRelays:', userRelays);
    console.log('🗑️ RELAY VIEWER: removeRelay function:', removeRelay);

    setIsRemoving(true);
    try {
      console.log('🗑️ RELAY VIEWER: Calling removeRelay...');
      await removeRelay(relayUrl);
      console.log('🗑️ RELAY VIEWER: removeRelay completed');
    } catch (error) {
      console.error('🗑️ RELAY VIEWER: Error removing relay:', error);
      alert('Failed to remove relay. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  };

  // Check if user already has this relay
  const relayUrl = relay.url.startsWith('wss://') ? relay.url : `wss://${relay.url}`;
  console.log('🔍 RELAY VIEWER: Original relay.url:', relay.url);
  console.log('🔍 RELAY VIEWER: Normalized relayUrl:', relayUrl);

  // Debug URL matching
  const urlMatches = userRelays?.map(r => ({
    url: r.url,
    match: r.url === relayUrl,
    alsoMatch: r.url === `wss://${relay.url.replace(/^wss:\/\//, '')}`,
    alsoMatch2: r.url === relay.url.replace(/^wss:\/\//, '')
  }));
  console.log('🔍 RELAY VIEWER: URL matching analysis:', urlMatches);

  const hasRelay = userRelays?.some(r => r.url === relayUrl) || false;
  console.log('🔍 RELAY VIEWER: hasRelay final:', hasRelay);

  const { isAutoPilotMode, stopAutoPilot } = useAutoPilotContext();

  const handleNextRelay = () => {
    if (isAutoPilotMode) {
      console.log('⏭️ Stopping auto pilot via Next button');
      stopAutoPilot();
    }
  };

  const scrollUp = () => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollBy({
        top: -200,
        behavior: 'smooth'
      });
    }
  };

  const scrollDown = () => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollBy({
        top: 200,
        behavior: 'smooth'
      });
    }
  };

  // Use ref to avoid onEventsChange dependency causing infinite loop
  const onEventsChangeRef = useRef(onEventsChange);

  // Update ref when prop changes
  useEffect(() => {
    onEventsChangeRef.current = onEventsChange;
  }, [onEventsChange]);

  // Track the current relay URL to prevent rapid restarts
  const currentRelayUrlRef = useRef(relay.url);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize events state
  useEffect(() => {
    // Notify parent that events are not loaded initially
    if (onEventsChangeRef.current) {
      onEventsChangeRef.current(null, false);
    }
  }, []);

  useEffect(() => {
    const fetchNotes = async () => {
      // Prevent concurrent fetches for the same relay
      if (isFetchingRef.current && currentRelayUrlRef.current === relay.url) {
        console.log(`⏭️ Already fetching notes for ${relay.url}, skipping duplicate request`);
        return;
      }

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      isFetchingRef.current = true;
      currentRelayUrlRef.current = relay.url;

      if (!nostr) return;

      console.log(`🔍 Fetching notes from relay: ${relay.url}`);
      setIsLoading(true);
      setError(null);
      setNotes([]); // Clear existing notes

      try {
        // Connect to the specific relay
        const relayConnection = nostr.relay(relay.url);

        // Query for latest 20 notes (kind:1 events)
        const events = await relayConnection.query([
          {
            kinds: [1],
            limit: 20,
          }
        ], {
          signal: AbortSignal.any([
            abortControllerRef.current.signal,
            AbortSignal.timeout(5000)
          ])
        });

        // Check if this is still the current relay we want
        if (currentRelayUrlRef.current !== relay.url) {
          console.log(`⏭️ Relay changed during fetch, ignoring results for ${relay.url}`);
          return;
        }

        // Sort by created_at (newest first)
        const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
        setNotes(sortedEvents);
        console.log(`✅ Successfully loaded ${sortedEvents.length} notes from ${relay.url}`);

        // Notify parent that events are loaded (even if 0 events, it's still "loaded")
        if (onEventsChangeRef.current) {
          onEventsChangeRef.current(sortedEvents, true);
        }
      } catch (err) {
        // Check if this was an abort due to relay change
        if (err instanceof Error && err.name === 'AbortError') {
          console.log(`⏭️ Fetch aborted for ${relay.url} due to relay change`);
          return;
        }

        // Silently handle relay connection failures - this is expected for offline relays
        console.error(`❌ Failed to fetch notes from ${relay.url}:`, err);
        setError('Failed to fetch notes from this relay');

        // Notify parent that events failed to load
        if (onEventsChangeRef.current) {
          onEventsChangeRef.current(null, false);
        }
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchNotes();

    // Cleanup function to abort any pending request
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [relay.url, nostr]); // Removed onEventsChange to prevent infinite loop

  // Expose scrollable ref to parent
  useEffect(() => {
    if (forwardScrollableRef) {
      forwardScrollableRef.current = { scrollableRef };
    }
  }, [forwardScrollableRef]);

  const getPanelClasses = () => {
    const baseClasses = 'absolute bg-black/95 backdrop-blur-sm border border-white/20 text-white transition-all duration-300 z-[99999] pointer-events-auto flex flex-col';

    if (side === 'bottom') {
      return `${baseClasses} bottom-8 left-4 right-4 h-[70vh] rounded-2xl border-2`;
    } else {
      return `${baseClasses} top-24 bottom-8 w-[380px] max-w-[35vw] h-[70vh] rounded-2xl border-2 ${
        side === 'right' ? 'right-4' : 'left-4'
      }`;
    }
  };

  return (
    <>
      <div
        ref={ref}
        className={getPanelClasses()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        data-relay-panel="true"
      >
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <MessageCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg truncate">
                {relay.url.startsWith('wss://') ? relay.url : `wss://${relay.url}`}
              </h3>
              {relay.city && (
                <p className="text-sm text-gray-400 truncate">
                  {relay.city}, {relay.country}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Add/Remove Relay Button on new line */}
        {user && (
          <div className="flex justify-start gap-2">
            {!hasRelay ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => addCurrentRelay()}
                disabled={isAdding}
                className="bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30 text-xs px-3 py-1 h-7"
              >
                {isAdding ? (
                  <div className="w-3 h-3 border-2 border-green-300 border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                add relay
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRemoving}
                    className="bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 text-xs px-3 py-1 h-7"
                  >
                    {isRemoving ? (
                      <div className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin mr-1" />
                    ) : (
                      <Trash2 className="w-3 h-3 mr-1" />
                    )}
                    remove relay
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-900/95 backdrop-blur-md border border-white/10 z-[1000000]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Remove Relay</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/70">
                      Are you sure you want to remove "{relayUrl}" from your relay list? This action will update your NIP-65 event.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeCurrentRelay()}
                      className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

          {/* Stop Button - Only show in auto pilot mode */}
          {isAutoPilotMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextRelay}
              className="bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 text-xs px-3 py-1 h-7"
            >
              <SkipForward className="w-3 h-3 mr-1" />
              stop
            </Button>
          )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">


        {/* Scrollable content area */}
        <div
          ref={scrollableRef}
          className="flex-1 overflow-y-auto"
          data-scrollable="true"
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth'
          }}
          onWheel={(e) => {
            e.stopPropagation();
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <p className="text-sm text-gray-400">Fetching latest notes...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <p className="text-sm text-red-400 mb-2">{error}</p>
                <p className="text-xs text-gray-500">This relay may be offline or not responding</p>
              </div>
            </div>
          ) : notes.length === 0 ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <MessageCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notes found on this relay</p>
                <p className="text-xs text-gray-500 mt-1">This relay might not have public content</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
);

function NoteCard({ note }: { note: NostrEvent }) {
  const author = useAuthor(note.pubkey);
  const metadata = author.data?.metadata;
  const isLoadingAuthor = author.isLoading;

  const displayName = metadata?.name || metadata?.display_name || `@${note.pubkey.slice(0, 8)}`;
  const timeAgo = new Date(note.created_at * 1000).toLocaleDateString();

  return (
    <Card data-note-card="true" className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors w-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar */}
          {metadata?.picture ? (
            <img
              src={metadata.picture}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0"
              onError={(e) => {
                // Fallback to gradient if image fails
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.parentElement?.querySelector('.avatar-fallback') as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 avatar-fallback">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium text-white truncate">
              {isLoadingAuthor ? 'Loading...' : displayName}
            </CardTitle>
            <p className="text-xs text-gray-400">{timeAgo}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-gray-300 leading-relaxed break-words overflow-hidden">
          <NoteContent event={note} className="[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_img]:object-contain [&_a]:break-all [&_a]:text-xs [&_*]:max-w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
import { useState, useEffect, forwardRef, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';
import { Plus, SkipForward, X, Trash2, Globe, Server, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Loader2 } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';
import { NoteContent } from './NoteContent';
import { useUserRelaysContext } from '@/contexts/UserRelaysContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
import { useRelayNotes } from '@/hooks/useRelaySpecificQuery';

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
  panelType?: 'relay' | 'user';
}

export const RelayNotesPanel = forwardRef<HTMLDivElement, RelayNotesPanelProps>(
  ({ relay, side, onClose, onMouseEnter, onMouseLeave, onMouseDown, onWheel, onEventsChange, forwardScrollableRef, panelType = 'relay' }, ref) => {
    const { userRelays, updateRelayList, removeRelay } = useUserRelaysContext();
    const { user } = useCurrentUser();

    // Use the new routing hook for relay-specific queries
    const { data: notes = [], isLoading, error } = useRelayNotes(relay.url, {
      limit: 20,
      enabled: !!relay.url,
    });

    const scrollableRef = useRef<HTMLDivElement>(null);

    const [isAdding, setIsAdding] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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
        alert('Failed to add relay. Please check your URL and try again.');
      } finally {
        setIsAdding(false);
      }
    };

    const removeCurrentRelay = async () => {
      if (!user) return;

      const relayUrl = relay.url.startsWith('wss://') ? relay.url : `wss://${relay.url}`;

      setIsRemoving(true);
      try {
        await removeRelay(relayUrl);
        setShowConfirmDialog(false);
      } catch (error) {
        console.error('Error removing relay:', error);
        alert('Failed to remove relay. Please try again.');
      } finally {
        setIsRemoving(false);
      }
    };

    const openConfirmDialog = () => {
      setShowConfirmDialog(true);
    };

    const cancelRemove = () => {
      setShowConfirmDialog(false);
    };

    // Check if user already has this relay
    const relayUrl = relay.url.startsWith('wss://') ? relay.url : `wss://${relay.url}`;
    const hasRelay = userRelays?.some(r => r.url === relayUrl) || false;

    const { isAutoPilotMode, stopAutoPilot, relayDisplayProgress } = useAutoPilotContext();

    const handleNextRelay = () => {
      if (isAutoPilotMode) {
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

    // Notify parent about events changes
    useEffect(() => {
      if (onEventsChange) {
        onEventsChange(notes, !isLoading);
      }
    }, [notes, isLoading, onEventsChange]);


    // Expose scrollable ref to parent
    useEffect(() => {
      if (forwardScrollableRef) {
        forwardScrollableRef.current = { scrollableRef };
      }
    }, [forwardScrollableRef]);

    // Panel classes function - handles both relay and user panel positioning
    const getPanelClasses = (isUserPanel: boolean = false) => {
      const baseClasses = 'absolute bg-black/95 backdrop-blur-sm border border-white/20 text-white transition-all duration-300 z-[99999] pointer-events-auto flex flex-col overflow-hidden';

      if (side === 'bottom') {
        return `${baseClasses} bottom-8 left-4 right-4 h-[70vh] rounded-2xl border-2`;
      } else {
        // Position user panels right next to relay panels
        return `${baseClasses} top-24 bottom-8 w-[380px] max-w-[35vw] h-[70vh] rounded-2xl border-2 ${isUserPanel ? (side === 'right' ? 'left-[404px]' : 'right-[404px]') : (side === 'right' ? 'right-4' : 'left-4')
          }`;
      }
    };

    return (
      <>
        <div
          ref={ref}
          className={getPanelClasses(panelType === 'user')}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onMouseDown={onMouseDown}
          data-relay-panel="true"
        >
          {/* Autopilot Progress Bar - at the very top, inside rounded corners */}
          {isAutoPilotMode && (
            <div className="h-[2px] bg-white/10 relative overflow-hidden rounded-t-2xl">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-orange-500 transition-all duration-100 ease-linear"
                style={{ width: `${relayDisplayProgress}%` }}
              />
            </div>
          )}

          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-white/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Server className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-lg truncate">
                    {relay.url.startsWith('wss://') ? relay.url : `wss://${relay.url}`}
                  </h3>
                  {relay.country && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/20">
                      <Globe className="w-3 h-3 mr-1" />
                      {relay.country}
                    </span>
                  )}
                  {relay.city && (
                    <p className="text-sm text-gray-400 truncate">
                      📍 {relay.city}
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openConfirmDialog}
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

          {/* Custom Confirmation Dialog - overlays within panel */}
          {showConfirmDialog && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
              <div className="bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Trash2 className="w-6 h-6 text-red-400 mt-1" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">Remove Relay</h3>
                    <p className="text-white/70 text-sm mb-4">
                      Are you sure you want to remove "{relayUrl}" from your relay list? This action will update your NIP-65 event.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={cancelRemove}
                        disabled={isRemoving}
                        className="bg-white/10 text-white hover:bg-white/20 border-white/20"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={removeCurrentRelay}
                        disabled={isRemoving}
                        className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 min-w-[100px]"
                      >
                        {isRemoving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin mr-2" />
                            Removing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  });

function NoteCard({ note }: { note: NostrEvent }) {
  const author = useAuthor(note.pubkey);
  const metadata = author.data?.metadata;
  const isLoadingAuthor = author.isLoading;

  const displayName = metadata?.name || metadata?.display_name || `@${note.pubkey.slice(0, 8)}`;

  const date = new Date(note.created_at * 1000);
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const fullDateTime = `${time} ${dateStr}`;

  // Handler for clicking on author name
  const handleAuthorClick = () => {
    // This will be handled by parent component
    window.dispatchEvent(new CustomEvent('openUserProfile', {
      detail: { pubkey: note.pubkey }
    }));
  };

  return (
    <Card data-note-card="true" className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors w-full overflow-hidden relative group">
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
            <CardTitle
              className="text-sm font-medium text-white truncate cursor-pointer hover:text-blue-400 transition-colors"
              onClick={handleAuthorClick}
              title={`View ${displayName}'s profile`}
            >
              {isLoadingAuthor ? 'Loading...' : displayName}
            </CardTitle>
            <p className="text-xs text-gray-400">{fullDateTime}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-gray-300 leading-relaxed break-words overflow-hidden">
          <NoteContent
            event={note}
            className="[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_img]:object-contain [&_a]:break-all [&_a]:text-xs [&_*]:max-w-full"
            onUserClick={(pubkey: string) => {
              window.dispatchEvent(new CustomEvent('openUserProfile', {
                detail: { pubkey }
              }));
            }}
          />
        </div>
      </CardContent>
      {/* Nostr.band link button */}
      <a
        href={`https://nostr.band/?q=${note.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
        title="View on nostr.band"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="w-3.5 h-3.5 text-white/70 hover:text-blue-400" />
      </a>
    </Card>
  );
}
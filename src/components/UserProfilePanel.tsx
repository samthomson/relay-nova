import { useState, useEffect, forwardRef, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';
import { X, MessageCircle, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NostrEvent } from '@nostrify/nostrify';
import { NoteContent } from './NoteContent';
import { nip19 } from 'nostr-tools';

interface UserProfilePanelProps {
  pubkey: string;
  side: 'left' | 'right' | 'bottom';
  relayUrl?: string;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onWheel?: (event: React.WheelEvent<HTMLDivElement>) => void;
  onEventsChange?: (events: NostrEvent[] | null, loaded: boolean) => void;
  forwardScrollableRef?: React.RefObject<{ scrollableRef: React.RefObject<HTMLDivElement> }>;
}

export const UserProfilePanel = forwardRef<HTMLDivElement, UserProfilePanelProps>(
  ({ pubkey, side, relayUrl, onClose, onMouseEnter, onMouseLeave, onMouseDown, onWheel, onEventsChange, forwardScrollableRef }, ref) => {
  const { nostr } = useNostr();
  const [notes, setNotes] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState<any>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);

  const fetchAuthor = async () => {
    if (!nostr) return;

    try {
      const targetRelay = relayUrl || 'wss://relay.damus.io';
      console.log('🔍 Fetching author metadata for:', pubkey, 'from relay:', targetRelay);
      const relayConnection = nostr.relay(targetRelay);

      const authors = await relayConnection.query([
        {
          kinds: [0],
          authors: [pubkey]
        }
      ], {
        signal: AbortSignal.timeout(3000)
      });

      if (authors.length > 0) {
        const metadata = authors[0];
        console.log('✅ Found author metadata:', metadata);
        setAuthor(metadata);
      }
    } catch (err) {
      console.error('❌ Failed to fetch author metadata:', err);
    }
  };

  const fetchNotes = async () => {
    if (!nostr) return;

    const targetRelay = relayUrl || 'wss://relay.damus.io';
    console.log('🔍 Fetching notes from author:', pubkey, 'from relay:', targetRelay);
    setIsLoading(true);
    setError(null);
    setNotes([]);

    try {
      // Connect to the specific relay (or fallback to relay.damus.io)
      const relayConnection = nostr.relay(targetRelay);

      // Query for latest 20 notes by this author (kind:1 events)
      const events = await relayConnection.query([
        {
          kinds: [1],
          authors: [pubkey],
          limit: 20,
        }
      ], {
        signal: AbortSignal.timeout(5000)
      });

      // Sort by created_at (newest first)
      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
      setNotes(sortedEvents);
      console.log(`✅ Successfully loaded ${sortedEvents.length} notes from author ${pubkey} from ${targetRelay}`);

      // Notify parent that events are loaded
      if (onEventsChange) {
        onEventsChange(sortedEvents, true);
      }
    } catch (err) {
      console.error(`❌ Failed to fetch notes from author ${pubkey} on ${targetRelay}:`, err);
      setError('Failed to fetch notes from this author');

      // Notify parent that events failed to load
      if (onEventsChange) {
        onEventsChange(null, false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pubkey) {
      fetchAuthor();
      fetchNotes();
    }
  }, [pubkey, relayUrl]);

  // Expose scrollable ref to parent
  useEffect(() => {
    if (forwardScrollableRef) {
      forwardScrollableRef.current = { scrollableRef };
    }
  }, [forwardScrollableRef]);

  // Panel classes function - handles both relay and user panel positioning
  const getPanelClasses = () => {
    const baseClasses = 'absolute bg-black/95 backdrop-blur-sm border border-white/20 text-white transition-all duration-300 z-[99999] pointer-events-auto flex flex-col';

    if (side === 'bottom') {
      return `${baseClasses} bottom-8 left-4 right-4 h-[70vh] rounded-2xl border-2`;
    } else {
      // User panels are positioned right next to relay panels
      return `${baseClasses} top-24 bottom-8 w-[380px] max-w-[35vw] h-[70vh] rounded-2xl border-2 ${
        side === 'right' ? 'left-[404px]' : 'right-[404px]'
      }`;
    }
  };

  const getDisplayName = () => {
    if (!author) return `@${pubkey.slice(0, 8)}`;

    const metadata = author.content ? JSON.parse(author.content) : {};
    return metadata.name || metadata.display_name || `@${pubkey.slice(0, 8)}`;
  };

  const getPicture = () => {
    if (!author) return null;

    const metadata = author.content ? JSON.parse(author.content) : {};
    return metadata.picture;
  };

  return (
    <>
      <div
        ref={ref}
        className={getPanelClasses()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        data-user-panel="true"
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-white/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0">
                {getPicture() ? (
                  <img
                    src={getPicture()}
                    alt={getDisplayName()}
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-base font-semibold text-white">
                    {getDisplayName().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg truncate">
                  {getDisplayName()}
                </h3>
                <p className="text-xs text-gray-400 truncate font-mono">
                  {nip19.npubEncode(pubkey)}
                </p>
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

          {/* Link to nostr.band profile */}
          <a
            href={`https://nostr.band/${nip19.npubEncode(pubkey)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View on nostr.band
          </a>
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
                  <p className="text-sm text-gray-400">Fetching notes...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center">
                  <p className="text-sm text-red-400 mb-2">{error}</p>
                  <p className="text-xs text-gray-500">Unable to fetch notes from this user</p>
                </div>
              </div>
            ) : notes.length === 0 ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center">
                  <MessageCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No notes found</p>
                  <p className="text-xs text-gray-500 mt-1">This user hasn't posted any public notes</p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {notes.map((note) => (
                  <UserNoteCard 
                    key={note.id} 
                    note={note}
                    authorDisplayName={getDisplayName()}
                    authorPicture={getPicture() || undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

interface UserNoteCardProps {
  note: NostrEvent;
  authorDisplayName: string;
  authorPicture?: string;
}

function UserNoteCard({ note, authorDisplayName, authorPicture }: UserNoteCardProps) {
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

  return (
    <Card data-note-card="true" className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors w-full overflow-hidden relative group">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar */}
          {authorPicture ? (
            <img
              src={authorPicture}
              alt={authorDisplayName}
              className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.parentElement?.querySelector('.avatar-fallback') as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 avatar-fallback ${authorPicture ? 'hidden' : ''}`}>
            {authorDisplayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium text-white truncate">
              {authorDisplayName}
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
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity z-10"
        title="View on nostr.band"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          window.open(`https://nostr.band/?q=${note.id}`, '_blank', 'noopener,noreferrer');
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ExternalLink className="w-3.5 h-3.5 text-white/70 hover:text-blue-400" />
      </a>
    </Card>
  );
}
import { useState, useEffect, forwardRef } from 'react';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, MessageCircle, Loader2 } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';
import { NoteContent } from './NoteContent';

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
  onWheel?: (event: React.WheelEvent<HTMLDivElement>) => void;
}

export const RelayNotesPanel = forwardRef<HTMLDivElement, RelayNotesPanelProps>(
  ({ relay, side, onClose, onMouseEnter, onMouseLeave, onWheel }, ref) => {
  const { nostr } = useNostr();
  const [notes, setNotes] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!nostr) return;

      setIsLoading(true);
      setError(null);

      try {
        // Connect to the specific relay
        const relayConnection = nostr.relay(relay.url);

        // Query for latest 20 notes (kind:1 events)
        const events = await relayConnection.query([
          {
            kinds: [1],
            limit: 20,
          }
        ], { signal: AbortSignal.timeout(5000) });

        // Sort by created_at (newest first)
        const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
        setNotes(sortedEvents);
      } catch (err) {
        console.error('Error fetching notes from relay:', err);
        setError('Failed to fetch notes from this relay');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotes();
  }, [relay.url, nostr]);

  const getPanelClasses = () => {
    const baseClasses = 'absolute bg-black/95 backdrop-blur-sm border border-white/20 text-white transition-all duration-300 z-[9999] pointer-events-auto flex flex-col';

    if (side === 'bottom') {
      return `${baseClasses} bottom-8 left-4 right-4 h-[70vh] rounded-2xl border-2`;
    } else {
      return `${baseClasses} top-24 bottom-8 w-[380px] max-w-[35vw] h-[70vh] rounded-2xl border-2 ${
        side === 'right' ? 'right-4' : 'left-4'
      }`;
    }
  };

  return (
    <div
      ref={ref}
      className={getPanelClasses()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
      data-relay-panel="true"
    >
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-semibold text-lg">
                {relay.city ? `${relay.city}, ${relay.country}` : 'Relay Notes'}
              </h3>
              <p className="text-sm text-gray-400 font-mono">
                {relay.url.replace('wss://', '').replace('ws://', '')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
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
          <div
            className="flex-1 overflow-y-auto"
            data-scrollable="true"
            style={{
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth'
            }}
          >
            <div className="p-4 space-y-3">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
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
    <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors w-full overflow-hidden">
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
import { useState, useEffect } from 'react';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
}

export function RelayNotesPanel({ relay, side, onClose }: RelayNotesPanelProps) {
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
    const baseClasses = 'absolute bg-black/95 backdrop-blur-sm border border-white/20 text-white transition-all duration-300';
    
    if (side === 'bottom') {
      return `${baseClasses} bottom-0 left-0 right-0 h-80 rounded-t-xl border-t-2 border-l-0 border-r-0`;
    } else {
      return `${baseClasses} top-20 bottom-0 w-96 rounded-l-xl border-l-2 border-t-0 border-b-0 ${
        side === 'right' ? 'right-0 rounded-l-none rounded-r-xl' : 'left-0 rounded-r-none'
      }`;
    }
  };

  return (
    <div className={getPanelClasses()}>
      {/* Header */}
      <div className="p-4 border-b border-white/20">
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
        
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {notes.length} notes
          </Badge>
          {isLoading && (
            <Badge variant="secondary" className="text-xs">
              Loading...
            </Badge>
          )}
          {error && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <p className="text-sm text-gray-400">Fetching latest notes...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              <p className="text-xs text-gray-500">This relay may be offline or not responding</p>
            </div>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <MessageCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notes found on this relay</p>
              <p className="text-xs text-gray-500 mt-1">This relay might not have public content</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: NostrEvent }) {
  const author = useAuthor(note.pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || `@${note.pubkey.slice(0, 8)}`;
  const timeAgo = new Date(note.created_at * 1000).toLocaleDateString();

  return (
    <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-xs font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                {displayName}
              </CardTitle>
              <p className="text-xs text-gray-400">{timeAgo}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            Note
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-gray-300 leading-relaxed">
          <NoteContent event={note} />
        </div>
      </CardContent>
    </Card>
  );
}
import { useMemo } from 'react';
import { type NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';

interface NoteContentProps {
  event: NostrEvent;
  className?: string;
  onUserClick?: (pubkey: string) => void;
}

/** Parses content of text note events so that URLs and hashtags are linkified. */
export function NoteContent({
  event,
  className,
  onUserClick,
}: NoteContentProps) {
  // Process the content to render mentions, links, etc.
  const content = useMemo(() => {
    const text = event.content;

    // Regex to find URLs, Nostr references, hashtags, and image URLs
    const regex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s]*)?)|(https?:\/\/[^\s]+)|nostr:(npub1|note1|nprofile1|nevent1)([023456789acdefghjklmnpqrstuvwxyz]+)|(#\w+)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, url, nostrPrefix, nostrData, hashtag] = match;
      const index = match.index;

      // Add text before this match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }

      if (url) {
        // Check if it's an image URL
        const isImage = /\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s]*)?$/i.test(url);

        if (isImage) {
          parts.push(
            <div key={`img-${keyCounter++}`} className="my-3">
              <img
                src={url}
                alt="Shared image"
                className="max-w-full h-auto rounded-lg border border-white/20"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = document.createElement('a');
                  fallback.href = url;
                  fallback.target = '_blank';
                  fallback.rel = 'noopener noreferrer';
                  fallback.textContent = url;
                  fallback.className = 'text-xs text-blue-500 underline break-all block';
                  target.parentElement?.appendChild(fallback);
                }}
              />
            </div>
          );
        } else {
          // Handle regular URLs - show full URL without truncation
          parts.push(
            <a
              key={`url-${keyCounter++}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline break-all inline-block max-w-full align-top"
              title={url}
            >
              {url}
            </a>
          );
        }
      } else if (nostrPrefix && nostrData) {
        // Handle Nostr references
        try {
          const nostrId = `${nostrPrefix}${nostrData}`;
          const decoded = nip19.decode(nostrId);

          if (decoded.type === 'npub') {
            const pubkey = decoded.data;
            parts.push(
              <NostrMention key={`mention-${keyCounter++}`} pubkey={pubkey} onUserClick={onUserClick} />
            );
          } else {
            // For other types, just show as a link
            parts.push(
              <Link
                key={`nostr-${keyCounter++}`}
                to={`/${nostrId}`}
                className="text-blue-500 hover:underline"
              >
                {fullMatch}
              </Link>
            );
          }
        } catch {
          // If decoding fails, just render as text
          parts.push(fullMatch);
        }
      } else if (hashtag) {
        // Handle hashtags
        const tag = hashtag.slice(1); // Remove the #
        parts.push(
          <Link
            key={`hashtag-${keyCounter++}`}
            to={`/t/${tag}`}
            className="text-blue-500 hover:underline inline-block"
          >
            {hashtag}
          </Link>
        );
      }

      lastIndex = index + fullMatch.length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // If no special content was found, just use the plain text
    if (parts.length === 0) {
      parts.push(text);
    }

    return parts;
  }, [event]);

  return (
    <div className={cn("whitespace-pre-wrap break-words overflow-hidden", className)}>
      {content.length > 0 ? content : event.content}
    </div>
  );
}

// Helper component to display user mentions
function NostrMention({ pubkey, onUserClick }: { pubkey: string; onUserClick?: (pubkey: string) => void }) {
  const author = useAuthor(pubkey);
  const npub = nip19.npubEncode(pubkey);
  const hasRealName = !!author.data?.metadata?.name;
  const displayName = author.data?.metadata?.name ?? genUserName(pubkey);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onUserClick) {
      onUserClick(pubkey);
    }
  };

  return (
    <a
      href={`/${npub}`}
      onClick={handleClick}
      className={cn(
        "font-medium hover:underline inline-block max-w-full align-top cursor-pointer",
        hasRealName
          ? "text-blue-500 hover:text-blue-400"
          : "text-gray-500 hover:text-gray-700"
      )}
      title={`Click to view ${displayName}'s profile`}
    >
      @{displayName}
    </a>
  );
}
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';

/**
 * Hook for fetching author profile metadata using initial relays + optional extra relay
 * This is specifically for fetching note authors' profiles, not the logged-in user's profile
 */
export function useAuthorProfile(
	pubkey: string | undefined,
	options?: {
		enabled?: boolean;
		extraRelay?: string; // optional relay to include (e.g., currently open relay)
	}
) {
	const { nostr } = useNostr();
	const { initialRelays } = useAppContext();

	return useQuery({
		queryKey: ['author-profile', pubkey, options?.extraRelay],
		queryFn: async ({ signal }) => {
			if (!pubkey) {
				return {};
			}

			// Use initial relays + optional extra relay
			const relays = [...initialRelays];
			if (options?.extraRelay && !relays.includes(options.extraRelay)) {
				relays.push(options.extraRelay);
			}

			const relayGroup = nostr.group(relays);
			const events = await relayGroup.query(
				[{ kinds: [0], authors: [pubkey], limit: 1 }],
				{ signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) },
			);

			const event = events[0];
			if (!event) {
				return {};
			}

			try {
				const metadata = n.json().pipe(n.metadata()).parse(event.content);
				return { metadata, event };
			} catch (err) {
				return { event };
			}
		},
		enabled: options?.enabled !== false && !!pubkey,
		retry: 2,
		staleTime: 300000, // 5 minutes
	});
}

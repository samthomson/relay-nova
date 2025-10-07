import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useAppContext } from '@/hooks/useAppContext';
import { useUserRelaysContext } from '@/contexts/UserRelaysContext';

/**
 * Hook for querying events using initial + user relays (for user panel)
 */
export function useUserCombinedQuery(
	filters: any[],
	options?: {
		enabled?: boolean;
		staleTime?: number;
		extraRelays?: string[]; // optional explicit relays to include (e.g., currently open relay)
	}
) {
	const { nostr } = useNostr();
	const { initialRelays } = useAppContext();
	const { userRelays } = useUserRelaysContext();

	return useQuery({
		queryKey: ['user-combined', filters],
		queryFn: async ({ signal }) => {
			// Use initial + user relays (+ any explicit extras like the currently open relay)
			const userRelaysList = userRelays?.map(r => r.url) || [];
			const explicitExtras = options?.extraRelays ?? [];
			const combined = [...new Set([...(initialRelays || []), ...userRelaysList, ...explicitExtras])];

			if (combined.length === 0) {
				const fallbackRelays = initialRelays || [];
				if (fallbackRelays.length === 0) {
					throw new Error('No relays available for querying');
				}
				const relayGroup = nostr.group(fallbackRelays);
				const events = await relayGroup.query(filters, {
					signal: AbortSignal.any([signal, AbortSignal.timeout(10000)])
				});
				return events;
			}

			const relayGroup = nostr.group(combined);
			const events = await relayGroup.query(filters, {
				signal: AbortSignal.any([signal, AbortSignal.timeout(10000)])
			});

			return events;
		},
		enabled: options?.enabled !== false,
		staleTime: options?.staleTime || 60000, // 1 minute
		retry: 2,
	});
}

/**
 * Hook for querying a user's notes using initial + user relays
 */
export function useUserNotes(
	pubkey: string,
	options?: {
		limit?: number;
		enabled?: boolean;
		staleTime?: number;
		extraRelays?: string[];
	}
) {
	const filters = [
		{
			kinds: [1], // Text notes
			authors: [pubkey],
			limit: options?.limit || 50,
		}
	];

	return useUserCombinedQuery(filters, {
		enabled: options?.enabled && !!pubkey,
		staleTime: options?.staleTime,
		extraRelays: options?.extraRelays,
	});
}

/**
 * Hook for querying a user's profile metadata using initial + user relays
 * Returns parsed metadata like useAuthor
 */
export function useUserProfile(
	pubkey: string,
	options?: {
		enabled?: boolean;
		staleTime?: number;
		extraRelays?: string[];
	}
) {
	const filters = [
		{
			kinds: [0], // Profile metadata
			authors: [pubkey],
			limit: 1,
		}
	];

	const query = useUserCombinedQuery(filters, {
		enabled: options?.enabled && !!pubkey,
		staleTime: options?.staleTime || 300000, // 5 minutes
		extraRelays: options?.extraRelays,
	});

	// Transform raw event into parsed metadata format
	const event = query.data?.[0];

	if (!event) {
		return { ...query, data: undefined };
	}

	try {
		const metadata = n.json().pipe(n.metadata()).parse(event.content);
		return { ...query, data: { metadata, event } };
	} catch (err) {
		return { ...query, data: { event } };
	}
}

/**
 * Hook for querying a user's relay list using initial + user relays
 */
export function useUserRelayList(
	pubkey: string,
	options?: {
		enabled?: boolean;
		staleTime?: number;
	}
) {
	const filters = [
		{
			kinds: [10002], // Relay list metadata
			authors: [pubkey],
			limit: 1,
		}
	];

	return useUserCombinedQuery(filters, {
		enabled: options?.enabled && !!pubkey,
		staleTime: options?.staleTime || 300000, // 5 minutes
	});
}

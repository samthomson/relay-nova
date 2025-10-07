import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook for querying events from a specific relay (for relay panel viewer)
 */
export function useRelaySpecificQuery(
	relayUrl: string,
	filters: any[],
	options?: {
		enabled?: boolean;
		staleTime?: number;
	}
) {
	const { nostr } = useNostr();

	return useQuery({
		queryKey: ['relay-specific', relayUrl, filters],
		queryFn: async ({ signal }) => {
			// Query only the specific relay
			const relayGroup = nostr.group([relayUrl]);
			const events = await relayGroup.query(filters, {
				signal: AbortSignal.any([signal, AbortSignal.timeout(5000)])
			});

			return events;
		},
		enabled: options?.enabled !== false && !!relayUrl,
		staleTime: options?.staleTime || 30000, // 30 seconds
		retry: 2,
	});
}

/**
 * Hook for querying notes from a specific relay (most common use case)
 */
export function useRelayNotes(
	relayUrl: string,
	options?: {
		limit?: number;
		enabled?: boolean;
		staleTime?: number;
	}
) {
	const filters = [
		{
			kinds: [1], // Text notes
			limit: options?.limit || 20,
		}
	];

	return useRelaySpecificQuery(relayUrl, filters, {
		enabled: options?.enabled,
		staleTime: options?.staleTime,
	});
}

/**
 * Hook for querying user's notes from a specific relay
 */
export function useUserRelayNotes(
	relayUrl: string,
	pubkey: string,
	options?: {
		limit?: number;
		enabled?: boolean;
		staleTime?: number;
	}
) {
	const filters = [
		{
			kinds: [1], // Text notes
			authors: [pubkey],
			limit: options?.limit || 20,
		}
	];

	return useRelaySpecificQuery(relayUrl, filters, {
		enabled: options?.enabled && !!pubkey,
		staleTime: options?.staleTime,
	});
}

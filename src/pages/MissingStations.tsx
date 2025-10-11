import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface RelayLocation {
	country: string;
	countryCode: string;
}

interface RelayEntry {
	url: string;
	location: RelayLocation;
}

interface StationsData {
	[countryCode: string]: {
		name: string;
		stations: Array<any>;
	};
}

export function MissingStations() {
	const [relayCountries, setRelayCountries] = useState<Map<string, string>>(new Map());
	const [stationCountries, setStationCountries] = useState<Set<string>>(new Set());
	const [missingStations, setMissingStations] = useState<Array<{ code: string; name: string }>>(
		[]
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchData() {
			try {
				// Fetch relays data
				const relaysResponse = await fetch('/relays.json');
				if (!relaysResponse.ok) {
					throw new Error(`Failed to fetch relays: ${relaysResponse.status}`);
				}
				const relaysData: RelayEntry[] = await relaysResponse.json();

				// Fetch stations data
				const stationsResponse = await fetch('/stations.json');
				if (!stationsResponse.ok) {
					throw new Error(`Failed to fetch stations: ${stationsResponse.status}`);
				}
				const stationsData: StationsData = await stationsResponse.json();

				// Process relay country codes
				const relayCountryMap = new Map<string, string>();
				relaysData.forEach((relay) => {
					if (relay.location && relay.location.countryCode) {
						relayCountryMap.set(
							relay.location.countryCode,
							relay.location.country || relay.location.countryCode
						);
					}
				});

				// Process station country codes
				const stationCountryCodes = new Set<string>(Object.keys(stationsData));

				// Find missing stations
				const missing: Array<{ code: string; name: string }> = [];
				relayCountryMap.forEach((countryName, countryCode) => {
					if (!stationCountryCodes.has(countryCode)) {
						missing.push({ code: countryCode, name: countryName });
					}
				});

				// Sort missing stations by country code
				missing.sort((a, b) => a.code.localeCompare(b.code));

				// Update state
				setRelayCountries(relayCountryMap);
				setStationCountries(stationCountryCodes);
				setMissingStations(missing);
				setLoading(false);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Unknown error');
				setLoading(false);
			}
		}

		fetchData();
	}, []);

	if (loading) {
		return (
			<div className="container mx-auto py-8">
				<Card>
					<CardHeader>
						<CardTitle>Loading...</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center space-x-2">
							<div className="w-4 h-4 rounded-full border-2 border-t-blue-500 animate-spin"></div>
							<span>Loading country data...</span>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<div className="container mx-auto py-8">
				<Card className="border-red-300">
					<CardHeader>
						<CardTitle className="text-red-500">Error</CardTitle>
					</CardHeader>
					<CardContent>
						<p>{error}</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-8 space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Missing Radio Stations</CardTitle>
					<CardDescription>
						Countries that have relays but no radio stations in stations.json
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="mb-4">
						<div className="flex justify-between mb-2">
							<span className="text-sm font-medium">Summary</span>
							<Badge variant="outline" className="ml-2">
								{missingStations.length} missing
							</Badge>
						</div>
						<div className="text-sm text-muted-foreground">
							<span>Total relay countries: {relayCountries.size}</span>
							<span className="mx-2">•</span>
							<span>Total station countries: {stationCountries.size}</span>
						</div>
					</div>

					<Separator className="my-4" />

					{missingStations.length > 0 ? (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{missingStations.map((country) => (
								<div
									key={country.code}
									className="flex items-center p-3 border rounded-md hover:bg-muted/50"
								>
									<div className="font-mono text-sm mr-2">{country.code}</div>
									<div className="flex-1">{country.name}</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-8 text-muted-foreground">
							All countries with relays have radio stations available!
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default MissingStations;

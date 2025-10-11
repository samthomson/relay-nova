interface RadioStation {
	name: string;
	url: string;
	tags?: string;
	language?: string;
	bitrate?: number;
}

interface CountryStations {
	name: string;
	stations: RadioStation[];
}

interface StationsData {
	[countryCode: string]: CountryStations;
}

// We'll load stations from stations.json file
let stationsData: StationsData = {};

// Load stations data from JSON file
async function loadStationsData(): Promise<StationsData> {
	try {
		const response = await fetch('/stations.json');
		if (!response.ok) {
			throw new Error(`Failed to load stations data: ${response.status}`);
		}
		return await response.json();
	} catch (error) {
		console.error('Error loading stations data:', error);
		return {};
	}
}

// Singleton audio player for the entire app
class RadioPlayer {
	private static instance: RadioPlayer;
	private audio: HTMLAudioElement | null = null;
	private currentStation: RadioStation | null = null;
	private currentCountryCode: string | null = null;
	private currentStationIndex: number = -1;
	private countryStationCount: number = 0;
	private triedStations: Set<string> = new Set();

	private constructor() {
		if (typeof window !== 'undefined') {
			this.audio = new Audio();
			this.audio.crossOrigin = 'anonymous';

			// Add error handling for audio element
			this.audio.onerror = (error) => {
				console.error('RadioPlayer: Audio error:', error);
			};

			this.audio.onplay = () => {
				console.log('RadioPlayer: Audio started playing');
			};

			this.audio.onpause = () => {
				console.log('RadioPlayer: Audio paused');
			};

			this.audio.onstalled = () => {
				console.error('RadioPlayer: Audio playback stalled');
			};

			console.log('RadioPlayer: Audio element initialized');

			// Load stations data
			loadStationsData().then(data => {
				stationsData = data;
				console.log('RadioPlayer: Stations data loaded');
			});
		} else {
			console.error('RadioPlayer: Window object not available');
		}
	}

	public static getInstance(): RadioPlayer {
		if (!RadioPlayer.instance) {
			RadioPlayer.instance = new RadioPlayer();
		}
		return RadioPlayer.instance;
	}

	public async play(countryCode: string): Promise<void> {
		try {
			// Reset state before starting
			this.triedStations.clear();
			this.retryCount = 0;

			if (!countryCode) {
				console.log('RadioPlayer: No country code provided');
				this.stop();
				return;
			}

			console.log('RadioPlayer: Finding stations for country:', countryCode);

			// If stations data hasn't been loaded yet, load it now
			if (Object.keys(stationsData).length === 0) {
				stationsData = await loadStationsData();
			}

			// Get stations for the country (using uppercase to ensure matching)
			const upperCountryCode = countryCode.toUpperCase();
			const countryStations = stationsData[upperCountryCode];

			// If no stations found for this country, stop playback and return
			if (!countryStations || countryStations.stations.length === 0) {
				console.log('RadioPlayer: No stations found for country:', countryCode);
				this.stop();
				return;
			}

			// Set current country and station count
			this.currentCountryCode = upperCountryCode;
			this.countryStationCount = countryStations.stations.length;

			// Pick a random station from the country
			this.currentStationIndex = Math.floor(Math.random() * countryStations.stations.length);
			const station = countryStations.stations[this.currentStationIndex];
			console.log('RadioPlayer: Selected station:', station.name, 'in', countryStations.name);
			await this.playStation(station);
		} catch (error) {
			console.error('RadioPlayer: Error playing radio:', error);
			this.stop();
		}
	}

	// Keep track of stations we've already tried to avoid infinite loops
	private maxRetries: number = 3;
	private retryCount: number = 0;

	private async playStation(station: RadioStation): Promise<void> {
		if (!this.audio) {
			console.error('RadioPlayer: Audio element not initialized');
			return;
		}

		// Add this station URL to the tried stations set
		this.triedStations.add(station.url);

		try {
			console.log('RadioPlayer: Playing station:', station.name);
			this.currentStation = station;
			this.audio.src = station.url;
			await this.audio.play();
			console.log('RadioPlayer: Playback started successfully');
			// Clear the tried stations set on success
			this.triedStations.clear();
		} catch (error) {
			console.error('RadioPlayer: Failed to play station:', error);
			// Try another station from the same country that we haven't tried yet
			if (this.currentCountryCode && stationsData[this.currentCountryCode] && this.retryCount < this.maxRetries) {
				this.retryCount++;
				console.log(`RadioPlayer: Retry attempt ${this.retryCount} of ${this.maxRetries}`);

				const countryStations = stationsData[this.currentCountryCode].stations;
				// Only consider stations we haven't tried yet
				const untried = countryStations.filter(s => !this.triedStations.has(s.url));

				if (untried.length > 0) {
					const randomIndex = Math.floor(Math.random() * untried.length);
					const fallbackStation = untried[randomIndex];
					this.currentStationIndex = countryStations.findIndex(s => s.url === fallbackStation.url);
					console.log('RadioPlayer: Trying another station:', fallbackStation.name);
					await this.playStation(fallbackStation);
				} else {
					// We've tried all stations and none work
					console.log('RadioPlayer: All stations failed to play');
					this.currentStation = null;
					this.triedStations.clear();
					this.retryCount = 0;
				}
			} else {
				// Max retries reached or no more stations to try
				console.log('RadioPlayer: Max retries reached or no stations available');
				this.currentStation = null;
				this.triedStations.clear();
				this.retryCount = 0;
			}
		}
	}

	public stop(): void {
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.currentStation = null;
			this.currentCountryCode = null;
			this.currentStationIndex = -1;
			this.countryStationCount = 0;
			this.triedStations.clear();
		}
	}

	public getCurrentStation(): RadioStation | null {
		return this.currentStation;
	}

	public getCurrentCountry(): string | null {
		return this.currentCountryCode;
	}

	public getCurrentStationInfo(): { index: number, total: number } {
		return {
			index: this.currentStationIndex + 1, // 1-based for display
			total: this.countryStationCount
		};
	}

	public async nextStation(): Promise<void> {
		if (!this.currentCountryCode || this.countryStationCount === 0) {
			return;
		}

		const countryStations = stationsData[this.currentCountryCode].stations;
		this.currentStationIndex = (this.currentStationIndex + 1) % countryStations.length;
		const station = countryStations[this.currentStationIndex];
		await this.playStation(station);
	}
}

export const radioPlayer = RadioPlayer.getInstance();
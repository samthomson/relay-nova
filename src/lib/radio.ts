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

		// Load raw data
		const rawData: StationsData = await response.json();

		// Filter out HTTP URLs due to Content Security Policy
		const filteredData: StationsData = {};
		let totalStations = 0;
		let filteredStations = 0;

		Object.keys(rawData).forEach(countryCode => {
			const countryData = rawData[countryCode];
			const httpsStations = countryData.stations.filter(station => {
				totalStations++;
				// Only allow HTTPS URLs
				const isHttps = station.url.toLowerCase().startsWith('https://');
				if (!isHttps) {
					filteredStations++;
					console.log(`RadioPlayer: Filtered out HTTP station: ${station.name} (${station.url})`);
				}
				return isHttps;
			});

			// Only add countries that have at least one HTTPS station
			if (httpsStations.length > 0) {
				filteredData[countryCode] = {
					name: countryData.name,
					stations: httpsStations
				};
			}
		});

		console.log(`RadioPlayer: Loaded stations for ${Object.keys(filteredData).length} countries`);
		console.log(`RadioPlayer: Filtered out ${filteredStations} HTTP stations out of ${totalStations} total stations`);

		return filteredData;
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
	private fadeOutInterval: number | null = null;
	private fadeOutDuration: number = 500; // Fade out duration in ms

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
			// Clear any existing fade out to prevent it from stopping new playback
			if (this.fadeOutInterval !== null) {
				clearInterval(this.fadeOutInterval);
				this.fadeOutInterval = null;
			}

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

		// Check for HTTP URL (should already be filtered, but just in case)
		if (!station.url.toLowerCase().startsWith('https://')) {
			console.error('RadioPlayer: Cannot play HTTP station due to Content Security Policy:', station.name, station.url);
			// Handle as a failed station
			await this.handleFailedStation('Content Security Policy violation - HTTP URL not allowed');
			return;
		}

		try {
			console.log('RadioPlayer: Playing station:', station.name);
			this.currentStation = station;
			this.audio.src = station.url;

			// Reset volume to full before playing
			this.audio.volume = 1;

			// Add specific error handler for CSP violations
			const errorHandler = (e: Event) => {
				if (e instanceof ErrorEvent && e.message && e.message.includes('Content Security Policy')) {
					console.error('RadioPlayer: CSP violation detected:', e.message);
				}
			};

			// Listen for CSP errors
			window.addEventListener('error', errorHandler);

			try {
				await this.audio.play();
				console.log('RadioPlayer: Playback started successfully');
				// Clear the tried stations set on success
				this.triedStations.clear();
			} finally {
				// Always remove the error handler
				window.removeEventListener('error', errorHandler);
			}
		} catch (error) {
			console.error('RadioPlayer: Failed to play station:', error);

			// Check if this is a CSP error
			const errorString = String(error);
			if (errorString.includes('Content Security Policy') ||
				errorString.includes('CSP') ||
				errorString.includes('Refused to load')) {
				console.error('RadioPlayer: Content Security Policy violation detected');
			}

			// Try another station
			await this.handleFailedStation(error);
		}
	}

	/**
	 * Handle failed station playback by trying another station
	 */
	private async handleFailedStation(error: unknown): Promise<void> {
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

	public stop(): void {
		if (this.audio) {
			// Clear any existing fade out
			if (this.fadeOutInterval !== null) {
				clearInterval(this.fadeOutInterval);
				this.fadeOutInterval = null;
			}

			// Immediately stop without fade
			this.audio.pause();
			this.audio.src = '';
			this.currentStation = null;
			this.currentCountryCode = null;
			this.currentStationIndex = -1;
			this.countryStationCount = 0;
			this.triedStations.clear();
		}
	}

	/**
	 * Fade out the audio and then stop playback
	 */
	public fadeOutAndStop(): void {
		if (!this.audio || this.audio.paused || this.audio.volume === 0) {
			// If already stopped or no audio, just stop immediately
			this.stop();
			return;
		}

		// Clear any existing fade out
		if (this.fadeOutInterval !== null) {
			clearInterval(this.fadeOutInterval);
			this.fadeOutInterval = null;
		}

		// Set initial volume if not set
		if (this.audio.volume !== 1) {
			this.audio.volume = 1;
		}

		// Calculate fade step
		const steps = 20; // Number of steps for fade
		const stepTime = this.fadeOutDuration / steps; // Time per step
		const volumeStep = this.audio.volume / steps; // Volume change per step

		// Start fading
		let currentStep = 0;
		this.fadeOutInterval = window.setInterval(() => {
			currentStep++;

			if (this.audio) {
				// Reduce volume
				this.audio.volume = Math.max(0, this.audio.volume - volumeStep);

				// Check if fade is complete
				if (currentStep >= steps || this.audio.volume <= 0) {
					// Clear interval and stop completely
					if (this.fadeOutInterval !== null) {
						clearInterval(this.fadeOutInterval);
						this.fadeOutInterval = null;
					}
					this.stop();
				}
			} else {
				// Audio element no longer exists
				if (this.fadeOutInterval !== null) {
					clearInterval(this.fadeOutInterval);
					this.fadeOutInterval = null;
				}
			}
		}, stepTime);
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
			console.log('RadioPlayer: Cannot switch station - no current country or stations');
			return;
		}

		console.log('RadioPlayer: Switching to a different station');

		// Clear any existing fade out
		if (this.fadeOutInterval !== null) {
			clearInterval(this.fadeOutInterval);
			this.fadeOutInterval = null;
		}

		const countryStations = stationsData[this.currentCountryCode].stations;

		// Log current station info
		const currentStationName = this.currentStation?.name || 'unknown';
		const currentUrl = this.currentStation?.url;
		console.log(`RadioPlayer: Current station: ${currentStationName} (index: ${this.currentStationIndex}, url: ${currentUrl?.substring(0, 30)}...)`);
		console.log(`RadioPlayer: Country has ${countryStations.length} stations total`);

		// Get a different station than the current one
		let newStationIndex;

		if (countryStations.length > 1) {
			// Special case for exactly two stations - just pick the other one
			if (countryStations.length === 2) {
				console.log('RadioPlayer: Exactly two stations available - selecting the other one');

				// Find the index of the station that's not currently playing
				if (countryStations[0].url === currentUrl) {
					newStationIndex = 1;
					console.log('RadioPlayer: Current is first station, switching to second');
				} else if (countryStations[1].url === currentUrl) {
					newStationIndex = 0;
					console.log('RadioPlayer: Current is second station, switching to first');
				} else {
					// If somehow neither matches (shouldn't happen), pick the first one
					console.warn('RadioPlayer: Current station URL doesn\'t match either station - defaulting to first');
					newStationIndex = 0;
				}

				// Debug log the URLs to verify
				console.log(`RadioPlayer: Station 0 URL: ${countryStations[0].url.substring(0, 30)}...`);
				console.log(`RadioPlayer: Station 1 URL: ${countryStations[1].url.substring(0, 30)}...`);
			} else {
				// For more than two stations, use the original algorithm
				// Create an array of indices excluding the current station
				const availableIndices: number[] = [];
				for (let i = 0; i < countryStations.length; i++) {
					if (countryStations[i].url !== currentUrl) {
						availableIndices.push(i);
					}
				}

				console.log(`RadioPlayer: Found ${availableIndices.length} alternative stations`);

				if (availableIndices.length > 0) {
					// Pick a random index from the available options
					const randomIndex = Math.floor(Math.random() * availableIndices.length);
					newStationIndex = availableIndices[randomIndex];
				} else {
					// Fallback - should never happen if we have more than one station
					console.warn('RadioPlayer: Could not find a different station despite having multiple stations');
					newStationIndex = (this.currentStationIndex + 1) % countryStations.length;
				}
			}
		} else {
			// If there's only one station, we have no choice but to use it again
			newStationIndex = 0;
			console.log('RadioPlayer: Only one station available, reusing it');
		}

		this.currentStationIndex = newStationIndex;
		const station = countryStations[this.currentStationIndex];
		console.log(`RadioPlayer: Selected new station: ${station.name} (${this.currentStationIndex + 1}/${countryStations.length})`);

		// Stop current playback before starting new station
		if (this.audio) {
			this.audio.pause();
			// Reset volume to full
			this.audio.volume = 1;
		}

		// Reset tried stations
		this.triedStations.clear();
		this.retryCount = 0;

		// Play the new station
		await this.playStation(station);
	}
}

export const radioPlayer = RadioPlayer.getInstance();
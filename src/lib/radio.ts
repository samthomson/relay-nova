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

		try {
			console.log('RadioPlayer: Playing station:', station.name);
			this.currentStation = station;
			this.audio.src = station.url;

			// Reset volume to full before playing
			this.audio.volume = 1;

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

		console.log('RadioPlayer: Switching to a random station');

		// Clear any existing fade out
		if (this.fadeOutInterval !== null) {
			clearInterval(this.fadeOutInterval);
			this.fadeOutInterval = null;
		}

		const countryStations = stationsData[this.currentCountryCode].stations;

		// Get a random station different from the current one
		let newStationIndex;
		if (countryStations.length > 1) {
			// If we have more than one station, make sure we pick a different one
			do {
				newStationIndex = Math.floor(Math.random() * countryStations.length);
			} while (newStationIndex === this.currentStationIndex && countryStations.length > 1);
		} else {
			// If there's only one station, we have no choice but to use it again
			newStationIndex = 0;
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
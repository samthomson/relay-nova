interface RadioStation {
	name: string;
	url: string;
	country: string;
	countryCode: string;
}

// Curated list of reliable radio stations
const RADIO_STATIONS: RadioStation[] = [
	{
		name: "BBC World Service",
		url: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
		country: "United Kingdom",
		countryCode: "GB"
	},
	{
		name: "NPR News",
		url: "https://npr-ice.streamguys1.com/live.mp3",
		country: "United States",
		countryCode: "US"
	},
	{
		name: "ABC Radio National",
		url: "https://live-radio01.mediahubaustralia.com/2RNW/mp3/",
		country: "Australia",
		countryCode: "AU"
	},
	{
		name: "CBC Radio One",
		url: "https://cbcliveradio-lh.akamaihd.net/i/CBCR1_TOR@118420/master.m3u8",
		country: "Canada",
		countryCode: "CA"
	},
	{
		name: "Deutsche Welle",
		url: "https://dw.audiostream.io/dw/1013/mp3/64/dw-radio-english",
		country: "Germany",
		countryCode: "DE"
	},
	{
		name: "RFI English",
		url: "https://live02.rfi.fr/rfien-64.mp3",
		country: "France",
		countryCode: "FR"
	},
	{
		name: "NHK World Radio Japan",
		url: "https://nhkworld.webcdn.stream.ne.jp/www11/radiojapan/all/263943/live_s.m3u8",
		country: "Japan",
		countryCode: "JP"
	}
];

// Singleton audio player for the entire app
class RadioPlayer {
	private static instance: RadioPlayer;
	private audio: HTMLAudioElement | null = null;
	private currentStation: RadioStation | null = null;

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
			// Find stations for the given country code
			const stations = RADIO_STATIONS.filter(
				station => station.countryCode.toUpperCase() === countryCode.toUpperCase()
			);

			if (stations.length === 0) {
				// If no station found for country, use BBC World Service as fallback
				console.log('RadioPlayer: No station found for country, using BBC World Service');
				const fallbackStation = RADIO_STATIONS[0];
				await this.playStation(fallbackStation);
				return;
			}

			// Pick a random station from the country
			const randomIndex = Math.floor(Math.random() * stations.length);
			const station = stations[randomIndex];
			await this.playStation(station);
		} catch (error) {
			console.error('RadioPlayer: Error playing radio:', error);
		}
	}

	private async playStation(station: RadioStation): Promise<void> {
		if (!this.audio) {
			console.error('RadioPlayer: Audio element not initialized');
			return;
		}

		try {
			console.log('RadioPlayer: Playing station:', station.name);
			this.currentStation = station;
			this.audio.src = station.url;
			await this.audio.play();
			console.log('RadioPlayer: Playback started successfully');
		} catch (error) {
			console.error('RadioPlayer: Failed to play station:', error);
			// If station fails, try BBC World Service as fallback
			if (station !== RADIO_STATIONS[0]) {
				console.log('RadioPlayer: Trying fallback station');
				await this.playStation(RADIO_STATIONS[0]);
			}
		}
	}

	public stop(): void {
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.currentStation = null;
		}
	}

	public getCurrentStation(): RadioStation | null {
		return this.currentStation;
	}
}

export const radioPlayer = RadioPlayer.getInstance();
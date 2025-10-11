import { useEffect, useState } from 'react';
import { Radio, Shuffle, Loader2, AlertCircle, Wifi } from 'lucide-react';
import { useRadioModeContext } from '@/contexts/RadioModeContext';
import { radioPlayer } from '@/lib/radio';

interface RadioStatusPanelProps {
	side: 'left' | 'right' | 'bottom';
	relay?: {
		url?: string;
		country?: string;
		countryCode?: string;
	};
}

export function RadioStatusPanel({ side, relay }: RadioStatusPanelProps) {
	const { isRadioMode } = useRadioModeContext();
	const [stationInfo, setStationInfo] = useState<{ index: number, total: number }>({ index: 0, total: 0 });
	const [playbackState, setPlaybackState] = useState<'loading' | 'playing' | 'buffering' | 'stalled' | 'error' | 'idle'>('idle');
	const [isInitializing, setIsInitializing] = useState(false);

	// Update station info when the current station changes
	useEffect(() => {
		const updateStationInfo = () => {
			if (isRadioMode && radioPlayer.getCurrentStation()) {
				setStationInfo(radioPlayer.getCurrentStationInfo());
			} else {
				setStationInfo({ index: 0, total: 0 });
			}
		};

		// Update initially
		updateStationInfo();

		// Set up an interval to check for station changes
		// Use a longer interval to reduce unnecessary checks
		const interval = setInterval(updateStationInfo, 3000);
		return () => clearInterval(interval);
	}, [isRadioMode]);

	// Monitor audio element events to track playback state
	useEffect(() => {
		// Only set up listeners if radio mode is on
		if (!isRadioMode) {
			setPlaybackState('idle');
			return;
		}

		const handlePlaying = () => {
			console.log('RadioStatusPanel: Audio is playing');
			setPlaybackState('playing');
			setIsInitializing(false);
		};

		const handleWaiting = () => {
			console.log('RadioStatusPanel: Audio is buffering');
			setPlaybackState('buffering');
		};

		const handleStalled = () => {
			console.log('RadioStatusPanel: Audio playback stalled');
			setPlaybackState('stalled');
		};

		const handleError = () => {
			console.log('RadioStatusPanel: Audio error occurred');
			setPlaybackState('error');
		};

		// Register event listeners with the audio element
		const audioElement = radioPlayer.getAudioElement();
		if (audioElement) {
			audioElement.addEventListener('playing', handlePlaying);
			audioElement.addEventListener('waiting', handleWaiting);
			audioElement.addEventListener('stalled', handleStalled);
			audioElement.addEventListener('error', handleError);

			// Check current state
			if (!audioElement.paused) {
				setPlaybackState('playing');
			}

			// Clean up listeners
			return () => {
				audioElement.removeEventListener('playing', handlePlaying);
				audioElement.removeEventListener('waiting', handleWaiting);
				audioElement.removeEventListener('stalled', handleStalled);
				audioElement.removeEventListener('error', handleError);
			};
		}
	}, [isRadioMode]);

	// Switch to the relay's country when it changes or radio mode changes
	useEffect(() => {
		console.log('Radio status changed:', { isRadioMode, relay: relay?.url, countryCode: relay?.countryCode });

		// Only play radio if radio mode is on AND a relay panel is open (relay exists) AND it has a country code
		if (isRadioMode && relay && relay.countryCode) {
			console.log('Switching to country:', relay.countryCode);
			// Set loading state while initializing
			setPlaybackState('loading');
			setIsInitializing(true);

			radioPlayer.play(relay.countryCode).catch(error => {
				console.error('Failed to play radio for country:', relay.countryCode, error);
				setPlaybackState('error');
				setIsInitializing(false);
			});
		} else {
			// Stop radio if radio mode is off or no relay selected
			radioPlayer.fadeOutAndStop();
			setPlaybackState('idle');
			setIsInitializing(false);

			if (isRadioMode) {
				if (!relay) {
					console.log('Radio mode is on but no relay panel is open');
				} else if (!relay.countryCode) {
					console.log('Radio mode is on but relay has no country code');
				}
			}
		}
	}, [isRadioMode, relay, relay?.countryCode]);

	// Panel classes function - matches the relay panel styling
	const getPanelClasses = () => {
		const baseClasses = 'absolute bg-black/95 backdrop-blur-sm border border-white/20 text-white transition-all duration-300 z-[99998] pointer-events-auto flex flex-col overflow-hidden';

		if (side === 'bottom') {
			return `${baseClasses} bottom-8 left-4 right-4 h-[120px] rounded-2xl border-2`;
		} else {
			// Position the radio panel at a fixed position below the relay panel
			// Relay panel starts at top-24 (6rem) and has height of 70vh
			// Position radio panel at top-24 + 70vh + some margin
			return `${baseClasses} top-[calc(6rem+70vh+2rem)] w-[380px] max-w-[35vw] h-[120px] rounded-2xl border-2 ${side === 'right' ? 'right-4' : 'left-4'}`;
		}
	};

	const currentStation = radioPlayer.getCurrentStation();

	// Helper function to render status icon based on playback state
	const renderStatusIcon = () => {
		if (!isRadioMode) {
			return <Radio className="w-5 h-5 text-gray-400" />;
		}

		switch (playbackState) {
			case 'loading':
				return <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />;
			case 'buffering':
				return <Wifi className="w-5 h-5 text-orange-300 animate-pulse" />;
			case 'stalled':
				return <AlertCircle className="w-5 h-5 text-orange-500 animate-pulse" />;
			case 'error':
				return <AlertCircle className="w-5 h-5 text-red-500" />;
			case 'playing':
				return <Radio className="w-5 h-5 text-green-400" />;
			default:
				return <Radio className="w-5 h-5 text-orange-400 animate-pulse" />;
		}
	};

	// Helper function to render status text based on playback state
	const renderStatusText = () => {
		if (!isRadioMode) {
			return 'Radio is turned off';
		}

		if (!relay) {
			return <span className="text-gray-400">Open a relay to play radio</span>;
		}

		if (!relay.countryCode) {
			return <span className="text-gray-400">Relay has no country code</span>;
		}

		if (currentStation) {
			return (
				<>
					<div className="flex items-center gap-2">
						<span>{currentStation.name}</span>
						{playbackState === 'buffering' && (
							<span className="text-xs text-orange-300 animate-pulse">(buffering...)</span>
						)}
						{playbackState === 'stalled' && (
							<span className="text-xs text-orange-500">(stalled)</span>
						)}
						{playbackState === 'error' && (
							<span className="text-xs text-red-500">(error)</span>
						)}
					</div>
					{stationInfo.total > 0 && (
						<span className="text-sm text-gray-400 block">
							Station {stationInfo.index} of {stationInfo.total}
						</span>
					)}
				</>
			);
		}

		if (isInitializing || playbackState === 'loading') {
			return <span className="text-orange-300 animate-pulse">Finding a station...</span>;
		}

		if (playbackState === 'error') {
			return <span className="text-red-500">Failed to play station</span>;
		}

		return <span className="text-orange-300">Trying to find a station...</span>;
	};

	return (
		<div className={getPanelClasses()}>
			{/* Minimal Radio Status - just icon and text */}
			<div className="flex-1 p-4 flex items-center justify-center">
				<div className="flex items-center justify-between w-full">
					<div className="flex items-center gap-3">
						{renderStatusIcon()}
						<div className="text-lg font-semibold text-white">
							{renderStatusText()}
						</div>
					</div>
					{isRadioMode && currentStation && (
						<button
							className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90 active:bg-white/30"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();

								// Add visual feedback
								const button = e.currentTarget;
								button.classList.add('text-orange-400');

								// Set loading state
								setPlaybackState('loading');

								// Special message for two-station countries
								if (stationInfo.total === 2) {
									console.log('Switching between two stations');
								} else {
									console.log('Shuffle button clicked - switching to different station');
								}

								radioPlayer.nextStation()
									.then(() => {
										// Remove highlight after successful station change
										setTimeout(() => {
											button.classList.remove('text-orange-400');
										}, 500);
									})
									.catch(err => {
										console.error('Failed to switch station:', err);
										button.classList.remove('text-orange-400');
										setPlaybackState('error');
									});
							}}
							title={stationInfo.total === 2 ? "Switch to other station" : "Different station"}
							disabled={playbackState === 'loading'}
						>
							<Shuffle className={`w-4 h-4 ${playbackState === 'loading' ? 'text-gray-500' : 'text-gray-300'}`} />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

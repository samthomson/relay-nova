import { useEffect, useState } from 'react';
import { Radio, Shuffle } from 'lucide-react';
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

	// Switch to the relay's country when it changes or radio mode changes
	useEffect(() => {
		console.log('Radio status changed:', { isRadioMode, relay: relay?.url, countryCode: relay?.countryCode });

		// Only play radio if radio mode is on AND a relay panel is open (relay exists) AND it has a country code
		if (isRadioMode && relay && relay.countryCode) {
			console.log('Switching to country:', relay.countryCode);
			radioPlayer.play(relay.countryCode).catch(error => {
				console.error('Failed to play radio for country:', relay.countryCode, error);
			});
		} else {
			// Stop radio if radio mode is off or no relay selected
			radioPlayer.stop();
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

	return (
		<div className={getPanelClasses()}>
			{/* Minimal Radio Status - just icon and text */}
			<div className="flex-1 p-4 flex items-center justify-center">
				<div className="flex items-center justify-between w-full">
					<div className="flex items-center gap-3">
						<Radio className={`w-5 h-5 ${isRadioMode ? 'text-orange-400 animate-pulse' : 'text-gray-400'}`} />
						<div className="text-lg font-semibold text-white">
							{isRadioMode ? (
								<>
									{!relay ? (
										<span className="text-gray-400">
											Open a relay to play radio
										</span>
									) : currentStation ? (
										<>
											{currentStation.name}
											{stationInfo.total > 0 && (
												<span className="text-sm text-gray-400 ml-2">
													{stationInfo.index}/{stationInfo.total}
												</span>
											)}
										</>
									) : relay?.countryCode ? (
										<span className="text-orange-300">
											No stations available
										</span>
									) : (
										<span className="text-gray-400">
											Relay has no country code
										</span>
									)}
								</>
							) : (
								'Radio is turned off'
							)}
						</div>
					</div>
					{isRadioMode && stationInfo.total > 1 && (
						<button
							className="p-2 hover:bg-white/10 rounded-full transition-colors"
							onClick={() => radioPlayer.nextStation()}
							title="Next station"
						>
							<Shuffle className="w-4 h-4 text-gray-300" />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

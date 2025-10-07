import { useEffect } from 'react';
import { Radio } from 'lucide-react';
import { useRadioModeContext } from '@/contexts/RadioModeContext';
import { radioPlayer } from '@/lib/radio';

interface RadioStatusPanelProps {
	side: 'left' | 'right' | 'bottom';
	relay?: {
		country?: string;
		countryCode?: string;
	};
}

export function RadioStatusPanel({ side, relay }: RadioStatusPanelProps) {
	const { isRadioMode } = useRadioModeContext();

	// Switch to the relay's country when it changes
	useEffect(() => {
		console.log('Radio status changed:', { isRadioMode, countryCode: relay?.countryCode });
		if (isRadioMode) {
			if (relay?.countryCode) {
				console.log('Switching to country:', relay.countryCode);
				radioPlayer.play(relay.countryCode).catch(error => {
					console.error('Failed to play radio for country:', relay.countryCode, error);
				});
			} else {
				// Default to BBC World Service if no country selected
				console.log('No country selected, using default station');
				radioPlayer.play('GB').catch(console.error);
			}
		} else {
			radioPlayer.stop();
		}
	}, [isRadioMode, relay?.countryCode]);

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
				<div className="flex items-center gap-3">
					<Radio className={`w-5 h-5 ${isRadioMode ? 'text-orange-400 animate-pulse' : 'text-gray-400'}`} />
					<div className="text-lg font-semibold text-white">
						{isRadioMode ? (
							<>
								{currentStation?.name || relay?.countryCode || 'Unknown'}
								{currentStation && <span className="text-sm text-gray-400 ml-2">📻</span>}
							</>
						) : (
							'Radio is turned off'
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

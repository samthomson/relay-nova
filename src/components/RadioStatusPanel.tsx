import React from 'react';
import { Radio } from 'lucide-react';
import { useRadioModeContext } from '@/contexts/RadioModeContext';

interface RadioStatusPanelProps {
	side: 'left' | 'right' | 'bottom';
	relay?: {
		country?: string;
		countryCode?: string;
	};
}

export function RadioStatusPanel({ side, relay }: RadioStatusPanelProps) {
	const { isRadioMode } = useRadioModeContext();

	// Always render the panel, but show different content based on radio mode

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

	return (
		<div className={getPanelClasses()}>
			{/* Minimal Radio Status - just icon and text */}
			<div className="flex-1 p-4 flex items-center justify-center">
				<div className="flex items-center gap-3">
					<Radio className={`w-5 h-5 ${isRadioMode ? 'text-orange-400 animate-pulse' : 'text-gray-400'}`} />
					<div className="text-lg font-semibold text-white">
						{isRadioMode ? (relay?.countryCode || 'Unknown') : 'Radio is turned off'}
					</div>
				</div>
			</div>
		</div>
	);
}

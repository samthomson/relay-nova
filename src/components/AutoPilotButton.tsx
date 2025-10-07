import React, { useState } from 'react';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
import { Plane, Radio } from 'lucide-react';

export function AutoPilotButton() {
  const { isAutoPilotMode, toggleAutoPilot } = useAutoPilotContext();
  const [isRadioMode, setIsRadioMode] = useState(false);

  const toggleRadio = () => {
    setIsRadioMode(!isRadioMode);
    // TODO: Implement radio mode functionality
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex shadow-2xl">
      {/* Auto Pilot Button - Left */}
      <button
        onClick={toggleAutoPilot}
        className={`
          relative overflow-hidden
          px-6 py-4
          rounded-l-2xl
          backdrop-blur-md
          transition-all duration-300 
          font-semibold text-sm
          border-y border-l border-white/10
          group
          ${isAutoPilotMode
            ? 'bg-gradient-to-br from-purple-500/90 to-orange-500/90 hover:from-purple-600/90 hover:to-orange-600/90'
            : 'bg-black/40 hover:bg-black/60'
          }
        `}
      >
        {/* Hover gradient for inactive state */}
        {!isAutoPilotMode && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}

        <div className="relative flex items-center gap-3">
          <Plane className={`w-4 h-4 transition-transform duration-300 ${isAutoPilotMode ? 'rotate-45' : ''}`} />
          <div className="flex flex-col items-start">
            <span className="text-white whitespace-nowrap">
              Auto Pilot: <span className={isAutoPilotMode ? 'text-white font-bold' : 'text-white/60'}>{isAutoPilotMode ? 'On' : 'Off'}</span>
            </span>
          </div>
        </div>
      </button>

      {/* Radio Button - Right */}
      <button
        onClick={toggleRadio}
        className={`
          relative overflow-hidden
          px-6 py-4
          rounded-r-2xl
          backdrop-blur-md
          transition-all duration-300 
          font-semibold text-sm
          border-y border-r border-l-0 border-white/10
          group
          ${isRadioMode
            ? 'bg-gradient-to-br from-blue-500/90 to-cyan-500/90 hover:from-blue-600/90 hover:to-cyan-600/90'
            : 'bg-black/40 hover:bg-black/60'
          }
        `}
      >
        {/* Hover gradient for inactive state */}
        {!isRadioMode && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}

        <div className="relative flex items-center gap-3">
          <Radio className={`w-4 h-4 ${isRadioMode ? 'animate-pulse' : ''}`} />
          <div className="flex flex-col items-start">
            <span className="text-white whitespace-nowrap">
              Radio: <span className={isRadioMode ? 'text-white font-bold' : 'text-white/60'}>{isRadioMode ? 'On' : 'Off'}</span>
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
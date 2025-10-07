import React from 'react';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
import { useRadioModeContext } from '@/contexts/RadioModeContext';
import { Plane, Radio } from 'lucide-react';

export function AutoPilotButton() {
  const { isAutoPilotMode, toggleAutoPilot } = useAutoPilotContext();
  const { isRadioMode, toggleRadioMode } = useRadioModeContext();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex shadow-2xl" data-autopilot-button>
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
          border-2
          group
          ${isAutoPilotMode
            ? 'bg-gradient-to-br from-purple-400/60 to-orange-400/60 hover:from-purple-500/70 hover:to-orange-500/70 border-purple-300/40 scale-105'
            : 'bg-gradient-to-br from-purple-400/20 to-orange-400/20 hover:from-purple-400/30 hover:to-orange-400/30 border-purple-400/20 hover:border-purple-300/30'
          }
        `}
      >
        <div className="relative flex items-center gap-3">
          <Plane className={`w-5 h-5 transition-all duration-300 ${isAutoPilotMode ? 'rotate-45 text-white' : 'text-purple-300'}`} />
          <div className="flex flex-col items-start">
            <span className={`whitespace-nowrap transition-colors ${isAutoPilotMode ? 'text-white' : 'text-purple-200'}`}>
              Auto Pilot: <span className={`font-bold ${isAutoPilotMode ? 'text-white' : 'text-purple-300'}`}>{isAutoPilotMode ? 'On' : 'Off'}</span>
            </span>
          </div>
        </div>
      </button>

      {/* Radio Button - Right */}
      <button
        onClick={toggleRadioMode}
        className={`
          relative overflow-hidden
          px-6 py-4
          rounded-r-2xl
          backdrop-blur-md
          transition-all duration-300 
          font-semibold text-sm
          border-2 border-l-0
          group
          ${isRadioMode
            ? 'bg-gradient-to-br from-orange-400/60 to-purple-400/60 hover:from-orange-500/70 hover:to-purple-500/70 border-orange-300/40 scale-105'
            : 'bg-gradient-to-br from-orange-400/20 to-purple-400/20 hover:from-orange-400/30 hover:to-purple-400/30 border-orange-400/20 hover:border-orange-300/30'
          }
        `}
      >
        <div className="relative flex items-center gap-3">
          <Radio className={`w-5 h-5 transition-all duration-300 ${isRadioMode ? 'animate-pulse text-white' : 'text-orange-300'}`} />
          <div className="flex flex-col items-start">
            <span className={`whitespace-nowrap transition-colors ${isRadioMode ? 'text-white' : 'text-orange-200'}`}>
              Radio: <span className={`font-bold ${isRadioMode ? 'text-white' : 'text-orange-300'}`}>{isRadioMode ? 'On' : 'Off'}</span>
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
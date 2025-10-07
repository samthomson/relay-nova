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
          border-2
          group
          ${isAutoPilotMode
            ? 'bg-gradient-to-br from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 border-purple-400/50 scale-105'
            : 'bg-gradient-to-br from-purple-500/20 to-orange-500/20 hover:from-purple-500/30 hover:to-orange-500/30 border-purple-500/30 hover:border-purple-400/50'
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
        onClick={toggleRadio}
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
            ? 'bg-gradient-to-br from-orange-500 to-purple-500 hover:from-orange-600 hover:to-purple-600 border-orange-400/50 scale-105'
            : 'bg-gradient-to-br from-orange-500/20 to-purple-500/20 hover:from-orange-500/30 hover:to-purple-500/30 border-orange-500/30 hover:border-orange-400/50'
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
import React from 'react';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
import { Plane, Square } from 'lucide-react';

export function AutoPilotButton() {
  const {
    isAutoPilotMode,
    isAutoPilotActive,
    toggleAutoPilot,
    currentRelayIndex,
    totalRelays
  } = useAutoPilotContext();

  return (
    <button
      onClick={toggleAutoPilot}
      className={`
        fixed bottom-6 right-6 z-50 
        px-6 py-3 rounded-xl
        backdrop-blur-sm border-2
        transition-all duration-300 
        font-semibold text-sm
        shadow-lg hover:shadow-xl
        flex flex-col items-center gap-2
        ${isAutoPilotMode
          ? 'bg-red-500/20 border-red-500/60 text-red-400 hover:bg-red-500/30 hover:border-red-500'
          : 'bg-blue-500/20 border-blue-500/60 text-blue-400 hover:bg-blue-500/30 hover:border-blue-500'
        }
      `}
    >
      {/* Icon and main label */}
      <div className="flex items-center gap-2">
        {isAutoPilotMode ? (
          <Square className="w-4 h-4 fill-current" />
        ) : (
          <Plane className="w-4 h-4" />
        )}
        <span className="uppercase tracking-wide">
          {isAutoPilotMode ? 'Stop' : 'Auto Pilot'}
        </span>
      </div>

      {/* Status indicator */}
      {isAutoPilotMode && (
        <div className="text-xs opacity-80">
          {isAutoPilotActive ? `${currentRelayIndex + 1}/${totalRelays}` : 'Starting...'}
        </div>
      )}
    </button>
  );
}
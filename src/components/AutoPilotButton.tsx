import React from 'react';
import { Button } from '@/components/ui/button';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
import { Plane, Play, Pause, Loader2 } from 'lucide-react';

export function AutoPilotButton() {
  const {
    isAutoPilotMode,
    isAutoPilotActive,
    toggleAutoPilot,
    currentRelayIndex,
    totalRelays
  } = useAutoPilotContext();

  const getButtonClasses = () => {
    const baseClasses = 'fixed bottom-6 right-6 z-50 rounded-lg shadow-lg transition-all duration-300 border-2 flex items-center justify-center font-semibold';

    if (isAutoPilotMode) {
      return `${baseClasses} bg-red-600 hover:bg-red-700 text-white border-red-500 hover:scale-105 px-6 py-3`;
    } else {
      return `${baseClasses} bg-blue-600 hover:bg-blue-700 text-white border-blue-500 hover:scale-105 px-6 py-3`;
    }
  };

  const getButtonText = () => {
    if (isAutoPilotMode) {
      return 'AUTO PILOT ON';
    } else {
      return 'AUTO PILOT OFF';
    }
  };

  const getStatusText = () => {
    if (isAutoPilotActive) {
      return `Active (${currentRelayIndex + 1}/${totalRelays})`;
    } else if (isAutoPilotMode) {
      return 'Starting...';
    } else {
      return 'Ready';
    }
  };

  return (
    <div className="relative group">
      <Button
        onClick={toggleAutoPilot}
        className={getButtonClasses()}
        size="lg"
      >
        <div className="flex items-center gap-2">
          {isAutoPilotMode && isAutoPilotActive ? (
            <Pause className="w-4 h-4" />
          ) : isAutoPilotMode ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plane className="w-4 h-4" />
          )}
          <span>{getButtonText()}</span>
        </div>
      </Button>

      {/* Status indicator */}
      <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="bg-black/90 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap border border-white/20 shadow-lg">
          <div className="font-semibold">{getButtonText()}</div>
          <div className="text-xs text-gray-300 mt-1">{getStatusText()}</div>
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
        </div>
      </div>
    </div>
  );
}
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

  const handleAutoPilotClick = () => {
    console.log('🚫 AutoPilot temporarily disabled due to circular dependency issue');
    // toggleAutoPilot(); // Temporarily disabled
  };

  const getButtonClasses = () => {
    return 'fixed bottom-6 right-6 z-50 rounded-lg shadow-lg transition-all duration-300 border-2 flex items-center justify-center font-semibold bg-gray-600 text-white border-gray-500 px-6 py-3 cursor-not-allowed opacity-60';
  };

  const getButtonText = () => {
    return 'AUTO PILOT (DISABLED)';
  };

  const getStatusText = () => {
    return 'Temporarily disabled';
  };

  return (
    <div className="relative group">
      <Button
        onClick={handleAutoPilotClick}
        className={getButtonClasses()}
        size="lg"
        disabled={true}
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
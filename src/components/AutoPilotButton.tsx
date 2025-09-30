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
    const baseClasses = 'fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-all duration-300 border-2';
    
    if (isAutoPilotMode) {
      return `${baseClasses} bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/50 hover:scale-110`;
    } else {
      return `${baseClasses} bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/50 hover:scale-110`;
    }
  };

  const getIcon = () => {
    if (isAutoPilotActive) {
      return <Pause className="w-6 h-6" />;
    } else if (isAutoPilotMode) {
      return <Loader2 className="w-6 h-6 animate-spin" />;
    } else {
      return <Plane className="w-6 h-6" />;
    }
  };

  const getTooltipText = () => {
    if (isAutoPilotActive) {
      return `Auto Pilot Active (${currentRelayIndex + 1}/${totalRelays})`;
    } else if (isAutoPilotMode) {
      return 'Starting Auto Pilot...';
    } else {
      return 'Start Auto Pilot';
    }
  };

  return (
    <div className="relative group">
      <Button
        onClick={toggleAutoPilot}
        className={getButtonClasses()}
        size="sm"
      >
        {getIcon()}
      </Button>
      
      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="bg-black/90 backdrop-blur-sm text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap border border-white/20 shadow-lg">
          {getTooltipText()}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
        </div>
      </div>
    </div>
  );
}
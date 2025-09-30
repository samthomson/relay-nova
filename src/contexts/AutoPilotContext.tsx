import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface AutoPilotContextType {
  isAutoPilotMode: boolean;
  startAutoPilot: () => void;
  stopAutoPilot: () => void;
  toggleAutoPilot: () => void;
  isAutoPilotActive: boolean;
  currentRelayIndex: number;
  totalRelays: number;
  moveToNextRelay: () => void;
}

const AutoPilotContext = createContext<AutoPilotContextType | undefined>(undefined);

export function AutoPilotProvider({ children }: { children: React.ReactNode }) {
  const [isAutoPilotMode, setIsAutoPilotMode] = useState(false);
  const [isAutoPilotActive, setIsAutoPilotActive] = useState(false);
  const [currentRelayIndex, setCurrentRelayIndex] = useState(0);
  const [totalRelays, setTotalRelays] = useState(0);

  const autoPilotTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopAutoPilot = useCallback(() => {
    setIsAutoPilotMode(false);
    setIsAutoPilotActive(false);
    setCurrentRelayIndex(0);

    // Clear any pending timeout
    if (autoPilotTimeoutRef.current) {
      clearTimeout(autoPilotTimeoutRef.current);
      autoPilotTimeoutRef.current = null;
    }
  }, []);

  const startAutoPilot = useCallback(() => {
    setIsAutoPilotMode(true);
    setIsAutoPilotActive(true);
    setCurrentRelayIndex(0);
  }, []);

  const moveToNextRelay = useCallback(() => {
    console.log('⏭️ Manual skip to next relay requested');
    // This will be handled by the useAutoPilot hook
    // The hook will detect that we need to move to next relay
  }, []);

  const toggleAutoPilot = useCallback(() => {
    if (isAutoPilotMode) {
      stopAutoPilot();
    } else {
      startAutoPilot();
    }
  }, [isAutoPilotMode, startAutoPilot, stopAutoPilot]);

  const value: AutoPilotContextType = {
    isAutoPilotMode,
    startAutoPilot,
    stopAutoPilot,
    toggleAutoPilot,
    isAutoPilotActive,
    currentRelayIndex,
    totalRelays,
    moveToNextRelay,
  };

  return (
    <AutoPilotContext.Provider value={value}>
      {children}
    </AutoPilotContext.Provider>
  );
}

export function useAutoPilotContext() {
  const context = useContext(AutoPilotContext);
  if (context === undefined) {
    throw new Error('useAutoPilotContext must be used within an AutoPilotProvider');
  }
  return context;
}
import React, { createContext, useContext, useState, useCallback } from 'react';

interface AutoPilotContextType {
  isAutoPilotMode: boolean;
  startAutoPilot: () => void;
  stopAutoPilot: () => void;
  toggleAutoPilot: () => void;
  isAutoPilotActive: boolean;
  currentRelayIndex: number;
  totalRelays: number;
  setCurrentRelayIndex: (index: number) => void;
  setTotalRelays: (count: number) => void;
  relayDisplayProgress: number; // 0-100 percentage
  setRelayDisplayProgress: (progress: number) => void;
}

const AutoPilotContext = createContext<AutoPilotContextType | undefined>(undefined);

export function AutoPilotProvider({ children }: { children: React.ReactNode }) {
  const [isAutoPilotMode, setIsAutoPilotMode] = useState(false);
  const [isAutoPilotActive, setIsAutoPilotActive] = useState(false);
  const [currentRelayIndex, setCurrentRelayIndex] = useState(0);
  const [totalRelays, setTotalRelays] = useState(0);
  const [relayDisplayProgress, setRelayDisplayProgress] = useState(0);

  const stopAutoPilot = useCallback(() => {
    console.log('🛑 Stopping autopilot mode');
    setIsAutoPilotMode(false);
    setIsAutoPilotActive(false);
    setCurrentRelayIndex(0);
    setTotalRelays(0);
    setRelayDisplayProgress(0);
  }, []);

  const startAutoPilot = useCallback(() => {
    console.log('🚀 Starting autopilot mode');
    setIsAutoPilotMode(true);
    setIsAutoPilotActive(true);
    setCurrentRelayIndex(0);
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
    setCurrentRelayIndex,
    setTotalRelays,
    relayDisplayProgress,
    setRelayDisplayProgress,
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
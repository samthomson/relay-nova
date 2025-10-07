import React, { createContext, useContext, useState, useCallback } from 'react';

interface RadioModeContextType {
  isRadioMode: boolean;
  toggleRadioMode: () => void;
  setRadioMode: (enabled: boolean) => void;
}

const RadioModeContext = createContext<RadioModeContextType | undefined>(undefined);

export function RadioModeProvider({ children }: { children: React.ReactNode }) {
  const [isRadioMode, setIsRadioMode] = useState(false);

  const toggleRadioMode = useCallback(() => {
    setIsRadioMode(prev => !prev);
  }, []);

  const setRadioMode = useCallback((enabled: boolean) => {
    setIsRadioMode(enabled);
  }, []);

  const value: RadioModeContextType = {
    isRadioMode,
    toggleRadioMode,
    setRadioMode,
  };

  return (
    <RadioModeContext.Provider value={value}>
      {children}
    </RadioModeContext.Provider>
  );
}

export function useRadioModeContext() {
  const context = useContext(RadioModeContext);
  if (context === undefined) {
    throw new Error('useRadioModeContext must be used within a RadioModeProvider');
  }
  return context;
}

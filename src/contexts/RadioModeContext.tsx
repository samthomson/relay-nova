import { createContext, useContext, useEffect, useState } from 'react';
import { radioPlayer } from '@/lib/radio';

interface RadioModeContextType {
  isRadioMode: boolean;
  toggleRadioMode: () => void;
  setRadioMode: (enabled: boolean) => void;
}

const RadioModeContext = createContext<RadioModeContextType | undefined>(undefined);

export function RadioModeProvider({ children }: { children: React.ReactNode }) {
  const [isRadioMode, setIsRadioMode] = useState(false);

  // Handle radio playback when mode changes
  useEffect(() => {
    console.log('Radio mode changed:', { isRadioMode });
    if (isRadioMode) {
      // Start with US stations by default
      console.log('Starting radio playback...');
      radioPlayer.play('US').catch(error => {
        console.error('Failed to play radio:', error);
      });
    } else {
      console.log('Stopping radio playback...');
      radioPlayer.stop();
    }
  }, [isRadioMode]);

  const toggleRadioMode = () => {
    setIsRadioMode(prev => !prev);
  };

  const setRadioMode = (enabled: boolean) => {
    setIsRadioMode(enabled);
  };

  return (
    <RadioModeContext.Provider value={{ isRadioMode, toggleRadioMode, setRadioMode }}>
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

import React, { createContext, useContext, useState, useCallback } from 'react';

interface UserRelay {
  url: string;
  read: boolean;
  write: boolean;
}

interface RelayConfigContextType {
  /** User's relay list from NIP-65 */
  userRelays: UserRelay[] | undefined;
  /** Update user's relay list (called by UserRelaysProvider) */
  setUserRelays: (relays: UserRelay[] | undefined) => void;
  /** Current relay URL from app config */
  currentRelayUrl: string;
  /** Update current relay URL (called by AppProvider) */
  setCurrentRelayUrl: (url: string) => void;
}

const RelayConfigContext = createContext<RelayConfigContextType | undefined>(undefined);

export function RelayConfigProvider({ 
  children, 
  initialRelayUrl 
}: { 
  children: React.ReactNode;
  initialRelayUrl: string;
}) {
  const [userRelays, setUserRelaysState] = useState<UserRelay[] | undefined>(undefined);
  const [currentRelayUrl, setCurrentRelayUrlState] = useState(initialRelayUrl);

  // Wrap setUserRelays to add logging
  const setUserRelays = useCallback((relays: UserRelay[] | undefined) => {
    console.log('🔄 RelayConfigContext setUserRelays:', relays?.map(r => ({ url: r.url, read: r.read, write: r.write })));
    setUserRelaysState(relays);
  }, []);

  // Wrap setCurrentRelayUrl to add logging
  const setCurrentRelayUrl = useCallback((url: string) => {
    console.log('🔄 RelayConfigContext setCurrentRelayUrl:', url);
    setCurrentRelayUrlState(url);
  }, []);

  const value: RelayConfigContextType = {
    userRelays,
    setUserRelays,
    currentRelayUrl,
    setCurrentRelayUrl,
  };

  return (
    <RelayConfigContext.Provider value={value}>
      {children}
    </RelayConfigContext.Provider>
  );
}

export function useRelayConfigContext() {
  const context = useContext(RelayConfigContext);
  if (context === undefined) {
    throw new Error('useRelayConfigContext must be used within a RelayConfigProvider');
  }
  return context;
}
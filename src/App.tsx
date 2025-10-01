// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense } from 'react';
import NostrProvider from '@/components/NostrProvider';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from '@nostrify/react/login';
import { AppProvider } from '@/components/AppProvider';
import { NWCProvider } from '@/contexts/NWCContext';
import { UserRelaysProvider } from '@/contexts/UserRelaysContext';
import { RelayConfigProvider } from '@/contexts/RelayConfigContext';
import { AutoPilotProvider } from '@/contexts/AutoPilotContext';
import { AppConfig } from '@/contexts/AppContext';
import AppRouter from './AppRouter';

const head = createHead({
  plugins: [
    InferSeoMetaPlugin(),
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});

const defaultConfig: AppConfig = {
  theme: "light",
  relayUrl: "wss://relay.primal.net",
};

const presetRelays = [
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

export function App() {
  console.log('App component rendering');
  try {
    return (
      <UnheadProvider head={head}>
        <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
          <QueryClientProvider client={queryClient}>
            <NostrLoginProvider storageKey='nostr:login'>
              <RelayConfigProvider initialRelayUrl={defaultConfig.relayUrl}>
                <NostrProvider>
                  <UserRelaysProvider>
                    <NWCProvider>
                      <AutoPilotProvider>
                        <TooltipProvider>
                          <Toaster />
                          <Suspense>
                            <AppRouter />
                          </Suspense>
                        </TooltipProvider>
                      </AutoPilotProvider>
                    </NWCProvider>
                  </UserRelaysProvider>
                </NostrProvider>
              </RelayConfigProvider>
            </NostrLoginProvider>
          </QueryClientProvider>
        </AppProvider>
      </UnheadProvider>
    );
  } catch (error) {
    console.error('App component error:', error);
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold text-red-500 mb-4">App Error</h1>
        <pre className="text-sm bg-gray-800 p-4 rounded overflow-auto">
          {error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  }
}

export default App;

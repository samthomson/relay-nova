import React, { useState } from 'react';
import { LoginArea } from '@/components/auth/LoginArea';
import { MyRelaysButton } from '@/components/MyRelaysButton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { ChevronDown, Server, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Default relays for the selector
const DEFAULT_RELAYS = [
  { url: 'wss://relay.primal.net', name: 'Primal', country: 'USA' },
  { url: 'wss://relay.damus.io', name: 'Damus', country: 'USA' },
  { url: 'wss://nos.lol', name: 'Nos.lol', country: 'UK' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band', country: 'Germany' },
];

export function Navbar() {
  const { user } = useCurrentUser();
  const [selectedRelay, setSelectedRelay] = useState(DEFAULT_RELAYS[0]);

  const handleRelaySelect = (relay: typeof DEFAULT_RELAYS[0]) => {
    setSelectedRelay(relay);
    // Dispatch event to open relay panel
    window.dispatchEvent(new CustomEvent('openRelayPanel', {
      detail: { relayUrl: relay.url }
    }));
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand and Relay Selector on the left */}
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-white">
              Relay Nova
            </h1>

            {/* Relay Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/20 hover:bg-white/10 hover:border-white/30 transition-all duration-200"
                >
                  <Server className="w-4 h-4 mr-2" />
                  {selectedRelay.name}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-900/95 backdrop-blur-md border border-white/10 min-w-[200px]">
                {DEFAULT_RELAYS.map((relay) => (
                  <DropdownMenuItem
                    key={relay.url}
                    onClick={() => handleRelaySelect(relay)}
                    className="text-white hover:bg-white/10 cursor-pointer focus:bg-white/10"
                  >
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="font-medium">{relay.name}</div>
                        <div className="text-xs text-gray-400">{relay.country}</div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side - Authentication */}
          <div className="flex items-center">
            {user ? (
              <MyRelaysButton />
            ) : (
              <LoginArea className="max-w-60" />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
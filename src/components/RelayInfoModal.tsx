import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Info, MapPin, Globe, Signal, Wifi, WifiOff, Plus, X, AlertTriangle } from 'lucide-react';
import { useUserRelaysContext } from '@/contexts/UserRelaysContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useState } from 'react';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

interface RelayInfoModalProps {
  relays: RelayLocation[];
  isLoading: boolean;
}

export function RelayInfoModal({ relays, isLoading }: RelayInfoModalProps) {
  const { userRelays, updateRelayList } = useUserRelaysContext();
  const { user } = useCurrentUser();
  const [isAddRelayDialogOpen, setIsAddRelayDialogOpen] = useState(false);
  const [newRelayUrl, setNewRelayUrl] = useState('');

  const { mutate: addRelay, isPending: isAdding } = useMutation({
    mutationFn: async (relayUrl: string) => {
      if (!user) throw new Error('User not logged in');
      if (!relayUrl.trim()) throw new Error('Relay URL is required');

      const currentRelays = userRelays || [];

      // Check if relay already exists
      if (currentRelays.some(r => r.url === relayUrl.trim())) {
        throw new Error('Relay already exists in your list');
      }

      // Add new relay with default read+write permissions
      const updatedRelays = [...currentRelays, { url: relayUrl.trim(), read: true, write: true }];

      await updateRelayList(updatedRelays);
    }
  });

  const { mutate: removeRelay, isPending: isRemoving } = useMutation({
    mutationFn: async (relayUrl: string) => {
      if (!user) throw new Error('User not logged in');

      const currentRelays = userRelays || [];
      const updatedRelays = currentRelays.filter(r => r.url !== relayUrl);

      await updateRelayList(updatedRelays);
    }
  });

  const groupedRelays = relays.reduce((acc, relay) => {
    const country = relay.country || 'Unknown';
    if (!acc[country]) {
      acc[country] = [];
    }
    acc[country].push(relay);
    return acc;
  }, {} as Record<string, RelayLocation[]>);

  const totalCountries = Object.keys(groupedRelays).length;

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-black/50 backdrop-blur-sm border-white/20 text-white hover:bg-white/10"
          >
            <Info className="w-4 h-4 mr-2" />
            Relay Info
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-black/95 backdrop-blur-sm border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Signal className="w-5 h-5" />
              Nostr Relay Network
              <Badge variant="outline" className="ml-auto">
                {relays.length} relays in {totalCountries} countries
              </Badge>
              {/* Add Relay Button */}
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddRelayDialogOpen(true)}
                  className="ml-2 bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  add relay+
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                <span>Loading relay data...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Statistics */}
                <div className="grid grid-cols-2 gap-4 p-4 border border-white/20 rounded-lg bg-white/5">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{relays.length}</div>
                    <div className="text-sm text-gray-400">Total Relays</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{totalCountries}</div>
                    <div className="text-sm text-gray-400">Countries</div>
                  </div>
                </div>

                {/* Relays by Country */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Relays by Location</h3>
                  {Object.entries(groupedRelays)
                    .sort(([, a], [, b]) => b.length - a.length)
                    .map(([country, countryRelays]) => (
                      <div key={country} className="border border-white/20 rounded-lg p-4 bg-white/5">
                        <div className="flex items-center gap-2 mb-3">
                          <Globe className="w-4 h-4 text-blue-400" />
                          <h4 className="font-semibold">{country}</h4>
                          <Badge variant="secondary" className="ml-auto">
                            {countryRelays.length} relay{countryRelays.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>

                        <div className="grid gap-2">
                          {countryRelays.map((relay, index) => {
                            const isInUserList = userRelays?.some(r => r.url === relay.url);

                            return (
                              <div
                                key={`${relay.url}-${index}`}
                                className="flex items-center justify-between p-3 border border-white/10 rounded bg-white/5 hover:bg-white/10 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-blue-400" />
                                    <div className="font-mono text-sm truncate">
                                      {relay.url.startsWith('wss://') ? relay.url : `wss://${relay.url}`}
                                    </div>
                                  </div>
                                  {relay.city && (
                                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 ml-6">
                                      <MapPin className="w-3 h-3" />
                                      {relay.city}
                                    </div>
                                  )}
                                </div>

                                {/* Add/Remove Relay Button */}
                                {user && (
                                  <div className="ml-4">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (isInUserList) {
                                          removeRelay(relay.url);
                                        } else {
                                          addRelay(relay.url);
                                        }
                                      }}
                                      disabled={isAdding || isRemoving}
                                      className={`h-8 px-3 text-xs whitespace-nowrap ${
                                        isInUserList
                                          ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20'
                                          : 'text-green-400 hover:text-green-300 hover:bg-green-500/10 border border-green-500/20'
                                      }`}
                                    >
                                      {isAdding || isRemoving ? (
                                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                                      ) : isInUserList ? (
                                        <X className="w-3 h-3 mr-1" />
                                      ) : (
                                        <Plus className="w-3 h-3 mr-1" />
                                      )}
                                      {isInUserList ? 'Remove' : 'Add'}
                                    </Button>
                                  </div>
                                )}

                                <div className="text-right text-xs text-gray-500 ml-4">
                                  <div>{Math.abs(relay.lat).toFixed(2)}°{relay.lat >= 0 ? 'N' : 'S'}</div>
                                  <div>{Math.abs(relay.lng).toFixed(2)}°{relay.lng >= 0 ? 'E' : 'W'}</div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    Raw: {relay.lat}, {relay.lng}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Network Information */}
                <div className="border border-white/20 rounded-lg p-4 bg-white/5">
                  <h3 className="text-lg font-semibold mb-3">About</h3>
                  <div className="text-sm text-gray-300 space-y-2">
                    <p>
                      This visualization shows the geographic distribution of known Nostr relays around the world.
                      Each yellow dot represents a relay server that helps power the decentralized Nostr network.
                    </p>
                    <p>
                      Location data is obtained through IP geolocation services and may not be 100% accurate.
                      Some relays may use CDNs or proxy services that affect their apparent location.
                    </p>
                    <p>
                      The Nostr network is constantly evolving, with new relays being added regularly.
                      This represents a snapshot of the network at the time of loading.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Add Relay Dialog */}
      <Dialog open={isAddRelayDialogOpen} onOpenChange={setIsAddRelayDialogOpen}>
        <DialogContent className="max-w-md bg-gray-900/95 backdrop-blur-sm border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-400" />
              Add New Relay
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="relay-url" className="text-sm font-medium text-white/80">
                Relay URL
              </label>
              <Input
                id="relay-url"
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                placeholder="wss://relay.example.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-green-500/30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddRelayDialogOpen(false);
                  setNewRelayUrl('');
                }}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newRelayUrl.trim()) {
                    addRelay(newRelayUrl.trim());
                    setIsAddRelayDialogOpen(false);
                    setNewRelayUrl('');
                  }
                }}
                disabled={!newRelayUrl.trim() || isAdding}
                className="bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30"
              >
                {isAdding ? (
                  <div className="w-4 h-4 border-2 border-green-300 border-t-transparent rounded-full animate-spin mr-2" />
                ) : null}
                Add Relay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
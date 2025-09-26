import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, Globe, Signal } from 'lucide-react';

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-white/20 rounded-lg bg-white/5">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{relays.length}</div>
                  <div className="text-sm text-gray-400">Total Relays</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{totalCountries}</div>
                  <div className="text-sm text-gray-400">Countries</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {Object.values(groupedRelays).some(relays => relays.length > 0) ? 'Live' : 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-400">Network Status</div>
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
                        {countryRelays.map((relay, index) => (
                          <div
                            key={`${relay.url}-${index}`}
                            className="flex items-center justify-between p-3 border border-white/10 rounded bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-sm text-green-400 truncate">
                                {relay.url}
                              </div>
                              {relay.city && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {relay.city}
                                </div>
                              )}
                            </div>
                            <div className="text-right text-xs text-gray-500 ml-4">
                              <div>{Math.abs(relay.lat).toFixed(2)}°{relay.lat >= 0 ? 'N' : 'S'}</div>
                              <div>{Math.abs(relay.lng).toFixed(2)}°{relay.lng >= 0 ? 'E' : 'W'}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                Raw: {relay.lat}, {relay.lng}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Network Information */}
              <div className="border border-white/20 rounded-lg p-4 bg-white/5">
                <h3 className="text-lg font-semibold mb-3">About the Network</h3>
                <div className="text-sm text-gray-300 space-y-2">
                  <p>
                    This visualization shows the geographic distribution of known Nostr relays around the world.
                    Each red dot represents a relay server that helps power the decentralized Nostr network.
                  </p>
                  <p>
                    Location data is obtained through IP geolocation services and may not be 100% accurate.
                    Some relays may use CDNs or proxy services that affect their apparent location.
                  </p>
                  <p>
                    The Nostr network is constantly evolving, with new relays coming online and others going offline.
                    This represents a snapshot of the network at the time of loading.
                  </p>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
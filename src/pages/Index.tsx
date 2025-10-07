import { useSeoMeta } from '@unhead/react';
import { ThreeEarth, type ThreeEarthRef } from '@/components/ThreeEarth';
import { Navbar } from '@/components/Navbar';
import { AutoPilotButton } from '@/components/AutoPilotButton';
import { useRelayLocations } from '@/hooks/useRelayLocations';
import { useRef } from 'react';

const Index = () => {
  useSeoMeta({
    title: 'Relay Nova - Nostr Relay Visualization',
    description: 'Explore Nostr relays around the world on an interactive 3D Earth visualization.',
  });

  const { data: relayLocationsData, isLoading: isLoadingLocations } = useRelayLocations();
  const earthRef = useRef<ThreeEarthRef>(null);

  return (
    <div className="relative min-h-screen">
      {/* Fixed Navbar */}
      <Navbar />

      {/* Main content area */}
      <div className="relative min-h-screen">
        {/* Instructions overlay */}
        <div className="absolute bottom-0 left-0 z-10 p-6">
          <div className="text-left text-white/70 text-sm">
            <p className="mb-2">🌍 Drag to rotate • 🔍 Scroll to zoom • ⚡ Click dots for relay info</p>
            <p className="text-xs opacity-60">
              Vibed with <a href="https://soapbox.pub/mkstack" className="underline hover:text-white">MKStack</a>
            </p>
          </div>
        </div>



        {/* Auto Pilot button at bottom right */}
        <div className="absolute bottom-6 right-6 z-20">
          <AutoPilotButton />
        </div>

        {/* 3D Earth Visualization */}
        <ThreeEarth ref={earthRef} relayLocations={relayLocationsData || []} />
      </div>
    </div>
  );
};

export default Index;

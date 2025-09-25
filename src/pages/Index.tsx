import { useSeoMeta } from '@unhead/react';
import { ThreeEarth } from '@/components/ThreeEarth';

const Index = () => {
  useSeoMeta({
    title: 'Earthly Relays - Nostr Relay Visualization',
    description: 'Explore Nostr relays around the world on an interactive 3D Earth visualization.',
  });

  return (
    <div className="relative min-h-screen">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">
            Earthly Relays
          </h1>
          <p className="text-lg text-white/80 drop-shadow">
            Nostr relays visualized around our planet
          </p>
        </div>
      </div>

      {/* Instructions overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-6">
        <div className="text-center text-white/70 text-sm">
          <p className="mb-2">🌍 Drag to rotate • 🔍 Scroll to zoom • ⚡ Click red dots for relay info • ℹ️ Use info button for full list</p>
          <p className="text-xs opacity-60">
            Vibed with <a href="https://soapbox.pub/mkstack" className="underline hover:text-white">MKStack</a>
          </p>
        </div>
      </div>

      {/* 3D Earth Visualization */}
      <ThreeEarth />
    </div>
  );
};

export default Index;

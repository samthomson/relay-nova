import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRelayLocations } from '@/hooks/useRelayLocations';
import { RelayInfoModal } from './RelayInfoModal';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export function SimpleEarth() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const relayGroupRef = useRef<THREE.Group | null>(null);
  
  const [hoveredRelay, setHoveredRelay] = useState<RelayLocation | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  const { data: relayLocations, isLoading } = useRelayLocations();

  useEffect(() => {
    if (!mountRef.current) return;

    console.log('SimpleEarth: Starting initialization...');

    try {
      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000033);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 0, 4);

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const pointLight = new THREE.PointLight(0xffffff, 1.5);
      pointLight.position.set(10, 10, 10);
      scene.add(pointLight);

      // Simple Earth with basic texture
      const earthGeometry = new THREE.SphereGeometry(2, 32, 16);
      const earthMaterial = new THREE.MeshLambertMaterial({ color: 0x4477bb });
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      scene.add(earth);
      earthRef.current = earth;

      // Relay markers group
      const relayGroup = new THREE.Group();
      earth.add(relayGroup);
      relayGroupRef.current = relayGroup;

      // Stars
      const starsGeometry = new THREE.BufferGeometry();
      const starsPositions = new Float32Array(1000 * 3);
      for (let i = 0; i < 1000; i++) {
        starsPositions[i * 3] = (Math.random() - 0.5) * 200;
        starsPositions[i * 3 + 1] = (Math.random() - 0.5) * 200;
        starsPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      }
      starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
      const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1 }));
      scene.add(stars);

      // Animation
      let animationId: number;
      const animate = () => {
        animationId = requestAnimationFrame(animate);
        earth.rotation.y += 0.002;
        renderer.render(scene, camera);
      };
      animate();

      // Cleanup
      return () => {
        if (animationId) cancelAnimationFrame(animationId);
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };

    } catch (error) {
      console.error('SimpleEarth failed:', error);
    }
  }, []);

  // Add relay markers
  useEffect(() => {
    if (!relayLocations || !relayGroupRef.current) return;

    console.log('Adding', relayLocations.length, 'relay markers');

    // Clear existing markers
    while (relayGroupRef.current.children.length > 0) {
      relayGroupRef.current.remove(relayGroupRef.current.children[0]);
    }

    // Add new markers
    relayLocations.forEach((relay, index) => {
      const radius = 2.05;
      
      // Fixed coordinate conversion
      const latRad = (90 - relay.lat) * (Math.PI / 180);
      const lngRad = (relay.lng + 180) * (Math.PI / 180);
      
      const x = -radius * Math.sin(latRad) * Math.cos(lngRad);
      const y = radius * Math.cos(latRad);
      const z = radius * Math.sin(latRad) * Math.sin(lngRad);

      const markerGeometry = new THREE.SphereGeometry(0.06, 8, 6);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(x, y, z);

      relayGroupRef.current!.add(marker);
    });

    console.log('Relay markers added successfully');
  }, [relayLocations]);

  return (
    <div className="relative w-full h-screen">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-20 right-6 z-20 bg-black/50 backdrop-blur-sm rounded-lg p-3">
          <div className="flex items-center space-x-2 text-white">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span className="text-sm">Loading relay locations...</span>
          </div>
        </div>
      )}

      {/* Controls and Info */}
      <div className="absolute top-20 right-6 z-20 space-y-3">
        {relayLocations && (
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
            <div className="text-white text-sm">
              <span className="font-semibold">{relayLocations.length}</span> relays discovered
            </div>
          </div>
        )}
        
        <RelayInfoModal 
          relays={relayLocations || []} 
          isLoading={isLoading} 
        />
      </div>

      {/* Three.js mount point */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Tooltip */}
      {hoveredRelay && tooltipPosition && (
        <div
          className="absolute z-30 bg-black/90 backdrop-blur-sm text-white p-3 rounded-lg pointer-events-none shadow-lg border border-white/20"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            transform: 'translate(0, -100%)',
          }}
        >
          <div className="text-sm font-semibold">
            {hoveredRelay.city ? `${hoveredRelay.city}, ${hoveredRelay.country}` : 'Unknown Location'}
          </div>
          <div className="text-xs text-gray-300 mt-1">
            {hoveredRelay.url.replace('wss://', '').replace('ws://', '')}
          </div>
          {hoveredRelay.lat && hoveredRelay.lng && (
            <div className="text-xs text-gray-400 mt-1">
              {hoveredRelay.lat.toFixed(2)}, {hoveredRelay.lng.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
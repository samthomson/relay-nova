import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRelayLocations } from '@/hooks/useRelayLocations';
import { RelayInfoModal } from './RelayInfoModal';
import { createEarthTexture } from '@/lib/earthTexture';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export function ThreeEarth() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const relayMarkersRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });

  const [hoveredRelay, setHoveredRelay] = useState<RelayLocation | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const { data: relayLocations, isLoading } = useRelayLocations();

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup with lighter background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000033); // Slightly lighter space background
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      50,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 4);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting - much brighter for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increased from 0.3
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5); // Increased intensity
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Add another light from the opposite side for even illumination
    const fillLight = new THREE.PointLight(0xffffff, 0.8);
    fillLight.position.set(-10, -10, -10);
    scene.add(fillLight);

    // Create Earth with proper satellite imagery texture
    const earthGeometry = new THREE.SphereGeometry(2, 64, 32);

    // Start with a good fallback texture
    const fallbackTexture = createEarthTexture();
    const earthMaterial = new THREE.MeshLambertMaterial({
      map: fallbackTexture
    });

    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);
    earthRef.current = earth;

    // Add relay markers as children of Earth so they rotate together
    earth.add(relayMarkersGroup);

    // Load real Earth texture asynchronously
    const textureLoader = new THREE.TextureLoader();

    // Try to load a better external texture, but we already have a good fallback
    const textureLoader = new THREE.TextureLoader();

    // Try a CORS-friendly texture source
    textureLoader.load(
      // Use a reliable CORS-enabled source
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      (texture) => {
        if (earthRef.current) {
          const newMaterial = new THREE.MeshLambertMaterial({
            map: texture
          });
          earthRef.current.material = newMaterial;
          console.log('High-quality Earth texture loaded successfully');
        }
      },
      undefined,
      (error) => {
        console.log('External texture failed to load, using fallback texture');
        // Fallback texture is already applied
      }
    );


    // Create atmosphere with better visibility
    const atmosphereGeometry = new THREE.SphereGeometry(2.05, 64, 32);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.2, // Increased opacity
      side: THREE.BackSide // Only render the inside
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // Create stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 5000;
    const starsPositions = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const radius = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starsPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starsPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starsPositions[i * 3 + 2] = radius * Math.cos(phi);
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      transparent: true,
      opacity: 0.8
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Create relay markers group as child of Earth (so they rotate together)
    const relayMarkersGroup = new THREE.Group();
    relayMarkersRef.current = relayMarkersGroup;

    // Raycaster for mouse picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Mouse controls
    const onMouseDown = (event: MouseEvent) => {
      isDragging.current = true;
      previousMouse.current = { x: event.clientX, y: event.clientY };
    };

    const onMouseMove = (event: MouseEvent) => {
      if (isDragging.current && earthRef.current) {
        const deltaX = event.clientX - previousMouse.current.x;
        const deltaY = event.clientY - previousMouse.current.y;

        earthRef.current.rotation.y += deltaX * 0.005;
        earthRef.current.rotation.x += deltaY * 0.005;

        // Clamp X rotation to prevent flipping
        earthRef.current.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, earthRef.current.rotation.x));

        previousMouse.current = { x: event.clientX, y: event.clientY };
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onMouseClick = (event: MouseEvent) => {
      // Don't handle click if we were dragging
      if (isDragging.current) return;

      // Calculate mouse position in normalized device coordinates
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast to find intersected objects
      raycaster.setFromCamera(mouse, camera);

      if (relayMarkersRef.current) {
        const intersects = raycaster.intersectObjects(relayMarkersRef.current.children, true);

        if (intersects.length > 0) {
          let relayData = null;

          // Check the intersected object and its parent for relay data
          let currentObject = intersects[0].object;
          while (currentObject && !relayData) {
            relayData = (currentObject as any).relayData;
            currentObject = currentObject.parent as THREE.Object3D;
          }

          if (relayData) {
            console.log('Clicked on relay:', relayData.url);
            setHoveredRelay(relayData);
            setTooltipPosition({ x: event.clientX, y: event.clientY });
          } else {
            console.log('Clicked on object without relay data');
            setHoveredRelay(null);
            setTooltipPosition(null);
          }
        } else {
          setHoveredRelay(null);
          setTooltipPosition(null);
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomSpeed = 0.1;
      const newZ = camera.position.z + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed);
      camera.position.z = Math.max(2.5, Math.min(8, newZ));
    };

    // Event listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      // Auto rotation when not dragging
      if (!isDragging.current && earthRef.current) {
        earthRef.current.rotation.y += 0.002;
      }

      // Pulse relay markers
      if (relayMarkersRef.current) {
        const time = Date.now() * 0.003;
        relayMarkersRef.current.children.forEach((child, index) => {
          if (child instanceof THREE.Group) {
            // Animate marker groups
            const pulseScale = 1 + Math.sin(time + index * 0.5) * 0.2;
            child.children.forEach((marker, subIndex) => {
              if (subIndex === 0) {
                // Main marker - subtle pulse
                marker.scale.setScalar(pulseScale);
              } else if (subIndex === 1 && marker instanceof THREE.Mesh) {
                // Glow effect - more dramatic pulse
                const glowScale = 1 + Math.sin(time + index * 0.7) * 0.4;
                marker.scale.setScalar(glowScale);
                const material = marker.material as THREE.MeshBasicMaterial;
                material.opacity = 0.3 + Math.sin(time + index * 0.8) * 0.2;
              }
            });
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('click', onMouseClick);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }

      renderer.dispose();
    };
  }, []);

  // Update relay markers when data changes
  useEffect(() => {
    if (!relayLocations || !relayMarkersRef.current) return;

    // Clear existing markers
    while (relayMarkersRef.current.children.length > 0) {
      relayMarkersRef.current.remove(relayMarkersRef.current.children[0]);
    }

    // Add new markers with corrected positioning
    console.log('Adding relay markers for', relayLocations.length, 'relays');

    relayLocations.forEach((relay, index) => {
      console.log(`Placing relay ${index}: ${relay.url} at lat=${relay.lat}, lng=${relay.lng}`);

      const radius = 2.05; // Slightly above Earth surface

      // Convert lat/lng to spherical coordinates (standard geographic to 3D conversion)
      const latRad = relay.lat * (Math.PI / 180);
      const lngRad = relay.lng * (Math.PI / 180);

      // Standard spherical to cartesian conversion for a sphere
      // X = r * cos(lat) * cos(lng)
      // Y = r * sin(lat)
      // Z = r * cos(lat) * sin(lng)
      const x = radius * Math.cos(latRad) * Math.cos(lngRad);
      const y = radius * Math.sin(latRad);
      const z = radius * Math.cos(latRad) * Math.sin(lngRad);

      console.log(`  Calculated position: x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}`);

      // Create marker group for easier management
      const markerGroup = new THREE.Group();

      // Main marker sphere
      const markerGeometry = new THREE.SphereGeometry(0.03, 16, 12);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: false
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);

      // Store relay data for tooltip
      (marker as any).relayData = relay;
      (markerGroup as any).relayData = relay;

      markerGroup.add(marker);

      // Create pulsing glow effect
      const glowGeometry = new THREE.SphereGeometry(0.045, 16, 12);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.4
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      markerGroup.add(glow);

      // Position the entire group
      markerGroup.position.set(x, y, z);

      relayMarkersRef.current!.add(markerGroup);

      // Create connection line (optional, for visual effect)
      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array([
        0, 0, 0,  // Earth center
        x, y, z   // Marker position
      ]);
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.3
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      relayMarkersRef.current!.add(line);
    });

    console.log('Finished adding relay markers. Total objects in markers group:', relayMarkersRef.current?.children.length);
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
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
  const isMouseDown = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const dragStartPosition = useRef({ x: 0, y: 0 });
  const DRAG_THRESHOLD = 5; // Minimum pixels to count as drag vs click

  const [hoveredRelay, setHoveredRelay] = useState<RelayLocation | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const { data: relayLocations, isLoading } = useRelayLocations();

  useEffect(() => {
    if (!mountRef.current) return;

    // Small delay to ensure DOM is ready and properly sized
    const initTimeout = setTimeout(() => {
      if (!mountRef.current) return;

    try {

    // Scene setup with lighter background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000033); // Slightly lighter space background
    sceneRef.current = scene;

    // Ensure we have proper dimensions first
    const width = mountRef.current.clientWidth || window.innerWidth;
    const height = mountRef.current.clientHeight || window.innerHeight;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      50,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 6); // Less zoomed in
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
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

    // Create relay markers group first
    const relayMarkersGroup = new THREE.Group();
    relayMarkersRef.current = relayMarkersGroup;

    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);
    earthRef.current = earth;

    // Add relay markers as children of Earth so they rotate together
    earth.add(relayMarkersGroup);

    // Load real Earth texture asynchronously with day/night cycle
    const textureLoader = new THREE.TextureLoader();

    // Load day texture
    textureLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      (dayTexture) => {
        console.log('Earth texture loaded successfully');

        // Load night texture
        textureLoader.load(
          'https://unpkg.com/three-globe/example/img/earth-night.jpg',
          (nightTexture) => {
            if (earthRef.current) {
              // Create a more sophisticated material with day/night transition
              const newMaterial = new THREE.MeshLambertMaterial({
                map: dayTexture,
                emissiveMap: nightTexture,
                emissive: new THREE.Color(0x444444),
                emissiveIntensity: 0.1
              });
              earthRef.current.material = newMaterial;
              console.log('Night texture loaded successfully');
            }
          },
          undefined,
          () => {
            console.log('Night texture failed to load, using day texture only');
            // Just use day texture
            if (earthRef.current) {
              const newMaterial = new THREE.MeshLambertMaterial({
                map: dayTexture
              });
              earthRef.current.material = newMaterial;
            }
          }
        );
      },
      undefined,
      (error) => {
        // Fallback texture is already applied, no action needed
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

    // Relay markers group was already created above

    // Raycaster for mouse picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Mouse controls
    const onMouseDown = (event: MouseEvent) => {
      isMouseDown.current = true;
      previousMouse.current = { x: event.clientX, y: event.clientY };
      dragStartPosition.current = { x: event.clientX, y: event.clientY };
      isDragging.current = false; // Don't set to true immediately
    };

    const onMouseMove = (event: MouseEvent) => {
      // Only process drag if mouse button is down
      if (!isMouseDown.current) return;

      // Check if we've moved enough to start dragging
      if (!isDragging.current) {
        const dragDistance = Math.sqrt(
          Math.pow(event.clientX - dragStartPosition.current.x, 2) +
          Math.pow(event.clientY - dragStartPosition.current.y, 2)
        );
        if (dragDistance > DRAG_THRESHOLD) {
          isDragging.current = true;
        }
      }

      if (isDragging.current && earthRef.current) {
        const deltaX = event.clientX - previousMouse.current.x;
        const deltaY = event.clientY - previousMouse.current.y;

        earthRef.current.rotation.y += deltaX * 0.005;
        earthRef.current.rotation.x += deltaY * 0.005;

        // Clamp X rotation to prevent flipping
        earthRef.current.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, earthRef.current.rotation.x));
      }

      previousMouse.current = { x: event.clientX, y: event.clientY };
    };

    const onMouseUp = () => {
      isMouseDown.current = false;
      isDragging.current = false;
    };

    const onMouseClick = (event: MouseEvent) => {
      // Only handle click if we didn't drag
      const dragDistance = Math.sqrt(
        Math.pow(event.clientX - dragStartPosition.current.x, 2) +
        Math.pow(event.clientY - dragStartPosition.current.y, 2)
      );

      if (dragDistance > DRAG_THRESHOLD) {
        return; // This was a drag, not a click
      }

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
            setHoveredRelay(relayData);
            setTooltipPosition({ x: event.clientX, y: event.clientY });
          } else {
            // Clicked on a line or other non-marker object - just clear selection
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
      const zoomSpeed = 0.2;
      const newZ = camera.position.z + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed);
      camera.position.z = Math.max(4, Math.min(12, newZ)); // Less zoomed in range
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

    // Force an immediate render to avoid white screen
    renderer.render(scene, camera);

    // Start animation loop
    animate();

    // Mark scene as ready for relay markers
    setSceneReady(true);

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      // Force render after resize
      renderer.render(scene, camera);
    };

    window.addEventListener('resize', handleResize);

    } catch (error) {
      console.error('ThreeEarth initialization failed:', error);

      // Create a simple fallback display
      if (mountRef.current) {
        mountRef.current.innerHTML = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: white;
            background: #000033;
            text-align: center;
            padding: 2rem;
          ">
            <div>
              <h2 style="margin-bottom: 1rem;">3D Earth Loading Error</h2>
              <p>WebGL initialization failed. Your browser may not support 3D graphics.</p>
              <p style="margin-top: 1rem; font-size: 0.8rem; opacity: 0.7;">Error: ${error?.message || 'Unknown error'}</p>
            </div>
          </div>
        `;
      }
    }
    }, 10); // Small delay to ensure DOM is ready

    return () => {
      clearTimeout(initTimeout);
      setSceneReady(false);

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      if (rendererRef.current) {
        rendererRef.current.domElement.removeEventListener('mousedown', onMouseDown);
        rendererRef.current.domElement.removeEventListener('mousemove', onMouseMove);
        rendererRef.current.domElement.removeEventListener('mouseup', onMouseUp);
        rendererRef.current.domElement.removeEventListener('click', onMouseClick);
        rendererRef.current.domElement.removeEventListener('wheel', onWheel);
      }

      window.removeEventListener('resize', handleResize);

      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Update relay markers when data changes and scene is ready
  useEffect(() => {
    console.log('Relay markers effect triggered. Data:', relayLocations?.length, 'markers ref:', !!relayMarkersRef.current, 'scene ready:', sceneReady);
    if (!relayLocations || !relayMarkersRef.current || !sceneReady) {
      console.log('Relay markers not ready yet - waiting...');
      return;
    }

    // Clear existing markers
    while (relayMarkersRef.current.children.length > 0) {
      relayMarkersRef.current.remove(relayMarkersRef.current.children[0]);
    }

    // Add new markers with corrected positioning
    console.log('Adding relay markers for', relayLocations.length, 'relays');

    relayLocations.forEach((relay, index) => {
      const radius = 2.05; // Slightly above Earth surface

      // Convert lat/lng to spherical coordinates
      // Three.js uses Y-up coordinate system, standard geographic coordinates
      const latRad = (90 - relay.lat) * (Math.PI / 180); // Convert to polar angle (0 = North Pole)
      const lngRad = relay.lng * (Math.PI / 180); // Convert longitude to radians

      // Spherical to Cartesian conversion for Three.js coordinate system
      const x = radius * Math.sin(latRad) * Math.cos(lngRad);
      const y = radius * Math.cos(latRad);
      const z = radius * Math.sin(latRad) * Math.sin(lngRad);

      console.log(`Placing relay ${index}: ${relay.url} at lat=${relay.lat}, lng=${relay.lng}`);
      console.log(`  Calculated position: x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}`);

      // Create marker group for easier management
      const markerGroup = new THREE.Group();

      // Main marker sphere - made larger for better visibility
      const markerGeometry = new THREE.SphereGeometry(0.08, 16, 12); // Increased size
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: false
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);

      // Store relay data for tooltip
      (marker as any).relayData = relay;
      (markerGroup as any).relayData = relay;

      markerGroup.add(marker);

      // Create pulsing glow effect - made larger
      const glowGeometry = new THREE.SphereGeometry(0.12, 16, 12); // Increased size
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
  }, [relayLocations, sceneReady]);

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
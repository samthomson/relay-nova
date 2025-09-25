import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRelayLocations } from '@/hooks/useRelayLocations';

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

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
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

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Create Earth
    const earthGeometry = new THREE.SphereGeometry(2, 64, 32);
    
    // Create Earth texture programmatically
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const context = canvas.getContext('2d')!;
    
    // Base ocean color
    context.fillStyle = '#1e3a8a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create simplified continents
    const continents = [
      { x: 0.15, y: 0.3, w: 0.25, h: 0.4 }, // North America
      { x: 0.22, y: 0.55, w: 0.12, h: 0.35 }, // South America  
      { x: 0.48, y: 0.25, w: 0.08, h: 0.15 }, // Europe
      { x: 0.47, y: 0.35, w: 0.13, h: 0.45 }, // Africa
      { x: 0.6, y: 0.2, w: 0.3, h: 0.4 }, // Asia
      { x: 0.75, y: 0.7, w: 0.1, h: 0.08 }, // Australia
    ];
    
    continents.forEach(continent => {
      const x = continent.x * canvas.width;
      const y = continent.y * canvas.height;
      const w = continent.w * canvas.width;
      const h = continent.h * canvas.height;
      
      context.fillStyle = '#22c55e';
      context.fillRect(x, y, w, h);
      
      // Add terrain variation
      for (let i = 0; i < 50; i++) {
        const px = x + Math.random() * w;
        const py = y + Math.random() * h;
        const size = Math.random() * 15 + 3;
        
        context.fillStyle = Math.random() > 0.5 ? '#16a34a' : '#a3a3a3';
        context.beginPath();
        context.arc(px, py, size, 0, Math.PI * 2);
        context.fill();
      }
    });
    
    const earthTexture = new THREE.CanvasTexture(canvas);
    const earthMaterial = new THREE.MeshPhongMaterial({ 
      map: earthTexture,
      shininess: 10
    });
    
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);
    earthRef.current = earth;

    // Create atmosphere
    const atmosphereGeometry = new THREE.SphereGeometry(2.05, 64, 32);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.1
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

    // Create relay markers group
    const relayMarkersGroup = new THREE.Group();
    scene.add(relayMarkersGroup);
    relayMarkersRef.current = relayMarkersGroup;

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
        relayMarkersRef.current.children.forEach((marker, index) => {
          const scale = 1 + Math.sin(time + index * 0.5) * 0.3;
          marker.scale.setScalar(scale);
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

    // Add new markers
    relayLocations.forEach((relay) => {
      const radius = 2.02;
      const phi = (90 - relay.lat) * (Math.PI / 180);
      const theta = (relay.lng + 180) * (Math.PI / 180);
      
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);

      // Create marker
      const markerGeometry = new THREE.SphereGeometry(0.015, 12, 8);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff3333 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(x, y, z);
      
      // Store relay data for tooltip
      (marker as any).relayData = relay;
      
      relayMarkersRef.current!.add(marker);

      // Create connection line
      const lineGeometry = new THREE.CylinderGeometry(0.001, 0.003, 0.08);
      const lineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff3333, 
        transparent: true, 
        opacity: 0.8 
      });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.position.set(x, y - 0.04, z);
      line.lookAt(0, 0, 0);
      
      relayMarkersRef.current!.add(line);
    });
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

      {/* Relay count */}
      {relayLocations && (
        <div className="absolute top-20 right-6 z-20 bg-black/50 backdrop-blur-sm rounded-lg p-3">
          <div className="text-white text-sm">
            <span className="font-semibold">{relayLocations.length}</span> relays discovered
          </div>
        </div>
      )}

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
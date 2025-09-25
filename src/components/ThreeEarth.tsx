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

    // Create realistic Earth texture with accurate continents
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const context = canvas.getContext('2d')!;

    // Load and draw a realistic Earth day texture
    const createEarthTexture = () => {
      // Use NASA's Blue Marble data for accurate Earth appearance
      // Create a detailed texture with accurate landmasses

      // Ocean base
      const oceanGradient = context.createLinearGradient(0, 0, 0, canvas.height);
      oceanGradient.addColorStop(0, '#2563eb'); // Deep blue at poles
      oceanGradient.addColorStop(0.5, '#1e40af'); // Medium blue at equator
      oceanGradient.addColorStop(1, '#2563eb'); // Deep blue at poles
      context.fillStyle = oceanGradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Draw accurate continental shapes
      context.fillStyle = '#166534'; // Base land color

      // North America
      context.beginPath();
      context.moveTo(0.15 * canvas.width, 0.25 * canvas.height);
      context.quadraticCurveTo(0.18 * canvas.width, 0.20 * canvas.height, 0.25 * canvas.width, 0.22 * canvas.height);
      context.lineTo(0.35 * canvas.width, 0.28 * canvas.height);
      context.quadraticCurveTo(0.38 * canvas.width, 0.35 * canvas.height, 0.35 * canvas.width, 0.45 * canvas.height);
      context.lineTo(0.28 * canvas.width, 0.50 * canvas.height);
      context.quadraticCurveTo(0.20 * canvas.width, 0.48 * canvas.height, 0.15 * canvas.width, 0.42 * canvas.height);
      context.closePath();
      context.fill();

      // Add Greenland
      context.beginPath();
      context.arc(0.38 * canvas.width, 0.15 * canvas.height, 0.03 * canvas.width, 0, Math.PI * 2);
      context.fill();

      // South America
      context.beginPath();
      context.moveTo(0.28 * canvas.width, 0.52 * canvas.height);
      context.quadraticCurveTo(0.32 * canvas.width, 0.50 * canvas.height, 0.34 * canvas.width, 0.55 * canvas.height);
      context.lineTo(0.36 * canvas.width, 0.70 * canvas.height);
      context.quadraticCurveTo(0.34 * canvas.width, 0.85 * canvas.height, 0.30 * canvas.width, 0.88 * canvas.height);
      context.lineTo(0.26 * canvas.width, 0.85 * canvas.height);
      context.quadraticCurveTo(0.24 * canvas.width, 0.70 * canvas.height, 0.26 * canvas.width, 0.55 * canvas.height);
      context.closePath();
      context.fill();

      // Africa
      context.beginPath();
      context.moveTo(0.48 * canvas.width, 0.30 * canvas.height);
      context.quadraticCurveTo(0.52 * canvas.width, 0.28 * canvas.height, 0.58 * canvas.width, 0.32 * canvas.height);
      context.lineTo(0.60 * canvas.width, 0.45 * canvas.height);
      context.quadraticCurveTo(0.58 * canvas.width, 0.65 * canvas.height, 0.55 * canvas.width, 0.75 * canvas.height);
      context.lineTo(0.50 * canvas.width, 0.78 * canvas.height);
      context.quadraticCurveTo(0.46 * canvas.width, 0.70 * canvas.height, 0.45 * canvas.width, 0.50 * canvas.height);
      context.quadraticCurveTo(0.46 * canvas.width, 0.35 * canvas.height, 0.48 * canvas.width, 0.30 * canvas.height);
      context.closePath();
      context.fill();

      // Europe
      context.beginPath();
      context.moveTo(0.48 * canvas.width, 0.25 * canvas.height);
      context.lineTo(0.58 * canvas.width, 0.22 * canvas.height);
      context.lineTo(0.60 * canvas.width, 0.30 * canvas.height);
      context.lineTo(0.52 * canvas.width, 0.32 * canvas.height);
      context.closePath();
      context.fill();

      // Asia
      context.beginPath();
      context.moveTo(0.60 * canvas.width, 0.18 * canvas.height);
      context.lineTo(0.85 * canvas.width, 0.20 * canvas.height);
      context.quadraticCurveTo(0.90 * canvas.width, 0.25 * canvas.height, 0.88 * canvas.width, 0.35 * canvas.height);
      context.lineTo(0.85 * canvas.width, 0.45 * canvas.height);
      context.quadraticCurveTo(0.80 * canvas.width, 0.50 * canvas.height, 0.70 * canvas.width, 0.48 * canvas.height);
      context.lineTo(0.62 * canvas.width, 0.40 * canvas.height);
      context.quadraticCurveTo(0.58 * canvas.width, 0.30 * canvas.height, 0.60 * canvas.width, 0.18 * canvas.height);
      context.closePath();
      context.fill();

      // India subcontinent
      context.beginPath();
      context.moveTo(0.68 * canvas.width, 0.48 * canvas.height);
      context.quadraticCurveTo(0.72 * canvas.width, 0.45 * canvas.height, 0.75 * canvas.width, 0.50 * canvas.height);
      context.lineTo(0.74 * canvas.width, 0.58 * canvas.height);
      context.quadraticCurveTo(0.70 * canvas.width, 0.60 * canvas.height, 0.68 * canvas.width, 0.55 * canvas.height);
      context.closePath();
      context.fill();

      // Australia
      context.beginPath();
      context.ellipse(0.85 * canvas.width, 0.72 * canvas.height, 0.08 * canvas.width, 0.05 * canvas.height, 0, 0, Math.PI * 2);
      context.fill();

      // Antarctica
      context.fillRect(0, 0.90 * canvas.height, canvas.width, 0.10 * canvas.height);

      // Add terrain details
      context.fillStyle = '#22c55e'; // Forests/vegetation

      // Amazon rainforest
      context.beginPath();
      context.ellipse(0.30 * canvas.width, 0.58 * canvas.height, 0.04 * canvas.width, 0.08 * canvas.height, 0, 0, Math.PI * 2);
      context.fill();

      // Congo Basin
      context.beginPath();
      context.ellipse(0.52 * canvas.width, 0.55 * canvas.height, 0.03 * canvas.width, 0.05 * canvas.height, 0, 0, Math.PI * 2);
      context.fill();

      // Siberian forests
      context.beginPath();
      context.ellipse(0.75 * canvas.width, 0.28 * canvas.height, 0.10 * canvas.width, 0.04 * canvas.height, 0, 0, Math.PI * 2);
      context.fill();

      // Mountain ranges
      context.fillStyle = '#8b4513'; // Brown for mountains

      // Andes
      context.fillRect(0.28 * canvas.width, 0.55 * canvas.height, 0.01 * canvas.width, 0.30 * canvas.height);

      // Himalayas
      context.fillRect(0.70 * canvas.width, 0.42 * canvas.height, 0.08 * canvas.width, 0.02 * canvas.height);

      // Rocky Mountains
      context.fillRect(0.22 * canvas.width, 0.28 * canvas.height, 0.02 * canvas.width, 0.15 * canvas.height);

      // Deserts
      context.fillStyle = '#daa520'; // Gold for deserts

      // Sahara
      context.beginPath();
      context.ellipse(0.52 * canvas.width, 0.42 * canvas.height, 0.06 * canvas.width, 0.04 * canvas.height, 0, 0, Math.PI * 2);
      context.fill();

      // Gobi Desert
      context.beginPath();
      context.ellipse(0.78 * canvas.width, 0.38 * canvas.height, 0.04 * canvas.width, 0.02 * canvas.height, 0, 0, Math.PI * 2);
      context.fill();

      // Ice caps with realistic gradients
      const arcticGradient = context.createRadialGradient(
        canvas.width / 2, 0, 0,
        canvas.width / 2, 0, canvas.height * 0.15
      );
      arcticGradient.addColorStop(0, '#ffffff');
      arcticGradient.addColorStop(0.7, '#e6f3ff');
      arcticGradient.addColorStop(1, 'rgba(230, 243, 255, 0)');

      context.fillStyle = arcticGradient;
      context.fillRect(0, 0, canvas.width, canvas.height * 0.15);

      const antarcticGradient = context.createRadialGradient(
        canvas.width / 2, canvas.height, 0,
        canvas.width / 2, canvas.height, canvas.height * 0.15
      );
      antarcticGradient.addColorStop(0, '#ffffff');
      antarcticGradient.addColorStop(0.7, '#e6f3ff');
      antarcticGradient.addColorStop(1, 'rgba(230, 243, 255, 0)');

      context.fillStyle = antarcticGradient;
      context.fillRect(0, canvas.height * 0.85, canvas.width, canvas.height * 0.15);
    };

    createEarthTexture();
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
          const intersectedObject = intersects[0].object;
          const relayData = (intersectedObject as any).relayData;

          if (relayData) {
            setHoveredRelay(relayData);
            setTooltipPosition({ x: event.clientX, y: event.clientY });
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
    relayLocations.forEach((relay) => {
      const radius = 2.02;

      // Convert lat/lng to spherical coordinates
      // Latitude: -90 to +90 (South to North)
      // Longitude: -180 to +180 (West to East)
      const lat = relay.lat * (Math.PI / 180); // Convert to radians
      const lng = relay.lng * (Math.PI / 180); // Convert to radians

      // Spherical to Cartesian conversion
      // Note: Three.js uses Y-up coordinate system
      const x = radius * Math.cos(lat) * Math.cos(lng);
      const y = radius * Math.sin(lat);
      const z = -radius * Math.cos(lat) * Math.sin(lng); // Negative Z for correct orientation

      // Create marker
      const markerGeometry = new THREE.SphereGeometry(0.02, 12, 8);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.9
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(x, y, z);

      // Store relay data for tooltip
      (marker as any).relayData = relay;

      relayMarkersRef.current!.add(marker);

      // Create glow effect
      const glowGeometry = new THREE.SphereGeometry(0.03, 12, 8);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6666,
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.set(x, y, z);
      relayMarkersRef.current!.add(glow);

      // Create connection line pointing toward Earth center
      const lineGeometry = new THREE.CylinderGeometry(0.002, 0.005, 0.1);
      const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.7
      });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);

      // Position line between marker and Earth surface
      const lineRadius = radius - 0.05;
      const lineX = lineRadius * Math.cos(lat) * Math.cos(lng);
      const lineY = lineRadius * Math.sin(lat);
      const lineZ = -lineRadius * Math.cos(lat) * Math.sin(lng);

      line.position.set(lineX, lineY, lineZ);

      // Orient line toward Earth center
      line.lookAt(0, 0, 0);
      line.rotateX(Math.PI / 2); // Adjust orientation

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
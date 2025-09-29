import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRelayLocations } from '@/hooks/useRelayLocations';
import { RelayInfoModal } from './RelayInfoModal';
import { RelayNotesPanel } from './RelayNotesPanel';

interface RelayLocation {
  url: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

interface RelayStatus extends RelayLocation {
  isOnline: boolean;
  checked: boolean;
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

  // Auto/manual mode management
  const isAutoMode = useRef(true);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const lastInteraction = useRef(Date.now());

  // Track if mouse is over relay panel for scroll handling
  const isMouseOverRelayPanel = useRef(false);

  // Track relay panel element for bounds checking
  const relayPanelRef = useRef<HTMLElement | null>(null);

  // Track whether wheel events should be enabled
  const wheelEventsEnabled = useRef(true);

  // Store the wheel event handler for removal
  const wheelEventHandlerRef = useRef<((event: WheelEvent) => void) | null>(null);

  // Track clicks outside the relay panel
  const relayPanelContainerRef = useRef<HTMLDivElement>(null);

  // Store star layer references for animation
  const starLayersRef = useRef<any>(null);

  // Function to check if mouse coordinates are within relay panel bounds
  const isMouseOverRelayPanelBounds = (x: number, y: number) => {
    if (!relayPanelRef.current || !openRelayRef.current) return false;

    const rect = relayPanelRef.current.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  // Function to open relay panel and determine side
  const openRelayPanel = (relay: RelayLocation, camera: THREE.PerspectiveCamera) => {
    setOpenRelay(relay);

    // Disable wheel events when relay panel opens
    wheelEventsEnabled.current = false;

    // Remove wheel event listener from document
    if (wheelEventHandlerRef.current) {
      document.removeEventListener('wheel', wheelEventHandlerRef.current);
    }

    // Pause auto mode when relay panel is open
    isAutoMode.current = false;

    // Clear any existing auto mode timer
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }

    // Determine which side to show panel based on relay position
    // Convert relay 3D position to screen coordinates
    const latRad = relay.lat * (Math.PI / 180);
    const lngRad = -relay.lng * (Math.PI / 180);

    const radius = 2.05;
    const x = radius * Math.cos(latRad) * Math.cos(lngRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.sin(lngRad);

    // Project 3D position to screen coordinates
    const vector = new THREE.Vector3(x, y, z);
    vector.project(camera);

    const screenX = (vector.x * 0.5 + 0.5) * window.innerWidth;

    // Determine side based on screen position
    if (window.innerWidth < 768) {
      // Mobile: show at bottom
      setRelaySide('bottom');
    } else {
      // Desktop: show on opposite side of relay
      setRelaySide(screenX < window.innerWidth / 2 ? 'right' : 'left');
    }
  };

  // Function to close relay panel
  const closeRelayPanel = () => {
    setOpenRelay(null);
    setHoveredRelay(null); // Clear the hovered relay to remove tooltip
    setTooltipPosition(null); // Clear tooltip position
    isMouseOverRelayPanel.current = false; // Reset mouse over state when panel closes
    relayPanelRef.current = null; // Clear the panel ref
    wheelEventsEnabled.current = true; // Re-enable wheel events when panel closes

    // Re-attach wheel event listener to document
    if (wheelEventHandlerRef.current) {
      document.addEventListener('wheel', wheelEventHandlerRef.current, { passive: false });
    }

    // Reset all mouse states to ensure auto rotation works
    isMouseDown.current = false;
    isDragging.current = false;

    // Immediately enable auto mode and clear any timers
    isAutoMode.current = true;
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }

    // Force a small rotation to kickstart the auto rotation
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.001;
    }
  };

  const [hoveredRelay, setHoveredRelay] = useState<RelayLocation | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [openRelay, setOpenRelay] = useState<RelayLocation | null>(null);
  const [relaySide, setRelaySide] = useState<'left' | 'right' | 'bottom'>('right');

  // Create a ref to track the current openRelay state for event handlers
  const openRelayRef = useRef(openRelay);

  // Update the ref whenever openRelay changes
  useEffect(() => {
    openRelayRef.current = openRelay;
  }, [openRelay]);

  const { data: relayLocations, isLoading: isLoadingLocations } = useRelayLocations();

  // Calculate counts for display
  const totalCount = relayLocations?.length || 0;
  const isLoading = isLoadingLocations;

  useEffect(() => {
    if (!mountRef.current) return;

    // Small delay to ensure DOM is ready and properly sized
    const initTimeout = setTimeout(() => {
      if (!mountRef.current) return;

    try {

    // Scene setup with pure black space
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Pure black space
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

    // Day/night lighting effect
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Base ambient light
    scene.add(ambientLight);

    // Main directional light acting as the sun
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(8, 2, 8); // Sun position - creates day/night effect
    scene.add(sunLight);

    // Very subtle blue fill light for night side (moonlight effect)
    const moonLight = new THREE.DirectionalLight(0x4477bb, 0.2);
    moonLight.position.set(-8, -2, -8); // Opposite side of sun
    scene.add(moonLight);

    // Create Earth with proper satellite imagery texture
    const earthGeometry = new THREE.SphereGeometry(2, 64, 32);

    // Start with a simple material (no fallback texture to avoid flash)
    const earthMaterial = new THREE.MeshLambertMaterial({
      color: 0x1a1a2e // Dark blue color as placeholder
    });

    // Create relay markers group first
    const relayMarkersGroup = new THREE.Group();
    relayMarkersRef.current = relayMarkersGroup;

    const earth = new THREE.Mesh(earthGeometry, earthMaterial);

    // Rotate Earth to align with standard coordinate system
    // This rotates the entire mesh so that 0° longitude faces the correct direction
    earth.rotation.y = -Math.PI / 2; // Rotate -90 degrees around Y axis

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

        // Apply day texture only for now
        if (earthRef.current) {
          const newMaterial = new THREE.MeshLambertMaterial({
            map: dayTexture
          });
          earthRef.current.material = newMaterial;
        }
      },
      undefined,
      (error) => {
        console.error('Failed to load Earth texture:', error);
        // Keep the dark blue placeholder if texture fails to load
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

    // Create enhanced starfield with multiple layers for better visual depth
    const createStarLayer = (count: number, minRadius: number, maxRadius: number, size: number, opacity: number) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: size,
        transparent: true,
        opacity: opacity,
        sizeAttenuation: true
      });

      return new THREE.Points(geometry, material);
    };

    // Create multiple star layers for depth
    const farStars = createStarLayer(8000, 200, 400, 0.4, 0.6);  // Distant, small stars
    const midStars = createStarLayer(4000, 150, 250, 0.8, 0.8); // Medium stars
    const nearStars = createStarLayer(2000, 100, 180, 1.2, 1.0); // Closer, brighter stars

    // Add some colored stars for visual interest
    const coloredStarsGeometry = new THREE.BufferGeometry();
    const coloredStarsPositions = new Float32Array(1000 * 3);
    const coloredStarColors = new Float32Array(1000 * 3);

    for (let i = 0; i < 1000; i++) {
      const radius = 120 + Math.random() * 180;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      coloredStarsPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      coloredStarsPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      coloredStarsPositions[i * 3 + 2] = radius * Math.cos(phi);

      // Add some color variation (blues, yellows, slight oranges)
      const colorChoice = Math.random();
      if (colorChoice < 0.3) {
        // Blue stars
        coloredStarColors[i * 3] = 0.7 + Math.random() * 0.3;     // R
        coloredStarColors[i * 3 + 1] = 0.8 + Math.random() * 0.2; // G
        coloredStarColors[i * 3 + 2] = 1.0;                          // B
      } else if (colorChoice < 0.7) {
        // Yellow-white stars
        coloredStarColors[i * 3] = 1.0;                          // R
        coloredStarColors[i * 3 + 1] = 0.9 + Math.random() * 0.1; // G
        coloredStarColors[i * 3 + 2] = 0.7 + Math.random() * 0.3; // B
      } else {
        // Slightly orange stars
        coloredStarColors[i * 3] = 1.0;                          // R
        coloredStarColors[i * 3 + 1] = 0.8 + Math.random() * 0.2; // G
        coloredStarColors[i * 3 + 2] = 0.6 + Math.random() * 0.2; // B
      }
    }

    coloredStarsGeometry.setAttribute('position', new THREE.BufferAttribute(coloredStarsPositions, 3));
    coloredStarsGeometry.setAttribute('color', new THREE.BufferAttribute(coloredStarColors, 3));
    const coloredStarsMaterial = new THREE.PointsMaterial({
      size: 1.5,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      sizeAttenuation: true
    });
    const coloredStars = new THREE.Points(coloredStarsGeometry, coloredStarsMaterial);

    // Add all star layers to scene
    scene.add(farStars);
    scene.add(midStars);
    scene.add(nearStars);
    scene.add(coloredStars);

    // Store references for animation
    starLayersRef.current = { farStars, midStars, nearStars, coloredStars };

    // Relay markers group was already created above

    // Raycaster for mouse picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Mouse controls
    const setManualMode = () => {
      isAutoMode.current = false;
      lastInteraction.current = Date.now();

      // Clear any existing timer
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }

      // Set timer to return to auto mode after 3 seconds
      inactivityTimer.current = setTimeout(() => {
        isAutoMode.current = true;
      }, 3000);
    };

    // Function to immediately resume auto mode
    const resumeAutoMode = () => {
      console.log('resumeAutoMode called - setting isAutoMode to true');
      isAutoMode.current = true;
      console.log('isAutoMode.current is now:', isAutoMode.current);

      // Clear any existing timer
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }

      // Reset dragging state to ensure auto rotation works
      isDragging.current = false;
      isMouseDown.current = false;
      console.log('Drag states reset - isDragging:', isDragging.current, 'isMouseDown:', isMouseDown.current);

      // Update last interaction time
      lastInteraction.current = Date.now();

      // Force a small rotation to kickstart auto mode
      if (earthRef.current) {
        earthRef.current.rotation.y += 0.001;
        console.log('Forced small rotation, new rotation:', earthRef.current.rotation.y);
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      // Don't process globe events when relay panel is open
      if (openRelay) return;

      setManualMode();
      isMouseDown.current = true;
      previousMouse.current = { x: event.clientX, y: event.clientY };
      dragStartPosition.current = { x: event.clientX, y: event.clientY };
      isDragging.current = false; // Don't set to true immediately
    };

    const onMouseMove = (event: MouseEvent) => {
      // Don't process globe events when relay panel is open
      if (openRelay) return;

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
        setManualMode();
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
      // Don't process globe events when relay panel is open
      if (openRelay) return;

      setManualMode();

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

            // Open relay panel
            openRelayPanel(relayData, camera);
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
      // Completely ignore wheel events when relay panel is open
      if (!wheelEventsEnabled.current || openRelay) {
        return; // Let events bubble through to relay panel
      }

      // Check if the mouse is over a relay panel using multiple methods
      const isOverRelayPanel = isMouseOverRelayPanel.current ||
        (openRelayRef.current && event.target instanceof Element &&
         event.target.closest('[data-relay-panel]')) ||
        isMouseOverRelayPanelBounds(event.clientX, event.clientY);

      if (isOverRelayPanel) {
        return; // Don't handle wheel events over relay panel
      }

      // Check if the event target is the Three.js renderer or its parent
      const isOverGlobe = event.target instanceof Element &&
        (event.target === rendererRef.current?.domElement ||
         event.target.closest('canvas'));

      if (!isOverGlobe) {
        return; // Don't handle wheel events outside the globe
      }

      // Only prevent default if we're going to handle the zoom
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

    // Store the wheel event handler and attach to document
    wheelEventHandlerRef.current = onWheel;
    document.addEventListener('wheel', wheelEventHandlerRef.current, { passive: false });

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      // Auto rotation only when in auto mode
      if (isAutoMode.current && !isDragging.current && earthRef.current) {
        earthRef.current.rotation.y += 0.002;
      }

      // Subtle relay marker animation
      if (relayMarkersRef.current) {
        const time = Date.now() * 0.001; // Animation time
        relayMarkersRef.current.children.forEach((child, index) => {
          if (child instanceof THREE.Group) {
            child.children.forEach((marker, subIndex) => {
              if (subIndex === 0) {
                // Main marker - very subtle scale animation
                const scale = 1 + Math.sin(time * 2 + index * 0.5) * 0.1;
                marker.scale.setScalar(scale);
              } else if (subIndex === 1 && marker instanceof THREE.Mesh) {
                // Outer ring - gentle opacity pulse
                const material = marker.material as THREE.MeshBasicMaterial;
                material.opacity = 0.6 + Math.sin(time * 1.5 + index * 0.3) * 0.3;
              } else if (subIndex === 2 && marker instanceof THREE.Mesh) {
                // Inner pulse point - bright white pulse
                const material = marker.material as THREE.MeshBasicMaterial;
                const pulse = Math.sin(time * 3 + index * 0.7) * 0.5 + 0.5;
                material.opacity = 0.3 + pulse * 0.7;
                const scale = 1 + pulse * 0.5;
                marker.scale.setScalar(scale);
              }
            });
          }
        });
      }

      // Animate star system
      if (starLayersRef.current) {
        const time = Date.now() * 0.001; // Animation time

        // Update shader uniforms for star animation
        const { material } = starLayersRef.current;
        if (material) {
          material.uniforms.time.value = time;
        }
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
      }

      // Remove document wheel event
      if (wheelEventHandlerRef.current) {
        document.removeEventListener('wheel', wheelEventHandlerRef.current);
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

  // Ensure auto mode is properly initialized
  useEffect(() => {
    isAutoMode.current = true;
  }, []);

  // Add click-outside-to-close functionality
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only close if relay panel is open
      if (!openRelay) return;

      // Check if click is outside the relay panel
      if (relayPanelContainerRef.current && !relayPanelContainerRef.current.contains(event.target as Node)) {
        closeRelayPanel();
      }
    };

    // Add event listener when relay panel is open
    if (openRelay) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Clean up event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openRelay]);

  // Update relay markers when data changes and scene is ready
  useEffect(() => {
    if (!relayLocations || !relayMarkersRef.current || !sceneReady) {
      return;
    }

    // Clear existing markers
    while (relayMarkersRef.current.children.length > 0) {
      relayMarkersRef.current.remove(relayMarkersRef.current.children[0]);
    }

    // Add relay markers with refined design

    relayLocations.forEach((relay, index) => {
      const radius = 2.05; // Slightly above Earth surface

      // Convert geographic coordinates to 3D Cartesian coordinates
      // Geographic: latitude (-90 to +90), longitude (-180 to +180)
      // Three.js: Y up, X right, Z towards viewer

      const latRad = relay.lat * (Math.PI / 180);
      const lngRad = -relay.lng * (Math.PI / 180); // Invert longitude for correct direction

      // Standard conversion with inverted longitude
      const x = radius * Math.cos(latRad) * Math.cos(lngRad);
      const y = radius * Math.sin(latRad);
      const z = radius * Math.cos(latRad) * Math.sin(lngRad);

      // Relay positioned at ${relay.city}, ${relay.country}

      // Create marker group for easier management
      const markerGroup = new THREE.Group();

      // Main marker - small and refined, default color since we're not checking status
      const markerGeometry = new THREE.SphereGeometry(0.02, 16, 12);
      const markerColor = 0xffff44; // Yellow for all relays (not checking status)
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: markerColor,
        transparent: false
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);

      // Store relay data for tooltip
      (marker as any).relayData = relay;
      (markerGroup as any).relayData = relay;

      markerGroup.add(marker);

      // Create subtle outer ring for elegance, default color since we're not checking status
      const ringGeometry = new THREE.RingGeometry(0.025, 0.035, 24);
      const ringColor = 0xffff66; // Lighter yellow for all relays (not checking status)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);

      // Orient the ring to face outward from Earth center
      ring.lookAt(new THREE.Vector3(x * 2, y * 2, z * 2));
      markerGroup.add(ring);

      // Create tiny inner pulse point
      const pulseGeometry = new THREE.SphereGeometry(0.008, 8, 6);
      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
      });
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      markerGroup.add(pulse);

      // Position the entire group
      markerGroup.position.set(x, y, z);

      relayMarkersRef.current!.add(markerGroup);

      // Removed connection lines for cleaner appearance
    });

    // Relay markers created successfully
  }, [relayLocations, sceneReady]);



  return (
    <div className="relative w-full h-screen">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-20 right-6 z-20 bg-black/50 backdrop-blur-sm rounded-lg p-3">
          <div className="flex items-center space-x-2 text-white">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span className="text-sm">Loading relay data...</span>
          </div>
        </div>
      )}

      {/* Controls and Info */}
      <div className="absolute top-20 right-6 z-20 space-y-3">
        {relayLocations && (
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
            <div className="text-white text-sm space-y-1">
              <div>
                <span className="font-semibold">{totalCount}</span> relays loaded
              </div>
            </div>
          </div>
        )}

        <RelayInfoModal
          relays={relayLocations || []}
          isLoading={isLoading}
        />
      </div>

      {/* Three.js mount point */}
      <div ref={mountRef} className="w-full h-full relative z-0" />

      {/* Relay Notes Panel */}
      {openRelay && (
        <div ref={relayPanelContainerRef}>
          <RelayNotesPanel
            ref={relayPanelRef}
            relay={openRelay}
            side={relaySide}
            onClose={closeRelayPanel}
            onMouseEnter={() => isMouseOverRelayPanel.current = true}
            onMouseLeave={() => isMouseOverRelayPanel.current = false}
          />
        </div>
      )}

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
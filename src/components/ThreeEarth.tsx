import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { useRelayLocations } from '@/hooks/useRelayLocations';

import { RelayNotesPanel } from './RelayNotesPanel';
import { useAutoPilot } from '@/hooks/useAutoPilot';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
import type { NostrEvent } from '@nostrify/nostrify';

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

export interface AutoPilotControls {
  rotateEarthToRelay: (relayUrl: string) => Promise<void>;
  openRelayPanel: (relayUrl: string) => Promise<void>;
  closeRelayPanel: () => Promise<void>;
  scrollToEvent: (eventIndex: number) => Promise<void>;
  getCurrentEvents: () => NostrEvent[] | null;
  isPanelOpen: () => boolean;
  areEventsLoaded: () => boolean;
}

export interface ThreeEarthRef {
  getAutoPilotControls: () => AutoPilotControls;
}

export const ThreeEarth = forwardRef<ThreeEarthRef>((props, ref) => {
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

  // Track relay panel element for bounds checking and auto pilot
  const relayPanelRef = useRef<{
    element?: HTMLElement | null;
    scrollableRef?: React.RefObject<HTMLDivElement>;
  } | null>(null);

  // Track whether wheel events should be enabled
  const wheelEventsEnabled = useRef(true);

  // Store the wheel event handler for removal
  const wheelEventHandlerRef = useRef<((event: WheelEvent) => void) | null>(null);

  // Store other event handlers for cleanup
  const mouseDownHandlerRef = useRef<((event: MouseEvent) => void) | null>(null);
  const mouseMoveHandlerRef = useRef<((event: MouseEvent) => void) | null>(null);
  const mouseUpHandlerRef = useRef<((event: MouseEvent) => void) | null>(null);
  const mouseClickHandlerRef = useRef<((event: MouseEvent) => void) | null>(null);
  const resizeHandlerRef = useRef<((event: Event) => void) | null>(null);

  // Track clicks outside the relay panel
  const relayPanelContainerRef = useRef<HTMLDivElement>(null);

  // Store star layer references for animation
  const starLayersRef = useRef<any>(null);

  // Store connection line reference for relay panel
  const connectionLineRef = useRef<THREE.Line | null>(null);

  // Function to check if mouse coordinates are within relay panel bounds
  const isMouseOverRelayPanelBounds = (x: number, y: number) => {
    if (!relayPanelRef.current?.element || !openRelayRef.current) return false;

    const rect = relayPanelRef.current.element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  // Function to open relay panel and determine side
  const openRelayPanelInternal = (relay: RelayLocation, camera: THREE.PerspectiveCamera) => {
    setOpenRelay(relay);

    // Clear hover state when opening relay panel
    setHoveredRelay(null);
    setTooltipPosition(null);

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
  const closeRelayPanelInternal = () => {
    setOpenRelay(null);
    setHoveredRelay(null); // Clear the hovered relay to remove tooltip
    setTooltipPosition(null); // Clear tooltip position
    isMouseOverRelayPanel.current = false; // Reset mouse over state when panel closes
    relayPanelRef.current = null; // Clear the panel ref
    wheelEventsEnabled.current = true; // Re-enable wheel events when panel closes

    // Remove connection line
    removeConnectionLine();

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

  // Auto pilot integration
  const { stopAutoPilot } = useAutoPilotContext();

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
      if (openRelayRef.current) return;

      setManualMode();
      isMouseDown.current = true;
      previousMouse.current = { x: event.clientX, y: event.clientY };
      dragStartPosition.current = { x: event.clientX, y: event.clientY };
      isDragging.current = false; // Don't set to true immediately
    };

    const onMouseMove = (event: MouseEvent) => {
      // Don't process globe events when relay panel is open
      if (openRelayRef.current) return;

      // Handle dragging
      if (isMouseDown.current) {
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
        return;
      }

      // Handle hover detection (only when not dragging)
      if (!relayMarkersRef.current || !cameraRef.current || !rendererRef.current) return;

      // Calculate mouse position in normalized device coordinates
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast to find intersected objects
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

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
          setHoveredRelay(null);
          setTooltipPosition(null);
        }
      } else {
        setHoveredRelay(null);
        setTooltipPosition(null);
      }
    };

    const onMouseUp = () => {
      isMouseDown.current = false;
      isDragging.current = false;
    };

    const onMouseClick = (event: MouseEvent) => {
      // Don't process globe events when relay panel is open
      if (openRelayRef.current) return;

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
            // Only open relay panel, don't set hover state (that's for mouse hover only)
            openRelayPanelInternal(relayData, camera);
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
      if (!wheelEventsEnabled.current || openRelayRef.current) {
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
      camera.position.z = Math.max(3, Math.min(15, newZ)); // Allow closer zoom and farther out view
    };

    // Store event handlers in refs and add listeners
    mouseDownHandlerRef.current = onMouseDown;
    mouseMoveHandlerRef.current = onMouseMove;
    mouseUpHandlerRef.current = onMouseUp;
    mouseClickHandlerRef.current = onMouseClick;

    renderer.domElement.addEventListener('mousedown', mouseDownHandlerRef.current);
    renderer.domElement.addEventListener('mousemove', mouseMoveHandlerRef.current);
    renderer.domElement.addEventListener('mouseup', mouseUpHandlerRef.current);
    renderer.domElement.addEventListener('click', mouseClickHandlerRef.current);

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

    resizeHandlerRef.current = handleResize;
    window.addEventListener('resize', resizeHandlerRef.current);

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

      // Clean up event listeners properly with stored references
      if (rendererRef.current && rendererRef.current.domElement) {
        const element = rendererRef.current.domElement;
        // Remove event listeners using stored refs
        if (mouseDownHandlerRef.current) {
          element.removeEventListener('mousedown', mouseDownHandlerRef.current);
        }
        if (mouseMoveHandlerRef.current) {
          element.removeEventListener('mousemove', mouseMoveHandlerRef.current);
        }
        if (mouseUpHandlerRef.current) {
          element.removeEventListener('mouseup', mouseUpHandlerRef.current);
        }
        if (mouseClickHandlerRef.current) {
          element.removeEventListener('click', mouseClickHandlerRef.current);
        }
      }

      // Remove document wheel event
      if (wheelEventHandlerRef.current) {
        document.removeEventListener('wheel', wheelEventHandlerRef.current);
      }

      // Remove resize listener
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
      }

      // Clean up timers
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }

      // Clean up DOM
      if (mountRef.current && rendererRef.current?.domElement) {
        try {
          mountRef.current.removeChild(rendererRef.current.domElement);
        } catch (error) {
          // Element might already be removed
        }
      }

      // Dispose renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Ensure auto mode is properly initialized
  useEffect(() => {
    isAutoMode.current = true;
  }, []);

  // Auto pilot integration
  const [notes, setNotes] = useState<NostrEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  // Auto pilot controls implementation
  const rotateEarthToRelay = useCallback(async (relayUrl: string) => {
    if (!relayLocations || !earthRef.current || !cameraRef.current || !sceneRef.current) {
      throw new Error('Earth or camera not ready');
    }

    const relay = relayLocations.find(r => r.url === relayUrl);
    if (!relay) {
      console.error(`❌ Relay not found in relay locations: ${relayUrl}`);
      console.error(`🔍 Available relay URLs:`, relayLocations.map(r => r.url).slice(0, 5));
      throw new Error(`Relay not found: ${relayUrl}`);
    }

    console.log(`🌍 Rotating earth to relay: ${relayUrl} at ${relay.lat}, ${relay.lng}`);

    return new Promise<void>((resolve) => {
      // Convert relay coordinates to 3D position on unit sphere
      const latRad = relay.lat * (Math.PI / 180);
      const lngRad = relay.lng * (Math.PI / 180);

      // Calculate 3D position of relay on earth surface
      const earthRadius = 2.05;
      const relayX = earthRadius * Math.cos(latRad) * Math.cos(lngRad);
      const relayY = earthRadius * Math.sin(latRad);
      const relayZ = earthRadius * Math.cos(latRad) * Math.sin(lngRad);

      // Calculate target earth rotations to bring relay to front
      // We want the relay to be at the front-right of the earth when viewed from camera
      const targetRotationY = -lngRad + Math.PI / 2; // Adjust for Three.js coordinate system
      const targetRotationX = -latRad;  // Rotate latitude to center

      // Calculate camera position to view the relay from optimal angle
      // Camera should be positioned to see the relay clearly
      const cameraDistance = 6;
      const cameraAngle = Math.PI / 6; // 30 degrees elevation
      const targetCameraX = Math.sin(lngRad) * cameraDistance * Math.cos(cameraAngle);
      const targetCameraY = cameraDistance * Math.sin(cameraAngle);
      const targetCameraZ = Math.cos(lngRad) * cameraDistance * Math.cos(cameraAngle);

      console.log(`🎯 Relay 3D position: X=${relayX.toFixed(2)}, Y=${relayY.toFixed(2)}, Z=${relayZ.toFixed(2)}`);

      console.log(`🎯 Target rotations: Y=${targetRotationY.toFixed(2)}, X=${targetRotationX.toFixed(2)}`);
      console.log(`🎯 Target camera: X=${targetCameraX.toFixed(2)}, Y=${targetCameraY.toFixed(2)}, Z=${targetCameraZ.toFixed(2)}`);

      // Current state
      const startRotationY = earthRef.current.rotation.y;
      const startRotationX = earthRef.current.rotation.x;
      const startCameraX = cameraRef.current.position.x;
      const startCameraY = cameraRef.current.position.y;
      const startCameraZ = cameraRef.current.position.z;

      const animationDuration = 2000; // 2 seconds
      const startTime = Date.now();

      const animateRotation = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        // Easing function for smooth animation
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        if (earthRef.current && cameraRef.current) {
          // Rotate earth to bring relay to front
          earthRef.current.rotation.y = startRotationY + (targetRotationY - startRotationY) * easeProgress;
          earthRef.current.rotation.x = startRotationX + (targetRotationX - startRotationX) * easeProgress;

          // Move camera to viewing position
          cameraRef.current.position.x = startCameraX + (targetCameraX - startCameraX) * easeProgress;
          cameraRef.current.position.y = startCameraY + (targetCameraY - startCameraY) * easeProgress;
          cameraRef.current.position.z = startCameraZ + (targetCameraZ - startCameraZ) * easeProgress;

          // Always make camera look at earth center
          cameraRef.current.lookAt(0, 0, 0);

          // Debug logging
          if (progress === 1) {
            console.log(`✅ Final earth rotation: Y=${earthRef.current.rotation.y.toFixed(2)}, X=${earthRef.current.rotation.x.toFixed(2)}`);
            console.log(`✅ Final camera position: X=${cameraRef.current.position.x.toFixed(2)}, Y=${cameraRef.current.position.y.toFixed(2)}, Z=${cameraRef.current.position.z.toFixed(2)}`);
          }
        }

        if (progress < 1) {
          requestAnimationFrame(animateRotation);
        } else {
          resolve();
        }
      };

      animateRotation();
    });
  }, [relayLocations]);

  const openRelayPanelForAutoPilot = useCallback(async (relayUrl: string) => {
    if (!relayLocations || !cameraRef.current) {
      throw new Error('Relay locations or camera not ready');
    }

    const relay = relayLocations.find(r => r.url === relayUrl);
    if (!relay) {
      throw new Error(`Relay not found: ${relayUrl}`);
    }

    console.log(`📂 Opening relay panel for: ${relayUrl}`);

    // Set events as not loaded initially
    setEventsLoaded(false);
    setNotes([]);

    // Open the relay panel using existing function
    openRelayPanelInternal(relay, cameraRef.current);

    // Create connection line from relay to panel
    createConnectionLine(relay);

    // Wait for panel to open and events to load using a more reliable approach
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('⏰ Relay panel loading timeout - proceeding anyway');
        resolve(); // Don't fail, just proceed
      }, 10000); // 10 second timeout

      const checkInterval = setInterval(() => {
        // Check if events are loaded by looking at the actual panel state
        const panelElement = document.querySelector('[data-relay-panel]');
        const hasContent = panelElement && panelElement.querySelector('[data-note-card]');

        if (hasContent || panelElement?.querySelector('.text-red-400')) {
          // Either has notes or shows an error - either way, it's loaded
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Cleanup on unmount
      return () => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
      };
    });
  }, [relayLocations]);

  const closeRelayPanel = useCallback(async () => {
    console.log('📂 Closing relay panel');
    closeRelayPanelInternal();
    setNotes([]);
    setEventsLoaded(false);

    // Stop auto pilot mode when user manually closes panel
    if (stopAutoPilot) {
      console.log('🛑 Stopping auto pilot mode due to manual panel close');
      stopAutoPilot();
    }
  }, [stopAutoPilot]);

  const scrollToEvent = useCallback(async (eventIndex: number) => {
    if (!relayPanelRef.current?.scrollableRef?.current) {
      console.warn('Scrollable ref not available');
      return;
    }

    const scrollableElement = relayPanelRef.current.scrollableRef.current;
    const eventElements = scrollableElement.querySelectorAll('[data-note-card]');

    if (eventIndex < eventElements.length) {
      const eventElement = eventElements[eventIndex] as HTMLElement;
      eventElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      console.log(`📜 Scrolled to event ${eventIndex}`);
    }
  }, []);

  const getCurrentEvents = useCallback(() => {
    return notes.length > 0 ? notes : null;
  }, [notes]);

  const isPanelOpen = useCallback(() => {
    return openRelay !== null;
  }, [openRelay]);

  const areEventsLoaded = useCallback(() => {
    return eventsLoaded;
  }, [eventsLoaded]);

  // Expose auto pilot controls
  useImperativeHandle(ref, () => ({
    getAutoPilotControls: () => ({
      rotateEarthToRelay,
      openRelayPanel: openRelayPanelForAutoPilot,
      closeRelayPanel,
      scrollToEvent,
      getCurrentEvents,
      isPanelOpen,
      areEventsLoaded,
    }),
  }));

  // Initialize auto pilot hook
  const autoPilotControls = {
    rotateEarthToRelay,
    openRelayPanel: openRelayPanelForAutoPilot,
    closeRelayPanel,
    scrollToEvent,
    getCurrentEvents,
    isPanelOpen,
    areEventsLoaded,
  };

  useAutoPilot(autoPilotControls);

  // Create connection line from relay to panel
  const createConnectionLine = useCallback((relay: RelayLocation) => {
    if (!sceneRef.current || !earthRef.current || !relayPanelRef.current?.element) {
      return;
    }

    // Remove any existing connection line
    if (connectionLineRef.current) {
      sceneRef.current.remove(connectionLineRef.current);
      connectionLineRef.current = null;
    }

    // Convert relay coordinates to 3D position
    const latRad = relay.lat * (Math.PI / 180);
    const lngRad = relay.lng * (Math.PI / 180);
    const earthRadius = 2.05;

    const relayX = earthRadius * Math.cos(latRad) * Math.cos(lngRad);
    const relayY = earthRadius * Math.sin(latRad);
    const relayZ = earthRadius * Math.cos(latRad) * Math.sin(lngRad);

    // Transform relay position by earth rotation
    const relayWorldPos = new THREE.Vector3(relayX, relayY, relayZ);
    relayWorldPos.applyMatrix4(earthRef.current.matrixWorld);

    // Get panel position (convert screen coordinates to 3D world coordinates)
    const panelRect = relayPanelRef.current.element.getBoundingClientRect();
    const panelScreenX = (panelRect.left / window.innerWidth) * 2 - 1;
    const panelScreenY = -(panelRect.top / window.innerHeight) * 2 + 1;

    // Project panel screen position to 3D world space
    const panelWorldPos = new THREE.Vector3(panelScreenX, panelScreenY, 0.5);
    panelWorldPos.unproject(cameraRef.current!);

    // Create line geometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      relayWorldPos,
      panelWorldPos
    ]);

    // Create line material
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6,
      linewidth: 2
    });

    // Create line
    const line = new THREE.Line(lineGeometry, lineMaterial);
    connectionLineRef.current = line;
    sceneRef.current.add(line);

    console.log('🔗 Connection line created from relay to panel');
  }, []);

  // Remove connection line when panel closes
  const removeConnectionLine = useCallback(() => {
    if (connectionLineRef.current && sceneRef.current) {
      sceneRef.current.remove(connectionLineRef.current);
      connectionLineRef.current = null;
      console.log('🔗 Connection line removed');
    }
  }, []);

  // Add click-outside-to-close functionality
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only close if relay panel is open
      if (!openRelay) return;

      // Check if click is outside the relay panel
      if (relayPanelContainerRef.current && !relayPanelContainerRef.current.contains(event.target as Node)) {
        closeRelayPanelInternal();
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



  // Combined useEffect for marker creation and zoom updates
  useEffect(() => {
    if (!relayLocations || !relayMarkersRef.current || !sceneReady || !cameraRef.current) {
      return;
    }

    const updateAllMarkers = () => {
      const cameraDistance = cameraRef.current!.position.z;
      console.log('updateAllMarkers called - cameraDistance:', cameraDistance);

      // Clear existing markers
      while (relayMarkersRef.current.children.length > 0) {
        relayMarkersRef.current.remove(relayMarkersRef.current.children[0]);
      }

      // Cluster relays based on zoom level
      const clusteredRelays = clusterRelays(relayLocations, cameraDistance);

      // Add relay markers with smart clustering
      clusteredRelays.forEach((relay, index) => {
        // Calculate marker size inversely based on camera zoom level
        const baseSize = 0.005; // Much smaller base size (reduced from 0.008)
        // Stronger inverse relationship: much smaller when zoomed in
        const zoomFactor = Math.max(0.3, Math.min(3.0, cameraDistance / 3));
        const markerSize = baseSize * zoomFactor;

        const radius = 2.05; // Slightly above Earth surface

        // Convert geographic coordinates to 3D Cartesian coordinates
        const latRad = relay.lat * (Math.PI / 180);
        const lngRad = -relay.lng * (Math.PI / 180); // Invert longitude for correct direction

        // Standard conversion with inverted longitude
        const x = radius * Math.cos(latRad) * Math.cos(lngRad);
        const y = radius * Math.sin(latRad);
        const z = radius * Math.cos(latRad) * Math.sin(lngRad);

        // Create marker group for easier management
        const markerGroup = new THREE.Group();

        // Main marker - size varies with zoom level
        const markerGeometry = new THREE.SphereGeometry(markerSize, 16, 12);
        const markerColor = getRandomRelayColor(); // Random orange or purple shade
        const markerMaterial = new THREE.MeshBasicMaterial({
          color: markerColor,
          transparent: false
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);

        // Store relay data for tooltip
        (marker as any).relayData = relay;
        (markerGroup as any).relayData = relay;

        markerGroup.add(marker);

        // Create subtle outer ring for elegance, size varies with zoom level
        const ringInnerRadius = markerSize * 1.8;
        const ringOuterRadius = markerSize * 2.8;
        const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 16);

        // Create lighter version of marker color for ring
        const ringColor = new THREE.Color(markerColor);
        ringColor.offsetHSL(0, 0, 0.3); // Lighten by 30%

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

        // Create tiny inner pulse point, size varies with zoom level
        const pulseSize = markerSize * 0.5;
        const pulseGeometry = new THREE.SphereGeometry(pulseSize, 6, 4);
        const pulseMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.7
        });
        const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
        markerGroup.add(pulse);

        // Position entire group - on Earth surface, tiny altitude only for clustering
        const altitudeOffset = relay.altitudeOffset || 0;

        // For single relays (no clustering), keep exactly on Earth surface
        // For clustered relays, add tiny altitude offset just to separate them
        const earthRadius = 2.05;

        if (relay.clusterSize && relay.clusterSize > 1) {
          // Only clustered markers get tiny altitude offset
          const normalVector = new THREE.Vector3(x, y, z).normalize();
          const altitudePosition = normalVector.multiplyScalar(earthRadius + altitudeOffset);
          markerGroup.position.copy(altitudePosition);
        } else {
          // Single relays stay exactly on Earth surface
          const normalVector = new THREE.Vector3(x, y, z).normalize();
          const surfacePosition = normalVector.multiplyScalar(earthRadius);
          markerGroup.position.copy(surfacePosition);
        }

        relayMarkersRef.current!.add(markerGroup);
      });

      console.log('Created', clusteredRelays.length, 'markers with clustering');
    };

    // Update markers initially
    updateAllMarkers();

    // Set up a listener for zoom changes (using requestAnimationFrame for performance)
    let lastDistance = cameraRef.current.position.z;
    const checkZoomChange = () => {
      const currentDistance = cameraRef.current!.position.z;
      if (Math.abs(currentDistance - lastDistance) > 0.1) {
        updateAllMarkers();
        lastDistance = currentDistance;
      }
      requestAnimationFrame(checkZoomChange);
    };

    const animationId = requestAnimationFrame(checkZoomChange);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [relayLocations, sceneReady]);

  // Function to generate random shade of orange or purple for relays
  const getRandomRelayColor = (): number => {
    // Choose between orange and purple color families
    const colorFamily = Math.random() < 0.5 ? 'orange' : 'purple';

    if (colorFamily === 'orange') {
      // Generate random orange shade (warm oranges to deep oranges)
      const hue = 15 + Math.random() * 30; // 15-45 degrees (orange range)
      const saturation = 70 + Math.random() * 30; // 70-100% saturation
      const lightness = 45 + Math.random() * 20; // 45-65% lightness
      return hslToHex(hue, saturation, lightness);
    } else {
      // Generate random purple shade (light purples to deep purples)
      const hue = 270 + Math.random() * 60; // 270-330 degrees (purple range)
      const saturation = 65 + Math.random() * 35; // 65-100% saturation
      const lightness = 40 + Math.random() * 25; // 40-65% lightness
      return hslToHex(hue, saturation, lightness);
    }
  };

  // Helper function to convert HSL to Hex
  const hslToHex = (h: number, s: number, l: number): number => {
    h /= 360;
    s /= 100;
    l /= 100;

    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = (x: number): string => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return parseInt(`0x${toHex(r)}${toHex(g)}${toHex(b)}`, 16);
  };

  // Function to calculate distance between two geographic points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Function to detect and cluster relays (only when zoomed in)
  const clusterRelays = (locations: typeof relayLocations, cameraDistance: number) => {
    console.log('clusterRelays called with cameraDistance:', cameraDistance, 'locations count:', locations?.length);

    if (!locations) return [];

    // Only cluster when significantly zoomed in (cameraDistance < 4)
    if (cameraDistance >= 4) {
      console.log('No clustering - camera distance >= 4');
      // Don't cluster when zoomed out - return normal markers with no z-offset
      return locations.map(relay => ({ ...relay, clusterIndex: 0, clusterSize: 1, zOffset: 0 }));
    }

    console.log('Applying clustering - camera distance < 4');

    // Calculate cluster threshold based on zoom level
    let clusterThreshold = 50; // Default threshold for zoomed in

    if (cameraDistance < 3.2) {
      clusterThreshold = 20; // Very aggressive clustering when extremely zoomed in (20km)
    } else {
      clusterThreshold = 35; // Aggressive clustering when zoomed in (35km)
    }

    const processed = [...locations];
    const used = new Set<number>();
    const clusters: typeof locations[][] = [];

    for (let i = 0; i < processed.length; i++) {
      if (used.has(i)) continue;

      const cluster = [processed[i]];
      used.add(i);

      for (let j = i + 1; j < processed.length; j++) {
        if (used.has(j)) continue;

        const distance = calculateDistance(
          processed[i].lat, processed[i].lng,
          processed[j].lat, processed[j].lng
        );

        if (distance < clusterThreshold) {
          cluster.push(processed[j]);
          used.add(j);
        }
      }

      clusters.push(cluster);
    }

    // Apply z-axis offsets to clustered markers
    return clusters.flatMap((cluster, clusterIndex) => {
      if (cluster.length === 1) {
        return [{ ...cluster[0], clusterIndex: 0, clusterSize: 1, zOffset: 0 }];
      }

      return cluster.map((relay, markerIndex) => ({
        ...relay,
        clusterIndex: markerIndex,
        clusterSize: cluster.length,
        altitudeOffset: markerIndex * 0.02 // Tiny altitude offset - just enough to separate
      }));
    });
  };

  // Update relay markers when data changes and scene is ready
  useEffect(() => {
    if (!relayLocations || !relayMarkersRef.current || !sceneReady || !cameraRef.current) {
      return;
    }

    // Clear existing markers
    while (relayMarkersRef.current.children.length > 0) {
      relayMarkersRef.current.remove(relayMarkersRef.current.children[0]);
    }

    // Cluster relays based on zoom level
    const cameraDistance = cameraRef.current.position.z;
    const clusteredRelays = clusterRelays(relayLocations, cameraDistance);

    // Add relay markers with smart clustering
    clusteredRelays.forEach((relay, index) => {
      // Calculate marker size inversely based on camera zoom level
      const cameraDistance = cameraRef.current?.position.z || 6;
      const baseSize = 0.005; // Much smaller base size (reduced from 0.008)
      // Stronger inverse relationship: much smaller when zoomed in
      const zoomFactor = Math.max(0.3, Math.min(3.0, cameraDistance / 3));
      const markerSize = baseSize * zoomFactor;

      const radius = 2.05; // Slightly above Earth surface

      // Convert geographic coordinates to 3D Cartesian coordinates
      // Geographic: latitude (-90 to +90), longitude (-180 to +180)
      // Three.js: Y up, X right, Z towards viewer

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

      // Main marker - size varies with zoom level
      const markerGeometry = new THREE.SphereGeometry(markerSize, 16, 12);
      const markerColor = getRandomRelayColor(); // Random orange or purple shade
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: markerColor,
        transparent: false
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);

      // Store relay data for tooltip
      (marker as any).relayData = relay;
      (markerGroup as any).relayData = relay;

      markerGroup.add(marker);

      // Create subtle outer ring for elegance, size varies with zoom level
      const ringInnerRadius = markerSize * 1.8;
      const ringOuterRadius = markerSize * 2.8;
      const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 16);

      // Create lighter version of marker color for ring
      const ringColor = new THREE.Color(markerColor);
      ringColor.offsetHSL(0, 0, 0.3); // Lighten by 30%

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

      // Create tiny inner pulse point, size varies with zoom level
      const pulseSize = markerSize * 0.6;
      const pulseGeometry = new THREE.SphereGeometry(pulseSize, 6, 4);
      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7
      });
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      markerGroup.add(pulse);

      // Position the entire group with z-axis offset for clustering
      const zOffset = relay.zOffset || 0;
      markerGroup.position.set(x, y, z + zOffset);

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



      {/* Three.js mount point */}
      <div ref={mountRef} className="w-full h-full relative z-0" />

      {/* Relay Notes Panel */}
      {openRelay && (
        <div ref={relayPanelContainerRef}>
          <RelayNotesPanel
            ref={(element) => {
              if (relayPanelRef.current) {
                relayPanelRef.current.element = element;
              }
            }}
            relay={openRelay}
            side={relaySide}
            onClose={closeRelayPanelInternal}
            onMouseEnter={() => isMouseOverRelayPanel.current = true}
            onMouseLeave={() => isMouseOverRelayPanel.current = false}
            onMouseDown={() => {}}
            onEventsChange={(events, loaded) => {
              if (events) {
                setNotes(events);
              }
              setEventsLoaded(loaded);
            }}
            forwardScrollableRef={relayPanelRef}
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
          <div className="text-xs text-gray-300">
            {hoveredRelay.url.replace('wss://', '').replace('ws://', '')}
          </div>
          <div className="text-sm font-semibold mt-1">
            {hoveredRelay.country || 'Unknown Location'}
          </div>
          {hoveredRelay.lat && hoveredRelay.lng && (
            <div className="text-xs text-gray-400 mt-1">
              {hoveredRelay.lat.toFixed(2)}°, {hoveredRelay.lng.toFixed(2)}°
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ThreeEarth.displayName = 'ThreeEarth';
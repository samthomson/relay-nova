import { useEffect, useRef, useCallback } from 'react';
import { useRelayLocations } from './useRelayLocations';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
import type { NostrEvent } from '@nostrify/nostrify';

interface AutoPilotControls {
  rotateEarthToRelay: (relayUrl: string) => Promise<void>;
  openRelayPanel: (relayUrl: string) => Promise<void>;
  closeRelayPanel: () => Promise<void>;
  scrollToEvent: (eventIndex: number) => Promise<void>;
  getCurrentEvents: () => NostrEvent[] | null;
  isPanelOpen: () => boolean;
  areEventsLoaded: () => boolean;
  updateCountdown: (secondsLeft: number) => void;
}

export function useAutoPilot(controls: AutoPilotControls) {
  const { data: relayLocations } = useRelayLocations();
  const {
    isAutoPilotMode,
    isAutoPilotActive,
    stopAutoPilot,
    currentRelayIndex,
    setCurrentRelayIndex,
    setTotalRelays,
  } = useAutoPilotContext();

  // Use refs to track current state and avoid circular dependencies
  const isAutoPilotModeRef = useRef(isAutoPilotMode);
  const isAutoPilotActiveRef = useRef(isAutoPilotActive);
  const currentRelayIndexRef = useRef(currentRelayIndex);

  // Update refs when state changes
  useEffect(() => {
    isAutoPilotModeRef.current = isAutoPilotMode;
    isAutoPilotActiveRef.current = isAutoPilotActive;
    currentRelayIndexRef.current = currentRelayIndex;
  }, [isAutoPilotMode, isAutoPilotActive, currentRelayIndex]);

  // Simple execution state
  const isRunningRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const relayOrderRef = useRef<string[]>([]);

  // Generate random order of relays
  const generateRandomRelayOrder = useCallback(() => {
    if (!relayLocations || relayLocations.length === 0) return [];

    const shuffled = [...relayLocations].sort(() => Math.random() - 0.5);
    const urlOrder = shuffled.map(relay => relay.url);
    console.log('🎲 Generated random relay order:', urlOrder.slice(0, 5), `(${urlOrder.length} total)`);
    return urlOrder;
  }, [relayLocations]);

  // Completely abort current execution and clean up
  const abortCurrentExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    isRunningRef.current = false;

    console.log('🧹 Aborted and cleaned up current autopilot execution');
  }, []);

  // Auto pilot sequence runner - simple and clean
  const runAutoPilotSequence = useCallback(async () => {
    // Prevent multiple simultaneous executions
    if (isRunningRef.current) {
      console.log('🔄 Auto pilot already running, aborting existing execution...');
      abortCurrentExecution();
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check if autopilot is still active using refs
    if (!isAutoPilotModeRef.current || !isAutoPilotActiveRef.current) {
      console.log('🛑 Auto pilot not active, stopping execution');
      return;
    }

    // Initialize relay order if needed
    if (relayOrderRef.current.length === 0) {
      const newOrder = generateRandomRelayOrder();
      if (newOrder.length === 0) {
        console.error('❌ No relays available for auto pilot');
        stopAutoPilot();
        return;
      }
      relayOrderRef.current = newOrder;
      setTotalRelays(newOrder.length);
    }

    const relayUrl = relayOrderRef.current[currentRelayIndexRef.current];
    if (!relayUrl) {
      console.error('❌ No relay URL found at index:', currentRelayIndexRef.current);
      return;
    }

    // Set execution state
    isRunningRef.current = true;
    abortControllerRef.current = new AbortController();

    console.log(`🛩️ Auto pilot: Processing relay ${currentRelayIndexRef.current + 1}/${relayOrderRef.current.length}: ${relayUrl}`);

    try {
      const signal = abortControllerRef.current.signal;

      // Step 1: Rotate earth to relay (750ms)
      console.log(`🔄 Auto pilot: Rotating earth to relay...`);
      await controls.rotateEarthToRelay(relayUrl);

      if (signal.aborted) return;
      console.log(`✅ Auto pilot: Earth rotated`);

      // Step 2: Open relay panel
      console.log(`📂 Auto pilot: Opening relay panel...`);
      await controls.openRelayPanel(relayUrl);

      if (signal.aborted) return;
      console.log(`✅ Auto pilot: Relay panel opened`);

      // Step 3: Wait for events to load (with proper timeout)
      console.log(`⏳ Auto pilot: Waiting for events to load...`);
      const eventsLoaded = await waitForEventsToLoad(signal);

      if (signal.aborted) return;

      if (!eventsLoaded) {
        console.log(`⏰ Auto pilot: Events loading failed, moving to next relay`);
        scheduleNextRelay();
        return;
      }
      console.log(`✅ Auto pilot: Events loaded`);

      // Step 4: Display relay for exactly 15 seconds (with scrolling if events exist)
      console.log(`📜 Auto pilot: Starting 15-second display period...`);
      await displayRelayFor15Seconds(signal);

      if (signal.aborted) return;
      console.log(`✅ Auto pilot: Finished 15-second display period`);

      // Step 5: Move to next relay
      await scheduleNextRelay();

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`⏹️ Auto pilot sequence aborted`);
        return;
      }
      console.error(`❌ Auto pilot error:`, error);
      scheduleNextRelay();
    } finally {
      isRunningRef.current = false;
    }
  }, [controls, generateRandomRelayOrder, setTotalRelays, stopAutoPilot, abortCurrentExecution]);

  // Wait for events to load with proper signal handling
  const waitForEventsToLoad = useCallback(async (signal: AbortSignal): Promise<boolean> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`⏰ Events loading timeout (5 seconds)`);
        resolve(false);
      }, 5000);

      const checkInterval = setInterval(() => {
        if (signal.aborted) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        if (controls.areEventsLoaded()) {
          console.log(`✅ Events loaded successfully`);
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 200); // Check every 200ms

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        resolve(false);
      });
    });
  }, [controls]);

  // Display relay for exactly 15 seconds (with scrolling if events exist)
  const displayRelayFor15Seconds = useCallback(async (signal: AbortSignal): Promise<void> => {
    return new Promise((resolve) => {
      console.log(`📜 Starting 15-second display period...`);

      const events = controls.getCurrentEvents();
      const startTime = Date.now();
      const totalTime = 15000; // 15 seconds in milliseconds
      let scrollInterval: NodeJS.Timeout | null = null;

      if (events && events.length > 0) {
        console.log(`📜 Scrolling through ${events.length} events during 15-second period`);

        let currentEventIndex = 0;

        // Scroll to next event every 3 seconds (much slower)
        scrollInterval = setInterval(() => {
          if (signal.aborted) {
            if (scrollInterval) clearInterval(scrollInterval);
            resolve();
            return;
          }

          // Scroll to current event
          controls.scrollToEvent(currentEventIndex);
          console.log(`📜 Scrolled to event ${currentEventIndex}`);

          // Move to next event
          currentEventIndex = (currentEventIndex + 1) % events.length;
        }, 3000);
      } else {
        console.log(`📜 No events to scroll through - displaying empty relay for 15 seconds`);
      }

      // Update countdown every 100ms for smooth display
      const countdownInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalTime - elapsed);
        const secondsLeft = Math.ceil(remaining / 1000);

        // Update countdown display
        controls.updateCountdown(secondsLeft);

        if (remaining <= 0) {
          clearInterval(countdownInterval);
        }
      }, 100);

      // Always wait exactly 15 seconds regardless of events
      const fifteenSecondTimeout = setTimeout(() => {
        if (scrollInterval) {
          clearInterval(scrollInterval);
        }
        clearInterval(countdownInterval);

        const elapsed = Date.now() - startTime;
        console.log(`📜 Completed 15-second display period (actual: ${elapsed}ms)`);
        resolve();
      }, totalTime); // Exactly 15 seconds

      signal.addEventListener('abort', () => {
        clearTimeout(fifteenSecondTimeout);
        if (scrollInterval) {
          clearInterval(scrollInterval);
        }
        clearInterval(countdownInterval);
        resolve();
      });
    });
  }, [controls]);

  // Schedule next relay with proper cleanup
  const scheduleNextRelay = useCallback(async () => {
    console.log(`⏭️ Scheduling next relay...`);

    // Close current relay panel and wait for it to close
    if (controls.isPanelOpen()) {
      console.log(`📂 Closing current relay panel...`);
      try {
        await controls.closeRelayPanel();
        console.log(`✅ Relay panel closed`);
      } catch (error) {
        console.error(`❌ Error closing relay panel:`, error);
      }
      // Small delay to ensure panel is fully closed
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Move to next relay index
    const nextIndex = currentRelayIndexRef.current + 1;
    if (nextIndex >= relayOrderRef.current.length) {
      // Generate new random order and restart
      console.log(`🔄 Completed all relays, generating new order...`);
      const newOrder = generateRandomRelayOrder();
      relayOrderRef.current = newOrder;
      setCurrentRelayIndex(0);
      setTotalRelays(newOrder.length);
    } else {
      setCurrentRelayIndex(nextIndex);
    }

    // Wait 1 second before processing next relay (as requested)
    timeoutRef.current = setTimeout(() => {
      if (isAutoPilotModeRef.current && isAutoPilotActiveRef.current) {
        console.log(`⏰ Travel time complete, starting next sequence`);
        runAutoPilotSequence();
      } else {
        console.log(`⏹️ Travel cancelled - autopilot no longer active`);
      }
    }, 1000); // 1 second travel time as requested
  }, [controls, generateRandomRelayOrder, setCurrentRelayIndex, setTotalRelays, runAutoPilotSequence]);

  // Start autopilot when activated
  useEffect(() => {
    if (isAutoPilotModeRef.current && isAutoPilotActiveRef.current && !isRunningRef.current) {
      console.log('🚀 Starting autopilot mode');

      // Clean up any existing state
      abortCurrentExecution();

      // Reset state
      relayOrderRef.current = [];
      setCurrentRelayIndex(0);

      // Start sequence after brief delay to ensure clean state
      const startTimeout = setTimeout(() => {
        if (isAutoPilotModeRef.current && isAutoPilotActiveRef.current) {
          runAutoPilotSequence();
        }
      }, 100);

      return () => clearTimeout(startTimeout);
    }
  }, [runAutoPilotSequence, setCurrentRelayIndex, abortCurrentExecution]);

  // Cleanup when autopilot stops
  useEffect(() => {
    if (!isAutoPilotModeRef.current || !isAutoPilotActiveRef.current) {
      console.log('🛑 Cleaning up autopilot...');
      abortCurrentExecution();
      relayOrderRef.current = [];
    }

    return () => {
      // Cleanup on unmount
      abortCurrentExecution();
    };
  }, [abortCurrentExecution]);

  return {
    isAutoPilotMode,
    isAutoPilotActive,
    currentRelayIndex,
    totalRelays: relayOrderRef.current.length,
  };
}
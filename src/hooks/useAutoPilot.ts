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

  // Use refs to prevent race conditions and multiple simultaneous executions
  const isRunningRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const relayOrderRef = useRef<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate random order of relays
  const generateRandomRelayOrder = useCallback(() => {
    if (!relayLocations || relayLocations.length === 0) return [];

    const shuffled = [...relayLocations].sort(() => Math.random() - 0.5);
    const urlOrder = shuffled.map(relay => relay.url);
    console.log('🎲 Generated random relay order:', urlOrder.slice(0, 5), `(${urlOrder.length} total)`);
    return urlOrder;
  }, [relayLocations]);

  // Auto pilot sequence runner with proper error handling and state management
  const runAutoPilotSequence = useCallback(async () => {
    // Prevent multiple simultaneous executions
    if (isRunningRef.current) {
      console.log('🔄 Auto pilot already running, skipping duplicate execution');
      return;
    }

    // Check if autopilot is still active
    if (!isAutoPilotMode || !isAutoPilotActive) {
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

    const relayUrl = relayOrderRef.current[currentRelayIndex];
    if (!relayUrl) {
      console.error('❌ No relay URL found at index:', currentRelayIndex);
      return;
    }

    isRunningRef.current = true;
    console.log(`🛩️ Auto pilot: Processing relay ${currentRelayIndex + 1}/${relayOrderRef.current.length}: ${relayUrl}`);

    // Create abort controller for this sequence
    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Rotate earth to relay (750ms)
      console.log('🔄 Auto pilot: Rotating earth to relay...');
      await controls.rotateEarthToRelay(relayUrl);

      if (abortControllerRef.current.signal.aborted) return;
      console.log('✅ Auto pilot: Earth rotated');

      // Step 2: Open relay panel
      console.log('📂 Auto pilot: Opening relay panel...');
      await controls.openRelayPanel(relayUrl);

      if (abortControllerRef.current.signal.aborted) return;
      console.log('✅ Auto pilot: Relay panel opened');

      // Step 3: Wait for events to load (with proper timeout)
      console.log('⏳ Auto pilot: Waiting for events to load...');
      const eventsLoaded = await waitForEventsToLoad(abortControllerRef.current.signal);

      if (abortControllerRef.current.signal.aborted) return;

      if (!eventsLoaded) {
        console.log('⏰ Auto pilot: Events loading failed, moving to next relay');
        scheduleNextRelay();
        return;
      }
      console.log('✅ Auto pilot: Events loaded');

      // Step 4: Scroll through events for exactly 5 seconds
      console.log('📜 Auto pilot: Starting 5-second scroll through events...');
      await scrollThroughEvents(abortControllerRef.current.signal);

      if (abortControllerRef.current.signal.aborted) return;
      console.log('✅ Auto pilot: Finished scrolling');

      // Step 5: Move to next relay
      scheduleNextRelay();

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⏹️ Auto pilot sequence aborted');
        return;
      }
      console.error('❌ Auto pilot error:', error);
      scheduleNextRelay();
    } finally {
      isRunningRef.current = false;
    }
  }, [isAutoPilotMode, isAutoPilotActive, currentRelayIndex, controls, generateRandomRelayOrder, setTotalRelays, stopAutoPilot]);

  // Wait for events to load with proper signal handling
  const waitForEventsToLoad = useCallback(async (signal: AbortSignal): Promise<boolean> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⏰ Events loading timeout (5 seconds)');
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
          console.log('✅ Events loaded successfully');
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        resolve(false);
      });
    });
  }, [controls]);

  // Scroll through events for exactly 5 seconds
  const scrollThroughEvents = useCallback(async (signal: AbortSignal): Promise<void> => {
    return new Promise((resolve) => {
      const events = controls.getCurrentEvents();
      if (!events || events.length === 0) {
        console.log('📜 No events to scroll through');
        resolve();
        return;
      }

      console.log(`📜 Scrolling through ${events.length} events for 5 seconds`);

      let currentEventIndex = 0;
      let scrollCount = 0;

      // Scroll to next event every 1 second for 5 seconds total
      const scrollInterval = setInterval(() => {
        if (signal.aborted) {
          clearInterval(scrollInterval);
          resolve();
          return;
        }

        scrollCount++;

        // Scroll to current event
        controls.scrollToEvent(currentEventIndex);
        console.log(`📜 Scrolled to event ${currentEventIndex} (${scrollCount}/5)`);

        // Move to next event
        currentEventIndex = (currentEventIndex + 1) % events.length;

        // Stop after 5 seconds
        if (scrollCount >= 5) {
          clearInterval(scrollInterval);
          console.log('📜 Completed 5-second scroll period');
          resolve();
        }
      }, 1000);

      signal.addEventListener('abort', () => {
        clearInterval(scrollInterval);
        resolve();
      });
    });
  }, [controls]);

  // Schedule next relay with proper cleanup
  const scheduleNextRelay = useCallback(() => {
    console.log('⏭️ Scheduling next relay...');

    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Close current relay panel
    if (controls.isPanelOpen()) {
      controls.closeRelayPanel().catch(error => {
        console.error('❌ Error closing relay panel:', error);
      });
    }

    // Move to next relay index
    const nextIndex = currentRelayIndex + 1;
    if (nextIndex >= relayOrderRef.current.length) {
      // Generate new random order and restart
      console.log('🔄 Completed all relays, generating new order...');
      const newOrder = generateRandomRelayOrder();
      relayOrderRef.current = newOrder;
      setCurrentRelayIndex(0);
      setTotalRelays(newOrder.length);
    } else {
      setCurrentRelayIndex(nextIndex);
    }

    // Wait 1 second before processing next relay
    timeoutRef.current = setTimeout(() => {
      if (isAutoPilotMode && isAutoPilotActive) {
        runAutoPilotSequence();
      }
    }, 1000);
  }, [currentRelayIndex, controls, generateRandomRelayOrder, setCurrentRelayIndex, setTotalRelays, isAutoPilotMode, isAutoPilotActive, runAutoPilotSequence]);

  // Start autopilot when activated
  useEffect(() => {
    if (isAutoPilotMode && isAutoPilotActive && !isRunningRef.current) {
      console.log('🚀 Starting autopilot mode');

      // Reset state
      relayOrderRef.current = [];
      setCurrentRelayIndex(0);

      // Start sequence
      runAutoPilotSequence();
    }
  }, [isAutoPilotMode, isAutoPilotActive, runAutoPilotSequence, setCurrentRelayIndex]);

  // Cleanup when autopilot stops
  useEffect(() => {
    if (!isAutoPilotMode || !isAutoPilotActive) {
      console.log('🛑 Cleaning up autopilot...');

      // Abort current sequence
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Clear timeouts and intervals
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Reset state
      isRunningRef.current = false;
      relayOrderRef.current = [];
    }

    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isRunningRef.current = false;
    };
  }, [isAutoPilotMode, isAutoPilotActive]);

  return {
    isAutoPilotMode,
    isAutoPilotActive,
    currentRelayIndex,
    totalRelays: relayOrderRef.current.length,
  };
}
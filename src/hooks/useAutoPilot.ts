import { useEffect, useRef, useCallback, useState } from 'react';
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

  const [currentRelayOrder, setCurrentRelayOrder] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentStepRef = useRef<'idle' | 'rotating' | 'opening' | 'loading' | 'scrolling'>('idle');

  // Generate random order of relays
  const generateRandomRelayOrder = useCallback(() => {
    if (!relayLocations || relayLocations.length === 0) return [];

    const shuffled = [...relayLocations].sort(() => Math.random() - 0.5);
    const urlOrder = shuffled.map(relay => relay.url);
    console.log('🎲 Generated random relay order:', urlOrder.slice(0, 5), `(${urlOrder.length} total)`);
    return urlOrder;
  }, [relayLocations]);

  // Initialize relay order when autopilot starts
  useEffect(() => {
    if (isAutoPilotMode && isAutoPilotActive && currentRelayOrder.length === 0) {
      const newOrder = generateRandomRelayOrder();
      setCurrentRelayOrder(newOrder);
      setTotalRelays(newOrder.length);
      setCurrentRelayIndex(0);
    }
  }, [isAutoPilotMode, isAutoPilotActive, currentRelayOrder.length, generateRandomRelayOrder, setCurrentRelayIndex, setTotalRelays]);

  // Auto pilot sequence runner
  const runAutoPilotSequence = useCallback(async () => {
    if (!isAutoPilotMode || !isAutoPilotActive || currentRelayOrder.length === 0) {
      return;
    }

    const relayUrl = currentRelayOrder[currentRelayIndex];
    if (!relayUrl) {
      console.error('No relay URL found at current index:', currentRelayIndex);
      return;
    }

    console.log(`🛩️ Auto pilot: Processing relay ${currentRelayIndex + 1}/${currentRelayOrder.length}: ${relayUrl}`);

    try {
      // Step 1: Rotate earth to relay (750ms as specified)
      currentStepRef.current = 'rotating';
      console.log('🔄 Auto pilot: Rotating earth to relay...');
      await controls.rotateEarthToRelay(relayUrl);
      console.log('✅ Auto pilot: Earth rotated');

      if (!isAutoPilotMode || !isAutoPilotActive) return; // Check if stopped during rotation

      // Step 2: Open relay panel
      currentStepRef.current = 'opening';
      console.log('📂 Auto pilot: Opening relay panel...');
      await controls.openRelayPanel(relayUrl);
      console.log('✅ Auto pilot: Relay panel opened');

      if (!isAutoPilotMode || !isAutoPilotActive) return; // Check if stopped during opening

      // Step 3: Wait for events to load
      currentStepRef.current = 'loading';
      console.log('⏳ Auto pilot: Waiting for events to load...');
      const eventsLoaded = await waitForEventsToLoad();

      if (!isAutoPilotMode || !isAutoPilotActive) return; // Check if stopped during loading

      if (!eventsLoaded) {
        console.log('⏰ Auto pilot: Events loading timeout, moving to next relay');
        moveToNextRelay();
        return;
      }
      console.log('✅ Auto pilot: Events loaded');

      // Step 4: Scroll through events for 5 seconds
      currentStepRef.current = 'scrolling';
      console.log('📜 Auto pilot: Starting to scroll through events...');
      await scrollThroughEvents();

      if (!isAutoPilotMode || !isAutoPilotActive) return; // Check if stopped during scrolling

      // Step 5: Move to next relay
      console.log('⏭️ Auto pilot: Moving to next relay...');
      moveToNextRelay();

    } catch (error) {
      console.error('❌ Auto pilot error:', error);
      // Continue to next relay despite errors
      if (isAutoPilotMode && isAutoPilotActive) {
        moveToNextRelay();
      }
    }
  }, [isAutoPilotMode, isAutoPilotActive, currentRelayOrder, currentRelayIndex, controls]);

  // Wait for events to load
  const waitForEventsToLoad = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max (50 * 100ms)

      const checkInterval = setInterval(() => {
        attempts++;

        if (!isAutoPilotMode || !isAutoPilotActive) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        if (controls.areEventsLoaded()) {
          console.log('✅ Auto pilot: Events loaded successfully');
          clearInterval(checkInterval);
          resolve(true);
        } else if (attempts >= maxAttempts) {
          console.log('⏰ Auto pilot: Events loading timeout');
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);

      // Cleanup on unmount or stop
      const cleanup = () => {
        clearInterval(checkInterval);
        resolve(false);
      };

      return cleanup;
    });
  }, [isAutoPilotMode, isAutoPilotActive, controls]);

  // Scroll through events for 5 seconds
  const scrollThroughEvents = useCallback(async (): Promise<void> => {
    return new Promise((resolve) => {
      const events = controls.getCurrentEvents();
      if (!events || events.length === 0) {
        console.log('📜 Auto pilot: No events to scroll through');
        resolve();
        return;
      }

      console.log(`📜 Auto pilot: Scrolling through ${events.length} events for 5 seconds`);

      let currentEventIndex = 0;
      const scrollInterval = 1000; // Scroll to next event every 1 second
      let scrollCount = 0;
      const maxScrolls = 5; // Scroll for 5 seconds total

      const scrollToNextEvent = () => {
        if (!isAutoPilotMode || !isAutoPilotActive) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          resolve();
          return;
        }

        if (scrollCount >= maxScrolls) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          console.log('📜 Auto pilot: Finished scrolling through events');
          resolve();
          return;
        }

        // Scroll to current event
        controls.scrollToEvent(currentEventIndex);
        currentEventIndex = (currentEventIndex + 1) % events.length;
        scrollCount++;
      };

      // Start scrolling immediately
      scrollToNextEvent();

      // Continue scrolling every second
      intervalRef.current = setInterval(scrollToNextEvent, scrollInterval);
    });
  }, [isAutoPilotMode, isAutoPilotActive, controls]);

  // Move to next relay
  const moveToNextRelay = useCallback(() => {
    console.log('⏭️ Auto pilot: Moving to next relay');
    currentStepRef.current = 'idle';

    // Clear any existing timeouts/intervals
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Close current relay panel
    if (controls.isPanelOpen()) {
      controls.closeRelayPanel().catch(error => {
        console.error('❌ Auto pilot: Error closing relay panel:', error);
      });
    }

    // Move to next relay or restart from beginning
    const nextIndex = currentRelayIndex + 1;
    if (nextIndex >= currentRelayOrder.length) {
      // Restart from beginning with new random order
      console.log('🔄 Auto pilot: Completed all relays, restarting with new order');
      const newOrder = generateRandomRelayOrder();
      setCurrentRelayOrder(newOrder);
      setCurrentRelayIndex(0);
    } else {
      setCurrentRelayIndex(nextIndex);
    }

    // Wait 1 second before processing next relay
    timeoutRef.current = setTimeout(() => {
      if (isAutoPilotMode && isAutoPilotActive) {
        runAutoPilotSequence();
      }
    }, 1000);
  }, [currentRelayIndex, currentRelayOrder, controls, generateRandomRelayOrder, setCurrentRelayIndex, isAutoPilotMode, isAutoPilotActive, runAutoPilotSequence]);

  // Main effect - start sequence when autopilot is active and relay order is ready
  useEffect(() => {
    if (isAutoPilotMode && isAutoPilotActive && currentRelayOrder.length > 0 && currentStepRef.current === 'idle') {
      console.log('🚀 Auto pilot: Starting sequence');
      runAutoPilotSequence();
    }
  }, [isAutoPilotMode, isAutoPilotActive, currentRelayOrder.length, runAutoPilotSequence]);

  // Cleanup on autopilot stop or unmount
  useEffect(() => {
    if (!isAutoPilotMode || !isAutoPilotActive) {
      // Clear all timeouts and intervals when autopilot stops
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      currentStepRef.current = 'idle';
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPilotMode, isAutoPilotActive]);

  return {
    isAutoPilotMode,
    isAutoPilotActive,
    currentRelayIndex,
    totalRelays: currentRelayOrder.length,
  };
}
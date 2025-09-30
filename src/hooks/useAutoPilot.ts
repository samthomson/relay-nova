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

  // Single master execution state to prevent multiple instances
  const masterExecutionRef = useRef<{
    isRunning: boolean;
    currentSequenceId: string;
    timeoutId: NodeJS.Timeout | null;
    intervalId: NodeJS.Timeout | null;
    abortController: AbortController | null;
    relayOrder: string[];
  }>({
    isRunning: false,
    currentSequenceId: '',
    timeoutId: null,
    intervalId: null,
    abortController: null,
    relayOrder: [],
  });

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
    const execution = masterExecutionRef.current;

    if (execution.abortController) {
      execution.abortController.abort();
      execution.abortController = null;
    }

    if (execution.timeoutId) {
      clearTimeout(execution.timeoutId);
      execution.timeoutId = null;
    }

    if (execution.intervalId) {
      clearInterval(execution.intervalId);
      execution.intervalId = null;
    }

    execution.isRunning = false;
    execution.currentSequenceId = '';

    console.log('🧹 Aborted and cleaned up current autopilot execution');
  }, []);

  // Auto pilot sequence runner with single execution guarantee
  const runAutoPilotSequence = useCallback(async () => {
    // Generate unique sequence ID
    const sequenceId = `autopilot-${Date.now()}-${Math.random()}`;

    // Prevent multiple simultaneous executions
    if (masterExecutionRef.current.isRunning) {
      console.log('🔄 Auto pilot already running, aborting existing execution...');
      abortCurrentExecution();
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check if autopilot is still active
    if (!isAutoPilotMode || !isAutoPilotActive) {
      console.log('🛑 Auto pilot not active, stopping execution');
      return;
    }

    // Initialize or update relay order
    if (masterExecutionRef.current.relayOrder.length === 0) {
      const newOrder = generateRandomRelayOrder();
      if (newOrder.length === 0) {
        console.error('❌ No relays available for auto pilot');
        stopAutoPilot();
        return;
      }
      masterExecutionRef.current.relayOrder = newOrder;
      setTotalRelays(newOrder.length);
    }

    const relayUrl = masterExecutionRef.current.relayOrder[currentRelayIndex];
    if (!relayUrl) {
      console.error('❌ No relay URL found at index:', currentRelayIndex);
      return;
    }

    // Set execution state
    masterExecutionRef.current.isRunning = true;
    masterExecutionRef.current.currentSequenceId = sequenceId;
    masterExecutionRef.current.abortController = new AbortController();

    console.log(`🛩️ [${sequenceId}] Auto pilot: Processing relay ${currentRelayIndex + 1}/${masterExecutionRef.current.relayOrder.length}: ${relayUrl}`);

    try {
      const signal = masterExecutionRef.current.abortController.signal;

      // Step 1: Rotate earth to relay (750ms)
      console.log(`🔄 [${sequenceId}] Auto pilot: Rotating earth to relay...`);
      await controls.rotateEarthToRelay(relayUrl);

      if (signal.aborted || masterExecutionRef.current.currentSequenceId !== sequenceId) return;
      console.log(`✅ [${sequenceId}] Auto pilot: Earth rotated`);

      // Step 2: Open relay panel
      console.log(`📂 [${sequenceId}] Auto pilot: Opening relay panel...`);
      await controls.openRelayPanel(relayUrl);

      if (signal.aborted || masterExecutionRef.current.currentSequenceId !== sequenceId) return;
      console.log(`✅ [${sequenceId}] Auto pilot: Relay panel opened`);

      // Step 3: Wait for events to load (with proper timeout)
      console.log(`⏳ [${sequenceId}] Auto pilot: Waiting for events to load...`);
      const eventsLoaded = await waitForEventsToLoad(signal, sequenceId);

      if (signal.aborted || masterExecutionRef.current.currentSequenceId !== sequenceId) return;

      if (!eventsLoaded) {
        console.log(`⏰ [${sequenceId}] Auto pilot: Events loading failed, moving to next relay`);
        scheduleNextRelay(sequenceId);
        return;
      }
      console.log(`✅ [${sequenceId}] Auto pilot: Events loaded`);

      // Step 4: Scroll through events for exactly 5 seconds
      console.log(`📜 [${sequenceId}] Auto pilot: Starting 5-second scroll through events...`);
      await scrollThroughEvents(signal, sequenceId);

      if (signal.aborted || masterExecutionRef.current.currentSequenceId !== sequenceId) return;
      console.log(`✅ [${sequenceId}] Auto pilot: Finished scrolling`);

      // Step 5: Move to next relay
      scheduleNextRelay(sequenceId);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`⏹️ [${sequenceId}] Auto pilot sequence aborted`);
        return;
      }
      console.error(`❌ [${sequenceId}] Auto pilot error:`, error);
      scheduleNextRelay(sequenceId);
    } finally {
      // Only clear if this is still the current sequence
      if (masterExecutionRef.current.currentSequenceId === sequenceId) {
        masterExecutionRef.current.isRunning = false;
        masterExecutionRef.current.currentSequenceId = '';
      }
    }
  }, [isAutoPilotMode, isAutoPilotActive, currentRelayIndex, controls, generateRandomRelayOrder, setTotalRelays, stopAutoPilot, abortCurrentExecution]);

  // Wait for events to load with proper signal handling
  const waitForEventsToLoad = useCallback(async (signal: AbortSignal, sequenceId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`⏰ [${sequenceId}] Events loading timeout (5 seconds)`);
        resolve(false);
      }, 5000);

      const checkInterval = setInterval(() => {
        if (signal.aborted || masterExecutionRef.current.currentSequenceId !== sequenceId) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        if (controls.areEventsLoaded()) {
          console.log(`✅ [${sequenceId}] Events loaded successfully`);
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 200); // Check every 200ms instead of 100ms

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        resolve(false);
      });
    });
  }, [controls]);

  // Scroll through events for exactly 5 seconds
  const scrollThroughEvents = useCallback(async (signal: AbortSignal, sequenceId: string): Promise<void> => {
    return new Promise((resolve) => {
      const events = controls.getCurrentEvents();
      if (!events || events.length === 0) {
        console.log(`📜 [${sequenceId}] No events to scroll through - skipping scroll period`);
        // Still wait 5 seconds even if no events, as per requirements
        const waitTimeout = setTimeout(() => {
          console.log(`📜 [${sequenceId}] Completed 5-second wait period (no events)`);
          resolve();
        }, 5000);

        signal.addEventListener('abort', () => {
          clearTimeout(waitTimeout);
          resolve();
        });
        return;
      }

      console.log(`📜 [${sequenceId}] Scrolling through ${events.length} events for 5 seconds`);

      let currentEventIndex = 0;
      let scrollCount = 0;

      // Scroll to next event every 1 second for 5 seconds total
      const scrollInterval = setInterval(() => {
        if (signal.aborted || masterExecutionRef.current.currentSequenceId !== sequenceId) {
          clearInterval(scrollInterval);
          resolve();
          return;
        }

        scrollCount++;

        // Scroll to current event
        controls.scrollToEvent(currentEventIndex);
        console.log(`📜 [${sequenceId}] Scrolled to event ${currentEventIndex} (${scrollCount}/5)`);

        // Move to next event
        currentEventIndex = (currentEventIndex + 1) % events.length;

        // Stop after 5 seconds
        if (scrollCount >= 5) {
          clearInterval(scrollInterval);
          console.log(`📜 [${sequenceId}] Completed 5-second scroll period`);
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
  const scheduleNextRelay = useCallback((sequenceId: string) => {
    console.log(`⏭️ [${sequenceId}] Scheduling next relay...`);

    // Only proceed if this is still the current sequence
    if (masterExecutionRef.current.currentSequenceId !== sequenceId) {
      console.log(`⏹️ [${sequenceId}] Sequence superseded, not scheduling next relay`);
      return;
    }

    // Close current relay panel
    if (controls.isPanelOpen()) {
      controls.closeRelayPanel().catch(error => {
        console.error(`❌ [${sequenceId}] Error closing relay panel:`, error);
      });
    }

    // Move to next relay index
    const nextIndex = currentRelayIndex + 1;
    if (nextIndex >= masterExecutionRef.current.relayOrder.length) {
      // Generate new random order and restart
      console.log(`🔄 [${sequenceId}] Completed all relays, generating new order...`);
      const newOrder = generateRandomRelayOrder();
      masterExecutionRef.current.relayOrder = newOrder;
      setCurrentRelayIndex(0);
      setTotalRelays(newOrder.length);
    } else {
      setCurrentRelayIndex(nextIndex);
    }

    // Wait 1 second before processing next relay
    masterExecutionRef.current.timeoutId = setTimeout(() => {
      if (isAutoPilotMode && isAutoPilotActive && masterExecutionRef.current.currentSequenceId === sequenceId) {
        console.log(`⏰ [${sequenceId}] Timeout triggered, starting next sequence`);
        runAutoPilotSequence();
      } else {
        console.log(`⏹️ [${sequenceId}] Timeout cancelled - autopilot no longer active or sequence superseded`);
      }
    }, 1000);
  }, [currentRelayIndex, controls, generateRandomRelayOrder, setCurrentRelayIndex, setTotalRelays, isAutoPilotMode, isAutoPilotActive, runAutoPilotSequence]);

  // Start autopilot when activated
  useEffect(() => {
    if (isAutoPilotMode && isAutoPilotActive && !masterExecutionRef.current.isRunning) {
      console.log('🚀 Starting autopilot mode');

      // Clean up any existing state
      abortCurrentExecution();

      // Reset state
      masterExecutionRef.current.relayOrder = [];
      setCurrentRelayIndex(0);

      // Start sequence after brief delay to ensure clean state
      const startTimeout = setTimeout(() => {
        if (isAutoPilotMode && isAutoPilotActive) {
          runAutoPilotSequence();
        }
      }, 100);

      return () => clearTimeout(startTimeout);
    }
  }, [isAutoPilotMode, isAutoPilotActive, runAutoPilotSequence, setCurrentRelayIndex, abortCurrentExecution]);

  // Cleanup when autopilot stops
  useEffect(() => {
    if (!isAutoPilotMode || !isAutoPilotActive) {
      console.log('🛑 Cleaning up autopilot...');
      abortCurrentExecution();
      masterExecutionRef.current.relayOrder = [];
    }

    return () => {
      // Cleanup on unmount
      abortCurrentExecution();
    };
  }, [isAutoPilotMode, isAutoPilotActive, abortCurrentExecution]);

  return {
    isAutoPilotMode,
    isAutoPilotActive,
    currentRelayIndex,
    totalRelays: masterExecutionRef.current.relayOrder.length,
  };
}
import { useEffect, useRef, useCallback } from 'react';
import { useRelayLocations } from './useRelayLocations';
import { useAutoPilotContext } from '@/contexts/AutoPilotContext';
import type { NostrEvent } from '@nostrify/nostrify';

// Autopilot configuration constants
const RELAY_DISPLAY_TIME_MS = 15000; // 15 seconds to display each relay
const ROTATION_DURATION_MS = 1000; // 1 second to rotate to relay

interface AutoPilotControls {
  rotateEarthToRelay: (relayUrl: string) => Promise<void>;
  openRelayPanel: (relayUrl: string) => Promise<void>;
  closeRelayPanel: () => Promise<void>;
  startSmoothScroll: () => void;
  stopSmoothScroll: () => void;
  getCurrentEvents: () => NostrEvent[] | null;
  isPanelOpen: () => boolean;
  areEventsLoaded: () => boolean;
}

export function useAutoPilot(controls: AutoPilotControls) {
  const relayLocationsQuery = useRelayLocations();
  const {
    isAutoPilotMode,
    isAutoPilotActive,
    stopAutoPilot,
    currentRelayIndex,
    setCurrentRelayIndex,
    setTotalRelays,
    setRelayDisplayProgress,
    registerSkipFunction,
    isPaused,
  } = useAutoPilotContext();

  // Single master execution state to prevent multiple instances
  const masterExecutionRef = useRef<{
    isRunning: boolean;
    currentSequenceId: string;
    timeoutId: NodeJS.Timeout | null;
    intervalId: NodeJS.Timeout | null;
    abortController: AbortController | null;
    relayOrder: string[];
    progressStartTime: number | null;
    progressPauseTime: number | null;
    totalElapsedTime: number;
  }>({
    isRunning: false,
    currentSequenceId: '',
    timeoutId: null,
    intervalId: null,
    abortController: null,
    relayOrder: [],
    progressStartTime: null,
    progressPauseTime: null,
    totalElapsedTime: 0,
  });

  // Generate random order of relays
  const generateRandomRelayOrder = useCallback(() => {
    const relayLocations = relayLocationsQuery.data;
    if (!relayLocations || relayLocations.length === 0) return [];

    const shuffled = [...relayLocations].sort(() => Math.random() - 0.5);
    const urlOrder = shuffled.map(relay => relay.url);
    console.log('🎲 Generated random relay order:', urlOrder.slice(0, 5), `(${urlOrder.length} total)`);
    return urlOrder;
  }, [relayLocationsQuery.data]);

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
    execution.progressStartTime = null;
    execution.progressPauseTime = null;
    execution.totalElapsedTime = 0;

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

    // Check if autopilot is still active and not paused
    if (!isAutoPilotMode || !isAutoPilotActive || isPaused) {
      console.log('🛑 Auto pilot not active or paused, stopping execution');
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

      // Step 4: Wait for display time (scrolling starts automatically via useEffect)
      console.log(`📜 [${sequenceId}] Auto pilot: Displaying relay for ${RELAY_DISPLAY_TIME_MS / 1000} seconds (scroll auto-starts)...`);

      // Update progress bar and handle display time
      let startTime = Date.now();
      let progress = 0;
      let displayTimeoutId: NodeJS.Timeout | null = null;
      let progressIntervalId: NodeJS.Timeout | null = null;

      await new Promise<void>(resolve => {
        // Function to clean up all timers
        const cleanup = () => {
          if (displayTimeoutId) clearTimeout(displayTimeoutId);
          if (progressIntervalId) clearInterval(progressIntervalId);
          displayTimeoutId = null;
          progressIntervalId = null;
        };

        // Function to start/resume timers
        const startTimers = () => {
          // Clear any existing timers
          cleanup();

          // Calculate remaining time based on current progress
          const remainingTime = RELAY_DISPLAY_TIME_MS * (1 - progress / 100);

          // Start display timeout
          displayTimeoutId = setTimeout(() => {
            cleanup();
            resolve();
          }, remainingTime);

          // Start progress updates
          progressIntervalId = setInterval(() => {
            const elapsed = Date.now() - startTime;
            progress = Math.min((elapsed / RELAY_DISPLAY_TIME_MS) * 100, 100);
            setRelayDisplayProgress(progress);
          }, 50);
        };

        // Start initial timers if not paused
        if (!isPaused) {
          startTimers();
        }

        // Watch for pause state changes
        const pauseObserver = setInterval(() => {
          if (isPaused) {
            // When paused, stop all timers but remember progress
            cleanup();
          } else if (!displayTimeoutId) {
            // When unpaused and no timers running, restart from current progress
            startTime = Date.now() - (progress / 100 * RELAY_DISPLAY_TIME_MS);
            startTimers();
          }
        }, 50);

        // Handle abort signal
        signal.addEventListener('abort', () => {
          cleanup();
          clearInterval(pauseObserver);
          resolve();
        });
      });

      setRelayDisplayProgress(100); // Ensure we hit 100% at the end
      controls.stopSmoothScroll();

      if (signal.aborted || masterExecutionRef.current.currentSequenceId !== sequenceId) return;
      console.log(`✅ [${sequenceId}] Auto pilot: Finished displaying relay`);

      // Step 5: Close relay panel
      console.log(`🚪 [${sequenceId}] Auto pilot: Closing relay panel...`);
      await controls.closeRelayPanel();

      if (signal.aborted || masterExecutionRef.current.currentSequenceId !== sequenceId) return;
      console.log(`✅ [${sequenceId}] Auto pilot: Relay panel closed`);

      // Step 6: Move to next relay
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
  }, [isAutoPilotMode, isAutoPilotActive, isPaused, currentRelayIndex, controls, generateRandomRelayOrder, setTotalRelays, stopAutoPilot, abortCurrentExecution]);

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


  // Schedule next relay with proper cleanup
  const scheduleNextRelay = useCallback((sequenceId: string) => {
    console.log(`⏭️ [${sequenceId}] Scheduling next relay...`);

    // Only proceed if this is still the current sequence and not paused
    if (masterExecutionRef.current.currentSequenceId !== sequenceId) {
      console.log(`⏹️ [${sequenceId}] Sequence superseded, not scheduling next relay`);
      return;
    }

    if (isPaused) {
      console.log(`⏸️ [${sequenceId}] Autopilot paused, not scheduling next relay`);
      return;
    }

    // Reset progress bar
    setRelayDisplayProgress(0);

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

    // Function to start next sequence
    const startNext = () => {
      // Double-check pause state before starting
      if (isPaused) {
        console.log(`⏸️ [${sequenceId}] Still paused, not starting next sequence`);
        return;
      }

      if (isAutoPilotMode && isAutoPilotActive && masterExecutionRef.current.currentSequenceId === sequenceId) {
        console.log(`⏰ [${sequenceId}] Starting next sequence`);
        runAutoPilotSequence();
      } else {
        console.log(`⏹️ [${sequenceId}] Cannot start - autopilot no longer active or sequence superseded`);
      }
    };

    // Wait 1 second before processing next relay
    masterExecutionRef.current.timeoutId = setTimeout(startNext, 1000);
  }, [currentRelayIndex, controls, generateRandomRelayOrder, setCurrentRelayIndex, setTotalRelays, isAutoPilotMode, isAutoPilotActive, isPaused, runAutoPilotSequence, setRelayDisplayProgress]);

  // Handle autopilot state changes
  useEffect(() => {
    if (!isAutoPilotMode) {
      // Stop everything when autopilot is off
      console.log('🛑 Autopilot mode off - stopping everything');
      abortCurrentExecution();
      return;
    }

    if (isPaused) {
      // When paused, stop the current sequence but keep state
      console.log('⏸️ Autopilot paused - stopping current sequence');
      abortCurrentExecution();
      return;
    }

    if (isAutoPilotActive && !masterExecutionRef.current.isRunning) {
      console.log('🚀 Starting autopilot sequence');

      // Clean up any existing state
      abortCurrentExecution();

      // Reset state if we're starting fresh (not resuming)
      if (!isPaused) {
        masterExecutionRef.current.relayOrder = [];
        setCurrentRelayIndex(0);
      }

      // Start sequence after brief delay to ensure clean state
      const startTimeout = setTimeout(() => {
        if (isAutoPilotMode && isAutoPilotActive && !isPaused) {
          runAutoPilotSequence();
        }
      }, 100);

      return () => clearTimeout(startTimeout);
    }
  }, [isAutoPilotMode, isAutoPilotActive, isPaused, runAutoPilotSequence, setCurrentRelayIndex, abortCurrentExecution]);

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

  // Register skip function
  useEffect(() => {
    const skipToNext = () => {
      if (!isAutoPilotMode || !masterExecutionRef.current.isRunning) {
        console.log('⚠️ Skip ignored - autopilot not running');
        return;
      }

      const currentSequenceId = masterExecutionRef.current.currentSequenceId;
      console.log(`⏭️ [${currentSequenceId}] Skipping to next relay`);

      // Abort current sequence
      if (masterExecutionRef.current.abortController) {
        masterExecutionRef.current.abortController.abort();
      }

      // Clear any timers
      if (masterExecutionRef.current.timeoutId) {
        clearTimeout(masterExecutionRef.current.timeoutId);
        masterExecutionRef.current.timeoutId = null;
      }

      // Stop scrolling
      controls.stopSmoothScroll();

      // Schedule next relay immediately
      scheduleNextRelay(currentSequenceId);
    };

    registerSkipFunction(skipToNext);
  }, [isAutoPilotMode, controls, scheduleNextRelay, registerSkipFunction]);

  return {
    isAutoPilotMode,
    isAutoPilotActive,
    currentRelayIndex,
    totalRelays: masterExecutionRef.current.relayOrder.length,
  };
}
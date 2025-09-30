import { useEffect, useRef, useCallback, useState } from 'react';
import { useNostr } from '@nostrify/react';
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
  const { nostr } = useNostr();
  const {
    isAutoPilotMode,
    isAutoPilotActive,
    stopAutoPilot,
    currentRelayIndex,
    setCurrentRelayIndex,
    setTotalRelays,
    moveToNextRelay
  } = useAutoPilotContext();

  const [currentRelayOrder, setCurrentRelayOrder] = useState<string[]>([]);
  const autoPilotTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentEventIndexRef = useRef(0);
  const manualNextRequestedRef = useRef(false);

  // Generate random order of relays
  const generateRandomRelayOrder = useCallback(() => {
    if (!relayLocations || relayLocations.length === 0) return [];

    const shuffled = [...relayLocations].sort(() => Math.random() - 0.5);
    return shuffled.map(relay => relay.url);
  }, [relayLocations]);

  // Start auto pilot sequence
  const startAutoPilotSequence = useCallback(async () => {
    if (!isAutoPilotMode || !isAutoPilotActive) return;

    // Generate new random order if needed
    if (currentRelayOrder.length === 0) {
      const newOrder = generateRandomRelayOrder();
      setCurrentRelayOrder(newOrder);
      setTotalRelays(newOrder.length);
      setCurrentRelayIndex(0);

      if (newOrder.length === 0) {
        console.error('No relays available for auto pilot');
        stopAutoPilot();
        return;
      }
    }

    const currentRelayUrl = currentRelayOrder[currentRelayIndex];
    console.log(`🛩️ Auto Pilot: Processing relay ${currentRelayIndex + 1}/${currentRelayOrder.length}: ${currentRelayUrl}`);

    try {
      // Step 1: Rotate earth to relay location
      console.log('🔄 Step 1: Rotating earth to relay location');
      await controls.rotateEarthToRelay(currentRelayUrl);
      console.log('✅ Earth rotated to relay');

      // Step 2: Open relay panel
      console.log('🔄 Step 2: Opening relay panel');
      await controls.openRelayPanel(currentRelayUrl);
      console.log('✅ Relay panel opened');

      // Step 3: Wait for events to load
      console.log('🔄 Step 3: Waiting for events to load');
      const eventsLoaded = await waitForEventsToLoad();
      if (!eventsLoaded) {
        console.log('⏰ Events loading timeout, moving to next relay');
        await moveToNextRelayLocal();
        return;
      }
      console.log('✅ Events loaded');

      // Check if user requested manual next before starting auto-scroll
      if (manualNextRequestedRef.current) {
        console.log('⏭️ Manual next requested, skipping auto-scrolling');
        manualNextRequestedRef.current = false;
        await moveToNextRelayLocal();
        return;
      }

      // Step 4: Start auto-scrolling through events
      console.log('🔄 Step 4: Starting auto-scrolling through events');
      currentEventIndexRef.current = 0;
      await startAutoScrolling();

    } catch (error) {
      console.error('❌ Auto pilot error:', error);

      // Check if this is a "Relay not found" error, which might indicate data issues
      if (error instanceof Error && error.message.includes('Relay not found')) {
        console.log('🔄 Relay not found error, trying to continue with next relay');
        await moveToNextRelayLocal();
      } else {
        // For other errors, add a small delay before continuing
        console.log('🔄 Moving to next relay due to error (with delay)');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await moveToNextRelayLocal();
      }
    }
  }, [
    isAutoPilotMode,
    isAutoPilotActive,
    currentRelayOrder,
    currentRelayIndex,
    controls,
    generateRandomRelayOrder,
    stopAutoPilot,
    setCurrentRelayIndex,
    setTotalRelays
  ]);

  // Wait for events to load (max 10 seconds)
  const waitForEventsToLoad = useCallback(async (): Promise<boolean> => {
    console.log('⏳ Waiting for events to load...');
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 100; // 100 * 100ms = 10 seconds max
      let lastPanelState = controls.isPanelOpen();

      const checkInterval = setInterval(() => {
        attempts++;
        const currentPanelState = controls.isPanelOpen();

        // If panel closed unexpectedly, consider it a failure
        if (lastPanelState && !currentPanelState) {
          console.log('❌ Relay panel closed unexpectedly');
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        lastPanelState = currentPanelState;

        if (controls.areEventsLoaded()) {
          console.log('✅ Events loaded successfully');
          clearInterval(checkInterval);
          resolve(true);
        } else if (attempts >= maxAttempts) {
          console.log('⏰ Events loading timeout - moving to next relay');
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }, [controls]);

  // Start auto-scrolling through events
  const startAutoScrolling = useCallback(async () => {
    const events = controls.getCurrentEvents();
    if (!events || events.length === 0) {
      console.log('📄 No events to scroll through');
      await moveToNextRelay();
      return;
    }

    console.log(`📄 Auto-scrolling through ${events.length} events`);

    // Clear any existing scroll interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    // Scroll through events at readable pace
    scrollIntervalRef.current = setInterval(() => {
      if (currentEventIndexRef.current < events.length) {
        controls.scrollToEvent(currentEventIndexRef.current);
        currentEventIndexRef.current++;
      } else {
        // Finished scrolling all events, wait 2 seconds then move to next relay
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
        }

        autoPilotTimeoutRef.current = setTimeout(async () => {
          await moveToNextRelayLocal();
        }, 2000);
      }
    }, 3000); // 3 seconds per event (readable pace)
  }, [controls]);

  // Move to next relay (local implementation)
  const moveToNextRelayLocal = useCallback(async () => {
    console.log('⏭️ Moving to next relay');

    // Clear any existing intervals/timeout
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (autoPilotTimeoutRef.current) {
      clearTimeout(autoPilotTimeoutRef.current);
      autoPilotTimeoutRef.current = null;
    }

    // Close current relay panel
    if (controls.isPanelOpen()) {
      await controls.closeRelayPanel();
      console.log('✅ Relay panel closed');
    }

    // Move to next relay or restart from beginning
    const nextIndex = currentRelayIndex + 1;
    if (nextIndex >= currentRelayOrder.length) {
      // Restart from beginning with new random order
      console.log('🔄 Auto Pilot: Completed all relays, restarting with new order');
      const newOrder = generateRandomRelayOrder();
      setCurrentRelayOrder(newOrder);
      setCurrentRelayIndex(0);
    } else {
      setCurrentRelayIndex(nextIndex);
    }

    // Wait 1 second before processing next relay
    autoPilotTimeoutRef.current = setTimeout(() => {
      startAutoPilotSequence();
    }, 1000);
  }, [
    currentRelayIndex,
    currentRelayOrder,
    controls,
    generateRandomRelayOrder,
    setCurrentRelayIndex,
    setCurrentRelayOrder,
    startAutoPilotSequence
  ]);

  // Main auto pilot effect
  useEffect(() => {
    if (isAutoPilotMode && isAutoPilotActive) {
      console.log('🚀 Starting auto pilot sequence');
      startAutoPilotSequence();
    }

    return () => {
      // Cleanup on unmount or when auto pilot is stopped
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      if (autoPilotTimeoutRef.current) {
        clearTimeout(autoPilotTimeoutRef.current);
        autoPilotTimeoutRef.current = null;
      }
    };
  }, [isAutoPilotMode, isAutoPilotActive, startAutoPilotSequence]);

  // Stop auto pilot when component unmounts
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
      if (autoPilotTimeoutRef.current) {
        clearTimeout(autoPilotTimeoutRef.current);
      }
    };
  }, []);

  return {
    isAutoPilotMode,
    isAutoPilotActive,
    currentRelayIndex,
    totalRelays: currentRelayOrder.length,
  };
}
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
    const urlOrder = shuffled.map(relay => relay.url);
    console.log('🎲 Generated random relay order:', urlOrder.slice(0, 5), `(${urlOrder.length} total)`);
    return urlOrder;
  }, [relayLocations]);

  // Start auto pilot sequence
  const startAutoPilotSequence = useCallback(async () => {
    if (!isAutoPilotMode || !isAutoPilotActive) return;

    // Generate new random order if needed
    if (currentRelayOrder.length === 0) {
      console.log('🔄 Generating new random relay order...');
      const newOrder = generateRandomRelayOrder();
      console.log('📋 Generated order:', newOrder);
      setCurrentRelayOrder(newOrder);
      setTotalRelays(newOrder.length);
      setCurrentRelayIndex(0);

      if (newOrder.length === 0) {
        console.error('No relays available for auto pilot');
        stopAutoPilot();
        return;
      }
    }

    console.log(`📊 Current relay order: [${currentRelayOrder.join(', ')}]`);
    console.log(`📍 Current index: ${currentRelayIndex}`);
    const currentRelayUrl = currentRelayOrder[currentRelayIndex];
    console.log(`🎯 Selected relay URL: ${currentRelayUrl}`);
    console.log(`🛩️ Auto Pilot: Processing relay ${currentRelayIndex + 1}/${currentRelayOrder.length}: ${currentRelayUrl}`);

    try {
      // Step 1: Rotate earth to relay location
      console.log('🔄 Step 1: Rotating earth to relay location');
      console.log(`🎯 Target relay: ${currentRelayUrl}`);
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

      // Don't let errors break the autopilot - always try to continue
      console.log('🔄 Attempting to continue to next relay despite error');
      try {
        await moveToNextRelayLocal();
      } catch (nextError) {
        console.error('❌ Failed to move to next relay:', nextError);
        // If even moving to next relay fails, wait and retry
        console.log('⏳ Waiting 3 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (isAutoPilotMode && isAutoPilotActive) {
          console.log('🔄 Retrying autopilot sequence');
          await startAutoPilotSequence();
        }
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

      // Safety cleanup - don't leave interval hanging
      setTimeout(() => {
        clearInterval(checkInterval);
        console.log('⏰ Safety timeout reached for events loading');
        resolve(false);
      }, 15000); // 15 second absolute safety timeout
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
    console.log(`📊 Current state - isAutoPilotMode: ${isAutoPilotMode}, isAutoPilotActive: ${isAutoPilotActive}`);
    console.log(`📊 Relay order: [${currentRelayOrder.join(', ')}]`);
    console.log(`📊 Current index: ${currentRelayIndex}, total: ${currentRelayOrder.length}`);

    // Clear any existing intervals/timeout
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (autoPilotTimeoutRef.current) {
      clearTimeout(autoPilotTimeoutRef.current);
      autoPilotTimeoutRef.current = null;
    }

    // Close current relay panel with error handling
    try {
      if (controls.isPanelOpen()) {
        await controls.closeRelayPanel();
        console.log('✅ Relay panel closed');
      }
    } catch (error) {
      console.error('❌ Error closing relay panel:', error);
      // Continue anyway - don't let this break autopilot
    }

    // Move to next relay or restart from beginning
    const nextIndex = currentRelayIndex + 1;
    if (nextIndex >= currentRelayOrder.length) {
      // Restart from beginning with new random order
      console.log('🔄 Auto Pilot: Completed all relays, restarting with new order');
      try {
        const newOrder = generateRandomRelayOrder();
        setCurrentRelayOrder(newOrder);
        setCurrentRelayIndex(0);
      } catch (error) {
        console.error('❌ Error generating new relay order:', error);
        // Try to continue with current order
        setCurrentRelayIndex(0);
      }
    } else {
      setCurrentRelayIndex(nextIndex);
    }

    // Wait 1 second before processing next relay
    autoPilotTimeoutRef.current = setTimeout(() => {
      console.log(`🔍 Timeout triggered - isAutoPilotMode: ${isAutoPilotMode}, isAutoPilotActive: ${isAutoPilotActive}`);
      if (isAutoPilotMode && isAutoPilotActive) {
        console.log('🚀 Starting next relay sequence');
        try {
          startAutoPilotSequence();
        } catch (error) {
          console.error('❌ Error starting next relay sequence:', error);
          // Wait and retry
          setTimeout(() => {
            if (isAutoPilotMode && isAutoPilotActive) {
              console.log('🔄 Retrying autopilot sequence');
              startAutoPilotSequence();
            }
          }, 2000);
        }
      } else {
        console.log('⏹️ Auto pilot stopped, not starting next sequence');
      }
    }, 1000);
  }, [
    currentRelayIndex,
    currentRelayOrder,
    controls,
    generateRandomRelayOrder,
    setCurrentRelayIndex,
    setCurrentRelayOrder,
    startAutoPilotSequence,
    isAutoPilotMode,
    isAutoPilotActive
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
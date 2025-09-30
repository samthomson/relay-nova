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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate random order of relays
  const generateRandomRelayOrder = useCallback(() => {
    if (!relayLocations || relayLocations.length === 0) return [];

    const shuffled = [...relayLocations].sort(() => Math.random() - 0.5);
    const urlOrder = shuffled.map(relay => relay.url);
    console.log('🎲 Generated random relay order:', urlOrder.slice(0, 5), `(${urlOrder.length} total)`);
    return urlOrder;
  }, [relayLocations]);

  // Simple auto pilot sequence - exactly as described
  const runAutoPilotSequence = useCallback(async () => {
    if (!isAutoPilotMode || !isAutoPilotActive) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

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
    console.log(`🛩️ Processing relay ${currentRelayIndex + 1}/${currentRelayOrder.length}: ${currentRelayUrl}`);

    try {
      // Step 1: Rotate earth to relay (fast, 1 second)
      console.log('🔄 Rotating earth to relay...');
      await controls.rotateEarthToRelay(currentRelayUrl);
      console.log('✅ Earth rotated');

      // Step 2: Open relay panel
      console.log('📂 Opening relay panel...');
      await controls.openRelayPanel(currentRelayUrl);
      console.log('✅ Relay panel opened');

      // Step 3: Wait for events to load
      console.log('⏳ Waiting for events to load...');
      const eventsLoaded = await waitForEventsToLoad();
      if (!eventsLoaded) {
        console.log('⏰ Events loading timeout, moving to next relay');
        moveToNextRelayLocal();
        return;
      }
      console.log('✅ Events loaded');

      // Step 4: Wait 5 seconds after loading
      console.log('⏳ Waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 5: Move to next relay
      console.log('⏭️ Moving to next relay...');
      moveToNextRelayLocal();

    } catch (error) {
      console.error('❌ Auto pilot error:', error);
      // Continue to next relay despite errors
      moveToNextRelayLocal();
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

  // Wait for events to load
  const waitForEventsToLoad = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 100; // 100 * 100ms = 10 seconds max

      const checkInterval = setInterval(() => {
        attempts++;

        if (controls.areEventsLoaded()) {
          console.log('✅ Events loaded successfully');
          clearInterval(checkInterval);
          resolve(true);
        } else if (attempts >= maxAttempts) {
          console.log('⏰ Events loading timeout');
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);

      // Safety cleanup
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 15000);
    });
  }, [controls]);

  // Move to next relay
  const moveToNextRelayLocal = useCallback(() => {
    console.log('⏭️ Moving to next relay');

    // Clear any existing timeout
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

    // Move to next relay or restart from beginning
    const nextIndex = currentRelayIndex + 1;
    if (nextIndex >= currentRelayOrder.length) {
      // Restart from beginning with new random order
      console.log('🔄 Completed all relays, restarting with new order');
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
  }, [
    currentRelayIndex,
    currentRelayOrder,
    controls,
    generateRandomRelayOrder,
    setCurrentRelayIndex,
    setCurrentRelayOrder,
    isAutoPilotMode,
    isAutoPilotActive,
    runAutoPilotSequence
  ]);

  // Main effect - start sequence when autopilot is active
  useEffect(() => {
    if (isAutoPilotMode && isAutoPilotActive) {
      console.log('🚀 Starting auto pilot sequence');
      runAutoPilotSequence();
    }

    return () => {
      // Cleanup on unmount or when auto pilot is stopped
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isAutoPilotMode, isAutoPilotActive, runAutoPilotSequence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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
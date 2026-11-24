import { useEffect, useRef, useState, useCallback } from "react";
import { proctorService, ProctorEventPayload } from "../services/proctor.service";

interface UseProctorMonitorOptions {
  attemptId: string | null;
  enabled?: boolean;
  onWarning?: (message: string) => void;
}

export function useProctorMonitor({ attemptId, enabled = true, onWarning }: UseProctorMonitorOptions) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);
  const [loggedEventsCount, setLoggedEventsCount] = useState<number>(0);
  const [activeWarning, setActiveWarning] = useState<string | null>(null);

  const eventQueueRef = useRef<ProctorEventPayload[]>([]);
  const isFlushingRef = useRef<boolean>(false);
  const warningTimeoutRef = useRef<any>(null);

  // Interaction telemetry counters
  const mouseMovesCountRef = useRef<number>(0);
  const scrollCountRef = useRef<number>(0);
  const keyEventsCountRef = useRef<number>(0);

  const triggerWarning = useCallback((message: string) => {
    setActiveWarning(message);
    if (onWarning) onWarning(message);

    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    warningTimeoutRef.current = setTimeout(() => {
      setActiveWarning(null);
    }, 4500);
  }, [onWarning]);

  // Flush queued events to backend
  const flushQueue = useCallback(async () => {
    if (!attemptId || !enabled || eventQueueRef.current.length === 0 || isFlushingRef.current) {
      return;
    }

    const batch = [...eventQueueRef.current];
    eventQueueRef.current = [];
    isFlushingRef.current = true;

    try {
      await proctorService.ingestEvents(attemptId, batch);
      setLoggedEventsCount((prev) => prev + batch.length);
    } catch (err) {
      console.warn("Failed to flush proctoring events batch, re-queuing:", err);
      // Re-queue on network error
      eventQueueRef.current = [...batch, ...eventQueueRef.current];
    } finally {
      isFlushingRef.current = false;
    }
  }, [attemptId, enabled]);

  // Queue an event and flush immediately if urgent
  const logEvent = useCallback(
    (
      eventType: string,
      severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "INFO",
      metadata: Record<string, any> = {},
      immediateFlush: boolean = false
    ) => {
      if (!attemptId || !enabled) return;

      const newEvent: ProctorEventPayload = {
        eventType,
        severity,
        metadata: {
          ...metadata,
          url: window.location.pathname,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`
        },
        timestamp: new Date().toISOString()
      };

      eventQueueRef.current.push(newEvent);

      if (immediateFlush || severity === "HIGH" || severity === "CRITICAL") {
        flushQueue();
      }
    },
    [attemptId, enabled, flushQueue]
  );

  // Request entering fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        logEvent("FULLSCREEN_ENTER", "INFO", { mode: "requestFullscreen" }, true);
      }
    } catch (err) {
      console.warn("Fullscreen request declined or failed:", err);
    }
  }, [logEvent]);

  useEffect(() => {
    if (!attemptId || !enabled) return;

    // 1. Tab / Document Visibility Listener
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerWarning("Warning: You navigated away from the exam tab. This incident has been logged.");
        logEvent("TAB_HIDDEN", "HIGH", { source: "document.visibilitychange" }, true);
      } else {
        logEvent("TAB_VISIBLE", "INFO", { source: "document.visibilitychange" }, false);
      }
    };

    // 2. Window Blur & Focus Listeners
    const handleWindowBlur = () => {
      triggerWarning("Warning: Window lost focus. Switching applications is recorded.");
      logEvent("WINDOW_BLUR", "MEDIUM", { source: "window.blur" }, true);
    };

    const handleWindowFocus = () => {
      logEvent("WINDOW_FOCUS", "INFO", { source: "window.focus" }, false);
    };

    // 3. Fullscreen Change Listener
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        triggerWarning("Warning: Fullscreen exited. Please remain in fullscreen mode.");
        logEvent("FULLSCREEN_EXIT", "HIGH", { source: "document.fullscreenchange" }, true);
      }
    };

    // 4. Clipboard Interceptions (Copy / Paste)
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerWarning("Notice: Copying assessment content is prohibited and has been recorded.");
      logEvent("COPY_ATTEMPT", "HIGH", { source: "clipboard.copy" }, true);
    };

    const handlePaste = (_e: ClipboardEvent) => {
      triggerWarning("Notice: Pasting external content into the exam is recorded.");
      logEvent("PASTE_ATTEMPT", "HIGH", { source: "clipboard.paste" }, true);
    };

    // 5. Context Menu (Right Click) Prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerWarning("Notice: Right-click context menu is disabled during the exam.");
      logEvent("CONTEXT_MENU_ATTEMPT", "LOW", { source: "mouse.contextmenu" }, false);
    };

    // 6. Developer Tools Shortcut Prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      keyEventsCountRef.current += 1;

      // F12 or Ctrl+Shift+I or Ctrl+Shift+J or Ctrl+U
      const isDevToolsShortcut =
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j")) ||
        ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U"));

      if (isDevToolsShortcut) {
        e.preventDefault();
        triggerWarning("Security Alert: Developer inspection tools are strictly prohibited.");
        logEvent("DEVTOOLS_SHORTCUT", "CRITICAL", { key: e.key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }, true);
      }
    };

    // 7. Throttled Mouse & Scroll Listeners
    const handleMouseMove = () => {
      mouseMovesCountRef.current += 1;
    };

    const handleScroll = () => {
      scrollCountRef.current += 1;
    };

    // Register all DOM listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Periodic flush timer (every 5 seconds)
    const flushInterval = setInterval(() => {
      flushQueue();
    }, 5000);

    // Periodic interaction summary timer (every 30 seconds)
    const interactionSummaryInterval = setInterval(() => {
      if (mouseMovesCountRef.current > 0 || scrollCountRef.current > 0 || keyEventsCountRef.current > 0) {
        logEvent(
          "INTERACTION_SUMMARY",
          "INFO",
          {
            mouseMoveTicks: mouseMovesCountRef.current,
            scrollTicks: scrollCountRef.current,
            keyPressCount: keyEventsCountRef.current
          },
          false
        );
        // Reset interval ticks
        mouseMovesCountRef.current = 0;
        scrollCountRef.current = 0;
        keyEventsCountRef.current = 0;
      }
    }, 30000);

    // Flush on window unload
    const handleBeforeUnload = () => {
      if (eventQueueRef.current.length > 0) {
        const token = localStorage.getItem("proctor_token");
        const payload = JSON.stringify({
          attemptId,
          events: eventQueueRef.current
        });
        const url = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/proctor/events`;
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      clearInterval(flushInterval);
      clearInterval(interactionSummaryInterval);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

      // Final unmount flush
      flushQueue();
    };
  }, [attemptId, enabled, flushQueue, logEvent, triggerWarning]);

  return {
    isFullscreen,
    enterFullscreen,
    loggedEventsCount,
    activeWarning,
    logCustomEvent: logEvent
  };
}

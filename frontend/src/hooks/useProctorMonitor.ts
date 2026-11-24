import { useEffect, useRef, useState, useCallback } from "react";
import { proctorService, ProctorEventPayload } from "../services/proctor.service";

interface UseProctorMonitorOptions {
  attemptId: string | null;
  enabled?: boolean;
  onWarning?: (message: string) => void;
  onExtensionBlocked?: (details: string) => void;
}

export function useProctorMonitor({ attemptId, enabled = true, onWarning, onExtensionBlocked }: UseProctorMonitorOptions) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);
  const [loggedEventsCount, setLoggedEventsCount] = useState<number>(0);
  const [activeWarning, setActiveWarning] = useState<string | null>(null);
  const [extensionBlockMessage, setExtensionBlockMessage] = useState<string | null>(null);

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

    // 6. Comprehensive Extension & Unauthorized Shortcut Interception
    const handleKeyDown = (e: KeyboardEvent) => {
      keyEventsCountRef.current += 1;

      const keyUpper = e.key.toUpperCase();
      const isAltKey = e.altKey && e.key !== "Alt";
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey && e.key !== "Shift";
      const isFunctionKey = e.key.startsWith("F") && !isNaN(Number(e.key.substring(1)));

      // Build readable shortcut representation
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.metaKey) parts.push("Cmd");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      parts.push(e.key);
      const shortcutName = parts.join("+");

      // Developer Tools shortcuts: F12, Ctrl+Shift+I/J/C, Ctrl+U
      const isDevToolsShortcut =
        e.key === "F12" ||
        (isCtrlOrMeta && e.shiftKey && ["I", "J", "C"].includes(keyUpper)) ||
        (isCtrlOrMeta && keyUpper === "U");

      // Browser Extension shortcuts:
      // Extensions almost universally invoke via Alt+<key> (e.g., Alt+A, Alt+Shift+X, Alt+S, Alt+M),
      // Ctrl+Shift+<key> (e.g., Ctrl+Shift+K, Ctrl+Shift+E, Ctrl+Shift+P), or Ctrl+Alt+<key>
      const isExtensionShortcut =
        isAltKey || // Any Alt shortcut (e.g. Alt+A, Alt+Tab, Alt+Shift+X)
        (isCtrlOrMeta && isShift && !["I", "J", "C"].includes(keyUpper)) || // Any Ctrl+Shift+<key>
        (isCtrlOrMeta && isAltKey); // Any Ctrl+Alt+<key>

      // Unauthorized Browser Navigation/System shortcuts: Ctrl+P, Ctrl+S, Ctrl+O, Ctrl+H, Ctrl+N, Ctrl+T, Ctrl+W, F1-F11
      const isUnauthorizedShortcut =
        (isFunctionKey && e.key !== "F12") ||
        (isCtrlOrMeta && ["P", "S", "O", "H", "N", "T", "W"].includes(keyUpper));

      if (isDevToolsShortcut) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        triggerWarning(`Security Alert: Developer tools shortcut [${shortcutName}] is strictly prohibited.`);
        logEvent(
          "DEVTOOLS_SHORTCUT",
          "CRITICAL",
          { key: e.key, code: e.code, shortcut: shortcutName, source: "keyboard.capture" },
          true
        );
        return;
      }

      if (isExtensionShortcut) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const blockMsg = `Extension Shortcut [${shortcutName}] Triggered`;
        setExtensionBlockMessage(blockMsg);
        if (onExtensionBlocked) onExtensionBlocked(blockMsg);
        triggerWarning(`Security Alert: Extension shortcut [${shortcutName}] detected and blocked.`);
        logEvent(
          "EXTENSION_SHORTCUT_ATTEMPT",
          "CRITICAL",
          { key: e.key, code: e.code, shortcut: shortcutName, source: "keyboard.capture" },
          true
        );
        return;
      }

      if (isUnauthorizedShortcut) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        triggerWarning(`Notice: System shortcut [${shortcutName}] is disabled during examination.`);
        logEvent(
          "UNAUTHORIZED_SHORTCUT",
          "HIGH",
          { key: e.key, code: e.code, shortcut: shortcutName, source: "keyboard.capture" },
          true
        );
        return;
      }
    };

    // 7. DOM Mutation Observer: Detect Injected Browser Extension Elements
    const EXTENSION_SIGNATURES = [
      "chrome-extension", "moz-extension", "extension", "monica", "sider",
      "merlin", "harpa", "chatgpt", "copilot", "ai-sidebar", "ai-assistant",
      "ai-chat", "quillbot", "deepl", "grammarly", "ask-ai", "sidebar",
      "floating-widget", "ai-box", "translate-tooltip"
    ];

    const checkForExtensionNode = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;

      const id = (node.id || "").toLowerCase();
      const className = typeof node.className === "string" ? node.className.toLowerCase() : "";
      const tagName = node.tagName.toLowerCase();
      const src = (node.getAttribute("src") || "").toLowerCase();

      const isExtensionElement = EXTENSION_SIGNATURES.some((sig) =>
        id.includes(sig) || className.includes(sig) || src.includes(sig)
      );

      const isSuspiciousIframe = tagName === "iframe" && (src.includes("extension") || src.startsWith("chrome-") || src.startsWith("moz-") || !src);

      if (isExtensionElement || isSuspiciousIframe) {
        // Attempt to neutralize injected element
        node.style.display = "none";
        const blockMsg = `Active Extension Component Detected (${tagName}${node.id ? '#' + node.id : ''})`;
        setExtensionBlockMessage(blockMsg);
        if (onExtensionBlocked) onExtensionBlocked(blockMsg);
        triggerWarning("Security Alert: External browser extension assistant detected in page.");
        logEvent(
          "EXTENSION_DOM_INJECTION",
          "CRITICAL",
          {
            tagName,
            elementId: node.id || undefined,
            className: typeof node.className === "string" ? node.className : undefined,
            src: node.getAttribute("src") || undefined
          },
          true
        );
      }
    };

    // Scan pre-existing elements on mount
    document.querySelectorAll("iframe, div[id*='extension'], div[class*='extension'], div[id*='ai-']").forEach(checkForExtensionNode);

    // Observe dynamic injections
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        mut.addedNodes.forEach(checkForExtensionNode);
      }
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "class", "src"]
    });

    // 7. Throttled Mouse & Scroll Listeners
    const handleMouseMove = () => {
      mouseMovesCountRef.current += 1;
    };

    const handleScroll = () => {
      scrollCountRef.current += 1;
    };

    // Register all DOM listeners with capture phase for key events to preempt extensions
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("keydown", handleKeyDown, { capture: true });
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
      window.removeEventListener("keydown", handleKeyDown, { capture: true } as any);
      document.removeEventListener("keydown", handleKeyDown, { capture: true } as any);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      mutationObserver.disconnect();
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
    extensionBlockMessage,
    clearExtensionBlock: () => setExtensionBlockMessage(null),
    logCustomEvent: logEvent
  };
}

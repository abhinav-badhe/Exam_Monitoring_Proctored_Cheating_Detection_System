import React, { useEffect, useRef, useState, useCallback } from "react";
import { proctorService } from "../../services/proctor.service";
import { Monitor, MonitorCheck, AlertTriangle } from "lucide-react";

interface ScreenMonitorProps {
  attemptId: string;
  enabled?: boolean;
  onAnomaly?: (warning: string) => void;
  onLogEvent?: (eventType: string, severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", meta?: any) => void;
}

export const ScreenMonitor: React.FC<ScreenMonitorProps> = ({
  attemptId,
  enabled = true,
  onAnomaly,
  onLogEvent
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isAnalyzingRef = useRef(false);

  const startScreenShare = async () => {
    try {
      setSharingError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      streamRef.current = stream;

      // Handle candidate clicking "Stop sharing" via browser UI bar
      stream.getVideoTracks()[0].onended = () => {
        setIsSharing(false);
        if (onLogEvent) {
          onLogEvent("SCREEN_SHARE_STOPPED", "HIGH", { reason: "Candidate ended display share surface" });
        }
        if (onAnomaly) {
          onAnomaly("Warning: Screen sharing stopped. Active proctored display is required.");
        }
      };

      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setIsSharing(true);
      if (onLogEvent) {
        onLogEvent("SCREEN_SHARE_STARTED", "INFO", { status: "Active" });
      }
    } catch (err: any) {
      console.warn("Screen capture permission declined:", err);
      setSharingError("Screen sharing permission was not granted.");
    }
  };

  const captureAndAnalyzeScreen = useCallback(async () => {
    if (!streamRef.current || !videoRef.current || isAnalyzingRef.current) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = 1280;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * 1280);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        try {
          isAnalyzingRef.current = true;
          const result = await proctorService.analyzeScreenFrame(attemptId, blob);

          if (result.anomalies && result.anomalies.length > 0) {
            const top = result.anomalies[0];
            if (onAnomaly) {
              onAnomaly(`Screen Alert: ${top.description}`);
            }
          }
        } catch (err) {
          console.debug("Screen OCR relay notice:", err);
        } finally {
          isAnalyzingRef.current = false;
        }
      },
      "image/jpeg",
      0.80
    );
  }, [attemptId, onAnomaly]);

  // Periodic screen capture (every 6 seconds)
  useEffect(() => {
    if (!isSharing || !enabled) return;

    const interval = setInterval(() => {
      captureAndAnalyzeScreen();
    }, 6000);

    return () => clearInterval(interval);
  }, [isSharing, enabled, captureAndAnalyzeScreen]);

  // Stop tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-2">
      {isSharing ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold">
          <MonitorCheck className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">Screen Sharing Active</span>
          <span className="sm:hidden">Screen OK</span>
        </span>
      ) : (
        <button
          onClick={startScreenShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 text-xs font-semibold transition"
          title="Share screen for proctoring verification"
        >
          <Monitor className="w-4 h-4 text-blue-600" />
          <span>Share Screen</span>
        </button>
      )}

      {sharingError && (
        <span className="text-2xs text-rose-600 flex items-center gap-1" title={sharingError}>
          <AlertTriangle className="w-3.5 h-3.5" />
          Share required
        </span>
      )}
    </div>
  );
};

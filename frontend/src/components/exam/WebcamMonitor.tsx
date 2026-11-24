import React, { useEffect, useRef, useState } from "react";
import { proctorService, CVAnalysisResult } from "../../services/proctor.service";
import { Camera, CameraOff, AlertTriangle, CheckCircle2, Smartphone, Users } from "lucide-react";

interface WebcamMonitorProps {
  attemptId: string;
  enabled?: boolean;
  onAnomaly?: (warning: string) => void;
}

export const WebcamMonitor: React.FC<WebcamMonitorProps> = ({
  attemptId,
  enabled = true,
  onAnomaly
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<CVAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Initialize camera stream
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
        setPermissionError(null);
      } catch (err: any) {
        if (!mounted) return;
        setHasPermission(false);
        setPermissionError("Camera access denied or device unavailable.");
        console.warn("Camera permission error:", err);
      }
    };

    startWebcam();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [enabled]);

  // Periodic frame sampling (every 3.5s)
  useEffect(() => {
    if (!hasPermission || !enabled) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = 480;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) return;

          try {
            setIsAnalyzing(true);
            const result = await proctorService.analyzeFrame(attemptId, blob);
            setLatestAnalysis(result);

            // Notify on critical anomalies
            if (result.anomalies && result.anomalies.length > 0) {
              const topAnomaly = result.anomalies[0];
              if (onAnomaly) {
                onAnomaly(`Camera Alert: ${topAnomaly.description}`);
              }
            }
          } catch (err) {
            console.debug("Frame CV analysis error:", err);
          } finally {
            setIsAnalyzing(false);
          }
        },
        "image/jpeg",
        0.85
      );
    }, 3500);

    return () => clearInterval(interval);
  }, [hasPermission, enabled, attemptId, isAnalyzing, onAnomaly]);

  const getStatusBadge = () => {
    if (!latestAnalysis) {
      return (
        <span className="flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-xs">
          <Camera className="w-3 h-3 text-emerald-400" />
          Camera Active
        </span>
      );
    }

    if (latestAnalysis.phoneDetected) {
      return (
        <span className="flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-xs animate-pulse">
          <Smartphone className="w-3 h-3" />
          Phone Detected
        </span>
      );
    }

    if (latestAnalysis.faceCount > 1) {
      return (
        <span className="flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-xs">
          <Users className="w-3 h-3" />
          Multiple Faces ({latestAnalysis.faceCount})
        </span>
      );
    }

    if (!latestAnalysis.faceDetected) {
      return (
        <span className="flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
          <AlertTriangle className="w-3 h-3" />
          Face Missing
        </span>
      );
    }

    if (latestAnalysis.lookingAway) {
      return (
        <span className="flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
          <AlertTriangle className="w-3 h-3" />
          Looking Away
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white backdrop-blur-xs">
        <CheckCircle2 className="w-3 h-3" />
        Face Centered
      </span>
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-slate-900/90 p-1.5 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md transition-all duration-300">
      <div className="relative w-44 sm:w-52 aspect-4/3 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
        {hasPermission === false ? (
          <div className="p-3 text-center text-rose-400 text-xs">
            <CameraOff className="w-6 h-6 mx-auto mb-1 text-rose-500" />
            <p className="font-semibold">Camera Inactive</p>
            <p className="text-2xs text-slate-400 mt-0.5">{permissionError || "Permission required"}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            {/* Top Badge Overlay */}
            <div className="absolute top-2 left-2 z-10">{getStatusBadge()}</div>

            {/* Hidden Offscreen Canvas for Frame Capture */}
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>
    </div>
  );
};

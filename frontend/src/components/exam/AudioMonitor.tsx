import React, { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Volume2, AlertTriangle } from "lucide-react";
import { proctorService } from "../../services/proctor.service";

interface AudioMonitorProps {
  attemptId: string;
  enabled?: boolean;
  onAudioAnomaly?: (message: string) => void;
}

export const AudioMonitor: React.FC<AudioMonitorProps> = ({
  attemptId,
  enabled = true,
  onAudioAnomaly
}) => {
  const [audioActive, setAudioActive] = useState<boolean>(false);
  const [currentVolumeDb, setCurrentVolumeDb] = useState<number>(-60);
  const [voiceAlert, setVoiceAlert] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sustainedVoiceCounterRef = useRef<number>(0);
  const lastLogTimeRef = useRef<number>(0);

  // Thresholds
  const VOICE_THRESHOLD_DB = -36; // Decibels threshold typical of speaking voice near laptop mic
  const SUSTAINED_FRAMES_TRIGGER = 8; // ~8 consecutive measurement frames indicating speech rather than a single click

  const startAudioMonitoring = useCallback(async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // Keep false so we catch actual room audio
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      setAudioActive(true);
      monitorAudioLoop();
    } catch (err: any) {
      console.warn("Microphone access declined or unavailable:", err);
      setPermissionError("Microphone permission denied");
      setAudioActive(false);
    }
  }, []);

  const monitorAudioLoop = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const timeData = new Float32Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const checkLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getFloatTimeDomainData(timeData);
      analyserRef.current.getByteFrequencyData(freqData);

      // 1. Calculate RMS volume
      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i++) {
        sumSquares += timeData[i] * timeData[i];
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      // Convert to dB (-100 to 0)
      const db = rms > 0.00001 ? Math.max(-100, Math.round(20 * Math.log10(rms))) : -100;
      setCurrentVolumeDb(db);

      // 2. Frequency speech band estimation (Speech fundamental frequencies ~85-3000 Hz)
      // Bin bandwidth = sampleRate / fftSize = ~48000 / 512 ≈ 93.75 Hz
      let speechBandEnergy = 0;
      for (let bin = 1; bin < Math.min(32, freqData.length); bin++) {
        speechBandEnergy += freqData[bin];
      }
      const avgSpeechEnergy = speechBandEnergy / 31;

      // 3. Detect sustained voice or loud speaking
      if (db > VOICE_THRESHOLD_DB && avgSpeechEnergy > 45) {
        sustainedVoiceCounterRef.current += 1;

        if (sustainedVoiceCounterRef.current >= SUSTAINED_FRAMES_TRIGGER) {
          setVoiceAlert(true);
          const now = Date.now();

          // Throttle event logging to once every 6 seconds
          if (now - lastLogTimeRef.current > 6000) {
            lastLogTimeRef.current = now;

            const warningMsg = "Notice: Sustained verbal communication or high room noise detected. Please remain silent.";
            if (onAudioAnomaly) onAudioAnomaly(warningMsg);

            proctorService.ingestEvents(attemptId, [
              {
                eventType: "VOICE_ACTIVITY_DETECTED",
                severity: "HIGH",
                timestamp: new Date().toISOString(),
                metadata: {
                  volumeDb: db,
                  speechEnergy: Math.round(avgSpeechEnergy),
                  source: "WEBAUDIO_ANALYSER"
                }
              }
            ]).catch(() => {});
          }
        }
      } else {
        sustainedVoiceCounterRef.current = Math.max(0, sustainedVoiceCounterRef.current - 1);
        if (sustainedVoiceCounterRef.current === 0) {
          setVoiceAlert(false);
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkLevel);
    };

    animationFrameRef.current = requestAnimationFrame(checkLevel);
  };

  useEffect(() => {
    if (enabled && attemptId) {
      startAudioMonitoring();
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [enabled, attemptId, startAudioMonitoring]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
      <div
        className={`px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md shadow-lg flex items-center space-x-2 transition-all ${
          voiceAlert
            ? "bg-rose-950/90 text-rose-300 border-rose-600 animate-pulse"
            : audioActive
            ? "bg-slate-900/80 text-emerald-300 border-slate-700"
            : "bg-slate-900/80 text-slate-400 border-slate-700"
        }`}
      >
        {audioActive ? (
          <>
            <div className="flex items-center space-x-1">
              <span className={`w-2 h-2 rounded-full ${voiceAlert ? "bg-rose-500 animate-ping" : "bg-emerald-400"}`}></span>
              <Mic className="w-3.5 h-3.5" />
            </div>
            <span>
              {voiceAlert ? "Voice/Noise Detected" : "Acoustic Guard Active"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({currentVolumeDb} dB)
            </span>
          </>
        ) : (
          <>
            <MicOff className="w-3.5 h-3.5 text-rose-400" />
            <span>{permissionError || "Mic Inactive"}</span>
            <button
              onClick={startAudioMonitoring}
              className="ml-1 underline text-blue-400 hover:text-blue-300 text-[10px]"
            >
              Retry
            </button>
          </>
        )}
      </div>

      {voiceAlert && (
        <div className="px-2.5 py-1 rounded-lg bg-rose-900/90 border border-rose-500 text-rose-100 text-xs font-medium flex items-center space-x-1.5 shadow-md">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
          <span>Keep silence</span>
        </div>
      )}
    </div>
  );
};

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  cancelChatAudioRecording,
  getChatAudioAmplitude,
  startChatAudioRecording,
  stopChatAudioRecordingAsFile,
} from "@/lib/capacitor/audioRecorder";
import { MAX_AUDIO_DURATION_MS } from "../utils/chatAudioConstants";
import { smoothChatAudioAmplitude } from "../utils/normalizeChatAudioAmplitude";
import { validateChatAudioFile } from "../utils/chatAudioValidation";

const AMPLITUDE_POLL_MS = 50;
const ELAPSED_TICK_MS = 200;

export interface ChatAudioRecordingResult {
  file: File;
  durationMs: number;
}

export function useChatAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPendingRecording, setHasPendingRecording] = useState(false);
  const [hitMaxDuration, setHitMaxDuration] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const amplitudeRef = useRef<number | null>(null);
  const autoStopRef = useRef(false);
  const pendingRecordingRef = useRef<ChatAudioRecordingResult | null>(null);
  const finalizeRecordingRef = useRef<() => Promise<ChatAudioRecordingResult | null>>(
    async () => null,
  );

  const remainingMs = Math.max(0, MAX_AUDIO_DURATION_MS - elapsedMs);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (amplitudeRef.current !== null) {
      window.clearInterval(amplitudeRef.current);
      amplitudeRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    clearTimers();
    startedAtRef.current = null;
    autoStopRef.current = false;
    pendingRecordingRef.current = null;
    setIsRecording(false);
    setHasPendingRecording(false);
    setHitMaxDuration(false);
    setElapsedMs(0);
    setAmplitude(0);
    setIsBusy(false);
  }, [clearTimers]);

  const finalizeLiveRecording = useCallback(async (): Promise<ChatAudioRecordingResult | null> => {
    if (pendingRecordingRef.current) {
      return pendingRecordingRef.current;
    }

    if (!startedAtRef.current && !isRecording) {
      return null;
    }

    clearTimers();

    try {
      const { file, durationMs: rawDurationMs } = await stopChatAudioRecordingAsFile();
      const durationMs = Math.min(Math.max(0, rawDurationMs), MAX_AUDIO_DURATION_MS);
      startedAtRef.current = null;
      setIsRecording(false);
      setAmplitude(0);

      const result: ChatAudioRecordingResult = { file, durationMs };
      pendingRecordingRef.current = result;
      setHasPendingRecording(true);
      setElapsedMs(durationMs);
      return result;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível finalizar a gravação.",
      );
      return null;
    }
  }, [clearTimers, isRecording]);

  finalizeRecordingRef.current = finalizeLiveRecording;

  const stopRecording = useCallback(async (): Promise<ChatAudioRecordingResult | null> => {
    setIsBusy(true);

    try {
      const result = pendingRecordingRef.current ?? (await finalizeLiveRecording());
      if (!result) return null;

      const validationError = validateChatAudioFile(result.file, result.durationMs);
      if (validationError) {
        toast.error(validationError);
        return null;
      }

      return result;
    } finally {
      resetState();
    }
  }, [finalizeLiveRecording, resetState]);

  const cancelRecording = useCallback(async () => {
    setIsBusy(true);
    clearTimers();

    try {
      if (isRecording) {
        await cancelChatAudioRecording();
      }
    } catch {
      // noop
    } finally {
      resetState();
    }
  }, [clearTimers, isRecording, resetState]);

  const startRecording = useCallback(async () => {
    if (isRecording || isBusy || startedAtRef.current || pendingRecordingRef.current) return;
    setIsBusy(true);

    try {
      await startChatAudioRecording();
      startedAtRef.current = Date.now();
      autoStopRef.current = false;
      setHitMaxDuration(false);
      setHasPendingRecording(false);
      setIsRecording(true);
      setElapsedMs(0);
      setAmplitude(0);

      timerRef.current = window.setInterval(() => {
        if (!startedAtRef.current) return;
        const nextElapsed = Date.now() - startedAtRef.current;
        setElapsedMs(Math.min(nextElapsed, MAX_AUDIO_DURATION_MS));

        if (nextElapsed >= MAX_AUDIO_DURATION_MS && !autoStopRef.current) {
          autoStopRef.current = true;
          setHitMaxDuration(true);
          setIsBusy(true);
          void finalizeRecordingRef.current?.().finally(() => setIsBusy(false));
        }
      }, ELAPSED_TICK_MS);

      amplitudeRef.current = window.setInterval(() => {
        void getChatAudioAmplitude()
          .then((value) => {
            setAmplitude((previous) => smoothChatAudioAmplitude(previous, value));
          })
          .catch(() => setAmplitude((previous) => previous * 0.5));
      }, AMPLITUDE_POLL_MS);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível iniciar a gravação.",
      );
      resetState();
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, isRecording, resetState]);

  useEffect(() => {
    return () => {
      clearTimers();
      void cancelChatAudioRecording().catch(() => undefined);
    };
  }, [clearTimers]);

  return {
    isRecording,
    hasPendingRecording,
    hitMaxDuration,
    isBusy,
    elapsedMs,
    remainingMs,
    amplitude,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};

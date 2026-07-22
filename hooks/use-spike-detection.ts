import { useCallback, useEffect, useRef } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Location from 'expo-location';

import { API_KEY, INCIDENT_ENDPOINT } from '@/constants/backend';

// ---------------------------------------------------------------------------
// Task 5: volume threshold for spike detection.
//
// expo-audio reports `metering` on a dBFS-style scale where 0 is the loudest
// and more-negative numbers are quieter (e.g. -60 is near silence). A shout or
// scream typically lands around -10 to -20.
//
// TUNE THIS ON A REAL DEVICE: with __DEV__ logging on (see below), watch the
// console while talking normally vs. shouting, then pick a value between the
// two. Start at -15.
// ---------------------------------------------------------------------------
const SPIKE_THRESHOLD_DB = -15;

// Disabled for now so recording only happens via the deliberate PIN + "="
// trigger, not ambient loud sound — makes testing less confusing. Flip to
// true to re-enable automatic loud-sound detection.
const AUTO_SPIKE_DETECTION_ENABLED = false;

// How long to capture after a spike is detected, in milliseconds (task 2).
const CAPTURE_DURATION_MS = 15_000;

// How often to sample the microphone level, in milliseconds. Lower = more
// responsive spike detection, at a small battery cost.
const METERING_INTERVAL_MS = 200;

/**
 * Runs a silent background audio monitor. While mounted it continuously listens
 * to the microphone; when the volume crosses SPIKE_THRESHOLD_DB it records a
 * 15-second clip, grabs the current GPS location, and uploads both to the
 * backend. Designed to run behind the calculator UI without any visible effect.
 */
export function useSpikeDetection() {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true, // required — presets do not enable metering
  });
  const recorderState = useAudioRecorderState(recorder, METERING_INTERVAL_MS);

  // True while we're inside a 15s capture, so repeated loud frames don't stack.
  const capturingRef = useRef(false);
  const mountedRef = useRef(true);

  // Lets stopCaptureEarly interrupt the CAPTURE_DURATION_MS wait below.
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureResolveRef = useRef<(() => void) | null>(null);

  // Start monitoring: permissions -> audio mode -> begin recording.
  const startMonitoring = useCallback(async () => {
    const mic = await AudioModule.requestRecordingPermissionsAsync();
    if (!mic.granted) {
      console.warn('[SilentWitness] Microphone permission denied — cannot monitor.');
      return;
    }
    // Ask for location up front so the grab on spike is instant.
    await Location.requestForegroundPermissionsAsync();

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  // Grab GPS + upload the recorded clip to the backend (tasks 2 & 3).
  const uploadIncident = useCallback(async (audioUri: string) => {
    let coords = { latitude: 0, longitude: 0 };
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      coords = loc.coords;
    } catch (err) {
      console.warn('[SilentWitness] Could not get location:', err);
    }

    const form = new FormData();
    // Field names must match the FastAPI endpoint exactly (main.py /api/incident).
    form.append('latitude', String(coords.latitude));
    form.append('longitude', String(coords.longitude));
    form.append('audio_file', {
      uri: audioUri,
      name: `incident_${audioUri.split('/').pop() ?? 'clip.m4a'}`,
      type: 'audio/m4a',
    } as any);

    try {
      const res = await fetch(INCIDENT_ENDPOINT, {
        method: 'POST',
        headers: { 'X-API-KEY': API_KEY },
        body: form,
      });
      const body = await res.json();
      console.log('[SilentWitness] Incident uploaded:', res.status, body);
    } catch (err) {
      console.warn('[SilentWitness] Upload failed:', err);
    }
  }, []);

  // Handle a detected spike or manual trigger: capture 15s, then upload, then
  // resume monitoring.
  const handleSpike = useCallback(async (source: 'auto' | 'manual' = 'auto') => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    console.log(
      source === 'manual'
        ? '[SilentWitness] PIN entered — starting manual capture (15s).'
        : '[SilentWitness] Spike detected — capturing 15s.'
    );

    try {
      // The recorder was already running (for metering), so restart it fresh
      // here — otherwise the saved clip would include everything recorded
      // since monitoring began, not just the CAPTURE_DURATION_MS after this
      // trigger. Stop, then start clean.
      await recorder.stop();
      await recorder.prepareToRecordAsync();
      recorder.record();

      await new Promise<void>((resolve) => {
        captureResolveRef.current = resolve;
        captureTimeoutRef.current = setTimeout(resolve, CAPTURE_DURATION_MS);
      });
      captureResolveRef.current = null;
      captureTimeoutRef.current = null;
      if (!mountedRef.current) return;

      await recorder.stop();
      const audioUri = recorder.uri;

      if (audioUri) {
        await uploadIncident(audioUri);
      } else {
        console.warn('[SilentWitness] No audio URI after stop.');
      }

      // Resume monitoring for the next spike.
      if (mountedRef.current) {
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (err) {
      // Without this, a thrown error here (e.g. recorder.stop() failing)
      // would leave capturingRef stuck `true` forever, silently disabling
      // all future spike detection AND manual PIN-triggered captures for
      // the rest of the session, with no visible error.
      console.error('[SilentWitness] Capture failed:', err);
    } finally {
      capturingRef.current = false;
    }
  }, [recorder, uploadIncident]);

  // Start monitoring on mount; stop on unmount.
  useEffect(() => {
    mountedRef.current = true;
    startMonitoring();
    return () => {
      mountedRef.current = false;
      recorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Task 1: watch the metering level and fire on a spike.
  useEffect(() => {
    if (!AUTO_SPIKE_DETECTION_ENABLED) return;

    const level = recorderState.metering;
    if (level == null) return;

    // Uncomment while tuning SPIKE_THRESHOLD_DB on a device:
    // if (__DEV__) console.log('[SilentWitness] level', level.toFixed(1));

    if (level > SPIKE_THRESHOLD_DB && !capturingRef.current) {
      handleSpike('auto');
    }
  }, [recorderState.metering, handleSpike]);

  // Interrupts an in-progress capture (e.g. the listening screen's 4-tap exit)
  // so it stops and uploads immediately instead of waiting out the full 15s.
  const stopCaptureEarly = useCallback(() => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    if (captureResolveRef.current) {
      const resolve = captureResolveRef.current;
      captureResolveRef.current = null;
      resolve();
    }
  }, []);

  // The `allowsRecording` audio mode this monitor needs puts iOS in the
  // .playAndRecord session category, which defaults audio OUTPUT to the quiet
  // earpiece receiver, not the speaker — so incident playback elsewhere in the
  // app would be nearly inaudible while this is active. Call this before
  // playing back audio, then resumeMonitoring() when done.
  const pauseMonitoring = useCallback(async () => {
    await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    console.log('[SilentWitness] Monitoring paused — audio session switched to playback mode.');
  }, [recorder]);

  const resumeMonitoring = useCallback(async () => {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    console.log('[SilentWitness] Monitoring resumed.');
  }, [recorder]);

  // Lets other UI (e.g. the secret PIN entry) force the same 15s
  // capture-and-upload flow used for automatic spike detection.
  const triggerManualCapture = useCallback(() => handleSpike('manual'), [handleSpike]);

  return { triggerManualCapture, stopCaptureEarly, pauseMonitoring, resumeMonitoring };
}

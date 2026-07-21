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

  // Handle a detected spike: capture 15s, then upload, then resume monitoring.
  const handleSpike = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    console.log('[SilentWitness] Spike detected — capturing 15s.');

    // The recorder is already running (for metering), so it has been capturing
    // audio around the spike. Let it run CAPTURE_DURATION_MS more, then stop.
    await new Promise((resolve) => setTimeout(resolve, CAPTURE_DURATION_MS));
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
    capturingRef.current = false;
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
    const level = recorderState.metering;
    if (level == null) return;

    // Uncomment while tuning SPIKE_THRESHOLD_DB on a device:
    // if (__DEV__) console.log('[SilentWitness] level', level.toFixed(1));

    if (level > SPIKE_THRESHOLD_DB && !capturingRef.current) {
      handleSpike();
    }
  }, [recorderState.metering, handleSpike]);
}

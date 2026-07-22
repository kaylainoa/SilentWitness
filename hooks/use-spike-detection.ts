import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { API_KEY, INCIDENT_ENDPOINT } from '@/constants/backend';

// ---------------------------------------------------------------------------
// Volume threshold for flagging a spike DURING an active capture (it no
// longer starts a capture on its own — see handleCapture below).
//
// expo-audio reports `metering` on a dBFS-style scale where 0 is the loudest
// and more-negative numbers are quieter (e.g. -60 is near silence). A shout or
// scream typically lands around -10 to -20.
// ---------------------------------------------------------------------------
const SPIKE_THRESHOLD_DB = -20;

// How often to sample the microphone level, in milliseconds.
const METERING_INTERVAL_MS = 200;

// How long to capture after the PIN + "=" trigger, in milliseconds.
const CAPTURE_DURATION_MS = 15_000;

/**
 * Recording only ever starts on the deliberate PIN + "=" entry on the
 * calculator — there is no continuous background recording, so nothing is
 * ever captured before that trigger. Each capture runs for exactly
 * CAPTURE_DURATION_MS and then stops; recording does not resume until the
 * trigger is used again. If the volume spikes above SPIKE_THRESHOLD_DB at any
 * point during that window, the resulting incident is flagged (has_spike) so
 * the log screen can show a warning marker — it does not start another capture.
 */
export function useSpikeDetection() {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true, // required — presets do not enable metering
  });
  const recorderState = useAudioRecorderState(recorder, METERING_INTERVAL_MS);

  // True only while a 15s capture is actively running.
  const capturingRef = useRef(false);
  const mountedRef = useRef(true);

  // Lets stopCaptureEarly interrupt the CAPTURE_DURATION_MS wait below.
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureResolveRef = useRef<(() => void) | null>(null);

  // Set when stopCaptureEarly() (the listening screen's 4-tap exit) already
  // navigated back, so the natural-completion path below doesn't also call
  // router.back() and pop an extra screen.
  const earlyExitRef = useRef(false);

  // Set if the volume crosses SPIKE_THRESHOLD_DB at any point during the
  // current capture; reset at the start of each capture.
  const spikeDuringCaptureRef = useRef(false);

  // Ask for mic + location permissions up front, and set the audio mode, so
  // there's no delay when a capture actually starts — but do NOT start
  // recording here. Recording only begins inside handleCapture.
  const preparePermissions = useCallback(async () => {
    const mic = await AudioModule.requestRecordingPermissionsAsync();
    if (!mic.granted) {
      console.warn('[SilentWitness] Microphone permission denied — cannot record.');
      return;
    }
    await Location.requestForegroundPermissionsAsync();

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
  }, []);

  // Grab GPS + upload the recorded clip to the backend.
  const uploadIncident = useCallback(async (audioUri: string, hasSpike: boolean) => {
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
    form.append('has_spike', hasSpike ? 'true' : 'false');
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

  // The PIN + "=" trigger: start a fresh recording, capture 15s (flagging any
  // volume spike along the way), then upload and go idle again.
  const handleCapture = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    spikeDuringCaptureRef.current = false;
    console.log('[SilentWitness] PIN entered — starting capture (15s).');

    try {
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

      // Dismiss the black screen back to the calculator now that recording has
      // stopped — unless the 4-tap exit already did this itself.
      if (earlyExitRef.current) {
        earlyExitRef.current = false;
      } else {
        router.back();
      }

      if (audioUri) {
        await uploadIncident(audioUri, spikeDuringCaptureRef.current);
      } else {
        console.warn('[SilentWitness] No audio URI after stop.');
      }

      // Deliberately not resuming recording here — it stays idle until the
      // PIN + "=" trigger is used again.
    } catch (err) {
      // Without this, a thrown error here (e.g. recorder.stop() failing)
      // would leave capturingRef stuck `true` forever, silently disabling
      // all future PIN-triggered captures for the rest of the session, with
      // no visible error.
      console.error('[SilentWitness] Capture failed:', err);
    } finally {
      capturingRef.current = false;
    }
  }, [recorder, uploadIncident]);

  // Prepare permissions/audio mode on mount; make sure recording stops on unmount.
  useEffect(() => {
    mountedRef.current = true;
    preparePermissions();
    return () => {
      mountedRef.current = false;
      recorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While a capture is active, flag (but don't act on) a volume spike so the
  // resulting incident can be marked in the log screen.
  useEffect(() => {
    if (!capturingRef.current) return;

    const level = recorderState.metering;
    if (level == null) return;

    if (level > SPIKE_THRESHOLD_DB) {
      spikeDuringCaptureRef.current = true;
    }
  }, [recorderState.metering]);

  // Interrupts an in-progress capture (e.g. the listening screen's 4-tap exit)
  // so it stops and uploads immediately instead of waiting out the full 15s.
  const stopCaptureEarly = useCallback(() => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    if (captureResolveRef.current) {
      earlyExitRef.current = true;
      const resolve = captureResolveRef.current;
      captureResolveRef.current = null;
      resolve();
    }
  }, []);

  // The `allowsRecording` audio mode puts iOS in the .playAndRecord session
  // category, which defaults audio OUTPUT to the quiet earpiece receiver, not
  // the speaker — so incident playback elsewhere in the app would be nearly
  // inaudible while this is set. Call this before playing back audio, then
  // resumeMonitoring() when done.
  const pauseMonitoring = useCallback(async () => {
    await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    console.log('[SilentWitness] Audio session switched to playback mode.');
  }, [recorder]);

  const resumeMonitoring = useCallback(async () => {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    console.log('[SilentWitness] Audio session switched back to recording-ready mode.');
  }, []);

  // Lets other UI (e.g. the secret PIN entry) start the same capture-and-upload flow.
  const triggerManualCapture = useCallback(() => handleCapture(), [handleCapture]);

  return { triggerManualCapture, stopCaptureEarly, pauseMonitoring, resumeMonitoring };
}

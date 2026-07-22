import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_KEY, incidentAudioUrl, INCIDENTS_ENDPOINT } from '@/constants/backend';
import { useRecording } from '@/contexts/recording-context';

type Incident = {
  id: number;
  timestamp: number;
  latitude: string;
  longitude: string;
  audio_file_path: string;
};

type LoadState = 'loading' | 'loaded' | 'error';

export default function IncidentsScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const { pauseMonitoring, resumeMonitoring } = useRecording();

  // The background monitor's audio mode routes playback to the quiet earpiece
  // receiver, not the speaker — pause it while this screen (where you'd
  // actually listen to a clip) is open, and resume it on the way out.
  useEffect(() => {
    pauseMonitoring();
    return () => {
      resumeMonitoring();
    };
  }, [pauseMonitoring, resumeMonitoring]);

  const loadIncidents = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await fetch(INCIDENTS_ENDPOINT, {
        headers: { 'X-API-KEY': API_KEY },
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const body = await res.json();
      setIncidents(body.incidents ?? []);
      setLoadState('loaded');
    } catch (err) {
      console.warn('[SilentWitness] Failed to load incidents:', err);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Audio Logs</Text>
        <Pressable onPress={loadIncidents} hitSlop={8}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loadState === 'loading' && <Text style={styles.statusText}>Loading…</Text>}

        {loadState === 'error' && (
          <Text style={styles.statusText}>
            Couldn&apos;t reach the server. Check that the backend is running and reachable, then
            pull to refresh.
          </Text>
        )}

        {loadState === 'loaded' && incidents.length === 0 && (
          <Text style={styles.statusText}>No incidents recorded yet.</Text>
        )}

        {loadState === 'loaded' &&
          incidents
            .slice()
            .reverse()
            .map((incident) => <IncidentCard key={incident.id} incident={incident} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  const player = useAudioPlayer(incidentAudioUrl(incident.id));
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    console.log(`[SilentWitness] Incident #${incident.id} player status:`, {
      isLoaded: status.isLoaded,
      playing: status.playing,
      isBuffering: status.isBuffering,
      duration: status.duration,
      currentTime: status.currentTime,
      playbackState: status.playbackState,
      reasonForWaitingToPlay: status.reasonForWaitingToPlay,
    });
  }, [
    incident.id,
    status.isLoaded,
    status.playing,
    status.isBuffering,
    status.duration,
    status.currentTime,
    status.playbackState,
    status.reasonForWaitingToPlay,
  ]);

  const togglePlayback = () => {
    console.log(`[SilentWitness] Play/Pause tapped for incident #${incident.id}`);
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Incident #{incident.id}</Text>
        <Text style={styles.cardDate}>{formatTimestamp(incident.timestamp)}</Text>
      </View>
      <Text style={styles.cardLocation}>
        {Number(incident.latitude).toFixed(5)}, {Number(incident.longitude).toFixed(5)}
      </Text>

      <View style={styles.cardActions}>
        <Pressable
          onPress={() =>
            Linking.openURL(`https://maps.google.com/?q=${incident.latitude},${incident.longitude}`)
          }
          hitSlop={8}>
          <Text style={styles.cardLink}>Open location in Maps</Text>
        </Pressable>

        <Pressable onPress={togglePlayback} hitSlop={8}>
          <Text style={styles.cardLink}>
            {status.isBuffering && !status.playing
              ? 'Loading…'
              : status.playing
                ? '⏸ Pause'
                : '▶ Play'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatTimestamp(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString();
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeText: {
    color: '#a5a5a5',
    fontSize: 17,
  },
  refreshText: {
    color: '#ff9f0a',
    fontSize: 15,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  statusText: {
    color: '#a5a5a5',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardDate: {
    color: '#a5a5a5',
    fontSize: 13,
  },
  cardLocation: {
    color: '#a5a5a5',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardLink: {
    color: '#ff9f0a',
    fontSize: 13,
    fontWeight: '600',
  },
});

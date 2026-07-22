import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { useRecording } from '@/contexts/recording-context';

// Number of taps required, in a row, to exit and stop the recording early.
// Deliberately more than one so an accidental brush of the screen (e.g. in a
// pocket) doesn't cut the capture short.
const EXIT_TAP_COUNT = 4;
const EXIT_TAP_WINDOW_MS = 1500;

export default function ListeningScreen() {
  const pulse = useRef(new Animated.Value(0.3)).current;
  const { stopCaptureEarly } = useRecording();

  const tapCountRef = useRef(0);
  const tapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const handleTap = () => {
    tapCountRef.current += 1;

    if (tapResetTimeoutRef.current) {
      clearTimeout(tapResetTimeoutRef.current);
      tapResetTimeoutRef.current = null;
    }

    if (tapCountRef.current >= EXIT_TAP_COUNT) {
      tapCountRef.current = 0;
      stopCaptureEarly();
      router.back();
      return;
    }

    tapResetTimeoutRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, EXIT_TAP_WINDOW_MS);
  };

  return (
    <Pressable style={styles.container} onPress={handleTap}>
      <StatusBar style="light" hidden />
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  dot: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff9f0a',
  },
});

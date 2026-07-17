import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboarding } from '@/contexts/onboarding-context';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '🔢',
    title: 'Welcome',
    description: 'Everything you need, right where you left it.',
  },
  {
    icon: '⚡️',
    title: 'Fast & Simple',
    description: 'A clean, focused design so you can get things done without the clutter.',
  },
  {
    icon: '✅',
    title: "You're all set",
    description: "Let's get started.",
  },
];

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const { completeOnboarding } = useOnboarding();

  const isLastSlide = index === SLIDES.length - 1;

  const finishOnboarding = () => {
    completeOnboarding();
  };

  const goToNext = () => {
    if (isLastSlide) {
      finishOnboarding();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable style={styles.skip} onPress={finishOnboarding} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}>
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{slide.icon}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Pressable style={styles.button} onPress={goToNext}>
          <Text style={styles.buttonText}>{isLastSlide ? 'Get Started' : 'Next'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  skip: {
    position: 'absolute',
    top: 16,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: '#a5a5a5',
    fontSize: 16,
    fontWeight: '500',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    color: '#a5a5a5',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
  },
  dotActive: {
    backgroundColor: '#ff9f0a',
    width: 20,
  },
  button: {
    backgroundColor: '#ff9f0a',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '600',
  },
});

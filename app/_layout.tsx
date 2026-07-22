import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import 'react-native-reanimated';

import { OnboardingContext } from '@/contexts/onboarding-context';
import { ProfileProvider } from '@/contexts/profile-context';
import { RecordingProvider } from '@/contexts/recording-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [hasOnboarded, setHasOnboarded] = useState(false);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ProfileProvider>
        <RecordingProvider>
          <OnboardingContext.Provider value={{ completeOnboarding: () => setHasOnboarded(true) }}>
            <Stack>
              <Stack.Protected guard={!hasOnboarded}>
                <Stack.Screen
                  name="onboarding"
                  options={{ headerShown: false, gestureEnabled: false }}
                />
              </Stack.Protected>
              <Stack.Protected guard={hasOnboarded}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack.Protected>
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="profile" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen
                name="incidents"
                options={{ presentation: 'modal', headerShown: false }}
              />
              <Stack.Screen
                name="listening"
                options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
              />
            </Stack>
          </OnboardingContext.Provider>
        </RecordingProvider>
      </ProfileProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

import { createContext, useContext } from 'react';

export const OnboardingContext = createContext<{
  completeOnboarding: () => void;
} | null>(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

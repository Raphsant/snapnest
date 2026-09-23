import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = 'snapnest-onboarding';

/**
 * Whether the one-time onboarding has been completed. Deliberately PER-DEVICE,
 * not per-account: it is never cleared by `sessionService` logout, so logging
 * out and back in (or switching accounts) does not replay onboarding.
 *
 * `hasHydrated` guards the RootNavigator gate: until AsyncStorage has rehydrated
 * we can't know the real value, and branching on the default `false` would flash
 * onboarding at a returning user. RootNavigator holds the splash until this and
 * the auth store are both hydrated.
 */
type OnboardingState = {
  hasSeenOnboarding: boolean;
  hasHydrated: boolean;
};

type OnboardingActions = {
  markSeen: () => void;
  setHydrated: () => void;
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      hasHydrated: false,

      markSeen: () => {
        set({ hasSeenOnboarding: true });
      },
      setHydrated: () => {
        set({ hasHydrated: true });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Only the flag is durable; hasHydrated is derived at runtime.
      partialize: (state) => ({ hasSeenOnboarding: state.hasSeenOnboarding }),
      // Fires after rehydration completes (success or failure) — either way we
      // now know the persisted value and can let the gate proceed.
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

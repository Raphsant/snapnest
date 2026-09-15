import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeName = 'comfort' | 'blue';

const STORAGE_KEY = 'snapnest-theme';

/**
 * Selected appearance. PER-DEVICE (not cleared by sessionService logout), same
 * pattern as onboardingStore. `hasHydrated` lets the app root hold the launch
 * background until the real value is known, so a Blue user never flashes cream.
 */
type ThemeState = {
  theme: ThemeName;
  hasHydrated: boolean;
};

type ThemeActions = {
  setTheme: (theme: ThemeName) => void;
  setHydrated: () => void;
};

export const useThemeStore = create<ThemeState & ThemeActions>()(
  persist(
    (set) => ({
      theme: 'comfort',
      hasHydrated: false,
      setTheme: (theme: ThemeName) => set({ theme }),
      setHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

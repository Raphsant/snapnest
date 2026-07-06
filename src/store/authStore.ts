import { create } from 'zustand';

import type { AuthSessionUser, CognitoUserAttributes } from '../services/authService';
import * as authService from '../services/authService';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  isHydrated: boolean;
};

type AuthActions = {
  setUser: (user: AuthUser | null) => void;
  clearUser: () => void;
  /**
   * Session wipe: drops all user data. Keeps `isHydrated: true` on purpose —
   * hydration already ran this launch, and RootNavigationTree would otherwise
   * sit on the splash screen forever (its hydrate effect only runs on mount).
   */
  reset: () => void;
  hydrate: () => Promise<void>;
};

function toStoreUser(sessionUser: AuthSessionUser, attrs: CognitoUserAttributes): AuthUser {
  return {
    id: sessionUser.userId,
    email: attrs.email,
    firstName: attrs.givenName,
  };
}

/** Derived helper: authenticated when `user` is non-null */
export function selectIsAuthenticated(state: AuthState): boolean {
  return state.user !== null;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  isLoading: false,
  isHydrated: false,

  setUser: (user: AuthUser | null) => {
    set({ user });
  },

  clearUser: () => {
    set({ user: null });
  },

  reset: () => {
    set({ user: null, isLoading: false });
  },

  hydrate: async () => {
    if (get().isLoading) {
      return;
    }
    set({ isLoading: true });
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        set({ user: null });
        return;
      }
      const attrs = await authService.getUserAttributes();
      set({ user: toStoreUser(currentUser, attrs) });
    } catch (error: unknown) {
      console.error('[authStore] hydrate failed', error);
      set({ user: null });
    } finally {
      set({ isHydrated: true, isLoading: false });
    }
  },
}));

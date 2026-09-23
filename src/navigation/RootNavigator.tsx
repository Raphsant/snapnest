import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { GlassTabBar } from '../components/GlassTabBar';
import { TabScreenFade } from '../components/ScreenTransition';
import { AuthFlow } from './AuthFlow';
import type { MainTabParamList } from './mainTabTypes';
import { ActivityScreen } from '../screens/ActivityScreen';
import { AgencyStack } from './AgencyStack';
import { AgencyUpsellScreen } from '../screens/AgencyUpsellScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { FoldersStack } from './FoldersStack';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SettingsStack } from './SettingsStack';
import { useMe } from '../hooks/useMe';
import { registerIfGranted } from '../services/notificationService';
import { processQueue } from '../services/uploadManager';
import { selectIsAuthenticated, useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useUploadQueueStore } from '../store/uploadQueueStore';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Agency tab is always visible; what renders inside depends on /me:
 * - memberships → existing AgencyStack workspace
 * - no memberships → upsell placeholder
 * - /me pending or failed → spinner / retry (never flash the upsell at members)
 */
function AgencyTab(): React.ReactElement {
  const meQuery = useMe();
  const theme = useTheme();
  const styles = useAgencyTabStyles();

  if (meQuery.data === undefined) {
    return (
      <View style={styles.container}>
        {meQuery.isError ? (
          <>
            <Text style={styles.errorText}>Couldn&apos;t load your account</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading account"
              onPress={() => void meQuery.refetch()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
            >
              <Text style={styles.retryLabel}>Tap to retry</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={theme.colors.accent} />
        )}
      </View>
    );
  }

  if (meQuery.data.memberships.length > 0) {
    return <AgencyStack />;
  }

  return <AgencyUpsellScreen />;
}

const useAgencyTabStyles = createThemedStyles((t) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.bg,
    paddingHorizontal: 24,
  },
  errorText: {
    fontFamily: t.typography.body[400],
    fontSize: 14,
    color: t.colors.muted,
    marginBottom: 14,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.line2,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryLabel: {
    fontFamily: t.typography.body[600],
    fontSize: 13.5,
    color: t.colors.accent,
  },
}));

// Non-camera tabs fade-lift on focus. The Camera tab is deliberately NOT wrapped
// so the live viewfinder never fades or transforms on tab switch.
function FoldersTabScreen(): React.ReactElement {
  return (
    <TabScreenFade>
      <FoldersStack />
    </TabScreenFade>
  );
}
function UploadsTabScreen(): React.ReactElement {
  return (
    <TabScreenFade>
      <ActivityScreen />
    </TabScreenFade>
  );
}
function AgencyTabScreen(): React.ReactElement {
  return (
    <TabScreenFade>
      <AgencyTab />
    </TabScreenFade>
  );
}
function SettingsTabScreen(): React.ReactElement {
  return (
    <TabScreenFade>
      <SettingsStack />
    </TabScreenFade>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Camera"
      tabBar={(props) => <GlassTabBar {...props} />}
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Folders" component={FoldersTabScreen} options={{ title: 'Folders', tabBarLabel: 'Folders' }} />
      <Tab.Screen name="Activity" component={UploadsTabScreen} options={{ title: 'Uploads', tabBarLabel: 'Uploads' }} />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          title: 'Camera',
          tabBarLabel: '',
          tabBarShowLabel: false,
        }}
      />
      <Tab.Screen name="Agency" component={AgencyTabScreen} options={{ title: 'Agency', tabBarLabel: 'Agency' }} />
      <Tab.Screen name="Settings" component={SettingsTabScreen} options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}

function SplashScreen() {
  const theme = useTheme();
  const styles = useSplashStyles();
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
    </View>
  );
}

const useSplashStyles = createThemedStyles((t) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.bg,
  },
}));

function RootNavigationTree() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const resetStuckUploads = useUploadQueueStore((s) => s.resetStuckUploads);
  // Per-device onboarding flag. Its own AsyncStorage hydration is tracked so the
  // gate below never branches on the default `false` before rehydration.
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const onboardingHydrated = useOnboardingStore((s) => s.hasHydrated);
  const markOnboardingSeen = useOnboardingStore((s) => s.markSeen);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  /**
   * Resume the upload queue once we're hydrated and signed in.
   * Any items left in 'uploading' after a force-quit get bounced back
   * to 'queued' so processQueue can pick them up again.
   */
  useEffect(() => {
    if (!isHydrated || !isAuthenticated) {
      return;
    }
    resetStuckUploads();
    void processQueue();
  }, [isAuthenticated, isHydrated, resetStuckUploads]);

  /**
   * Re-register the push token whenever a session goes active — fresh login and
   * warm relaunch both land here, which is why this doesn't live in
   * LoginScreen. Covers token rotation and account switches (the backend
   * upserts and reassigns). Silent by design: it no-ops unless permission was
   * already granted, so it can never surface a system dialog on launch.
   */
  useEffect(() => {
    if (!isHydrated || !isAuthenticated) {
      return;
    }
    void registerIfGranted();
  }, [isAuthenticated, isHydrated]);

  // Hold the splash until BOTH stores have hydrated — never branch on a
  // partially-hydrated state. The session-active effects above key off auth
  // hydration only, so upload-queue recovery is not delayed by onboarding.
  if (!isHydrated || !onboardingHydrated) {
    return <SplashScreen />;
  }

  if (isAuthenticated) {
    // First authenticated launch on this device → onboarding, then MainTabs.
    return hasSeenOnboarding ? <MainTabs /> : <OnboardingScreen onComplete={markOnboardingSeen} />;
  }

  return <AuthFlow />;
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <RootNavigationTree />
    </NavigationContainer>
  );
}

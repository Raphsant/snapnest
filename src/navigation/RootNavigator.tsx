import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { GlassTabBar } from '../components/GlassTabBar';
import { AuthFlow } from './AuthFlow';
import type { MainTabParamList } from './mainTabTypes';
import { ActivityScreen } from '../screens/ActivityScreen';
import { AgencyStack } from './AgencyStack';
import { AgencyUpsellScreen } from '../screens/AgencyUpsellScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { FoldersStack } from './FoldersStack';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useMe } from '../hooks/useMe';
import { processQueue } from '../services/uploadManager';
import { selectIsAuthenticated, useAuthStore } from '../store/authStore';
import { useUploadQueueStore } from '../store/uploadQueueStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Agency tab is always visible; what renders inside depends on /me:
 * - memberships → existing AgencyStack workspace
 * - no memberships → upsell placeholder
 * - /me pending or failed → spinner / retry (never flash the upsell at members)
 */
function AgencyTab(): React.ReactElement {
  const meQuery = useMe();

  if (meQuery.data === undefined) {
    return (
      <View style={agencyTabStyles.container}>
        {meQuery.isError ? (
          <>
            <Text style={agencyTabStyles.errorText}>Couldn&apos;t load your account</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading account"
              onPress={() => void meQuery.refetch()}
              style={({ pressed }) => [agencyTabStyles.retryButton, pressed && agencyTabStyles.retryPressed]}
            >
              <Text style={agencyTabStyles.retryLabel}>Tap to retry</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.accentBlue} />
        )}
      </View>
    );
  }

  if (meQuery.data.memberships.length > 0) {
    return <AgencyStack />;
  }

  return <AgencyUpsellScreen />;
}

const agencyTabStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    ...typography.body,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.accentBlueMuted,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryLabel: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '600',
  },
});

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
      <Tab.Screen name="Folders" component={FoldersStack} options={{ title: 'Folders', tabBarLabel: 'Folders' }} />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          title: 'Camera',
          tabBarLabel: '',
          tabBarShowLabel: false,
        }}
      />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{ title: 'Activity', tabBarLabel: 'Activity' }} />
      <Tab.Screen name="Agency" component={AgencyTab} options={{ title: 'Agency', tabBarLabel: 'Agency' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={splashStyles.container}>
      <ActivityIndicator size="large" color={colors.accentBlue} />
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

function RootNavigationTree() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const resetStuckUploads = useUploadQueueStore((s) => s.resetStuckUploads);

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

  if (!isHydrated) {
    return <SplashScreen />;
  }

  if (isAuthenticated) {
    return <MainTabs />;
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

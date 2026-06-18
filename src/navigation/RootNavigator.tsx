import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { GlassTabBar } from '../components/GlassTabBar';
import { AuthFlow } from './AuthFlow';
import type { MainTabParamList } from './mainTabTypes';
import { ActivityScreen } from '../screens/ActivityScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { FoldersStack } from './FoldersStack';
import { SettingsScreen } from '../screens/SettingsScreen';
import { processQueue } from '../services/uploadManager';
import { selectIsAuthenticated, useAuthStore } from '../store/authStore';
import { useUploadQueueStore } from '../store/uploadQueueStore';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

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

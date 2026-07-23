import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureAmplify } from './src/config/amplify';
import { MediaViewerProvider } from './src/context/MediaViewerContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { queryClient } from './src/services/queryClient';

configureAmplify();

/**
 * Foreground presentation for incoming pushes. Banner + sound so a finished
 * upload is noticeable while the app is open; shouldShowList keeps it in
 * Notification Center after the banner fades. No badge — nothing maintains an
 * unread count yet, and a badge that never clears is worse than none.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const { data } = response.notification.request.content;

      // TODO(later phase): route from `data` to the finished upload's file/folder.
      // Note for whoever wires this: a tap that cold-starts the app is delivered
      // before this listener mounts. Pair the navigation work with
      // Notifications.getLastNotificationResponseAsync() to catch that case, or
      // launch-from-notification silently lands on the default tab.
      console.log('[App] notification tapped', data);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <MediaViewerProvider>
            <RootNavigator />
          </MediaViewerProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

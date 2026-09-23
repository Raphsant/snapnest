import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureAmplify } from './src/config/amplify';
import { MediaViewerProvider } from './src/context/MediaViewerContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { queryClient } from './src/services/queryClient';
import { useThemeStore } from './src/store/themeStore';
import { palettes } from './src/theme/tokens';

configureAmplify();

/**
 * The Organic theme's families. Hoisted out of the component so the map is
 * referentially stable — useFonts keys its load off this object.
 *
 * The keys become the `fontFamily` strings, and must stay in sync with
 * theme.typography in src/theme/tokens.ts. A family that isn't registered here
 * silently falls back to the system font on iOS rather than throwing.
 */
const ORGANIC_FONTS = {
  Caprasimo_400Regular,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  IBMPlexMono_400Regular,
};

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
  const [fontsLoaded, fontError] = useFonts(ORGANIC_FONTS);
  // Launch-hold background must match the PERSISTED theme, so a Blue user never
  // flashes cream. Wait for the theme store to rehydrate before revealing the UI.
  const themeName = useThemeStore((s) => s.theme);
  const themeHydrated = useThemeStore((s) => s.hasHydrated);

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

  // Hold on the theme background until the families register (so no screen gets a
  // frame of system-font text that reflows once the fonts land) AND until the
  // theme store rehydrates (so the hold colour is the persisted theme's bg). The
  // native splash has already auto-hidden by this point, so this stands in for it.
  //
  // A font load failure falls through instead of holding: the fonts are cosmetic
  // and iOS substitutes the system font, so a missing .ttf must not brick the app.
  if ((!fontsLoaded && !fontError) || !themeHydrated) {
    return <View style={{ flex: 1, backgroundColor: palettes[themeName].colors.bg }} />;
  }

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

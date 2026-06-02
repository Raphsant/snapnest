import React, { useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import * as authService from '../services/authService';
import { SecondaryButton } from '../components/SecondaryButton';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/** Must clear custom floating tab bar (GlassTabBar: BOTTOM_MARGIN + outer height) + small gap */
const TAB_BAR_BOTTOM_OFFSET = 24;
const TAB_BAR_OUTER_HEIGHT = 72 + 32;

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const footerBottomPad = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_OUTER_HEIGHT + spacing.md;

  const email = useAuthStore((s) => s.user?.email);
  const clearUser = useAuthStore((s) => s.clearUser);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogOut = async (): Promise<void> => {
    setLoggingOut(true);
    try {
      await authService.signOut();
      clearUser();
    } catch (error: unknown) {
      console.error('[SettingsScreen] signOut', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogOut = (): void => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          void handleLogOut();
        },
      },
    ]);
  };

  useEffect(() => {
    void authService.getAuthToken().then((token) => {
      console.log('🔑 JWT FOR TESTING:', token);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.top}>
          {email ? <Text style={styles.emailMuted}>{email}</Text> : null}
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Preferences and account controls are coming next.</Text>
        </View>

        <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
          <SecondaryButton
            label={loggingOut ? 'Signing out…' : 'Log Out'}
            onPress={confirmLogOut}
            disabled={loggingOut}
            style={styles.logoutButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  top: {
    alignItems: 'center',
  },
  emailMuted: {
    ...typography.bodySmall,
    color: colors.tabInactive,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.primaryNavy,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  logoutButton: {
    alignSelf: 'center',
    maxWidth: 400,
    width: '100%',
  },
});

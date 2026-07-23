import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { getPermissionStatus, requestPermissionAndRegister } from '../services/notificationService';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/** Matches the existing `snapnest-*` AsyncStorage key convention. */
const PROMPT_SEEN_KEY = 'snapnest-push-prompt-seen';

/** Fail closed: an unreadable flag should never nag a user who already answered. */
async function hasSeenPrompt(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PROMPT_SEEN_KEY)) !== null;
  } catch (error: unknown) {
    console.error('[PushPromptBanner] failed reading prompt flag', error);
    return true;
  }
}

async function markPromptSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMPT_SEEN_KEY, 'true');
  } catch (error: unknown) {
    console.error('[PushPromptBanner] failed persisting prompt flag', error);
  }
}

export type UploadNotificationPrompt = {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  /** Call once a capture is successfully queued for upload. */
  notifyCaptureQueued: () => void;
};

/**
 * Owns the "should we ask?" decision so the camera screen doesn't have to.
 *
 * The prompt appears at most once per install: after the first capture reaches
 * the upload queue, and only when the user has never answered AND iOS still
 * reports the permission as undetermined. Anything else — already granted,
 * already denied, previously dismissed — stays silent.
 */
export function useUploadNotificationPrompt(): UploadNotificationPrompt {
  const [visible, setVisible] = useState(false);
  /** One evaluation per session; a capture burst must not queue N checks. */
  const evaluatedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const notifyCaptureQueued = useCallback((): void => {
    if (evaluatedRef.current) {
      return;
    }
    // Set before the await so back-to-back captures can't both pass the gate.
    evaluatedRef.current = true;

    void (async (): Promise<void> => {
      if (await hasSeenPrompt()) {
        return;
      }
      const status = await getPermissionStatus();
      if (status !== Notifications.PermissionStatus.UNDETERMINED) {
        return;
      }
      if (mountedRef.current) {
        setVisible(true);
      }
    })();
  }, []);

  const onEnable = useCallback((): void => {
    // Drop the pre-prompt first so it isn't stacked under the system dialog.
    setVisible(false);
    void (async (): Promise<void> => {
      await markPromptSeen();
      const result = await requestPermissionAndRegister();
      console.log('[PushPromptBanner] registration result:', result);
    })();
  }, []);

  const onDismiss = useCallback((): void => {
    setVisible(false);
    void markPromptSeen();
  }, []);

  return { visible, onEnable, onDismiss, notifyCaptureQueued };
}

type PushPromptBannerProps = {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  /** Distance from the bottom of the screen — caller clears its own chrome. */
  bottomOffset: number;
};

function PushPromptBannerBase({
  visible,
  onEnable,
  onDismiss,
  bottomOffset,
}: PushPromptBannerProps): React.ReactElement | null {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    // Same entrance feel as CaptureToast, rising from below instead of above.
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.host, { bottom: bottomOffset }]} pointerEvents="box-none">
      <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.message}>Want to know when your uploads finish?</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.secondaryLabel}>Not now</Text>
          </Pressable>
          <Pressable
            onPress={onEnable}
            style={({ pressed }) => [styles.primaryAction, pressed && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityLabel="Enable upload notifications"
          >
            <Text style={styles.primaryLabel}>Enable</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

export const PushPromptBanner = memo(PushPromptBannerBase);

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 30,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(16,42,67,0.86)',
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  message: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  secondaryAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
  },
  primaryAction: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
  },
  actionPressed: {
    opacity: 0.75,
  },
  secondaryLabel: {
    ...typography.bodySmall,
    color: colors.tabInactive,
    fontWeight: '600',
  },
  primaryLabel: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '700',
  },
});

import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityFeedRow } from '../components/ActivityFeedRow';
import { GlassCard } from '../components/GlassCard';
import type { ActivityFeedItem } from '../hooks/useActivityFeed';
import { useActivityFeed } from '../hooks/useActivityFeed';
import type { MediaFile } from '../services/filesService';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/** Matches SettingsScreen — clears the floating GlassTabBar (BOTTOM_MARGIN + outer height). */
const TAB_BAR_BOTTOM_OFFSET = 24;
const TAB_BAR_OUTER_HEIGHT = 72 + 32;

export function ActivityScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const firstName = useAuthStore((s) => s.user?.firstName);
  const displayName = firstName?.trim() ? firstName.trim() : 'there';

  const { items, isLoading, isError, error, refetch, isRefetching } = useActivityFeed();

  const listBottomPad = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_OUTER_HEIGHT + spacing.md;

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handlePressFile = useCallback((file: MediaFile) => {
    console.log('Open file:', file.id);
  }, []);

  const keyExtractor = useCallback((entry: ActivityFeedItem): string => {
    return entry.kind === 'queue' ? `queue:${entry.item.id}` : `file:${entry.item.id}`;
  }, []);

  const renderItem: ListRenderItem<ActivityFeedItem> = useCallback(
    ({ item }) => <ActivityFeedRow entry={item} onPressFile={handlePressFile} />,
    [handlePressFile],
  );

  const showInitialLoading = isLoading && items.length === 0;
  const showEmpty = !isLoading && !isError && items.length === 0;
  const showError = isError && items.length === 0;

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefetching}
        onRefresh={handleRefresh}
        tintColor={colors.accentBlue}
        colors={[colors.accentBlue]}
      />
    ),
    [handleRefresh, isRefetching],
  );

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundGradientBottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi, {displayName}</Text>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>Your captures and uploads</Text>
        </View>

        {showInitialLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
          </View>
        ) : null}

        {showError ? (
          <View style={styles.centeredCard}>
            <GlassCard>
              <Text style={styles.errorTitle}>Could not load activity</Text>
              <Text style={styles.errorBody}>
                {error instanceof Error ? error.message : 'Something went wrong.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleRefresh}
                style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
              >
                <Text style={styles.retryLabel}>Tap to retry</Text>
              </Pressable>
            </GlassCard>
          </View>
        ) : null}

        {showEmpty ? (
          <View style={styles.centeredCard}>
            <GlassCard>
              <View style={styles.emptyInner}>
                <Ionicons name="camera-outline" size={32} color={colors.mutedText} />
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptyBody}>Tap the camera to capture your first moment</Text>
              </View>
            </GlassCard>
          </View>
        ) : null}

        {!showInitialLoading && !showError && items.length > 0 ? (
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
            refreshControl={refreshControl}
            showsVerticalScrollIndicator={false}
          />
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Separator(): React.ReactElement {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.bodySmall,
    color: colors.mutedText,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.primaryNavy,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedText,
    marginTop: spacing.xs,
  },
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  centeredCard: {
    paddingTop: spacing.md,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
    marginBottom: spacing.sm,
  },
  errorBody: {
    ...typography.body,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: 'rgba(47,128,237,0.12)',
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryLabel: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '600',
  },
  emptyInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
  },
  emptyBody: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
    marginVertical: spacing.xs,
  },
});

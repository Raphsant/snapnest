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

import { GlassCard } from '../components/GlassCard';
import { useAgencyFolders } from '../hooks/useAgencyFolders';
import { useMe } from '../hooks/useMe';
import type { AgencyFolderListScreenProps } from '../navigation/agencyTypes';
import type { AgencyFolder } from '../services/agencyService';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/** Matches other tab screens — clears the floating GlassTabBar. */
const TAB_BAR_BOTTOM_OFFSET = 24;
const TAB_BAR_OUTER_HEIGHT = 72 + 32;

type Props = AgencyFolderListScreenProps;

function AgencyFolderRow({
  folder,
  onPress,
}: {
  folder: AgencyFolder;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.rowPressed]}
    >
      <GlassCard intensity={64} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconSquare}>
            <Ionicons name="folder" size={22} color={colors.primaryNavy} />
          </View>
          <View style={styles.middle}>
            <Text style={styles.rowName} numberOfLines={1}>
              {folder.name}
            </Text>
            <Text style={styles.rowCount}>
              {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.tabInactive} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

export function AgencyFoldersScreen({ navigation }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const meQuery = useMe();
  const membership = meQuery.data?.memberships[0];
  const agencyId = membership?.agencyId;

  const {
    data: folders,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAgencyFolders(agencyId);

  const listBottomPad = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_OUTER_HEIGHT + spacing.md;

  const folderList = useMemo<AgencyFolder[]>(() => folders ?? [], [folders]);
  const showSpinner = isLoading && folders === undefined;
  const showError = isError && folders === undefined;
  const showEmpty = !isLoading && !isError && folderList.length === 0;

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const openFolder = useCallback(
    (folder: AgencyFolder) => {
      if (agencyId === undefined) {
        return;
      }
      navigation.navigate('AgencyFolderDetail', {
        folderId: folder.id,
        folderName: folder.name,
        agencyId,
      });
    },
    [agencyId, navigation],
  );

  const keyExtractor = useCallback((folder: AgencyFolder): string => folder.id, []);

  const renderItem: ListRenderItem<AgencyFolder> = useCallback(
    ({ item }) => <AgencyFolderRow folder={item} onPress={() => openFolder(item)} />,
    [openFolder],
  );

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

  const listFooter = useMemo(() => {
    if (showSpinner) {
      return (
        <View style={styles.footerSpinner}>
          <ActivityIndicator size="small" color={colors.accentBlue} />
        </View>
      );
    }
    if (showEmpty) {
      return <Text style={styles.emptyHint}>No workspace folders yet</Text>;
    }
    return null;
  }, [showEmpty, showSpinner]);

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundGradientBottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{membership?.agencyName ?? 'Agency'}</Text>
          <Text style={styles.subtitle}>Agency workspace</Text>
        </View>

        {showError ? (
          <View style={styles.errorCard}>
            <GlassCard>
              <Text style={styles.errorTitle}>Could not load workspace</Text>
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

        <FlatList
          data={folderList}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListFooterComponent={listFooter}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </LinearGradient>
  );
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
    marginBottom: spacing.md,
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
  listContent: {
    flexGrow: 1,
  },
  card: {
    marginVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowPressed: {
    opacity: 0.9,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: colors.glassSurface,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryNavy,
  },
  rowCount: {
    ...typography.bodySmall,
    color: colors.mutedText,
    marginTop: 2,
  },
  footerSpinner: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyHint: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  errorCard: {
    marginBottom: spacing.md,
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

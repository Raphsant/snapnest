import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '../components/GlassCard';
import {
  MediaThumbnailGrid,
  type GridSelectionState,
} from '../components/MediaThumbnailGrid';
import { useMediaViewer } from '../context/MediaViewerContext';
import type { ActivityFeedItem } from '../hooks/useActivityFeed';
import { useAgencyFolderDetails } from '../hooks/useAgencyFolderDetails';
import { useBatchViewUrls } from '../hooks/useBatchViewUrls';
import type { AgencyFolderDetailScreenProps } from '../navigation/agencyTypes';
import type { MediaFile } from '../services/filesService';
import { enqueueUpload } from '../services/uploadManager';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/** Matches other tab screens — clears the floating GlassTabBar. */
const TAB_BAR_BOTTOM_OFFSET = 24;
const TAB_BAR_OUTER_HEIGHT = 72 + 32;

type Props = AgencyFolderDetailScreenProps;

function inferMimeTypeFromFilename(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function mediaFilesToFeedItems(files: MediaFile[]): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = files.map((file) => {
    const ts = Date.parse(file.createdAt);
    return {
      kind: 'file',
      item: file,
      createdAt: Number.isFinite(ts) ? ts : 0,
    };
  });
  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
}

export function AgencyFolderDetailScreen({ navigation, route }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { folderId, folderName, agencyId } = route.params;
  const { openGallery } = useMediaViewer();

  const folderQuery = useAgencyFolderDetails(folderId);

  const files = useMemo(
    (): MediaFile[] => folderQuery.data?.files ?? [],
    [folderQuery.data?.files],
  );
  const feedItems = useMemo(() => mediaFilesToFeedItems(files), [files]);

  const uploadedFileIds = useMemo(
    (): string[] => files.filter((f) => f.uploadStatus === 'UPLOADED').map((f) => f.id),
    [files],
  );

  const { data: viewUrlByFileId } = useBatchViewUrls(uploadedFileIds, agencyId);

  const listBottomPad = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_OUTER_HEIGHT + spacing.md;

  const { isLoading, isError, error, refetch, isRefetching } = folderQuery;

  useEffect(() => {
    void refetch();
  }, [folderId, refetch]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handlePressFile = useCallback(
    (file: MediaFile) => {
      const startIndex = files.findIndex((f) => f.id === file.id);
      if (startIndex < 0) {
        return;
      }
      openGallery(files, startIndex, { agencyId, readOnly: true });
    },
    [agencyId, files, openGallery],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Access Needed',
          'SnapNest needs access to your photo library so you can submit media to this folder.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.fileName ?? `upload-${Date.now()}`;
      enqueueUpload({
        localUri: asset.uri,
        fileName,
        mimeType: asset.mimeType ?? inferMimeTypeFromFilename(fileName),
        sizeBytes: asset.fileSize ?? 0,
        source: 'gallery',
        agencyId,
        folderId,
      });

      Alert.alert(
        'Submitting',
        'Your media is uploading and will appear in this folder shortly.',
        [{ text: 'OK' }],
      );
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Could not submit media.';
      Alert.alert('Submit failed', message);
    }
  }, [agencyId, folderId]);

  const selection = useMemo(
    (): GridSelectionState => ({
      isActive: false,
      selectedIds: new Set<string>(),
      onToggle: () => undefined,
      onLongPressFile: () => undefined,
    }),
    [],
  );

  const showInitialLoading = isLoading && feedItems.length === 0;
  const showEmpty = !isLoading && !isError && feedItems.length === 0;
  const showError = isError && feedItems.length === 0;

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
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
          >
            <Ionicons name="chevron-back" size={28} color={colors.primaryNavy} />
          </Pressable>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {folderName}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit media to this folder"
            hitSlop={8}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [styles.submitButton, pressed && styles.backPressed]}
          >
            <Ionicons name="add-circle" size={20} color={colors.accentBlue} />
            <Text style={styles.submitLabel}>Submit</Text>
          </Pressable>
        </View>

        {showInitialLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
          </View>
        ) : null}

        {showError ? (
          <View style={styles.centeredCard}>
            <GlassCard>
              <Text style={styles.errorTitle}>Could not load files</Text>
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
                <Ionicons name="document-outline" size={32} color={colors.mutedText} />
                <Text style={styles.emptyTitle}>No files in this folder yet</Text>
                <Text style={styles.emptyBody}>
                  Tap Submit to add media to this agency folder
                </Text>
              </View>
            </GlassCard>
          </View>
        ) : null}

        {!showInitialLoading && !showError && feedItems.length > 0 ? (
          <MediaThumbnailGrid
            items={feedItems}
            viewUrlByFileId={viewUrlByFileId}
            onPressFile={handlePressFile}
            selection={selection}
            contentPaddingBottom={listBottomPad}
            refreshControl={refreshControl}
          />
        ) : null}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  backButton: {
    paddingRight: spacing.sm,
    width: 36,
  },
  backPressed: {
    opacity: 0.7,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  submitLabel: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '600',
  },
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  centeredCard: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
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
  emptyInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
  },
});

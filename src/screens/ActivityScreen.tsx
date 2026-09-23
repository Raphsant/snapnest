import React, { useCallback, useMemo } from 'react';
import { Check, CloudOff } from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { BackedUpRow } from '../components/activity/BackedUpRow';
import { FailedRow } from '../components/activity/FailedRow';
import { InProgressRow } from '../components/activity/InProgressRow';
import { Card } from '../components/ui/Card';
import { DisplayText } from '../components/ui/DisplayText';
import { PillButton } from '../components/ui/PillButton';
import { SectionLabel } from '../components/ui/SectionLabel';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useBatchViewUrls } from '../hooks/useBatchViewUrls';
import { useFolders } from '../hooks/useFolders';
import { useSyncStatus, type SyncStatus } from '../hooks/useSyncStatus';
import { useMediaViewer } from '../context/MediaViewerContext';
import { retryUpload } from '../services/uploadManager';
import { useUploadQueueStore } from '../store/uploadQueueStore';
import type { MediaFile } from '../services/filesService';
import type { MainTabParamList } from '../navigation/mainTabTypes';
import type { UploadQueueItem } from '../types/upload';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const BOTTOM_PADDING = 150;

/** Local-time "same calendar day" test. file.createdAt is an ISO string; using
 *  getFullYear/Month/Date compares in the device's zone, not UTC. */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function syncTitle(sync: SyncStatus): string {
  switch (sync.kind) {
    case 'uploading':
      return `Uploading ${sync.activeCount} item${sync.activeCount === 1 ? '' : 's'}`;
    case 'waiting':
      return `${sync.pendingCount} waiting to upload`;
    case 'offline':
      return 'Offline — nothing pending';
    default:
      return 'Everything is backed up';
  }
}

export function ActivityScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { openFile } = useMediaViewer();
  const sync = useSyncStatus();

  const { items, isLoading, isError, error, refetch, isRefetching } = useActivityFeed();
  const { data: folders } = useFolders();
  const removeItem = useUploadQueueStore((s) => s.removeItem);

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const folder of folders ?? []) {
      map.set(folder.id, folder.name);
    }
    return map;
  }, [folders]);
  const folderNameFor = useCallback(
    (folderId: string | null): string => (folderId ? folderNameById.get(folderId) ?? 'Folder' : 'Unfiled'),
    [folderNameById],
  );

  // Split the merged feed into the three sections.
  const { inProgress, failed, backedUpToday } = useMemo(() => {
    const prog: UploadQueueItem[] = [];
    const fail: UploadQueueItem[] = [];
    const done: MediaFile[] = [];
    for (const entry of items) {
      if (entry.kind === 'queue') {
        if (entry.item.status === 'queued' || entry.item.status === 'uploading') {
          prog.push(entry.item);
        } else if (entry.item.status === 'failed') {
          fail.push(entry.item);
        }
      } else if (entry.item.uploadStatus === 'UPLOADED' && isToday(entry.item.createdAt)) {
        done.push(entry.item);
      }
    }
    return { inProgress: prog, failed: fail, backedUpToday: done };
  }, [items]);

  const backedUpIds = useMemo(() => backedUpToday.map((f) => f.id), [backedUpToday]);
  const { data: viewUrlByFileId } = useBatchViewUrls(backedUpIds);

  // All-clear screen only when nothing is in flight AND nothing failed. Failures
  // keep the list layout so the user can act on them.
  const allClear = inProgress.length === 0 && failed.length === 0;

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const goToCamera = useCallback(() => {
    navigation.navigate('Camera');
  }, [navigation]);

  const handleRemove = useCallback(
    (item: UploadQueueItem) => {
      Alert.alert(
        'Remove upload?',
        // removeItem only dequeues — it does not delete the local capture. The
        // file stays in the camera roll (if saving there was permitted).
        'This stops the upload and clears it from the queue. The capture stays in your camera roll.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeItem(item.id) },
        ],
      );
    },
    [removeItem],
  );

  const showInitialLoading = isLoading && items.length === 0;
  const showError = isError && items.length === 0;

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefetching}
        onRefresh={handleRefresh}
        tintColor={theme.colors.accent}
        colors={[theme.colors.accent]}
      />
    ),
    [handleRefresh, isRefetching],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BOTTOM_PADDING }]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <DisplayText size={34}>Uploads</DisplayText>
            <Text style={styles.headerSub}>{syncTitle(sync)}</Text>
          </View>
          <PillButton
            title="Storage"
            variant="secondary"
            height={34}
            // Cross-tab deep-link into SettingsStack's hand-rolled Storage route
            // isn't clean (same limitation as FoldersStack), so this lands on the
            // Settings tab root; the user taps "On-device storage" to reach Storage.
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        {sync.isOffline ? (
          <Card style={styles.offlineCard}>
            <View style={styles.offlineRow}>
              <CloudOff size={20} color={theme.colors.warn} strokeWidth={2.2} />
              <View style={styles.offlineText}>
                <Text style={styles.offlineTitle}>You&apos;re offline</Text>
                <Text style={styles.offlineBody}>
                  Keep shooting. Captures are safe on your phone and upload themselves when you
                  reconnect.
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {showInitialLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : null}

        {showError ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load uploads</Text>
            <Text style={styles.errorBody}>
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </Text>
            <PillButton title="Try again" variant="secondary" height={44} onPress={handleRefresh} />
          </Card>
        ) : null}

        {!showInitialLoading && !showError && allClear ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyArtOuter}>
              <View style={styles.emptyArtInner}>
                <Check size={44} color={theme.colors.okDeep} strokeWidth={2.4} />
              </View>
            </View>
            <DisplayText size={26}>All caught up</DisplayText>
            <Text style={styles.emptyCopy}>
              Every capture has reached the cloud.
              {backedUpToday.length > 0
                ? ` Your editors already have today's ${backedUpToday.length} files.`
                : ''}
            </Text>
            <View style={styles.emptyButton}>
              <PillButton title="Back to camera" onPress={goToCamera} />
            </View>
          </View>
        ) : null}

        {!showInitialLoading && !showError && !allClear ? (
          <>
            {/* No "Pause all": the upload manager has no pause capability, so the
                control is omitted rather than rendered dead. */}
            <SectionLabel style={styles.sectionLabel}>{`In progress · ${inProgress.length}`}</SectionLabel>
            {inProgress.length > 0 ? (
              inProgress.map((item) => (
                <InProgressRow key={item.id} item={item} folderName={folderNameFor(item.folderId)} />
              ))
            ) : (
              <View style={styles.dashedCard}>
                <View style={styles.dashedCheck}>
                  <Check size={13} color={theme.colors.okDeep} strokeWidth={3} />
                </View>
                <Text style={styles.dashedText}>Queue is empty — every capture is in the cloud.</Text>
              </View>
            )}

            {failed.length > 0 ? (
              <>
                <SectionLabel style={styles.sectionLabel}>Needs your attention</SectionLabel>
                {failed.map((item) => (
                  <FailedRow
                    key={item.id}
                    item={item}
                    folderName={folderNameFor(item.folderId)}
                    onRetry={() => retryUpload(item.id)}
                    onRemove={() => handleRemove(item)}
                  />
                ))}
              </>
            ) : null}

            {backedUpToday.length > 0 ? (
              <>
                <View style={styles.backedUpHeader}>
                  <SectionLabel>Backed up · today</SectionLabel>
                  <Text style={styles.editorsNote}>Editors can see these</Text>
                </View>
                {backedUpToday.map((file) => (
                  <BackedUpRow
                    key={file.id}
                    file={file}
                    thumbnailUrl={viewUrlByFileId?.[file.id]?.thumbnailUrl ?? null}
                    onPress={() => openFile(file)}
                  />
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerSub: {
    marginTop: 2,
    fontFamily: theme.typography.body[400],
    fontSize: 13.5,
    color: theme.colors.muted,
  },
  offlineCard: {
    padding: 14,
    marginBottom: 16,
    backgroundColor: theme.colors.warnSoft,
    borderColor: theme.colors.warn,
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  offlineText: {
    flex: 1,
    minWidth: 0,
  },
  offlineTitle: {
    fontFamily: theme.typography.body[700],
    fontSize: 14,
    color: theme.colors.text,
  },
  offlineBody: {
    marginTop: 3,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.muted,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
  },
  dashedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.line2,
  },
  dashedCheck: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.okSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedText: {
    flex: 1,
    fontFamily: theme.typography.body[400],
    fontSize: 13,
    color: theme.colors.muted,
  },
  backedUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  editorsNote: {
    fontFamily: theme.typography.body[600],
    fontSize: 12,
    color: theme.colors.okDeep,
  },
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  errorCard: {
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  errorTitle: {
    fontFamily: theme.typography.body[700],
    fontSize: 15.5,
    color: theme.colors.text,
  },
  errorBody: {
    fontFamily: theme.typography.body[400],
    fontSize: 13.5,
    color: theme.colors.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 56,
    gap: 14,
  },
  emptyArtOuter: {
    width: 160,
    height: 160,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.okSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyArtInner: {
    width: 104,
    height: 104,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    fontFamily: theme.typography.body[400],
    fontSize: 14.5,
    lineHeight: 21,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
}));

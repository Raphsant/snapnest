import React from 'react';
import { Check, CloudOff, UploadCloud } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import type { MainTabParamList } from '../navigation/mainTabTypes';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { truncateFileName } from '../utils/formatRelativeTime';
import { Card } from './ui/Card';
import { IconTile, type IconTileTone } from './ui/IconTile';
import { PillButton } from './ui/PillButton';
import type { IconComponent } from './ui/types';
import { createThemedStyles } from '../theme/createThemedStyles';

type SyncStatusCardProps = {
  /**
   * Where "Details" / "See queue" should go. Defaults to switching to the
   * Uploads tab; the Uploads screen itself (Phase 5) passes a no-op or a scroll
   * so the card doesn't navigate to the screen it's already on.
   */
  onOpenQueue?: () => void;
};

export function SyncStatusCard({ onOpenQueue }: SyncStatusCardProps): React.ReactElement {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const sync = useSyncStatus();
  const styles = useStyles();

  const openQueue = onOpenQueue ?? ((): void => navigation.navigate('Activity'));

  const tile = SYNC_TILES[sync.kind];
  const plural = sync.pendingCount === 1 ? '' : 's';

  return (
    <Card radius="lg" shadow style={styles.card}>
      <View style={styles.headerRow}>
        <IconTile icon={tile.icon} tone={tile.tone} size={42} />
        <View style={styles.copy}>
          {sync.kind === 'ok' ? (
            <>
              <Text style={styles.title}>Everything is backed up</Text>
              <Text style={styles.subtitle}>You&apos;re all caught up</Text>
            </>
          ) : null}

          {sync.kind === 'uploading' ? (
            <>
              <Text style={styles.title}>
                Uploading {sync.activeCount} item{sync.activeCount === 1 ? '' : 's'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {sync.progress}%
                {sync.currentItem ? ` · ${truncateFileName(sync.currentItem.fileName, 22)}` : ''}
              </Text>
            </>
          ) : null}

          {sync.kind === 'waiting' ? (
            <>
              <Text style={styles.title}>
                {sync.pendingCount} waiting to upload
              </Text>
              <Text style={styles.subtitle}>
                You&apos;re offline — uploads resume when you reconnect.
              </Text>
            </>
          ) : null}

          {sync.kind === 'offline' ? (
            <>
              <Text style={styles.title}>Offline — nothing pending</Text>
              <Text style={styles.subtitle}>Reconnect to keep new captures flowing.</Text>
            </>
          ) : null}
        </View>

        {sync.kind === 'uploading' ? (
          <PillButton title="Details" variant="ghost" height={38} onPress={openQueue} />
        ) : null}
      </View>

      {sync.kind === 'uploading' ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${sync.progress}%` }]} />
        </View>
      ) : null}

      {sync.kind === 'waiting' ? (
        <View style={styles.buttonRow}>
          {/*
            No Wi-Fi-only gate exists to override, and while offline there is
            nothing to force. Disabled with a TODO until an actual "upload over
            cellular" toggle lands (Phase 5+). See useSyncStatus.
          */}
          <PillButton title="Upload now anyway" height={38} onPress={NOOP} disabled />
          <PillButton title="See queue" variant="secondary" height={38} onPress={openQueue} />
        </View>
      ) : null}
    </Card>
  );
}

const NOOP = (): void => {};

type TileSpec = { icon: IconComponent; tone: IconTileTone };

const SYNC_TILES: Record<'ok' | 'uploading' | 'waiting' | 'offline', TileSpec> = {
  ok: { icon: Check, tone: 'ok' },
  uploading: { icon: UploadCloud, tone: 'accent' },
  waiting: { icon: CloudOff, tone: 'warn' },
  offline: { icon: CloudOff, tone: 'neutral' },
};

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    color: theme.colors.muted,
  },
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
}));

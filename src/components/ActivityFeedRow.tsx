import React, { memo, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActivityFeedItem } from '../hooks/useActivityFeed';
import { retryUpload } from '../services/uploadManager';
import type { MediaFile } from '../services/filesService';
import type { UploadQueueItem } from '../types/upload';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatRelativeTime, truncateFileName } from '../utils/formatRelativeTime';

const FILENAME_MAX_CHARS = 32;

/** Status-tinted backgrounds for the left icon square. Soft alpha keeps it subtle. */
const TINT_SUCCESS = 'rgba(39, 174, 96, 0.10)';
const TINT_WARNING = 'rgba(242, 201, 76, 0.15)';
const TINT_ERROR = 'rgba(235, 87, 87, 0.15)';
/** rgba of `colors.tabInactive` (#829AB1). */
const TINT_MUTED = 'rgba(130, 154, 177, 0.15)';

type ActivityFeedRowProps = {
  entry: ActivityFeedItem;
  onPressFile?: (file: MediaFile) => void;
};

function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}

function formatSizeMb(sizeBytes: number): string {
  const mb = sizeBytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function parseSize(sizeBytes: string | number): number {
  if (typeof sizeBytes === 'number') {
    return sizeBytes;
  }
  const parsed = Number(sizeBytes);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metaLine(mime: string, sizeBytes: number, createdAtIso: string): string {
  const kindLabel = isVideoMime(mime) ? 'Video' : 'Photo';
  return `${kindLabel} · ${formatSizeMb(sizeBytes)} · ${formatRelativeTime(createdAtIso)}`;
}

type IconConfig = {
  name: keyof typeof Ionicons.glyphMap;
  tint: string;
  color: string;
};

function fileIcon(mime: string): IconConfig {
  return {
    name: isVideoMime(mime) ? 'videocam' : 'image',
    tint: TINT_SUCCESS,
    color: colors.success,
  };
}

function queueIcon(item: UploadQueueItem): IconConfig {
  const name: keyof typeof Ionicons.glyphMap = isVideoMime(item.mimeType) ? 'videocam' : 'image';

  switch (item.status) {
    case 'uploading':
      return { name, tint: TINT_WARNING, color: colors.warning };
    case 'failed':
      return { name, tint: TINT_ERROR, color: colors.error };
    case 'queued':
    default:
      return { name, tint: TINT_MUTED, color: colors.tabInactive };
  }
}

function FileRow({ file, onPress }: { file: MediaFile; onPress?: (file: MediaFile) => void }): React.ReactElement {
  const icon = fileIcon(file.mimeType);
  const handlePress = useCallback(() => {
    onPress?.(file);
  }, [file, onPress]);

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[styles.iconSquare, { backgroundColor: icon.tint }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.fileName} numberOfLines={1}>
          {truncateFileName(file.fileName, FILENAME_MAX_CHARS)}
        </Text>
        <Text style={styles.metaText} numberOfLines={1}>
          {metaLine(file.mimeType, parseSize(file.sizeBytes), file.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Queue rows are not whole-row pressable — only the failed-state's "Tap to retry"
 * badge accepts a press. Other statuses (queued, uploading) are passive status indicators.
 */
function QueueRow({ item }: { item: UploadQueueItem }): React.ReactElement {
  const icon = queueIcon(item);
  const createdAtIso = new Date(item.createdAt).toISOString();

  return (
    <View style={styles.row}>
      <View style={[styles.iconSquare, { backgroundColor: icon.tint }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.fileName} numberOfLines={1}>
          {truncateFileName(item.fileName, FILENAME_MAX_CHARS)}
        </Text>
        <Text style={styles.metaText} numberOfLines={1}>
          {metaLine(item.mimeType, item.sizeBytes, createdAtIso)}
        </Text>
      </View>
      <QueueStatusBadge item={item} />
    </View>
  );
}

function QueueStatusBadge({ item }: { item: UploadQueueItem }): React.ReactElement {
  switch (item.status) {
    case 'uploading':
      return (
        <View style={[styles.pill, styles.pillWarning]}>
          <Text style={[styles.pillText, styles.pillTextWarning]}>{`Uploading ${item.progress}%`}</Text>
        </View>
      );
    case 'failed':
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry upload"
          hitSlop={8}
          onPress={() => retryUpload(item.id)}
          style={({ pressed }) => [styles.pill, styles.pillError, pressed && styles.pillPressed]}
        >
          <Text style={[styles.pillText, styles.pillTextError]}>Tap to retry</Text>
        </Pressable>
      );
    case 'queued':
    default:
      return (
        <View style={styles.pill}>
          <Text style={[styles.pillText, styles.pillTextMuted]}>Queued</Text>
        </View>
      );
  }
}

function ActivityFeedRowBase({ entry, onPressFile }: ActivityFeedRowProps): React.ReactElement {
  if (entry.kind === 'file') {
    return <FileRow file={entry.item} onPress={onPressFile} />;
  }
  return <QueueRow item={entry.item} />;
}

export const ActivityFeedRow = memo(ActivityFeedRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  rowPressed: {
    opacity: 0.85,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryNavy,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.mutedText,
    marginTop: 2,
  },
  pill: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  pillWarning: {
    backgroundColor: TINT_WARNING,
  },
  pillError: {
    backgroundColor: TINT_ERROR,
  },
  pillPressed: {
    opacity: 0.75,
  },
  pillText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  pillTextWarning: {
    color: colors.warning,
  },
  pillTextError: {
    color: colors.error,
  },
  pillTextMuted: {
    color: colors.mutedText,
  },
});

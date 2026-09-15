import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { UploadQueueItem } from '../../types/upload';
import { Card } from '../ui/Card';
import { formatFileSize } from '../../utils/formatRelativeTime';
import { createThemedStyles } from '../../theme/createThemedStyles';

type InProgressRowProps = {
  item: UploadQueueItem;
  /** Pre-resolved destination folder name ("Unfiled" for null folderId). */
  folderName: string;
};

export function InProgressRow({ item, folderName }: InProgressRowProps): React.ReactElement {
  const styles = useStyles();
  const name = item.displayName ?? item.fileName;
  const pct = item.progress;
  const kind = item.mimeType.startsWith('video/') ? 'Video' : 'Photo';
  const thumb = item.thumbnailUri ?? (item.mimeType.startsWith('image/') ? item.localUri : null);

  return (
    <Card shadow style={styles.card}>
      <View style={styles.row}>
        <View style={styles.thumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumbImg} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={styles.thumbEmpty} />
          )}
        </View>
        <View style={styles.middle}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.pct}>{pct}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {kind} · {formatFileSize(item.sizeBytes)} · {folderName}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  card: {
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.card2,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbEmpty: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.card2,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: theme.typography.body[600],
    fontSize: 15,
    color: theme.colors.text,
  },
  pct: {
    fontFamily: theme.typography.body[700],
    fontSize: 13,
    color: theme.colors.accentDeep,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card2,
    marginTop: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
  },
  sub: {
    fontFamily: theme.typography.body[400],
    fontSize: 11.5,
    color: theme.colors.muted,
  },
}));

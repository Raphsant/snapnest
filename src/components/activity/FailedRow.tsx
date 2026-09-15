import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { UploadQueueItem } from '../../types/upload';
import { Card } from '../ui/Card';
import { PillButton } from '../ui/PillButton';
import { formatFileSize } from '../../utils/formatRelativeTime';
import { createThemedStyles } from '../../theme/createThemedStyles';

type FailedRowProps = {
  item: UploadQueueItem;
  folderName: string;
  onRetry: () => void;
  onRemove: () => void;
};

export function FailedRow({ item, folderName, onRetry, onRemove }: FailedRowProps): React.ReactElement {
  const styles = useStyles();
  const name = item.displayName ?? item.fileName;
  const kind = item.mimeType.startsWith('video/') ? 'Video' : 'Photo';
  const thumb = item.thumbnailUri ?? (item.mimeType.startsWith('image/') ? item.localUri : null);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.thumbWrap}>
          <View style={styles.thumb}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumbImg} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={styles.thumbEmpty} />
            )}
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>!</Text>
          </View>
        </View>
        <View style={styles.middle}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {kind} · {formatFileSize(item.sizeBytes)} · upload interrupted
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <PillButton title="Try again" height={36} onPress={onRetry} />
        <PillButton title="Remove" variant="secondary" height={36} onPress={onRemove} />
      </View>
    </Card>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  card: {
    padding: 12,
    marginBottom: 10,
    borderColor: theme.colors.dangerLine,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbWrap: {
    width: 44,
    height: 44,
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
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 19,
    height: 19,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.danger,
    borderWidth: 2,
    borderColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: theme.typography.body[800],
    fontSize: 11,
    lineHeight: 13,
    color: theme.colors.white,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: theme.typography.body[600],
    fontSize: 15,
    color: theme.colors.text,
  },
  sub: {
    marginTop: 2,
    fontFamily: theme.typography.body[400],
    fontSize: 11.5,
    color: theme.colors.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
}));

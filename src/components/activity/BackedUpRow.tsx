import React from 'react';
import { Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MediaFile } from '../../services/filesService';
import { Card } from '../ui/Card';
import { formatFileSize } from '../../utils/formatRelativeTime';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

type BackedUpRowProps = {
  file: MediaFile;
  thumbnailUrl: string | null;
  onPress: () => void;
};

/** Local wall-clock HH:mm for a file's createdAt. */
function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function BackedUpRow({ file, thumbnailUrl, onPress }: BackedUpRowProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const name = file.displayName ?? file.fileName;
  const kind = file.fileType === 'VIDEO' || file.mimeType.startsWith('video/') ? 'Video' : 'Photo';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.thumb}>
            {thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl, cacheKey: `${file.id}:thumb` }}
                style={styles.thumbImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.thumbEmpty} />
            )}
          </View>
          <View style={styles.middle}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {kind} · {formatFileSize(file.sizeBytes)} · {clockTime(file.createdAt)}
            </Text>
            <Text style={styles.mono} numberOfLines={1}>{file.fileName}</Text>
          </View>
          <View style={styles.check}>
            <Check size={12} color={theme.colors.okDeep} strokeWidth={3} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
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
  mono: {
    marginTop: 3,
    fontFamily: theme.typography.mono,
    fontSize: 10.5,
    color: theme.colors.faint,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.okSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

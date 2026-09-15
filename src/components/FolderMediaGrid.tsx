import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, UploadCloud } from 'lucide-react-native';
import { Image, type ImageSource } from 'expo-image';
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type RefreshControlProps,
  type SectionListData,
} from 'react-native';

import type { ViewUrlByFileId } from '../hooks/useBatchViewUrls';
import type { MediaFile } from '../services/filesService';
import { SectionLabel } from './ui/SectionLabel';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const COLUMNS = 3;
const GAP = 3;
const H_PADDING = 14;
/** Accent wash over a selected cell (spec: 32%). */
const SELECTED_OVERLAY_OPACITY = 0.32;

type FolderMediaGridProps = {
  files: MediaFile[];
  viewUrlByFileId?: ViewUrlByFileId;
  isSelecting: boolean;
  selectedIds: ReadonlySet<string>;
  onPressFile: (file: MediaFile) => void;
  onToggle: (fileId: string) => void;
  onLongPressFile: (file: MediaFile) => void;
  contentPaddingBottom?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

/** A grid row is up to COLUMNS files; SectionList lays rows out vertically. */
type GridRow = { key: string; files: MediaFile[] };
type GridSection = SectionListData<GridRow, { title: string }>;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Today · 24 July" / "Yesterday" / "3 July" — SectionLabel uppercases it. */
function sectionTitle(date: Date, now: Date): string {
  const today = dayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const key = dayKey(date);
  const dayMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  if (key === today) {
    return `Today · ${dayMonth}`;
  }
  if (key === dayKey(yesterdayDate)) {
    return 'Yesterday';
  }
  return dayMonth;
}

function chunk(files: MediaFile[]): GridRow[] {
  const rows: GridRow[] = [];
  for (let i = 0; i < files.length; i += COLUMNS) {
    const slice = files.slice(i, i + COLUMNS);
    rows.push({ key: slice[0].id, files: slice });
  }
  return rows;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function isVideo(file: MediaFile): boolean {
  return file.fileType === 'VIDEO' || file.mimeType.startsWith('video/');
}

type CellProps = {
  file: MediaFile;
  size: number;
  thumbnailUri: string | null;
  fullUri: string | null;
  isSelecting: boolean;
  isSelected: boolean;
  onPressFile: (file: MediaFile) => void;
  onToggle: (fileId: string) => void;
  onLongPressFile: (file: MediaFile) => void;
};

const GridCell = memo(function GridCell({
  file,
  size,
  thumbnailUri,
  fullUri,
  isSelecting,
  isSelected,
  onPressFile,
  onToggle,
  onLongPressFile,
}: CellProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  // Thumb → full-res fallback, keyed on fileId so the cache survives the
  // presigned-URL refetch (same rationale as MediaThumbnailGrid).
  const sources = useMemo((): ImageSource[] => {
    const chain: ImageSource[] = [];
    if (thumbnailUri !== null) {
      chain.push({ uri: thumbnailUri, cacheKey: `${file.id}:thumb` });
    }
    if (fullUri !== null) {
      chain.push({ uri: fullUri, cacheKey: `${file.id}:full` });
    }
    return chain;
  }, [file.id, thumbnailUri, fullUri]);

  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => {
    setSourceIndex(0);
  }, [sources]);
  const currentSource = sources[sourceIndex] ?? null;
  const handleImageError = useCallback(() => setSourceIndex((i) => i + 1), []);

  const handlePress = useCallback(() => {
    if (isSelecting) {
      onToggle(file.id);
      return;
    }
    onPressFile(file);
  }, [file, isSelecting, onPressFile, onToggle]);

  const handleLongPress = useCallback(() => onLongPressFile(file), [file, onLongPressFile]);

  const uploaded = file.uploadStatus === 'UPLOADED';
  const video = isVideo(file);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={file.fileName}
      accessibilityState={{ selected: isSelected }}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={[styles.cell, { width: size, height: size }, isSelected && styles.cellSelected]}
    >
      {currentSource ? (
        <Image
          source={currentSource}
          style={styles.image}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          onError={handleImageError}
        />
      ) : (
        <View style={styles.placeholder} />
      )}

      {video && file.durationSeconds !== null ? (
        <View style={styles.durationPill}>
          <Text style={styles.durationText}>{formatDuration(file.durationSeconds)}</Text>
        </View>
      ) : null}

      {/* Backed-up / pending badge, bottom-left. */}
      <View style={[styles.statusBadge, uploaded ? styles.statusOk : styles.statusWarn]}>
        {uploaded ? (
          <Check size={10} color={theme.colors.white} strokeWidth={3} />
        ) : (
          <UploadCloud size={10} color={theme.colors.white} strokeWidth={2.4} />
        )}
      </View>

      {isSelected ? (
        <>
          <View style={styles.selectedOverlay} />
          <View style={styles.selectedCheck}>
            <Check size={12} color={theme.colors.white} strokeWidth={3} />
          </View>
        </>
      ) : null}
    </Pressable>
  );
});

export function FolderMediaGrid({
  files,
  viewUrlByFileId,
  isSelecting,
  selectedIds,
  onPressFile,
  onToggle,
  onLongPressFile,
  contentPaddingBottom = 0,
  refreshControl,
}: FolderMediaGridProps): React.ReactElement {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const size = Math.floor((width - H_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const sections = useMemo((): GridSection[] => {
    const sorted = files
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const now = new Date();
    const out: GridSection[] = [];
    let currentKey: string | null = null;
    let bucket: MediaFile[] = [];

    const flush = (): void => {
      if (bucket.length === 0) {
        return;
      }
      const date = new Date(bucket[0].createdAt);
      out.push({ title: sectionTitle(date, now), data: chunk(bucket) });
      bucket = [];
    };

    for (const file of sorted) {
      const key = dayKey(new Date(file.createdAt));
      if (key !== currentKey) {
        flush();
        currentKey = key;
      }
      bucket.push(file);
    }
    flush();
    return out;
  }, [files]);

  const renderRow = useCallback(
    ({ item }: { item: GridRow }) => (
      <View style={styles.row}>
        {item.files.map((file) => (
          <GridCell
            key={file.id}
            file={file}
            size={size}
            thumbnailUri={viewUrlByFileId?.[file.id]?.thumbnailUrl ?? null}
            fullUri={viewUrlByFileId?.[file.id]?.fullUrl ?? null}
            isSelecting={isSelecting}
            isSelected={selectedIds.has(file.id)}
            onPressFile={onPressFile}
            onToggle={onToggle}
            onLongPressFile={onLongPressFile}
          />
        ))}
      </View>
    ),
    [isSelecting, onLongPressFile, onPressFile, onToggle, selectedIds, size, viewUrlByFileId],
  );

  return (
    <SectionList<GridRow, { title: string }>
      sections={sections}
      keyExtractor={(row) => row.key}
      renderItem={renderRow}
      renderSectionHeader={({ section }) => (
        <SectionLabel style={styles.sectionHeader}>{section.title}</SectionLabel>
      )}
      stickySectionHeadersEnabled={false}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingBottom: contentPaddingBottom }}
      extraData={[isSelecting, selectedIds]}
    />
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  sectionHeader: {
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.card2,
  },
  cellSelected: {
    borderWidth: 3,
    borderColor: theme.colors.accent,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.card2,
  },
  durationPill: {
    position: 'absolute',
    top: 5,
    left: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.darkGlass,
  },
  durationText: {
    fontFamily: theme.typography.body[600],
    fontSize: 9.5,
    color: theme.colors.white,
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    width: 16,
    height: 16,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOk: {
    backgroundColor: theme.colors.ok,
  },
  statusWarn: {
    backgroundColor: theme.colors.warn,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.accent,
    opacity: SELECTED_OVERLAY_OPACITY,
  },
  selectedCheck: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

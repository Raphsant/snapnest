import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { Image, type ImageSource } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../components/ui/Card';
import { DisplayText } from '../components/ui/DisplayText';
import { PillButton } from '../components/ui/PillButton';
import { useMediaViewer } from '../context/MediaViewerContext';
import { useAgencyFolderDetails } from '../hooks/useAgencyFolderDetails';
import { useBatchViewUrls } from '../hooks/useBatchViewUrls';
import { useMe } from '../hooks/useMe';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { AgencyFolderDetailScreenProps } from '../navigation/agencyTypes';
import type { MediaFile } from '../services/filesService';
import { enqueueUpload } from '../services/uploadManager';
import { generateThumbnail } from '../services/thumbnailService';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const BOTTOM_PADDING = 150;
const COLUMNS = 3;
const GAP = 3;
const H_PADDING = 14;

type Props = AgencyFolderDetailScreenProps;

function inferMimeTypeFromFilename(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

type CellProps = {
  file: MediaFile;
  size: number;
  thumbnailUrl: string | null;
  fullUrl: string | null;
  isYours: boolean;
  onPress: (file: MediaFile) => void;
};

const AgencyCell = memo(function AgencyCell({
  file,
  size,
  thumbnailUrl,
  fullUrl,
  isYours,
  onPress,
}: CellProps): React.ReactElement {
  const styles = useStyles();
  const sources = useMemo((): ImageSource[] => {
    const chain: ImageSource[] = [];
    if (thumbnailUrl !== null) chain.push({ uri: thumbnailUrl, cacheKey: `${file.id}:thumb` });
    if (fullUrl !== null) chain.push({ uri: fullUrl, cacheKey: `${file.id}:full` });
    return chain;
  }, [file.id, thumbnailUrl, fullUrl]);

  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [sources]);
  const currentSource = sources[sourceIndex] ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={file.fileName}
      onPress={() => onPress(file)}
      style={[styles.cell, { width: size, height: size }]}
    >
      {currentSource ? (
        <Image
          source={currentSource}
          style={styles.cellImage}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          onError={() => setSourceIndex((i) => i + 1)}
        />
      ) : (
        <View style={styles.cellPlaceholder} />
      )}
      {isYours ? (
        <View style={styles.yoursBadge}>
          <Text style={styles.yoursText}>YOURS</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

export function AgencyFolderDetailScreen({ navigation, route }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const { folderId, folderName, agencyId } = route.params;
  const { openGallery } = useMediaViewer();
  const meQuery = useMe();
  const myId = meQuery.data?.id;
  const agencyName = meQuery.data?.memberships[0]?.agencyName ?? 'Workspace';

  const folderQuery = useAgencyFolderDetails(folderId);

  const files = useMemo((): MediaFile[] => {
    const list = folderQuery.data?.files ?? [];
    return list.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [folderQuery.data?.files]);

  const uploadedFileIds = useMemo(
    (): string[] => files.filter((f) => f.uploadStatus === 'UPLOADED').map((f) => f.id),
    [files],
  );
  const { data: viewUrlByFileId } = useBatchViewUrls(uploadedFileIds, agencyId);

  const yoursCount = useMemo(
    () => (myId ? files.filter((f) => f.ownerId === myId).length : 0),
    [files, myId],
  );

  const { isLoading, isError, error, refetch, isRefetching } = folderQuery;

  useEffect(() => {
    void refetch();
  }, [folderId, refetch]);
  useRefreshOnFocus(refetch);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handlePressFile = useCallback(
    (file: MediaFile) => {
      const startIndex = files.findIndex((f) => f.id === file.id);
      if (startIndex >= 0) {
        openGallery(files, startIndex, { agencyId, readOnly: true });
      }
    },
    [agencyId, files, openGallery],
  );

  // Submit-to-agency: preserved from before (image picker → agency upload),
  // restyled into the header. The grid/viewer remain read-only.
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
      const mimeType = asset.mimeType ?? inferMimeTypeFromFilename(fileName);
      const thumbnailUri = await generateThumbnail({ localUri: asset.uri, mimeType });
      enqueueUpload({
        localUri: asset.uri,
        fileName,
        mimeType,
        sizeBytes: asset.fileSize ?? 0,
        source: 'gallery',
        agencyId,
        folderId,
        thumbnailUri,
      });
      Alert.alert('Submitting', 'Your media is uploading and will appear in this folder shortly.', [
        { text: 'OK' },
      ]);
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : 'Could not submit media.';
      Alert.alert('Submit failed', message);
    }
  }, [agencyId, folderId]);

  const size = Math.floor((width - H_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const renderItem: ListRenderItem<MediaFile> = useCallback(
    ({ item }) => (
      <AgencyCell
        file={item}
        size={size}
        thumbnailUrl={viewUrlByFileId?.[item.id]?.thumbnailUrl ?? null}
        fullUrl={viewUrlByFileId?.[item.id]?.fullUrl ?? null}
        isYours={myId !== undefined && item.ownerId === myId}
        onPress={handlePressFile}
      />
    ),
    [handlePressFile, myId, size, viewUrlByFileId],
  );

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

  const showInitialLoading = isLoading && files.length === 0;
  const showEmpty = !isLoading && !isError && files.length === 0;
  const showError = isError && files.length === 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Back to ${agencyName}`}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ChevronLeft size={18} color={theme.colors.accent} strokeWidth={2.4} />
            <Text style={styles.backLabel} numberOfLines={1}>{agencyName}</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleSubmit()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Submit media to this folder"
            style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
          >
            <Plus size={16} color={theme.colors.accent} strokeWidth={2.4} />
            <Text style={styles.submitLabel}>Submit</Text>
          </Pressable>
        </View>

        <DisplayText size={26}>{folderName}</DisplayText>
        <Text style={styles.meta} numberOfLines={1}>
          {files.length} {files.length === 1 ? 'file' : 'files'} · Read-only
          {yoursCount > 0 ? <Text style={styles.metaYours}>{`  ·  ${yoursCount} yours`}</Text> : null}
        </Text>
      </View>

      {showInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : null}

      {showError ? (
        <View style={styles.centeredCard}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load files</Text>
            <Text style={styles.errorBody}>
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </Text>
            <PillButton title="Try again" variant="secondary" height={44} onPress={handleRefresh} />
          </Card>
        </View>
      ) : null}

      {showEmpty ? (
        <View style={styles.centeredCard}>
          <Text style={styles.emptyTitle}>No files in this folder yet</Text>
          <Text style={styles.emptyBody}>Submitted media will appear here.</Text>
        </View>
      ) : null}

      {!showInitialLoading && !showError && files.length > 0 ? (
        <FlatList
          data={files}
          keyExtractor={(f) => f.id}
          renderItem={renderItem}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.column}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingBottom: insets.bottom + BOTTOM_PADDING }}
        />
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: theme.colors.glass,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -4,
    flexShrink: 1,
  },
  backLabel: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.accent,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 8,
  },
  submitLabel: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.accent,
  },
  meta: {
    marginTop: 4,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    color: theme.colors.muted,
  },
  metaYours: {
    fontFamily: theme.typography.body[600],
    color: theme.colors.accentDeep,
  },
  column: {
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.card2,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.card2,
  },
  yoursBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDeep,
  },
  yoursText: {
    fontFamily: theme.typography.body[700],
    fontSize: 9,
    letterSpacing: 0.3,
    color: theme.colors.white,
  },
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  centeredCard: {
    paddingHorizontal: 14,
    paddingTop: 24,
    alignItems: 'center',
    gap: 6,
  },
  errorCard: {
    alignSelf: 'stretch',
    padding: 16,
    gap: 10,
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
  emptyTitle: {
    marginTop: 12,
    fontFamily: theme.typography.body[700],
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: theme.typography.body[400],
    fontSize: 13.5,
    color: theme.colors.muted,
    textAlign: 'center',
  },
}));

import React, { useCallback, useState } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../components/ui/Card';
import { DisplayText } from '../components/ui/DisplayText';
import { PillButton } from '../components/ui/PillButton';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Toast } from '../components/ui/Toast';
import { STORAGE_SCAN_QUERY_KEY, useStorageScan } from '../hooks/useStorageScan';
import { freeUpStorage } from '../services/storageService';
import { queryClient } from '../services/queryClient';
import { formatFileSize } from '../utils/formatRelativeTime';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const BOTTOM_PADDING = 150;
const TOAST_MS = 2600;

const FREE_UP_COPY =
  'Only removes local copies of files already backed up. Nothing leaves the cloud, and anything saved to Photos stays in Photos.';

type StorageScreenProps = {
  navigation: { goBack: () => void };
};

export function StorageScreen({ navigation }: StorageScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const { data, isLoading } = useStorageScan();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const runFreeUp = useCallback(async () => {
    const uris = data?.clearableUris ?? [];
    if (uris.length === 0) {
      return;
    }
    setBusy(true);
    try {
      const freed = await freeUpStorage(uris);
      await queryClient.invalidateQueries({ queryKey: STORAGE_SCAN_QUERY_KEY });
      showToast(`Freed ${formatFileSize(freed)}`);
    } finally {
      setBusy(false);
    }
  }, [data?.clearableUris, showToast]);

  const onFreeUpPress = useCallback(() => {
    Alert.alert('Free up space?', FREE_UP_COPY, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Free up', onPress: () => void runFreeUp() },
    ]);
  }, [runFreeUp]);

  const total = data?.total ?? 0;
  const keep = data?.keepBytes ?? 0;
  const clearable = data?.clearableBytes ?? 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BOTTOM_PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ChevronLeft size={18} color={theme.colors.accent} strokeWidth={2.4} />
          <Text style={styles.backLabel}>Settings</Text>
        </Pressable>

        <DisplayText size={30} style={styles.title}>Storage</DisplayText>

        <Card radius="lg" shadow style={styles.hero}>
          {isLoading && data === undefined ? (
            <View style={styles.heroLoading}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          ) : (
            <>
              <DisplayText size={30}>{formatFileSize(total)}</DisplayText>
              <Text style={styles.heroSub}>on this phone</Text>

              <View style={styles.bar}>
                {keep > 0 ? <View style={[styles.segment, styles.segKeep, { flex: keep }]} /> : null}
                {clearable > 0 ? (
                  <View style={[styles.segment, styles.segClear, { flex: clearable }]} />
                ) : null}
                {total === 0 ? <View style={[styles.segment, styles.segEmpty, { flex: 1 }]} /> : null}
              </View>

              <View style={styles.legend}>
                <LegendRow color={theme.colors.accent} label="Waiting to upload" value={formatFileSize(keep)} />
                <LegendRow color={theme.colors.ok} label="Clearable" value={formatFileSize(clearable)} />
              </View>
            </>
          )}
        </Card>

        <View style={styles.freeUpButton}>
          <PillButton
            title={`Free up ${formatFileSize(clearable)}`}
            onPress={onFreeUpPress}
            disabled={busy || clearable === 0}
          />
        </View>
        <Text style={styles.footnote}>{FREE_UP_COPY}</Text>

        {data && data.biggest.length > 0 ? (
          <>
            <SectionLabel style={styles.sectionLabel}>Biggest items</SectionLabel>
            {data.biggest.map((file) => (
              <Card key={file.uri} style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.itemSize}>{formatFileSize(file.size)}</Text>
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      {toast ? <Toast title={toast} subtitle="Local copies cleared" /> : null}
    </View>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
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
  pressed: {
    opacity: 0.7,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -4,
    marginBottom: 6,
  },
  backLabel: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.accent,
  },
  title: {
    marginBottom: 16,
  },
  hero: {
    padding: 20,
  },
  heroLoading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  heroSub: {
    marginTop: 2,
    fontFamily: theme.typography.body[400],
    fontSize: 13,
    color: theme.colors.muted,
  },
  bar: {
    flexDirection: 'row',
    height: 12,
    gap: 2,
    marginTop: 16,
    marginBottom: 14,
  },
  segment: {
    height: '100%',
    borderRadius: 6,
  },
  segKeep: {
    backgroundColor: theme.colors.accent,
  },
  segClear: {
    backgroundColor: theme.colors.ok,
  },
  segEmpty: {
    backgroundColor: theme.colors.card2,
  },
  legend: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: theme.radius.pill,
  },
  legendLabel: {
    flex: 1,
    fontFamily: theme.typography.body[500],
    fontSize: 13,
    color: theme.colors.text,
  },
  legendValue: {
    fontFamily: theme.typography.body[600],
    fontSize: 13,
    color: theme.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  freeUpButton: {
    marginTop: 18,
  },
  footnote: {
    marginTop: 10,
    fontFamily: theme.typography.body[400],
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 10,
  },
  itemCard: {
    padding: 12,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontFamily: theme.typography.mono,
    fontSize: 12.5,
    color: theme.colors.text,
  },
  itemSize: {
    fontFamily: theme.typography.body[600],
    fontSize: 13,
    color: theme.colors.muted,
    fontVariant: ['tabular-nums'],
  },
}));

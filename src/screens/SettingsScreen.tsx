import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { ChevronRight } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { DestinationPickerSheet } from '../components/DestinationPickerSheet';
import { Card } from '../components/ui/Card';
import { DisplayText } from '../components/ui/DisplayText';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Toggle } from '../components/ui/Toggle';
import { useFolders } from '../hooks/useFolders';
import { useMe } from '../hooks/useMe';
import { useStorageScan } from '../hooks/useStorageScan';
import * as authService from '../services/authService';
import * as sessionService from '../services/sessionService';
import type { MainTabParamList } from '../navigation/mainTabTypes';
import { useAuthStore } from '../store/authStore';
import { useCameraStore } from '../store/cameraStore';
import { useThemeStore } from '../store/themeStore';
import { palettes } from '../theme/tokens';
import { formatFileSize } from '../utils/formatRelativeTime';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const BOTTOM_PADDING = 150;

type SettingsScreenProps = {
  navigation: { openStorage: () => void };
};

export function SettingsScreen({ navigation }: SettingsScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const tabNavigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  const email = useAuthStore((s) => s.user?.email);
  const firstName = useAuthStore((s) => s.user?.firstName);
  const displayName = firstName?.trim() ? firstName.trim() : email ?? 'Your account';
  const initial = (displayName[0] ?? '?').toUpperCase();

  const saveToPhotos = useCameraStore((s) => s.saveToPhotos);
  const setSaveToPhotos = useCameraStore((s) => s.setSaveToPhotos);
  const themeName = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const destinationFolderId = useCameraStore((s) => s.destinationFolderId);
  const setDestinationFolder = useCameraStore((s) => s.setDestinationFolder);
  const [sheetVisible, setSheetVisible] = useState(false);

  const foldersQuery = useFolders();
  const meQuery = useMe();
  const storageScan = useStorageScan();

  const [loggingOut, setLoggingOut] = useState(false);

  const destinationLabel = useMemo((): string => {
    const folders = foldersQuery.data ?? [];
    if (destinationFolderId === null) {
      return folders.find((f) => f.isSystem)?.name ?? 'Unfiled';
    }
    return folders.find((f) => f.id === destinationFolderId)?.name ?? 'Unfiled';
  }, [foldersQuery.data, destinationFolderId]);

  const agencyName = meQuery.data?.memberships[0]?.agencyName ?? 'None';
  const storageValue = storageScan.data ? formatFileSize(storageScan.data.total) : '—';
  const version = Constants.expoConfig?.version ?? '—';

  // Dev aid — logs the JWT for manual API testing. Intentionally kept.
  useEffect(() => {
    void authService.getAuthToken().then((token) => {
      console.log('🔑 JWT FOR TESTING:', token);
    });
  }, []);

  const handleLogOut = useCallback(async (): Promise<void> => {
    setLoggingOut(true);
    try {
      await sessionService.logout();
    } catch (error: unknown) {
      console.error('[SettingsScreen] logout', error);
    } finally {
      setLoggingOut(false);
    }
  }, []);

  const confirmLogOut = useCallback((): void => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => void handleLogOut() },
    ]);
  }, [handleLogOut]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BOTTOM_PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        <DisplayText size={34} style={styles.title}>Settings</DisplayText>

        <Pressable
          onPress={() => {
            // TODO: account screen (none exists yet).
          }}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel="Account"
        >
          <Card radius="lg" shadow style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              {email ? <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text> : null}
            </View>
            <ChevronRight size={20} color={theme.colors.faint} strokeWidth={2} />
          </Card>
        </Pressable>

        <Group label="Capture">
          <ToggleRow
            label="Save to Photos"
            sub="Keep a copy of every capture in your camera roll"
            value={saveToPhotos}
            onValueChange={setSaveToPhotos}
          />
          <Divider />
          <NavRow label="Default destination" value={destinationLabel} onPress={() => setSheetVisible(true)} />
        </Group>

        <Group label="Storage & agency">
          <NavRow label="On-device storage" value={storageValue} onPress={navigation.openStorage} />
          <Divider />
          <NavRow label="Agency membership" value={agencyName} onPress={() => tabNavigation.navigate('Agency')} />
        </Group>

        <View style={styles.group}>
          <SectionLabel style={styles.groupLabel}>Appearance</SectionLabel>
          <Card style={styles.appearanceCard}>
            <View style={styles.segTrack}>
              <ThemeSegment
                label="Comfort"
                accent={palettes.comfort.colors.accent}
                active={themeName === 'comfort'}
                onPress={() => setTheme('comfort')}
              />
              <ThemeSegment
                label="Blue"
                accent={palettes.blue.colors.accent}
                active={themeName === 'blue'}
                onPress={() => setTheme('blue')}
              />
            </View>
          </Card>
        </View>

        <Group label="About">
          <NavRow
            label="Help & contact"
            onPress={() => {
              // TODO(Phase 10+): help / contact.
            }}
          />
          <Divider />
          <NavRow
            label="Privacy"
            onPress={() => {
              // TODO: privacy policy link.
            }}
          />
          <Divider />
          <NavRow label="Version" value={version} />
        </Group>

        <Pressable
          onPress={confirmLogOut}
          disabled={loggingOut}
          accessibilityRole="button"
          style={({ pressed }) => [styles.logout, pressed && styles.pressed, loggingOut && styles.logoutDisabled]}
        >
          <Text style={styles.logoutLabel}>{loggingOut ? 'Signing out…' : 'Log out'}</Text>
        </Pressable>
      </ScrollView>

      <DestinationPickerSheet
        visible={sheetVisible}
        selectedFolderId={destinationFolderId}
        onSelect={setDestinationFolder}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <SectionLabel style={styles.groupLabel}>{label}</SectionLabel>
      <Card style={styles.groupCard}>{children}</Card>
    </View>
  );
}

function Divider(): React.ReactElement {
  const styles = useStyles();
  return <View style={styles.divider} />;
}

function ThemeSegment({
  label,
  accent,
  active,
  onPress,
}: {
  label: string;
  accent: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} theme`}
      style={[styles.segItem, active && styles.segItemActive]}
    >
      <View style={[styles.segDot, { backgroundColor: accent }]} />
      <Text style={active ? styles.segLabelActive : styles.segLabel}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onValueChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={label} />
    </View>
  );
}

function NavRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const content = (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {onPress ? <ChevronRight size={18} color={theme.colors.faint} strokeWidth={2} /> : null}
      </View>
    </View>
  );
  if (!onPress) {
    return content;
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
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
    opacity: 0.75,
  },
  title: {
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: theme.typography.display,
    fontSize: 22,
    color: theme.colors.accentDeep,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontFamily: theme.typography.body[700],
    fontSize: 16,
    color: theme.colors.text,
  },
  profileEmail: {
    marginTop: 2,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    color: theme.colors.muted,
  },
  group: {
    marginTop: 22,
  },
  groupLabel: {
    marginBottom: 10,
  },
  groupCard: {
    paddingHorizontal: 14,
  },
  appearanceCard: {
    padding: 10,
  },
  segTrack: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card2,
    borderRadius: theme.radius.pill,
    padding: 4,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  segItemActive: {
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
  },
  segDot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
  },
  segLabel: {
    fontFamily: theme.typography.body[500],
    fontSize: 14,
    color: theme.colors.muted,
  },
  segLabelActive: {
    fontFamily: theme.typography.body[600],
    fontSize: 14,
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    flex: 1,
    fontFamily: theme.typography.body[500],
    fontSize: 15,
    color: theme.colors.text,
  },
  rowSub: {
    marginTop: 2,
    fontFamily: theme.typography.body[400],
    fontSize: 12,
    color: theme.colors.muted,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '55%',
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: theme.typography.body[500],
    fontSize: 13.5,
    color: theme.colors.muted,
  },
  logout: {
    height: 52,
    marginTop: 28,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutDisabled: {
    opacity: 0.5,
  },
  logoutLabel: {
    fontFamily: theme.typography.body[700],
    fontSize: 15.5,
    color: theme.colors.danger,
  },
}));

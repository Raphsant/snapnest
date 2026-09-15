import React, { useCallback, useMemo } from 'react';
import { Camera, ChevronRight, Folder as FolderIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { Card } from '../components/ui/Card';
import { DisplayText } from '../components/ui/DisplayText';
import { IconTile } from '../components/ui/IconTile';
import { PillButton } from '../components/ui/PillButton';
import { SectionLabel } from '../components/ui/SectionLabel';
import { useAgencyFolders } from '../hooks/useAgencyFolders';
import { useMe } from '../hooks/useMe';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { AgencyFolderListScreenProps } from '../navigation/agencyTypes';
import type { MainTabParamList } from '../navigation/mainTabTypes';
import type { AgencyFolder } from '../services/agencyService';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const BOTTOM_PADDING = 150;

type Props = AgencyFolderListScreenProps;

export function AgencyFoldersScreen({ navigation }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const tabNavigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const meQuery = useMe();
  // The screen has always assumed a single membership; keep that assumption.
  const membership = meQuery.data?.memberships[0];
  const agencyId = membership?.agencyId;
  const agencyName = membership?.agencyName ?? 'Agency';
  const initial = (agencyName[0] ?? 'A').toUpperCase();

  const { data: folders, isLoading, isError, error, refetch, isRefetching } = useAgencyFolders(agencyId);
  useRefreshOnFocus(refetch);

  const folderList = useMemo<AgencyFolder[]>(() => folders ?? [], [folders]);
  const showSpinner = isLoading && folders === undefined;
  const showError = isError && folders === undefined;
  const showEmpty = !isLoading && !isError && folderList.length === 0;

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const openFolder = useCallback(
    (folder: AgencyFolder) => {
      if (agencyId === undefined) {
        return;
      }
      navigation.navigate('AgencyFolderDetail', { folderId: folder.id, folderName: folder.name, agencyId });
    },
    [agencyId, navigation],
  );

  const goToCamera = useCallback(() => {
    // TODO(stretch Submit flow): the camera destination targets personal folders
    // only (no agency concept), so this just opens the camera without preselecting.
    tabNavigation.navigate('Camera');
  }, [tabNavigation]);

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
          <View style={styles.badge}>
            <Text style={styles.badgeInitial}>{initial}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>AGENCY WORKSPACE</Text>
            <DisplayText size={26}>{agencyName}</DisplayText>
          </View>
        </View>

        <Card radius="lg" style={styles.infoCard}>
          <Text style={styles.infoTitle}>Anything you drop here reaches the editors instantly</Text>
          <Text style={styles.infoSub}>
            They work in the {agencyName} dashboard — you never have to send a link again.
          </Text>
        </Card>

        <SectionLabel style={styles.sectionLabel}>Intake folders</SectionLabel>

        {showError ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load workspace</Text>
            <Text style={styles.errorBody}>
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </Text>
            <PillButton title="Try again" variant="secondary" height={44} onPress={handleRefresh} />
          </Card>
        ) : showSpinner ? (
          <View style={styles.spinnerBox}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
          </View>
        ) : showEmpty ? (
          <Text style={styles.inlineHint}>No workspace folders yet.</Text>
        ) : (
          folderList.map((folder) => (
            <Pressable
              key={folder.id}
              onPress={() => openFolder(folder)}
              accessibilityRole="button"
              accessibilityLabel={folder.name}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card shadow style={styles.folderCard}>
                <View style={styles.row}>
                  {/* No latest-file thumbnail on the agency folder list — fallback tile. */}
                  <IconTile icon={FolderIcon} tone="neutral" size={44} />
                  <View style={styles.rowMiddle}>
                    <Text style={styles.rowName} numberOfLines={1}>{folder.name}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {folder.fileCount === 0
                        ? 'Empty · waiting on you'
                        : `${folder.fileCount} ${folder.fileCount === 1 ? 'file' : 'files'}`}
                    </Text>
                  </View>
                  {/* No open/closed status in the data — all intake folders read as OPEN. */}
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>OPEN</Text>
                  </View>
                  <ChevronRight size={20} color={theme.colors.faint} strokeWidth={2} />
                </View>
              </Card>
            </Pressable>
          ))
        )}

        <View style={styles.ctaWrap}>
          <PillButton title="Shoot straight into a folder" icon={Camera} onPress={goToCamera} />
          <Text style={styles.ctaNote}>Read-only for you — editors decide what ships.</Text>
        </View>
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
  pressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInitial: {
    fontFamily: theme.typography.display,
    fontSize: 20,
    color: theme.colors.card,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontFamily: theme.typography.body[500],
    fontSize: 12,
    letterSpacing: 0.48,
    color: theme.colors.muted,
    marginBottom: 2,
  },
  infoCard: {
    padding: 16,
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accentLine,
  },
  infoTitle: {
    fontFamily: theme.typography.body[600],
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.accentDeep,
  },
  infoSub: {
    marginTop: 6,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.accentDeep,
    opacity: 0.8,
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 10,
  },
  spinnerBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  inlineHint: {
    fontFamily: theme.typography.body[400],
    fontSize: 13.5,
    color: theme.colors.faint,
    paddingVertical: 8,
  },
  folderCard: {
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.text,
  },
  rowSub: {
    marginTop: 3,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    color: theme.colors.muted,
  },
  openBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.okSoft,
  },
  openBadgeText: {
    fontFamily: theme.typography.body[700],
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: theme.colors.okDeep,
  },
  errorCard: {
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
  ctaWrap: {
    marginTop: 22,
    gap: 10,
  },
  ctaNote: {
    fontFamily: theme.typography.body[400],
    fontSize: 12,
    color: theme.colors.faint,
    textAlign: 'center',
  },
}));

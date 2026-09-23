import React from 'react';
import { Check, UploadCloud } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import {
  CHIP_OK_BG,
  CHIP_OK_TEXT,
  CHIP_WARN_BG,
  CHIP_WARN_TEXT,
  CREAM_10,
  CREAM_75,
  folderLabel,
  formatClockTime,
  kindAndSizeLabel,
} from './viewerChrome';
import type { MediaFile } from '../../services/filesService';
import type { IconComponent } from '../ui/types';
import { createThemedStyles } from '../../theme/createThemedStyles';

type ViewerMetaChipsProps = {
  file: MediaFile;
};

export function ViewerMetaChips({ file }: ViewerMetaChipsProps): React.ReactElement {
  const styles = useStyles();
  const uploaded = file.uploadStatus === 'UPLOADED';
  const folder = folderLabel(file);

  return (
    <View style={styles.row}>
      {uploaded ? (
        // `createdAt` is CAPTURE time, not upload time: MediaFile carries no
        // upload timestamp and `updatedAt` is not one (a move rewrites it).
        <Chip
          icon={Check}
          label={`Backed up ${formatClockTime(file.createdAt)}`}
          background={CHIP_OK_BG}
          tint={CHIP_OK_TEXT}
        />
      ) : (
        // PENDING / UPLOADING / FAILED all read the same here — the Uploads tab
        // is where a queued file's real state lives.
        <Chip
          icon={UploadCloud}
          iconStrokeWidth={2.4}
          label="Not backed up"
          background={CHIP_WARN_BG}
          tint={CHIP_WARN_TEXT}
        />
      )}

      <Chip label={kindAndSizeLabel(file)} background={CREAM_10} tint={CREAM_75} />

      {folder !== null ? (
        <Chip label={folder} background={CREAM_10} tint={CREAM_75} />
      ) : null}
    </View>
  );
}

type ChipProps = {
  icon?: IconComponent;
  iconStrokeWidth?: number;
  label: string;
  background: string;
  tint: string;
};

function Chip({
  icon: Icon,
  iconStrokeWidth = 3.6,
  label,
  background,
  tint,
}: ChipProps): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      {Icon !== undefined ? <Icon size={11} color={tint} strokeWidth={iconStrokeWidth} /> : null}
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = createThemedStyles((t) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  chip: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: t.radius.pill,
  },
  label: {
    fontFamily: t.typography.body[600],
    fontSize: 11.5,
  },
}));

import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useUpdateFolder } from '../hooks/useUpdateFolder';
import type { Folder } from '../services/foldersService';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

const MAX_NAME_LENGTH = 100;
/** Same scrim as ui/BottomSheet: the `darkBg` token at 45%, on its own layer. */
const SCRIM_ALPHA = 0.45;

type EditFolderModalProps = {
  visible: boolean;
  folder: Folder | null;
  onClose: () => void;
};

function getMutationErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = (payload as { message: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.filter((part): part is string => typeof part === 'string').join(', ');
      }
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not update folder. Please try again.';
}

export function EditFolderModal({ visible, folder, onClose }: EditFolderModalProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const [name, setName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { mutate, isPending, reset } = useUpdateFolder();

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !isPending && folder !== null;

  const handleClose = useCallback(() => {
    setName('');
    setSubmitError(null);
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (visible && folder !== null) {
      setName(folder.name);
      setSubmitError(null);
    }
    if (!visible) {
      setName('');
      setSubmitError(null);
      reset();
    }
  }, [folder, reset, visible]);

  const handleSave = (): void => {
    if (!canSave || folder === null) {
      return;
    }
    setSubmitError(null);
    mutate(
      { id: folder.id, name: trimmedName },
      {
        onSuccess: () => {
          handleClose();
        },
        onError: (error: unknown) => {
          setSubmitError(getMutationErrorMessage(error));
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* Scrim is its own layer — `darkBg` at 45%, as in ui/BottomSheet. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Rename Folder</Text>
            <Text style={styles.label}>Folder name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Folder name"
              placeholderTextColor={theme.colors.faint}
              maxLength={MAX_NAME_LENGTH}
              autoFocus
              editable={!isPending}
              style={styles.input}
            />
            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
            <View style={styles.actions}>
              <SecondaryButton
                label="Cancel"
                onPress={handleClose}
                disabled={isPending}
                style={styles.actionButton}
              />
              <PrimaryButton
                label={isPending ? 'Saving…' : 'Save'}
                onPress={handleSave}
                disabled={!canSave}
                style={styles.actionButton}
              />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const useStyles = createThemedStyles((t) => StyleSheet.create({
  scrim: {
    backgroundColor: t.colors.darkBg,
    opacity: SCRIM_ALPHA,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  keyboardAvoid: {
    width: '100%',
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.card,
    padding: 20,
    shadowColor: t.shadows.lg.shadowColor,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    fontFamily: t.typography.body[600],
    fontSize: 22,
    color: t.colors.text,
    marginBottom: 16,
  },
  label: {
    fontFamily: t.typography.body[600],
    fontSize: 14,
    color: t.colors.muted,
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: t.radius.sm,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.card,
    paddingHorizontal: 16,
    fontFamily: t.typography.body[400],
    fontSize: 16,
    color: t.colors.text,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: t.typography.body[400],
    fontSize: 14,
    color: t.colors.danger,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
}));

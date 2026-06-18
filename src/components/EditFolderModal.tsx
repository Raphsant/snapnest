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
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

const MAX_NAME_LENGTH = 100;

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
              placeholderTextColor={colors.tabInactive}
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  keyboardAvoid: {
    width: '100%',
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.card,
    padding: spacing.xl,
    shadowColor: colors.primaryNavy,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    ...typography.h2,
    color: colors.primaryNavy,
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodySmall,
    color: colors.mutedText,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.primaryNavy,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});

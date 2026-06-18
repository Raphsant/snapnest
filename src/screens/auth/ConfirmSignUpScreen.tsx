import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../../components/PrimaryButton';
import type { AuthScreenProps } from '../../navigation/authTypes';
import * as authService from '../../services/authService';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = AuthScreenProps<'ConfirmSignUp'>;

export function ConfirmSignUpScreen({ navigation, route }: Props) {
  const { email, firstName } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resentHint, setResentHint] = useState<string | null>(null);
  const resentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resentTimerRef.current) {
        clearTimeout(resentTimerRef.current);
      }
    };
  }, []);

  const sanitizedCode = code.replace(/\D/g, '').slice(0, 6);

  const onVerify = async (): Promise<void> => {
    if (sanitizedCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authService.confirmSignUp({ email, code: sanitizedCode });
      navigation.navigate('Login', { email });
    } catch (verifyError: unknown) {
      const message = verifyError instanceof Error ? verifyError.message : 'Verification failed.';
      setError(message);
      console.error('[ConfirmSignUpScreen]', verifyError);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async (): Promise<void> => {
    setError(null);
    setResentHint(null);
    setLoading(true);
    try {
      await authService.resendConfirmationCode(email);
      setResentHint('Sent!');
      if (resentTimerRef.current) {
        clearTimeout(resentTimerRef.current);
      }
      resentTimerRef.current = setTimeout(() => {
        setResentHint(null);
      }, 2500);
    } catch (resendError: unknown) {
      const message = resendError instanceof Error ? resendError.message : 'Could not resend code.';
      setError(message);
      console.error('[ConfirmSignUpScreen] resend', resendError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            {firstName ? `Hi ${firstName}, we sent a code to` : 'We sent a code to'}
          </Text>
          <Text style={styles.emailText}>{email}</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>6-digit code</Text>
            <TextInput
              value={sanitizedCode}
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, '').slice(0, 6));
              }}
              placeholder="000000"
              placeholderTextColor={colors.mutedText}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            label={loading ? 'Verifying…' : 'Verify'}
            onPress={() => {
              void onVerify();
            }}
            disabled={loading || sanitizedCode.length !== 6}
            style={styles.primaryBtn}
          />

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => {
              void onResend();
            }}
            style={styles.resendWrap}
          >
            <Text style={[styles.resendText, loading && styles.resendDisabled]}>
              Didn&apos;t get the code? <Text style={styles.resendAccent}>Resend</Text>
            </Text>
          </Pressable>
          {resentHint ? <Text style={styles.sentHint}>{resentHint}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.primaryNavy,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedText,
    marginTop: spacing.sm,
  },
  emailText: {
    ...typography.body,
    color: colors.primaryNavy,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  fieldGroup: {
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
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.primaryNavy,
    letterSpacing: 4,
    textAlign: 'center',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    marginTop: spacing.sm,
  },
  resendWrap: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  resendText: {
    ...typography.body,
    color: colors.mutedText,
  },
  resendAccent: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
  resendDisabled: {
    opacity: 0.5,
  },
  sentHint: {
    ...typography.bodySmall,
    color: colors.success,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
});

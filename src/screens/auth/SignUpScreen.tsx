import React, { useMemo, useState } from 'react';
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

type Props = AuthScreenProps<'SignUp'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(firstName: string, email: string, password: string): string | null {
  const name = firstName.trim();
  if (name.length === 0) {
    return 'Please enter your first name.';
  }
  const em = email.trim();
  if (!EMAIL_REGEX.test(em)) {
    return 'Please enter a valid email address.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

export function SignUpScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () =>
      firstName.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 8 &&
      EMAIL_REGEX.test(email.trim()),
    [firstName, email, password],
  );

  const onSignUp = async (): Promise<void> => {
    const clientError = validateForm(firstName, email, password);
    if (clientError) {
      setValidationError(clientError);
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setLoading(true);
    try {
      await authService.signUp({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
      });
      navigation.navigate('ConfirmSignUp', { email: email.trim(), firstName: firstName.trim() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sign up failed.';
      setSubmitError(message);
      console.error('[SignUpScreen]', error);
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join SnapNest with your email</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Nicole"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="words"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              textContentType="emailAddress"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.mutedText}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable
                onPress={() => {
                  setShowPassword((v) => !v);
                }}
                hitSlop={12}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </View>

          {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

          <PrimaryButton
            label={loading ? 'Signing up...' : 'Sign Up'}
            onPress={() => {
              void onSignUp();
            }}
            disabled={loading || !canSubmit}
            style={styles.primaryBtn}
          />

          <Pressable
            onPress={() => navigation.navigate('Login', {})}
            accessibilityRole="button"
            style={styles.footerLinkWrap}
          >
            <Text style={styles.footerMuted}>
              Already have an account? <Text style={styles.footerLink}>Log In</Text>
            </Text>
          </Pressable>
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
  // Subtle glass-ish field: translucent white + border so it reads on gradient-style screens
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.primaryNavy,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 72,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    paddingVertical: spacing.sm,
  },
  eyeText: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '600',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    marginTop: spacing.md,
  },
  footerLinkWrap: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  footerMuted: {
    ...typography.body,
    color: colors.mutedText,
  },
  footerLink: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
});

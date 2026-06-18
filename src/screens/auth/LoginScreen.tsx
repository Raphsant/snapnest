import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = AuthScreenProps<'Login'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ navigation, route }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const paramEmail = route.params?.email ?? '';
  const [email, setEmail] = useState(paramEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (paramEmail) {
      setEmail(paramEmail);
    }
  }, [paramEmail]);

  const canSubmit = useMemo(
    () => EMAIL_REGEX.test(email.trim()) && password.length > 0,
    [email, password],
  );

  const onLogin = async (): Promise<void> => {
    const em = email.trim();
    if (!EMAIL_REGEX.test(em)) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (password.length === 0) {
      setValidationError('Please enter your password.');
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setLoading(true);
    try {
      await authService.signIn({ email: em, password });
      const current = await authService.getCurrentUser();
      if (!current) {
        throw new Error('Signed in but could not load your profile. Try again.');
      }
      const attrs = await authService.getUserAttributes();
      setUser({
        id: current.userId,
        email: attrs.email,
        firstName: attrs.givenName,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sign in failed.';
      setSubmitError(message);
      console.error('[LoginScreen]', error);
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in with your email</Text>

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
              textContentType="username"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={colors.mutedText}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="password"
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

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert('Forgot password?', 'Coming soon.', [{ text: 'OK' }], { cancelable: true })
            }
            style={styles.forgotWrap}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

          <PrimaryButton
            label={loading ? 'Signing in…' : 'Log In'}
            onPress={() => {
              void onLogin();
            }}
            disabled={loading || !canSubmit}
            style={styles.primaryBtn}
          />

          <Pressable
            onPress={() => navigation.navigate('SignUp')}
            accessibilityRole="button"
            style={styles.footerLinkWrap}
          >
            <Text style={styles.footerMuted}>
              Don&apos;t have an account? <Text style={styles.footerLink}>Sign up</Text>
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
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotText: {
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
    marginTop: spacing.xs,
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

import React, { useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react-native';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillInput } from '../../components/auth/PillInput';
import { DisplayText } from '../../components/ui/DisplayText';
import { PillButton } from '../../components/ui/PillButton';
import type { AuthScreenProps } from '../../navigation/authTypes';
import * as authService from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

type Props = AuthScreenProps<'Login'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const setUser = useAuthStore((s) => s.setUser);
  const paramEmail = route.params?.email ?? '';
  const [email, setEmail] = useState(paramEmail);
  const [password, setPassword] = useState('');
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
          <View style={styles.glyph}>
            <Camera size={26} color={theme.colors.white} strokeWidth={2.2} />
          </View>
          <DisplayText size={34}>Welcome back</DisplayText>
          <Text style={styles.subtitle}>Log in to keep your captures flowing.</Text>

          <PillInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            textContentType="username"
            containerStyle={styles.field}
          />

          <PillInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            containerStyle={styles.field}
          />

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

          <PillButton
            title={loading ? 'Logging in…' : 'Log in'}
            height={54}
            onPress={() => void onLogin()}
            disabled={loading || !canSubmit}
          />

          <Pressable
            onPress={() => navigation.navigate('SignUp')}
            accessibilityRole="button"
            style={styles.footerLinkWrap}
          >
            <Text style={styles.footerMuted}>
              New here? <Text style={styles.footerLink}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  glyph: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 28,
    fontFamily: theme.typography.body[400],
    fontSize: 15,
    color: theme.colors.muted,
  },
  field: {
    marginBottom: 16,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 18,
  },
  forgotText: {
    fontFamily: theme.typography.body[600],
    fontSize: 13.5,
    color: theme.colors.accent,
  },
  errorText: {
    marginBottom: 12,
    fontFamily: theme.typography.body[500],
    fontSize: 12.5,
    color: theme.colors.danger,
  },
  footerLinkWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerMuted: {
    fontFamily: theme.typography.body[400],
    fontSize: 14.5,
    color: theme.colors.muted,
  },
  footerLink: {
    fontFamily: theme.typography.body[700],
    color: theme.colors.accent,
  },
}));

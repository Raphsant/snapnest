import React, { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import {
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
import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

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

/**
 * UI-only strength readout. The only real rule is length >= 8 (enforced by
 * validateForm); these tiers never gate submit — they just guide the user.
 */
function passwordStrength(pw: string): { tiers: number; hint: string } {
  let tiers = 0;
  if (pw.length >= 8) tiers += 1;
  if (pw.length >= 12) tiers += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) tiers += 1;
  const hint =
    tiers >= 3
      ? 'Strong password.'
      : tiers === 2
        ? 'Good — a longer password is even stronger.'
        : tiers === 1
          ? 'Okay — add length or mix in upper, lower & a number.'
          : 'Use at least 8 characters.';
  return { tiers, hint };
}

export function SignUpScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const strength = passwordStrength(password);

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
          <Pressable
            onPress={() => navigation.navigate('Login', {})}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back to log in"
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ChevronLeft size={18} color={theme.colors.accent} strokeWidth={2.4} />
            <Text style={styles.backLabel}>Log in</Text>
          </Pressable>

          <DisplayText size={30}>Create your account</DisplayText>
          <Text style={styles.subtitle}>Two minutes, then you can start shooting.</Text>

          <PillInput
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Nicole"
            autoCapitalize="words"
            containerStyle={styles.field}
          />

          <PillInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            textContentType="emailAddress"
            containerStyle={styles.field}
          />

          <PillInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            containerStyle={styles.field}
          />

          {password.length > 0 ? (
            <View style={styles.strength}>
              <View style={styles.strengthBar}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.strengthSeg, i < strength.tiers ? styles.strengthOn : styles.strengthOff]}
                  />
                ))}
              </View>
              <Text style={styles.strengthHint}>{strength.hint}</Text>
            </View>
          ) : null}

          {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

          <PillButton
            title={loading ? 'Creating account…' : 'Create account'}
            height={54}
            onPress={() => void onSignUp()}
            disabled={loading || !canSubmit}
          />

          <Text style={styles.terms}>
            By creating an account you agree to our Terms and Privacy Policy.
          </Text>
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -4,
    marginBottom: 16,
  },
  backLabel: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 24,
    fontFamily: theme.typography.body[400],
    fontSize: 15,
    color: theme.colors.muted,
  },
  field: {
    marginBottom: 16,
  },
  strength: {
    marginTop: -4,
    marginBottom: 12,
    gap: 7,
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 5,
  },
  strengthSeg: {
    flex: 1,
    height: 5,
    borderRadius: theme.radius.pill,
  },
  strengthOn: {
    backgroundColor: theme.colors.ok,
  },
  strengthOff: {
    backgroundColor: theme.colors.card2,
  },
  strengthHint: {
    fontFamily: theme.typography.body[400],
    fontSize: 12,
    color: theme.colors.muted,
  },
  errorText: {
    marginBottom: 12,
    fontFamily: theme.typography.body[500],
    fontSize: 12.5,
    color: theme.colors.danger,
  },
  terms: {
    marginTop: 16,
    fontFamily: theme.typography.body[400],
    fontSize: 11.5,
    color: theme.colors.faint,
    textAlign: 'center',
  },
}));

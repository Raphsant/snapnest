import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillInput } from '../../components/auth/PillInput';
import { DisplayText } from '../../components/ui/DisplayText';
import { PillButton } from '../../components/ui/PillButton';
import type { AuthScreenProps } from '../../navigation/authTypes';
import * as authService from '../../services/authService';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

type Props = AuthScreenProps<'ConfirmSignUp'>;

export function ConfirmSignUpScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = useStyles();
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

          <DisplayText size={30}>Check your email</DisplayText>
          <Text style={styles.subtitle}>
            {firstName ? `Hi ${firstName}, we sent a 6-digit code to` : 'We sent a 6-digit code to'}
          </Text>
          <Text style={styles.emailText}>{email}</Text>

          <PillInput
            label="6-digit code"
            value={sanitizedCode}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            inputStyle={styles.codeInput}
            containerStyle={styles.field}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PillButton
            title={loading ? 'Confirming…' : 'Confirm'}
            height={54}
            onPress={() => void onVerify()}
            disabled={loading || sanitizedCode.length !== 6}
          />

          <PillButton
            title="Resend code"
            variant="ghost"
            onPress={() => void onResend()}
            disabled={loading}
          />
          {resentHint ? <Text style={styles.sentHint}>{resentHint}</Text> : null}
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
    fontFamily: theme.typography.body[400],
    fontSize: 15,
    color: theme.colors.muted,
  },
  emailText: {
    marginTop: 2,
    marginBottom: 24,
    fontFamily: theme.typography.body[600],
    fontSize: 15,
    color: theme.colors.text,
  },
  field: {
    marginBottom: 16,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontFamily: theme.typography.body[600],
  },
  errorText: {
    marginBottom: 12,
    fontFamily: theme.typography.body[500],
    fontSize: 12.5,
    color: theme.colors.danger,
  },
  sentHint: {
    marginTop: 10,
    fontFamily: theme.typography.body[600],
    fontSize: 13,
    color: theme.colors.okDeep,
    textAlign: 'center',
  },
}));

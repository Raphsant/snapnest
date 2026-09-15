import React, { useMemo, useState } from 'react';

import { ScreenTransition } from '../components/ScreenTransition';
import { ConfirmSignUpScreen } from '../screens/auth/ConfirmSignUpScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import type { AuthNavigationProp, AuthStackParamList } from './authTypes';

type AuthRouteState =
  | { screen: 'Login'; params?: AuthStackParamList['Login'] }
  | { screen: 'SignUp' }
  | { screen: 'ConfirmSignUp'; params: AuthStackParamList['ConfirmSignUp'] };

/**
 * Auth screens without a stack navigator — avoids iOS Fabric crashes from
 * native-stack / JS-stack interop (`setColor:`, sheet props, etc.).
 */
export function AuthFlow() {
  const [route, setRoute] = useState<AuthRouteState>({ screen: 'Login' });

  const navigation = useMemo<AuthNavigationProp>(
    () => ({
      navigate(name, params?) {
        if (name === 'ConfirmSignUp') {
          setRoute({
            screen: 'ConfirmSignUp',
            params: params as AuthStackParamList['ConfirmSignUp'],
          });
          return;
        }
        if (name === 'Login') {
          setRoute({
            screen: 'Login',
            params: params as AuthStackParamList['Login'],
          });
          return;
        }
        setRoute({ screen: 'SignUp' });
      },
    }),
    [],
  );

  const screen =
    route.screen === 'SignUp' ? (
      <SignUpScreen navigation={navigation} route={{ params: undefined }} />
    ) : route.screen === 'ConfirmSignUp' ? (
      <ConfirmSignUpScreen navigation={navigation} route={{ params: route.params }} />
    ) : (
      <LoginScreen navigation={navigation} route={{ params: route.params }} />
    );

  // Lateral peers — fade, not a hierarchical push.
  return (
    <ScreenTransition transitionKey={route.screen} kind="fade">
      {screen}
    </ScreenTransition>
  );
}

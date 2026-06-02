import 'react-native-get-random-values';
import '@aws-amplify/react-native';
import { Amplify } from 'aws-amplify';

/**
 * Replace these two values with your Cognito User Pool ID and App Client ID.
 * Region: us-east-2 (encoded in userPoolId prefix, e.g. us-east-2_xxxx).
 */
export const COGNITO_CONFIG = {
  region: 'us-east-2' as const,
  userPoolId: 'us-east-2_Ur8Fz5rJO',
  userPoolClientId: '3j13rj8baaqso9vpbvh9211mq8',
} as const;

let configured = false;

export function configureAmplify(): void {
  if (configured) {
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: COGNITO_CONFIG.userPoolId,
        userPoolClientId: COGNITO_CONFIG.userPoolClientId,
        loginWith: {
          email: true,
        },
      },
    },
  });

  configured = true;
}

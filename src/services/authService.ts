import {
  confirmSignUp as amplifyConfirmSignUp,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser as amplifyGetCurrentUser,
  resendSignUpCode as amplifyResendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from 'aws-amplify/auth';

export type AuthSessionUser = {
  userId: string;
  username: string;
};

export type SignUpParams = {
  email: string;
  password: string;
  firstName: string;
};

export type ConfirmSignUpParams = {
  email: string;
  code: string;
};

export type SignInParams = {
  email: string;
  password: string;
};

export type CognitoUserAttributes = {
  email: string;
  givenName: string;
};

function getErrorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof (error as { name: unknown }).name === 'string') {
    return (error as { name: string }).name;
  }
  return '';
}

function translateAmplifyError(error: unknown): string {
  const name = getErrorName(error);
  const fallBack = error instanceof Error ? error.message : 'Something went wrong. Please try again.';

  switch (name) {
    case 'UsernameExistsException':
      return 'An account with this email already exists. Try signing in instead.';
    case 'NotAuthorizedException':
      return 'Incorrect email or password.';
    case 'UserNotConfirmedException':
      return 'This account is not verified yet. Complete email verification first.';
    case 'CodeMismatchException':
      return 'That code does not match. Check the message we sent you and try again.';
    case 'ExpiredCodeException':
      return 'This code has expired. Request a new one.';
    case 'InvalidPasswordException':
      return 'Password does not meet your account requirements.';
    case 'InvalidParameterException':
      return 'Invalid sign-in information. Check your inputs and try again.';
    case 'LimitExceededException':
      return 'Too many attempts. Wait a moment and try again.';
    case 'TooManyRequestsException':
      return 'Too many requests. Please wait and try again.';
    case 'UserNotFoundException':
      return 'No account found with this email.';
    default:
      return fallBack;
  }
}

function rethrowFriendly(error: unknown): never {
  console.error('[authService]', error);
  throw new Error(translateAmplifyError(error));
}

export async function signUp({ email, password, firstName }: SignUpParams): Promise<void> {
  const trimmedEmail = email.trim();
  try {
    await amplifySignUp({
      username: trimmedEmail,
      password,
      options: {
        userAttributes: {
          email: trimmedEmail,
          given_name: firstName.trim(),
        },
      },
    });
  } catch (error: unknown) {
    rethrowFriendly(error);
  }
}

export async function confirmSignUp({ email, code }: ConfirmSignUpParams): Promise<void> {
  try {
    await amplifyConfirmSignUp({
      username: email.trim(),
      confirmationCode: code.trim(),
    });
  } catch (error: unknown) {
    rethrowFriendly(error);
  }
}

export async function resendConfirmationCode(email: string): Promise<void> {
  try {
    await amplifyResendSignUpCode({ username: email.trim() });
  } catch (error: unknown) {
    rethrowFriendly(error);
  }
}

export async function signIn({ email, password }: SignInParams): Promise<void> {
  try {
    await amplifySignIn({
      username: email.trim(),
      password,
    });
  } catch (error: unknown) {
    rethrowFriendly(error);
  }
}

export async function signOut(): Promise<void> {
  try {
    await amplifySignOut({ global: false });
  } catch (error: unknown) {
    rethrowFriendly(error);
  }
}

export async function getCurrentUser(): Promise<AuthSessionUser | null> {
  try {
    const user = await amplifyGetCurrentUser();
    return {
      userId: user.userId,
      username: user.username,
    };
  } catch (error: unknown) {
    console.warn('[authService] getCurrentUser: no session', error);
    return null;
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString() ?? null;
  
    return token;
  } catch {
    return null;
  }
}

export async function getUserAttributes(): Promise<CognitoUserAttributes> {
  try {
    const attrs = await fetchUserAttributes();
    const email = attrs.email ?? '';
    const givenName = attrs.given_name ?? '';
    return {
      email,
      givenName,
    };
  } catch (error: unknown) {
    rethrowFriendly(error);
  }
}

export type AuthStackParamList = {
  SignUp: undefined;
  ConfirmSignUp: { email: string; firstName: string };
  Login: { email?: string } | undefined;
};

/** Minimal navigation surface used by auth screens (no native stack). */
export type AuthNavigationProp = {
  navigate(name: 'Login', params?: AuthStackParamList['Login']): void;
  navigate(name: 'SignUp'): void;
  navigate(name: 'ConfirmSignUp', params: AuthStackParamList['ConfirmSignUp']): void;
};

export type AuthRouteProp<T extends keyof AuthStackParamList> = T extends 'ConfirmSignUp'
  ? { params: AuthStackParamList['ConfirmSignUp'] }
  : T extends 'Login'
    ? { params?: AuthStackParamList['Login'] }
    : { params?: undefined };

export type AuthScreenProps<T extends keyof AuthStackParamList> = {
  navigation: AuthNavigationProp;
  route: AuthRouteProp<T>;
};

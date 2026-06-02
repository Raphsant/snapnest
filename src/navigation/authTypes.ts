export type AuthStackParamList = {
  SignUp: undefined;
  ConfirmSignUp: { email: string; firstName: string };
  Login: { email?: string } | undefined;
};

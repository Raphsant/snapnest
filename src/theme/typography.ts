import { TextStyle } from 'react-native';

type TypographyScale = {
  h1: TextStyle;
  h2: TextStyle;
  body: TextStyle;
  bodySmall: TextStyle;
  button: TextStyle;
};

export const typography: TypographyScale = {
  h1: {
    fontSize: 28,
    fontWeight: '700',
  },
  h2: {
    fontSize: 22,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
  },
};

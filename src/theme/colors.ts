export const colors = {
  background: '#F7F8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3EE',
  oliveTint: '#EBF1E7',
  textPrimary: '#172019',
  textSecondary: '#536057',
  textMuted: '#7A857D',
  border: '#DDE2DA',
  cardBorder: '#D9DED6',
  divider: '#E7EAE4',
  inputPlaceholder: '#94A3B8',
  inputFocusBorder: '#56734A',
  inputFocusBackground: '#F3F7F0',
  primary: '#56734A',
  primaryPressed: '#455F3C',
  primaryText: '#FFFFFF',
  error: '#B42318',
  errorBackground: '#FEE4E2',
  errorBorder: '#F9B7AF',
  success: '#027A48',
  successBackground: '#E6F6EE',
  successBorder: '#B7E8CD',
  info: '#0C4A6E',
  infoBackground: '#E0F2FE',
  infoBorder: '#BAE6FD',
  offline: '#92400E',
  offlineBackground: '#FFEDD5',
  offlineBorder: '#FED7AA',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
} as const;

export const typography = {
  caption: 12,
  bodySmall: 14,
  body: 16,
  title: 20,
  screenTitle: 28,
  display: 36,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

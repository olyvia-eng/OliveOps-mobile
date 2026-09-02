export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  oliveTint: '#EEF4E3',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  border: '#CBD5E1',
  cardBorder: '#E2E8F0',
  divider: '#E4EBE6',
  inputPlaceholder: '#94A3B8',
  inputFocusBorder: '#6B8E23',
  inputFocusBackground: '#F8FAF3',
  primary: '#6B8E23',
  primaryPressed: '#59791D',
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
  screenTitle: 26,
  display: 36,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

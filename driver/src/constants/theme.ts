import '@/global.css';

import { Platform } from 'react-native';

export const Brand = {
  canvas: '#F7F8EF',
  surface: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  accent: '#2E4ED5',
  splash: '#208AEF',
  danger: '#B91C1C',
  muted: '#9CA3AF',
  border: '#F3F4F6',
} as const;

export const Colors = {
  light: {
    text: Brand.text,
    background: Brand.canvas,
    backgroundElement: Brand.surface,
    backgroundSelected: '#E0E1E6',
    textSecondary: Brand.textSecondary,
    accent: Brand.accent,
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    accent: Brand.accent,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

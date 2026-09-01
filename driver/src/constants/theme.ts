import '@/global.css';

import { Platform } from 'react-native';

export const BrandLight = {
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

export const BrandDark = {
  canvas: '#111827',
  surface: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accent: '#60A5FA',
  splash: '#3B82F6',
  danger: '#EF4444',
  muted: '#6B7280',
  border: '#374151',
} as const;

export const Brand = BrandLight;

export type BrandTokens = {
  canvas: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  splash: string;
  danger: string;
  muted: string;
  border: string;
};

const lightPalette = {
  text: BrandLight.text,
  background: BrandLight.canvas,
  backgroundElement: BrandLight.surface,
  backgroundSelected: '#E0E1E6',
  textSecondary: BrandLight.textSecondary,
  accent: BrandLight.accent,
} as const;

const darkPalette = {
  text: BrandDark.text,
  background: BrandDark.canvas,
  backgroundElement: BrandDark.surface,
  backgroundSelected: '#374151',
  textSecondary: BrandDark.textSecondary,
  accent: BrandDark.accent,
} as const;

export const Colors = {
  light: lightPalette,
  dark: darkPalette,
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

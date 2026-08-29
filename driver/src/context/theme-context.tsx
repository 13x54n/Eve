import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Brand, Colors, type BrandTokens } from '@/constants/theme';

type ThemeContextValue = {
  scheme: 'light';
  brand: BrandTokens;
  colors: typeof Colors.light;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ThemeContextValue>(
    () => ({ scheme: 'light', brand: Brand, colors: Colors.light }),
    [],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style="dark" />
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used within ThemeProvider');
  return value;
}

export function useBrand() {
  return useAppTheme().brand;
}

import { useAppTheme } from '@/context/theme-context';

export function useTheme() {
  return useAppTheme().colors;
}

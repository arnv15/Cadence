import { Colors, type Palette, type Scheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface Theme {
  scheme: Scheme;
  colors: Palette;
}

/** Light/dark palette for the current system appearance. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const resolved: Scheme = scheme === 'dark' ? 'dark' : 'light';
  return { scheme: resolved, colors: Colors[resolved] };
}

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';

import { ConsentProvider, useConsent } from '@/hooks/use-consent';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

// Held up until we know whether this person has seen the disclosures, so the app never flashes
// the Today screen at someone who has not consented yet.
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { colors, scheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const { loading, consented } = useConsent();

  useEffect(() => {
    if (!loading) {
      void SplashScreen.hideAsync().catch(() => {
        // The splash may already be gone; nothing to recover from.
      });
    }
  }, [loading]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  // Keep the splash screen up rather than rendering a placeholder: a worried person should not
  // see the app change its mind about where they are.
  if (loading) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          // Every screen draws its own heading in app type sizes, which respect font scaling
          // better than a native header does. A screen can still opt back in for itself.
          headerShown: false,
          animation: reducedMotion ? 'none' : 'default',
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Protected guard={consented}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="record" options={{ gestureEnabled: false }} />
          <Stack.Screen name="fluency" options={{ gestureEnabled: false }} />
          <Stack.Screen name="processing" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!consented}>
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ConsentProvider>
      <RootNavigator />
    </ConsentProvider>
  );
}

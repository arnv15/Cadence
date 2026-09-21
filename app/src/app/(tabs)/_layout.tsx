import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

/**
 * Three places, named in plain language: what to do now, how it has been going, and what this
 * app is. Native tabs keep the platform's own sizing and accessibility behaviour.
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      tintColor={colors.primary}
      backgroundColor={colors.surface}
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.primary },
      }}
      indicatorColor={colors.primarySoft}
      rippleColor={colors.primarySoft}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trends">
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="insights" />
        <NativeTabs.Trigger.Label>Trends</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="about">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'info.circle', selected: 'info.circle.fill' }}
          md="info"
        />
        <NativeTabs.Trigger.Label>About</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { AppText, Caption, Title } from '@/components/text';
import { CONSENT_STEPS } from '@/content/consent';
import { useConsent } from '@/hooks/use-consent';
import { errorMessage } from '@/constants/format';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** One segment per disclosure. Decorative: the caption beside it already says "2 of 4". */
function StepSegments({ step, total }: { step: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.segments} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: total }, (_unused, index) => (
        <View key={index} style={[styles.segment, { backgroundColor: index <= step ? colors.primary : colors.border }]} />
      ))}
    </View>
  );
}

/** Guided reading in the established Cadence theme: one disclosure, then one clear next action. */
export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { accept } = useConsent();
  const current = CONSENT_STEPS[step];
  const last = step === CONSENT_STEPS.length - 1;
  const next = async () => {
    if (!last) { setStep(step + 1); return; }
    setBusy(true);
    setError(null);
    try { await accept(); } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return (
    <Screen key={step} testID="onboarding" footer={
      <>
        <Button label={last ? 'I understand — begin' : 'Continue'} onPress={() => void next()} busy={busy} />
        {step > 0 && <Button label="Back" variant="quiet" disabled={busy} onPress={() => setStep(step - 1)} />}
      </>
    }>
      <StepSegments step={step} total={CONSENT_STEPS.length} />
      <Caption>{`Welcome to Cadence · ${step + 1} of ${CONSENT_STEPS.length}`}</Caption>
      <Title>{current.title}</Title>
      {current.body.map(paragraph => <AppText key={paragraph}>{paragraph}</AppText>)}
      {last && <Banner title="This version uses a demo model" body="Its scores come from synthetic data. They do not measure your chance of having a medical condition." />}
      {error && <Banner tone="caution" title="Could not save your choice" body={`${error} Please try again.`} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: Spacing.sm },
  segment: { borderRadius: Radius.pill, flex: 1, height: 6 },
});

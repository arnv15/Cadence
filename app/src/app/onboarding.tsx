import { useState } from 'react';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { AppText, Caption, Title } from '@/components/text';
import { CONSENT_STEPS } from '@/content/consent';
import { useConsent } from '@/hooks/use-consent';
import { errorMessage } from '@/constants/format';

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
      <Caption>{`Welcome to Cadence · ${step + 1} of ${CONSENT_STEPS.length}`}</Caption>
      <Title>{current.title}</Title>
      {current.body.map(paragraph => <AppText key={paragraph}>{paragraph}</AppText>)}
      {last && <Banner title="This version uses a demo model" body="Its scores come from synthetic data. They do not measure your chance of having a medical condition." />}
      {error && <Banner tone="caution" title="Could not save your choice" body={`${error} Please try again.`} />}
    </Screen>
  );
}

import { Banner } from '@/components/banner';

/**
 * Shown wherever demonstration sessions can appear. Sample history is loaded from Debug so the
 * trends, baseline and PDF screens can be exercised before anyone has recorded on five separate
 * days, and it must never be mistaken for someone's own speech.
 */
export function SampleDataBanner({ scope }: { scope: 'screen' | 'session' | 'manage' }) {
  return (
    <Banner
      tone="caution"
      icon="info"
      testID="sample-data-banner"
      title="Sample data"
      body={
        scope === 'session'
          ? 'This check was loaded as sample data for testing. It is not a recording of anyone speaking.'
          : scope === 'manage'
            ? 'Some of the checks counted here were loaded as sample data for testing, not recorded by you. You can remove them below.'
            : 'Some checks shown here were loaded as sample data for testing, not recorded by you. You can remove them on the You tab.'
      }
    />
  );
}

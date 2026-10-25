import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Banner } from '@/components/banner';
import { BulletList } from '@/components/bullet-list';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Collapsible } from '@/components/collapsible';
import { Glyph } from '@/components/glyph';
import { ListGroup, ListRow } from '@/components/list';
import { FadeUp } from '@/components/motion';
import { ResultDisclaimer } from '@/components/result-disclaimer';
import { ResultShareButton } from '@/components/result-share-button';
import { SampleDataBanner } from '@/components/sample-data-banner';
import { Screen } from '@/components/screen';
import { StatRow } from '@/components/stat-row';
import { AppText, Caption, Heading, Title } from '@/components/text';
import { TierBadge } from '@/components/tier-badge';
import { firstParam, formatDuration, formatTimestamp, joinWords } from '@/constants/format';
import { Spacing } from '@/constants/theme';
import { TALK_TO_A_DOCTOR } from '@/content/about';
import { getSession } from '@/db';
import {
  explainDrift,
  featureLabel,
  formatFeatureValue,
  reasonCopy,
  tierCopy,
  topReasons,
} from '@/explain';
import { FEATURE_NAMES } from '@/features';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { getModel } from '@/model';
import spec from '@/shared/feature_spec.json';
import type { CadenceModel, FeatureName, SessionRecord } from '@/types';

const QUALITY_GATE = spec.quality_gate;

interface ResultData {
  session: SessionRecord | null;
  /** Null when the bundled model could not be read; the rest of the screen still works. */
  model: CadenceModel | null;
}

function goBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.push('/');
  }
}

/** How a single oriented drift z reads in a table row. Positive z = the direction Cadence watches. */
function driftNote(z: number | undefined): string | undefined {
  if (z === undefined || !Number.isFinite(z)) return undefined;
  if (z >= 1) return 'Differs from your usual';
  if (z <= -1) return 'Differs from your usual, in the steadier direction';
  return 'In your usual range';
}

export default function ResultScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);

  const { data, error, loading, reload } = useAsync<ResultData>(async () => {
    const session = id === null ? null : await getSession(id);
    let model: CadenceModel | null = null;
    try {
      model = getModel();
    } catch {
      // A broken model file must not hide a person's result. The demo-model notice below simply
      // falls back to what the session itself recorded.
      model = null;
    }
    return { session, model };
  }, [id]);

  if (loading) {
    return (
      <Screen testID="result-loading">
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText tone="secondary" center>
            Opening your check&hellip;
          </AppText>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen testID="result-error">
        <Title>We could not open this check</Title>
        <Banner
          tone="caution"
          title="Something went wrong reading it from this phone"
          body={error}
        />
        <Button label="Try again" onPress={reload} icon="refresh" />
        <Button label="Go back" onPress={goBack} variant="quiet" />
      </Screen>
    );
  }

  const session = data?.session ?? null;

  if (session === null) {
    return (
      <Screen testID="result-missing">
        <Title>That check is no longer here</Title>
        <AppText>
          It may have been deleted. Your other checks are still on the Trends tab.
        </AppText>
        <Button label="See your trends" onPress={() => router.push('/trends')} icon="chart" />
        <Button label="Go back" onPress={goBack} variant="quiet" />
      </Screen>
    );
  }

  const model = data?.model ?? null;
  const demoModel = model !== null ? !model.trained : session.reasons.includes('demo_model');
  const spoken = session.transcript.trim();

  const header = (
    <>
      <BackButton onPress={goBack} />
      <View style={styles.header}>
        <Title>{session.task === 'fluency' ? 'Your naming check' : 'Your voice check'}</Title>
        <Caption>
          {`${formatTimestamp(session.createdAt)} · ${formatDuration(session.durationS)}`}
        </Caption>
      </View>
      {session.isSample && <SampleDataBanner scope="session" />}
    </>
  );

  const transcriptSection = (
    <Collapsible
      title="What Cadence heard"
      subtitle="The transcript this result was calculated from"
      testID="result-transcript">
      <AppText>
        {spoken.length > 0 ? spoken : 'Cadence did not pick up any words in this recording.'}
      </AppText>
      <Caption>
        This is the small on-device speech model&rsquo;s best guess. It can mishear words, which
        affects the word-based measurements. Pause timing is measured directly from the audio.
      </Caption>
    </Collapsible>
  );

  const footerLinks = (
    <View style={styles.links}>
      <ListGroup>
        <ListRow
          icon="chart"
          title="See your trends"
          onPress={() => router.push('/trends')}
          accessibilityHint="Opens the charts of your checks over time"
        />
        <ListRow
          icon="info"
          tone="neutral"
          title="What Cadence cannot tell you"
          onPress={() => router.push('/about')}
          accessibilityHint="Opens the limitations section in About"
        />
      </ListGroup>
      <Button label="Done" onPress={goBack} variant="quiet" />
    </View>
  );

  // ---------------------------------------------------------------- too noisy to measure
  if (session.quality === 'too_noisy') {
    return (
      <Screen testID="result-too-noisy">
        {header}
        <ResultDisclaimer />
        <FadeUp>
          <Card>
            <View style={styles.friendly}>
              <Glyph name="mic" color={colors.primary} size={40} />
              <Heading>It was too noisy to measure</Heading>
            </View>
            <AppText>
              Your words came through, but there was too much background sound to tell your pauses
              apart from the room. A fan, a television, traffic or several people talking is usually
              enough to hide them.
            </AppText>
            <AppText tone="secondary">
              Cadence does not score a check it cannot measure, because background noise fills the
              quiet moments and would make any voice look steady. Try again in a quieter room.
            </AppText>
          </Card>
        </FadeUp>
        <Button
          label="Try another check"
          onPress={() => router.push('/record')}
          icon="mic"
          size="large"
        />
        {transcriptSection}
        {footerLinks}
      </Screen>
    );
  }

  // ---------------------------------------------------------------- not enough speech
  if (session.quality === 'insufficient_speech') {
    return (
      <Screen testID="result-insufficient">
        {header}
        <ResultDisclaimer />
        <FadeUp>
          <Card>
            <View style={styles.friendly}>
              <Glyph name="mic" color={colors.primary} size={40} />
              <Heading>We couldn&rsquo;t hear enough speech</Heading>
            </View>
            <AppText>
              Try again somewhere quiet. It helps to hold the phone about a hand&rsquo;s width from
              your mouth and to keep talking about the picture even when you are not sure what to
              say next.
            </AppText>
            <AppText tone="secondary">
              {`Cadence needs roughly ${QUALITY_GATE.min_words} words and ` +
                `${QUALITY_GATE.min_speaking_time_s} seconds of speech before it will score a check. ` +
                'Nothing is wrong — this one just came up short.'}
            </AppText>
          </Card>
        </FadeUp>
        <Button
          label="Try another check"
          onPress={() => router.push('/record')}
          icon="mic"
          size="large"
        />
        {transcriptSection}
        {footerLinks}
      </Screen>
    );
  }

  // ---------------------------------------------------------------- fluency
  if (session.task === 'fluency') {
    const fluency = session.fluency;
    return (
      <Screen testID="result-fluency">
        {header}
        <FadeUp>
          <Card title="Animals you named">
            <AppText variant="display">{`${fluency?.validCount ?? 0}`}</AppText>
            <AppText tone="secondary">
              different animals, counting each one once
            </AppText>
            <AppText>
              {fluency && fluency.uniqueAnimals.length > 0
                ? joinWords(fluency.uniqueAnimals)
                : 'Cadence did not recognise any animal names in this recording.'}
            </AppText>
            {fluency && (fluency.repetitions > 0 || fluency.intrusions > 0) ? (
              <View style={styles.stats}>
                <StatRow
                  label="Said more than once"
                  value={`${fluency.repetitions}`}
                  hint="Repeating yourself in a timed naming task is very common"
                />
                <StatRow
                  label="Other words"
                  value={`${fluency.intrusions}`}
                  hint="Words that were not animal names"
                />
              </View>
            ) : null}
          </Card>
        </FadeUp>
        <ResultDisclaimer detail="Naming checks are not scored into a tier. They are here as a second, different kind of check alongside your picture checks." />
        <AppText tone="secondary">
          Counts bounce around by several animals from one try to the next, for everyone. One low
          score is not a finding.
        </AppText>
        {transcriptSection}
        <ResultShareButton />
        {footerLinks}
      </Screen>
    );
  }

  // ---------------------------------------------------------------- picture check
  const tier = session.tier;
  const copy = tier === null ? null : tierCopy(tier);
  const perFeature = session.drift?.perFeature ?? {};
  const driftReady = session.drift?.status === 'ready';
  const standouts = session.prediction === null ? [] : topReasons(session.prediction, 3);

  return (
    <Screen testID="result-picture">
      {header}

      {tier !== null && copy !== null ? (
        <FadeUp testID="result-tier">
          <TierBadge tier={tier} title={copy.title} summary={copy.summary} />
        </FadeUp>
      ) : (
        <Card title="This check was not scored">
          <AppText>
            Cadence saved your recording but could not turn it into a result this time.
          </AppText>
        </Card>
      )}

      {/* The demo-model disclosure is explained in full on About. Here it is one clause on the
          line that is already present, because a tier is on screen and AGENTS.md requires the
          label wherever a result appears — but a second caution block was clutter. */}
      <ResultDisclaimer
        detail={
          demoModel
            ? `This tier came from the demonstration model, not a trained one. ${TALK_TO_A_DOCTOR}`
            : TALK_TO_A_DOCTOR
        }
        testID={demoModel ? 'demo-model-notice' : undefined}
      />

      {copy !== null ? (
        <Card title="What to do with this">
          <AppText>{copy.action}</AppText>
        </Card>
      ) : null}

      <Card title="Why Cadence said that">
        {session.reasons.length > 0 ? (
          <BulletList items={session.reasons.map(reasonCopy)} />
        ) : (
          <AppText tone="secondary">No reasons were recorded for this check.</AppText>
        )}
      </Card>

      {standouts.length > 0 ? (
        <Card title="What stood out in this check">
          <BulletList items={standouts} />
          <Caption>
            {demoModel
              ? 'These compare you with the demonstration model’s invented data, not with yourself ' +
                'and not with any real group of people. Your own baseline, below, is the only ' +
                'comparison here that means anything.'
              : 'These compare you with the reference data, not with yourself. Your own baseline, ' +
                'below, is the more meaningful comparison.'}
          </Caption>
        </Card>
      ) : null}

      <Card title="Compared with your own baseline">
        <AppText>
          {session.drift === null
            ? 'This check was not compared with your personal baseline.'
            : explainDrift(session.drift)}
        </AppText>
      </Card>

      {session.features !== null ? (
        <Collapsible
          title="All the measurements"
          subtitle="Every number this result was built from"
          testID="result-measurements">
          {FEATURE_NAMES.map((name: FeatureName) => (
            <StatRow
              key={name}
              label={featureLabel(name)}
              value={formatFeatureValue(name, session.features?.[name] ?? 0)}
              hint={driftReady ? driftNote(perFeature[name]) : undefined}
            />
          ))}
          {session.stats !== null ? (
            <>
              <StatRow label="Words counted" value={`${session.stats.n_words}`} />
              <StatRow
                label="Time spent speaking"
                value={formatDuration(session.stats.speaking_time_s)}
              />
              <StatRow
                label="Pauses of half a second or more"
                value={`${session.stats.n_long_pauses}`}
              />
            </>
          ) : null}
        </Collapsible>
      ) : null}

      {transcriptSection}

      <ResultShareButton />

      {footerLinks}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xxxl,
  },
  header: { gap: Spacing.xs },
  friendly: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stats: { marginTop: Spacing.sm },
  links: { gap: Spacing.md, marginTop: Spacing.md },
});

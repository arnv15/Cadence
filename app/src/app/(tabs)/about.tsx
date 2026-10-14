import Constants from 'expo-constants';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Collapsible } from '@/components/collapsible';
import { Glyph } from '@/components/glyph';
import { ResultDisclaimer } from '@/components/result-disclaimer';
import { Screen } from '@/components/screen';
import { StatRow } from '@/components/stat-row';
import { AppText, Caption, Heading, Title } from '@/components/text';
import { TierBadge } from '@/components/tier-badge';
import { errorMessage, formatPercent } from '@/constants/format';
import { Brand, MinTouch, Radius, Spacing } from '@/constants/theme';
import {
  HOW_IT_WORKS,
  LIMITATIONS,
  PRIVACY_POINTS,
  TALK_TO_A_DOCTOR,
  TIER_GUIDE,
} from '@/content/about';
import { CITATIONS, CITATIONS_VERIFIED_ON, unverifiedCitations } from '@/content/citations';
import { deleteAllData, getSetting, setSetting } from '@/db';
import { tierCopy } from '@/explain';
import { useAsync } from '@/hooks/use-async';
import { useConsent } from '@/hooks/use-consent';
import { useTheme } from '@/hooks/use-theme';
import { getModel } from '@/model';
import type { CadenceModel, Tier } from '@/types';

const TIER_ORDER: Tier[] = ['typical', 'watch', 'doctor'];

interface AboutData {
  keepAudio: boolean;
  /** Null when the bundled model file could not be read. */
  model: CadenceModel | null;
  modelError: string | null;
}

async function loadAbout(): Promise<AboutData> {
  const keepAudioSetting = await getSetting('keep_audio');
  let model: CadenceModel | null = null;
  let modelError: string | null = null;
  try {
    model = getModel();
  } catch (cause: unknown) {
    modelError = errorMessage(cause);
  }
  return { keepAudio: keepAudioSetting === '1', model, modelError };
}

export default function AboutScreen() {
  const { refresh } = useConsent();
  const { colors } = useTheme();
  const { data, error, loading, reload } = useAsync<AboutData>(loadAbout, []);

  const [keepAudio, setKeepAudio] = useState<boolean | null>(null);
  const [settingError, setSettingError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const effectiveKeepAudio = keepAudio ?? data?.keepAudio ?? false;

  const toggleKeepAudio = useCallback((next: boolean) => {
    setKeepAudio(next);
    setSettingError(null);
    Promise.resolve()
      .then(() => setSetting('keep_audio', next ? '1' : '0'))
      .catch((cause: unknown) => {
        // Put the switch back where it was: it must never claim a setting that did not save.
        setKeepAudio(!next);
        setSettingError(errorMessage(cause));
      });
  }, []);

  const runDelete = useCallback(() => {
    setDeleting(true);
    setSettingError(null);
    Promise.resolve()
      .then(() => deleteAllData())
      .then(() => {
        setDeleted(true);
        setKeepAudio(false);
        reload();
        return refresh();
      })
      .catch((cause: unknown) => setSettingError(errorMessage(cause)))
      .then(() => setDeleting(false));
  }, [reload, refresh]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Delete everything Cadence has saved?',
      'This removes every check, every setting and every saved recording from this phone. ' +
        'There is no copy anywhere else, so this cannot be undone.',
      [
        { text: 'Keep my data', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: runDelete },
      ],
      { cancelable: true },
    );
  }, [runDelete]);

  const openCitation = useCallback((url: string) => {
    Promise.resolve()
      .then(() => openBrowserAsync(url))
      .catch(() => {
        // Opening a browser is a convenience; the full reference is on screen either way.
      });
  }, []);

  const unverified = unverifiedCitations();
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const model = data?.model ?? null;

  return (
    <Screen tabBarInset testID="about">
      <View style={styles.header}>
        <Title>{`About ${Brand.name}`}</Title>
        <Caption>{Brand.tagline}</Caption>
      </View>

      <ResultDisclaimer detail={TALK_TO_A_DOCTOR} />

      <Banner
        tone="caution"
        title="An educational research prototype"
        body={
          'Cadence is a student project for the Congressional App Challenge. It is not a medical ' +
          'device, it has not been cleared by any regulator, and it has not been validated in a ' +
          'clinical study. Nothing it shows you is a diagnosis.'
        }
        testID="about-prototype-notice"
      />

      {/* ------------------------------------------------------------------ how it works */}
      <Card title="How it works">
        {HOW_IT_WORKS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Heading>{section.title}</Heading>
            {section.body.map((paragraph) => (
              <AppText key={paragraph}>{paragraph}</AppText>
            ))}
          </View>
        ))}
      </Card>

      {/* ------------------------------------------------------------------ tiers */}
      <Card title="What the tiers mean">
        {TIER_ORDER.map((tier) => {
          const copy = tierCopy(tier);
          return (
            <View key={tier} style={styles.section}>
              <TierBadge tier={tier} title={copy.title} size="compact" />
              <AppText>{copy.summary}</AppText>
              <AppText tone="secondary">{TIER_GUIDE[tier]}</AppText>
            </View>
          );
        })}
        <Caption>
          Cadence is deliberately reluctant to escalate. It will not move anyone to &ldquo;Talk to
          a doctor&rdquo; on the strength of a single unusual day, and the demonstration model can
          never do so at all.
        </Caption>
      </Card>

      {/* ------------------------------------------------------------------ limitations */}
      <Card title="Limitations" subtitle="The honest list. Please read this one.">
        {LIMITATIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Heading>{section.title}</Heading>
            {section.body.map((paragraph) => (
              <AppText key={paragraph}>{paragraph}</AppText>
            ))}
          </View>
        ))}
      </Card>

      {/* ------------------------------------------------------------------ research */}
      <Card title="Research and citations" subtitle={`Each source checked on ${CITATIONS_VERIFIED_ON}`}>
        <AppText tone="secondary">
          These are the sources Cadence is built on. Every title, author and number below was
          taken from the source itself.
        </AppText>
        {unverified.length > 0 ? (
          <Banner
            tone="caution"
            title="Some references could not be checked"
            body={`Cadence could not verify: ${unverified
              .map((citation) => citation.title)
              .join('; ')}. Treat those entries with caution.`}
          />
        ) : null}
        {CITATIONS.map((citation) => (
          <Collapsible
            key={citation.id}
            title={citation.title}
            subtitle={`${citation.authors.split(',')[0]} et al. · ${citation.venue} · ${citation.year}`}
            testID={`citation-${citation.id}`}>
            <AppText>{citation.relevance}</AppText>
            <StatRow label="Authors" value={citation.authors} />
            <StatRow label="Published in" value={`${citation.venue}, ${citation.year}`} />
            {citation.identifier ? (
              <StatRow label="Identifier" value={citation.identifier} />
            ) : null}
            <StatRow
              label="Details checked against the source"
              value={citation.verified ? 'Yes' : 'No — unverified'}
            />
            <Button
              label="Open the source"
              onPress={() => openCitation(citation.url)}
              variant="quiet"
              icon="share"
              hint={`Opens ${citation.url} in your browser`}
            />
            <Caption selectable>{citation.url}</Caption>
          </Collapsible>
        ))}
      </Card>

      {/* ------------------------------------------------------------------ privacy */}
      <Card title="Privacy and your data">
        <View style={styles.section}>
          {PRIVACY_POINTS.map((point) => (
            <View key={point} style={styles.bullet}>
              <Glyph name="lock" color={colors.textSecondary} size={20} />
              <AppText style={styles.bulletText}>{point}</AppText>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.primary} />
            <AppText tone="secondary">Reading your settings&hellip;</AppText>
          </View>
        ) : (
          <Pressable
            onPress={() => toggleKeepAudio(!effectiveKeepAudio)}
            accessibilityRole="switch"
            accessibilityState={{ checked: effectiveKeepAudio }}
            accessibilityLabel="Keep my recordings"
            accessibilityHint="When off, each recording is deleted as soon as it has been analyzed"
            testID="keep-audio-toggle"
            style={({ pressed }) => [
              styles.toggleRow,
              { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
              pressed && styles.pressed,
            ]}>
            <View style={styles.toggleText}>
              <AppText variant="label">Keep my recordings</AppText>
              <Caption>
                {effectiveKeepAudio
                  ? 'Audio files are kept on this phone after a check is analyzed.'
                  : 'Audio is deleted as soon as a check has been analyzed. Recommended.'}
              </Caption>
            </View>
            <Switch
              value={effectiveKeepAudio}
              onValueChange={toggleKeepAudio}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.borderStrong}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </Pressable>
        )}

        {settingError ? (
          <AppText variant="caption" style={{ color: colors.destructive }}>
            {settingError}
          </AppText>
        ) : null}

        {deleted ? (
          <Banner
            tone="info"
            title="Everything was deleted"
            body="Your checks, settings and recordings are gone from this phone."
            icon="check-circle"
            testID="delete-confirmation"
          />
        ) : null}

        <Button
          label="Delete all my data"
          onPress={confirmDelete}
          variant="destructive"
          icon="trash"
          busy={deleting}
          hint="Asks you to confirm first. This cannot be undone."
          testID="delete-all-data"
        />
      </Card>

      {/* ------------------------------------------------------------------ model + version */}
      <Card title="The model in this build">
        {error ? (
          <Banner tone="caution" title="Could not read your settings" body={error} />
        ) : null}
        {data?.modelError ? (
          <Banner
            tone="caution"
            title="The bundled model could not be read"
            body={data.modelError}
          />
        ) : null}
        {model !== null ? (
          <>
            {!model.trained ? (
              <Banner
                tone="caution"
                title="Demonstration model — not trained on real recordings"
                body={
                  'Cadence has not been granted access to the DementiaBank research corpus, so ' +
                  'this build ships a synthetic model. It demonstrates the app end to end and ' +
                  'has learned nothing about real speech or real illness.'
                }
                testID="about-demo-model"
              />
            ) : null}
            <StatRow label="Model" value={model.model_id} emphasis />
            <StatRow
              label="Trained on real recordings"
              value={model.trained ? 'Yes' : 'No — synthetic demo data'}
            />
            {model.trained_on ? <StatRow label="Data" value={model.trained_on} /> : null}
            <StatRow label="Created" value={model.created_at} />
            <StatRow label="Feature spec version" value={`${model.spec_version}`} />
            <StatRow
              label="Decision threshold"
              value={model.threshold.toFixed(2)}
              hint="Set low on purpose, to miss fewer people at the cost of more false alarms"
            />
            {model.trained && model.metrics !== null ? (
              <>
                <StatRow
                  label="Cross-validated AUC"
                  value={
                    model.metrics.cv_auc_ci === null
                      ? model.metrics.cv_auc.toFixed(3)
                      : `${model.metrics.cv_auc.toFixed(3)} (95% CI ${model.metrics.cv_auc_ci[0].toFixed(3)}–${model.metrics.cv_auc_ci[1].toFixed(3)})`
                  }
                />
                <StatRow label="Sensitivity" value={formatPercent(model.metrics.sensitivity)} />
                <StatRow label="Specificity" value={formatPercent(model.metrics.specificity)} />
                <StatRow
                  label="Participants"
                  value={`${model.metrics.n_participants} (${model.metrics.n_samples} recordings)`}
                />
                <StatRow label="Cross-validation folds" value={`${model.metrics.cv_folds}`} />
              </>
            ) : (
              <Caption>
                No accuracy figures are shown, because an untrained demonstration model has no
                honest ones to show.
              </Caption>
            )}
            {model.notes ? <Caption>{model.notes}</Caption> : null}
          </>
        ) : null}
        <StatRow label="App version" value={appVersion} />
      </Card>

      <Button
        label="Developer details"
        onPress={() => router.push('/debug')}
        variant="quiet"
        icon="wrench"
        hint="Model internals, speech-model status and the Python parity check"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  section: { gap: Spacing.sm },
  bullet: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bulletText: { flex: 1 },
  toggleRow: {
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.lg,
    minHeight: MinTouch,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  toggleText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.85 },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
});

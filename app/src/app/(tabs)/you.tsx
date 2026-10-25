import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Glyph, type GlyphName } from '@/components/glyph';
import { ListGroup, ListRow } from '@/components/list';
import { ProgressBar } from '@/components/progress-bar';
import { ResultShareButton } from '@/components/result-share-button';
import { SampleDataBanner } from '@/components/sample-data-banner';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatRow } from '@/components/stat-row';
import { AppText, Caption, Title } from '@/components/text';
import { errorMessage, formatShortDay } from '@/constants/format';
import { MinTouch, Radius, Spacing, Type } from '@/constants/theme';
import { CONSENT_VERSION } from '@/content/consent';
import {
  baselineDetail,
  baselineRange,
  baselineStatusLine,
  dataSummary,
  DISPLAY_NAME_MAX,
  normalizeDisplayName,
  PROFILE_PRIVACY_POINTS,
  type BaselineDetail,
  type DataSummary,
} from '@/content/profile';
import { BASELINE_EXPLANATION } from '@/content/trends';
import { deleteAllData, deleteSampleSessions, getSetting, listSessions, setSetting } from '@/db';
import { APPEARANCE_OPTIONS, useAppearance, type AppearancePreference } from '@/hooks/use-appearance';
import { useAsync } from '@/hooks/use-async';
import { useConsent } from '@/hooks/use-consent';
import { useReloadOnReturn } from '@/hooks/use-reload-on-return';
import { useTheme } from '@/hooks/use-theme';
import { getModel } from '@/model';
import type { CadenceModel } from '@/types';

const APPEARANCE_COPY: Record<AppearancePreference, { title: string; subtitle?: string; icon: GlyphName }> = {
  system: { title: 'Match phone', subtitle: 'Light or dark, following your phone’s setting', icon: 'phone' },
  light: { title: 'Light', icon: 'sun' },
  dark: { title: 'Dark', icon: 'moon' },
};

interface YouData {
  baseline: BaselineDetail;
  summary: DataSummary;
  keepAudio: boolean;
  displayName: string | null;
  /** Null when the bundled model file could not be read. */
  model: CadenceModel | null;
}

async function loadYou(): Promise<YouData> {
  const sessions = await listSessions({ order: 'asc' });
  const keepAudioSetting = await getSetting('keep_audio');
  const displayName = await getSetting('display_name');
  let model: CadenceModel | null = null;
  try {
    model = getModel();
  } catch {
    // The model identity is a footnote here; About reports a broken model file in full.
    model = null;
  }
  return {
    baseline: baselineDetail(sessions),
    summary: dataSummary(sessions),
    keepAudio: keepAudioSetting === '1',
    displayName,
    model,
  };
}

/**
 * "You" — the person's own data and state: what Cadence has learned about how they usually speak,
 * what it has saved, and the controls to export or erase it.
 *
 * This screen owns the data controls. About is only "what this app is and what the research says".
 */
export default function YouScreen() {
  const { refresh } = useConsent();
  const { preference: appearancePreference, setPreference: setAppearance, reset: resetAppearance } =
    useAppearance();
  const { colors } = useTheme();
  const { data, error, loading, reload } = useAsync<YouData>(loadYou, []);

  // A check finished on another tab changes the counts and the baseline shown here.
  useReloadOnReturn(reload);

  const [keepAudio, setKeepAudio] = useState<boolean | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [removingSamples, setRemovingSamples] = useState(false);

  const effectiveKeepAudio = keepAudio ?? data?.keepAudio ?? false;
  const storedName = data?.displayName ?? null;
  const draft = nameDraft ?? storedName ?? '';
  /** Pressing Save with an empty field only clears something if a name is actually stored. */
  const clearingName = normalizeDisplayName(draft) === null && storedName !== null;

  const toggleKeepAudio = useCallback((next: boolean) => {
    setKeepAudio(next);
    setActionError(null);
    Promise.resolve()
      .then(() => setSetting('keep_audio', next ? '1' : '0'))
      .catch((cause: unknown) => {
        // Put the switch back where it was: it must never claim a setting that did not save.
        setKeepAudio(!next);
        setActionError(errorMessage(cause));
      });
  }, []);

  const saveName = useCallback(() => {
    const normalized = normalizeDisplayName(draft);
    setActionError(null);
    setNameSaved(false);
    Promise.resolve()
      .then(() => setSetting('display_name', normalized ?? ''))
      .then(() => {
        setNameDraft(normalized ?? '');
        setNameSaved(true);
        reload();
      })
      .catch((cause: unknown) => setActionError(errorMessage(cause)));
  }, [draft, reload]);

  const removeSamples = useCallback(() => {
    setRemovingSamples(true);
    setActionError(null);
    Promise.resolve()
      .then(() => deleteSampleSessions())
      .then(() => reload())
      .catch((cause: unknown) => setActionError(errorMessage(cause)))
      .then(() => setRemovingSamples(false));
  }, [reload]);

  const runDelete = useCallback(() => {
    setDeleting(true);
    setActionError(null);
    Promise.resolve()
      .then(() => deleteAllData())
      .then(() => {
        setDeleted(true);
        // The stored choice went with every other setting; stop showing it.
        resetAppearance();
        setKeepAudio(false);
        setNameDraft('');
        reload();
        return refresh();
      })
      .catch((cause: unknown) => setActionError(errorMessage(cause)))
      .then(() => setDeleting(false));
  }, [reload, refresh, resetAppearance]);

  const chooseAppearance = useCallback(
    (next: AppearancePreference) => {
      setActionError(null);
      setAppearance(next).catch((cause: unknown) => setActionError(errorMessage(cause)));
    },
    [setAppearance],
  );

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

  if (loading) {
    return (
      <Screen tabBarInset testID="you-loading">
        <Title>You</Title>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText tone="secondary" center>
            Reading what is saved on this phone&hellip;
          </AppText>
        </View>
      </Screen>
    );
  }

  const baseline = data?.baseline ?? null;
  const summary = data?.summary ?? null;
  const model = data?.model ?? null;
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const statusLine = baseline === null ? null : baselineStatusLine(baseline);

  return (
    <Screen tabBarInset testID="you">
      <View style={styles.header}>
        <Title>You</Title>
        <Caption>
          {storedName === null
            ? 'Your baseline, your checks, and everything saved on this phone.'
            : `${storedName} — your baseline, your checks, and everything saved on this phone.`}
        </Caption>
      </View>

      {error ? (
        <Banner tone="caution" title="Could not read what is saved" body={error} />
      ) : null}

      {summary !== null && summary.sampleChecks > 0 ? <SampleDataBanner scope="manage" /> : null}

      {/* ------------------------------------------------------------------ baseline */}
      <Card title="Your baseline" subtitle={baseline?.ready ? 'Complete' : 'Still building'}>
        {baseline !== null && !baseline.ready ? (
          <>
            <ProgressBar
              progress={baseline.target === 0 ? null : baseline.count / baseline.target}
              label={`Day ${baseline.count} of ${baseline.target}`}
              testID="you-baseline-progress"
            />
            {baseline.count > 0 ? (
              <AppText testID="you-baseline-count">
                {`${baseline.count} of ${baseline.target} baseline days so far.`}
              </AppText>
            ) : null}
          </>
        ) : null}

        {baseline !== null && baseline.ready ? (
          <>
            <StatRow
              label="Days in your baseline"
              value={`${baseline.count} of ${baseline.target}`}
              emphasis
              testID="you-baseline-count"
            />
            {baselineRange(baseline) !== null ? (
              <StatRow label="Built from" value={baselineRange(baseline) as string} />
            ) : null}
            <StatRow
              label="Checks since it was complete"
              value={`${baseline.checksSince}`}
              hint="Each of these was compared with your usual"
            />
          </>
        ) : null}

        {statusLine !== null ? <AppText>{statusLine}</AppText> : null}

        <Caption>{BASELINE_EXPLANATION}</Caption>
      </Card>

      {/* ------------------------------------------------------------------ name */}
      <Card title="Your name" subtitle="Optional">
        <AppText tone="secondary">
          Used only to greet you here and to head a summary you share. It is stored on this phone
          and nowhere else, and you can leave it blank.
        </AppText>
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setNameDraft(text);
            setNameSaved(false);
          }}
          placeholder="Leave blank to skip"
          placeholderTextColor={colors.textSecondary}
          maxLength={DISPLAY_NAME_MAX}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={saveName}
          accessibilityLabel="Your name, optional"
          accessibilityHint={`Stored only on this phone. Up to ${DISPLAY_NAME_MAX} characters.`}
          testID="you-name-input"
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
        />
        <Button
          label={clearingName ? 'Save (clears your name)' : 'Save my name'}
          onPress={saveName}
          variant="secondary"
          testID="you-name-save"
        />
        {nameSaved ? (
          <Caption testID="you-name-saved">
            {normalizeDisplayName(draft) === null
              ? 'Your name was cleared.'
              : 'Saved on this phone.'}
          </Caption>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------------ appearance */}
      <SectionHeader title="Appearance" />
      <ListGroup testID="you-appearance">
        {APPEARANCE_OPTIONS.map((option) => (
          <ListRow
            key={option}
            testID={`you-appearance-${option}`}
            icon={APPEARANCE_COPY[option].icon}
            title={APPEARANCE_COPY[option].title}
            subtitle={APPEARANCE_COPY[option].subtitle}
            selected={appearancePreference === option}
            onPress={() => chooseAppearance(option)}
          />
        ))}
      </ListGroup>

      {/* ------------------------------------------------------------------ data */}
      <Card title="Your data">
        {summary !== null ? (
          <>
            <StatRow label="Checks saved" value={`${summary.checks}`} emphasis testID="you-checks" />
            {summary.firstCheck !== null ? (
              <StatRow label="First check" value={formatShortDay(summary.firstCheck)} />
            ) : null}
            {summary.lastCheck !== null ? (
              <StatRow label="Most recent check" value={formatShortDay(summary.lastCheck)} />
            ) : null}
            <StatRow
              label="Recordings kept on this phone"
              value={effectiveKeepAudio ? 'Yes' : 'No'}
              hint={
                effectiveKeepAudio
                  ? summary.keptRecordings > 0
                    ? `${summary.keptRecordings} saved on this phone`
                    : 'None saved yet'
                  : undefined
              }
              testID="you-kept-recordings"
            />
          </>
        ) : null}

        {summary !== null && summary.checks === 0 ? (
          <AppText testID="you-empty">
            Nothing is saved yet. Your first picture check will appear here, and everything it
            records stays on this phone.
          </AppText>
        ) : null}

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

        <ResultShareButton label="Share a PDF of my trends" testID="you-share-pdf" />

        {summary !== null && summary.sampleChecks > 0 ? (
          <Button
            label={`Remove ${summary.sampleChecks} sample checks`}
            onPress={removeSamples}
            variant="quiet"
            icon="trash"
            busy={removingSamples}
            hint="Removes the demonstration data only. Your own checks are not touched."
            testID="you-remove-samples"
          />
        ) : null}

        {actionError ? (
          <AppText variant="caption" style={{ color: colors.destructive }} testID="you-action-error">
            {actionError}
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

      {/* ------------------------------------------------------------------ privacy */}
      <Card title="Privacy">
        <View style={styles.section}>
          {PROFILE_PRIVACY_POINTS.map((point) => (
            <View key={point} style={styles.bullet}>
              <Glyph name="lock" color={colors.textSecondary} size={20} />
              <AppText style={styles.bulletText}>{point}</AppText>
            </View>
          ))}
        </View>
        <Button
          label="Read the full privacy section"
          onPress={() => router.push('/about')}
          variant="quiet"
          icon="info"
        />
      </Card>

      {/* ------------------------------------------------------------------ footer */}
      <Card title="This build">
        {model !== null ? (
          <>
            <StatRow label="Model" value={model.model_id} />
            {/* A long value squeezes the label column until the label itself wraps badly, so the
                demo disclosure (AGENTS.md #2) goes in the hint, which gets the full label column
                rather than fighting the value for it. */}
            <StatRow
              label="Trained on real data"
              value={model.trained ? 'Yes' : 'No'}
              hint={model.trained ? undefined : 'This build uses a synthetic demo model'}
              testID="you-model-trained"
            />
          </>
        ) : null}
        <StatRow label="App version" value={appVersion} />
        <StatRow label="Disclosures accepted" value={CONSENT_VERSION} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  section: { gap: Spacing.md },
  centered: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xxxl,
  },
  bullet: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bulletText: { flex: 1 },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: Type.body.fontSize,
    minHeight: MinTouch,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
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
});

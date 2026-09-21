import { decideTier, DRIFT_Z } from '@/scorer';
import spec from '@/shared/feature_spec.json';
import type { DriftSummary, TierInput } from '@/types';

const TARGET = spec.baseline.baseline_days;
const ELEVATED = DRIFT_Z + 0.2;
const CALM = DRIFT_Z - 0.5;

function building(recentComposites: number[] = []): DriftSummary {
  return {
    status: 'building',
    baselineCount: 2,
    baselineTarget: TARGET,
    perFeature: {},
    composite: null,
    recentComposites,
  };
}

function ready(recentComposites: number[]): DriftSummary {
  return {
    status: 'ready',
    baselineCount: TARGET,
    baselineTarget: TARGET,
    perFeature: { pause_rate: recentComposites[recentComposites.length - 1] ?? 0 },
    composite: recentComposites[recentComposites.length - 1] ?? 0,
    recentComposites,
  };
}

const DRIFTS: { name: string; drift: DriftSummary }[] = [
  { name: 'baseline building', drift: building() },
  { name: 'baseline building with stray composites', drift: building([ELEVATED, ELEVATED]) },
  { name: 'first session after the baseline', drift: ready([CALM]) },
  { name: 'steady', drift: ready([CALM, CALM, CALM]) },
  { name: 'only this session elevated', drift: ready([CALM, CALM, ELEVATED]) },
  { name: 'only an older session elevated', drift: ready([ELEVATED, ELEVATED, CALM]) },
  { name: 'this session and one earlier elevated', drift: ready([ELEVATED, CALM, ELEVATED]) },
  { name: 'every recent session elevated', drift: ready([ELEVATED, ELEVATED, ELEVATED]) },
  { name: 'first session after the baseline, elevated', drift: ready([ELEVATED]) },
];

const PROBABILITIES = [0, 0.1, 0.49, 0.5, 0.75, 1];
const THRESHOLD = 0.5;

const ALL_INPUTS: TierInput[] = DRIFTS.flatMap(({ drift }) =>
  PROBABILITIES.flatMap((probability) =>
    [true, false].map((modelTrained) => ({
      probability,
      threshold: THRESHOLD,
      modelTrained,
      drift,
    })),
  ),
);

function elevatedCount(drift: DriftSummary): number {
  return drift.recentComposites.filter((composite) => composite >= DRIFT_Z).length;
}

function currentElevated(drift: DriftSummary): boolean {
  const recent = drift.recentComposites;
  return recent.length > 0 && recent[recent.length - 1] >= DRIFT_Z;
}

describe('decideTier invariants', () => {
  it('always returns a valid tier and at least one reason', () => {
    for (const input of ALL_INPUTS) {
      const decision = decideTier(input);

      expect(['typical', 'watch', 'doctor']).toContain(decision.tier);
      expect(decision.reasons.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('names the demo model exactly when the model is untrained', () => {
    for (const input of ALL_INPUTS) {
      const decision = decideTier(input);

      expect(decision.reasons.includes('demo_model')).toBe(!input.modelTrained);
    }
  });

  it('never sends someone to a doctor on the strength of a demo model', () => {
    for (const input of ALL_INPUTS) {
      if (input.modelTrained) continue;

      expect(decideTier(input).tier).not.toBe('doctor');
    }
  });

  it('never escalates to doctor on a single unusual session', () => {
    for (const input of ALL_INPUTS) {
      const decision = decideTier(input);
      if (decision.tier !== 'doctor') continue;

      // Escalation needs this session to be unusual AND at least one other recent one.
      expect(input.drift.status).toBe('ready');
      expect(currentElevated(input.drift)).toBe(true);
      expect(elevatedCount(input.drift)).toBeGreaterThanOrEqual(2);
    }
  });

  it('ignores drift entirely while the baseline is still building', () => {
    for (const probability of PROBABILITIES) {
      for (const modelTrained of [true, false]) {
        const base = { probability, threshold: THRESHOLD, modelTrained };
        const quiet = decideTier({ ...base, drift: building() });
        const noisy = decideTier({ ...base, drift: building([ELEVATED, ELEVATED, ELEVATED]) });

        expect(noisy).toEqual(quiet);
        expect(quiet.reasons).toContain('baseline_building');
        expect(quiet.reasons).not.toContain('sustained_drift');
        expect(quiet.reasons).not.toContain('single_session_drift');
      }
    }
  });

  it('says which side of the threshold the probability fell on', () => {
    for (const input of ALL_INPUTS) {
      const decision = decideTier(input);
      const above = input.probability >= input.threshold;

      expect(decision.reasons).toContain(
        above ? 'population_above_threshold' : 'population_below_threshold',
      );
    }
  });
});

describe('decideTier on the obvious cases', () => {
  const trained = { threshold: THRESHOLD, modelTrained: true };

  it('is typical when the model is calm and the baseline is calm', () => {
    const decision = decideTier({ ...trained, probability: 0.1, drift: ready([CALM, CALM, CALM]) });

    expect(decision.tier).toBe('typical');
    expect(decision.reasons).toEqual(['population_below_threshold', 'no_drift']);
  });

  it('is worth watching when only the population model is concerned', () => {
    const decision = decideTier({ ...trained, probability: 0.9, drift: ready([CALM, CALM, CALM]) });

    expect(decision.tier).toBe('watch');
  });

  it('is worth watching when only this one session drifted', () => {
    const decision = decideTier({ ...trained, probability: 0.1, drift: ready([CALM, ELEVATED]) });

    expect(decision.tier).toBe('watch');
    expect(decision.reasons).toContain('single_session_drift');
  });

  it('suggests a doctor only when a trained model and a sustained drift agree', () => {
    const drift = ready([ELEVATED, CALM, ELEVATED]);

    expect(decideTier({ ...trained, probability: 0.9, drift }).tier).toBe('doctor');
    expect(decideTier({ ...trained, probability: 0.1, drift }).tier).toBe('watch');
    expect(decideTier({ ...trained, modelTrained: false, probability: 0.9, drift }).tier).toBe(
      'watch',
    );
  });
});

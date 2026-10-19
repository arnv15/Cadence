# Spec — "You" screen (profile) for Cadence

Status: proposed, not implemented. Target: Congressional App Challenge build (deadline
**2026-10-26, 12:00 pm EDT**). Read [AGENTS.md](../../AGENTS.md) and
[HANDOFF.md](../../HANDOFF.md) before starting.

## Why

Cadence stores every check locally but gives the user almost no way to see or control their own
data, and the **personal baseline — half of how a tier is decided — is invisible**. The About tab
has quietly become a settings screen as well as a reference document; it is long, and the two
controls that matter most to a 50–85-year-old user ("what have you saved about me?" and "delete
it") are buried at the bottom of it.

This adds a fourth tab, **You**, which owns the user's own data and state. About goes back to being
only "what this app is and what the research says".

## Non-goals (do not build these)

- **No accounts, login, sync, or server of any kind.** "Audio never leaves the device, no
  analytics, no network except the one-time Whisper model download" is a non-negotiable
  (AGENTS.md #5) and one of the strongest claims in the submission.
- **No age, sex, height, weight, or medical-history fields.** The nine features are all speech
  measurements; the model consumes no demographics. Collecting them would imply they affect the
  score, which is the quiet overclaiming the project's rules exist to prevent (AGENTS.md #1).
- **No multiple profiles / family switching.** The baseline is per-person and mixing two speakers
  into one baseline makes every subsequent tier meaningless. One person per device.
- **No "reset my baseline" button.** The baseline is defined as the first session of each of the
  first `baseline_days` distinct local days; there is no safe partial reset that does not amount to
  deleting history. "Delete everything" already covers the real need.

## What already exists (reuse, do not rewrite)

| Thing | Where |
|---|---|
| SQLite + migrations, `sessions` and `settings` tables | `app/src/db.ts` (schema version 2) |
| `getSetting` / `setSetting`, typed by `SettingKey` | `app/src/db.ts`, `app/src/types.ts:222` |
| `deleteAllData()` — wipes sessions, settings, and the recordings directory | `app/src/db.ts` |
| `listSessions({ task, limit, order })` | `app/src/db.ts` |
| Keep-audio switch, delete-everything flow with `Alert` confirm, app version row | `app/src/app/(tabs)/about.tsx` — **move these, do not duplicate** |
| Consent state and `CONSENT_VERSION` | `app/src/hooks/use-consent.tsx`, `app/src/content/consent.ts` |
| Baseline progress helper and copy | `app/src/content/trends.ts` (`baselineProgress`, `BASELINE_EXPLANATION`) |
| Baseline constants: `baseline_days: 5`, `recent_window: 3` | `app/src/shared/feature_spec.json` → `baseline` |
| `DriftSummary` (`status`, `baselineCount`, `baselineTarget`, …) | `app/src/types.ts:126` |
| PDF export | `app/src/report.ts` → `shareReport()`, `ResultShareButton` |
| Sample-history notice and scoped deletion | `app/src/sample-history.ts`, `deleteSampleSessions()` |
| UI kit | `Screen`, `Card`, `StatRow`, `Button`, `Banner`, `Collapsible`, `Glyph`, `AppText`/`Caption`/`Heading`/`Title` |
| Async loading pattern | `useAsync` + `useFocusEffect(reload)` as in `app/src/app/(tabs)/trends.tsx` |

## Screen contents, in order

Route: `app/src/app/(tabs)/you.tsx`. Tab added to `app/src/app/(tabs)/_layout.tsx` between
`trends` and `about`, label **You**, `sf={{ default: 'person.circle', selected:
'person.circle.fill' }}` / `md="person"`.

1. **Header** — `Title` "You". If a display name is set, `Caption` greets by it.

2. **`SampleDataBanner`** when any `isSample` row is present (same condition the other screens use).

3. **Card: "Your baseline"** — the reason this screen exists.
   - While building: `ProgressBar` or `StatRow` reading `Day {baselineCount} of {baselineTarget}`,
     plus one calm sentence: Cadence is still learning how you usually speak, and will not compare
     days until it has. **Do not** show a "score" or imply anything is being withheld.
   - When ready: `StatRow`s for the number of days in the baseline, the date range it was built
     from, and how many checks have been recorded since.
   - Always: a one-line plain explanation of what a baseline is, reusing `BASELINE_EXPLANATION`.
   - Reuse `baselineProgress` from `@/content/trends`; do not recompute the baseline here, and do
     not import from `scorer.ts` beyond existing exports.

4. **Card: "Your name" (optional)** — a single text field, local only, empty by default, skippable
   and clearable. Used for the greeting and the PDF header. Explicitly captioned as optional and
   stored only on this phone. If this adds risk near the deadline, cut it first; everything else
   here is more valuable.

5. **Card: "Your data"**
   - `StatRow`: number of checks saved, first check date, last check date.
   - `StatRow`: whether recordings are being kept on the phone.
   - **Keep audio** `Switch` — moved verbatim from `about.tsx`, including the rollback-on-failure
     behaviour (the switch must never claim a setting that did not save).
   - **Share a PDF of my trends** → `shareReport()`.
   - **Remove sample history** → `deleteSampleSessions()`, shown only when sample rows exist.
   - **Delete everything** — `Button variant="destructive"`, moved verbatim from `about.tsx` with
     its `Alert.alert` confirmation, busy state, and `refresh()` of consent afterwards.

6. **Card: "Privacy"** — the short version of `PRIVACY_POINTS`, with a link/press through to About
   for the full text. Three bullets maximum.

7. **Footer rows** — app version (`Constants.expoConfig?.version`), model id and `trained` flag,
   consent version. Keep the existing "demo model" wording; the `trained: false` state must stay
   visible wherever a result or model identity appears (AGENTS.md #2).

## Data model changes

Only if the display name is built:

```ts
// app/src/types.ts
export type SettingKey = 'consent_version' | 'keep_audio' | 'display_name';
```

No schema migration is needed — `settings` is already key/value. **Do not bump `SCHEMA_VERSION`.**
Trim whitespace, cap at 40 characters, and treat empty as unset. `display_name` must be escaped
through the existing `escapeHtml` before it reaches `buildReportHtml`.

## Changes to About

Delete the keep-audio switch, the delete-everything flow, and the app-version footer from
`about.tsx`, and leave a single `Card` pointing to the You tab ("Your data and settings live on the
You tab"). About keeps the disclaimer, prototype banner, how-it-works, tiers, limitations, and
citations. Confirm no `about.tsx` test asserts on the removed controls; move those assertions.

## Copy rules (AGENTS.md #6)

Audience is adults 50–85, some of them worried about their memory. Body text ≥ 17 pt, touch targets
≥ 56 pt (`MinTouch`), never state anything by colour alone, works in light and dark. Plain, calm,
hedged. Say "checks", not "sessions"; "your usual", not "baseline deviation". No diagnosis language
anywhere, and the screening disclaimer stays wherever a result is implied.

## Owner's piece (do not write this for them)

Per AGENTS.md conventions, the repo owner writes the judgment calls. Leave a `TODO(human)` for
**the baseline-status copy and thresholds** in `app/src/content/profile.ts` — what the screen says
at 1, 3 and 5 of 5 days, and whether a long gap since the last check is pointed out. The tension:
being honest that no comparison is happening yet, without making someone feel the app is
withholding bad news. Keep it small and readable.

## Tests

`app/src/__tests__/` (Jest + jest-expo), per the "new logic comes with tests" convention:

- Baseline status rendering: building (1 of 5), nearly ready (4 of 5), ready — asserting the
  user-visible string, not the internals.
- Display name: trimmed, capped, empty string clears it, survives a reload, HTML-escaped in the
  report path.
- Keep-audio switch rolls back when `setSetting` rejects.
- Delete-everything calls `deleteAllData()` only after confirmation, and the screen shows the empty
  state afterwards.
- `npm run typecheck && npm test` must be green; `parity.test.ts` and `tier.test.ts` must be
  untouched by this work — **no feature or scoring logic changes in this task.**

## Acceptance

- Four tabs; You loads with zero sessions and shows a sensible empty state.
- Every control removed from About works identically on You.
- Nothing on the screen names a disease, implies a diagnosis, or hides the demo-model status.
- No new network calls, no new permissions, no new dependencies.

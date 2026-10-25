/**
 * Written content for the About tab. Kept out of the screen so the wording can be reviewed as
 * prose, and so a test can assert that the honest bits are actually still in the app.
 *
 * House style for this audience (adults 50-85 who may already be worried): short sentences, no
 * jargon without an explanation right next to it, no false reassurance, and no alarm.
 */

import type { Tier } from '@/types';

export interface Section {
  title: string;
  body: string[];
}

/**
 * Step 4 describes the model comparison, which only means something once the model is trained
 * on real recordings. Until then it says what the demonstration model actually is.
 */
function comparisonsBody(trained: boolean): string[] {
  const baseline =
    'The second comparison is with you. Your first five days of checks become your personal baseline, and after that every check is measured against how you normally sound.';
  if (!trained) {
    return [
      'The first comparison is with a statistical model. In this version it is a demonstration model built from invented data, not real recordings, so this comparison shows how Cadence works rather than saying anything about your health.',
      baseline,
      'The second comparison matters more, and with the demonstration model it is the only one that means anything. Everyone speaks differently, so a change from your own usual pattern says more than any comparison with other people.',
    ];
  }
  return [
    'The first comparison is with research data: a statistical model gives a rough probability that speech with this shape resembles the concern group in the studies Cadence is based on.',
    baseline,
    'The second comparison matters more. Everyone speaks differently, so a change from your own usual pattern says more than a comparison with strangers.',
  ];
}

/**
 * `trained` comes from the bundled model. Pass false when the model could not be read: without
 * it nothing is known about the model, so the copy must not claim research data behind it.
 */
export const howItWorks = (trained: boolean): Section[] => [
  {
    title: 'You describe a picture',
    body: [
      'Cadence shows you a busy picture and asks you to say what is going on in it, out loud, for about a minute. There is no right answer and nothing to memorize.',
      'Describing a picture is used in memory research because it asks a lot of the brain at once: looking, finding the words, keeping track of what you have already said, and keeping the sentence going.',
    ],
  },
  {
    title: 'Your phone turns it into words',
    body: [
      'A speech-recognition model called Whisper runs on this phone and writes down what you said, along with the time of every word.',
      'Nothing is sent anywhere. The model is downloaded once, then works offline.',
    ],
  },
  {
    title: 'Cadence measures how you spoke',
    body: [
      'From the words and their timings, Cadence works out things like how many words a minute you spoke, how often you paused for half a second or more, how much of the time you spent pausing, how varied your vocabulary was, how often you leaned on words like "it" and "that", and how often you repeated yourself.',
      'It measures how you said it, not whether what you said was right.',
    ],
  },
  {
    title: 'Two comparisons, not one',
    body: comparisonsBody(trained),
  },
  {
    title: 'You get a tier and the reasons for it',
    body: [
      'Cadence shows one of three tiers, always with the reasons behind it, and always labelled a screening estimate rather than a diagnosis.',
      'It deliberately will not escalate because of one unusual day. A worrying pattern has to show up more than once.',
    ],
  },
];

/** Extra context for each tier, shown next to tierCopy(tier).title and .summary. */
export const TIER_GUIDE: Record<Tier, string> = {
  typical:
    'Shown when this check looked like the typical group in the research data and like your own ' +
    'usual pattern. It is not a clean bill of health, and it is not a reason to delay asking a ' +
    'doctor about something that worries you.',
  watch:
    'Shown when something stood out — either this check leaned toward the concern group in the ' +
    'research data, or it differed from your own baseline. One check is not a pattern. The useful ' +
    'response is to keep checking in for a couple of weeks and see whether it continues.',
  doctor:
    'Shown only when both things happen together and keep happening: the check leans toward the ' +
    'concern group AND this check plus at least one other recent check differed from your own ' +
    'baseline. Even then it means "this is worth mentioning to a doctor", not "something is ' +
    'wrong". Cadence cannot diagnose anything.',
};

export const LIMITATIONS: Section[] = [
  {
    title: 'The research studied a different problem',
    body: [
      'The published work Cadence builds on separated people already diagnosed with Alzheimer\u2019s disease from healthy speakers. Noticing the earliest change in one person is a much harder problem, and that is what Cadence attempts, so those accuracy figures do not carry over.',
    ],
  },
  {
    title: 'The transcription is the small, fast model',
    body: [
      'Whisper tiny.en runs on a phone without an internet connection, but it mishears words, drops quiet ones and places timestamps imperfectly. Every number here comes from that imperfect transcript \u2014 you can open it on any result and see what it heard.',
    ],
  },
  {
    title: 'Practice makes you better at the task',
    body: [
      'People get more fluent at describing a picture simply because they have done it before, which can mask a real change. Varying the picture reduces this but cannot remove it.',
    ],
  },
  {
    title: 'Ordinary life changes how you speak',
    body: [
      'Tiredness, a cold, a noisy room, low mood, a new medication or simply not feeling like talking all change speech measurably, and Cadence cannot tell any of them apart from a change in memory. That is why it compares you with yourself over time rather than judging one recording.',
    ],
  },
  {
    title: 'Some people it will not fit',
    body: [
      'The research data is overwhelmingly American English. If you speak with an accent the model was not trained on, speak English as a second language, stammer, or have a condition affecting your voice, the numbers mean less for you.',
    ],
  },
  {
    title: 'It is not a medical device',
    body: [
      'Cadence has not been tested in a clinical study, has not been reviewed or cleared by the FDA or any other regulator, and no clinician has signed off on its results. It cannot diagnose, rule out or monitor any condition.',
      'If you are worried about your memory, talk to a doctor \u2014 whatever this app says.',
    ],
  },
];

export const PRIVACY_POINTS: string[] = [
  'Your recordings, your transcripts and your results stay on this phone. There is no Cadence account and no Cadence server.',
  'Nothing is uploaded, and nothing is shared with anyone unless you export a summary yourself and send it.',
  'Audio is deleted right after a check is analyzed, unless you turn on "Keep my recordings" on the You tab.',
  'The one-time download is the speech model itself, about 78 MB, from the public whisper.cpp model repository. Nothing about you is sent with it.',
  'Deleting your data on the You tab removes every check, every setting and every saved recording from this phone. It cannot be undone, because there is no copy anywhere else.',
];

/** The line that must appear on every result, every export and every chart. */
export const SCREENING_DISCLAIMER = 'Screening estimate — not a diagnosis.';

/** The standing advice, repeated wherever a person might be worried. */
export const TALK_TO_A_DOCTOR =
  'If you are worried about your memory, talk to a doctor. That is true whatever Cadence says.';

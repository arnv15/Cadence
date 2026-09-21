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

export const HOW_IT_WORKS: Section[] = [
  {
    title: '1. You describe a picture',
    body: [
      'Cadence shows you a busy picture and asks you to say what is going on in it, out loud, for about a minute. There is no right answer and nothing to memorize.',
      'Describing a picture is used in memory research because it asks a lot of the brain at once: looking, finding the words, keeping track of what you have already said, and keeping the sentence going.',
    ],
  },
  {
    title: '2. Your phone turns it into words',
    body: [
      'A speech-recognition model called Whisper runs on this phone and writes down what you said, along with the time of every word.',
      'Nothing is sent anywhere. The model is downloaded once, then works offline.',
    ],
  },
  {
    title: '3. Cadence measures how you spoke',
    body: [
      'From the words and their timings, Cadence works out things like how many words a minute you spoke, how often you paused for half a second or more, how much of the time you spent pausing, how varied your vocabulary was, how often you leaned on words like "it" and "that", and how often you repeated yourself.',
      'It measures how you said it, not whether what you said was right.',
    ],
  },
  {
    title: '4. Two comparisons, not one',
    body: [
      'The first comparison is with research data: a statistical model gives a rough probability that speech with this shape resembles the concern group in the studies Cadence is based on.',
      'The second comparison is with you. Your first five days of checks become your personal baseline, and after that every check is measured against how you normally sound.',
      'The second comparison matters more. Everyone speaks differently, so a change from your own usual pattern says more than a comparison with strangers.',
    ],
  },
  {
    title: '5. You get a tier and the reasons for it',
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
    title: 'The research behind it studied a different problem',
    body: [
      'The published models Cadence is built on were trained on the DementiaBank Pitt corpus, which is mostly recordings from people already diagnosed with Alzheimer’s disease.',
      'Telling established Alzheimer’s disease apart from healthy speech is a much easier problem than noticing the earliest change in one person. Accuracy reported on the first problem does not carry over to the second, and Cadence is attempting the second.',
    ],
  },
  {
    title: 'The transcription is the small, fast model',
    body: [
      'Cadence uses Whisper tiny.en, the smallest English speech model, so it runs on a phone in a reasonable time without an internet connection.',
      'It mishears words, drops quiet words, invents the occasional word, and places timestamps imperfectly. Every number Cadence reports is computed from that imperfect transcript. You can open the transcript on any result to see exactly what it heard.',
    ],
  },
  {
    title: 'Doing the same task repeatedly makes you better at it',
    body: [
      'This is called a practice effect. People get faster and more fluent at describing a picture simply because they have done it before, which can mask a real change.',
      'Cadence varies the picture, but it cannot remove the effect.',
    ],
  },
  {
    title: 'Ordinary life changes how you speak',
    body: [
      'Tiredness, a cold, a poor night’s sleep, a noisy room, a new medication, alcohol, low mood, anxiety, hearing difficulty, a strong accent, or simply not being in the mood to talk all change speech measurably.',
      'Cadence cannot tell any of those apart from a change in memory. This is the main reason it compares you with yourself over time instead of judging a single recording.',
    ],
  },
  {
    title: 'Some people it will simply not fit',
    body: [
      'The research data is overwhelmingly American English speakers. If you speak with an accent the model was not trained on, speak English as a second language, stammer, or have a condition that affects your voice or speech, Cadence’s numbers will be less meaningful for you.',
    ],
  },
  {
    title: 'It has not been validated, and it is not a medical device',
    body: [
      'Cadence is a student research prototype built for the Congressional App Challenge. It has not been tested in a clinical study, it has not been reviewed or cleared by the FDA or any other regulator, and no clinician has signed off on its results.',
      'It cannot diagnose, rule out, or monitor any condition. If you are worried about your memory, or someone close to you is worried about yours, please talk to a doctor. Do that whatever this app says.',
    ],
  },
];

export const PRIVACY_POINTS: string[] = [
  'Your recordings, your transcripts and your results stay on this phone. There is no Cadence account and no Cadence server.',
  'Nothing is uploaded, and nothing is shared with anyone unless you export a summary yourself and send it.',
  'Audio is deleted right after a check is analyzed, unless you turn on "Keep my recordings" below.',
  'The one-time download is the speech model itself, about 78 MB, from the public whisper.cpp model repository. Nothing about you is sent with it.',
  'Deleting your data below removes every check, every setting and every saved recording from this phone. It cannot be undone, because there is no copy anywhere else.',
];

/** The line that must appear on every result, every export and every chart. */
export const SCREENING_DISCLAIMER = 'Screening estimate — not a diagnosis.';

/** The standing advice, repeated wherever a person might be worried. */
export const TALK_TO_A_DOCTOR =
  'If you are worried about your memory, talk to a doctor. That is true whatever Cadence says.';

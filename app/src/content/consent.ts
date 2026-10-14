/**
 * Onboarding disclosures. The ui-flows onboarding screen renders CONSENT_STEPS in order and
 * stores CONSENT_VERSION under the 'consent_version' setting once the person accepts.
 *
 * Bump CONSENT_VERSION whenever the substance of a step changes, so existing users are shown
 * the new disclosures again instead of silently inheriting the old agreement.
 */

export const CONSENT_VERSION = 'v2';

export interface ConsentStep {
  title: string;
  /** Paragraphs, rendered in order. Each one is a complete, plain-language thought. */
  body: string[];
}

export const CONSENT_STEPS: ConsentStep[] = [
  {
    title: 'What Cadence does',
    body: [
      'Cadence asks you to look at a picture and describe it out loud for about a minute. That is the whole check.',
      'While you talk, the app listens for things like how quickly you speak, how often you pause, and how varied your words are. Everyday speech carries a lot of these small signals.',
      'Cadence remembers your own first several checks as your personal baseline. After that, each new check can be compared with how you usually sound. This version also shows a clearly labeled synthetic demo score.',
      'You get a short, plain-language summary afterwards, and a chart of how your checks have gone over time.',
    ],
  },
  {
    title: 'What Cadence cannot do',
    body: [
      'Cadence is an educational research prototype. It is not a medical device, it has not been approved or cleared by any regulator, and it has not been validated in a clinical study.',
      'Nothing in this app is a diagnosis. A result here cannot tell you whether you have dementia, Alzheimer’s disease, mild cognitive impairment, or any other condition.',
      'Even the best speech screening tools in published research are only screening tools. They miss some people who do have a problem and flag some people who do not. Cadence’s accuracy has not been established.',
      'Plenty of ordinary things change how a person speaks on a given day: being tired, being unwell, a noisy room, a new medication, a stressful morning, or simply not feeling like talking.',
      'If you are worried about your memory, please talk to a doctor. That is true whatever this app says, and a "Typical" result here is never a reason to put off asking.',
    ],
  },
  {
    title: 'Your recordings stay on this phone',
    body: [
      'Everything happens on this device. Your voice is transcribed here, the analysis runs here, and your results are stored here. Nothing is uploaded, and there is no Cadence account or server.',
      'By default the audio file is deleted as soon as the check has been analyzed, and only the text and the numbers are kept. You can choose to keep your recordings in the About tab, and you can turn that back off at any time.',
      'The first check downloads a speech-recognition model of about 78 MB, one time. After that, Cadence works without an internet connection.',
      'You can delete everything Cadence has stored — every check, every setting, and every saved recording — from the About tab, at any time, without asking anyone.',
      'Nothing is shared with anyone else unless you choose to share it. If you want your doctor to see a summary, you export a PDF yourself and send it however you like.',
    ],
  },
];

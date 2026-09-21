/**
 * Sources behind Cadence, for the About tab.
 *
 * Every entry below was opened and read at its `url` on CITATIONS_VERIFIED_ON. Titles, authors,
 * venues, years, identifiers and every quoted number come from the source itself. Nothing here is
 * recalled from memory.
 *
 * If a source ever cannot be re-verified, set `verified` to false rather than deleting it: the UI
 * says plainly when a reference could not be checked, which is more honest than a silent gap.
 */

export interface Citation {
  id: string;
  title: string;
  /** Author list as printed by the source, or the issuing body for a government document. */
  authors: string;
  /** Journal, publisher or document series. */
  venue: string;
  year: number;
  url: string;
  /** DOI / PMID / arXiv id, as the source prints it. Null when the source has none. */
  identifier: string | null;
  /** Why this source matters to Cadence, in plain language for a non-specialist reader. */
  relevance: string;
  /** True only when the record above was checked against the source itself. */
  verified: boolean;
}

/** The day every entry below was last opened and checked. */
export const CITATIONS_VERIFIED_ON = '2026-09-20';

export const CITATIONS: Citation[] = [
  {
    id: 'mekulu-2026-voice-model',
    title: 'A 60-second interpretable voice model for early dementia screening',
    authors: 'Kevin Mekulu, Faisal Aqlan, Hui Yang',
    venue: 'PLOS Digital Health',
    year: 2026,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC13405093/',
    identifier: 'PMID 42507664 · doi:10.1371/journal.pdig.0001552',
    relevance:
      'This is the study Cadence is modelled on. The authors fit an ElasticNet logistic regression ' +
      'to linguistic features taken from DementiaBank Pitt Cookie Theft picture descriptions, and ' +
      'report an AUC of 0.858 with 90% sensitivity and 65% specificity at their chosen operating ' +
      'point. That trade-off — catch most of the people who may have a problem, and accept that ' +
      'many flagged people turn out to be fine — is the same one Cadence makes. It is also why a ' +
      '"Worth watching" result is a reason to keep checking in, not a reason to be alarmed.',
    verified: true,
  },
  {
    id: 'jafari-2025-mci-meta-analysis',
    title:
      'Diagnostic utility of speech-based biomarkers in mild cognitive impairment: a systematic ' +
      'review and meta-analysis',
    authors: 'Zahra Jafari, Melissa K. Andrew, Kenneth Rockwood',
    venue: 'Age and Ageing',
    year: 2025,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12560767/',
    identifier: 'PMID 41148189 · doi:10.1093/ageing/afaf316',
    relevance:
      'A review that pools many speech-screening studies for mild cognitive impairment. Across ' +
      'them, pooled sensitivity was 80% (95% CI 71–90%), pooled specificity was 77% (95% CI ' +
      '65–89%), and the pooled area under the curve was 0.78 (95% CI 0.70–0.86). Read plainly: ' +
      'even the published research misses roughly one person in five who does have mild cognitive ' +
      'impairment, and flags roughly one in four who does not. That is the ceiling for this whole ' +
      'idea, and Cadence sits below it, not above it.',
    verified: true,
  },
  {
    id: 'fda-cds-2026',
    title:
      'Clinical Decision Support Software: Guidance for Industry and Food and Drug ' +
      'Administration Staff',
    authors:
      'U.S. Food and Drug Administration — Center for Devices and Radiological Health, Center ' +
      'for Biologics Evaluation and Research, Center for Drug Evaluation and Research',
    venue: 'FDA final guidance',
    year: 2026,
    url: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software',
    identifier: 'Final guidance, issued January 2026',
    relevance:
      'This final guidance explains which software functions fall outside the FDA’s definition ' +
      'of a medical device. One of the statutory criteria from the 21st Century Cures Act is that ' +
      'the software must not be intended to acquire, process or analyze a signal from a signal ' +
      'acquisition system. Software that analyzes a voice recording in order to screen for or ' +
      'diagnose a condition therefore does not qualify for that exclusion, and a product of that ' +
      'kind is regulated as a medical device. Cadence has never been submitted to, reviewed by, ' +
      'or cleared by the FDA. That is precisely why it is offered as a student research prototype ' +
      'and why it must not be used to make any decision about anyone’s health.',
    verified: true,
  },
  {
    id: 'becker-1994-pitt-corpus',
    title:
      'The natural history of Alzheimer’s disease: description of study cohort and accuracy ' +
      'of diagnosis',
    authors:
      'James T. Becker, François Boller, Oscar L. Lopez, Judith Saxton, Karen L. McGonigle',
    venue: 'Archives of Neurology, 51(6), 585–594',
    year: 1994,
    url: 'https://talkbank.org/dementia/access/English/Pitt.html',
    identifier: 'The citation DementiaBank requires for the Pitt corpus',
    relevance:
      'The Pitt corpus, collected at the University of Pittsburgh and shared through ' +
      'DementiaBank, is the recording set behind almost every published result in this field, ' +
      'including the study above. Cadence has not been granted access to it. The model shipped ' +
      'with this app was therefore built on synthetic data and is flagged as untrained: it ' +
      'demonstrates how the app works and has learned nothing about real speech or real illness.',
    verified: true,
  },
  {
    id: 'radford-2022-whisper',
    title: 'Robust Speech Recognition via Large-Scale Weak Supervision',
    authors:
      'Alec Radford, Jong Wook Kim, Tao Xu, Greg Brockman, Christine McLeavey, Ilya Sutskever',
    venue:
      'arXiv preprint; later published in the Proceedings of the 40th International Conference ' +
      'on Machine Learning (ICML 2023)',
    year: 2022,
    url: 'https://arxiv.org/abs/2212.04356',
    identifier: 'arXiv:2212.04356',
    relevance:
      'Whisper is the speech-recognition model that turns your recording into words, running ' +
      'entirely on this phone. Cadence uses the smallest English-only version, tiny.en, so that ' +
      'it fits on a phone and finishes quickly. Smaller versions make more mistakes than larger ' +
      'ones: a missed word, an invented word, or a slightly misplaced timestamp changes the ' +
      'numbers Cadence calculates from your speech.',
    verified: true,
  },
];

/** Sources whose details could not be checked. The About screen calls these out by name. */
export function unverifiedCitations(): Citation[] {
  return CITATIONS.filter((citation) => !citation.verified);
}

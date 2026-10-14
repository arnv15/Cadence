import { parseRecordingInput } from '@/recording-input';
const directory = 'file:///documents/recordings';
const valid = { wavUri: `${directory}/2026-09-21T08-00-00-000Z.wav`, durationS: '60', task: 'picture', promptId: 'kitchen' };
it('accepts a completed recording and preserves its task', () => {
  expect(parseRecordingInput(valid, directory)?.durationS).toBe(60);
  expect(parseRecordingInput({ ...valid, task: 'fluency', promptId: '' }, directory)?.promptId).toBeNull();
});
it.each(['file:///documents/database.sqlite', `${directory}/../secret.wav`, `${directory}/%2e%2e.wav`, 'https://example.com/sample.wav'])(
  'rejects files outside the recording contract: %s', wavUri => {
    expect(parseRecordingInput({ ...valid, wavUri }, directory)).toBeNull();
  });
it.each(['NaN', 'Infinity', '-1', '0', '19', '61'])('rejects invalid duration %s', durationS => {
  expect(parseRecordingInput({ ...valid, durationS }, directory)).toBeNull();
});
it('rejects repeated query arguments and invalid task names', () => {
  expect(parseRecordingInput({ ...valid, wavUri: [valid.wavUri] }, directory)).toBeNull();
  expect(parseRecordingInput({ ...valid, task: 'unknown' }, directory)).toBeNull();
});

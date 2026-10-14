/// <reference types="jest" />
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useRecorder, type CadenceRecorder } from '@/audio/useRecorder';
import { requestRecordingPermissionsAsync, type AudioStreamBuffer } from 'expo-audio';

let mockOnBuffer: ((buffer: AudioStreamBuffer) => void) | undefined;
const mockStream = { start: jest.fn(async () => undefined), stop: jest.fn(), id: 1 };
let mockIsStreaming = false;
const mockWritten: Uint8Array[] = [];
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioStream: (options: { onBuffer: (buffer: AudioStreamBuffer) => void }) => {
    mockOnBuffer = options.onBuffer;
    return { stream: mockStream, isStreaming: mockIsStreaming };
  },
}));
jest.mock('@/audio/paths', () => ({ ensureDirectory: jest.fn(), recordingsDirectory: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class {
  uri = 'file:///test.wav';
  create() {}
  write(bytes: Uint8Array) { mockWritten.push(bytes); }
} }));
let recorder: CadenceRecorder;
let renderer: ReactTestRenderer;
const autoStop = jest.fn();
function Harness() { recorder = useRecorder({ onAutoStop: autoStop }); return null; }
async function mount() { await act(async () => { renderer = create(<Harness />); }); }
function buffer(seconds: number) {
  mockOnBuffer?.({ data: new Int16Array(Math.round(seconds * 16000)).fill(4000).buffer as ArrayBuffer,
    sampleRate: 16000, channels: 1, timestamp: 0 });
}
type Permission = Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockWritten.length = 0; mockIsStreaming = false;
  jest.mocked(requestRecordingPermissionsAsync).mockResolvedValue({ granted: true } as Permission);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); jest.useRealTimers(); });

it('does not activate the microphone after permission resolves on a cancelled screen', async () => {
  let grant: ((value: Permission) => void) | undefined;
  jest.mocked(requestRecordingPermissionsAsync).mockImplementation(() => new Promise(resolve => { grant = resolve; }));
  await mount();
  let starting: Promise<void> | undefined;
  await act(async () => { starting = recorder.start(); });
  await act(async () => recorder.cancel());
  await act(async () => { grant?.({ granted: true } as Permission); await starting; });
  expect(mockStream.start).not.toHaveBeenCalled();
});
it('caps audio at exactly one minute and delivers auto-stop once', async () => {
  await mount();
  await act(async () => recorder.start());
  await act(async () => { buffer(60.1); buffer(1); });
  expect(autoStop).toHaveBeenCalledTimes(1);
  expect(autoStop.mock.calls[0][0].durationS).toBe(60);
  expect(mockWritten[0].length).toBe(44 + 60 * 16000 * 2);
});
it('recovers from missing buffers instead of freezing the countdown', async () => {
  await mount();
  await act(async () => recorder.start());
  await act(async () => jest.advanceTimersByTime(5000));
  expect(recorder.state).toBe('error');
  expect(recorder.error).toContain('stopped sending audio');
  expect(mockStream.stop).toHaveBeenCalled();
  expect(mockWritten).toHaveLength(0);
});
it('detects a native stream interruption', async () => {
  await mount();
  await act(async () => recorder.start());
  mockIsStreaming = true;
  await act(async () => renderer.update(<Harness />));
  mockIsStreaming = false;
  await act(async () => renderer.update(<Harness />));
  expect(recorder.state).toBe('error');
  expect(mockStream.stop).toHaveBeenCalled();
});
it('offers settings recovery when permission is denied', async () => {
  jest.mocked(requestRecordingPermissionsAsync).mockResolvedValue({ granted: false } as Permission);
  await mount();
  await act(async () => recorder.start());
  expect(recorder.permissionDenied).toBe(true);
  expect(recorder.state).toBe('error');
  expect(mockStream.start).not.toHaveBeenCalled();
});

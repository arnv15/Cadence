/** Bytes in a canonical RIFF/WAVE header: RIFF(12) + fmt (24) + data(8). */
const WAV_HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const INT16_FULL_SCALE = 32768;
/** Level meter floor. Anything quieter than this reads as 0. */
const METER_FLOOR_DB = -60;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Build a RIFF/WAVE file from little-endian int16 PCM chunks. */
export function encodeWav(chunks: ArrayBuffer[], sampleRate: number, channels: number): Uint8Array {
  let dataBytes = 0;
  for (const chunk of chunks) {
    dataBytes += chunk.byteLength;
  }

  const blockAlign = channels * BYTES_PER_SAMPLE;
  const byteRate = sampleRate * blockAlign;
  const bytes = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size for PCM
  view.setUint16(20, 1, true); // audio format: 1 = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = WAV_HEADER_BYTES;
  for (const chunk of chunks) {
    bytes.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

/**
 * RMS level of an int16 PCM chunk mapped to 0..1 for a UI meter.
 * Linear RMS spends almost all of its range on loud speech, so the value is converted to dBFS
 * and mapped from METER_FLOOR_DB..0 dB onto 0..1, which tracks perceived loudness far better.
 */
export function rmsLevel(chunk: ArrayBuffer): number {
  const sampleCount = Math.floor(chunk.byteLength / BYTES_PER_SAMPLE);
  if (sampleCount === 0) {
    return 0;
  }

  const view = new DataView(chunk);
  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const sample = view.getInt16(i * BYTES_PER_SAMPLE, true) / INT16_FULL_SCALE;
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / sampleCount);
  if (rms <= 0) {
    return 0;
  }

  const db = 20 * Math.log10(rms);
  if (db <= METER_FLOOR_DB) {
    return 0;
  }
  if (db >= 0) {
    return 1;
  }
  return (db - METER_FLOOR_DB) / -METER_FLOOR_DB;
}

/** Read PCM16 mono WAV, including files with metadata chunks. Fail instead of scoring corrupt audio. */
export function decodeWav(bytes: Uint8Array): { samples: Int16Array; sampleRate: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number): string =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length < 12 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE') {
    throw new Error('The recording is not a WAV file.');
  }
  const riffEnd = view.getUint32(4, true) + 8;
  if (riffEnd > bytes.length) throw new Error('The recording is incomplete.');
  let sampleRate = 0;
  let data: Uint8Array | null = null;
  for (let offset = 12; offset + 8 <= riffEnd;) {
    const name = ascii(offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > riffEnd) throw new Error('The recording is incomplete.');
    if (name === 'fmt ') {
      if (size < 16 || view.getUint16(start, true) !== 1 ||
          view.getUint16(start + 2, true) !== 1 || view.getUint16(start + 14, true) !== 16 ||
          view.getUint16(start + 12, true) !== 2) {
        throw new Error('The recording must be mono PCM16 audio.');
      }
      sampleRate = view.getUint32(start + 4, true);
    } else if (name === 'data') {
      data = bytes.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  if (!data || data.length % 2 !== 0 || sampleRate <= 0) {
    throw new Error('The recording has invalid audio data.');
  }
  const pcm = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const samples = new Int16Array(data.byteLength / 2);
  for (let i = 0; i < samples.length; i += 1) samples[i] = pcm.getInt16(i * 2, true);
  return { samples, sampleRate };
}

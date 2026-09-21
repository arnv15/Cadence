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

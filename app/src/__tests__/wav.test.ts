/// <reference types="jest" />
import { encodeWav, rmsLevel } from '@/audio/wav';

/** Little-endian int16 PCM chunk, the shape expo-audio hands us. */
function pcm(samples: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  samples.forEach((sample, i) => view.setInt16(i * 2, sample, true));
  return buffer;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i += 1) {
    text += String.fromCharCode(bytes[offset + i]);
  }
  return text;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

describe('encodeWav header', () => {
  it('writes a 44-byte RIFF/WAVE header when there is no audio', () => {
    const wav = encodeWav([], 16000, 1);
    expect(wav.byteLength).toBe(44);

    const dv = view(wav);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(dv.getUint32(4, true)).toBe(36); // 36 + 0 data bytes
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 12, 4)).toBe('fmt ');
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(dv.getUint32(40, true)).toBe(0);
  });

  it('describes 16 kHz mono int16 exactly', () => {
    const wav = encodeWav([pcm([1, 2, 3, 4])], 16000, 1);
    const dv = view(wav);

    expect(dv.getUint32(16, true)).toBe(16); // PCM fmt chunk size
    expect(dv.getUint16(20, true)).toBe(1); // format 1 = PCM
    expect(dv.getUint16(22, true)).toBe(1); // channels
    expect(dv.getUint32(24, true)).toBe(16000); // sample rate
    expect(dv.getUint32(28, true)).toBe(32000); // byteRate = 16000 * 1 * 2
    expect(dv.getUint16(32, true)).toBe(2); // blockAlign = 1 * 2
    expect(dv.getUint16(34, true)).toBe(16); // bits per sample
  });

  it('derives byteRate and blockAlign from the actual rate and channel count', () => {
    const dv = view(encodeWav([], 48000, 2));
    expect(dv.getUint16(22, true)).toBe(2);
    expect(dv.getUint32(24, true)).toBe(48000);
    expect(dv.getUint16(32, true)).toBe(4); // 2 channels * 2 bytes
    expect(dv.getUint32(28, true)).toBe(192000); // 48000 * 4
  });

  it('records the real data size and the matching RIFF size', () => {
    const wav = encodeWav([pcm([0, 0, 0]), pcm([0, 0])], 16000, 1);
    const dataBytes = 10;

    expect(wav.byteLength).toBe(44 + dataBytes);
    const dv = view(wav);
    expect(dv.getUint32(40, true)).toBe(dataBytes);
    expect(dv.getUint32(4, true)).toBe(36 + dataBytes);
    expect(dv.getUint32(4, true)).toBe(wav.byteLength - 8);
  });
});

describe('encodeWav payload', () => {
  it('concatenates int16 chunks in order, little-endian, straight after the header', () => {
    const wav = encodeWav([pcm([1, -1]), pcm([32767, -32768]), pcm([256])], 16000, 1);
    const dv = view(wav);

    expect(dv.getInt16(44, true)).toBe(1);
    expect(dv.getInt16(46, true)).toBe(-1);
    expect(dv.getInt16(48, true)).toBe(32767);
    expect(dv.getInt16(50, true)).toBe(-32768);
    expect(dv.getInt16(52, true)).toBe(256);

    // Little-endian byte order, checked at the byte level.
    expect(wav[44]).toBe(0x01);
    expect(wav[45]).toBe(0x00);
    expect(wav[52]).toBe(0x00);
    expect(wav[53]).toBe(0x01);
  });

  it('leaves a single chunk byte-for-byte intact', () => {
    const chunk = pcm([5, -7, 9, -11, 13]);
    const wav = encodeWav([chunk], 16000, 1);
    expect(Array.from(wav.slice(44))).toEqual(Array.from(new Uint8Array(chunk)));
  });
});

describe('rmsLevel', () => {
  function constant(amplitude: number, count = 256): ArrayBuffer {
    return pcm(new Array(count).fill(amplitude));
  }

  it('is 0 for an empty chunk and for digital silence', () => {
    expect(rmsLevel(new ArrayBuffer(0))).toBe(0);
    expect(rmsLevel(constant(0))).toBe(0);
  });

  it('is 1 at full scale', () => {
    expect(rmsLevel(constant(-32768))).toBe(1);
  });

  it('maps -6 dBFS to roughly 0.9 rather than to 0.5', () => {
    // Linear RMS would report 0.5 here; the perceptual mapping spreads quiet speech out instead.
    const level = rmsLevel(constant(-16384));
    expect(level).toBeCloseTo((20 * Math.log10(0.5) + 60) / 60, 6);
    expect(level).toBeGreaterThan(0.85);
  });

  it('floors anything at or below -60 dBFS', () => {
    // 32768 * 10^(-60/20) = 32.768, so 32 sits just under the floor.
    expect(rmsLevel(constant(32))).toBe(0);
    expect(rmsLevel(constant(1))).toBe(0);
  });

  it('stays inside 0..1 and rises with loudness', () => {
    const quiet = rmsLevel(constant(200));
    const middling = rmsLevel(constant(3000));
    const loud = rmsLevel(constant(30000));

    for (const level of [quiet, middling, loud]) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
    expect(quiet).toBeLessThan(middling);
    expect(middling).toBeLessThan(loud);
  });

  it('measures RMS, not peak', () => {
    // Half the samples at full scale gives an RMS of 1/sqrt(2), about -3 dBFS.
    const halfLoud = pcm([...new Array(128).fill(-32768), ...new Array(128).fill(0)]);
    expect(rmsLevel(halfLoud)).toBeCloseTo((20 * Math.log10(Math.SQRT1_2) + 60) / 60, 6);
  });

  it('ignores a trailing odd byte instead of reading past the end', () => {
    const odd = new ArrayBuffer(5);
    new DataView(odd).setInt16(0, -32768, true);
    new DataView(odd).setInt16(2, -32768, true);
    expect(rmsLevel(odd)).toBe(1);
  });
});

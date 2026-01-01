import {describe, expect, it} from 'vitest';
import {buildChunks, ensureTimedWords, toFrames} from '../src/utils/karaoke';

const fps = 30;

describe('ensureTimedWords', () => {
  it('uses provided timings when present', () => {
    const timings = [
      {word: 'Hello', start: 0, end: 0.5},
      {word: 'world', start: 0.5, end: 1},
    ];
    const timed = ensureTimedWords(timings, 'Hello world', 300, fps);
    expect(timed).toHaveLength(2);
    expect(timed[0]).toMatchObject({word: 'Hello', startFrame: 0, endFrame: 15});
    expect(timed[1]).toMatchObject({word: 'world', startFrame: 15, endFrame: 30});
  });

  it('falls back to full-duration timing when missing', () => {
    const timed = ensureTimedWords(undefined, 'Fallback text', 300, fps);
    expect(timed).toHaveLength(1);
    expect(timed[0]).toMatchObject({word: 'Fallback text', startFrame: 0, endFrame: 300});
  });
});

describe('buildChunks', () => {
  const timings = [
    {word: 'One', start: 0, end: 0.3},
    {word: 'Two', start: 0.35, end: 0.6},
    {word: 'Three', start: 1.2, end: 1.5},
    {word: 'Four', start: 1.55, end: 1.8},
  ];
  const timedWords = toFrames(timings, fps);

  it('splits chunks by pauseMs and maxWords (default enabled)', () => {
    const chunks = buildChunks(timedWords, fps, {maxWords: 2, pauseMs: 300});
    expect(chunks).toHaveLength(2);
    expect(chunks[0].words.map((w) => w.word)).toEqual(['One', 'Two']);
    expect(chunks[1].words.map((w) => w.word)).toEqual(['Three', 'Four']);
  });

  it('disables chunking when enabled=false', () => {
    const chunks = buildChunks(timedWords, fps, {enabled: false});
    expect(chunks).toHaveLength(1);
    expect(chunks[0].words.map((w) => w.word)).toEqual(['One', 'Two', 'Three', 'Four']);
  });

  it('returns empty when no words and chunking disabled', () => {
    const chunks = buildChunks([], fps, {enabled: false});
    expect(chunks).toHaveLength(0);
  });
});

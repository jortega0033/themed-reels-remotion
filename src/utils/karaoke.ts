import {WordTiming} from '../types/schema';

export type TimedWord = WordTiming & {
  startFrame: number;
  endFrame: number;
};

export type Chunk = {
  words: TimedWord[];
  text: string;
  startFrame: number;
  endFrame: number;
};

export const toFrames = (timings: WordTiming[], fps: number): TimedWord[] =>
  timings.map((timing) => ({
    ...timing,
    startFrame: Math.round(timing.start * fps),
    endFrame: Math.round(timing.end * fps),
  }));

export const buildChunks = (
  timedWords: TimedWord[],
  fps: number,
  opts?: {maxWords?: number; pauseMs?: number; enabled?: boolean}
): Chunk[] => {
  const chunkingEnabled = opts?.enabled ?? true;
  if (!chunkingEnabled) {
    if (!timedWords.length) return [];
    return [
      {
        words: timedWords,
        text: timedWords.map((w) => w.word).join(' '),
        startFrame: timedWords[0].startFrame,
        endFrame: timedWords[timedWords.length - 1].endFrame,
      },
    ];
  }

  const maxWordsPerChunk = opts?.maxWords ?? 7;
  const gapToleranceFrames = Math.round(((opts?.pauseMs ?? 350) / 1000) * fps);

  const chunks: Chunk[] = [];
  let current: TimedWord[] = [];

  timedWords.forEach((word, idx) => {
    current.push(word);

    const isMax = current.length >= maxWordsPerChunk;
    const next = timedWords[idx + 1];
    const pause = next ? next.startFrame - word.endFrame : 0;
    const hasPause = pause > gapToleranceFrames;
    const isLast = idx === timedWords.length - 1;

    if (isMax || hasPause || isLast) {
      const startFrame = current[0].startFrame;
      const endFrame = current[current.length - 1].endFrame;
      const text = current.map((w) => w.word).join(' ');

      chunks.push({words: [...current], text, startFrame, endFrame});
      current = [];
    }
  });

  return chunks;
};

export const ensureTimedWords = (
  timings: WordTiming[] | undefined,
  text: string,
  durationInFrames: number,
  fps: number
): TimedWord[] => {
  if (!timings?.length) {
    const fallbackEnd = durationInFrames / fps;
    return toFrames([
      {
        word: text,
        start: 0,
        end: fallbackEnd,
      },
    ], fps);
  }
  return toFrames(timings, fps);
};

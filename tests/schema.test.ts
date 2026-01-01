import {describe, expect, it} from 'vitest';
import {renderSpecObjectSchema} from '../src/types/schema';

const baseLayer = {
  id: 'layer_voice',
  type: 'Audio' as const,
  startFrame: 0,
  durationInFrames: 30,
  props: {
    src: 'voice_track_1',
    volume: 1,
  },
};

describe('renderSpecObjectSchema', () => {
  it('accepts a valid spec', () => {
    const parsed = renderSpecObjectSchema.safeParse({
      config: {width: 1080, height: 1920, fps: 30, durationInFrames: 300},
      assets: {voice_track_1: 'https://example.com/voice.mp3'},
      timeline: [baseLayer],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects missing timeline', () => {
    const parsed = renderSpecObjectSchema.safeParse({
      config: {width: 1080, height: 1920, fps: 30, durationInFrames: 300},
      assets: {},
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid karaoke timings', () => {
    const parsed = renderSpecObjectSchema.safeParse({
      config: {width: 1080, height: 1920, fps: 30, durationInFrames: 300},
      assets: {},
      timeline: [
        {
          id: 'layer_karaoke',
          type: 'KaraokeText' as const,
          startFrame: 0,
          durationInFrames: 300,
          props: {
            text: 'bad',
            timings: [{word: 'bad', start: 1, end: 0}],
          },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

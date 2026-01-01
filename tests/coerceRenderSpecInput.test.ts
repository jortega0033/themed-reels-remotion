import {describe, expect, it} from 'vitest';
import {coerceRenderSpecInput} from '../src/utils/coerceRenderSpecInput';
import {DEFAULT_SPEC} from '../src/defaultSpec';

const sample = {
  config: {width: 1080, height: 1920, fps: 30, durationInFrames: 300},
  assets: {},
  timeline: [],
};

describe('coerceRenderSpecInput', () => {
  it('returns default when undefined', () => {
    expect(coerceRenderSpecInput(undefined)).toEqual(DEFAULT_SPEC);
  });

  it('passes through valid object', () => {
    expect(coerceRenderSpecInput(sample)).toEqual(sample);
  });

  it('coerces numeric-keyed object to array', () => {
    const input = {0: sample, 1: sample};
    const result = coerceRenderSpecInput(input);
    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result).toHaveLength(2);
    }
  });
});

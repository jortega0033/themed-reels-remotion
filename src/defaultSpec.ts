import {RenderSpec} from './types/schema';

export const DEFAULT_SPEC: RenderSpec = {
  config: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 300,
  },
  assets: {},
  timeline: [],
};

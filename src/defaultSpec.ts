import {RenderSpec} from './types/schema';

export const DEFAULT_SPEC: RenderSpec = {
  config: {
    width: 1080,
    height: 1920,
    fps: 24, // Reduced from 30 to 24 fps (20% fewer frames)
    durationInFrames: 300,
  },
  assets: {},
  timeline: [],
};

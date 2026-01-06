import {describe, it, expect} from 'vitest';
import {renderSpecObjectSchema} from '../src/types/schema';

describe('Shape layer (overlay scrim) validation', () => {
  it('should validate JSON payload with layer_overlay_scrim', () => {
    const payload = {
      config: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 6264,
      },
      assets: {
        voice_track_1:
          'https://storage.googleapis.com/download/storage/v1/b/remotion-render-storage/o/renders%2F674%2Fvoiceover.mp3?generation=1767610403354605&alt=media',
        video_clip_1:
          'https://videos.pexels.com/video-files/19245860/19245860-hd_1080_1920_60fps.mp4',
      },
      timeline: [
        {
          id: 'layer_video_1',
          type: 'Video',
          startFrame: 0,
          durationInFrames: 6264,
          props: {
            src: 'video_clip_1',
            muted: true,
            loop: true,
            style: {
              objectFit: 'cover',
            },
          },
        },
        {
          id: 'layer_overlay_scrim',
          type: 'Shape',
          startFrame: 0,
          durationInFrames: 6264,
          props: {
            style: {
              backgroundColor: '#000000',
              width: '100%',
              height: '100%',
              opacity: 0.3,
            },
          },
        },
        {
          id: 'layer_voice',
          type: 'Audio',
          startFrame: 0,
          durationInFrames: 6264,
          props: {
            src: 'voice_track_1',
            volume: 1,
            fadeDuration: 24,
          },
        },
      ],
    };

    const result = renderSpecObjectSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeline).toHaveLength(3);
      const scrimLayer = result.data.timeline.find((l) => l.id === 'layer_overlay_scrim');
      expect(scrimLayer).toBeDefined();
      expect(scrimLayer?.type).toBe('Shape');
    }
  });

  it('should validate Shape layer with minimal props', () => {
    const payload = {
      config: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 100,
      },
      assets: {},
      timeline: [
        {
          id: 'shape_1',
          type: 'Shape',
          startFrame: 0,
          durationInFrames: 100,
          props: {},
        },
      ],
    };

    const result = renderSpecObjectSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should reject Shape layer with invalid type', () => {
    const payload = {
      config: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 100,
      },
      assets: {},
      timeline: [
        {
          id: 'shape_1',
          type: 'InvalidType',
          startFrame: 0,
          durationInFrames: 100,
          props: {},
        },
      ],
    };

    const result = renderSpecObjectSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

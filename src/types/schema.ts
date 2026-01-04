import {z} from 'zod';

const styleSchema = z.record(z.string(), z.unknown());

export const wordTimingSchema = z
  .object({
    word: z.string().min(1, 'word is required'),
    start: z.number().nonnegative(),
    end: z.number().positive(),
  })
  .refine((value) => value.end > value.start, {
    message: 'end must be greater than start',
    path: ['end'],
  });

const baseLayerSchema = z.object({
  id: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
});

const videoLayerSchema = baseLayerSchema.extend({
  type: z.literal('Video'),
  props: z.object({
    src: z.string().min(1),
    muted: z.boolean().optional(),
    loop: z.boolean().optional(),
    style: styleSchema.optional(),
  }),
});

const audioLayerSchema = baseLayerSchema.extend({
  type: z.literal('Audio'),
  props: z.object({
    src: z.string().min(1),
    volume: z.number().min(0).max(1).optional(),
    fadeDuration: z.number().int().nonnegative().optional(),
  }),
});

const karaokeLayerSchema = baseLayerSchema.extend({
  type: z.literal('KaraokeText'),
  props: z.object({
    text: z.string().min(1),
    style: styleSchema.optional(),
    timings: z.array(wordTimingSchema).nonempty().optional(),
    opacity: z.number().min(0).max(1).optional(),
    layout: z
      .object({
        verticalAlign: z.enum(['top', 'center', 'bottom']).optional(),
        padding: z.union([z.number().nonnegative(), z.string()]).optional(),
      })
      .optional(),
    chunking: z
      .object({
        maxWords: z.number().int().positive().optional(),
        pauseMs: z.number().nonnegative().optional(),
        enabled: z.boolean().optional(),
      })
      .optional(),
    highlightColor: z.string().optional(),
  }),
});

const layerSchema = z.discriminatedUnion('type', [
  videoLayerSchema,
  audioLayerSchema,
  karaokeLayerSchema,
]);

const configSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
  webhookUrl: z.string().url().optional(),
});

const assetsSchema = z.record(z.string(), z.string().min(1));

export const renderSpecObjectSchema = z.object({
  config: configSchema,
  assets: assetsSchema,
  timeline: z.array(layerSchema),
});

export const renderSpecInputSchema = z.union([
  renderSpecObjectSchema,
  z.array(renderSpecObjectSchema).min(1),
]);

export type WordTiming = z.infer<typeof wordTimingSchema>;
export type AssetMap = z.infer<typeof assetsSchema>;
export type VideoLayer = z.infer<typeof videoLayerSchema>;
export type AudioLayer = z.infer<typeof audioLayerSchema>;
export type KaraokeLayer = z.infer<typeof karaokeLayerSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type RenderSpec = z.infer<typeof renderSpecObjectSchema>;
export type RenderSpecInput = z.infer<typeof renderSpecInputSchema>;

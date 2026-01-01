import {Composition} from 'remotion';
import {MasterComposition} from './components/MasterComposition';
import {DEFAULT_SPEC} from './defaultSpec';
import {RenderSpec, RenderSpecInput, renderSpecInputSchema} from './types/schema';
import {coerceRenderSpecInput} from './utils/coerceRenderSpecInput';

const resolveDuration = (spec: RenderSpec): number => {
  const layersDuration = spec.timeline.reduce((max, layer) => {
    return Math.max(max, layer.startFrame + layer.durationInFrames);
  }, 0);

  return Math.max(spec.config.durationInFrames, layersDuration);
};

const normalizeSpec = (value: RenderSpecInput | undefined): RenderSpec => {
  console.log('normalizeSpec raw value', value);
  const candidate = coerceRenderSpecInput(value);
  const parsed = renderSpecInputSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`Render spec validation failed: ${parsed.error.toString()}`);
  }

  const spec = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
  console.log('normalizeSpec: config', spec.config, 'timeline length', spec.timeline.length);
  return spec;
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition<RenderSpecInput>
      id="MasterComposition"
      component={MasterComposition}
      durationInFrames={DEFAULT_SPEC.config.durationInFrames}
      fps={DEFAULT_SPEC.config.fps}
      width={DEFAULT_SPEC.config.width}
      height={DEFAULT_SPEC.config.height}
      calculateMetadata={({props}) => {
        const spec = normalizeSpec(props as RenderSpecInput);
        const durationInFrames = resolveDuration(spec);

        return {
          width: spec.config.width,
          height: spec.config.height,
          fps: spec.config.fps,
          durationInFrames,
          props: spec,
        };
      }}
    />
  );
};

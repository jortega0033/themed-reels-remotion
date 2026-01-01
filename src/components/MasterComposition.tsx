import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {DEFAULT_SPEC} from '../defaultSpec';
import {COMPONENT_REGISTRY} from '../registry/ComponentRegistry';
import {coerceRenderSpecInput} from '../utils/coerceRenderSpecInput';
import {
  Layer,
  RenderSpec,
  RenderSpecInput,
  renderSpecInputSchema,
} from '../types/schema';

const sortTimeline = (layers: Layer[]): Layer[] =>
  [...layers].sort((a, b) => a.startFrame - b.startFrame);

const normalizeSpec = (value: RenderSpecInput | undefined): RenderSpec => {
  console.log('MasterComposition raw props', value);
  const candidate = coerceRenderSpecInput(value);
  const parsed = renderSpecInputSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(`Render spec validation failed: ${parsed.error.toString()}`);
  }

  const spec = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
  console.log('MasterComposition normalizeSpec: config', spec.config, 'timeline length', spec.timeline.length);
  return spec;
};

export const MasterComposition: React.FC<RenderSpecInput> = (rawProps) => {
  const spec = useMemo(() => normalizeSpec(rawProps), [rawProps]);

  const orderedTimeline = useMemo(() => sortTimeline(spec.timeline), [spec.timeline]);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {orderedTimeline.map((layer) => {
        const Renderer = COMPONENT_REGISTRY[layer.type];

        if (!Renderer) {
          console.warn(`No renderer registered for layer type "${layer.type}"`);
          return null;
        }

        const zIndex = layer.type === 'KaraokeText' ? 20 : layer.type === 'Audio' ? 5 : 0;

        return (
          <Sequence
            key={layer.id}
            name={layer.id}
            from={layer.startFrame}
            durationInFrames={layer.durationInFrames}
            style={{zIndex}}
          >
            <Renderer layer={layer as Layer} assets={spec.assets} fps={spec.config.fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

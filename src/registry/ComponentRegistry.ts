import React from 'react';
import {AudioLayer} from '../components/layers/AudioLayer';
import {KaraokeText} from '../components/layers/KaraokeText';
import {VideoLayer} from '../components/layers/VideoLayer';
import {AssetMap, Layer} from '../types/schema';

export type LayerRenderer<T extends Layer = Layer> = React.FC<{
  layer: T;
  assets: AssetMap;
  fps: number;
}>;

export const COMPONENT_REGISTRY: Record<Layer['type'], LayerRenderer> = {
  Video: VideoLayer,
  Audio: AudioLayer,
  KaraokeText: KaraokeText,
};

import React from 'react';
import {Audio, useCurrentFrame} from 'remotion';
import {AssetMap, AudioLayer as AudioLayerType} from '../../types/schema';

interface Props {
  layer: AudioLayerType;
  assets: AssetMap;
  fps: number;
}

const resolveSrc = (assets: AssetMap, assetId: string, layerId: string): string => {
  const url = assets[assetId];

  if (!url) {
    console.warn(`Audio layer "${layerId}" is missing asset "${assetId}"`);
    return assetId;
  }

  return url;
};

export const AudioLayer: React.FC<Props> = ({layer, assets}) => {
  const frame = useCurrentFrame();
  const src = resolveSrc(assets, layer.props.src, layer.id);
  const fadeDuration = layer.props.fadeDuration ?? 0;
  const baseVolume = layer.props.volume ?? 1;

  const fadeIn = fadeDuration > 0 ? Math.min(1, frame / fadeDuration) : 1;
  const fadeOutStart = Math.max(0, layer.durationInFrames - fadeDuration);
  const fadeOut = fadeDuration > 0 ? Math.min(1, (layer.durationInFrames - frame) / fadeDuration) : 1;
  const fadeOutFactor = frame >= fadeOutStart ? fadeOut : 1;
  const volume = baseVolume * Math.min(fadeIn, fadeOutFactor);

  return <Audio src={src} volume={volume} />;
};

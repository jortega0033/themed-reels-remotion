import React, {CSSProperties} from 'react';
import {Video} from 'remotion';
import {AssetMap, VideoLayer as VideoLayerType} from '../../types/schema';

interface Props {
  layer: VideoLayerType;
  assets: AssetMap;
  fps: number;
}

const resolveSrc = (assets: AssetMap, assetId: string, layerId: string): string => {
  const url = assets[assetId];

  if (!url) {
    console.warn(`Video layer "${layerId}" is missing asset "${assetId}"`);
    return assetId;
  }

  return url;
};

export const VideoLayer: React.FC<Props> = ({layer, assets}) => {
  const src = resolveSrc(assets, layer.props.src, layer.id);
  const style = (layer.props.style as CSSProperties | undefined) ?? {};

  return (
    <Video
      src={src}
      muted={layer.props.muted ?? false}
      loop={layer.props.loop ?? false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
      }}
    />
  );
};

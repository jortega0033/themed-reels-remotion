import React, {CSSProperties} from 'react';
import {OffthreadVideo, useVideoConfig, Video} from 'remotion';
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
  const {durationInFrames} = useVideoConfig();
  
  // For layers that need looping and span the full composition,
  // use regular Video component with loop support.
  // Otherwise use OffthreadVideo for better rendering performance.
  const shouldUseLoopableVideo = 
    layer.props.loop && 
    layer.startFrame === 0 && 
    layer.durationInFrames >= durationInFrames * 0.8; // 80% or more of total duration

  if (shouldUseLoopableVideo) {
    return (
      <Video
        src={src}
        muted={layer.props.muted ?? false}
        loop={true}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          ...style,
        }}
      />
    );
  }

  return (
    <OffthreadVideo
      src={src}
      muted={layer.props.muted ?? false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
      }}
    />
  );
};

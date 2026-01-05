import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ShapeLayer as ShapeLayerType, AssetMap} from '../../types/schema';

export const ShapeLayer: React.FC<{
  layer: ShapeLayerType;
  assets: AssetMap;
  fps: number;
}> = ({layer}) => {
  return <AbsoluteFill style={layer.props.style} />;
};

import React, { CSSProperties, useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AssetMap, KaraokeLayer as KaraokeLayerType } from "../../types/schema";
import { buildChunks, ensureTimedWords, TimedWord } from "../../utils/karaoke";

interface Props {
  layer: KaraokeLayerType;
  assets: AssetMap;
  fps: number;
}

const buildOpacityRange = (word: TimedWord): number[] => {
  const range = [
    word.startFrame - 4,
    word.startFrame,
    word.startFrame + 2,
    word.endFrame - 2,
    word.endFrame,
    word.endFrame + 6,
  ];

  for (let i = 1; i < range.length; i++) {
    if (range[i] <= range[i - 1]) {
      range[i] = range[i - 1] + 0.001;
    }
  }

  return range;
};

export const KaraokeText: React.FC<Props> = ({ layer, fps }) => {
  const frame = useCurrentFrame();
  const style = (layer.props.style as CSSProperties | undefined) ?? {};
  const baseColor = (style.color as string | undefined) ?? "#ffffff";
  const activeColor = layer.props.highlightColor ?? baseColor;
  const isHook = layer.id.toLowerCase().includes("hook");
  const verticalAlign =
    layer.props.layout?.verticalAlign ?? (isHook ? "top" : "center");
  const padding =
    layer.props.layout?.padding ?? (isHook ? "64px 48px 32px" : "48px");
  const opacityScale = Math.max(0, Math.min(1, layer.props.opacity ?? 1));

  const timedWords = useMemo(
    () => ensureTimedWords(layer.props.timings, layer.props.text, layer.durationInFrames, fps),
    [fps, layer.durationInFrames, layer.props.text, layer.props.timings]
  );

  const chunks = useMemo(
    () =>
      buildChunks(timedWords, fps, {
        maxWords: layer.props.chunking?.maxWords,
        pauseMs: layer.props.chunking?.pauseMs,
        enabled: layer.props.chunking?.enabled,
      }),
    [timedWords, fps, layer.props.chunking]
  );

  const activeChunkIndex = useMemo(() => {
    if (!chunks.length) return -1;
    const direct = chunks.findIndex(
      (c) => frame >= c.startFrame && frame <= c.endFrame
    );
    if (direct !== -1) return direct;

    // fall back to last chunk that has started (for edge frames)
    let latest = -1;
    chunks.forEach((c, idx) => {
      if (frame >= c.startFrame) {
        latest = idx;
      }
    });
    return latest;
  }, [chunks, frame]);

  return (
    <AbsoluteFill
      style={{
        justifyContent:
          verticalAlign === "top"
            ? "flex-start"
            : verticalAlign === "bottom"
            ? "flex-end"
            : "center",
        alignItems: "center",
        padding,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: style.textAlign ?? "center",
          alignItems: "center",
          gap: "12px",
          lineHeight: 1.28,
          textAlign: style.textAlign ?? "center",
          width: "100%",
        }}
      >
        {(() => {
          if (activeChunkIndex === -1) return null;
          const chunk = chunks[activeChunkIndex];
          const chunkOpacity = interpolate(
            frame,
            [
              chunk.startFrame - 4,
              chunk.startFrame + 2,
              chunk.endFrame - 2,
              chunk.endFrame + 6,
            ],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return chunk.words.map((word, index) => {
            const isActiveWord =
              frame >= word.startFrame && frame <= word.endFrame;
            const wordOpacity = interpolate(
              frame,
              buildOpacityRange(word),
              [0.7, 0.9, 1, 1, 0.95, 0.75],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <span
                key={`${word.word}-${index}`}
                style={{
                  fontFamily: style.fontFamily ?? "sans-serif",
                  fontSize: style.fontSize ?? (isHook ? 84 : 64),
                  fontWeight: style.fontWeight ?? 800,
                  letterSpacing: style.letterSpacing ?? "0.02em",
                  textTransform: style.textTransform ?? "none",
                  color: isActiveWord ? activeColor : baseColor,
                  textShadow: style.textShadow,
                  opacity: opacityScale * chunkOpacity * wordOpacity,
                  transition: "color 0.2s ease",
                }}
              >
                {word.word}
              </span>
            );
          });
        })()}
      </div>
    </AbsoluteFill>
  );
};

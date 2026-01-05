import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Series,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { KaraokeCaptions } from './components/KaraokeCaptions';
import { processAlignment, ElevenLabsAlignment } from './utils/processAlignment';

export interface ThemedReelProps {
  videoUrls: string[];
  audioUrl: string;
  elevenLabsAlignment: ElevenLabsAlignment;
  hookText?: string;
  // Hook styling
  hookFontFamily?: string;
  hookColor?: string;
  hookShadow?: string;
  hookBackground?: string;
  hookBorder?: string;
  // Caption styling
  captionActiveColor?: string;
  captionInactiveColor?: string;
  captionActiveShadow?: string;
  captionInactiveShadow?: string;
  captionFontFamily?: string;
  captionFontSize?: string;
  captionLetterSpacing?: string;
  captionUppercase?: boolean;
  captionDisplayMode?: 'single' | 'chunk';
  captionPauseThresholdMs?: number;
  captionMaxChunkSize?: number;
  // Overlay styling
  overlayType?: 'gradient' | 'scrim' | 'none';
  overlayGradient?: string;
  scrimColor?: string;
  scrimOpacity?: number;
}

export const ThemedReel: React.FC<ThemedReelProps> = ({
  videoUrls,
  audioUrl,
  elevenLabsAlignment,
  hookText,
  // Hook styling with defaults (dark theme)
  hookFontFamily = 'Cinzel, "Times New Roman", serif',
  hookColor = '#e63946',
  hookShadow = '0 0 32px rgba(230,57,70,0.55), 0 0 72px rgba(230,57,70,0.35)',
  hookBackground = 'linear-gradient(145deg, rgba(12,14,18,0.92), rgba(20,24,32,0.92))',
  hookBorder = '2px solid rgba(230,57,70,0.35)',
  // Caption styling with defaults (dark theme)
  captionActiveColor = '#e63946',
  captionInactiveColor = '#cfd0d6',
  captionActiveShadow = '0 0 24px rgba(230,57,70,0.55), 0 0 60px rgba(230,57,70,0.35)',
  captionInactiveShadow = '0 0 14px rgba(0,0,0,0.85)',
  captionFontFamily = 'Cinzel, "Times New Roman", serif',
  captionFontSize = '84px',
  captionLetterSpacing = '0.04em',
  captionUppercase = true,
  captionDisplayMode = 'chunk',
  captionPauseThresholdMs,
  captionMaxChunkSize,
  // Overlay styling with defaults
  overlayType = 'gradient',
  overlayGradient = 'linear-gradient(180deg, rgba(0,0,0,0.82) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.9) 100%)',
  scrimColor = '#000000',
  scrimOpacity = 0.3,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const words = useMemo(
    () => processAlignment(elevenLabsAlignment),
    [elevenLabsAlignment]
  );

  // Calculate actual audio duration from alignment data
  const audioDurationSeconds =
    elevenLabsAlignment.character_end_times_seconds[
      elevenLabsAlignment.character_end_times_seconds.length - 1
    ];
  const audioDurationFrames = Math.ceil(audioDurationSeconds * fps);
  
  // Use the minimum of composition duration and audio duration
  const actualDuration = Math.min(durationInFrames, audioDurationFrames);

  // Calculate duration per video
  const framesPerVideo = Math.floor(actualDuration / videoUrls.length);

  // Compute overlay style based on type
  const overlayStyle = useMemo(() => {
    if (overlayType === 'none') {
      return null;
    }
    
    if (overlayType === 'scrim') {
      return {
        backgroundColor: scrimColor,
        opacity: scrimOpacity,
      };
    }
    
    // Default: gradient
    return {
      background: overlayGradient,
    };
  }, [overlayType, overlayGradient, scrimColor, scrimOpacity]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background Videos */}
      <AbsoluteFill>
        <Series>
          {videoUrls.map((url, index) => (
            <Series.Sequence
              key={index}
              durationInFrames={
                index === videoUrls.length - 1
                  ? actualDuration - framesPerVideo * index
                  : framesPerVideo
              }
            >
              <AbsoluteFill>
                <OffthreadVideo
                  src={url}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  muted
                />
              </AbsoluteFill>
            </Series.Sequence>
          ))}
        </Series>
      </AbsoluteFill>

      {/* Overlay for Readability (Gradient or Scrim) */}
      {overlayStyle && (
        <AbsoluteFill style={overlayStyle} />
      )}

      {/* Fade Out at End */}
      <AbsoluteFill
        style={{
          opacity: interpolate(
            frame,
            [actualDuration - 30, actualDuration],
            [0, 1]
          ),
          backgroundColor: '#000',
        }}
      />

      {/* Hook Text at Top */}
      {hookText ? (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: '80px',
          }}
        >
          <div
            style={{
              fontFamily: hookFontFamily,
              fontWeight: 800,
              fontSize: '64px',
              letterSpacing: '0.035em',
              textTransform: 'uppercase',
              color: hookColor,
              textAlign: 'center',
              textShadow: hookShadow,
              background: hookBackground,
              borderRadius: '20px',
              padding: '30px 42px',
              border: hookBorder,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              maxWidth: '960px',
            }}
          >
            {hookText}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Karaoke Captions */}
      <KaraokeCaptions
        words={words}
        displayMode={captionDisplayMode}
        activeColor={captionActiveColor}
        inactiveColor={captionInactiveColor}
        activeShadow={captionActiveShadow}
        inactiveShadow={captionInactiveShadow}
        fontFamily={captionFontFamily}
        fontSize={captionFontSize}
        letterSpacing={captionLetterSpacing}
        uppercase={captionUppercase}
        pauseThresholdMs={captionPauseThresholdMs}
        maxChunkSize={captionMaxChunkSize}
      />

      {/* Audio */}
      <Audio src={audioUrl} />
    </AbsoluteFill>
  );
};

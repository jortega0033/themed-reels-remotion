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
  type?: 'dark' | 'romantic' | 'entertainment' | 'narration' | 'corporate' | 'horror' | 'scifi';
}

export const ThemedReel: React.FC<ThemedReelProps> = ({
  videoUrls,
  audioUrl,
  elevenLabsAlignment,
  hookText,
  type = 'dark',
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

  const theme = useMemo(() => {
    const common = {
      overlay: 'linear-gradient(180deg, rgba(0,0,0,0.82) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.9) 100%)',
    } as const;

    const map = {
      dark: {
        hook: {
          fontFamily: 'Cinzel, "Times New Roman", serif',
          color: '#e63946',
          shadow: '0 0 32px rgba(230,57,70,0.55), 0 0 72px rgba(230,57,70,0.35)',
          background: 'linear-gradient(145deg, rgba(12,14,18,0.92), rgba(20,24,32,0.92))',
          border: '2px solid rgba(230,57,70,0.35)',
        },
        captions: {
          activeColor: '#e63946',
          inactiveColor: '#cfd0d6',
          activeShadow: '0 0 24px rgba(230,57,70,0.55), 0 0 60px rgba(230,57,70,0.35)',
          inactiveShadow: '0 0 14px rgba(0,0,0,0.85)',
          fontFamily: 'Cinzel, "Times New Roman", serif',
          fontSize: '84px',
          letterSpacing: '0.04em',
          uppercase: true,
          displayMode: 'chunk' as const,
        },
      },
      'romantic': {
        hook: {
          fontFamily: 'Playfair Display, "Times New Roman", serif',
          color: '#f7c6c7',
          shadow: '0 0 28px rgba(255,182,193,0.55)',
          background: 'linear-gradient(145deg, rgba(44,16,32,0.9), rgba(68,20,36,0.9))',
          border: '2px solid rgba(255,182,193,0.35)',
        },
        captions: {
          activeColor: '#f7c6c7',
          inactiveColor: '#e4cfd8',
          activeShadow: '0 0 24px rgba(247,198,199,0.55)',
          inactiveShadow: '0 0 14px rgba(0,0,0,0.75)',
          fontFamily: 'Playfair Display, "Times New Roman", serif',
          fontSize: '84px',
          letterSpacing: '0.02em',
          uppercase: false,
          displayMode: 'chunk' as const,
          pauseThresholdMs: 260,
          maxChunkSize: 10,
        },
      },
      entertainment: {
        hook: {
          fontFamily: 'Montserrat, Arial, sans-serif',
          color: '#3cf5ff',
          shadow: '0 0 28px rgba(60,245,255,0.6), 0 0 52px rgba(255,0,180,0.35)',
          background: 'linear-gradient(145deg, rgba(10,12,30,0.9), rgba(12,14,26,0.9))',
          border: '2px solid rgba(60,245,255,0.35)',
        },
        captions: {
          activeColor: '#3cf5ff',
          inactiveColor: '#d8dde7',
          activeShadow: '0 0 24px rgba(60,245,255,0.6), 0 0 36px rgba(255,0,180,0.35)',
          inactiveShadow: '0 0 12px rgba(0,0,0,0.8)',
          fontFamily: 'Montserrat, Arial, sans-serif',
          fontSize: '84px',
          letterSpacing: '0.02em',
          uppercase: true,
          displayMode: 'chunk' as const,
        },
      },
      narration: {
        hook: {
          fontFamily: 'Merriweather, "Times New Roman", serif',
          color: '#f0e6d2',
          shadow: '0 0 18px rgba(0,0,0,0.75)',
          background: 'linear-gradient(145deg, rgba(26,24,22,0.9), rgba(30,30,28,0.9))',
          border: '2px solid rgba(240,230,210,0.3)',
        },
        captions: {
          activeColor: '#f0e6d2',
          inactiveColor: '#b8b0a2',
          activeShadow: '0 0 12px rgba(0,0,0,0.8)',
          inactiveShadow: '0 0 10px rgba(0,0,0,0.65)',
          fontFamily: 'Merriweather, "Times New Roman", serif',
          fontSize: '72px',
          letterSpacing: '0.01em',
          uppercase: false,
          displayMode: 'single' as const,
        },
      },
      corporate: {
        hook: {
          fontFamily: 'Inter, Arial, sans-serif',
          color: '#7fd1ff',
          shadow: '0 0 18px rgba(0,0,0,0.65)',
          background: 'linear-gradient(145deg, rgba(10,18,30,0.9), rgba(14,20,32,0.9))',
          border: '2px solid rgba(127,209,255,0.25)',
        },
        captions: {
          activeColor: '#7fd1ff',
          inactiveColor: '#d6e4f0',
          activeShadow: '0 0 18px rgba(127,209,255,0.45)',
          inactiveShadow: '0 0 10px rgba(0,0,0,0.6)',
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '82px',
          letterSpacing: '0.01em',
          uppercase: false,
          displayMode: 'chunk' as const,
        },
      },
      horror: {
        hook: {
          fontFamily: 'Cormorant Garamond, "Times New Roman", serif',
          color: '#f7f1e3',
          shadow: '0 0 26px rgba(255,255,255,0.35), 0 0 48px rgba(200,0,0,0.45)',
          background: 'linear-gradient(145deg, rgba(8,8,8,0.92), rgba(18,12,12,0.92))',
          border: '2px solid rgba(200,0,0,0.35)',
        },
        captions: {
          activeColor: '#f7f1e3',
          inactiveColor: '#d9d2c8',
          activeShadow: '0 0 22px rgba(255,255,255,0.45), 0 0 38px rgba(200,0,0,0.45)',
          inactiveShadow: '0 0 12px rgba(0,0,0,0.8)',
          fontFamily: 'Cormorant Garamond, "Times New Roman", serif',
          fontSize: '84px',
          letterSpacing: '0.02em',
          uppercase: true,
          displayMode: 'chunk' as const,
        },
      },
      scifi: {
        hook: {
          fontFamily: 'Orbitron, Arial, sans-serif',
          color: '#7fffe1',
          shadow: '0 0 26px rgba(127,255,225,0.55), 0 0 48px rgba(80,180,255,0.4)',
          background: 'linear-gradient(145deg, rgba(6,14,26,0.9), rgba(10,20,36,0.9))',
          border: '2px solid rgba(127,255,225,0.3)',
        },
        captions: {
          activeColor: '#7fffe1',
          inactiveColor: '#d5e7ff',
          activeShadow: '0 0 22px rgba(127,255,225,0.55), 0 0 36px rgba(80,180,255,0.4)',
          inactiveShadow: '0 0 12px rgba(0,0,0,0.75)',
          fontFamily: 'Orbitron, Arial, sans-serif',
          fontSize: '84px',
          letterSpacing: '0.08em',
          uppercase: true,
          displayMode: 'chunk' as const,
        },
      },
    };

    return map[type] ?? map.dark;
  }, [type]);

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

      {/* Gradient Overlays for Readability */}
      <AbsoluteFill
        style={{
          background: theme.overlay,
        }}
      />

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
              fontFamily: theme.hook.fontFamily,
              fontWeight: 800,
              fontSize: '64px',
              letterSpacing: '0.035em',
              textTransform: 'uppercase',
              color: theme.hook.color,
              textAlign: 'center',
              textShadow: theme.hook.shadow,
              background: theme.hook.background,
              borderRadius: '20px',
              padding: '30px 42px',
              border: theme.hook.border,
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
        displayMode={theme.captions.displayMode}
        activeColor={theme.captions.activeColor}
        inactiveColor={theme.captions.inactiveColor}
        activeShadow={theme.captions.activeShadow}
        inactiveShadow={theme.captions.inactiveShadow}
        fontFamily={theme.captions.fontFamily}
        fontSize={theme.captions.fontSize}
        letterSpacing={theme.captions.letterSpacing}
        uppercase={theme.captions.uppercase}
        pauseThresholdMs={theme.captions.pauseThresholdMs}
        maxChunkSize={theme.captions.maxChunkSize}
      />

      {/* Audio */}
      <Audio src={audioUrl} />
    </AbsoluteFill>
  );
};

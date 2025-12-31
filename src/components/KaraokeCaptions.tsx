import React, { useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { WordTiming } from '../utils/processAlignment';

interface KaraokeCaptionsProps {
  words: WordTiming[];
  /**
   * single: show only the active word (default)
   * chunk: show the active chunk of words based on pauses/punctuation
   */
  displayMode?: 'single' | 'chunk';
  activeColor?: string;
  inactiveColor?: string;
  activeShadow?: string;
  inactiveShadow?: string;
  fontFamily?: string;
  fontSize?: string;
  letterSpacing?: string;
  uppercase?: boolean;
  pauseThresholdMs?: number;
  maxChunkSize?: number;
}

export const KaraokeCaptions: React.FC<KaraokeCaptionsProps> = ({
  words,
  displayMode = 'single',
  activeColor = '#e63946',
  inactiveColor = '#8c93a3',
  activeShadow = '0 0 24px rgba(230,57,70,0.55), 0 0 60px rgba(230,57,70,0.35)',
  inactiveShadow = '0 0 14px rgba(0,0,0,0.85)',
  fontFamily = 'Cinzel, "Times New Roman", serif',
  fontSize = '80px',
  letterSpacing = '0.04em',
  uppercase = true,
  pauseThresholdMs = 200,
  maxChunkSize = 7,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;
  const [fontHandle] = useState(() => delayRender('wait-for-fonts'));

  useEffect(() => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      continueRender(fontHandle);
    };

    const fontReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    const timeout = setTimeout(finish, 2000);

    fontReady?.then(finish).catch(finish);
    if (!fontReady) finish();

    return () => {
      clearTimeout(timeout);
      finish();
    };
  }, [fontHandle]);

  // Find the currently active word
  const activeWordIndex = words.findIndex(
    (word) => currentTimeMs >= word.startMs && currentTimeMs < word.endMs
  );

  // Bridge tiny gaps between words to avoid a blank frame during transitions
  const bridgedWordIndex = useMemo(() => {
    if (activeWordIndex >= 0) return activeWordIndex;
    if (!words.length) return -1;

    const gapTolerance = 120; // ms
    const nextIdx = words.findIndex(word => currentTimeMs < word.startMs);
    const prevIdx = nextIdx === -1 ? words.length - 1 : nextIdx - 1;

    const prevGap = prevIdx >= 0 ? currentTimeMs - words[prevIdx].endMs : Number.POSITIVE_INFINITY;
    const nextGap = nextIdx >= 0 ? words[nextIdx].startMs - currentTimeMs : Number.POSITIVE_INFINITY;

    if (prevGap >= 0 && prevGap <= gapTolerance) return prevIdx;
    if (nextGap >= 0 && nextGap <= gapTolerance) return nextIdx;

    return -1;
  }, [activeWordIndex, currentTimeMs, words]);

  const chunks = useMemo(() => {
    if (displayMode === 'single') return [];

    const chunksArray: number[][] = [];
    let currentChunk: number[] = [];

    for (let i = 0; i < words.length; i++) {
      currentChunk.push(i);

      const hasPunctuation = words[i].text.match(/[.,!?;:]$/);
      const nextWordPause = i < words.length - 1 ? words[i + 1].startMs - words[i].endMs : 0;
      const hasSignificantPause = nextWordPause > pauseThresholdMs;
      const isMaxSize = currentChunk.length >= maxChunkSize;
      const isLastWord = i === words.length - 1;

      if ((hasPunctuation && hasSignificantPause) || hasSignificantPause || isMaxSize || isLastWord) {
        chunksArray.push([...currentChunk]);
        currentChunk = [];
      }
    }

    return chunksArray;
  }, [displayMode, words]);

  const currentChunk = useMemo(() => {
    if (displayMode === 'single') return [];
    if (bridgedWordIndex < 0) return [];
    return chunks.find(chunk => chunk.includes(bridgedWordIndex)) || [];
  }, [chunks, bridgedWordIndex, displayMode]);

  const visibleWords = useMemo(() => {
    if (bridgedWordIndex < 0) return [];
    if (displayMode === 'chunk') {
      return currentChunk.map(idx => ({ word: words[idx], index: idx }));
    }
    return [{ word: words[bridgedWordIndex], index: bridgedWordIndex }];
  }, [bridgedWordIndex, currentChunk, displayMode, words]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 60px',
        // Keep overlay transparent so background video stays visible
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '18px',
          maxWidth: '900px',
          lineHeight: '1.4',
        }}
      >
        {visibleWords.map(({ word, index }) => {
          const isActive = index === bridgedWordIndex;
          const baseShadow = isActive ? activeShadow : inactiveShadow;
          const shadow = `${baseShadow}, 0 0 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)`;

          return (
            <span
              key={`${word.startMs}-${index}`}
              style={{
                fontFamily,
                fontWeight: '800',
                fontSize,
                letterSpacing,
                textTransform: uppercase ? 'uppercase' : 'none',
                color: isActive ? activeColor : inactiveColor,
                textShadow: shadow,
                transition: 'color 0.2s ease, text-shadow 0.2s ease',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

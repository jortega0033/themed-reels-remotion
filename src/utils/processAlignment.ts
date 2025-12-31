export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface WordTiming {
  text: string;
  startMs: number;
  endMs: number;
}

export function processAlignment(alignment: ElevenLabsAlignment): WordTiming[] {
  const words: WordTiming[] = [];
  let currentWord = '';
  let wordStartMs = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const startTime = alignment.character_start_times_seconds[i] * 1000;
    const endTime = alignment.character_end_times_seconds[i] * 1000;

    if (char === ' ' || char === '\n') {
      // End of word - push it to array
      if (currentWord) {
        words.push({
          text: currentWord,
          startMs: wordStartMs,
          endMs: alignment.character_end_times_seconds[i - 1] * 1000,
        });
        currentWord = '';
      }
    } else {
      // Start or continue word
      if (!currentWord) {
        wordStartMs = startTime;
      }
      currentWord += char;
    }
  }

  // Push the last word if there is one
  if (currentWord) {
    words.push({
      text: currentWord,
      startMs: wordStartMs,
      endMs:
        alignment.character_end_times_seconds[
          alignment.character_end_times_seconds.length - 1
        ] * 1000,
    });
  }

  return words;
}

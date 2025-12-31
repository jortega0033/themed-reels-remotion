import { Composition } from 'remotion';
import { DarkPsychReel, DarkPsychReelProps } from './DarkPsychReel';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<DarkPsychReelProps>
        id="DarkPsychReel"
        component={DarkPsychReel}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrls: [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          ],
          audioUrl:
            'https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg',
          elevenLabsAlignment: {
            characters: ['T', 'e', 's', 't', ' ', 'a', 'u', 'd', 'i', 'o', ' ', 'h', 'e', 'r', 'e'],
            character_start_times_seconds: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4],
            character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5],
          },
        }}
        calculateMetadata={({ props }) => {
          const fps = 30;
          // Get audio duration from alignment data (last character end time)
          const audioDurationSeconds =
            props.elevenLabsAlignment.character_end_times_seconds[
              props.elevenLabsAlignment.character_end_times_seconds.length - 1
            ];
          // Add 0.75s buffer for fade out effect
          const durationInFrames = Math.ceil((audioDurationSeconds + 0.75) * fps);

          return {
            durationInFrames,
            props,
          };
        }}
      />
    </>
  );
};

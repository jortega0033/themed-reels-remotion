# Dark Psych Reel - Remotion

[![Cloud Build](https://storage.googleapis.com/n8n-server-482722_cloudbuild/badges/6db232a0-4908-4436-9a28-345b6accee0c.svg)](https://console.cloud.google.com/cloud-build/builds?project=n8n-server-482722)

Programmatic video generation for 9:16 vertical reels with ElevenLabs karaoke captions.

## Features

- Dynamic multi-video backgrounds using Pexels videos
- ElevenLabs text-to-speech with character-level alignment
- Karaoke-style captions with word highlighting
- Automatic duration calculation from audio length
- 1080x1920 @ 30fps optimized for vertical social media

## Setup

```bash
npm install
npm start
```

## Usage

The composition accepts these props:

```typescript
{
  videoUrls: string[];           // Array of video URLs
  audioUrl: string;              // ElevenLabs generated audio
  elevenLabsAlignment: {         // Character timing from ElevenLabs API
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
  hookText: string;              // Top overlay text
}
```

## Rendering

```bash
npm run build
```

Output: `out/video.mp4`
# Auto-deploy test: Thu Jan  1 19:05:35 CET 2026

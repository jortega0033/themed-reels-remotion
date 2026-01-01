# Themed Reels - Remotion Video Renderer

[![Cloud Build](https://storage.googleapis.com/n8n-server-482722_cloudbuild/badges/6db232a0-4908-4436-9a28-345b6accee0c.svg)](https://console.cloud.google.com/cloud-build/builds?project=n8n-server-482722)

Programmatic video generation API for 9:16 vertical reels with karaoke-style captions. Built with [Remotion](https://remotion.dev/) and deployed on Google Cloud Run.

## Features

- 🎬 **Multi-layer video composition** - Stack videos, audio, and text layers
- 🎤 **Karaoke captions** - Word-by-word highlighting with ElevenLabs timing support
- ☁️ **Cloud-native** - Deployed on Cloud Run with GCS storage
- ⚡ **Async rendering** - Queue jobs and poll for completion
- 🔄 **Auto-deploy** - Push to `develop` branch triggers automatic deployment

---

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Open Remotion Studio
npm run studio
```

### Local Render

```bash
npm run build
# Output: out/video.mp4
```

---

## API Reference

### Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://render.urabes.com` |
| Cloud Run | `https://remotion-renderer-78322869962.us-central1.run.app` |

### Authentication

All render endpoints require a Bearer token:

```
Authorization: Bearer <RENDER_AUTH_TOKEN>
```

---

## Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{ "ok": true }
```

No authentication required.

---

### Async Render (Recommended)

Start a render job and get a job ID to poll for status.

```http
POST /render/async
Content-Type: application/json
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "jobId": "263c0fde-2bc1-49aa-8823-c928bc21e5bc",
  "status": "queued",
  "jobUrl": "/render/async/263c0fde-2bc1-49aa-8823-c928bc21e5bc",
  "downloadUrl": "/render/async/263c0fde-2bc1-49aa-8823-c928bc21e5bc?download=1"
}
```

---

### Get Job Status

```http
GET /render/async/:jobId
Authorization: Bearer <token>
```

**Response - Processing:**
```json
{
  "jobId": "263c0fde-2bc1-49aa-8823-c928bc21e5bc",
  "status": "processing",
  "createdAt": 1767289976970
}
```

**Response - Completed:**
```json
{
  "jobId": "263c0fde-2bc1-49aa-8823-c928bc21e5bc",
  "status": "completed",
  "createdAt": 1767289976970,
  "cloudUrl": "gs://bucket/renders/render-263c0fde.mp4",
  "signedUrl": "https://storage.googleapis.com/...",
  "downloadUrl": "/render/async/263c0fde-2bc1-49aa-8823-c928bc21e5bc?download=1"
}
```

**Response - Failed:**
```json
{
  "jobId": "263c0fde-2bc1-49aa-8823-c928bc21e5bc",
  "status": "failed",
  "createdAt": 1767289976970,
  "error": "Error message here"
}
```

---

### Download Video

Add `?download=1` to redirect to the signed URL:

```http
GET /render/async/:jobId?download=1
Authorization: Bearer <token>
```

Or use `Accept: video/*` header.

---

### Sync Render (Blocking)

Blocks until render completes, then streams the video file.

```http
POST /render
Content-Type: application/json
Authorization: Bearer <token>
```

**Response:** Binary video file (`video/mp4`)

> ⚠️ Not recommended for production. Use async render instead.

---

## Render Payload Schema

The render payload defines the video composition with config, assets, and timeline layers.

### Structure

```typescript
{
  config: {
    width: number,         // Video width (e.g., 1080)
    height: number,        // Video height (e.g., 1920)
    fps: number,           // Frames per second (e.g., 30)
    durationInFrames: number,  // Total duration in frames
    webhookUrl?: string    // Optional webhook for completion notification
  },
  assets: {
    [assetId: string]: string  // Map of asset IDs to URLs
  },
  timeline: Layer[]        // Array of layers (see below)
}
```

### Layer Types

#### Video Layer

```json
{
  "id": "background_video",
  "type": "Video",
  "startFrame": 0,
  "durationInFrames": 768,
  "props": {
    "src": "video_clip_1",
    "muted": true,
    "style": {
      "objectFit": "cover"
    }
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `src` | string | ✅ | Asset ID from `assets` map |
| `muted` | boolean | ❌ | Mute video audio (default: false) |
| `style` | object | ❌ | CSS styles (objectFit, etc.) |

#### Audio Layer

```json
{
  "id": "voiceover",
  "type": "Audio",
  "startFrame": 0,
  "durationInFrames": 768,
  "props": {
    "src": "voice_track_1",
    "volume": 1,
    "fadeDuration": 24
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `src` | string | ✅ | Asset ID from `assets` map |
| `volume` | number | ❌ | Volume 0-1 (default: 1) |
| `fadeDuration` | number | ❌ | Fade in/out duration in frames |

#### KaraokeText Layer

```json
{
  "id": "captions",
  "type": "KaraokeText",
  "startFrame": 0,
  "durationInFrames": 768,
  "props": {
    "text": "Hello world this is a test",
    "style": {
      "fontSize": 72,
      "fontFamily": "Arial",
      "color": "#ffffff",
      "textAlign": "center",
      "textShadow": "0 2px 4px rgba(0,0,0,0.5)"
    },
    "highlightColor": "#ffea00",
    "opacity": 0.9,
    "layout": {
      "verticalAlign": "center",
      "padding": "48px"
    },
    "chunking": {
      "maxWords": 7,
      "pauseMs": 350,
      "enabled": true
    },
    "timings": [
      { "word": "Hello", "start": 0.0, "end": 0.4 },
      { "word": "world", "start": 0.4, "end": 0.8 },
      { "word": "this", "start": 0.9, "end": 1.1 },
      { "word": "is", "start": 1.1, "end": 1.3 },
      { "word": "a", "start": 1.3, "end": 1.4 },
      { "word": "test", "start": 1.4, "end": 1.8 }
    ]
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | string | ✅ | Full caption text |
| `style` | object | ❌ | CSS text styles |
| `highlightColor` | string | ❌ | Active word color |
| `opacity` | number | ❌ | Text opacity 0-1 (default: 1) |
| `layout.verticalAlign` | string | ❌ | `"top"`, `"center"`, or `"bottom"` |
| `layout.padding` | string/number | ❌ | Padding around text |
| `chunking.maxWords` | number | ❌ | Max words per chunk (default: 7) |
| `chunking.pauseMs` | number | ❌ | Pause threshold for new chunk (default: 350) |
| `chunking.enabled` | boolean | ❌ | Enable chunking (default: true) |
| `timings` | array | ❌ | Word-level timing data |

---

## Full Example

```json
{
  "config": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "durationInFrames": 768
  },
  "assets": {
    "bg_video": "https://example.com/background.mp4",
    "voiceover": "https://example.com/audio.mp3"
  },
  "timeline": [
    {
      "id": "video_bg",
      "type": "Video",
      "startFrame": 0,
      "durationInFrames": 768,
      "props": {
        "src": "bg_video",
        "muted": true,
        "style": { "objectFit": "cover" }
      }
    },
    {
      "id": "audio_voice",
      "type": "Audio",
      "startFrame": 0,
      "durationInFrames": 768,
      "props": {
        "src": "voiceover",
        "volume": 1,
        "fadeDuration": 15
      }
    },
    {
      "id": "karaoke_captions",
      "type": "KaraokeText",
      "startFrame": 0,
      "durationInFrames": 768,
      "props": {
        "text": "Welcome to our channel",
        "style": {
          "fontSize": 64,
          "fontFamily": "Inter, sans-serif",
          "color": "#ffffff",
          "textAlign": "center",
          "fontWeight": "bold"
        },
        "highlightColor": "#ffd700",
        "layout": {
          "verticalAlign": "center",
          "padding": "60px"
        },
        "timings": [
          { "word": "Welcome", "start": 0.0, "end": 0.5 },
          { "word": "to", "start": 0.5, "end": 0.7 },
          { "word": "our", "start": 0.7, "end": 0.9 },
          { "word": "channel", "start": 0.9, "end": 1.4 }
        ]
      }
    }
  ]
}
```

---

## cURL Examples

### Start Async Render

```bash
curl -X POST "https://render.urabes.com/render/async" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "config": {
      "width": 1080,
      "height": 1920,
      "fps": 30,
      "durationInFrames": 300
    },
    "assets": {
      "video": "https://example.com/video.mp4",
      "audio": "https://example.com/audio.mp3"
    },
    "timeline": [
      {
        "id": "bg",
        "type": "Video",
        "startFrame": 0,
        "durationInFrames": 300,
        "props": { "src": "video", "muted": true }
      },
      {
        "id": "voice",
        "type": "Audio",
        "startFrame": 0,
        "durationInFrames": 300,
        "props": { "src": "audio" }
      }
    ]
  }'
```

### Check Job Status

```bash
curl "https://render.urabes.com/render/async/YOUR_JOB_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Download Completed Video

```bash
curl -L "https://render.urabes.com/render/async/YOUR_JOB_ID?download=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o video.mp4
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid payload / validation error |
| 401 | Missing or invalid auth token |
| 404 | Job not found |
| 500 | Render failed (check error message) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | ❌ | Server port (default: 8080) |
| `RENDER_AUTH_TOKEN` | ❌ | Bearer token for auth |
| `GCS_BUCKET` | ❌ | GCS bucket for uploads |
| `GCS_PREFIX` | ❌ | Path prefix in bucket (default: "renders") |
| `GCS_SIGNED_URL_TTL_SECONDS` | ❌ | Signed URL expiry (default: 3600) |
| `CHROME_EXECUTABLE` | ❌ | Chromium path (default: /usr/bin/chromium) |
| `TMP_DIR` | ❌ | Temp directory (default: /tmp) |

---

## Deployment

### Auto-Deploy (CI/CD)

Push to `develop` branch triggers automatic deployment via Cloud Build:

```bash
git checkout develop
git add .
git commit -m "feat: your changes"
git push origin develop
```

Build progress: [Cloud Build Console](https://console.cloud.google.com/cloud-build/builds?project=n8n-server-482722)

### Manual Deploy

```bash
# Build and push Docker image
gcloud builds submit --tag gcr.io/n8n-server-482722/remotion-renderer

# Deploy to Cloud Run
gcloud run deploy remotion-renderer \
  --image gcr.io/n8n-server-482722/remotion-renderer \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 600 \
  --allow-unauthenticated
```

---

## Project Structure

```
├── src/
│   ├── index.ts              # Remotion entry point
│   ├── Root.tsx              # Root composition
│   ├── components/
│   │   ├── MasterComposition.tsx   # Main composition
│   │   ├── KaraokeCaptions.tsx     # Karaoke component
│   │   └── layers/
│   │       ├── VideoLayer.tsx
│   │       ├── AudioLayer.tsx
│   │       └── KaraokeText.tsx
│   ├── types/
│   │   └── schema.ts         # Zod schemas & types
│   └── utils/
│       ├── karaoke.ts        # Karaoke utilities
│       └── processAlignment.ts
├── server.js                 # Express API server
├── Dockerfile                # Container definition
├── cloudbuild.yaml           # CI/CD config
└── test-render.json          # Example payload
```

---

## License

Private repository - All rights reserved.

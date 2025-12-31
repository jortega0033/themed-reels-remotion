# Remotion Cloud Run Deployment Plan

## Overview
Build Express.js API server that wraps Remotion and deploys to Google Cloud Run for automated video rendering from n8n.

---

## Phase 1: Express Server Setup

### 1.1 Install Dependencies
```bash
npm install express @remotion/renderer @google-cloud/storage dotenv cors
npm install --save-dev @types/express @types/node
```

### 1.2 Create Express Server (`server/index.ts`)
- POST `/render` endpoint
- Accept JSON: `{ videoUrls, audioUrl, elevenLabsAlignment, hookText }`
- Call `renderMedia()` from `@remotion/renderer`
- Handle errors and timeouts
- Health check endpoint: GET `/health`

### 1.3 Create GCS Upload Utility (`server/uploadToGCS.ts`)
- Initialize GCS client with credentials
- Upload file to bucket
- Make file publicly accessible
- Return public URL
- Handle errors

### 1.4 Environment Variables (`.env`)
```
PORT=8080
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

---

## Phase 2: Google Cloud Setup

### 2.1 Create GCS Bucket
```bash
gcloud storage buckets create gs://your-remotion-videos \
  --location=us-central1 \
  --uniform-bucket-level-access
```

### 2.2 Create Service Account
```bash
gcloud iam service-accounts create remotion-renderer \
  --display-name="Remotion Video Renderer"
```

### 2.3 Grant Storage Permissions
```bash
gcloud storage buckets add-iam-policy-binding gs://your-remotion-videos \
  --member="serviceAccount:remotion-renderer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### 2.4 Download Service Account Key
```bash
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=remotion-renderer@PROJECT_ID.iam.gserviceaccount.com
```

---

## Phase 3: Dockerization

### 3.1 Create Dockerfile
- Use Node 18+ base image
- Install Chromium dependencies
- Copy package files and install deps
- Build TypeScript
- Copy Remotion source files
- Expose port 8080
- Start Express server

### 3.2 Create .dockerignore
```
node_modules
out
dist
*.mp4
*.md
.env
service-account-key.json
```

### 3.3 Test Docker Build Locally
```bash
docker build -t remotion-renderer .
docker run -p 8080:8080 --env-file .env remotion-renderer
```

---

## Phase 4: Cloud Run Deployment

### 4.1 Build and Push to Artifact Registry
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/remotion-renderer
```

### 4.2 Deploy to Cloud Run
```bash
gcloud run deploy remotion-renderer \
  --image gcr.io/PROJECT_ID/remotion-renderer \
  --platform managed \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 600 \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET_NAME=your-remotion-videos
```

### 4.3 Attach Service Account
```bash
gcloud run services update remotion-renderer \
  --service-account=remotion-renderer@PROJECT_ID.iam.gserviceaccount.com
```

---

## Phase 5: n8n Integration

### 5.1 Get Cloud Run URL
```bash
gcloud run services describe remotion-renderer --format='value(status.url)'
```

### 5.2 Update n8n HTTP Request Node
- URL: `https://your-service-url.run.app/render`
- Method: POST
- Body: JSON with all props
- Timeout: 10 minutes

### 5.3 Test End-to-End
- Trigger n8n workflow
- Verify video renders
- Check video uploaded to GCS
- Confirm URL returned to n8n

---

## Phase 6: Optimizations (Optional)

### 6.1 Add Caching
- Cache rendered videos if same inputs
- Use Redis or Cloud Memorystore

### 6.2 Progress Webhooks
- Send progress updates to n8n
- Use Cloud Pub/Sub or webhook callbacks

### 6.3 Monitoring
- Add Cloud Logging
- Set up alerts for failures
- Track render times

---

## Files to Create

1. `server/index.ts` - Express server
2. `server/uploadToGCS.ts` - GCS upload utility
3. `Dockerfile` - Container definition
4. `.dockerignore` - Docker ignore file
5. `.env.example` - Environment template

---

## Estimated Time
- Phase 1: 1-2 hours
- Phase 2: 30 minutes
- Phase 3: 1 hour
- Phase 4: 30 minutes
- Phase 5: 30 minutes
- **Total: ~4-5 hours**

---

## Key Considerations

- **Memory**: Videos need 4GB+ RAM for rendering
- **Timeout**: Set Cloud Run timeout to 10 minutes
- **Cold Starts**: First request takes 30-60s (Chromium startup)
- **Cost**: ~$0.50-2 per video render (varies by duration)
- **Concurrency**: Limit to 1-2 concurrent renders per instance

---

## Testing Checklist

- [ ] Local Express server responds to POST /render
- [ ] Remotion renders video from API call
- [ ] GCS upload works
- [ ] Docker container builds successfully
- [ ] Docker runs locally
- [ ] Cloud Run deployment succeeds
- [ ] Service account has correct permissions
- [ ] n8n can trigger renders
- [ ] Videos are publicly accessible

---

## Useful Commands

```bash
# Test locally
npm run dev

# Build Docker
docker build -t remotion-renderer .

# View Cloud Run logs
gcloud run logs read remotion-renderer

# Update service
gcloud run deploy remotion-renderer --image gcr.io/PROJECT_ID/remotion-renderer

# Delete service
gcloud run services delete remotion-renderer
```

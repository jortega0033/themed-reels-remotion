const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const express = require("express");
const { getCompositions, renderMedia } = require("@remotion/renderer");
const { Storage } = require("@google-cloud/storage");
const { z } = require("zod");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8080;
const COMPOSITION_ID = "MasterComposition";
const TMP_DIR = process.env.TMP_DIR || "/tmp";
const GCS_BUCKET = process.env.GCS_BUCKET;
const GCS_PREFIX = process.env.GCS_PREFIX || "renders";
const GCS_SIGNED_URL_TTL_SECONDS = Number(
  process.env.GCS_SIGNED_URL_TTL_SECONDS || 3600
);
const AUTH_TOKEN = process.env.RENDER_AUTH_TOKEN || process.env.AUTH_TOKEN;
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 5000); // 5 seconds

const storage = GCS_BUCKET ? new Storage() : null;

// Job timeout should be <= Cloud Run request timeout.
// Default to 50 minutes to leave buffer for upload/webhook.
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS || 50 * 60 * 1000);

// Utility: wrap a promise with a timeout
const withTimeout = (promise, ms, message = "Operation timed out") =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);

// Optional shared-secret auth. Skip if no token configured.
const requireAuth = (req, res, next) => {
  if (!AUTH_TOKEN) return next();
  const authHeader = req.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  if (token === AUTH_TOKEN) return next();
  return res.status(401).json({ error: "Unauthorized" });
};

// For public download URLs: allow GET status/result without auth.
// Keep POST endpoints protected to prevent abuse.
const allowUnauthenticatedGet = (req, res, next) => {
  if (req.method === "GET") return next();
  return requireAuth(req, res, next);
};

// Use pre-built bundle from Docker build (see Dockerfile)
const BUNDLE_DIR = path.join(process.cwd(), "bundle");
const getServeUrl = () => BUNDLE_DIR;

// Path to Chrome Headless Shell downloaded by 'npx remotion browser ensure'
const CHROME_EXECUTABLE = path.join(
  process.cwd(),
  "node_modules",
  ".remotion",
  "chrome-headless-shell",
  "linux64",
  "chrome-headless-shell-linux64",
  "chrome-headless-shell"
);

const styleSchema = z.record(z.string(), z.unknown());

const wordTimingSchema = z
  .object({
    word: z.string().min(1),
    start: z.number().nonnegative(),
    end: z.number().positive(),
  })
  .refine((value) => value.end > value.start, {
    message: "word end must be after start",
  });

const baseLayerSchema = z.object({
  id: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
});

const renderSpecObjectSchema = z.object({
  config: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
    durationInFrames: z.number().int().positive(),
    webhookUrl: z.string().url().optional(),
  }),
  assets: z.record(z.string(), z.string().min(1)),
  timeline: z.array(
    z.discriminatedUnion("type", [
      baseLayerSchema.extend({
        type: z.literal("Video"),
        props: z.object({
          src: z.string().min(1),
          muted: z.boolean().optional(),
          loop: z.boolean().optional(),
          style: styleSchema.optional(),
        }),
      }),
      baseLayerSchema.extend({
        type: z.literal("Audio"),
        props: z.object({
          src: z.string().min(1),
          volume: z.number().min(0).max(1).optional(),
          fadeDuration: z.number().int().nonnegative().optional(),
        }),
      }),
      baseLayerSchema.extend({
        type: z.literal("KaraokeText"),
        props: z.object({
          text: z.string().min(1),
          style: styleSchema.optional(),
          timings: z.array(wordTimingSchema).nonempty().optional(),
          opacity: z.number().min(0).max(1).optional(),
          layout: z
            .object({
              verticalAlign: z.enum(["top", "center", "bottom"]).optional(),
              padding: z.union([z.number().nonnegative(), z.string()]).optional(),
            })
            .optional(),
          chunking: z
            .object({
              maxWords: z.number().int().positive().optional(),
              pauseMs: z.number().nonnegative().optional(),
              enabled: z.boolean().optional(),
            })
            .optional(),
          highlightColor: z.string().optional(),
        }),
      }),
      baseLayerSchema.extend({
        type: z.literal("Shape"),
        props: z.object({
          style: styleSchema.optional(),
        }),
      }),
    ])
  ),
});

const renderSpecInputSchema = z.union([
  renderSpecObjectSchema,
  z.array(renderSpecObjectSchema).min(1),
]);

const normalizeSpecInput = (inputProps) => {
  const parsed = renderSpecInputSchema.safeParse(inputProps);
  if (!parsed.success) return null;
  return Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
};

const validatePayload = (body) => {
  const parsed = renderSpecInputSchema.safeParse(body);
  if (parsed.success) return null;
  return parsed.error.toString();
};

const renderJob = async (jobId, inputProps) => {
  const normalized = normalizeSpecInput(inputProps);
  if (!normalized) throw new Error("Invalid render spec");

  // Verify browser binary exists (silent check)
  try {
    const stats = fs.statSync(CHROME_EXECUTABLE);
    if (!(stats.mode & 0o111)) fs.chmodSync(CHROME_EXECUTABLE, 0o755);
  } catch (err) {
    console.error(`[${jobId}] Chrome binary not found at ${CHROME_EXECUTABLE}`);
    throw new Error(`Chrome binary not found at ${CHROME_EXECUTABLE}`);
  }
  const serveUrl = getServeUrl();
  
  // Don't wrap getCompositions in withTimeout - let it use its internal timeout
  // which is already set to 300000ms (5 minutes) for asset loading
  const comps = await getCompositions(serveUrl, {
    inputProps: normalized,
    timeoutInMilliseconds: 300000, // 5 min for loading external assets
    browserExecutable: CHROME_EXECUTABLE,
    chromiumOptions: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-dbus",
      ],
    },
  });
  
  const composition = comps.find((c) => c.id === COMPOSITION_ID);
  if (!composition) throw new Error(`Composition ${COMPOSITION_ID} not found`);

  const outputLocation = path.join(TMP_DIR, `render-${jobId}.mp4`);
  console.log(`[${jobId}] Output location: ${outputLocation}`);

  console.log(`[${jobId}] === STARTING RENDER ===`);
  console.log(`[${jobId}] Estimated duration: ${(composition.durationInFrames / composition.fps).toFixed(2)}s video`);
  console.log(`[${jobId}] Total frames to render: ${composition.durationInFrames}`);
  
  const renderStartTime = Date.now();

  await renderMedia({
    serveUrl,
    composition,
    inputProps: normalized,
    codec: "h264",
    outputLocation,
    browserExecutable: CHROME_EXECUTABLE,
    chromiumOptions: {
      disableWebSecurity: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-dbus",
      ],
    },
    envVariables: {},
    logLevel: "info",
    timeoutInMilliseconds: 48 * 60 * 1000, // 48 minutes for render, leaves buffer
    onProgress: ({ renderedFrames, encodedFrames, stitchStage }) => {
      const total = composition.durationInFrames;
      const elapsedMs = Date.now() - renderStartTime;
      const elapsedSec = Math.round(elapsedMs / 1000);
      const progress = Math.round(renderedFrames/total*100);
      const fps = renderedFrames / (elapsedMs / 1000);
      
      if (renderedFrames % 30 === 0 || renderedFrames === total) {
        console.log(`[${jobId}] Progress: ${renderedFrames}/${total} frames (${progress}%) | Encoded: ${encodedFrames} | Stage: ${stitchStage} | Elapsed: ${elapsedSec}s | Speed: ${fps.toFixed(1)} fps`);
      }
    },
  });

  const renderDuration = ((Date.now() - renderStartTime) / 1000).toFixed(1);
  const fileSize = fs.statSync(outputLocation).size;
  console.log(`[${jobId}] === RENDER COMPLETE ===`);
  console.log(`[${jobId}] Render time: ${renderDuration}s`);
  console.log(`[${jobId}] Output file: ${outputLocation}`);
  console.log(`[${jobId}] File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[${jobId}] Average speed: ${(composition.durationInFrames / renderDuration).toFixed(1)} fps`);

  return outputLocation;
};

const uploadToGcs = async (localPath) => {
  if (!storage || !GCS_BUCKET) {
    console.log('GCS not configured, skipping upload');
    return {};
  }

  console.log(`=== GCS UPLOAD START ===`);
  console.log(`Local file: ${localPath}`);
  const prefix = GCS_PREFIX.replace(/\/+$/, "");
  const destination = prefix
    ? path.posix.join(prefix, path.basename(localPath))
    : path.basename(localPath);
  console.log(`Destination: gs://${GCS_BUCKET}/${destination}`);

  const fileStats = fs.statSync(localPath);
  const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
  console.log(`File size: ${fileSizeMB} MB`);
  
  const uploadStartTime = Date.now();
  const useResumable = fileStats.size > 5 * 1024 * 1024;
  console.log(`Upload mode: ${useResumable ? 'resumable' : 'simple'}`);

  await storage.bucket(GCS_BUCKET).upload(localPath, {
    destination,
    contentType: "video/mp4",
    resumable: useResumable, // Use resumable for files > 5MB
  });

  const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
  const uploadSpeed = (fileStats.size / 1024 / 1024 / uploadDuration).toFixed(2);
  console.log(`GCS upload complete in ${uploadDuration}s (${uploadSpeed} MB/s)`);
  console.log(`=== GCS UPLOAD COMPLETE ===`);

  const cloudUrl = `gs://${GCS_BUCKET}/${destination}`;
  const publicUrl = `https://storage.googleapis.com/${encodeURIComponent(
    GCS_BUCKET
  )}/${destination.split("/").map(encodeURIComponent).join("/")}`;

  // Signed URLs are preferred (private bucket), but require iam.serviceAccounts.signBlob.
  // If signing fails, still return the GCS URL so callers can fetch it if the bucket is public
  // or if they have credentials.
  let signedUrl;
  try {
    console.log('Generating signed URL...');
    [signedUrl] = await storage
      .bucket(GCS_BUCKET)
      .file(destination)
      .getSignedUrl({
        action: "read",
        expires: Date.now() + GCS_SIGNED_URL_TTL_SECONDS * 1000,
      });
    console.log('Signed URL generated successfully');
  } catch (err) {
    console.error("GCS signed URL generation failed:", err.message);
  }

  return { cloudUrl, signedUrl, publicUrl };
};

const sendWebhook = async (webhookUrl, payload) => {
  if (!webhookUrl) return;
  
  console.log('=== WEBHOOK NOTIFICATION ===');
  console.log(`URL: ${webhookUrl}`);
  console.log(`Payload:`, JSON.stringify({ jobId: payload.jobId, status: payload.status }, null, 2));
  
  try {
    const webhookStartTime = Date.now();
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const webhookDuration = Date.now() - webhookStartTime;
    
    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText} (${webhookDuration}ms)`);
      const responseText = await response.text().catch(() => 'Unable to read response');
      console.error('Response:', responseText);
    } else {
      console.log(`Webhook delivered successfully in ${webhookDuration}ms`);
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
  }
  console.log('=== WEBHOOK END ===');
};

// Simple in-memory job store (per-instance). For production, back with a DB or queue.
const jobs = new Map();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const startJob = async (jobId, inputProps, retryCount = 0) => {
  const createdAt = Date.now();
  const normalized = normalizeSpecInput(inputProps);
  const webhookUrl = normalized?.config?.webhookUrl;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${jobId}] JOB STARTED`);
  console.log(`[${jobId}] Timestamp: ${new Date(createdAt).toISOString()}`);
  console.log(`[${jobId}] Timeout: ${JOB_TIMEOUT_MS/1000}s (${Math.round(JOB_TIMEOUT_MS/60000)} minutes)`);
  console.log(`[${jobId}] Webhook: ${webhookUrl || 'none'}`);
  console.log(`[${jobId}] Retry attempt: ${retryCount + 1}/${MAX_RETRIES + 1}`);
  console.log(`${'='.repeat(80)}\n`);
  
  jobs.set(jobId, { status: "processing", createdAt, retryCount });
  
  try {
    console.log(`[${jobId}] Starting render job...`);
    const output = await withTimeout(
      renderJob(jobId, inputProps),
      JOB_TIMEOUT_MS,
      `Job timed out after ${JOB_TIMEOUT_MS / 1000} seconds`
    );
    
    console.log(`[${jobId}] Render job completed successfully`);
    
    let cloudUrl;
    let signedUrl;
    let publicUrl;

    try {
      console.log(`[${jobId}] Starting GCS upload...`);
      const uploadResult = await uploadToGcs(output);
      cloudUrl = uploadResult.cloudUrl;
      signedUrl = uploadResult.signedUrl;
      publicUrl = uploadResult.publicUrl;
      
      console.log(`[${jobId}] === GCS UPLOAD RESULT ===`);
      console.log(`[${jobId}] Cloud URL: ${cloudUrl || 'none'}`);
      console.log(`[${jobId}] Signed URL: ${signedUrl ? 'generated' : 'none'}`);
      console.log(`[${jobId}] Public URL: ${publicUrl || 'none'}`);

      // If upload succeeded (cloudUrl exists), we can delete local output even if signing failed.
      if (cloudUrl) {
        console.log(`[${jobId}] Cleaning up local file: ${output}`);
        fs.rm(output, { force: true }, (err) => {
          if (err) console.error(`[${jobId}] Error deleting local file:`, err);
          else console.log(`[${jobId}] Local file deleted`);
        });
      }
    } catch (uploadErr) {
      console.error(`[${jobId}] === GCS UPLOAD FAILED ===`);
      console.error(`[${jobId}] Error:`, uploadErr.message);
      console.error(`[${jobId}] Stack:`, uploadErr.stack);
    }

    const jobData = {
      status: "completed",
      output: cloudUrl ? null : output,
      cloudUrl,
      signedUrl,
      publicUrl,
      createdAt,
    };
    
    jobs.set(jobId, jobData);
    
    const totalDuration = ((Date.now() - createdAt) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${jobId}] JOB COMPLETED SUCCESSFULLY`);
    console.log(`[${jobId}] Total duration: ${totalDuration}s (${(totalDuration/60).toFixed(1)} minutes)`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Send webhook notification on success
    if (webhookUrl) {
      await sendWebhook(webhookUrl, {
        jobId,
        status: "completed",
        cloudUrl,
        signedUrl,
        publicUrl,
        createdAt,
        completedAt: Date.now(),
        durationSeconds: Math.round((Date.now() - createdAt) / 1000),
        retryCount,
      });
    }
  } catch (err) {
    const totalDuration = ((Date.now() - createdAt) / 1000).toFixed(1);
    console.error(`\n${'='.repeat(80)}`);
    console.error(`[${jobId}] JOB FAILED`);
    console.error(`[${jobId}] Duration before failure: ${totalDuration}s`);
    console.error(`[${jobId}] Error: ${err.message}`);
    console.error(`[${jobId}] Stack:`, err.stack);
    
    // Check if we should retry
    if (retryCount < MAX_RETRIES) {
      const nextRetry = retryCount + 1;
      const backoffDelay = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
      
      console.warn(`[${jobId}] RETRYING (${nextRetry}/${MAX_RETRIES}) after ${backoffDelay}ms`);
      console.error(`${'='.repeat(80)}\n`);
      
      jobs.set(jobId, { 
        status: "retrying", 
        error: String(err), 
        createdAt, 
        retryCount: nextRetry,
        nextRetryAt: Date.now() + backoffDelay,
      });
      
      // Wait with exponential backoff before retrying
      await delay(backoffDelay);
      
      // Retry the job
      return startJob(jobId, inputProps, nextRetry);
    }
    
    // Max retries reached, mark as permanently failed
    console.error(`[${jobId}] MAX RETRIES REACHED (${MAX_RETRIES}), marking as permanently failed`);
    console.error(`${'='.repeat(80)}\n`);
    
    const jobData = { 
      status: "failed", 
      error: String(err), 
      createdAt, 
      retryCount,
      finalError: true,
    };
    jobs.set(jobId, jobData);
    
    // Send webhook notification on final failure only
    if (webhookUrl) {
      await sendWebhook(webhookUrl, {
        jobId,
        status: "failed",
        error: String(err),
        errorMessage: err.message,
        createdAt,
        failedAt: Date.now(),
        durationSeconds: Math.round((Date.now() - createdAt) / 1000),
        retryCount,
        retriesExhausted: true,
        maxRetries: MAX_RETRIES,
      });
    }
  }
};

const respondWithJob = (req, res, jobId, { forceDownload = false } = {}) => {
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const wantsDownload =
    forceDownload ||
    ["1", "true"].includes(String(req.query.download || "").toLowerCase()) ||
    (req.get("accept") || "").includes("video");

  if (job.status === "completed" && wantsDownload) {
    if (job.signedUrl) return res.redirect(job.signedUrl);
    if (job.publicUrl) return res.redirect(job.publicUrl);
    if (job.output) {
      return res.download(job.output, "video.mp4", (err) => {
        fs.rm(job.output, { force: true }, () => {});
        jobs.delete(jobId);
        if (err) console.error("Error sending file", err);
      });
    }
  }

  return res.json({
    jobId,
    status: job.status,
    createdAt: job.createdAt,
    error: job.error,
    cloudUrl: job.cloudUrl,
    signedUrl: job.signedUrl,
    publicUrl: job.publicUrl,
    retryCount: job.retryCount,
    nextRetryAt: job.nextRetryAt,
    retriesExhausted: job.finalError,
  });
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Synchronous render: blocks until done, streams file back.
app.post("/render", requireAuth, async (req, res) => {
  const jobId = randomUUID();
  console.log(`\n[${jobId}] === SYNC RENDER REQUEST ===`);
  
  const validationError = validatePayload(req.body);
  if (validationError) {
    console.error(`[${jobId}] Validation failed`);
    return res.status(400).json({ error: validationError });
  }

  try {
    const outputLocation = await renderJob(jobId, req.body);
    console.log(`[${jobId}] Sending file to client...`);
    res.download(outputLocation, "video.mp4", (err) => {
      fs.rm(outputLocation, { force: true }, () => {});
      if (err) console.error(`[${jobId}] Error sending file:`, err);
      else console.log(`[${jobId}] File sent successfully`);
    });
  } catch (err) {
    console.error(`[${jobId}] Render failed:`, err);
    res.status(500).json({ error: "Render failed", details: String(err) });
  }
});

// Async render: returns jobId immediately; poll status and fetch result.
app.post("/render/async", requireAuth, async (req, res) => {
  const jobId = randomUUID();
  console.log(`\n[${jobId}] === ASYNC RENDER REQUEST ===`);
  
  const validationError = validatePayload(req.body);
  if (validationError) {
    console.error(`[${jobId}] Validation failed`);
    return res.status(400).json({ error: validationError });
  }

  jobs.set(jobId, { status: "queued", createdAt: Date.now() });
  console.log(`[${jobId}] Job queued, starting async processing...`);

  startJob(jobId, req.body);

  res.json({
    jobId,
    status: "queued",
    jobUrl: `/render/async/${jobId}`,
  });
});

app.get("/render/async/:jobId", allowUnauthenticatedGet, (req, res) =>
  respondWithJob(req, res, req.params.jobId)
);

// Backwards compatibility routes (delegating to combined handler)
app.get("/render/status/:jobId", allowUnauthenticatedGet, (req, res) =>
  respondWithJob(req, res, req.params.jobId)
);
app.get("/render/result/:jobId", allowUnauthenticatedGet, (req, res) =>
  respondWithJob(req, res, req.params.jobId, { forceDownload: true })
);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(80)}`);
    console.log('REMOTION RENDER SERVER STARTED');
    console.log(`${'='.repeat(80)}`);
    console.log(`Port: ${PORT}`);
    console.log(`Bundle: ${BUNDLE_DIR}`);
    console.log(`Chrome: ${CHROME_EXECUTABLE}`);
    console.log(`TMP dir: ${TMP_DIR}`);
    console.log(`Job timeout: ${JOB_TIMEOUT_MS/1000}s (${Math.round(JOB_TIMEOUT_MS/60000)} minutes)`);
    console.log(`Max retries: ${MAX_RETRIES}`);
    console.log(`Retry delay: ${RETRY_DELAY_MS}ms (with exponential backoff)`);
    console.log(`GCS Bucket: ${GCS_BUCKET || 'NOT SET'}`);
    console.log(`GCS Prefix: ${GCS_PREFIX}`);
    console.log(`GCS configured: ${storage ? 'YES' : 'NO'}`);
    console.log(`Auth token: ${AUTH_TOKEN ? 'CONFIGURED' : 'NOT SET'}`);
    console.log(`${'='.repeat(80)}\n`);
  });
}

module.exports = app;

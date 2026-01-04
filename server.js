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

const storage = GCS_BUCKET ? new Storage() : null;

// Job timeout should be <= Cloud Run request timeout.
// Default to 55 minutes to stay under the 60-minute max.
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS || 55 * 60 * 1000);

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
  
  const comps = await withTimeout(
    getCompositions(serveUrl, {
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
    }),
    15 * 60 * 1000,
    "getCompositions timed out after 900s"
  );
  
  const composition = comps.find((c) => c.id === COMPOSITION_ID);
  if (!composition) throw new Error(`Composition ${COMPOSITION_ID} not found`);

  const outputLocation = path.join(TMP_DIR, `render-${jobId}.mp4`);

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
    timeoutInMilliseconds: 55 * 60 * 1000,
  });

  return outputLocation;
};

const uploadToGcs = async (localPath) => {
  if (!storage || !GCS_BUCKET) return {};

  const prefix = GCS_PREFIX.replace(/\/+$/, "");
  const destination = prefix
    ? path.posix.join(prefix, path.basename(localPath))
    : path.basename(localPath);

  await storage.bucket(GCS_BUCKET).upload(localPath, {
    destination,
    contentType: "video/mp4",
    resumable: false,
  });

  const cloudUrl = `gs://${GCS_BUCKET}/${destination}`;
  const publicUrl = `https://storage.googleapis.com/${encodeURIComponent(
    GCS_BUCKET
  )}/${destination.split("/").map(encodeURIComponent).join("/")}`;

  // Signed URLs are preferred (private bucket), but require iam.serviceAccounts.signBlob.
  // If signing fails, still return the GCS URL so callers can fetch it if the bucket is public
  // or if they have credentials.
  let signedUrl;
  try {
    [signedUrl] = await storage
      .bucket(GCS_BUCKET)
      .file(destination)
      .getSignedUrl({
        action: "read",
        expires: Date.now() + GCS_SIGNED_URL_TTL_SECONDS * 1000,
      });
  } catch (err) {
    console.error("GCS signed URL generation failed", err);
  }

  return { cloudUrl, signedUrl, publicUrl };
};

// Simple in-memory job store (per-instance). For production, back with a DB or queue.
const jobs = new Map();

const startJob = async (jobId, inputProps) => {
  const createdAt = Date.now();
  jobs.set(jobId, { status: "processing", createdAt });
  
  try {
    const output = await withTimeout(
      renderJob(jobId, inputProps),
      JOB_TIMEOUT_MS,
      `Job timed out after ${JOB_TIMEOUT_MS / 1000} seconds`
    );
    
    let cloudUrl;
    let signedUrl;
    let publicUrl;

    try {
      const uploadResult = await uploadToGcs(output);
      cloudUrl = uploadResult.cloudUrl;
      signedUrl = uploadResult.signedUrl;
      publicUrl = uploadResult.publicUrl;
      console.log(`[${jobId}] GCS upload result:`, { cloudUrl, signedUrl: !!signedUrl, publicUrl });

      // If upload succeeded (cloudUrl exists), we can delete local output even if signing failed.
      if (cloudUrl) fs.rm(output, { force: true }, () => {});
    } catch (uploadErr) {
      console.error(`[${jobId}] GCS upload failed:`, uploadErr);
    }

    jobs.set(jobId, {
      status: "completed",
      output: cloudUrl ? null : output,
      cloudUrl,
      signedUrl,
      publicUrl,
      createdAt,
    });
  } catch (err) {
    jobs.set(jobId, { status: "failed", error: String(err), createdAt });
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
  });
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Synchronous render: blocks until done, streams file back.
app.post("/render", requireAuth, async (req, res) => {
  const validationError = validatePayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const jobId = randomUUID();

  try {
    const outputLocation = await renderJob(jobId, req.body);
    res.download(outputLocation, "video.mp4", (err) => {
      fs.rm(outputLocation, { force: true }, () => {});
      if (err) console.error("Error sending file", err);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Render failed", details: String(err) });
  }
});

// Async render: returns jobId immediately; poll status and fetch result.
app.post("/render/async", requireAuth, async (req, res) => {
  const validationError = validatePayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const jobId = randomUUID();
  jobs.set(jobId, { status: "queued", createdAt: Date.now() });

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
    console.log(`Render server listening on port ${PORT}`);
    console.log(`GCS_BUCKET: ${GCS_BUCKET || 'NOT SET'}`);
    console.log(`GCS configured: ${storage ? 'YES' : 'NO'}`);
  });
}

module.exports = app;

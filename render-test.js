const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const fs = require('fs');
const path = require('path');

const start = async () => {
  const compositionId = 'MasterComposition';
  const rawData = JSON.parse(fs.readFileSync('./test-render.json', 'utf8'));
  
  // test-render.json is an array, extract first element
  const inputProps = Array.isArray(rawData) ? rawData[0] : rawData;
  
  console.log('📦 Input props:', JSON.stringify(inputProps, null, 2).substring(0, 500) + '...');
  console.log('📦 Timeline layers:', inputProps.timeline.map(l => `${l.id} (${l.type})`).join(', '));
  console.log('📦 Bundling...');
  
  const bundleLocation = await bundle({
    entryPoint: path.resolve('./src/index.ts'),
    webpackOverride: (config) => config,
  });

  console.log('🎬 Rendering with test-render.json props...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  console.log('🎥 Composition:', {
    id: composition.id,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  });

  const outputLocation = path.resolve('./out/test-video.mp4');
  
  console.log('🚀 Starting render...');
  let lastProgress = 0;
  
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    inputProps,
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      const percent = Math.floor(progress * 100);
      if (percent > lastProgress) {
        lastProgress = percent;
        console.log(`⏳ Progress: ${percent}% (${renderedFrames}/${composition.durationInFrames} frames rendered, ${encodedFrames} encoded)`);
      }
    },
    onDownload: (src) => {
      console.log('⬇️  Downloading:', src);
    },
  });

  console.log('✅ Render complete! Output:', outputLocation);
};

start().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

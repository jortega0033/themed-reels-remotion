FROM node:18-slim

# Install chromium and ffmpeg (same approach as your working vote-bot)
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=8080

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

# Pre-bundle Remotion at build time
RUN npx remotion bundle src/index.ts --out-dir=bundle --public-dir=public

# Download Remotion's chrome-headless-shell at build time
RUN npx remotion browser ensure

EXPOSE 8080
CMD ["npm", "start"]

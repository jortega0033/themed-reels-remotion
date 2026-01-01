FROM node:24-slim

# Install system deps for headless Chromium and ffmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-noto-color-emoji \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    dbus \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    REMOTION_ENABLE_CHROMIUM_DOWNLOAD=false \
    CHROME_EXECUTABLE=/usr/bin/chromium \
    PORT=8080 \
    DBUS_SESSION_BUS_ADDRESS=/dev/null

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

# Pre-bundle Remotion at build time (saves 60-90s on cold starts)
RUN npx remotion bundle src/index.ts --out-dir=bundle --public-dir=public

EXPOSE 8080
CMD ["npm", "start"]

FROM node:24-slim

# Install system deps for headless Chromium and ffmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    REMOTION_ENABLE_CHROMIUM_DOWNLOAD=false \
    CHROME_EXECUTABLE=/usr/bin/chromium \
    PORT=8080

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

EXPOSE 8080
CMD ["npm", "start"]

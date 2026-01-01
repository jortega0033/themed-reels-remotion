FROM node:18-slim

# Install Linux dependencies for Chrome Headless Shell (not chromium package)
# Per Remotion docs: https://www.remotion.dev/docs/miscellaneous/linux-dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    libatk-bridge2.0-0 \
    ffmpeg \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
# Don't set PUPPETEER_EXECUTABLE_PATH - let Remotion find chrome-headless-shell
ENV NODE_ENV=production \
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

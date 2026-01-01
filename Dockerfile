FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

# Pre-bundle Remotion at build time
RUN npx remotion bundle src/index.ts --out-dir=bundle --public-dir=public

# Download Remotion's browser at build time
RUN npx remotion browser ensure

EXPOSE 8080
CMD ["npm", "start"]

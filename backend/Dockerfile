# 1) Semua dependency, termasuk devDependencies yang dibutuhkan saat build
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build Next.js. Tidak butuh environment variable karena getConfig() baru dipanggil saat runtime
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && rm -rf .next/cache

# 3) Runtime: hanya dependency produksi + hasil build + file yang dibutuhkan migrate/seed
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY next.config.mjs ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src
COPY --from=build --chown=node:node /app/.next ./.next

# Jangan jalan sebagai root
USER node
EXPOSE 3000

# Migrasi dan seed dulu; jika konfigurasi salah, container berhenti dengan pesan jelas
CMD ["sh", "-c", "node scripts/migrate.js && node scripts/seed.js && exec node_modules/.bin/next start"]
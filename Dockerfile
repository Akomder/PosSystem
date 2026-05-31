# ── Stage 1: Build client ──────────────────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /build

COPY client/package*.json ./client/
RUN npm ci --prefix client

COPY client/ ./client/
RUN npm run build --prefix client

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install server production dependencies only
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built React app from stage 1
COPY --from=client-builder /build/client/dist ./client/dist

# Copy root package.json (used by `npm start`)
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]

FROM node:22-slim AS builder

WORKDIR /app
COPY oracle/package.json oracle/package-lock.json ./
RUN npm ci
COPY oracle/tsconfig.json ./
COPY oracle/src/ src/
RUN npx tsc

FROM node:22-slim

# better-sqlite3 needs the native binary from node_modules
WORKDIR /app
COPY oracle/package.json oracle/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ dist/

# SQLite database persists via Railway volume
ENV DATABASE_PATH=/data/nosocial.db
ENV PORT=3000

EXPOSE 3000
CMD ["node", "--import", "./dist/instrument.js", "dist/index.js"]

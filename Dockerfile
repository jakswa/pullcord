FROM oven/bun:1-alpine AS base
WORKDIR /app

# unzip needed for weekly GTFS refresh
RUN apk add --no-cache unzip

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Copy source
COPY . .

# Build CSS
RUN bun run build:css

# Seed db for fresh volumes (optional — marta.db only exists on deployed volume)
RUN mkdir -p /app/seed

# Data directory (mount point for Fly volume)
RUN mkdir -p /data

EXPOSE 4200

CMD ["/bin/sh", "/app/entrypoint.sh"]

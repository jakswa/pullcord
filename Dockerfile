FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Copy source
COPY . .

# Build CSS
RUN bun run build:css

# Bake marta.db into image for volume seeding
RUN mkdir -p /app/seed
COPY data/marta.db /app/seed/marta.db

# Data directory (mount point for Fly volume)
RUN mkdir -p /data

EXPOSE 4200

CMD ["/bin/sh", "/app/entrypoint.sh"]

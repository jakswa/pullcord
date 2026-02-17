FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Copy source
COPY . .

# Build CSS
RUN bun run build:css

# Data directory (mount point for Fly volume)
RUN mkdir -p /app/data

EXPOSE 4200

CMD ["bun", "run", "src/index.ts"]

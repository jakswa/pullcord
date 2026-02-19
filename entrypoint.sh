#!/bin/sh
# Seed databases to persistent volume on first run
# marta.db is baked into image; cords.db is created fresh if missing

if [ ! -f /data/marta.db ]; then
  echo "📦 Seeding marta.db to volume..."
  cp /app/seed/marta.db /data/marta.db
  echo "✓ marta.db seeded ($(du -h /data/marta.db | cut -f1))"
fi

if [ ! -f /data/cords.db ]; then
  echo "📦 Creating fresh cords.db..."
  # cords.db gets created automatically by push.ts on first subscription
fi

echo "📂 /data contents:"
ls -lh /data/

exec bun run src/index.ts

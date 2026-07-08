# COMBAT — a single, zero-dependency Node.js process.
# The SQLite database lives on a mounted volume at /data so accounts, plans and
# events survive restarts and redeploys.
FROM node:22-alpine

WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
# Keep the database on the persistent volume, not inside the (ephemeral) image.
ENV COMBAT_DB=/data/combat.db
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "--experimental-sqlite", "--disable-warning=ExperimentalWarning", "server.js"]

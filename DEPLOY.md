# Deploying COMBAT as a public website

COMBAT is one Node.js process (zero dependencies) that stores everything in a
SQLite file (`data/combat.db`). To put it online for everyone, pick a host that:

1. runs a **long-lived Node server** (not serverless functions),
2. gives it a **persistent disk** for the SQLite file, and
3. serves it over **HTTPS** (logins are then encrypted, and the session cookie
   is automatically marked `Secure`).

The app is already host-ready: it listens on `process.env.PORT`, binds
`0.0.0.0`, honours a proxy's `X-Forwarded-Proto`, and lets you point the
database anywhere with `COMBAT_DB`. Because it uses SQLite, run a **single
instance** — that's plenty for a small/medium app, and avoids multi-writer
issues.

A ready-to-use `Dockerfile` is included; it stores the database on a volume at
`/data`.

---

## Environment variables

| Variable     | What it does                                   | Example            |
| ------------ | ---------------------------------------------- | ------------------ |
| `PORT`       | Port to listen on (most hosts set this for you)| `3000`             |
| `COMBAT_DB`  | Path to the SQLite file on the persistent disk | `/data/combat.db`  |

---

## Option A — Fly.io  (recommended; excellent for SQLite)

1. Install the CLI and sign in: `curl -L https://fly.io/install.sh | sh`, then `fly auth signup`.
2. From the repo root: `fly launch` — it detects the `Dockerfile`. Pick a name/region; decline the Postgres/Redis prompts.
3. Create a persistent volume (same region): `fly volumes create combat_data --size 1`.
4. In the generated `fly.toml`, mount it and set the internal port:
   ```toml
   [http_service]
     internal_port = 3000
     force_https = true

   [[mounts]]
     source = "combat_data"
     destination = "/data"
   ```
   (`COMBAT_DB=/data/combat.db` and `PORT=3000` already come from the Dockerfile.)
5. `fly deploy` → your site is live at `https://<app>.fly.dev`.

## Option B — Render.com

1. **New → Web Service**, connect your GitHub repo, choose **Docker** runtime.
2. Add a **Disk**: mount path `/data`, size 1 GB, and set env `COMBAT_DB=/data/combat.db`.
3. Render sets `PORT` and provides HTTPS automatically. Deploy → `https://<app>.onrender.com`.
   > Persistent disks require a paid instance; the free tier's disk is wiped on
   > redeploy, so data would reset. Use a small paid instance (or Fly.io).

## Option C — Railway.app

1. **New Project → Deploy from GitHub repo** (it builds the `Dockerfile`).
2. Add a **Volume** mounted at `/data`, and set `COMBAT_DB=/data/combat.db`.
3. Railway gives you a public HTTPS domain.

## Option D — Your own VPS (most control)

1. Provision an Ubuntu box and install Node 22 (or Docker).
2. Run the app and keep it alive with a systemd service (or `docker run -d -p 3000:3000 -v combat_data:/data <image>`).
3. Put **Caddy** in front for automatic HTTPS — a two-line `Caddyfile`:
   ```
   combat.example.com {
     reverse_proxy localhost:3000
   }
   ```
   Caddy fetches a free Let's Encrypt certificate and sets `X-Forwarded-Proto`
   so the app enables `Secure` cookies. Data persists on the server's disk.

---

## Custom domain & HTTPS

Point your domain's DNS at the host (an `A`/`AAAA` record for a VPS, or the
`CNAME` the PaaS gives you), then add the domain in the host's dashboard — Fly,
Render and Railway all issue the HTTPS certificate for you.

## Not recommended: Vercel / Netlify

They run **serverless functions + static hosting**. There is no always-on
process and no persistent local disk, so the SQLite file would disappear between
requests. Use a container/VM host from the options above (or migrate the data
layer to a hosted database, which is a larger change).

## Backups

Your whole database is one file. Back it up by copying `combat.db` (and its
`-wal`/`-shm` siblings) from the volume on a schedule, or snapshot the volume.

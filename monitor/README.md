# Eve Monitor

Standalone Next.js liveness and performance board for Eve APIs and frontends. Separate from the admin console.

Open [http://localhost:3010](http://localhost:3010).

```bash
cd monitor
npm install
npm run dev
```

The board probes configured origins every 5 seconds from the Next.js server (no browser CORS), then charts:

- **Liveness** — HTTP status and, for APIs, `status: "ok"` on the health payload
- **Ping** — round-trip time plus a short sparkline
- **Memory** — RSS / heap from API health responses, plus this monitor process
- **Host** — hostname, CPU count, load averages, and machine memory

## Targets

| Target | Default | Required |
| --- | --- | --- |
| Gateway | `http://localhost:4000/api/health` | yes |
| Auth / Location / Ride / Notify | `http://localhost:4001-4004/health` | optional (compose mode) |
| Admin | `http://localhost:3000` | yes |
| Rider / Driver web | `http://localhost:8081` / `8082` | optional |

Copy `.env.example` to `.env` to override URLs. Set `MONITOR_REQUIRE_SPLIT=1` when the API is running as four processes (`npm run dev:split` in `backend/`). Set a URL to empty to skip that target.

## Endpoints

- `GET /` — dashboard
- `GET /api/snapshot` — latest probe results, ping history, and monitor host stats
- `GET /api/live` — this app’s own liveness

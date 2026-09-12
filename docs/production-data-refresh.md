# Oracle production data refresh

Production reads immutable snapshot releases through `/var/lib/spillflare/current`. The `current` symlink is replaced atomically only after every candidate file has parsed and passed conservative structure/count checks. Failed sources retain their previous file and are reported as degraded. The Git checkout remains read-only to the refresh process.

The application must have both variables in `.env.production.local`:

```dotenv
SPILLFLARE_DATA_DIR=/var/lib/spillflare
SPILLFLARE_REVALIDATE_TOKEN=<a-long-random-server-only-value>
```

After a changed release, the job reloads only the `spillflare` PM2 process, waits for localhost health, invalidates the Next.js Full Route Cache through an authenticated localhost request, and submits only changed URLs to IndexNow. No build or dependency installation occurs.

The timer uses both systemd single-service semantics and `flock`; the Node command also owns a data-directory lock. Slightly stale validated files are retained when upstream data is empty, malformed, drastically incomplete, or unavailable.

After deploying reviewed application code, install the timer once:

```bash
cd /var/www/spillflare
sudo bash ops/install-production-refresh.sh
```

Manual refresh and status commands:

```bash
sudo systemctl start spillflare-data-refresh.service
systemctl status spillflare-data-refresh.timer --no-pager
journalctl -u spillflare-data-refresh.service -n 100 --no-pager
cd /var/www/spillflare && set -a && source .env.production.local && set +a && npm run data:status
```

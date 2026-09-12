#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

app_dir=/var/www/spillflare
data_dir=/var/lib/spillflare
env_file="$app_dir/.env.production.local"
install -d -o ubuntu -g ubuntu -m 0750 "$data_dir" "$data_dir/releases"

if [[ ! -e "$data_dir/current" ]]; then
  release="releases/bootstrap-$(date -u +%Y%m%dT%H%M%SZ)"
  install -d -o ubuntu -g ubuntu -m 0750 "$data_dir/$release"
  cp -a "$app_dir/data/snapshots/." "$data_dir/$release/"
  chown -R ubuntu:ubuntu "$data_dir/$release"
  ln -s "$release" "$data_dir/.current-next"
  mv -Tf "$data_dir/.current-next" "$data_dir/current"
fi

touch "$env_file"
chown ubuntu:ubuntu "$env_file"
chmod 0600 "$env_file"
grep -q '^SPILLFLARE_DATA_DIR=' "$env_file" || printf '%s\n' 'SPILLFLARE_DATA_DIR=/var/lib/spillflare' >> "$env_file"
if ! grep -q '^SPILLFLARE_REVALIDATE_TOKEN=' "$env_file"; then
  printf 'SPILLFLARE_REVALIDATE_TOKEN=%s\n' "$(openssl rand -hex 32)" >> "$env_file"
fi

install -o root -g root -m 0644 "$app_dir/ops/systemd/spillflare-data-refresh.service" /etc/systemd/system/spillflare-data-refresh.service
install -o root -g root -m 0644 "$app_dir/ops/systemd/spillflare-data-refresh.timer" /etc/systemd/system/spillflare-data-refresh.timer
systemd-analyze verify /etc/systemd/system/spillflare-data-refresh.service /etc/systemd/system/spillflare-data-refresh.timer
systemctl daemon-reload

# Load the runtime directory into the existing PM2 application before enabling refreshes.
sudo -u ubuntu env PATH=/opt/node22/bin:/usr/local/bin:/usr/bin:/bin bash -c "cd '$app_dir' && set -a && source '$env_file' && set +a && pm2 reload spillflare --update-env && pm2 save"
systemctl enable --now spillflare-data-refresh.timer
echo "SpillFlare production refresh timer installed."

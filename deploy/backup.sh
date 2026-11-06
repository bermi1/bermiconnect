#!/usr/bin/env bash
# Nightly PostgreSQL backup for Bermi Connect. Install: see DEPLOY.md section 9.
set -euo pipefail
cd /opt/bermi-connect
BACKUP_DIR=/var/backups/bermi
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p "$BACKUP_DIR"
set -a; . ./.env; set +a
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-bermi}" -d "${POSTGRES_DB:-bermi_connect}" -Fc \
  > "$BACKUP_DIR/bermi-$STAMP.dump"
# sanity check: the archive must list tables
docker compose exec -T postgres pg_restore -l < "$BACKUP_DIR/bermi-$STAMP.dump" | grep -q "TABLE DATA" \
  || { echo "backup verification failed" >&2; exit 1; }
find "$BACKUP_DIR" -name 'bermi-*.dump' -mtime +"$KEEP_DAYS" -delete
# Off-site copy (configure once with `rclone config`; remote name "offsite")
if command -v rclone >/dev/null && rclone listremotes | grep -q '^offsite:'; then
  rclone copy "$BACKUP_DIR/bermi-$STAMP.dump" offsite:bermi-backups/
fi
echo "ok $BACKUP_DIR/bermi-$STAMP.dump"

#!/usr/bin/env bash
# Rich health-intake deploy script for Aliyun ECS.
#
# Usage: pnpm --filter @ke/health-intake run deploy
# Requires:
#   - ~/.ssh/rich-aliyun-ecs
#   - ~/.rich-cloud-postgres.env with RICH_DB_PASSWORD

set -euo pipefail

ECS_HOST="${ECS_HOST:-root@8.133.193.247}"
ECS_KEY="${ECS_KEY:-$HOME/.ssh/rich-aliyun-ecs}"
REMOTE_DIR="/opt/rich-health-intake"
SERVICE_NAME="rich-health-intake"
PORT="${INTAKE_PORT:-31516}"

TOKEN_FILE="$HOME/.rich-health-intake-token"
if [[ -f "$TOKEN_FILE" ]]; then
  TOKEN="$(cat "$TOKEN_FILE")"
  echo "-> using existing token file: $TOKEN_FILE"
else
  TOKEN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  echo "$TOKEN" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  echo "-> generated token file: $TOKEN_FILE"
fi

if [[ ! -f "$HOME/.rich-cloud-postgres.env" ]]; then
  echo "missing $HOME/.rich-cloud-postgres.env" >&2
  exit 1
fi

DB_PASSWORD="$(grep '^RICH_DB_PASSWORD=' "$HOME/.rich-cloud-postgres.env" | cut -d= -f2-)"
if [[ -z "$DB_PASSWORD" ]]; then
  echo "missing RICH_DB_PASSWORD in $HOME/.rich-cloud-postgres.env" >&2
  exit 1
fi
DB_PASSWORD_ENCODED="$(DB_PASSWORD="$DB_PASSWORD" node -e 'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD || ""))')"
RICH_DB_URL_REMOTE="postgres://rich_app:${DB_PASSWORD_ENCODED}@127.0.0.1:5432/rich"

SSH="ssh -i $ECS_KEY -o StrictHostKeyChecking=accept-new"
SCP="scp -i $ECS_KEY -o StrictHostKeyChecking=accept-new"

echo "-> upload dist/server.cjs to $ECS_HOST:$REMOTE_DIR/"
$SSH "$ECS_HOST" "mkdir -p '$REMOTE_DIR'"
$SCP dist/server.cjs "$ECS_HOST:$REMOTE_DIR/server.cjs"

echo "-> write remote env and systemd unit"
$SSH "$ECS_HOST" "cat > '$REMOTE_DIR/.env'" <<EOF
HEALTH_INTAKE_TOKEN=$TOKEN
DATABASE_URL=$RICH_DB_URL_REMOTE
PORT=$PORT
EOF
$SSH "$ECS_HOST" "chmod 600 '$REMOTE_DIR/.env'"

$SSH "$ECS_HOST" "cat > /etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Rich health-intake (Apple Shortcuts receiver)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
EnvironmentFile=$REMOTE_DIR/.env
ExecStart=/usr/local/bin/node $REMOTE_DIR/server.cjs
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

echo "-> reload, enable, restart service"
$SSH "$ECS_HOST" "systemctl daemon-reload && systemctl enable '$SERVICE_NAME' && systemctl restart '$SERVICE_NAME' && sleep 1 && systemctl status '$SERVICE_NAME' --no-pager | head -12"

echo
echo "-> smoke test /healthz from ECS localhost"
$SSH "$ECS_HOST" "curl -s http://127.0.0.1:$PORT/healthz"
echo
echo
echo "deploy complete"
echo "  ECS host:   ${ECS_HOST#root@}"
echo "  port:       $PORT"
echo "  token file: $TOKEN_FILE"
echo
echo "Public iPhone URL:"
echo "  http://${ECS_HOST#root@}:$PORT/api/health/intake/from-apple"
echo "  Authorization: Bearer <see $TOKEN_FILE>"
echo
echo "If public curl still times out, open Aliyun security group inbound TCP $PORT from 0.0.0.0/0."

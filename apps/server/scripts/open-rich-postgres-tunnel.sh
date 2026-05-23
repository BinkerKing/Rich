#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${RICH_CLOUD_POSTGRES_ENV:-$HOME/.rich-cloud-postgres.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

LOCAL_PORT="${RICH_DB_PORT:-15432}"
REMOTE_HOST="${RICH_DB_HOST:-127.0.0.1}"
REMOTE_SSH_HOST="${RICH_DB_SSH_HOST:?missing RICH_DB_SSH_HOST}"
REMOTE_SSH_USER="${RICH_DB_SSH_USER:-root}"
REMOTE_SSH_KEY="${RICH_DB_SSH_KEY:?missing RICH_DB_SSH_KEY}"

exec ssh \
  -i "$REMOTE_SSH_KEY" \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -N \
  -L "${LOCAL_PORT}:${REMOTE_HOST}:5432" \
  "${REMOTE_SSH_USER}@${REMOTE_SSH_HOST}"

#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-rich-cloud-secrets.bundle.enc}"
ENV_FILE="${RICH_CLOUD_POSTGRES_ENV:-$HOME/.rich-cloud-postgres.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

KEY_FILE="${RICH_DB_SSH_KEY:?missing RICH_DB_SSH_KEY in $ENV_FILE}"
KEY_FILE="${KEY_FILE/#\$HOME/$HOME}"
KEY_FILE="${KEY_FILE/#~/$HOME}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing SSH key $KEY_FILE" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/.ssh"
cp "$ENV_FILE" "$tmp/rich-cloud-postgres.env"
cp "$KEY_FILE" "$tmp/.ssh/rich-aliyun-ecs"
chmod 600 "$tmp/.ssh/rich-aliyun-ecs"

tar -C "$tmp" -czf "$tmp/rich-cloud-secrets.tar.gz" rich-cloud-postgres.env .ssh/rich-aliyun-ecs

echo "Encrypting secret bundle to $OUT"
echo "Use a passphrase you can type on the Mac mini. Do not commit or paste the passphrase."
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "$tmp/rich-cloud-secrets.tar.gz" \
  -out "$OUT"

chmod 600 "$OUT"
echo "Created encrypted bundle: $OUT"

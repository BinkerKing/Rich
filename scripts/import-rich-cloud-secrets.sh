#!/usr/bin/env bash
set -euo pipefail

BUNDLE="${1:-rich-cloud-secrets.bundle.enc}"

if [[ ! -f "$BUNDLE" ]]; then
  echo "Missing bundle $BUNDLE" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Decrypting $BUNDLE"
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "$BUNDLE" \
  -out "$tmp/rich-cloud-secrets.tar.gz"

tar -C "$tmp" -xzf "$tmp/rich-cloud-secrets.tar.gz"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

cp "$tmp/.ssh/rich-aliyun-ecs" "$HOME/.ssh/rich-aliyun-ecs"
chmod 600 "$HOME/.ssh/rich-aliyun-ecs"

cp "$tmp/rich-cloud-postgres.env" "$HOME/.rich-cloud-postgres.env"
python3 - "$HOME/.rich-cloud-postgres.env" "$HOME/.ssh/rich-aliyun-ecs" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
key_path = sys.argv[2]
lines = env_path.read_text().splitlines()
out = []
seen = False
for line in lines:
    if line.startswith("RICH_DB_SSH_KEY="):
        out.append(f"RICH_DB_SSH_KEY={key_path}")
        seen = True
    else:
        out.append(line)
if not seen:
    out.append(f"RICH_DB_SSH_KEY={key_path}")
env_path.write_text("\n".join(out) + "\n")
PY
chmod 600 "$HOME/.rich-cloud-postgres.env"

echo "Installed:"
echo "  $HOME/.rich-cloud-postgres.env"
echo "  $HOME/.ssh/rich-aliyun-ecs"
echo
echo "Next:"
echo "  source ~/.rich-cloud-postgres.env"
echo "  ssh -i \"\$RICH_DB_SSH_KEY\" -o ExitOnForwardFailure=yes -f -N -L \"\${RICH_DB_PORT}:\${RICH_DB_HOST}:5432\" \"\${RICH_DB_SSH_USER}@\${RICH_DB_SSH_HOST}\""
echo "  KE_STORAGE=postgres DATABASE_URL=\"\$RICH_DB_URL\" pnpm --filter @ke/desktop dev"

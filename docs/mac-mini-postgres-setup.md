# Mac mini Postgres Setup

Rich can share one cloud Postgres database across MacBook and Mac mini. The code is in GitHub, but the database password and SSH private key must not be committed as plaintext.

## Option A: encrypted bundle in GitHub

On the MacBook:

```bash
cd /Users/binkerking/Documents/Ai-WorkSpace/Project/Rich
scripts/export-rich-cloud-secrets.sh rich-cloud-secrets.bundle.enc
```

Commit `rich-cloud-secrets.bundle.enc` only if it is encrypted and the passphrase is kept outside GitHub.

On the Mac mini:

```bash
cd /path/to/Rich
scripts/import-rich-cloud-secrets.sh rich-cloud-secrets.bundle.enc
```

Then start the tunnel:

```bash
source ~/.rich-cloud-postgres.env
ssh -i "$RICH_DB_SSH_KEY" \
  -o ExitOnForwardFailure=yes \
  -f -N \
  -L "${RICH_DB_PORT}:${RICH_DB_HOST}:5432" \
  "${RICH_DB_SSH_USER}@${RICH_DB_SSH_HOST}"
```

Check it:

```bash
nc -z 127.0.0.1 15432 && echo ok
```

Start Rich:

```bash
source ~/.rich-cloud-postgres.env
KE_STORAGE=postgres DATABASE_URL="$RICH_DB_URL" pnpm --filter @ke/desktop dev
```

## Option B: manual local config

Copy `config/rich-cloud-postgres.env.example` to `~/.rich-cloud-postgres.env`, fill the password, and place the SSH key at `~/.ssh/rich-aliyun-ecs`.

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
chmod 600 ~/.ssh/rich-aliyun-ecs ~/.rich-cloud-postgres.env
```

Never commit the filled `~/.rich-cloud-postgres.env` or the private key in plaintext.

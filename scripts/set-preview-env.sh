#!/usr/bin/env bash
#
# Pushes .env.preview into Vercel's Preview environment, one variable at a time.
#
# Vercel keeps Production, Preview and Development as separate sets, so values
# set for Production do not reach a branch deployment. This fills the Preview
# set, which is what every non-main branch builds against.
#
# Prerequisites, both interactive and both one-off:
#   pnpm exec vercel login
#   pnpm exec vercel link
#
# Safe to re-run: an existing variable is removed before being re-added, so the
# script updates rather than failing on a duplicate.

set -euo pipefail

cd "$(dirname "$0")/.."

FILE=".env.preview"

if [ ! -f "$FILE" ]; then
  echo "No $FILE. Copy .env.preview.template to $FILE and fill it in." >&2
  exit 1
fi

# --- Refuse to push a half-filled file -------------------------------------
# A preview missing DATABASE_URL or R2_BUCKET fails in ways that read like code
# bugs, which is the confusion /api/health exists to end. Better to stop here.
missing=()
for key in DATABASE_URL R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY \
           R2_BUCKET ORGANISATION_NAME APPLY_SECRET RATE_LIMIT_SALT \
           ADMIN_SECRET CRON_SECRET; do
  value="$(grep -E "^${key}=" "$FILE" | head -1 | cut -d= -f2- || true)"
  [ -z "$value" ] && missing+=("$key")
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "These are still empty in $FILE:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

# --- The one rule no code can enforce --------------------------------------
apply="$(grep -E '^APPLY_SECRET=' "$FILE" | head -1 | cut -d= -f2-)"
admin="$(grep -E '^ADMIN_SECRET=' "$FILE" | head -1 | cut -d= -f2-)"
if [ "$apply" = "$admin" ]; then
  echo "APPLY_SECRET and ADMIN_SECRET are the same value." >&2
  echo "The pickup key is pasted into WhatsApp and leaks on the first" >&2
  echo "forward; the admin key can rewrite the fleet. Use two values." >&2
  exit 1
fi

if [ ! -d ".vercel" ]; then
  echo "This directory is not linked to a Vercel project." >&2
  echo "Run: pnpm exec vercel link" >&2
  exit 1
fi

# --- Push ------------------------------------------------------------------
while IFS= read -r line; do
  case "$line" in ''|\#*) continue ;; esac
  key="${line%%=*}"
  value="${line#*=}"
  [ -z "$value" ] && continue

  # Strip surrounding quotes, which Vercel would otherwise store literally.
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"

  # Remove first so a re-run updates instead of erroring on a duplicate.
  pnpm exec vercel env rm "$key" preview --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | pnpm exec vercel env add "$key" preview >/dev/null
  echo "  set $key"
done < "$FILE"

echo
echo "Done. Redeploy the branch so the build picks them up:"
echo "  git commit --allow-empty -m 'chore: redeploy preview' && git push"
echo
echo "Then confirm the deployment can see them:"
echo "  curl -s \$PREVIEW_URL/api/health/ | jq"

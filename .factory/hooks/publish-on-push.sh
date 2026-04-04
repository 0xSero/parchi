#!/usr/bin/env bash
set -euo pipefail

repo_root="${FACTORY_PROJECT_DIR:-${PWD}}"
cd "$repo_root"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

if [ "${PUBLISH_ON_PUSH_ENABLED:-1}" = "0" ]; then
  exit 0
fi

if [ -n "${PUBLISH_ON_PUSH_BRANCH_REGEX:-}" ]; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if ! printf '%s' "$branch" | grep -Eq "$PUBLISH_ON_PUSH_BRANCH_REGEX"; then
    exit 0
  fi
fi

if [ -z "${CWS_EXTENSION_ID:-}" ]; then
  exit 0
fi

npm run publish >/tmp/parchi-publish-on-push.log 2>&1 || true
exit 0

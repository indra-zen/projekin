#!/usr/bin/env bash
# Runs once after the dev container is created.
set -euo pipefail

cd "$(dirname "$0")/.."

# Mark the workspace as safe for git (bind-mounted folders can trip ownership checks).
git config --global --add safe.directory "$PWD"

if [ -f package-lock.json ]; then
  echo "post-create: package-lock.json found, running npm ci"
  npm ci
elif [ -f package.json ]; then
  echo "post-create: package.json found, running npm install"
  npm install
else
  echo "post-create: no package.json yet. Skipping dependency install."
fi

echo "post-create: toolchain"
echo "  node   $(node --version)"
echo "  npm    $(npm --version)"
echo "  git    $(git --version | awk '{print $3}')"
echo "  claude $(claude --version 2>/dev/null || echo 'not found')"

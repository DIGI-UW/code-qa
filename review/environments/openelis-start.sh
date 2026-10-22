#!/usr/bin/env bash
set -euo pipefail
[[ "$1" =~ ^[0-9a-f]{40}$ ]] || exit 2
mkdir -p "$HOME/review"
cd "$HOME/review"
git clone --filter=blob:none --no-checkout https://github.com/DIGI-UW/OpenELIS-Global-2.git source
cd source
git fetch origin "$1"
git checkout --detach "$1"
test "$(git rev-parse HEAD)" = "$1"
python3 scripts/install-agent-skills.py -y claude
cp .env.example .env
# This worker contains only generated test state; no host credentials are copied.
export LETSENCRYPT_DOMAIN=localhost DEV_STACK_TLS=self-signed OE_UAT_SCENARIOS_ENABLED=true
scripts/dev-stack up --build --no-scenarios
scripts/dev-stack env

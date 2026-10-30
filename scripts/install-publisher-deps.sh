#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Missing dependency: Node.js 20+ and npm are required." >&2
    exit 1
fi

NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])')
if (( NODE_MAJOR < 20 )); then
    echo "Node.js 20 or later is required." >&2
    exit 1
fi

npm install \
    --prefix "$SCRIPT_DIR" \
    --no-save \
    --package-lock=false \
    --omit=dev \
    "@aws-sdk/client-sns@3.1039.0"
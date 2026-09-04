#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root_dir"

export MN_TEST_ENVIRONMENT=devnet
export PROOF_SERVER_VERSION=8.1.0
export INDEXER_VERSION=4.3.2
export MIDNIGHT_NODE_VERSION=1.0.0

pnpm --filter @soon/midnight-contract e2e

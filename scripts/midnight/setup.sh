#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
compact_dir="$repo_root/packages/midnight-contract/.compact"
compact_bin="$compact_dir/bin/compact"

if [ ! -x "$compact_bin" ]; then
  mkdir -p "$compact_dir/bin"
  curl --proto '=https' --tlsv1.2 -LsSf \
    https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh \
    | env COMPACT_UNMANAGED_INSTALL="$compact_dir/bin" COMPACT_NO_MODIFY_PATH=1 sh
fi

test "$($compact_bin --version)" = "compact 0.5.1"
"$compact_bin" --directory "$compact_dir" update 0.31.1
"$compact_bin" --directory "$compact_dir" compile --version

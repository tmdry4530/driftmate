#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
compact_dir="$repo_root/packages/midnight-contract/.compact"
compact_bin="$compact_dir/bin/compact"

if [ ! -x "$compact_bin" ]; then
  echo "Compact CLI가 없습니다. pnpm midnight:setup을 실행하세요." >&2
  exit 1
fi

cli_version=$($compact_bin --version)
compiler_version=$($compact_bin --directory "$compact_dir" compile --version)
test "$cli_version" = "compact 0.5.1"
test "$compiler_version" = "0.31.1"
printf '%s\ncompactc %s\n' "$cli_version" "$compiler_version"

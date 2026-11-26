#!/bin/sh
set -eu
cd "$(dirname "$0")"

for file in \
  Aurel-1.0.0-arm64.dmg
do
  cat "$file".part.* > "$file"
done

shasum -a 256 -c INSTALLERS.sha256

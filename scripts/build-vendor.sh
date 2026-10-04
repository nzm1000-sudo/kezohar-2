#!/usr/bin/env bash
# Rebuilds vendor/*.min.js (static ES modules loaded through the import map).
# Dev-only; the site itself is plain static files.
#   mkdir /tmp/kz && cd /tmp/kz && npm i three@0.186.1 gsap@3.15.0 lenis@1.3.26 esbuild
#   KZ_MODULES=/tmp/kz/node_modules scripts/build-vendor.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${KZ_MODULES:?set KZ_MODULES to a node_modules dir}"
ESBUILD="$KZ_MODULES/.bin/esbuild"
for n in three-kit gsap-kit lenis; do
  NODE_PATH="$KZ_MODULES" "$ESBUILD" "scripts/vendor-entries/$n.js" --bundle --format=esm --minify \
    --target=es2020 --legal-comments=inline --outfile="vendor/$n.min.js" \
    --resolve-extensions=.js,.mjs --main-fields=module,main
done
ls -la vendor

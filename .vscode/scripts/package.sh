#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

PLUGIN_DIR_NAME="decky-stormbreaker"
OUT_DIR="$REPO_ROOT/out"
STAGE_DIR="$OUT_DIR/stage"

PAYLOAD=(
    main.py
    plugin.json
    package.json
    LICENSE
    dist
    py_modules
)

VERSION="$(node -p "require('./package.json').version")"
ASSET_NAME="Stormbreaker-${VERSION}.zip"
GLOBAL_EXCLUDES="$(git config --path --get core.excludesfile || true)"

if [[ -n "$(git status --porcelain)" ]]; then
    if [[ "${PACKAGE_ALLOW_DIRTY:-}" != "1" ]]; then
        echo "Working tree is dirty. A release asset has to come from a clean tree." >&2
        git status --short >&2
        echo "Set PACKAGE_ALLOW_DIRTY=1 to package it anyway." >&2
        exit 1
    fi
    echo "WARNING: packaging a dirty working tree."
fi

if [[ "${PACKAGE_SKIP_BUILD:-}" == "1" ]]; then
    echo "Skipping the build, using dist/ as it stands."
else
    echo "Building ${VERSION}..."
    pnpm run build
fi

for path in "${PAYLOAD[@]}"; do
    if [[ ! -e "$path" ]]; then
        echo "Payload is missing ${path}, refusing to package." >&2
        exit 1
    fi
done

echo "Staging ${PLUGIN_DIR_NAME}/..."
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/$PLUGIN_DIR_NAME"

RSYNC_ARGS=(-r --exclude "__pycache__" --exclude "*.pyc" --exclude "*.log" --exclude ".DS_Store")
if [[ -n "$GLOBAL_EXCLUDES" && -f "$GLOBAL_EXCLUDES" ]]; then
    RSYNC_ARGS+=(--exclude-from="$GLOBAL_EXCLUDES")
fi

for path in "${PAYLOAD[@]}"; do
    rsync "${RSYNC_ARGS[@]}" "$path" "$STAGE_DIR/$PLUGIN_DIR_NAME/"
done

find "$STAGE_DIR" -type d -exec chmod 755 {} +
find "$STAGE_DIR" -type f -exec chmod 644 {} +

echo "Writing ${ASSET_NAME}..."
rm -f "$OUT_DIR/$ASSET_NAME"
(cd "$STAGE_DIR" && zip -q -r "$OUT_DIR/$ASSET_NAME" "$PLUGIN_DIR_NAME")
rm -rf "$STAGE_DIR"

echo
echo "  asset    ${OUT_DIR}/${ASSET_NAME}"
echo "  version  ${VERSION}"
echo "  size     $(du -h "$OUT_DIR/$ASSET_NAME" | cut -f1)"
echo "  sha256   $(sha256sum "$OUT_DIR/$ASSET_NAME" | cut -d' ' -f1)"
echo "  entries  $(unzip -l "$OUT_DIR/$ASSET_NAME" | tail -1 | awk '{print $2}')"
echo
echo "==> Done. Upload it as ${ASSET_NAME}."

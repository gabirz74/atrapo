#!/bin/bash
# Alargo installer for macOS.  Usage:  curl -fsSL https://atrapo.vercel.app/alargo/install.sh | bash
# Downloads the latest Alargo with curl (so macOS does not flag it as "downloaded from the internet"),
# checks its SHA-256 and copies it to Applications.
set -euo pipefail

SITE="https://atrapo.vercel.app/alargo"
[ "$(uname -s)" = "Darwin" ] || { echo "This installer is for macOS."; exit 1; }
case "$(uname -m)" in arm64) KEY="mac-arm64" ;; x86_64) KEY="mac-x64" ;; *) echo "Unsupported Mac."; exit 1 ;; esac

echo "Looking for the latest Alargo…"
JSON="$(curl -fsSL "$SITE/version.json")"
BLOCK="$(printf '%s' "$JSON" | sed -n "/\"$KEY\"/,/}/p")"
URL="$(printf '%s' "$BLOCK" | sed -n 's/.*"url": *"\([^"]*\)".*/\1/p' | head -1)"
SUM="$(printf '%s' "$BLOCK" | sed -n 's/.*"sha256": *"\([^"]*\)".*/\1/p' | head -1)"
VERSION="$(printf '%s' "$JSON" | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$URL" ] && [ -n "$SUM" ] || { echo "Could not read the download address."; exit 1; }

TMP="$(mktemp -d)"
MNT="$TMP/mnt"
cleanup() { hdiutil detach "$MNT" -quiet 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT

echo "Downloading Alargo $VERSION…"
curl -fL --progress-bar -o "$TMP/Alargo.dmg" "$URL"

echo "Checking the file…"
[ "$(shasum -a 256 "$TMP/Alargo.dmg" | cut -d' ' -f1)" = "$SUM" ] || { echo "The download is corrupted (checksum mismatch). Nothing was installed."; exit 1; }

mkdir -p "$MNT"
hdiutil attach "$TMP/Alargo.dmg" -nobrowse -quiet -mountpoint "$MNT"

DEST="/Applications"
[ -w "$DEST" ] || { DEST="$HOME/Applications"; mkdir -p "$DEST"; }
pkill -x Alargo 2>/dev/null || true
rm -rf "$DEST/Alargo.app"
cp -R "$MNT/Alargo.app" "$DEST/Alargo.app"
xattr -cr "$DEST/Alargo.app" 2>/dev/null || true

echo "Alargo $VERSION installed in $DEST."
open "$DEST/Alargo.app"

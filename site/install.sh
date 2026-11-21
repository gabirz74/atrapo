#!/bin/bash
# Atrapo installer for macOS.  Usage:  curl -fsSL https://atrapo.vercel.app/install.sh | bash
# Downloads the latest Atrapo with curl (so macOS does not flag it as "downloaded from the internet"),
# checks its SHA-256 and copies it to Applications.
set -euo pipefail

SITE="https://atrapo.vercel.app"
[ "$(uname -s)" = "Darwin" ] || { echo "This installer is for macOS."; exit 1; }
case "$(uname -m)" in arm64) KEY="mac-arm64" ;; x86_64) KEY="mac-x64" ;; *) echo "Unsupported Mac."; exit 1 ;; esac

echo "Looking for the latest Atrapo…"
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

echo "Downloading Atrapo $VERSION…"
curl -fL --progress-bar -o "$TMP/Atrapo.dmg" "$URL"

echo "Checking the file…"
[ "$(shasum -a 256 "$TMP/Atrapo.dmg" | cut -d' ' -f1)" = "$SUM" ] || { echo "The download is corrupted (checksum mismatch). Nothing was installed."; exit 1; }

mkdir -p "$MNT"
hdiutil attach "$TMP/Atrapo.dmg" -nobrowse -quiet -mountpoint "$MNT"

DEST="/Applications"
[ -w "$DEST" ] || { DEST="$HOME/Applications"; mkdir -p "$DEST"; }
pkill -x Atrapo 2>/dev/null || true
rm -rf "$DEST/Atrapo.app"
cp -R "$MNT/Atrapo.app" "$DEST/Atrapo.app"
xattr -cr "$DEST/Atrapo.app" 2>/dev/null || true

echo "Atrapo $VERSION installed in $DEST."
open "$DEST/Atrapo.app"

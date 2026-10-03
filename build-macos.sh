#!/usr/bin/env bash
set -e

echo "===================================================="
echo " ORION - Packaging macOS Production Installer (.dmg)"
echo "===================================================="

mkdir -p dist-installer

echo "[1/3] Building frontend assets..."
npm run build

echo "[2/3] Compiling release binary and .app bundle..."
npx tauri build --bundles app

echo "[3/3] Packaging compressed macOS Disk Image (.dmg) and .zip..."
rm -f dist-installer/ORION_v1.1_macOS.dmg dist-installer/ORION-macOS-v1.1.zip
hdiutil makehybrid -o dist-installer/temp.dmg -hfs -default-volume-name "ORION" src-tauri/target/release/bundle/macos/
hdiutil convert dist-installer/temp.dmg -format UDZO -o dist-installer/ORION_v1.1_macOS.dmg
rm -f dist-installer/temp.dmg
(cd dist-installer && zip -r -9 ORION-macOS-v1.1.zip ../src-tauri/target/release/bundle/macos/ORION.app)

echo "===================================================="
echo " BUILD SUCCESSFUL!"
echo " Location: dist-installer/ORION_v1.1_macOS.dmg"
echo " Location: dist-installer/ORION-macOS-v1.1.zip"
echo "===================================================="

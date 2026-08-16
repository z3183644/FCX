#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
backend_dir="$repo_root/backend"
icon_source="$backend_dir/resources/icon-macos.png"
iconset_dir="$repo_root/build/FCXBackend.iconset"
icns_path="$repo_root/build/FCXBackend.icns"
pyinstaller_dist="$repo_root/build/pyinstaller-service"
assembled_app_dir="$repo_root/build/assembled-app"
signed_app_dir="$repo_root/build/signed-app"
release_dir="$repo_root/build/macos-release"
app_name="FCX后端"
app_executable="FCXBackendUI"
service_name="FCXBackendService"
swift_source="$backend_dir/macos/FCXBackendApp.swift"
version_manifest="$repo_root/FCX/package.json"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "backend/build_macos.sh must be run on macOS." >&2
  exit 1
fi
if [[ ! -f "$icon_source" ]]; then
  echo "Missing icon: $icon_source" >&2
  exit 1
fi
if [[ ! -f "$swift_source" ]]; then
  echo "Missing macOS UI source: $swift_source" >&2
  exit 1
fi
manifest_version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["version"])' "$version_manifest")"
app_version="${FCX_MACOS_VERSION:-$manifest_version}"
if [[ ! "$app_version" =~ ^[0-9]+(\.[0-9]+){1,2}$ ]]; then
  echo "Invalid macOS app version: $app_version" >&2
  exit 1
fi

rm -rf "$iconset_dir" "$pyinstaller_dist" "$assembled_app_dir" "$signed_app_dir" "$release_dir"
mkdir -p "$iconset_dir" "$release_dir"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$icon_source" \
    --out "$iconset_dir/icon_${size}x${size}.png" >/dev/null
  double_size=$((size * 2))
  sips -z "$double_size" "$double_size" "$icon_source" \
    --out "$iconset_dir/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset_dir" -o "$icns_path"

cd "$repo_root"
python3 -m PyInstaller \
  --noconfirm \
  --clean \
  --onedir \
  --console \
  --name "$service_name" \
  --distpath "$pyinstaller_dist" \
  --paths "$backend_dir" \
  --additional-hooks-dir "$repo_root/pyinstaller_hooks" \
  --exclude-module tkinter \
  --exclude-module ttkbootstrap \
  "$backend_dir/server_entry.py"

service_path="$pyinstaller_dist/$service_name"
if [[ ! -x "$service_path/$service_name" ]]; then
  echo "PyInstaller did not create $service_path/$service_name" >&2
  exit 1
fi

app_path="$assembled_app_dir/$app_name.app"
contents_path="$app_path/Contents"
mkdir -p "$contents_path/MacOS" "$contents_path/Resources/backend"

xcrun swiftc "$swift_source" \
  -parse-as-library \
  -target "$(uname -m)-apple-macos13.0" \
  -framework SwiftUI \
  -framework AppKit \
  -o "$contents_path/MacOS/$app_executable"

ditto --norsrc "$service_path" "$contents_path/Resources/backend"
ditto --norsrc "$icns_path" "$contents_path/Resources/FCXBackend.icns"

info_plist="$contents_path/Info.plist"
plutil -create xml1 "$info_plist"
plutil -insert CFBundleDevelopmentRegion -string "zh_CN" "$info_plist"
plutil -insert CFBundleDisplayName -string "$app_name" "$info_plist"
plutil -insert CFBundleExecutable -string "$app_executable" "$info_plist"
plutil -insert CFBundleIconFile -string "FCXBackend.icns" "$info_plist"
plutil -insert CFBundleIdentifier -string "com.fczhushou.fcx.backend" "$info_plist"
plutil -insert CFBundleInfoDictionaryVersion -string "6.0" "$info_plist"
plutil -insert CFBundleName -string "$app_name" "$info_plist"
plutil -insert CFBundlePackageType -string "APPL" "$info_plist"
plutil -insert CFBundleShortVersionString -string "$app_version" "$info_plist"
plutil -insert CFBundleVersion -string "$app_version" "$info_plist"
plutil -insert LSApplicationCategoryType -string "public.app-category.utilities" "$info_plist"
plutil -insert LSMinimumSystemVersion -string "13.0" "$info_plist"
plutil -insert NSHighResolutionCapable -bool true "$info_plist"

mkdir -p "$signed_app_dir"
ditto --norsrc "$app_path" "$signed_app_dir/$app_name.app"
app_path="$signed_app_dir/$app_name.app"
contents_path="$app_path/Contents"
codesign --force --deep --sign - "$app_path"
codesign --verify --deep --strict "$app_path"
if [[ ! -x "$contents_path/Resources/backend/$service_name" ]]; then
  echo "The local solver service is missing from the application bundle" >&2
  exit 1
fi

architecture="$(uname -m)"
case "$architecture" in
  arm64) archive_arch="arm64" ;;
  x86_64) archive_arch="x86_64" ;;
  *)
    echo "Unsupported macOS architecture: $architecture" >&2
    exit 1
    ;;
esac

archive="$release_dir/FCX后端-macOS-$archive_arch.zip"
rm -f "$archive"
ditto -c -k --sequesterRsrc --keepParent "$app_path" "$archive"
(
  cd "$(dirname "$archive")"
  shasum -a 256 "$(basename "$archive")" > "$(basename "$archive").sha256"
)
echo "Built $archive"

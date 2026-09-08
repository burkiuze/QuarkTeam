#!/usr/bin/env bash
#
# QuarkCode installer for Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/burkiuze/QuarkTeam/main/scripts/install.sh | bash
#
# Clones (or updates) the repository, builds an AppImage, and puts a `quarkcode`
# command plus a desktop entry in the user's own directories. Nothing is written
# outside $HOME and no sudo is used.
set -euo pipefail

REPO_URL="${QUARKCODE_REPO:-https://github.com/burkiuze/QuarkTeam.git}"
BRANCH="${QUARKCODE_BRANCH:-main}"
SRC_DIR="${QUARKCODE_SRC:-${XDG_DATA_HOME:-$HOME/.local/share}/quarkcode/src}"
BIN_DIR="${QUARKCODE_BIN:-$HOME/.local/bin}"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"

say() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

# --- Requirements ------------------------------------------------------------

command -v git >/dev/null 2>&1 || die "git is required. Install it, then re-run."
command -v node >/dev/null 2>&1 || die "Node.js 20.19+ is required. See https://nodejs.org"
command -v npm >/dev/null 2>&1 || die "npm is required (it ships with Node.js)."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node.js 20.19+ is required; found $(node -v)."
fi

# Electron needs these shared libraries at runtime. Missing ones are reported
# rather than installed, because that needs a package manager and root.
MISSING=""
for lib in libnss3.so libatk-bridge-2.0.so.0 libgbm.so.1 libasound.so.2; do
  ldconfig -p 2>/dev/null | grep -q "$lib" || MISSING="$MISSING $lib"
done
if [ -n "$MISSING" ]; then
  printf '\033[1;33mWarning:\033[0m missing Electron runtime libraries:%s\n' "$MISSING" >&2
  echo "  Debian/Ubuntu: sudo apt-get install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2" >&2
  echo "  Fedora:        sudo dnf install -y nss atk at-spi2-atk gtk3 mesa-libgbm alsa-lib" >&2
fi

# --- Source ------------------------------------------------------------------

if [ -d "$SRC_DIR/.git" ]; then
  say "Updating $SRC_DIR"
  git -C "$SRC_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$SRC_DIR" checkout -q "$BRANCH"
  git -C "$SRC_DIR" reset --hard -q "origin/$BRANCH"
else
  say "Cloning into $SRC_DIR"
  mkdir -p "$(dirname "$SRC_DIR")"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi

cd "$SRC_DIR"

say "Installing dependencies (this pulls Electron and Monaco, so it takes a few minutes)"
npm install --no-audit --no-fund

say "Building the AppImage"
npm run dist

APPIMAGE="$(ls -1t release/*.AppImage 2>/dev/null | head -n1 || true)"
[ -n "$APPIMAGE" ] || die "The build finished but no AppImage was produced. See the output above."

# --- Install -----------------------------------------------------------------

mkdir -p "$BIN_DIR" "$APP_DIR" "$ICON_DIR"
install -m 755 "$APPIMAGE" "$BIN_DIR/quarkcode"
[ -f build/icon.png ] && install -m 644 build/icon.png "$ICON_DIR/quarkcode.png"

cat > "$APP_DIR/quarkcode.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=QuarkCode
Comment=Agentic engineering crew for your projects
Exec=$BIN_DIR/quarkcode %U
Icon=quarkcode
Terminal=false
Categories=Development;IDE;
DESKTOP

command -v update-desktop-database >/dev/null 2>&1 &&
  update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true

# --- Desktop shortcut --------------------------------------------------------
# The Desktop folder is localised (Masaüstü, Escritorio, ...), so ask xdg for
# its real path before falling back to the usual English name.
DESKTOP_DIR=""
if command -v xdg-user-dir >/dev/null 2>&1; then
  DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
fi
if [ -z "$DESKTOP_DIR" ] || [ ! -d "$DESKTOP_DIR" ]; then
  for candidate in "$HOME/Desktop" "$HOME/Masaüstü"; do
    [ -d "$candidate" ] && DESKTOP_DIR="$candidate" && break
  done
fi

if [ -n "$DESKTOP_DIR" ] && [ -d "$DESKTOP_DIR" ] && [ "$DESKTOP_DIR" != "$HOME" ]; then
  install -m 755 "$APP_DIR/quarkcode.desktop" "$DESKTOP_DIR/quarkcode.desktop"
  # GNOME hides launchers it does not consider trusted.
  command -v gio >/dev/null 2>&1 &&
    gio set "$DESKTOP_DIR/quarkcode.desktop" metadata::trusted true >/dev/null 2>&1 || true
  say "Desktop shortcut: $DESKTOP_DIR/quarkcode.desktop"
else
  say "No Desktop folder found; QuarkCode is in the application menu instead."
fi

# --- Done --------------------------------------------------------------------

say "Installed $BIN_DIR/quarkcode ($(du -h "$BIN_DIR/quarkcode" | cut -f1))"

case ":$PATH:" in
  *":$BIN_DIR:"*) echo "Run it with: quarkcode" ;;
  *)
    echo "Run it with: $BIN_DIR/quarkcode"
    echo "To use the short name, add this to your shell profile:"
    echo "  export PATH=\"\$PATH:$BIN_DIR\""
    ;;
esac

echo "If the AppImage refuses to start because FUSE is missing:"
echo "  $BIN_DIR/quarkcode --appimage-extract-and-run"

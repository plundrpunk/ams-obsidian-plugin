#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/obsidian-plugin"
PLUGIN_ID="ams-memory-companion"
INSTALL_MODE="copy"
VAULT_PATH=""

usage() {
  cat <<'EOF'
Usage: ./scripts/install_obsidian_plugin.sh [--vault /path/to/vault] [--symlink]

If --vault is omitted, the script falls back to OBSIDIAN_VAULT_PATH from .env.
EOF
}

read_env_vault_path() {
  local env_file="${ROOT_DIR}/.env"
  if [[ ! -f "${env_file}" ]]; then
    return 0
  fi

  grep -E '^OBSIDIAN_VAULT_PATH=' "${env_file}" | tail -n 1 | cut -d'=' -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --vault)
      if [[ $# -lt 2 ]]; then
        usage
        exit 1
      fi
      VAULT_PATH="$2"
      shift 2
      ;;
    --symlink)
      INSTALL_MODE="symlink"
      shift
      ;;
    --copy)
      INSTALL_MODE="copy"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${VAULT_PATH}" ]]; then
  VAULT_PATH="$(read_env_vault_path)"
fi

if [[ -z "${VAULT_PATH}" ]]; then
  echo "Could not determine Obsidian vault path. Pass --vault or set OBSIDIAN_VAULT_PATH in .env." >&2
  exit 1
fi

if [[ ! -d "${VAULT_PATH}" ]]; then
  echo "Vault path does not exist: ${VAULT_PATH}" >&2
  exit 1
fi

TARGET_DIR="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"
mkdir -p "${TARGET_DIR}"

echo "Building Obsidian plugin..."
cd "${PLUGIN_DIR}"
npm install
npm run build

echo "Installing plugin into: ${TARGET_DIR}"
if [[ "${INSTALL_MODE}" == "symlink" ]]; then
  ln -sfn "${PLUGIN_DIR}/main.js" "${TARGET_DIR}/main.js"
  ln -sfn "${PLUGIN_DIR}/manifest.json" "${TARGET_DIR}/manifest.json"
  ln -sfn "${PLUGIN_DIR}/styles.css" "${TARGET_DIR}/styles.css"
else
  cp "${PLUGIN_DIR}/main.js" "${TARGET_DIR}/main.js"
  cp "${PLUGIN_DIR}/manifest.json" "${TARGET_DIR}/manifest.json"
  cp "${PLUGIN_DIR}/styles.css" "${TARGET_DIR}/styles.css"
fi

echo
echo "Installed ${PLUGIN_ID}."
echo "Next steps:"
echo "1. Open Obsidian."
echo "2. Enable Community Plugins if needed."
echo "3. Enable 'AMS Memory Companion'."
echo "4. Configure the AMS API URL and API key in plugin settings."

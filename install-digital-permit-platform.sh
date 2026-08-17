#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

fail() {
  printf '\nInstallation stopped\n%s\n' "$1" >&2
  exit 1
}

install_with_homebrew() {
  local display_name="$1"
  local learn_url="$2"
  shift 2

  printf '%s is required but is not installed at a supported version.\n' "$display_name"
  if ! command -v brew >/dev/null 2>&1; then
    fail "Ask your local IT administrator to install $display_name from $learn_url. Installing Homebrew or organisation-managed software may require local administrator approval; deploying to Azure does not."
  fi

  printf 'Install %s with Homebrew now? [Y/n] ' "$display_name"
  read -r answer
  case "${answer:-y}" in
    y|Y|yes|YES|Yes) ;;
    *) fail "Installation stopped. Install $display_name from $learn_url and run this launcher again." ;;
  esac

  brew install "$@" || fail "Homebrew could not install $display_name. Ask local IT for help or use $learn_url."
  hash -r
}

printf 'Digital Permit Platform\nCustomer-owned Azure installer\n\n'
printf 'Microsoft sign-in happens in your browser. No Azure password is collected by this installer.\n'
printf 'A resource preview is shown before any deployment approval.\n\n'
printf 'Local computer administrator rights are only needed if prerequisites are missing and device policy requires elevated installation.\n'
printf 'Azure permissions are separate and are checked after Microsoft sign-in.\n\n'

node_major=0
if command -v node >/dev/null 2>&1; then
  node_major="$(node --version | sed 's/^v//' | cut -d. -f1)"
fi
if [[ "$node_major" -lt 22 ]]; then
  install_with_homebrew 'Node.js 22 LTS' 'https://nodejs.org/en/download' node@22
  export PATH="$(brew --prefix node@22)/bin:$PATH"
fi
command -v node >/dev/null 2>&1 || fail 'Node.js 22 installation did not become available. Close Terminal, reopen it, and try again.'
node_major="$(node --version | sed 's/^v//' | cut -d. -f1)"
[[ "$node_major" -ge 22 ]] || fail 'Node.js 22 or later is required: https://nodejs.org/en/download'

if ! command -v azd >/dev/null 2>&1; then
  install_with_homebrew 'Azure Developer CLI' 'https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd' --cask azure/azd/azd
fi
if ! command -v az >/dev/null 2>&1; then
  install_with_homebrew 'Azure CLI' 'https://learn.microsoft.com/cli/azure/install-azure-cli-macos' azure-cli
fi
command -v azd >/dev/null 2>&1 || fail 'Azure Developer CLI is not available after installation. Close Terminal, reopen it, and try again.'
command -v az >/dev/null 2>&1 || fail 'Azure CLI is not available after installation. Close Terminal, reopen it, and try again.'

package_path="${1:-}"
if [[ -z "$package_path" ]]; then
  package_path="$(find "$PROJECT_ROOT" -maxdepth 1 -type f \( -name '*-setup.zip' -o -name 'customer-setup.zip' \) -print | head -n 1)"
fi
[[ -n "$package_path" && -f "$package_path" ]] || fail 'The council setup ZIP is missing. Download a fresh installer bundle and try again.'

printf '[1/3] Preparing the deployment assistant\n'
npm ci --no-audit --no-fund
printf '\n[2/3] Starting Microsoft sign-in, Azure preview and approval\n'
npm run setup:deploy -- --package "$package_path"
printf '\n[3/3] Installation complete\n'
printf 'Keep this folder and deployment-result.json for support and future updates.\n'

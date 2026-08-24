#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Some archive tools remove the executable bit from nested shell scripts.
chmod +x "$PROJECT_ROOT/install-digital-permit-platform.sh" 2>/dev/null || true
exec /usr/bin/env bash "$PROJECT_ROOT/install-digital-permit-platform.sh" "$@"

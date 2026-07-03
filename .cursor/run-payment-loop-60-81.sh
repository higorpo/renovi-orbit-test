#!/usr/bin/env bash
set -euo pipefail
PROMPT_FILE="$(dirname "$0")/payment-loop-60-81.prompt"
while true; do
  sleep 30
  python3 -c 'import json, pathlib; p=pathlib.Path("'"$PROMPT_FILE"'"); print("AGENT_LOOP_TICK_mmd", json.dumps({"prompt": p.read_text()}))'
done

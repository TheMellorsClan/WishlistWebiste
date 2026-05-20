#!/bin/zsh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/.wishlist-server.pid"
PORT_FILE="$APP_DIR/.wishlist-server.port"
LOG_FILE="$APP_DIR/.wishlist-server.log"
DEFAULT_PORT=8765

is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

port_is_free() {
  local port="$1"
  python3 - "$port" <<'PY' >/dev/null 2>&1
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    sock.bind(("127.0.0.1", port))
finally:
    sock.close()
PY
}

find_port() {
  local port="$DEFAULT_PORT"
  while [[ "$port" -lt 8800 ]]; do
    if port_is_free "$port"; then
      echo "$port"
      return
    fi
    port=$((port + 1))
  done

  echo "No free local port found between $DEFAULT_PORT and 8799." >&2
  exit 1
}

wait_for_server() {
  local port="$1"
  local attempts=0

  while [[ "$attempts" -lt 40 ]]; do
    if python3 - "$port" <<'PY' >/dev/null 2>&1
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(0.2)
try:
    sock.connect(("127.0.0.1", port))
finally:
    sock.close()
PY
    then
      return
    fi

    sleep 0.1
    attempts=$((attempts + 1))
  done
}

if [[ -f "$PID_FILE" && -f "$PORT_FILE" ]] && is_running "$(cat "$PID_FILE")"; then
  PORT="$(cat "$PORT_FILE")"
else
  PORT="$(find_port)"
  cd "$APP_DIR"
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 > "$LOG_FILE" 2>&1 &
  echo "$!" > "$PID_FILE"
  echo "$PORT" > "$PORT_FILE"
  wait_for_server "$PORT"
fi

open "http://127.0.0.1:$PORT/index.html"

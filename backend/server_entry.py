from __future__ import annotations

import argparse
import os
import threading
import time

import main


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FCX local solver service")
    parser.add_argument("--server", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--port", type=int, default=8000)
    return parser.parse_args()


def monitor_gui_parent() -> None:
    raw_parent = os.getenv("FCX_GUI_PARENT_PID", "")
    try:
        expected_parent = int(raw_parent)
    except ValueError:
        return
    if expected_parent <= 1:
        return

    def watch() -> None:
        while True:
            time.sleep(0.5)
            if os.getppid() != expected_parent:
                os._exit(0)

    threading.Thread(target=watch, name="fcx-parent-monitor", daemon=True).start()


if __name__ == "__main__":
    arguments = parse_args()
    monitor_gui_parent()
    main.start(arguments.port)

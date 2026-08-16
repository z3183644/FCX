"""Persistent, deduplicated counters for FCX-confirmed SBC activity."""

from __future__ import annotations

import json
import os
import sys
import threading
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any


_LOCK = threading.RLock()
_MAX_EVENT_IDS = 2000


def application_data_dir() -> Path:
    configured = os.getenv("FCX_BACKEND_DATA_DIR")
    if configured:
        return Path(configured).expanduser()
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "FCXBackend"
    if sys.platform == "win32":
        return Path(os.getenv("LOCALAPPDATA", Path.home())) / "FCXBackend"
    return Path(os.getenv("XDG_CONFIG_HOME", Path.home() / ".config")) / "FCXBackend"


def stats_path() -> Path:
    return application_data_dir() / "sbc-stats.json"


def _empty_state() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "total_squads_submitted": 0,
        "total_sets_completed": 0,
        "days": {},
        "by_set": {},
        "recent_event_ids": [],
    }


def _load(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict) or payload.get("schema_version") != 1:
            return _empty_state()
        state = _empty_state()
        state.update(payload)
        return state
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return _empty_state()


def _write(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    os.replace(temporary, path)


def _now() -> datetime:
    return datetime.now().astimezone()


def _validated_text(value: Any, field: str, maximum: int = 160) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} is required")
    if len(text) > maximum:
        raise ValueError(f"{field} is too long")
    return text


def _snapshot(state: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    current = now or _now()
    today_key = current.date().isoformat()
    today = state.get("days", {}).get(today_key, {})
    sets = []
    for set_id, item in state.get("by_set", {}).items():
        day = item.get("days", {}).get(today_key, {})
        sets.append({
            "set_id": set_id,
            "set_name": item.get("set_name") or set_id,
            "today_squads_submitted": int(day.get("squads_submitted", 0)),
            "today_sets_completed": int(day.get("sets_completed", 0)),
            "total_squads_submitted": int(item.get("squads_submitted", 0)),
            "total_sets_completed": int(item.get("sets_completed", 0)),
            "last_activity_at": item.get("last_activity_at"),
        })
    sets.sort(
        key=lambda item: (item.get("last_activity_at") or "", item["set_name"]),
        reverse=True,
    )
    return {
        "date": today_key,
        "today_squads_submitted": int(today.get("squads_submitted", 0)),
        "today_sets_completed": int(today.get("sets_completed", 0)),
        "total_squads_submitted": int(state.get("total_squads_submitted", 0)),
        "total_sets_completed": int(state.get("total_sets_completed", 0)),
        "by_set": sets,
    }


def get_stats(*, path: Path | None = None, now: datetime | None = None) -> dict[str, Any]:
    target = path or stats_path()
    with _LOCK:
        return _snapshot(_load(target), now)


def record_event(
    event: dict[str, Any],
    *,
    path: Path | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Record one EA-confirmed challenge submission or set completion."""

    event_id = _validated_text(event.get("event_id"), "event_id", 200)
    event_type = _validated_text(event.get("event_type"), "event_type", 40)
    if event_type not in {"challenge_submitted", "set_completed"}:
        raise ValueError("event_type must be challenge_submitted or set_completed")
    set_id = _validated_text(event.get("set_id"), "set_id", 80)
    set_name = _validated_text(event.get("set_name") or set_id, "set_name")
    current = now or _now()
    day_key = current.date().isoformat()
    timestamp = current.isoformat(timespec="seconds")
    target = path or stats_path()

    with _LOCK:
        state = _load(target)
        recent = list(state.get("recent_event_ids", []))
        if event_id in recent:
            snapshot = _snapshot(state, current)
            snapshot["accepted"] = True
            snapshot["duplicate"] = True
            return snapshot

        squads = 1 if event_type == "challenge_submitted" else 0
        completed = 1 if event_type == "set_completed" else 0
        state["total_squads_submitted"] = int(state.get("total_squads_submitted", 0)) + squads
        state["total_sets_completed"] = int(state.get("total_sets_completed", 0)) + completed

        days = state.setdefault("days", {})
        day = days.setdefault(day_key, {"squads_submitted": 0, "sets_completed": 0})
        day["squads_submitted"] = int(day.get("squads_submitted", 0)) + squads
        day["sets_completed"] = int(day.get("sets_completed", 0)) + completed

        by_set = state.setdefault("by_set", {})
        set_stats = by_set.setdefault(set_id, {
            "set_name": set_name,
            "squads_submitted": 0,
            "sets_completed": 0,
            "days": {},
        })
        set_stats["set_name"] = set_name
        set_stats["squads_submitted"] = int(set_stats.get("squads_submitted", 0)) + squads
        set_stats["sets_completed"] = int(set_stats.get("sets_completed", 0)) + completed
        set_stats["last_activity_at"] = timestamp
        set_day = set_stats.setdefault("days", {}).setdefault(
            day_key, {"squads_submitted": 0, "sets_completed": 0}
        )
        set_day["squads_submitted"] = int(set_day.get("squads_submitted", 0)) + squads
        set_day["sets_completed"] = int(set_day.get("sets_completed", 0)) + completed

        recent.append(event_id)
        state["recent_event_ids"] = recent[-_MAX_EVENT_IDS:]
        _write(target, state)
        snapshot = _snapshot(deepcopy(state), current)
        snapshot["accepted"] = True
        snapshot["duplicate"] = False
        return snapshot

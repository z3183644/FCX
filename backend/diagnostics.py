"""Turn solver internals into concise, actionable Chinese diagnostics."""

from __future__ import annotations

import re
from typing import Any


REQUIREMENT_NAMES = {
    "TEAM_RATING": "球队总评",
    "PLAYER_RARITY_GROUP": "球员稀有度组",
    "PLAYER_QUALITY": "球员品质",
    "CLUB_ID": "俱乐部",
    "LEAGUE_ID": "联赛",
    "NATION_ID": "国家/地区",
    "PLAYER_RARITY": "球员稀有度",
    "PLAYER_EXACT_OVR": "指定球员总评",
}


def humanize(message: object) -> dict[str, str] | None:
    raw = str(message or "").strip()
    if not raw:
        return None
    lowered = raw.lower()

    if "solver started" in lowered or "starting sbc solver" in lowered:
        return _item("info", "正在求解", "后端已开始为当前 SBC 计算阵容。", raw)
    match = re.search(r"Processing\s+(\d+)\s+players", raw, re.IGNORECASE)
    if match:
        return _item("info", "候选球员已载入", f"正在从 {match.group(1)} 名候选球员中寻找方案。", raw)
    if "completed successfully" in lowered:
        return _item("success", "求解完成", "后端已完成计算，结果已返回 FCX。", raw)
    if "error" in lowered or "exception" in lowered or "traceback" in lowered:
        return _item(
            "error", "求解遇到问题", "后端没有正常完成本次计算。",
            raw, "请重试；若仍失败，可复制技术详情用于反馈。"
        )
    if "infeasible" in lowered or "no solution" in lowered:
        return _item(
            "warning", "未找到可用阵容", "当前候选球员无法同时满足全部 SBC 要求。",
            raw, "可检查受保护球员、排除条件、价格范围，或增加候选球员。"
        )
    if "optimum" in lowered and ("not" in lowered or "fail" in lowered):
        return _item(
            "warning", "尚未证明最低成本", "求解时间结束前未能确认当前方案是最低成本。",
            raw, "可提高最大求解时间后再试。"
        )
    match = re.search(r"Failed requirement:\s*([A-Z_]+)", raw)
    if match:
        requirement = REQUIREMENT_NAMES.get(match.group(1), "阵容条件")
        return _item(
            "warning", f"{requirement}未满足", f"当前候选球员无法满足“{requirement}”要求。",
            raw, "请调整球员范围或相关筛选条件。"
        )
    if "rating" in lowered and ("failed" in lowered or "requires" in lowered):
        return _item(
            "warning", "球队总评未满足", "现有候选球员无法达到要求的总评区间。",
            raw, "可增加合适总评的球员，或减少保护与排除条件。"
        )
    return None


def diagnostics_for_logs(logs: list[dict[str, Any]]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for entry in logs:
        item = humanize(entry.get("message"))
        if item and (not items or items[-1] != item):
            items.append(item)
    return items[-12:]


def _item(
    level: str,
    title: str,
    message: str,
    raw: str,
    suggestion: str = "",
) -> dict[str, str]:
    return {
        "level": level,
        "title": title,
        "message": message,
        "suggestion": suggestion,
        "raw": raw,
    }

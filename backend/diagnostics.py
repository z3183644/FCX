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

    match = re.match(r"WEB_CLIENT\s+sbc_submission_failed:\s*(.*)", raw, re.IGNORECASE)
    if match:
        detail = match.group(1).strip()
        if re.search(r"(?:状态|status)\s*[:：]?\s*403|\b403\b", detail, re.IGNORECASE):
            return _item(
                "error", "EA 暂时拒绝了 SBC 提交",
                "求解方案已经生成，但 EA 返回 403，拒绝了这一次阵容提交。",
                raw,
                "先刷新 Web App 并确认账号仍在线；若持续出现，请暂停一段时间，并避免多个 SBC 插件同时提交。",
            )
        return _item(
            "error", "EA 提交失败", "后端已成功生成方案，但网页端未能向 EA 提交阵容。",
            raw, f"请在网页重新打开该 SBC 后重试。EA 返回：{detail}"
        )
    match = re.match(r"WEB_CLIENT\s+sbc_set_stopped:\s*(.*)", raw, re.IGNORECASE)
    if match:
        return _item(
            "warning", "整组 SBC 已停止", match.group(1).strip(),
            raw, "请按提示检查阵容状态；若仍失败，可复制技术详情用于反馈。"
        )
    match = re.match(
        r"WEB_CLIENT\s+(?:sbc_runtime_failed|sbc_submission_skipped):\s*(.*)",
        raw,
        re.IGNORECASE,
    )
    if match:
        return _item(
            "error", "方案未完成提交", match.group(1).strip(),
            raw, "求解器可能已经找到方案；请根据此处原因检查网页状态和自动提交设置。"
        )
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


def latest_sbc_stop_alert(logs: list[dict[str, Any]]) -> dict[str, Any] | None:
    for entry in reversed(logs):
        raw = str(entry.get("message") or "").strip()
        match = re.match(r"WEB_CLIENT\s+sbc_set_stopped:\s*(.*)", raw, re.IGNORECASE)
        if not match:
            continue
        reason = match.group(1).strip() or "网页端未提供具体原因。"
        occurred_at = float(entry.get("time") or 0)
        return {
            "event_id": f"{occurred_at:.6f}:{reason}",
            "title": "SBC 已停止",
            "reason": reason,
            "occurred_at": occurred_at,
        }
    return None


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
